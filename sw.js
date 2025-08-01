// Service Worker for ColorStack
const CACHE_NAME = 'colorstack-v2.1.2';
const STATIC_CACHE = 'colorstack-static-v2.1.2';
const DYNAMIC_CACHE = 'colorstack-dynamic-v2.1.2';

// Version configuration for cache busting
const VERSION_CONFIG = {
    version: '2.1.2',
    assets: {
        'js/main.js': '2.1.2',
        'js/ui.js': '2.1.2', 
        'js/image_processor.js': '2.1.2',
        'js/stl_exporter.js': '2.1.2',
        'js/main-fallback.js': '2.1.2',
        'Logo.svg': '2.1.2',
        'manifest.json': '2.1.2'
    },
    externals: {
        'https://cdn.tailwindcss.com?plugins=forms,container-queries': '2.1.2',
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap': '2.1.2',
        'https://fonts.googleapis.com/icon?family=Material+Icons': '2.1.2'
    }
};

// Cache busting utility
const getVersionedUrl = (path) => {
    if (path.startsWith('http')) {
        const version = VERSION_CONFIG.externals[path];
        if (version) {
            const separator = path.includes('?') ? '&' : '?';
            return `${path}${separator}v=${version}`;
        }
        return path;
    } else {
        const version = VERSION_CONFIG.assets[path] || VERSION_CONFIG.version;
        const separator = path.includes('?') ? '&' : '?';
        return `${path}${separator}v=${version}`;
    }
};

// Files to cache immediately (with versioned URLs)
const STATIC_FILES = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  getVersionedUrl('/js/main.js'),
  getVersionedUrl('/js/main-fallback.js'),
  getVersionedUrl('/js/image_processor.js'),
  getVersionedUrl('/js/stl_exporter.js'),
  getVersionedUrl('/js/ui.js'),
  getVersionedUrl('/Logo.svg'),
  getVersionedUrl('/manifest.json'),
  getVersionedUrl('https://cdn.tailwindcss.com?plugins=forms,container-queries'),
  getVersionedUrl('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'),
  getVersionedUrl('https://fonts.googleapis.com/icon?family=Material+Icons')
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Static files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Error caching static files:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle different types of requests
  if (url.pathname === '/' || url.pathname === '/index.html') {
    // Main page - serve from cache, fallback to network
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
  } else if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/') || 
             url.pathname.endsWith('.svg') || url.pathname.endsWith('.json')) {
    // JavaScript, CSS, SVG, and JSON files - cache first, then network
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            // Return cached version and update in background
            fetch(request)
              .then(response => {
                if (response && response.status === 200) {
                  const responseClone = response.clone();
                  caches.open(STATIC_CACHE)
                    .then(cache => cache.put(request, responseClone));
                }
              })
              .catch(() => {
                // Ignore fetch errors for background updates
              });
            return response;
          }
          return fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
  } else if (url.hostname === 'cdn.tailwindcss.com' || 
             url.hostname === 'fonts.googleapis.com' || 
             url.hostname === 'fonts.gstatic.com') {
    // External resources - cache first, then network
    event.respondWith(
      caches.match(request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE)
                  .then(cache => cache.put(request, responseClone));
              }
              return response;
            });
        })
    );
  } else if (url.pathname.startsWith('/api/') || url.pathname.includes('plausible.io')) {
    // API calls and analytics - network first, no cache
    event.respondWith(fetch(request));
  } else {
    // Other requests - network first, cache on success
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache for other requests
          return caches.match(request);
        })
    );
  }
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle any background sync tasks
      Promise.resolve()
    );
  }
});

// Push notifications (if needed in the future)
self.addEventListener('push', event => {
  console.log('Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'ColorStack notification',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open ColorStack',
        icon: '/icon-96.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('ColorStack', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handler for communication with main thread
self.addEventListener('message', event => {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Error handling
self.addEventListener('error', event => {
  console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker unhandled rejection:', event.reason);
}); 