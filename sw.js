/* Word Alchemy service worker — app-shell + immutable-asset caching.
   Bump CACHE when the shell (index.html / icons / manifest) changes.
   v4: 2026-11-13 homonym stage 28장 두 얼굴의 문 deploy (index.html 5a98f538).
   v4.2: 2026-11-14 대연금술 2탄 번개·태풍·용암·오로라 deploy (index.html 842bd292).
   v4.2c: 2026-11-14 조합 총수 하드코딩 50 -> 54 교정 redeploy (index.html 849dea6f).
   v4.3: 2026-11-14 대연금술 3탄 지진·혜성·블랙홀 + 31장 + og 이미지 재생성 deploy (index.html e708b243).
   v4.4: 2026-11-14 플레이 화면 레벨·경험치바 + 현재 스테이지 간략화 deploy (index.html e0a0efe5).
   v25: 2026-11-17 PLAN-v4 동음이의어 굴·김·풀 + 조합 6개 + 입 단어 deploy (index.html f427fae1).
   v29: 2026-11-17 모험 바 → 기존 메인화면 첫 화면으로 이동 deploy (index.html 2eb33a8c).
   Without a bump, returning visitors keep the old shell: the navigation
   handler is stale-while-revalidate, and sw.js itself only updates when
   its bytes change.
   v30: 2026-11-18 patch33 여울 QA (index.html 958a4a84635c).
   v31: 2026-11-18 patch34 발견 노트+힌트 (index.html 3571f3de7fd7).
 */
const CACHE = 'word-alchemy-v31';
const SHELL = [
  '/', '/index.html', '/manifest.json',
  '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png',
  '/favicon.ico', '/favicon.png', '/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation (including challenge links like ?ch=stage:5):
  // stale-while-revalidate the shell so updates still reach players.
  // Only the app shell itself is a navigation target. A direct navigation
  // to a sub-resource (/manifest.json, /sw.js, an icon) must NOT be cached
  // under the shell key — that would make the game show the manifest or
  // an image on the next visit. Those fall through to the network-first
  // handler below, cached under their own URL.
  if (e.request.mode === 'navigate' &&
      (url.pathname === '/' || url.pathname === '/index.html')) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match('/index.html', { ignoreSearch: true }).then((hit) => {
          const net = fetch(e.request)
            .then((res) => {
              if (res.ok) c.put('/index.html', res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  // Content-addressed images (assets/img/<hash>.webp): immutable, cache-first.
  if (url.pathname.startsWith('/assets/img/')) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(e.request).then((hit) =>
          hit ||
          fetch(e.request).then((res) => {
            if (res.ok) c.put(e.request, res.clone());
            return res;
          })
        )
      )
    );
    return;
  }

  // Everything else same-origin: network-first, fall back to cache.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
