// Service Worker — Cache de assets estáticos apenas
// Nenhum dado do Firestore é cacheado localmente (intencional)

const CACHE_NAME = "sjpii-cashless-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
];

// Install — precache estáticos
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch — cache-first para assets estáticos, network-only para tudo mais
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignora requests do Firebase/Firestore — NUNCA cachear
  if (
    url.hostname.includes("firestore") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("mercadopago") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Apenas GET requests para assets estáticos
  if (event.request.method !== "GET") return;

  // Cache-first para assets estáticos (JS, CSS, imagens, fontes)
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|webp)$/) ||
    url.pathname === "/" ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-only para todo o resto (páginas dinâmicas)
  // Não intercepta — deixa o browser lidar normalmente
});
