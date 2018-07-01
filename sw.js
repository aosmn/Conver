const staticCacheName = 'converter-static-v5';
const allCaches = [
  staticCacheName
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll([
        'skeleton.html',
        'styles.css',
        'scripts.js',
        'indexedDB.js',
        'sharp-import_export-24px.svg'
      ]);
    })
  );
});
//
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('converter-') &&
                 !allCaches.includes(cacheName);
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin === location.origin) {
    if (requestUrl.pathname === '/' || requestUrl.pathname === '/converr/') {
      event.respondWith(caches.match('skeleton.html'));
      return;
    }
  }
//
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});


self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
