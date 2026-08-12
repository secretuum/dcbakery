"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale } from "@/src/i18n/client";
// ПРИМЕЧАНИЕ: site-content.ts помечен "server-only" (тянет admin.ts). Из него в этот
// КЛИЕНТСКИЙ модуль нельзя импортировать ЗНАЧЕНИЯ — ломает сборку. Поэтому siteText
// продублирован локально ниже, а контент передаётся пропом из серверного layout.

/** Значение редактируемого текста по id: сохранённый override или запасной текст. */
export function siteText(content: Record<string, unknown>, id: string, fallback: string): string {
  const value = content[id];
  return typeof value === "string" && value.trim() ? value : fallback;
}

// Режим «редактирование сайта» для суперадмина: включается тумблером
// в Админке → Настройки (хранится в localStorage), после чего у редактируемых
// текстов на страницах появляются карандашики. Сохранение — в app_settings
// через /api/admin/settings (ключ site_content), затем router.refresh().

export const SITE_EDIT_STORAGE_KEY = "dc_site_edit";

export function readSiteEditFlag() {
  try {
    return window.localStorage.getItem(SITE_EDIT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSiteEditFlag(enabled: boolean) {
  try {
    window.localStorage.setItem(SITE_EDIT_STORAGE_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event("dc-site-edit-change"));
  } catch {
    // localStorage может быть недоступен — режим просто не включится
  }
}

function subscribeSiteEditFlag(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("dc-site-edit-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("dc-site-edit-change", callback);
  };
}

export function useSiteEditFlag() {
  return useSyncExternalStore(subscribeSiteEditFlag, readSiteEditFlag, () => false);
}

// Любой уникальный строковый id (не только фиксированные поля) — так редактируется
// «любая деталь» сайта: обернул текст в <EditableText field="уникальный.id" ...>.
type EditableField = string;

/** refresh: перерисовать серверную разметку после сохранения (по умолчанию да). */
type SaveOptions = { refresh?: boolean };

type SiteEditContextValue = {
  content: Record<string, unknown>;
  editMode: boolean;
  save: (field: EditableField, value: string, options?: SaveOptions) => Promise<boolean>;
  /** Сброс детали к первоначальному виду (убирает override). */
  reset: (field: EditableField, options?: SaveOptions) => Promise<boolean>;
};

export const SiteEditContext = createContext<SiteEditContextValue | null>(null);

/** Заглушка save/reset для read-only контекста обычных посетителей. */
const NOOP_PERSIST = async () => false;

type ProviderProps = {
  content: Record<string, unknown>;
  children: ReactNode;
};

/** Локальные, ещё не подтверждённые сервером правки: значение или null = «удалить». */
type ContentOverlay = Record<string, string | null>;

/** Состояние индикатора автосохранения для суперадмина. */
type SaveState = "idle" | "saving" | "saved";

function applyOverlay(base: Record<string, unknown>, overlay: ContentOverlay) {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === null) delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

export function SiteEditProvider({ content: initialContent, children }: ProviderProps) {
  const router = useRouter();
  // Режим включается в Админке → Настройки (флаг в localStorage).
  const editFlag = useSiteEditFlag();
  // B3: статус суперадмина дочитываем НА КЛИЕНТЕ (а не в серверном layout по cookie —
  // это форсило динамику всех публичных страниц). Fetch делаем ТОЛЬКО когда включён
  // флаг правки: обычные посетители/краулеры запрос не шлют, страница остаётся статикой.
  // Проверка авторитетна на сервере; клиентское true лишь показывает карандашики,
  // а сохранение всё равно требует админ-авторизации (/api/admin/settings).
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  useEffect(() => {
    // Правка выключена — не проверяем (и не трогаем state синхронно): editMode всё
    // равно гасится по editFlag ниже, стухший isSuperAdmin роли не играет.
    if (!editFlag) return;
    let cancelled = false;
    fetch("/api/admin/superadmin", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setIsSuperAdmin(Boolean((d as { isSuperAdmin?: unknown } | null)?.isSuperAdmin));
      })
      .catch(() => {
        if (!cancelled) setIsSuperAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editFlag]);
  const editMode = editFlag && isSuperAdmin;
  const [error, setError] = useState<string | null>(null);

  // Храним не копию контента, а ТОЛЬКО свои правки поверх серверного значения. Так
  // свежие данные с сервера (после router.refresh) подхватываются сами, без
  // синхронизации состояния, и не могут «залипнуть» устаревшим снимком.
  const [overlay, setOverlay] = useState<ContentOverlay>({});
  // Тот же overlay вне цикла рендера: сохранение шлёт site_content ЦЕЛИКОМ (сервер
  // перезаписывает строку без мержа), поэтому два сохранения подряд (автосейв
  // положения фото + замена файла) обязаны складываться, а не затирать друг друга.
  const overlayRef = useRef<ContentOverlay>({});
  // Очередь: один запрос в полёте, остальные ждут — иначе ответы могут прийти не в том
  // порядке и более старое значение перезапишет более свежее.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  // Индикатор автосохранения: без него суперадмин не понимает, улетела правка или нет
  // (перетаскивание фото и правка текста сохраняются молча).
  const [saveState, setSaveState] = useState<SaveState>("idle");
  // СЧЁТЧИК незавершённых правок, а не флаг: правки копятся в очереди, и булев флаг
  // погас бы на первом же ответе, пока следующее сохранение ещё летит.
  const pendingRef = useRef(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Хуки ОБЯЗАНЫ стоять выше раннего return для не-суперадминов (правило хуков):
  // иначе при смене роли порядок хуков разъедется и React упадёт.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const content = applyOverlay(initialContent, overlay);

  if (!editMode) {
    // Гости и обычные посетители: read-only контекст, чтобы на реальной странице
    // отображались СОХРАНЁННЫЕ суперадмином оверрайды (текст, картинки, их
    // положение/масштаб). Режим редактирования выключен, save/reset — заглушки
    // (интерфейс правок им не показывается). Без этого контекста оверрайды по
    // произвольным id (home.*) и картинки были видны только суперадмину.
    return (
      <SiteEditContext.Provider value={{ content: initialContent, editMode: false, save: NOOP_PERSIST, reset: NOOP_PERSIST }}>
        {children}
      </SiteEditContext.Provider>
    );
  }

  /** Правка встала в очередь: гасим таймер прошлого «Сохранено», иначе он погасил бы свежее «Сохраняю…». */
  function beginSave() {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    pendingRef.current += 1;
    if (mountedRef.current) setSaveState("saving");
  }

  /** Правка завершилась: «Сохранено» показываем, только когда очередь опустела. */
  function finishSave(ok: boolean) {
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    if (pendingRef.current > 0 || !mountedRef.current) return;
    if (!ok) {
      // Про неудачу говорит плашка error — «Сохранено» после неё было бы враньём.
      setSaveState("idle");
      return;
    }
    setSaveState("saved");
    savedTimerRef.current = setTimeout(() => {
      savedTimerRef.current = null;
      if (mountedRef.current) setSaveState("idle");
    }, 2000);
  }

  /**
   * Применить правку и сохранить site_content. Правка накладывается ВНУТРИ очереди на
   * актуальный overlay, поэтому параллельные сохранения складываются, а не затирают
   * друг друга. При ошибке правка откатывается.
   */
  function applyChange(patch: ContentOverlay, options?: SaveOptions): Promise<boolean> {
    // Считаем правку незавершённой уже здесь, а не в теле очереди: ожидающие своей
    // очереди сохранения — это тоже «ещё не сохранено».
    beginSave();

    const run = queueRef.current.then(async () => {
      const previous = overlayRef.current;
      const nextOverlay = { ...previous, ...patch };
      const nextContent = applyOverlay(initialContent, nextOverlay);

      setError(null);
      overlayRef.current = nextOverlay;
      setOverlay(nextOverlay);

      let ok = false;
      try {
        const response = await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "site_content", value: JSON.stringify(nextContent) }),
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || "Не удалось сохранить");
        }

        // Перерисовка серверной разметки нужна для текста (он приходит из RSC).
        // Для положения/масштаба фото — нет: картинка рисуется из локального
        // состояния, а refresh дёргал бы кэш всего сайта на каждый штрих.
        if (options?.refresh !== false) {
          router.refresh();
        }
        ok = true;
        return true;
      } catch (saveError) {
        // Откат: иначе следующее сохранение отправит непринятое сервером значение.
        overlayRef.current = previous;
        setOverlay(previous);
        setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить");
        return false;
      } finally {
        // В finally, а не по веткам: счётчик не должен «залипнуть» ни при каком исходе.
        finishSave(ok);
      }
    });

    // Очередь не должна вставать из-за ошибки одного сохранения.
    queueRef.current = run.catch(() => undefined);
    return run;
  }

  async function save(field: EditableField, value: string, options?: SaveOptions) {
    return applyChange({ [field]: value }, options);
  }

  // Сброс к первоначальному виду: убираем override-ключ → значение возвращается
  // к дефолту (defaultSiteContent) или к fallback-пропу компонента.
  async function reset(field: EditableField, options?: SaveOptions) {
    return applyChange({ [field]: null }, options);
  }

  return (
    <SiteEditContext.Provider value={{ content, editMode, save, reset }}>
      {children}

      {editMode ? (
        <div className="print-hidden fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
          {error ? (
            <p className="max-w-60 border border-burgundy bg-white px-3 py-2 text-xs font-semibold text-burgundy shadow-lg">
              {error}
            </p>
          ) : null}
          {/* Ошибка важнее: при ней показываем её, а не «Сохранено». */}
          {!error && saveState !== "idle" ? (
            <p
              aria-live="polite"
              className={`border bg-white px-3 py-2 text-xs font-semibold shadow-lg ${
                saveState === "saved" ? "border-coral text-coral" : "border-black/15 text-muted"
              }`}
            >
              {saveState === "saving" ? "Сохраняю…" : "Сохранено"}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => writeSiteEditFlag(false)}
            className="flex items-center gap-2 border border-coral bg-coral px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-coral-hover"
            title="Выключить можно и здесь, и в Настройках"
          >
            <span aria-hidden>✎</span>
            Режим редактирования — выключить
          </button>
        </div>
      ) : null}
    </SiteEditContext.Provider>
  );
}

// ─── Ленивая загрузка тяжёлого UI редактирования (C1) ───
// Карандаши/модалки/drag-resize/загрузка фото не нужны обычным посетителям и грузятся
// отдельным чанком (SiteEditControls) только когда суперадмин включил режим правки.
// ssr:false — редактор чисто клиентский (window/localStorage/pointer). Read-only рендер
// остаётся в лёгких шеллах EditableText/EditableImage ниже.
const EditableTextControl = dynamic(
  () => import("./SiteEditControls").then((m) => m.EditableTextControl),
  { ssr: false },
);
const EditableImageControl = dynamic(
  () => import("./SiteEditControls").then((m) => m.EditableImageControl),
  { ssr: false },
);

export type EditableTextProps = {
  field: EditableField;
  /** Значение для рендера без суперадмина (серверное) */
  fallback: string;
  multiline?: boolean;
  className?: string;
};

export function EditableText({ field, fallback, multiline = false, className }: EditableTextProps) {
  const ctx = useContext(SiteEditContext);
  const locale = useLocale();

  // Текст хранится ОТДЕЛЬНО ДЛЯ КАЖДОГО ЯЗЫКА: ключ `<id>@<локаль>`. Иначе правка,
  // сделанная на русской версии, показывалась бы и на казахской (а казахский —
  // главный язык сайта), затирая перевод. Пока правки для текущего языка нет,
  // работает fallback — это уже переведённое через t() значение.
  const storageKey = `${field}@${locale}`;
  const value = ctx ? siteText(ctx.content, storageKey, fallback) : fallback;

  // Обычные посетители и суперадмин вне режима правки — лёгкий read-only <span>.
  // Тяжёлый редактор (карандаш/модалка) грузится динамически только в режиме правки (C1).
  if (!ctx || !ctx.editMode) {
    return <span className={className} style={{ whiteSpace: "pre-line" }}>{value}</span>;
  }

  return <EditableTextControl field={field} fallback={fallback} multiline={multiline} className={className} />;
}

// ─────────────────────────── редактируемое изображение ───────────────────────────

/**
 * Трансформ картинки внутри её рамки: масштаб, сдвиг (в % от рамки), поворот и режим
 * вписывания. Хранится ОТДЕЛЬНОЙ JSON-строкой в site_content под ключом `${field}::t`
 * (рядом с ключом URL). Позволяет суперадмину подвинуть/приблизить/кадрировать фото,
 * не трогая раскладку страницы.
 */
export type ImgTransform = {
  scale: number;
  x: number;
  y: number;
  rotate: number;
  fit?: "contain" | "cover";
};

export const DEFAULT_TRANSFORM: ImgTransform = { scale: 1, x: 0, y: 0, rotate: 0 };

export const clampNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Ключ site_content, где лежит трансформ картинки (рядом с ключом URL). */
export function transformKeyFor(field: string) {
  return `${field}::t`;
}

export function parseTransform(value: unknown): ImgTransform | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const raw = JSON.parse(value) as Partial<ImgTransform>;
    const parsed: ImgTransform = {
      scale: clampNum(Number(raw.scale) || 1, 0.2, 4),
      x: clampNum(Number(raw.x) || 0, -150, 150),
      y: clampNum(Number(raw.y) || 0, -150, 150),
      rotate: clampNum(Number(raw.rotate) || 0, -180, 180),
    };
    if (raw.fit === "contain" || raw.fit === "cover") parsed.fit = raw.fit;
    return parsed;
  } catch {
    return null;
  }
}

