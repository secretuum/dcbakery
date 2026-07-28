/* ============================================================================
   DC BAKERY — ПРОТОТИП РЕДИЗАЙНА · script.js
   ----------------------------------------------------------------------------
   Дизайн-прототип без backend. Все действия локальные и демонстрационные:
   ничего не отправляется, не сохраняется на сервере и не оплачивается.

   Часть 1 из 3: утилиты, маршрутизация, оверлеи, тосты, инспектор состояний.
   ========================================================================== */

(function () {
  "use strict";

  var D = window.DC;
  if (!D) {
    console.error("data.js не загружен");
    return;
  }

  /* ------------------------------------------------------------------------
     1. УТИЛИТЫ
     ---------------------------------------------------------------------- */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** Экранирование текста перед вставкой в разметку. */
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** 15000 → «15 000 ₸» (неразрывные пробелы, как в тенге). */
  function money(value) {
    var n = Math.round(Number(value) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₸";
  }

  function num(value) {
    return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  /** Склонение: plural(3, ['позиция','позиции','позиций']) */
  function plural(n, forms) {
    var a = Math.abs(n) % 100;
    var b = a % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b > 1 && b < 5) return forms[1];
    if (b === 1) return forms[0];
    return forms[2];
  }

  function icon(name, size, width) {
    return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="' + (width || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  }

  var PRODUCTS_BY_ID = {};
  D.PRODUCTS.forEach(function (p) { PRODUCTS_BY_ID[p.id] = p; });
  function product(id) { return PRODUCTS_BY_ID[id]; }

  /** Состояние наличия: in / low / out. */
  function stockState(p) {
    if (!p.stock) return "out";
    if (p.stock <= D.CONFIG.lowStockThreshold) return "low";
    return "in";
  }

  function stockLabel(p) {
    var s = stockState(p);
    if (s === "out") return "Нет в наличии";
    if (s === "low") return "Мало · осталось " + p.stock;
    return "В наличии";
  }

  /* ------------------------------------------------------------------------
     2. ОБЩЕЕ СОСТОЯНИЕ ПРОТОТИПА
     ---------------------------------------------------------------------- */

  var state = {
    route: "home",
    params: {},
    cart: [],                 // [{ id, qty }]
    cartWarnId: null,         // позиция с предупреждением об остатке
    promoState: "progress",
    catalogState: "normal",
    catalogVisible: 12,
    filters: {
      categories: [],
      subcategories: [],
      min: null,
      max: null,
      inStock: false,
      halal: false,
      query: "",
      sort: "default",
    },
    psheetId: null,
    productId: "tort-medovik",
    orderNumber: "DC-2607-0148",
    ordersFilter: "all",
    lang: "RU",
  };

  /* ------------------------------------------------------------------------
     3. ОВЕРЛЕИ (модальные окна, панели, шторки)
     ---------------------------------------------------------------------- */

  var scrim = $("[data-scrim]");
  var openOverlays = [];

  function lockBody(lock) {
    document.body.classList.toggle("is-locked", !!lock);
  }

  function openOverlay(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add("is-open");
    if (openOverlays.indexOf(id) === -1) openOverlays.push(id);
    if (scrim) scrim.classList.add("is-open");
    lockBody(true);
    var toggle = document.querySelector('[data-toggle="' + id + '"]');
    if (toggle) toggle.setAttribute("aria-expanded", "true");
  }

  function closeOverlay(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("is-open");
    openOverlays = openOverlays.filter(function (x) { return x !== id; });
    if (!openOverlays.length) {
      if (scrim) scrim.classList.remove("is-open");
      lockBody(false);
    }
    var toggle = document.querySelector('[data-toggle="' + id + '"]');
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  function closeAllOverlays() {
    openOverlays.slice().forEach(closeOverlay);
    closeDropdowns();
  }

  document.addEventListener("click", function (e) {
    var openBtn = e.target.closest("[data-open]");
    if (openBtn) {
      var id = openBtn.getAttribute("data-open");
      if (id === "cart") renderCart();
      openOverlay(id);
      return;
    }
    var closeBtn = e.target.closest("[data-close]");
    if (closeBtn) {
      closeOverlay(closeBtn.getAttribute("data-close"));
    }
  });

  if (scrim) scrim.addEventListener("click", closeAllOverlays);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllOverlays();
  });

  /* --- Выпадающие меню --------------------------------------------------- */

  function closeDropdowns() {
    $$(".lang.is-open").forEach(function (el) {
      el.classList.remove("is-open");
      var t = $(".lang__toggle", el);
      if (t) t.setAttribute("aria-expanded", "false");
    });
    $$(".tip.is-open").forEach(function (el) { el.classList.remove("is-open"); });
  }

  document.addEventListener("click", function (e) {
    var langToggle = e.target.closest('[data-toggle="lang"]');
    if (langToggle) {
      var lang = langToggle.closest(".lang");
      var wasOpen = lang.classList.contains("is-open");
      closeDropdowns();
      if (!wasOpen) {
        lang.classList.add("is-open");
        langToggle.setAttribute("aria-expanded", "true");
      }
      return;
    }
    var tipBtn = e.target.closest("[data-tip]");
    if (tipBtn) {
      var tip = tipBtn.closest(".tip");
      var open = tip.classList.contains("is-open");
      closeDropdowns();
      if (!open) tip.classList.add("is-open");
      return;
    }
    if (!e.target.closest(".dropdown") && !e.target.closest(".tip")) closeDropdowns();
  });

  /* --- Переключение языка (визуальная демонстрация) ---------------------- */

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-lang]");
    if (!btn) return;
    var code = btn.getAttribute("data-lang");
    state.lang = code;
    var current = $("#lang-current");
    if (current) current.textContent = code;
    $$("[data-lang]").forEach(function (b) {
      var active = b.getAttribute("data-lang") === code;
      b.classList.toggle("is-active", active);
    });
    closeDropdowns();
    toast("Язык интерфейса: " + ({ RU: "русский", KK: "қазақша", EN: "english" }[code] || code) +
      ". В прототипе переключение — визуальная демонстрация.", "info");
  });

  /* --- Мобильное меню ---------------------------------------------------- */

  document.addEventListener("click", function (e) {
    if (e.target.closest('[data-open="menu"]')) {
      $("#mobilemenu").classList.add("is-open");
      lockBody(true);
      return;
    }
    if (e.target.closest('[data-close="menu"]')) {
      $("#mobilemenu").classList.remove("is-open");
      lockBody(false);
      return;
    }
    var link = e.target.closest("#mobilemenu a[href^='#']");
    if (link) {
      $("#mobilemenu").classList.remove("is-open");
      lockBody(false);
    }
  });

  /* ------------------------------------------------------------------------
     4. ТОСТЫ
     ---------------------------------------------------------------------- */

  var toastsRoot = $("[data-toasts]");

  function toast(message, kind) {
    if (!toastsRoot) return;
    var el = document.createElement("div");
    el.className = "toast" + (kind ? " toast--" + kind : "");
    var ic = kind === "error" ? "alert-circle" : kind === "success" ? "check-circle" : "info";
    el.innerHTML = icon(ic, 18) + "<span>" + esc(message) + "</span>" +
      '<button class="toast__close" type="button" aria-label="Закрыть">' + icon("close", 15, 2) + "</button>";
    toastsRoot.appendChild(el);
    var timer = setTimeout(remove, 4200);
    el.querySelector(".toast__close").addEventListener("click", function () {
      clearTimeout(timer);
      remove();
    });
    function remove() {
      el.classList.add("is-leaving");
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }
    while (toastsRoot.children.length > 3) toastsRoot.removeChild(toastsRoot.firstChild);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-toast]");
    if (btn) toast(btn.getAttribute("data-toast"), btn.getAttribute("data-toast-kind") || "info");
  });

  /* --- Кнопки розницы: адрес не задан в проекте --------------------------- */

  document.addEventListener("click", function (e) {
    var retail = e.target.closest("[data-retail]");
    if (!retail) return;
    if (D.CONFIG.retailUrl === "#") {
      e.preventDefault();
      toast("Розничный заказ — переход в del Cappuccino. Точный адрес не задан в проекте (TODO для backend).", "info");
    }
  });

  /* ------------------------------------------------------------------------
     5. ШАПКА: sticky-состояние
     ---------------------------------------------------------------------- */

  var header = $("#header");
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      header.classList.toggle("is-stuck", window.scrollY > 16);
      ticking = false;
    });
  }, { passive: true });

  /* ------------------------------------------------------------------------
     6. МАРШРУТИЗАЦИЯ (hash-роуты)
     Формат: #/route?param=value  · например #/catalog?category=deserty
     ---------------------------------------------------------------------- */

  var ROUTES = [
    { id: "home", title: "Главная" },
    { id: "catalog", title: "Каталог" },
    { id: "product", title: "Карточка товара" },
    { id: "cart", title: "Корзина" },
    { id: "checkout", title: "Оформление" },
    { id: "login", title: "Вход" },
    { id: "register", title: "Регистрация" },
    { id: "forgot-password", title: "Восстановление пароля" },
    { id: "profile", title: "Профиль" },
    { id: "orders", title: "Заказы" },
    { id: "order-details", title: "Детали заказа" },
    { id: "oferta", title: "Оферта" },
    { id: "privacy", title: "Конфиденциальность" },
    { id: "payment-delivery", title: "Оплата и доставка" },
    { id: "contacts", title: "Контакты" },
    { id: "404", title: "404" },
  ];
  var ROUTE_IDS = ROUTES.map(function (r) { return r.id; });

  function parseHash() {
    var raw = location.hash.replace(/^#/, "");
    if (!raw || raw === "/") return { route: "home", params: {}, anchor: "" };

    // Якорь внутри маршрута: #/home#about
    var anchor = "";
    var hashIdx = raw.indexOf("#", 1);
    if (hashIdx > -1) {
      anchor = raw.slice(hashIdx + 1);
      raw = raw.slice(0, hashIdx);
    }

    var qIdx = raw.indexOf("?");
    var path = qIdx > -1 ? raw.slice(0, qIdx) : raw;
    var query = qIdx > -1 ? raw.slice(qIdx + 1) : "";

    var params = {};
    query.split("&").filter(Boolean).forEach(function (pair) {
      var kv = pair.split("=");
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    });

    var route = path.replace(/^\//, "").split("/")[0];
    if (ROUTE_IDS.indexOf(route) === -1) route = "404";
    return { route: route, params: params, anchor: anchor };
  }

  function navigate() {
    var parsed = parseHash();
    state.route = parsed.route;
    state.params = parsed.params;

    $$(".route").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-route") === parsed.route);
    });

    $$(".header__link").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("href") === "#/" + parsed.route);
    });
    $$("[data-bnav]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-bnav") === parsed.route);
    });

    onRouteEnter(parsed);
    buildInspectorStates();
    updateCartUI();

    if (parsed.anchor) {
      var target = document.getElementById(parsed.anchor);
      if (target) {
        requestAnimationFrame(function () {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  window.addEventListener("hashchange", navigate);

  /* ------------------------------------------------------------------------
     7. ИНСПЕКТОР СОСТОЯНИЙ
     ---------------------------------------------------------------------- */

  /** Каталог состояний каждого экрана — то, что можно посмотреть в прототипе. */
  var ROUTE_STATES = {
    home: [
      { label: "Прогресс акции 0%", run: function () { setPromoState("empty"); } },
      { label: "Прогресс акции 65%", run: function () { setPromoState("progress"); } },
      { label: "Награда получена", run: function () { setPromoState("reward"); } },
      { label: "Условия акции раскрыты", run: function () { $("#reward-terms").classList.add("is-open"); } },
      { label: "Корзина пустая", run: function () { setCartPreset("empty"); } },
      { label: "Корзина с индикатором", run: function () { setCartPreset("above"); } },
    ],
    catalog: [
      { label: "Обычная загрузка", run: function () { setCatalogState("normal"); } },
      { label: "Skeleton", run: function () { setCatalogState("skeleton"); } },
      { label: "Пустой результат", run: function () { setCatalogState("empty"); } },
      { label: "Ошибка загрузки", run: function () { setCatalogState("error"); } },
      { label: "Активные фильтры", run: function () { demoFilters(); } },
      { label: "Фильтры на mobile", run: function () { openOverlay("filters"); } },
      { label: "Сбросить фильтры", run: function () { resetFilters(); } },
    ],
    product: [
      { label: "Обычное", run: function () { setProductState("normal"); } },
      { label: "Loading", run: function () { setProductState("loading"); } },
      { label: "Ошибка данных", run: function () { setProductState("error"); } },
      { label: "Товар без фото", run: function () { openProductPage("ribay"); } },
      { label: "Нет в наличии", run: function () { openProductPage("tary-chizkeyk"); } },
      { label: "Мало товара", run: function () { openProductPage("tort-napoleon"); } },
    ],
    cart: [
      { label: "Пустая", run: function () { setCartPreset("empty"); } },
      { label: "Ниже минимума", run: function () { setCartPreset("below"); } },
      { label: "Минимум достигнут", run: function () { setCartPreset("above"); } },
      { label: "Предупреждение об остатке", run: function () { setCartPreset("warn"); } },
      { label: "Loading", run: function () { setCartState("loading"); } },
      { label: "Ошибка", run: function () { setCartState("error"); } },
      { label: "Подтверждение удаления", run: function () { openOverlay("confirm-remove"); } },
    ],
    checkout: [
      { label: "Пустая форма", run: function () { setCheckoutState("form"); clearCheckout(); } },
      { label: "Заполненная форма", run: function () { setCheckoutState("form"); fillCheckout(); } },
      { label: "Ошибки валидации", run: function () { setCheckoutState("form"); clearCheckout(); validateCheckout(true); } },
      { label: "Loading отправки", run: function () { setCheckoutState("loading"); } },
      { label: "Ошибка backend", run: function () { setCheckoutState("error"); } },
      { label: "Заявка создана", run: function () { setCheckoutState("success"); } },
    ],
    login: [
      { label: "Форма", run: function () { setPanelState("login", "form"); } },
      { label: "Loading", run: function () { setPanelState("login", "loading"); } },
      { label: "Ошибка входа", run: function () { setPanelState("login", "error"); } },
      { label: "Менеджерский вход", run: function () { setPanelState("login", "manager"); } },
    ],
    register: [
      { label: "Анкета", run: function () { setPanelState("register", "form"); } },
      { label: "Код из WhatsApp", run: function () { setPanelState("register", "otp"); } },
      { label: "Неверный код", run: function () { setPanelState("register", "otp-error"); } },
      { label: "Аккаунт создан", run: function () { setPanelState("register", "success"); } },
    ],
    "forgot-password": [
      { label: "Форма", run: function () { setPanelState("forgot", "form"); } },
      { label: "Письмо отправлено", run: function () { setPanelState("forgot", "sent"); } },
    ],
    profile: [
      { label: "Обычный профиль", run: function () {} },
      { label: "Редактирование реквизитов", run: function () { openOverlay("edit-requisites"); } },
      { label: "Выход из аккаунта", run: function () { openOverlay("logout"); } },
    ],
    orders: [
      { label: "Список заказов", run: function () { setOrdersState("normal"); } },
      { label: "Loading", run: function () { setOrdersState("loading"); } },
      { label: "Заказов нет", run: function () { setOrdersState("empty"); } },
    ],
    "order-details": [
      { label: "Ждёт подтверждения", run: function () { openOrder("DC-2607-0148"); } },
      { label: "Ожидает оплаты", run: function () { openOrder("DC-2607-0139"); } },
      { label: "Отгружен", run: function () { openOrder("DC-2607-0121"); } },
      { label: "Завершён", run: function () { openOrder("DC-2606-0104"); } },
      { label: "Отменён", run: function () { openOrder("DC-2606-0092"); } },
      { label: "Платёжный шлюз", run: function () { openOverlay("payment"); } },
    ],
  };

  var inspector = $("#inspector");

  document.addEventListener("click", function (e) {
    if (e.target.closest('[data-toggle="inspector"]')) {
      var open = inspector.classList.toggle("is-open");
      $('[data-toggle="inspector"]').setAttribute("aria-expanded", open ? "true" : "false");
    }
  });

  function buildInspectorRoutes() {
    var root = $("[data-inspector-routes]");
    if (!root) return;
    root.innerHTML = ROUTES.map(function (r) {
      return '<a class="inspector__btn" href="#/' + r.id + '" data-inspector-route="' + r.id + '">' + esc(r.title) + "</a>";
    }).join("");
  }

  function buildInspectorStates() {
    var root = $("[data-inspector-states]");
    var group = $("[data-inspector-states-group]");
    if (!root || !group) return;
    var list = ROUTE_STATES[state.route];
    if (!list || !list.length) {
      group.classList.add("hidden");
      root.innerHTML = "";
    } else {
      group.classList.remove("hidden");
      root.innerHTML = list.map(function (s, i) {
        return '<button class="inspector__btn" type="button" data-state-index="' + i + '">' + esc(s.label) + "</button>";
      }).join("");
    }
    $$("[data-inspector-route]").forEach(function (el) {
      el.classList.toggle("is-active", el.getAttribute("data-inspector-route") === state.route);
    });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-state-index]");
    if (!btn) return;
    var list = ROUTE_STATES[state.route] || [];
    var item = list[Number(btn.getAttribute("data-state-index"))];
    if (item) {
      item.run();
      $$("[data-state-index]").forEach(function (b) { b.classList.remove("is-active"); });
      btn.classList.add("is-active");
    }
  });

  /* Быстрые кнопки инспектора для слоёв, которым нужен контекст */
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-inspector-lang]")) {
      var lang = $("#lang");
      if (lang) {
        closeDropdowns();
        lang.classList.add("is-open");
        lang.scrollIntoView({ block: "center" });
      } else {
        toast("Выбор языка доступен на ширине от 640px", "info");
      }
    }
    if (e.target.closest("[data-inspector-psheet]")) openProductSheet("tort-medovik");
    if (e.target.closest("[data-inspector-tooltip]")) {
      if (state.route !== "home") location.hash = "#/home";
      setTimeout(function () {
        var tip = $("#reward .tip");
        if (tip) {
          closeDropdowns();
          tip.classList.add("is-open");
          tip.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 120);
    }
  });

  /* Части 2 и 3 продолжаются ниже внутри этой же области видимости. */

  /* ==========================================================================
     Часть 2 из 3: рендер карточек, главной страницы, акции и каталога.
     ========================================================================== */

  /* ------------------------------------------------------------------------
     8. КАРТОЧКИ ТОВАРОВ
     ---------------------------------------------------------------------- */

  /** Нейтральная заглушка вместо отсутствующей фотографии. */
  function photoFallback(p, compact) {
    return '<div class="photo-fallback">' +
      '<svg class="photo-fallback__mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#i-image"/></svg>' +
      '<span class="photo-fallback__name">' + esc(p.name) + "</span>" +
      (compact ? "" : '<span class="photo-fallback__note">фото готовится</span>') +
      "</div>";
  }

  function media(p, compact) {
    return p.image
      ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" width="500" height="500">'
      : photoFallback(p, compact);
  }

  function flags(p) {
    var out = [];
    if (p.isNew) out.push('<span class="badge badge--accent">Новинка</span>');
    if (p.isPopular) out.push('<span class="badge badge--soft">Хит</span>');
    if (!p.image) out.push('<span class="badge badge--neutral">Без фото</span>');
    if (!p.stock) out.push('<span class="badge badge--neutral">Нет в наличии</span>');
    else if (p.stock <= D.CONFIG.lowStockThreshold) out.push('<span class="badge badge--warning">Мало</span>');
    return out.length ? '<div class="product-card__flags">' + out.join("") + "</div>" : "";
  }

  /** Компактная товарная карточка для сетки и лент. */
  function productCard(p) {
    var qty = cartQty(p.id);
    var st = stockState(p);
    var control = !p.stock
      ? '<button class="btn btn--xs btn--secondary product-card__add" type="button" disabled>Нет</button>'
      : qty
        ? '<span class="stepper stepper--sm product-card__stepper">' +
            '<button class="stepper__btn" type="button" data-qty="-1" data-id="' + p.id + '" aria-label="Уменьшить">' + icon("minus", 14, 2.2) + "</button>" +
            '<span class="stepper__value">' + qty + "</span>" +
            '<button class="stepper__btn" type="button" data-qty="1" data-id="' + p.id + '" aria-label="Увеличить"' + (qty >= p.stock ? " disabled" : "") + ">" + icon("plus", 14, 2.2) + "</button>" +
          "</span>"
        : '<button class="icon-btn icon-btn--sm icon-btn--accent product-card__add" type="button" data-add="' + p.id + '" aria-label="Добавить ' + esc(p.name) + '">' + icon("plus", 17, 2.2) + "</button>";

    return '<article class="product-card' + (!p.stock ? " is-out" : "") + '" data-card="' + p.id + '">' +
      '<div class="product-card__media" data-product-open="' + p.id + '" role="button" tabindex="0" aria-label="Открыть ' + esc(p.name) + '">' +
        media(p) + flags(p) +
        '<span class="product-card__added">' + icon("check", 15, 2.4) + "Добавлено</span>" +
      "</div>" +
      '<div class="product-card__body">' +
        '<h3 class="product-card__name" data-product-open="' + p.id + '" role="button" tabindex="0">' + esc(p.name) + "</h3>" +
        '<p class="product-card__meta"><span>' + esc(p.weightLabel) + "</span><span>·</span>" +
          '<span class="stock stock--' + st + '">' + esc(stockLabel(p)) + "</span></p>" +
        '<div class="product-card__foot">' +
          '<span class="product-card__price">' + money(p.price) + "<small>за упаковку</small></span>" +
          control +
        "</div>" +
      "</div>" +
    "</article>";
  }

  /** Крупная poster-карточка с фотографией на всю площадь. */
  function posterCard(p) {
    return '<article class="poster-card" data-card="' + p.id + '">' +
      '<div data-product-open="' + p.id + '" role="button" tabindex="0" aria-label="Открыть ' + esc(p.name) + '" style="position:absolute;inset:0">' +
        (p.image
          ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" width="600" height="750">'
          : photoFallback(p)) +
        '<span class="poster-card__scrim"></span>' +
      "</div>" +
      (p.isNew ? '<span class="badge badge--accent poster-card__tag">Новинка</span>' : "") +
      '<div class="poster-card__body">' +
        '<span class="poster-card__text">' +
          '<span class="poster-card__name">' + esc(p.name) + "</span>" +
          '<span class="poster-card__price">' + money(p.price) + " · " + esc(p.weightLabel) + "</span>" +
        "</span>" +
        (p.stock
          ? '<button class="icon-btn icon-btn--dark poster-card__add" type="button" data-add="' + p.id + '" aria-label="Добавить ' + esc(p.name) + '">' + icon("plus", 20, 2.2) + "</button>"
          : '<span class="badge badge--neutral poster-card__add">Нет в наличии</span>') +
      "</div>" +
    "</article>";
  }

  /** Компактная строка — для быстрого повтора заказа. */
  function miniCard(p, qty) {
    return '<button class="mini-card" type="button" data-product-open="' + p.id + '">' +
      '<span class="mini-card__img">' + media(p, true) + "</span>" +
      '<span class="mini-card__text">' +
        '<span class="mini-card__name">' + esc(p.name) + "</span>" +
        '<span class="mini-card__price">' + money(p.price) + (qty ? " · " + qty + " шт" : "") + "</span>" +
      "</span>" +
      '<span class="icon-btn icon-btn--sm icon-btn--bare" aria-hidden="true">' + icon("chev-right", 16, 2) + "</span>" +
    "</button>";
  }

  function categoryCard(c) {
    return '<a class="cat-card" href="#/catalog?category=' + c.slug + '">' +
      '<span class="cat-card__bg" aria-hidden="true"></span>' +
      '<span class="cat-card__icon"><img src="' + esc(c.icon) + '" alt="" width="32" height="32"></span>' +
      "<span>" +
        '<span class="cat-card__name">' + esc(c.name) + "</span>" +
        '<span class="cat-card__tagline">' + esc(c.tagline) + "</span>" +
      "</span>" +
      '<span class="cat-card__count">' + c.count + " " + plural(c.count, ["позиция", "позиции", "позиций"]) + icon("arrow-right", 15, 2) + "</span>" +
    "</a>";
  }

  function renderList(selector, items, renderer) {
    var root = $(selector);
    if (!root) return;
    root.innerHTML = items.map(renderer).join("");
  }

  /* ------------------------------------------------------------------------
     9. ГЛАВНАЯ СТРАНИЦА
     ---------------------------------------------------------------------- */

  function byIds(ids) {
    return ids.map(product).filter(Boolean);
  }

  function byCategory(slug, limit) {
    var cat = D.CATEGORIES.filter(function (c) { return c.slug === slug; })[0];
    if (!cat) return [];
    var list = D.PRODUCTS.filter(function (p) { return p.category === cat.name; });
    return limit ? list.slice(0, limit) : list;
  }

  function renderHome() {
    renderList('[data-list="popular-posters"]', byIds(D.COLLECTION_ITEMS.popular).slice(0, 4), posterCard);
    renderList('[data-list="seasonal-posters"]', byIds(D.COLLECTION_ITEMS.seasonal).slice(0, 3), posterCard);
    renderList('[data-list="showcase"]', byIds(D.COLLECTION_ITEMS.showcase).slice(0, 4), productCard);
    renderList('[data-list="deserty"]', byCategory("deserty", 4), productCard);
    renderList('[data-list="polufabrikaty"]', byCategory("polufabrikaty", 4), productCard);
    renderList('[data-list="myaso"]', byCategory("myaso", 4), productCard);
    renderList('[data-list="categories"]', D.CATEGORIES, categoryCard);

    // Быстрый повтор заказа
    var last = D.ORDERS.filter(function (o) { return o.number === "DC-2607-0121"; })[0];
    if (last) {
      renderList('[data-list="repeat"]', last.items, function (it) {
        var p = product(it.slug);
        return p ? productCard(p) : "";
      });
    }

    // Преимущества
    renderList('[data-list="advantages"]', D.CONTENT.advantages, function (a, i) {
      var icons = ["percent", "package", "snow", "repeat", "file", "wheat"];
      return '<div class="surface pad-5" style="border-radius:var(--r-xl)">' +
        '<span class="cat-card__icon" style="width:46px;height:46px">' +
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><use href="#i-' + icons[i % icons.length] + '"/></svg>' +
        "</span>" +
        '<h3 class="mt-4" style="font-size:var(--t-h4)">' + esc(a.title) + "</h3>" +
        '<p class="text-sm text-muted mt-2" style="line-height:1.6">' + esc(a.text) + "</p>" +
      "</div>";
    });

    // Этапы заказа
    renderList('[data-list="steps"]', D.CONTENT.orderSteps, function (s) {
      return '<div class="glass glass--dark pad-5" style="border-radius:var(--r-xl)">' +
        '<p class="mono" style="font-size:var(--t-h3);font-weight:600;color:var(--accent-300)">' + esc(s.n) + "</p>" +
        '<p class="mt-5" style="font-family:var(--font-display);font-size:var(--t-h4);font-weight:700">' + esc(s.title) + "</p>" +
        '<p class="text-sm mt-2" style="color:var(--on-dark-muted);line-height:1.6">' + esc(s.text) + "</p>" +
      "</div>";
    });

    renderPromo();
  }

  /* ------------------------------------------------------------------------
     10. АКЦИЯ «5 ДЕСЕРТОВ» — визуальные состояния прогресса
     ---------------------------------------------------------------------- */

  function renderPromo() {
    var promo = D.PROMO;
    var root = $("#reward");
    if (!root) return;

    // Карточки подарочных десертов
    renderList("[data-reward-gifts]", promo.giftSlugs, function (slug, i) {
      var p = product(slug);
      var name = p ? p.name : promo.giftOptions[i];
      return '<span class="giftcard">' +
        '<span class="giftcard__img">' + (p && p.image
          ? '<img src="' + esc(p.image) + '" alt="' + esc(name) + '" loading="lazy" width="120" height="120">'
          : '<span class="photo-fallback"><span class="photo-fallback__name">' + esc(name) + "</span></span>") + "</span>" +
        "<span>" + esc(promo.giftOptions[i] || name) + "</span>" +
      "</span>";
    });

    // Условия
    renderList("[data-reward-terms]", promo.details, function (d) {
      return "<li>" + esc(d) + "</li>";
    });

    setPromoState(state.promoState);
  }

  function setPromoState(key) {
    state.promoState = key;
    var promo = D.PROMO;
    var conf = promo.states[key];
    var root = $("#reward");
    if (!root || !conf) return;

    var pct = Math.min(100, (conf.current / promo.threshold) * 100);
    var left = Math.max(0, promo.threshold - conf.current);
    var complete = conf.current >= promo.threshold;

    root.setAttribute("data-state", key);
    root.classList.toggle("is-complete", complete);

    var amount = $("[data-reward-amount]", root);
    var caption = $("[data-reward-caption]", root);
    if (complete) {
      amount.textContent = "5 десертов ваши";
      caption.textContent = "набрано " + money(conf.current) + " за неделю — подарок приедет со следующим заказом";
    } else if (conf.current === 0) {
      amount.textContent = money(promo.threshold);
      caption.textContent = "до подарка · неделя только началась";
    } else {
      amount.textContent = money(left);
      caption.textContent = "до подарка · набрано " + money(conf.current) + " из " + money(promo.threshold);
    }

    $("[data-reward-fill]", root).style.width = pct + "%";

    // Узлы-этапы
    $("[data-reward-nodes]", root).innerHTML = promo.milestones.map(function (m) {
      var at = (m.value / promo.threshold) * 100;
      var reached = conf.current >= m.value;
      return '<span class="milestones__node' + (reached ? " is-reached" : "") + '" style="left:' + at + '%">' +
        icon("gift", 16, 1.9) + "</span>";
    }).join("");

    $("[data-reward-labels]", root).innerHTML = promo.milestones.map(function (m) {
      var at = (m.value / promo.threshold) * 100;
      var reached = conf.current >= m.value;
      var shift = at >= 99 ? "translate:-100% 0" : at <= 1 ? "translate:0 0" : "";
      return '<span class="milestones__label' + (reached ? " is-reached" : "") + '" style="left:' + at + "%;" + shift + '">' +
        "<b>" + esc(m.label) + "</b><span>" + esc(m.caption) + "</span></span>";
    }).join("");

    $$("[data-promo-state]").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-promo-state") === key);
    });
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-promo-state]");
    if (btn) setPromoState(btn.getAttribute("data-promo-state"));

    if (e.target.closest('[data-toggle="reward-terms"]')) {
      var wrap = $("#reward-terms");
      var open = wrap.classList.toggle("is-open");
      $('[data-toggle="reward-terms"]').setAttribute("aria-expanded", open ? "true" : "false");
    }
  });

  /* ------------------------------------------------------------------------
     11. КАТАЛОГ
     ---------------------------------------------------------------------- */

  function filteredProducts() {
    var f = state.filters;
    var q = f.query.trim().toLowerCase();

    var list = D.PRODUCTS.filter(function (p) {
      if (f.categories.length && f.categories.indexOf(p.category) === -1) return false;
      if (f.subcategories.length && f.subcategories.indexOf(p.subcategory) === -1) return false;
      if (f.min != null && p.price < f.min) return false;
      if (f.max != null && p.price > f.max) return false;
      if (f.inStock && !p.stock) return false;
      if (f.halal && !p.isHalal) return false;
      if (q) {
        var hay = (p.name + " " + p.subcategory + " " + p.category + " " + p.composition).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (f.sort === "price_asc") list.sort(function (a, b) { return a.price - b.price; });
    else if (f.sort === "price_desc") list.sort(function (a, b) { return b.price - a.price; });
    else if (f.sort === "popular") {
      list.sort(function (a, b) { return (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0); });
    }
    return list;
  }

  function renderCatalogFilters() {
    // Категории — во всех панелях фильтров (desktop + mobile)
    $$("[data-filter-categories]").forEach(function (root) {
      root.innerHTML = D.CATEGORIES.map(function (c) {
        var checked = state.filters.categories.indexOf(c.name) > -1;
        return '<label class="check"><input type="checkbox" data-cat="' + esc(c.name) + '"' + (checked ? " checked" : "") + ">" +
          "<span>" + esc(c.name) + ' <span class="text-muted">· ' + c.count + "</span></span></label>";
      }).join("");
    });

    var subs = [];
    D.CATEGORIES.forEach(function (c) {
      if (!state.filters.categories.length || state.filters.categories.indexOf(c.name) > -1) {
        c.subcategories.forEach(function (s) { if (subs.indexOf(s) === -1) subs.push(s); });
      }
    });
    $$("[data-filter-subcategories]").forEach(function (root) {
      root.innerHTML = subs.map(function (s) {
        var active = state.filters.subcategories.indexOf(s) > -1;
        return '<button class="chip' + (active ? " is-active" : "") + '" type="button" data-sub="' + esc(s) + '">' + esc(s) + "</button>";
      }).join("");
    });

    $$("[data-filter-instock]").forEach(function (el) { el.checked = state.filters.inStock; });
    $$("[data-filter-halal]").forEach(function (el) { el.checked = state.filters.halal; });
    $$("[data-filter-min]").forEach(function (el) { el.value = state.filters.min == null ? "" : state.filters.min; });
    $$("[data-filter-max]").forEach(function (el) { el.value = state.filters.max == null ? "" : state.filters.max; });
  }

  function renderCatalogCats() {
    var root = $("[data-catalog-cats]");
    if (!root) return;
    var active = state.filters.categories.length === 1 ? state.filters.categories[0] : null;
    var html = '<button class="catrail__item' + (active ? "" : " is-active") + '" type="button" data-catnav="">все<span class="count">' + D.PRODUCTS.length + "</span></button>";
    html += D.CATEGORIES.map(function (c) {
      return '<button class="catrail__item' + (active === c.name ? " is-active" : "") + '" type="button" data-catnav="' + esc(c.name) + '">' +
        esc(c.name.toLowerCase()) + '<span class="count">' + c.count + "</span></button>";
    }).join("");
    root.innerHTML = html;
  }

  function renderActiveFilters() {
    var root = $("[data-active-filters]");
    if (!root) return;
    var f = state.filters;
    var chips = [];
    f.categories.forEach(function (c) {
      chips.push('<button class="chip chip--outline" type="button" data-unfilter-cat="' + esc(c) + '">' + esc(c) + '<span class="chip__remove">' + icon("close", 13, 2.2) + "</span></button>");
    });
    f.subcategories.forEach(function (s) {
      chips.push('<button class="chip chip--outline" type="button" data-unfilter-sub="' + esc(s) + '">' + esc(s) + '<span class="chip__remove">' + icon("close", 13, 2.2) + "</span></button>");
    });
    if (f.min != null || f.max != null) {
      chips.push('<button class="chip chip--outline" type="button" data-unfilter-price>' +
        (f.min != null ? money(f.min) : "0 ₸") + " — " + (f.max != null ? money(f.max) : "∞") +
        '<span class="chip__remove">' + icon("close", 13, 2.2) + "</span></button>");
    }
    if (f.inStock) chips.push('<button class="chip chip--outline" type="button" data-unfilter-instock>Только в наличии<span class="chip__remove">' + icon("close", 13, 2.2) + "</span></button>");
    if (f.halal) chips.push('<button class="chip chip--outline" type="button" data-unfilter-halal>Только халал<span class="chip__remove">' + icon("close", 13, 2.2) + "</span></button>");

    if (chips.length) {
      chips.push('<button class="chip chip--accent" type="button" data-filter-reset>Сбросить всё</button>');
      root.innerHTML = chips.join("");
      root.classList.remove("hidden");
    } else {
      root.innerHTML = "";
      root.classList.add("hidden");
    }

    var count = chips.length ? chips.length - 1 : 0;
    $$("[data-filter-count]").forEach(function (el) {
      el.textContent = count;
      el.classList.toggle("hidden", !count);
    });
  }

  function renderCatalog() {
    var list = filteredProducts();
    var visible = list.slice(0, state.catalogVisible);

    renderList('[data-list="catalog"]', visible, productCard);

    var countEl = $("[data-catalog-count]");
    if (countEl) countEl.textContent = list.length;
    $$("[data-filter-result]").forEach(function (el) { el.textContent = list.length; });

    var more = $("[data-catalog-more]");
    if (more) more.classList.toggle("hidden", visible.length >= list.length);

    var crumb = $("[data-catalog-crumb]");
    if (crumb) crumb.textContent = state.filters.categories.length === 1 ? state.filters.categories[0] : "Каталог";

    renderCatalogCats();
    renderCatalogFilters();
    renderActiveFilters();

    // Автоматически показываем пустое состояние
    if (!list.length && state.catalogState === "normal") setCatalogState("empty");
    else if (list.length && state.catalogState === "empty") setCatalogState("normal");
  }

  function setCatalogState(key) {
    state.catalogState = key;
    $$("[data-catalog-state]").forEach(function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-catalog-state") !== key);
    });
    if (key === "skeleton") {
      var root = $("[data-skeleton-grid]");
      if (root && !root.children.length) {
        var cell = '<div class="product-card"><div class="skeleton skeleton--img" style="aspect-ratio:1/1;border-radius:0"></div>' +
          '<div class="product-card__body"><div class="skeleton skeleton--text w-80"></div>' +
          '<div class="skeleton skeleton--text w-50 mt-2"></div>' +
          '<div class="product-card__foot"><div class="skeleton skeleton--title w-50"></div>' +
          '<div class="skeleton skeleton--circle ml-auto" style="width:36px;height:36px"></div></div></div></div>';
        root.innerHTML = new Array(9).join(cell) + cell;
      }
    }
  }

  function resetFilters() {
    state.filters.categories = [];
    state.filters.subcategories = [];
    state.filters.min = null;
    state.filters.max = null;
    state.filters.inStock = false;
    state.filters.halal = false;
    state.filters.query = "";
    state.filters.sort = "default";
    state.catalogVisible = 12;
    $$("[data-search]").forEach(function (el) { el.value = ""; });
    $$("[data-search-group]").forEach(function (el) { el.classList.remove("has-value"); });
    $$("[data-sort]").forEach(function (el) { el.value = "default"; });
    setCatalogState("normal");
    renderCatalog();
  }

  function demoFilters() {
    state.filters.categories = ["Десерты"];
    state.filters.subcategories = ["Торты"];
    state.filters.min = 5000;
    state.filters.max = 12000;
    state.filters.inStock = true;
    state.catalogVisible = 12;
    setCatalogState("normal");
    renderCatalog();
  }

  /* --- Обработчики каталога --------------------------------------------- */

  document.addEventListener("click", function (e) {
    var catnav = e.target.closest("[data-catnav]");
    if (catnav) {
      var name = catnav.getAttribute("data-catnav");
      state.filters.categories = name ? [name] : [];
      state.filters.subcategories = [];
      state.catalogVisible = 12;
      setCatalogState("normal");
      renderCatalog();
      return;
    }

    var sub = e.target.closest("[data-sub]");
    if (sub) {
      var s = sub.getAttribute("data-sub");
      var i = state.filters.subcategories.indexOf(s);
      if (i > -1) state.filters.subcategories.splice(i, 1);
      else state.filters.subcategories.push(s);
      state.catalogVisible = 12;
      setCatalogState("normal");
      renderCatalog();
      return;
    }

    if (e.target.closest("[data-filter-reset]")) { resetFilters(); return; }
    if (e.target.closest("[data-load-more]")) {
      state.catalogVisible += 12;
      renderCatalog();
      return;
    }
    if (e.target.closest("[data-catalog-retry]")) {
      setCatalogState("skeleton");
      setTimeout(function () { setCatalogState("normal"); renderCatalog(); }, 900);
      return;
    }

    var uc = e.target.closest("[data-unfilter-cat]");
    if (uc) {
      state.filters.categories = state.filters.categories.filter(function (x) { return x !== uc.getAttribute("data-unfilter-cat"); });
      setCatalogState("normal"); renderCatalog(); return;
    }
    var us = e.target.closest("[data-unfilter-sub]");
    if (us) {
      state.filters.subcategories = state.filters.subcategories.filter(function (x) { return x !== us.getAttribute("data-unfilter-sub"); });
      setCatalogState("normal"); renderCatalog(); return;
    }
    if (e.target.closest("[data-unfilter-price]")) { state.filters.min = null; state.filters.max = null; setCatalogState("normal"); renderCatalog(); return; }
    if (e.target.closest("[data-unfilter-instock]")) { state.filters.inStock = false; setCatalogState("normal"); renderCatalog(); return; }
    if (e.target.closest("[data-unfilter-halal]")) { state.filters.halal = false; setCatalogState("normal"); renderCatalog(); return; }
    if (e.target.closest("[data-search-clear]")) {
      state.filters.query = "";
      $$("[data-search]").forEach(function (el) { el.value = ""; });
      $$("[data-search-group]").forEach(function (el) { el.classList.remove("has-value"); });
      setCatalogState("normal"); renderCatalog(); return;
    }
  });

  document.addEventListener("change", function (e) {
    var cat = e.target.closest("[data-cat]");
    if (cat) {
      var name = cat.getAttribute("data-cat");
      var idx = state.filters.categories.indexOf(name);
      if (cat.checked && idx === -1) state.filters.categories.push(name);
      if (!cat.checked && idx > -1) state.filters.categories.splice(idx, 1);
      state.filters.subcategories = [];
      state.catalogVisible = 12;
      setCatalogState("normal");
      renderCatalog();
      return;
    }
    if (e.target.closest("[data-filter-instock]")) {
      state.filters.inStock = e.target.checked;
      setCatalogState("normal"); renderCatalog(); return;
    }
    if (e.target.closest("[data-filter-halal]")) {
      state.filters.halal = e.target.checked;
      setCatalogState("normal"); renderCatalog(); return;
    }
    if (e.target.closest("[data-sort]")) {
      state.filters.sort = e.target.value;
      renderCatalog(); return;
    }
  });

  document.addEventListener("input", function (e) {
    if (e.target.closest("[data-search]")) {
      state.filters.query = e.target.value;
      state.catalogVisible = 12;
      var group = e.target.closest("[data-search-group]");
      if (group) group.classList.toggle("has-value", !!e.target.value);
      setCatalogState("normal");
      renderCatalog();
      return;
    }
    if (e.target.closest("[data-filter-min]")) {
      state.filters.min = e.target.value === "" ? null : Number(e.target.value);
      setCatalogState("normal"); renderCatalog(); return;
    }
    if (e.target.closest("[data-filter-max]")) {
      state.filters.max = e.target.value === "" ? null : Number(e.target.value);
      setCatalogState("normal"); renderCatalog(); return;
    }
  });

  /* ==========================================================================
     Часть 3 из 3: корзина, карточка товара, оформление, кабинет, инициализация.
     ========================================================================== */

  /* ------------------------------------------------------------------------
     12. КОРЗИНА
     ---------------------------------------------------------------------- */

  function cartQty(id) {
    var line = state.cart.filter(function (x) { return x.id === id; })[0];
    return line ? line.qty : 0;
  }

  function cartTotals() {
    var sum = 0, units = 0;
    state.cart.forEach(function (line) {
      var p = product(line.id);
      if (!p) return;
      sum += p.price * line.qty;
      units += line.qty;
    });
    return { sum: sum, units: units, positions: state.cart.length };
  }

  function addToCart(id, qty) {
    var p = product(id);
    if (!p || !p.stock) return;
    var line = state.cart.filter(function (x) { return x.id === id; })[0];
    var next = (line ? line.qty : 0) + (qty || 1);
    if (next > p.stock) {
      next = p.stock;
      toast("Доступно только " + p.stock + " " + plural(p.stock, ["упаковка", "упаковки", "упаковок"]) + " — больше пока нет на остатке", "info");
    }
    if (line) line.qty = next;
    else state.cart.push({ id: id, qty: next });
    updateCartUI();
    flashAdded(id);
  }

  function setQty(id, delta) {
    var line = state.cart.filter(function (x) { return x.id === id; })[0];
    if (!line) { if (delta > 0) addToCart(id, 1); return; }
    var p = product(id);
    var next = line.qty + delta;
    if (next <= 0) { askRemove(id); return; }
    if (p && next > p.stock) {
      toast("На остатке только " + p.stock + " шт", "info");
      return;
    }
    line.qty = next;
    updateCartUI();
  }

  function removeFromCart(id) {
    var card = $('[data-cart-line="' + id + '"]');
    state.cart = state.cart.filter(function (x) { return x.id !== id; });
    if (card) card.classList.add("is-removing");
    setTimeout(function () { updateCartUI(); }, card ? 220 : 0);
  }

  var pendingRemoveId = null;

  function askRemove(id) {
    var p = product(id);
    pendingRemoveId = id;
    var text = $("[data-confirm-text]");
    if (text && p) text.innerHTML = "«" + esc(p.name) + "» будет удалён из заявки. Действие можно отменить, добавив товар заново.";
    openOverlay("confirm-remove");
  }

  function flashAdded(id) {
    $$('[data-card="' + id + '"]').forEach(function (card) {
      card.classList.add("is-added");
      setTimeout(function () { card.classList.remove("is-added"); }, 1400);
    });
  }

  /** Демонстрационные наборы корзины для просмотра состояний. */
  function setCartPreset(kind) {
    state.cartWarnId = null;
    if (kind === "empty") state.cart = [];
    else if (kind === "below") state.cart = [{ id: "medovik", qty: 8 }, { id: "kukis", qty: 6 }];
    else if (kind === "above") {
      state.cart = [
        { id: "tort-medovik", qty: 3 },
        { id: "ispanskiy-chizkeyk", qty: 12 },
        { id: "sinnabon", qty: 18 },
        { id: "pelmeni-s-govyadinoy", qty: 6 },
      ];
    } else if (kind === "warn") {
      state.cart = [
        { id: "tort-medovik", qty: 3 },
        { id: "banka-keyk-oreo", qty: 1 },
        { id: "shu-abrikosovyy", qty: 2 },
        { id: "sinnabon", qty: 14 },
      ];
      state.cartWarnId = "banka-keyk-oreo";
    }
    setCartState("normal");
    updateCartUI();
  }

  function setCartState(key) {
    $$("[data-cart-state]").forEach(function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-cart-state") !== key);
    });
    $$("[data-cartsheet-state]").forEach(function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-cartsheet-state") !== key);
    });
    var foot = $("[data-cartsheet-foot]");
    if (foot) foot.classList.toggle("hidden", key !== "normal");
  }

  function cartLine(line) {
    var p = product(line.id);
    if (!p) return "";
    var warn = state.cartWarnId === p.id;
    return '<article class="cart-line" data-cart-line="' + p.id + '">' +
      '<div class="cart-line__img">' + media(p, true) + "</div>" +
      '<div class="cart-line__body">' +
        '<h4 class="cart-line__name">' + esc(p.name) + "</h4>" +
        '<p class="cart-line__meta">' + esc(p.weightLabel) + " · " + money(p.price) + " за упаковку</p>" +
        '<div class="cart-line__foot">' +
          '<span class="stepper stepper--sm">' +
            '<button class="stepper__btn" type="button" data-qty="-1" data-id="' + p.id + '" aria-label="Уменьшить">' + icon("minus", 14, 2.2) + "</button>" +
            '<span class="stepper__value">' + line.qty + "</span>" +
            '<button class="stepper__btn" type="button" data-qty="1" data-id="' + p.id + '" aria-label="Увеличить"' + (line.qty >= p.stock ? " disabled" : "") + ">" + icon("plus", 14, 2.2) + "</button>" +
          "</span>" +
          '<span class="cart-line__sum">' + money(p.price * line.qty) + "</span>" +
        "</div>" +
      "</div>" +
      '<button class="icon-btn icon-btn--sm icon-btn--bare cart-line__remove" type="button" data-remove="' + p.id + '" aria-label="Удалить ' + esc(p.name) + '">' + icon("trash", 16, 1.8) + "</button>" +
      (warn ? '<p class="cart-line__warn">' + icon("alert-circle", 15, 1.9) + "На остатке всего " + p.stock + " шт — менеджер подтвердит количество</p>" : "") +
    "</article>";
  }

  function renderCart() {
    var totals = cartTotals();
    $$("[data-cart-lines]").forEach(function (root) {
      root.innerHTML = state.cart.map(cartLine).join("");
    });

    var reached = totals.sum >= D.CONFIG.minOrderAmount;
    var left = Math.max(0, D.CONFIG.minOrderAmount - totals.sum);
    var pct = Math.min(100, (totals.sum / D.CONFIG.minOrderAmount) * 100);

    $$("[data-minbar]").forEach(function (bar) {
      bar.classList.toggle("is-reached", reached);
      var label = $("[data-minbar-label]", bar);
      var value = $("[data-minbar-value]", bar);
      var fill = $("[data-minbar-bar]", bar);
      if (label) label.textContent = reached
        ? "Минимум достигнут — оформление доступно"
        : "Осталось набрать " + money(left) + " до минимального заказа";
      if (value) value.textContent = num(totals.sum) + " / " + num(D.CONFIG.minOrderAmount) + " ₸";
      if (fill) fill.style.width = pct + "%";
    });

    $$("[data-cart-positions]").forEach(function (el) { el.textContent = totals.positions; });
    $$("[data-cart-units]").forEach(function (el) { el.textContent = totals.units; });
    $$("[data-cart-total]").forEach(function (el) { el.textContent = money(totals.sum); });
    $$("[data-cart-delivery]").forEach(function (el) { el.textContent = reached ? "0 ₸" : "1 500–3 000 ₸"; });
    $$("[data-cart-badge]").forEach(function (el) {
      el.textContent = totals.positions + " " + plural(totals.positions, ["позиция", "позиции", "позиций"]);
    });

    $$("[data-cart-minwarn]").forEach(function (el) { el.classList.toggle("hidden", reached || !totals.positions); });
    $$("[data-cart-minok]").forEach(function (el) { el.classList.toggle("hidden", !reached); });
    $$("[data-cart-checkout]").forEach(function (el) { el.classList.toggle("is-disabled", !reached); });

    if (!state.cart.length) setCartState("empty");
    else setCartState("normal");
  }

  function updateCartUI() {
    var totals = cartTotals();

    $$("[data-cart-count]").forEach(function (el) {
      el.textContent = totals.units > 99 ? "99+" : totals.units;
      el.classList.toggle("hidden", !totals.units);
    });

    var bar = $("[data-cartbar]");
    if (bar) {
      var showBar = totals.units > 0 && ["catalog", "home", "product"].indexOf(state.route) > -1;
      bar.classList.toggle("is-visible", showBar);
      $("[data-cartbar-total]").textContent = money(totals.sum);
      $("[data-cartbar-sub]").textContent = totals.positions + " " +
        plural(totals.positions, ["позиция", "позиции", "позиций"]) + " · " + totals.units + " шт";
    }

    renderCart();
    renderCheckoutSummary();

    // Обновляем контролы количества в карточках без полного перерендера
    if (state.route === "catalog") renderCatalog();
    if (state.route === "home") renderHome();
    if (state.route === "product") renderProductPage();
    if (state.psheetId) renderProductSheetBuy();
  }

  document.addEventListener("click", function (e) {
    var add = e.target.closest("[data-add]");
    if (add) { addToCart(add.getAttribute("data-add"), 1); return; }

    var qtyBtn = e.target.closest("[data-qty]");
    if (qtyBtn) { setQty(qtyBtn.getAttribute("data-id"), Number(qtyBtn.getAttribute("data-qty"))); return; }

    var rm = e.target.closest("[data-remove]");
    if (rm) { askRemove(rm.getAttribute("data-remove")); return; }

    if (e.target.closest("[data-confirm-remove]")) {
      if (pendingRemoveId) removeFromCart(pendingRemoveId);
      pendingRemoveId = null;
      closeOverlay("confirm-remove");
      toast("Позиция удалена из заявки", "success");
      return;
    }

    if (e.target.closest("[data-cart-clear]")) {
      state.cart = [];
      updateCartUI();
      toast("Корзина очищена", "info");
      return;
    }

    if (e.target.closest("[data-cart-retry]")) {
      setCartState("loading");
      setTimeout(function () { renderCart(); }, 900);
      return;
    }

    var repeat = e.target.closest("[data-repeat-order]");
    if (repeat) {
      var order = D.ORDERS.filter(function (o) { return o.number === repeat.getAttribute("data-repeat-order"); })[0];
      if (order) {
        state.cart = order.items.map(function (it) {
          var p = product(it.slug);
          return { id: it.slug, qty: Math.min(it.qty, p ? p.stock : it.qty) };
        }).filter(function (l) { return l.qty > 0; });
        updateCartUI();
        toast("Заказ " + order.number + " перенесён в корзину", "success");
        openOverlay("cart");
      }
      return;
    }
  });

  /* ------------------------------------------------------------------------
     13. КАРТОЧКА ТОВАРА — оверлей (модальное окно / полноэкранная)
     ---------------------------------------------------------------------- */

  function specRows(p) {
    var rows = [
      ["Фасовка", p.weightLabel],
      ["Упаковка", p.packageType],
      ["Хранение", p.storage],
      ["Срок годности", p.shelfLife],
      ["Категория", p.category + " · " + p.subcategory],
    ];
    if (p.isHalal) rows.push(["Стандарт", "Халал"]);
    return '<dl class="spec">' + rows.map(function (r) {
      return '<div class="spec__row"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
    }).join("") + "</dl>";
  }

  function productInfoHtml(p) {
    var st = stockState(p);
    return '<h2 class="psheet__name">' + esc(p.name) + "</h2>" +
      '<div class="psheet__chips">' +
        '<span class="chip">' + esc(p.weightLabel) + "</span>" +
        '<span class="chip">' + esc(p.packageType) + "</span>" +
        (p.isHalal ? '<span class="chip chip--accent">Халал</span>' : "") +
        '<span class="chip"><span class="stock stock--' + st + '">' + esc(stockLabel(p)) + "</span></span>" +
      "</div>" +
      '<div class="psheet__price"><b>' + money(p.price) + "</b><span>за " + esc(p.weightLabel) + "</span></div>" +
      '<p class="text-sm text-muted mt-4" style="line-height:1.65">' + esc(p.description) + "</p>" +
      '<div class="accordion mt-6">' +
        '<div class="accordion__item is-open"><button class="accordion__btn" type="button" data-accordion>Состав' + icon("chev-down", 18, 2) + "</button>" +
          '<div class="accordion__body">' + esc(p.composition) +
          (p.compositionKz ? '<p class="text-xs text-muted mt-3"><b>Құрамы:</b> ' + esc(p.compositionKz) + "</p>" : "") + "</div></div>" +
        '<div class="accordion__item is-open"><button class="accordion__btn" type="button" data-accordion>Фасовка, хранение и срок годности' + icon("chev-down", 18, 2) + "</button>" +
          '<div class="accordion__body">' + specRows(p) + "</div></div>" +
        '<div class="accordion__item"><button class="accordion__btn" type="button" data-accordion>Доставка' + icon("chev-down", 18, 2) + "</button>" +
          '<div class="accordion__body">Доставка вт · чт · сб. Приём заявок до 18:00 накануне дня доставки. От 15 000 ₸ доставка бесплатная.</div></div>' +
      "</div>";
  }

  function renderProductSheetBuy() {
    var p = product(state.psheetId);
    var root = $("[data-psheet-buy]");
    if (!p || !root) return;
    var qty = cartQty(p.id);

    if (!p.stock) {
      root.innerHTML = '<span class="psheet__total"><b>' + money(p.price) + "</b>нет на остатке</span>" +
        '<button class="btn btn--lg btn--secondary" type="button" disabled>Нет в наличии</button>';
      return;
    }

    root.innerHTML =
      '<span class="stepper stepper--lg">' +
        '<button class="stepper__btn" type="button" data-qty="-1" data-id="' + p.id + '" aria-label="Уменьшить">' + icon("minus", 16, 2.2) + "</button>" +
        '<span class="stepper__value">' + (qty || 1) + "</span>" +
        '<button class="stepper__btn" type="button" data-qty="1" data-id="' + p.id + '" aria-label="Увеличить"' + (qty >= p.stock ? " disabled" : "") + ">" + icon("plus", 16, 2.2) + "</button>" +
      "</span>" +
      (qty
        ? '<a class="btn btn--lg btn--primary" href="#/cart" data-close="psheet">В корзине · ' + money(p.price * qty) + "</a>"
        : '<button class="btn btn--lg btn--primary" type="button" data-add="' + p.id + '">' + icon("plus", 18, 2.2) + " " + money(p.price) + "</button>");
  }

  function renderProductSheet(id) {
    var p = product(id);
    if (!p) return;
    state.psheetId = id;

    var mediaRoot = $("[data-psheet-media]");
    var old = $("[data-psheet-photo]", mediaRoot);
    if (old) old.remove();
    var holder = document.createElement("div");
    holder.setAttribute("data-psheet-photo", "");
    holder.style.cssText = "position:absolute;inset:0;z-index:1";
    holder.innerHTML = p.image
      ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" width="800" height="800">'
      : photoFallback(p);
    mediaRoot.insertBefore(holder, mediaRoot.firstChild);

    // Информационные chips поверх фотографии (как в референсе)
    $("[data-psheet-nutri]").innerHTML = [
      { v: p.weightGrams + " г", l: "фасовка" },
      { v: p.shelfLife, l: "срок годности" },
      { v: p.packageType, l: "упаковка" },
    ].map(function (n) {
      return '<span class="psheet__nutriitem"><b>' + esc(n.v) + "</b><span>" + esc(n.l) + "</span></span>";
    }).join("");

    $("[data-psheet-body]").innerHTML = productInfoHtml(p);
    renderProductSheetBuy();
    setPsheetState("normal");
  }

  function setPsheetState(key) {
    $$("[data-psheet-state]").forEach(function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-psheet-state") !== key);
    });
    var buy = $("[data-psheet-buy]");
    if (buy) buy.classList.toggle("hidden", key !== "normal");
  }

  function openProductSheet(id) {
    renderProductSheet(id);
    openOverlay("psheet");
  }

  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-product-open]");
    if (open && !e.target.closest("[data-add]") && !e.target.closest("[data-qty]")) {
      openProductSheet(open.getAttribute("data-product-open"));
      return;
    }
    var acc = e.target.closest("[data-accordion]");
    if (acc) acc.parentNode.classList.toggle("is-open");

    if (e.target.closest("[data-psheet-retry]")) {
      setPsheetState("loading");
      setTimeout(function () { setPsheetState("normal"); }, 900);
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var open = e.target.closest && e.target.closest("[data-product-open]");
    if (open) {
      e.preventDefault();
      openProductSheet(open.getAttribute("data-product-open"));
    }
  });

  /* ------------------------------------------------------------------------
     14. СТРАНИЦА ТОВАРА
     ---------------------------------------------------------------------- */

  function renderProductPage() {
    var p = product(state.productId);
    var root = $("[data-product-page]");
    if (!p || !root) return;

    var crumb = $("[data-product-crumb]");
    if (crumb) crumb.textContent = p.name;

    var qty = cartQty(p.id);
    root.innerHTML =
      '<div class="surface" style="border-radius:var(--r-2xl);overflow:hidden;background:linear-gradient(165deg,var(--cream-deep),var(--cream-warm))">' +
        '<div style="position:relative;aspect-ratio:1/1">' +
          (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" style="width:100%;height:100%;object-fit:cover" width="800" height="800">' : photoFallback(p)) +
        "</div>" +
      "</div>" +
      '<div class="surface pad-6 pad-md-8" style="border-radius:var(--r-2xl)">' +
        productInfoHtml(p) +
        '<div class="row row--wrap mt-6" style="gap:var(--s-3)">' +
          (p.stock
            ? '<span class="stepper stepper--lg">' +
                '<button class="stepper__btn" type="button" data-qty="-1" data-id="' + p.id + '">' + icon("minus", 16, 2.2) + "</button>" +
                '<span class="stepper__value">' + (qty || 1) + "</span>" +
                '<button class="stepper__btn" type="button" data-qty="1" data-id="' + p.id + '"' + (qty >= p.stock ? " disabled" : "") + ">" + icon("plus", 16, 2.2) + "</button>" +
              "</span>" +
              (qty
                ? '<a class="btn btn--lg btn--primary" href="#/cart">В корзине · ' + money(p.price * qty) + "</a>"
                : '<button class="btn btn--lg btn--primary" type="button" data-add="' + p.id + '">Добавить · ' + money(p.price) + "</button>")
            : '<button class="btn btn--lg btn--secondary" type="button" disabled>Нет в наличии</button>') +
          '<button class="btn btn--lg btn--secondary" type="button" data-product-open="' + p.id + '">Открыть карточкой</button>' +
        "</div>" +
      "</div>";

    var related = D.PRODUCTS.filter(function (x) {
      return x.category === p.category && x.id !== p.id;
    }).slice(0, 4);
    renderList('[data-list="product-related"]', related, productCard);
  }

  function openProductPage(id) {
    state.productId = id;
    if (state.route !== "product") location.hash = "#/product?id=" + id;
    else { renderProductPage(); setProductState("normal"); }
  }

  function setProductState(key) {
    $$("[data-product-state]").forEach(function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-product-state") !== key);
    });
  }

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-product-retry]")) {
      setProductState("loading");
      setTimeout(function () { setProductState("normal"); }, 900);
    }
  });

  /* ------------------------------------------------------------------------
     15. ОФОРМЛЕНИЕ ЗАЯВКИ
     ---------------------------------------------------------------------- */

  var WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  var MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

  function buildDatepick() {
    var root = $("[data-datepick]");
    if (!root) return;
    var today = new Date();
    var html = "";
    for (var i = 1; i <= 14; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      var wd = d.getDay();
      var available = D.CONFIG.deliveryDays.indexOf(wd) > -1;
      var value = d.toISOString().slice(0, 10);
      html += '<button class="datepick__day" type="button" data-date="' + value + '"' +
        (available ? "" : ' disabled title="Доставка по вторникам, четвергам и субботам"') + ">" +
        "<em>" + WEEKDAYS[wd] + "</em><b>" + d.getDate() + " " + MONTHS[d.getMonth()] + "</b></button>";
    }
    root.innerHTML = html;
  }

  function renderCheckoutSummary() {
    var root = $("[data-checkout-items]");
    if (!root) return;
    var totals = cartTotals();
    root.innerHTML = state.cart.map(function (line) {
      var p = product(line.id);
      if (!p) return "";
      return '<div class="order-summary__item">' +
        (p.image
          ? '<img src="' + esc(p.image) + '" alt="" loading="lazy" width="42" height="42">'
          : '<span style="width:42px;height:42px;border-radius:var(--r-sm);background:var(--cream-warm);flex-shrink:0"></span>') +
        "<span>" + esc(p.name) + '<span class="qty" style="display:block">' + line.qty + " × " + money(p.price) + "</span></span>" +
        '<span class="sum">' + money(p.price * line.qty) + "</span>" +
      "</div>";
    }).join("") || '<p class="text-sm text-muted">Корзина пуста</p>';

    var pos = $("[data-checkout-positions]");
    if (pos) pos.textContent = totals.positions;
    var tot = $("[data-checkout-total]");
    if (tot) tot.textContent = money(totals.sum);
  }

  function setCheckoutState(key) {
    $$("[data-checkout-state]").forEach(function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-checkout-state") !== key);
    });
  }

  function field(name) { return $('[data-field="' + name + '"]'); }

  function markField(name, invalid) {
    var f = field(name);
    if (f) f.classList.toggle("has-error", !!invalid);
  }

  function validateCheckout(showAll) {
    var form = $("[data-checkout-form]");
    if (!form) return true;
    var get = function (n) { var el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ""; };
    var errors = 0;

    var company = get("company_name");
    if (!company) { markField("company_name", true); errors++; } else markField("company_name", false);

    var name = get("customer_name");
    if (!name) { markField("customer_name", true); errors++; } else markField("customer_name", false);

    var phone = get("customer_phone").replace(/\D/g, "");
    if (phone.length < 11) { markField("customer_phone", true); errors++; } else markField("customer_phone", false);

    var bin = get("customer_bin").replace(/\D/g, "");
    if (bin && bin.length !== 12) { markField("customer_bin", true); errors++; } else markField("customer_bin", false);

    var email = get("customer_email");
    if (email && email.indexOf("@") === -1) { markField("customer_email", true); errors++; } else markField("customer_email", false);

    var date = form.querySelector(".datepick__day.is-selected");
    if (!date) { markField("delivery_date", true); errors++; } else markField("delivery_date", false);

    var oferta = form.querySelector('[name="oferta"]');
    if (!oferta.checked) { markField("oferta", true); errors++; } else markField("oferta", false);

    if (showAll && errors) toast("Проверьте обязательные поля", "error");
    return errors === 0;
  }

  function fillCheckout() {
    var form = $("[data-checkout-form]");
    if (!form) return;
    var v = {
      company_name: D.PROFILE.company,
      customer_bin: D.PROFILE.bin,
      customer_name: D.PROFILE.contactName,
      customer_phone: D.PROFILE.phone,
      customer_email: D.PROFILE.email,
      delivery_address: D.PROFILE.addresses[0].value,
      comment: "Выгрузить у служебного входа, позвонить за 15 минут.",
    };
    Object.keys(v).forEach(function (k) {
      var el = form.querySelector('[name="' + k + '"]');
      if (el) el.value = v[k];
      markField(k, false);
    });
    form.querySelector('[name="oferta"]').checked = true;
    markField("oferta", false);
    var firstFree = form.querySelector(".datepick__day:not(:disabled)");
    if (firstFree) {
      $$(".datepick__day").forEach(function (b) { b.classList.remove("is-selected"); });
      firstFree.classList.add("is-selected");
      markField("delivery_date", false);
    }
  }

  function clearCheckout() {
    var form = $("[data-checkout-form]");
    if (!form) return;
    form.reset();
    $$(".datepick__day").forEach(function (b) { b.classList.remove("is-selected"); });
    $$("[data-field]").forEach(function (f) { f.classList.remove("has-error"); });
  }

  document.addEventListener("click", function (e) {
    var day = e.target.closest(".datepick__day");
    if (day && !day.disabled) {
      $$(".datepick__day").forEach(function (b) { b.classList.remove("is-selected"); });
      day.classList.add("is-selected");
      markField("delivery_date", false);
      return;
    }
    if (e.target.closest("[data-checkout-fill]")) { fillCheckout(); toast("Форма заполнена демо-данными", "info"); return; }
    if (e.target.closest("[data-checkout-back]")) { setCheckoutState("form"); return; }
  });

  document.addEventListener("submit", function (e) {
    var form = e.target.closest("[data-checkout-form]");
    if (form) {
      e.preventDefault();
      if (!validateCheckout(true)) return;
      var btn = $("[data-checkout-submit]");
      btn.classList.add("is-loading");
      setTimeout(function () {
        btn.classList.remove("is-loading");
        setCheckoutState("loading");
        setTimeout(function () {
          setCheckoutState("success");
          toast("Заявка создана — заглушка прототипа, данные никуда не отправлены", "success");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 1100);
      }, 500);
      return;
    }

    var login = e.target.closest("[data-login-form]");
    if (login) {
      e.preventDefault();
      setPanelState("login", "loading");
      setTimeout(function () {
        location.hash = "#/profile";
        setPanelState("login", "form");
        toast("Открыт демонстрационный профиль Coffee Point", "success");
      }, 900);
      return;
    }

    var reg = e.target.closest("[data-register-form]");
    if (reg) { e.preventDefault(); setPanelState("register", "otp"); return; }

    var manager = e.target.closest("[data-manager-form]");
    if (manager) { e.preventDefault(); toast("Административная часть не входит в прототип витрины", "info"); return; }

    var forgot = e.target.closest("[data-forgot-form]");
    if (forgot) { e.preventDefault(); setPanelState("forgot", "sent"); return; }
  });

  /* --- Панельные состояния экранов авторизации --------------------------- */

  function setPanelState(prefix, key) {
    $$("[data-" + prefix + "-state]").forEach(function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-" + prefix + "-state") !== key);
    });
  }

  document.addEventListener("click", function (e) {
    ["login", "register", "forgot"].forEach(function (prefix) {
      var btn = e.target.closest("[data-" + prefix + "-state-btn]");
      if (btn) setPanelState(prefix, btn.getAttribute("data-" + prefix + "-state-btn"));
    });
  });

  /* --- Ввод кода из WhatsApp --------------------------------------------- */

  document.addEventListener("input", function (e) {
    var otp = e.target.closest("[data-otp]");
    if (!otp) return;
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 1);
    if (e.target.value && e.target.nextElementSibling) e.target.nextElementSibling.focus();
  });

  /* ------------------------------------------------------------------------
     16. КАБИНЕТ, ЗАКАЗЫ, РЕКВИЗИТЫ
     ---------------------------------------------------------------------- */

  function orderCard(o) {
    var st = D.ORDER_STATUSES[o.status] || { label: o.status, tone: "neutral" };
    var thumbs = o.items.slice(0, 3).map(function (it) {
      return it.image
        ? '<img src="' + esc(it.image) + '" alt="" loading="lazy" width="42" height="42">'
        : '<span class="ph"></span>';
    }).join("");
    var rest = o.items.length - 3;

    return '<article class="order-card" data-order="' + o.number + '">' +
      '<div class="order-card__top">' +
        '<span class="order-card__num">' + esc(o.number) + "</span>" +
        '<span class="order-card__date">' + esc(o.date) + "</span>" +
        '<span class="badge badge--' + st.tone + ' badge--dot ml-auto">' + esc(st.label) + "</span>" +
      "</div>" +
      '<div class="order-card__mid">' +
        '<div class="order-card__thumbs">' + thumbs + (rest > 0 ? '<span class="order-card__more">+' + rest + "</span>" : "") + "</div>" +
        '<div class="order-card__total"><b>' + money(o.total) + "</b><span>" + o.positions + " " +
          plural(o.positions, ["позиция", "позиции", "позиций"]) + " · " + o.units + " шт</span></div>" +
      "</div>" +
      '<div class="order-card__foot">' +
        '<a class="btn btn--xs btn--ghost" href="#/order-details?id=' + o.number + '">Детали заказа</a>' +
        '<button class="btn btn--xs btn--soft ml-auto" type="button" data-repeat-order="' + o.number + '">' +
          icon("repeat", 14, 2) + "Повторить</button>" +
      "</div>" +
    "</article>";
  }

  function ordersFiltered() {
    var f = state.ordersFilter;
    return D.ORDERS.filter(function (o) {
      if (f === "all") return true;
      if (f === "completed") return o.status === "completed";
      if (f === "canceled") return o.status === "canceled";
      return ["pending_manager_confirmation", "confirmed_waiting_payment", "paid", "delivering"].indexOf(o.status) > -1;
    });
  }

  function renderOrders() {
    renderList('[data-list="orders"]', ordersFiltered(), orderCard);
    renderList('[data-list="orders-short"]', D.ORDERS.slice(0, 3), orderCard);
  }

  function setOrdersState(key) {
    $$("[data-orders-state]").forEach(function (el) {
      el.classList.toggle("hidden", el.getAttribute("data-orders-state") !== key);
    });
  }

  document.addEventListener("click", function (e) {
    var tab = e.target.closest("[data-orders-filter]");
    if (tab) {
      state.ordersFilter = tab.getAttribute("data-orders-filter");
      $$("[data-orders-filter]").forEach(function (b) { b.classList.remove("is-active"); });
      tab.classList.add("is-active");
      var list = ordersFiltered();
      renderOrders();
      setOrdersState(list.length ? "normal" : "empty");
    }
  });

  function openOrder(number) {
    state.orderNumber = number;
    if (state.route !== "order-details") location.hash = "#/order-details?id=" + number;
    else renderOrderDetails();
  }

  function renderOrderDetails() {
    var o = D.ORDERS.filter(function (x) { return x.number === state.orderNumber; })[0] || D.ORDERS[0];
    var st = D.ORDER_STATUSES[o.status] || { label: o.status, tone: "neutral" };
    var pay = D.PAYMENT_STATUSES[o.payment] || { label: o.payment, tone: "neutral" };

    $("[data-order-crumb]").textContent = o.number;
    $("[data-order-number]").textContent = o.number;
    var badge = $("[data-order-status]");
    badge.textContent = st.label;
    badge.className = "badge badge--" + st.tone + " badge--dot";
    $("[data-order-sub]").textContent = "Создан " + o.date + " · " + o.positions + " " +
      plural(o.positions, ["позиция", "позиции", "позиций"]) + " · " + o.units + " шт";
    $("[data-order-positions]").textContent = o.positions;
    $("[data-order-total]").textContent = money(o.total);
    $("[data-order-date]").textContent = o.deliveryDate;

    $("[data-order-items]").innerHTML = o.items.map(function (it) {
      return '<div class="order-summary__item">' +
        (it.image
          ? '<img src="' + esc(it.image) + '" alt="" loading="lazy" width="42" height="42">'
          : '<span style="width:42px;height:42px;border-radius:var(--r-sm);background:var(--cream-warm);flex-shrink:0"></span>') +
        "<span>" + esc(it.name) + '<span class="qty" style="display:block">' + it.qty + " × " + money(it.price) + "</span></span>" +
        '<span class="sum">' + money(it.sum) + "</span></div>";
    }).join("");

    var payBadge = $("#route-order-details .badge--neutral, #route-order-details [data-pay-status]");
    if (payBadge) { payBadge.textContent = pay.label; }
  }

  function renderProfile() {
    renderList("[data-profile-addresses]", D.PROFILE.addresses, function (a) {
      return '<div style="padding:var(--s-4);background:var(--cream);border-radius:var(--r-md)">' +
        '<div class="row"><b class="text-sm">' + esc(a.title) + "</b>" +
        (a.isDefault ? '<span class="badge badge--soft ml-auto">Основной</span>' : "") + "</div>" +
        '<p class="text-sm text-muted mt-2">' + esc(a.value) + "</p></div>";
    });

    var last = D.ORDERS[2];
    renderList('[data-list="repeat-mini"]', last.items.slice(0, 4), function (it) {
      var p = product(it.slug);
      return p ? miniCard(p, it.qty) : "";
    });
  }

  function renderRequisites() {
    renderList('[data-list="requisites"]', D.REQUISITES.accounts, function (a) {
      var rows = [
        ["Наименование", D.REQUISITES.legalNameUpper],
        ["БИН / ИИН", D.REQUISITES.bin],
        ["Банк", a.bank],
        ["БИК", a.bic],
        ["КБе", a.kbe],
        ["IBAN", a.iban],
      ];
      return '<div style="padding:var(--s-5);background:var(--cream);border:1px solid var(--line-accent);border-radius:var(--r-lg)">' +
        '<p style="font-family:var(--font-display);font-weight:700;color:var(--accent)">' + esc(a.title) + "</p>" +
        '<p class="text-xs text-muted mt-1">' + esc(a.note) + "</p>" +
        '<dl class="kv mt-4">' + rows.map(function (r) {
          return '<div class="kv__row"><dt>' + esc(r[0]) + '</dt><dd class="' + (r[0] === "IBAN" || r[0] === "БИН / ИИН" ? "mono" : "") + '" style="max-width:60%">' + esc(r[1]) + "</dd></div>";
        }).join("") + "</dl></div>";
    });
  }

  /* ------------------------------------------------------------------------
     17. ЮРИДИЧЕСКИЕ СТРАНИЦЫ
     ---------------------------------------------------------------------- */

  var LEGAL = {
    oferta: {
      note: "Структура и заголовки соответствуют действующей оферте DC Bakery. В прототипе показан дизайн документа — полный юридический текст берётся из рабочего сайта.",
      sections: [
        ["1. Термины и определения", "Поставщик — ИП Кошкаров Асылбек Касымбекович, БИН/ИИН 810127300096. Покупатель — юридическое лицо или индивидуальный предприниматель, оформивший Заказ."],
        ["2. Предмет договора", "Поставщик обязуется поставлять Продукцию (десерты, полуфабрикаты, мясные позиции), а Покупатель — принимать и оплачивать её на условиях настоящей Оферты."],
        ["3. Порядок заключения договора (акцепт)", "Акцептом признаётся оформление Заказа на Сайте и проставление отметки о согласии с условиями Оферты."],
        ["4. Оформление и подтверждение заказа", "Заказ считается принятым после подтверждения менеджером. Минимальная сумма Заказа — 15 000 тенге. Приём заявок — до 18:00 накануне дня доставки."],
        ["5. Цена и порядок оплаты", "Цены указаны в тенге. Оплата производится на счёт, соответствующий категории Продукции: «Пекарня» — десерты и выпечка, «Цех полуфабрикатов» — полуфабрикаты."],
        ["6. Акции, бонусы и подарочная продукция", "При заказах на сумму от 100 000 тенге за календарную неделю Покупатель получает 5 десертов на выбор. Подарок передаётся со следующим подтверждённым заказом и не обменивается на деньги."],
        ["7. Поставка и переход рисков", "Доставка осуществляется по вторникам, четвергам и субботам. Риск случайной гибели переходит к Покупателю в момент приёмки."],
        ["8. Приёмка продукции", "Претензии по количеству и качеству принимаются только в момент приёмки и фиксируются актом. После подписания накладной претензии не рассматриваются."],
        ["9. Возврат и претензии по качеству", "Продукция скоропортящаяся: товар надлежащего качества возврату не подлежит. При производственном браке Поставщик производит замену, допоставку или возврат стоимости."],
        ["10. Права и обязанности сторон", "Поставщик обеспечивает качество и сроки, Покупатель — своевременную оплату и приёмку в согласованное время."],
        ["11. Ответственность сторон", "Стороны несут ответственность в соответствии с законодательством Республики Казахстан."],
        ["12. Обстоятельства непреодолимой силы (форс-мажор)", "Стороны освобождаются от ответственности при наступлении обстоятельств непреодолимой силы."],
        ["13. Персональные данные и конфиденциальность", "Обработка персональных данных производится в соответствии с Политикой конфиденциальности, размещённой на Сайте."],
        ["14. Срок действия и изменение условий", "Оферта действует бессрочно. Поставщик вправе изменять условия, публикуя новую редакцию на Сайте."],
        ["15. Разрешение споров и применимое право", "Применимое право — право Республики Казахстан. Споры разрешаются путём переговоров, при недостижении согласия — в суде по месту нахождения Поставщика."],
        ["16. Заключительные положения", "Оферта размещена на сайте dc-bakery.kz и доступна для ознакомления в любое время."],
        ["17. Реквизиты Поставщика", "ИП КОШКАРОВ АСЫЛБЕК КАСЫМБЕКОВИЧ, БИН/ИИН 810127300096. Счёт «Пекарня»: АО «Kaspi Bank», БИК CASPKZKA, КБе 19, IBAN KZ61722S000051248791, адрес г. Алматы, ул. Жамбыла 154. Счёт «Цех полуфабрикатов»: IBAN KZ73722S000051742402, адрес г. Алматы, мкр. Мамыр-7, дом 21."],
      ],
    },
    privacy: {
      note: "Структура и заголовки соответствуют действующей Политике конфиденциальности сайта dc-bakery.kz (редакция от 10 июля 2026 года).",
      sections: [
        ["1. Общие положения", "Политика определяет порядок обработки персональных данных Оператором — ИП Кошкаров Асылбек Касымбекович."],
        ["2. Термины", "Персональные данные, обработка, Оператор, субъект — используются в значениях законодательства Республики Казахстан."],
        ["3. Какие данные обрабатываются", "Название компании, БИН/ИИН, контактное лицо, телефон, e-mail, адрес доставки, история заказов."],
        ["4. Цели обработки", "Оформление и подтверждение заказов, выставление счетов и документов, связь по заявке, доставка."],
        ["5. Правовое основание и согласие", "Основание — согласие субъекта и исполнение договора, заключаемого на условиях Публичной оферты."],
        ["6. Файлы cookie", "Сайт использует cookie для работы корзины и сохранения настроек интерфейса."],
        ["7. Передача третьим лицам", "Данные могут передаваться службам доставки, банку-эквайеру и бухгалтерскому учёту в объёме, необходимом для исполнения заказа."],
        ["8. Трансграничная передача и хранение", "Данные хранятся на серверах, обеспечивающих требуемый уровень защиты."],
        ["9. Сроки хранения и меры защиты", "Данные хранятся в течение срока договорных отношений и установленного законом срока хранения документов."],
        ["10. Права субъекта персональных данных", "Субъект вправе получить информацию об обработке, потребовать уточнения, блокирования или уничтожения данных."],
        ["11. Изменение Политики", "Оператор вправе изменять Политику, публикуя новую редакцию на Сайте."],
        ["12. Контакты Оператора", "ИП Кошкаров Асылбек Касымбекович, ИИН/БИН 810127300096. Адрес: г. Алматы, ул. Жамбыла 154. E-mail: info@dc-bakery.kz; сайт: dc-bakery.kz."],
      ],
    },
  };

  function renderLegal() {
    Object.keys(LEGAL).forEach(function (key) {
      var doc = $('[data-legal-doc="' + key + '"]');
      if (!doc) return;
      var data = LEGAL[key];
      doc.innerHTML =
        '<div class="stub">' + icon("info", 18) + "<span>" + esc(data.note) + "</span></div>" +
        data.sections.map(function (s, i) {
          return '<h2 id="' + key + "-" + (i + 1) + '">' + esc(s[0]) + "</h2><p>" + esc(s[1]) + "</p>";
        }).join("");

      var toc = doc.parentNode.querySelector("[data-legal-toc]");
      if (toc) {
        toc.innerHTML = data.sections.map(function (s, i) {
          return '<a class="legal__toclink" href="#/' + key + "#" + key + "-" + (i + 1) + '">' + esc(s[0]) + "</a>";
        }).join("");
      }
    });
  }

  /* ------------------------------------------------------------------------
     18. ВХОД В МАРШРУТ
     ---------------------------------------------------------------------- */

  function onRouteEnter(parsed) {
    var p = parsed.params;

    if (parsed.route === "catalog") {
      if (p.category) {
        var cat = D.CATEGORIES.filter(function (c) { return c.slug === p.category; })[0];
        state.filters.categories = cat ? [cat.name] : [];
        state.filters.subcategories = [];
      }
      if (p.collection && D.COLLECTION_ITEMS[p.collection]) {
        state.filters.categories = [];
        state.filters.query = "";
      }
      state.catalogVisible = 12;
      setCatalogState("normal");
      renderCatalog();
    }

    if (parsed.route === "product") {
      if (p.id && product(p.id)) state.productId = p.id;
      renderProductPage();
      setProductState("normal");
    }

    if (parsed.route === "cart") renderCart();
    if (parsed.route === "checkout") { renderCheckoutSummary(); setCheckoutState("form"); }
    if (parsed.route === "orders") { renderOrders(); setOrdersState(ordersFiltered().length ? "normal" : "empty"); }
    if (parsed.route === "order-details") {
      if (p.id) state.orderNumber = p.id;
      renderOrderDetails();
    }
    if (parsed.route === "profile") { renderProfile(); renderOrders(); }
    if (parsed.route === "home") renderHome();
  }

  /* ------------------------------------------------------------------------
     19. ИНИЦИАЛИЗАЦИЯ
     ---------------------------------------------------------------------- */

  function init() {
    buildInspectorRoutes();
    buildDatepick();
    renderLegal();
    renderRequisites();
    renderProfile();
    renderOrders();
    renderHome();

    // Стартовая корзина — чтобы сразу были видны индикатор и прогресс
    setCartPreset("below");

    if (!location.hash) location.hash = "#/home";
    navigate();

    console.info(
      "%cDC Bakery — прототип редизайна",
      "font-weight:700;color:#c2531f",
      "\nBackend не подключён. Все действия локальные и демонстрационные.",
      "\nОткрыть инспектор состояний — кнопка «Состояния» у правого края."
    );
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
