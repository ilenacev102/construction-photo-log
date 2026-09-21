// Service Worker за „Фото Градежен Дневник“.
// Стратегија: network-only — секогаш земај од мрежата, за да не се кешираат
// динамични или автентицирани одговори (API, страници со Supabase сесија).
// Регистриран само во производство преку ServiceWorkerRegistration компонентата.

const SW_VERSION = "1.0.0";

self.addEventListener("install", () => {
  // Не чекај старата верзија да се затвори — активирај ја новата веднаш.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key !== `construction-photo-log-${SW_VERSION}`)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Network-only: препрати го барањето директно до мрежата.
  event.respondWith(fetch(event.request));
});