export function transformStyle(t: ImgTransform): React.CSSProperties {
  const style: React.CSSProperties = {
    transform: `translate(${t.x}%, ${t.y}%) scale(${t.scale}) rotate(${t.rotate}deg)`,
    transformOrigin: "center",
  };
  // objectFit задаём ТОЛЬКО если суперадмин явно переключил вписывание — иначе
  // остаётся object-contain/object-cover из className картинки (у каждой свой).
  if (t.fit) style.objectFit = t.fit;
  return style;
}

export const isIdentityTransform = (t: ImgTransform) =>
  t.scale === 1 && t.x === 0 && t.y === 0 && t.rotate === 0 && !t.fit;

export type EditableImageProps = {
  /** Уникальный id override в site_content (URL картинки). */
  field: EditableField;
  /** Картинка по умолчанию (пока суперадмин не заменил). */
  fallbackSrc: string;
  alt?: string;
  className?: string;
  sizesHint?: string;
  /** LCP-подсказка для read-only next/image: только у героя первого экрана. */
  priority?: boolean;
  /** next/image sizes для read-only рендера (обязателен при fill, иначе грузится 100vw). */
  sizes?: string;
};

/**
 * Изображение, редактируемое суперадмином прямо на реальной странице. В режиме
 * редактирования: тянуть мышью — подвинуть, колесо — масштаб, тулбар — масштаб/поворот/
 * кадрирование/сброс/замена, клик — панель точной настройки (ползунки + загрузка).
 * URL хранится в site_content по field, положение/масштаб — по `${field}::t`.
 * Вне режима — обычный <img> с сохранённым трансформом (раскладка не меняется).
 */
export function EditableImage({
  field,
  fallbackSrc,
  alt = "",
  className,
  sizesHint,
  priority,
  sizes,
}: EditableImageProps) {
  const ctx = useContext(SiteEditContext);
  const src = ctx ? siteText(ctx.content, field, fallbackSrc) : fallbackSrc;
  const storedTransform = ctx ? parseTransform(ctx.content[transformKeyFor(field)]) : null;

  // read-only (все посетители и суперадмин вне режима правки): оптимизированный
  // next/image (AVIF/WebP, srcset, priority для LCP-героя) + сохранённый трансформ.
  // fill — размеры загруженного фото заранее неизвестны, а родитель у всех
  // использований позиционирован и с размером. Тяжёлый редактор (drag/resize/модалка/
  // загрузка) грузится динамически только в режиме правки суперадмина (C1).
  if (!ctx || !ctx.editMode) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes ?? "(max-width: 1024px) 90vw, 45vw"}
        priority={priority}
        className={className}
        style={storedTransform ? transformStyle(storedTransform) : undefined}
      />
    );
  }

  return (
    <EditableImageControl
      field={field}
      fallbackSrc={fallbackSrc}
      alt={alt}
      className={className}
      sizesHint={sizesHint}
    />
  );
}
