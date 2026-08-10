const CACHE_NAME = 'monkeys-paw-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json'
];

// 安裝 Service Worker 並快取基本靜態資源
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

// 攔截請求：優先使用網路，斷網時退回快取（API 請求除外）
self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    return; // API 請求直接走網絡
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
