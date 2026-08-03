// Подключение GA4 + Яндекс.Метрики через next/script. Скрипты грузятся только если
// заданы ID в env (NEXT_PUBLIC_GA_ID / NEXT_PUBLIC_YANDEX_METRICA_ID) — без них ничего
// не рендерится, поведение сайта не меняется. Пейджвью считаются автоматически.

import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const YANDEX_ID = process.env.NEXT_PUBLIC_YANDEX_METRICA_ID;

export function Analytics() {
  return (
    <>
      {GA_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      ) : null}

      {YANDEX_ID ? (
        <>
          <Script id="ym-init" strategy="afterInteractive">
            {`(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');ym(${YANDEX_ID},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true});`}
          </Script>
          <noscript>
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element -- трекинг-пиксель Метрики, next/image недопустим */}
              <img
                src={`https://mc.yandex.ru/watch/${YANDEX_ID}`}
                style={{ position: "absolute", left: "-9999px" }}
                alt=""
              />
            </div>
          </noscript>
        </>
      ) : null}
    </>
  );
}
