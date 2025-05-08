// Nome della cache e versione (incrementa la versione quando aggiorni l'app)
const CACHE_NAME = 'ore-pws-cache-v1.2';
const DATA_CACHE_NAME = 'ore-pws-data-cache-v1.2';

// Percorso base per GitHub Pages
const BASE_PATH = '/ore-pws';

// File da mettere in cache per il funzionamento offline
const CORE_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/sw.js`,
  `${BASE_PATH}/icons/icon-72x72.png`,
  `${BASE_PATH}/icons/icon-96x96.png`,
  `${BASE_PATH}/icons/icon-128x128.png`,
  `${BASE_PATH}/icons/icon-144x144.png`,
  `${BASE_PATH}/icons/icon-152x152.png`,
  `${BASE_PATH}/icons/icon-192x192.png`,
  `${BASE_PATH}/icons/icon-384x384.png`,
  `${BASE_PATH}/icons/icon-512x512.png`
];

// Risorse esterne da mettere in cache
const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/it.js',
  'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js',
  'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Pagina di fallback offline
const OFFLINE_PAGE = `${BASE_PATH}/index.html`;

// Installazione del Service Worker
self.addEventListener('install', event => {
  console.log('[Service Worker] Installazione');
  
  // Forza l'attivazione immediata del nuovo service worker
  self.skipWaiting();
  
  // Esegui l'installazione in modo asincrono
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cache aperta');
        // Aggiungi prima le risorse core
        return cache.addAll(CORE_ASSETS)
          .then(() => {
            console.log('[Service Worker] Risorse core aggiunte alla cache');
            // Poi prova ad aggiungere le risorse esterne (ma non fallire se alcune non sono disponibili)
            return caches.open(DATA_CACHE_NAME)
              .then(dataCache => {
                console.log('[Service Worker] Tentativo di aggiungere risorse esterne alla cache');
                // Usa Promise.allSettled per gestire sia successi che fallimenti
                return Promise.allSettled(
                  EXTERNAL_ASSETS.map(url => 
                    fetch(url)
                      .then(response => {
                        if (response.ok) {
                          return dataCache.put(url, response);
                        }
                        throw new Error(`Impossibile caricare ${url}: ${response.status}`);
                      })
                      .catch(error => {
                        console.warn(`[Service Worker] Impossibile caricare risorsa esterna: ${url}`, error);
                        // Non fallire l'intera operazione
                        return Promise.resolve();
                      })
                  )
                );
              });
          });
      })
      .catch(error => {
        console.error('[Service Worker] Errore durante l\'installazione:', error);
      })
  );
});

// Attivazione del Service Worker
self.addEventListener('activate', event => {
  console.log('[Service Worker] Attivazione');
  
  // Prendi il controllo immediatamente
  event.waitUntil(clients.claim());
  
  const cacheWhitelist = [CACHE_NAME, DATA_CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Elimina le cache vecchie che non sono nella whitelist
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('[Service Worker] Eliminazione cache vecchia:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('[Service Worker] Attivato e pronto!');
    })
  );
});

// Gestione delle richieste di rete
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Gestisci le richieste API in modo diverso (non caricare dalla cache)
  if (url.pathname.includes('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // Per le richieste di navigazione, usa la strategia cache-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request)
            .catch(() => caches.match(OFFLINE_PAGE));
        })
    );
    return;
  }
  
  // Per le risorse statiche, usa la strategia cache-first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - restituisci la risposta dalla cache
        if (response) {
          return response;
        }
        
        // Altrimenti, vai in rete
        return fetchAndCache(event.request);
      })
      .catch(error => {
        console.error('[Service Worker] Errore durante il fetch:', error);
        
        // Se è una richiesta di immagine, restituisci un'immagine placeholder
        if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
          return new Response('Immagine non disponibile', { 
            status: 200, 
            headers: {'Content-Type': 'text/plain'} 
          });
        }
        
        // Per altre risorse, restituisci un errore
        return new Response('Risorsa non disponibile offline', { 
          status: 503, 
          headers: {'Content-Type': 'text/plain'} 
        });
      })
  );
});

// Strategia Network First per le API
function networkFirst(request) {
  return fetch(request)
    .then(response => {
      // Clona la risposta per salvarla nella cache
      const clonedResponse = response.clone();
      
      caches.open(DATA_CACHE_NAME)
        .then(cache => {
          cache.put(request, clonedResponse);
        });
      
      return response;
    })
    .catch(() => {
      return caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Se non c'è una risposta nella cache, restituisci un errore
          return new Response(JSON.stringify({ error: 'Nessuna connessione di rete disponibile' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        });
    });
}

// Funzione per recuperare dalla rete e salvare nella cache
function fetchAndCache(request) {
  return fetch(request)
    .then(response => {
      // Controlla se abbiamo ricevuto una risposta valida
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      
      // Clona la risposta perché è un flusso che può essere consumato solo una volta
      const responseToCache = response.clone();
      
      // Determina quale cache usare in base al tipo di risorsa
      const cacheName = request.url.includes('fonts.googleapis.com') || 
                        request.url.includes('cdn.jsdelivr.net') || 
                        request.url.includes('cdnjs.cloudflare.com') 
                        ? DATA_CACHE_NAME : CACHE_NAME;
      
      caches.open(cacheName)
        .then(cache => {
          // Aggiungi la risposta alla cache
          cache.put(request, responseToCache);
        })
        .catch(error => {
          console.warn('[Service Worker] Errore durante il salvataggio nella cache:', error);
        });
      
      return response;
    });
}
