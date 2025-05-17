// Service Worker per Ore PWS - Versione migliorata per iOS e Android
const CACHE_NAME = 'ore-pws-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
];

// Variabile globale per memorizzare le notifiche programmate
let scheduledNotifications = [];

// Funzione per salvare le notifiche programmate in IndexedDB
function saveScheduledNotifications() {
  if (self.indexedDB) {
    const request = self.indexedDB.open('OreNotifications', 1);
    
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      const transaction = db.transaction(['notifications'], 'readwrite');
      const store = transaction.objectStore('notifications');
      
      // Cancella tutte le notifiche esistenti
      store.clear();
      
      // Salva le nuove notifiche
      scheduledNotifications.forEach((notification, index) => {
        notification.id = index;
        store.add(notification);
      });
      
      console.log('Service Worker: Notifiche salvate in IndexedDB', scheduledNotifications.length);
    };
    
    request.onerror = function(event) {
      console.error('Service Worker: Errore nell\'apertura di IndexedDB', event.target.error);
    };
  }
}

// Funzione per caricare le notifiche programmate da IndexedDB
function loadScheduledNotifications() {
  if (self.indexedDB) {
    const request = self.indexedDB.open('OreNotifications', 1);
    
    request.onupgradeneeded = function(event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('notifications')) {
        db.createObjectStore('notifications', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = function(event) {
      const db = event.target.result;
      const transaction = db.transaction(['notifications'], 'readonly');
      const store = transaction.objectStore('notifications');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = function() {
        scheduledNotifications = getAllRequest.result || [];
        console.log('Service Worker: Notifiche caricate da IndexedDB', scheduledNotifications.length);
        
        // Riprogramma le notifiche
        scheduledNotifications.forEach(notification => {
          scheduleNotification(notification.title, notification.options, notification.timestamp);
        });
      };
    };
    
    request.onerror = function(event) {
      console.error('Service Worker: Errore nell\'apertura di IndexedDB', event.target.error);
    };
  }
}

// Installazione del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installazione in corso');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aperta');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Installazione completata');
        return self.skipWaiting(); // Forza l'attivazione immediata
      })
  );
});

// Funzione per verificare periodicamente le notifiche programmate
function checkScheduledNotifications() {
  console.log('Service Worker: Verifica notifiche programmate', new Date().toLocaleString());
  
  const now = Date.now();
  
  // Filtra le notifiche scadute
  const expiredNotifications = scheduledNotifications.filter(n => n.timestamp <= now);
  
  // Mostra le notifiche scadute
  expiredNotifications.forEach(notification => {
    // Verifica se è un giorno valido (se specificato nelle opzioni)
    let shouldShow = true;
    if (notification.options.data && notification.options.data.days) {
      const today = new Date().getDay();
      shouldShow = notification.options.data.days.includes(today);
    }
    
    if (shouldShow) {
      console.log('Service Worker: Invio notifica programmata (verifica periodica)');
      self.registration.showNotification(notification.title, notification.options)
        .catch(error => {
          console.error('Service Worker: Errore nell\'invio della notifica', error);
        });
    }
  });
  
  // Rimuovi le notifiche scadute
  scheduledNotifications = scheduledNotifications.filter(n => n.timestamp > now);
  saveScheduledNotifications();
}

// Attivazione del Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Attivazione in corso');
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Rimozione vecchia cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Attivazione completata');
      
      // Carica le notifiche programmate
      loadScheduledNotifications();
      
      // Avvia il controllo periodico delle notifiche (ogni 5 minuti)
      setInterval(checkScheduledNotifications, 5 * 60 * 1000);
      
      // Esegui un controllo immediato
      setTimeout(checkScheduledNotifications, 5000);
      
      return self.clients.claim(); // Prendi il controllo di tutti i client
    })
  );
});

// Gestione delle richieste di rete
self.addEventListener('fetch', (event) => {
  // Strategia Cache First con fallback su rete
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((response) => {
            // Memorizza nella cache solo se è una risposta valida
            if (response && response.status === 200 && response.type === 'basic') {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return response;
          })
          .catch(() => {
            // Fallback per pagine offline
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return null;
          });
      })
  );
});

// Gestione delle notifiche push
self.addEventListener('push', (event) => {
  console.log('Service Worker: Notifica push ricevuta');
  
  let notificationData = {};
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData = {
        title: 'Ore PWS',
        body: event.data.text(),
        icon: './icons/icon-192x192.png'
      };
    }
  } else {
    notificationData = {
      title: 'Ore PWS',
      body: 'Ricordati di segnare le ore di oggi!',
      icon: './icons/icon-192x192.png'
    };
  }
  
  const options = {
    body: notificationData.body || 'Ricordati di segnare le ore di oggi!',
    icon: notificationData.icon || './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    tag: notificationData.tag || 'ore-pws-reminder',
    data: notificationData.data || {},
    requireInteraction: true,
    actions: [
      {
        action: 'open-app',
        title: 'Apri App'
      },
      {
        action: 'dismiss',
        title: 'Chiudi'
      }
    ],
    // Vibrazione personalizzata per attirare l'attenzione
    vibrate: [100, 50, 100, 50, 100]
  };
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title || 'Ore PWS', options)
  );
});

// Gestione del click sulle notifiche
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Click su notifica', event.notification.tag);
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Apri l'app quando l'utente clicca sulla notifica
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Verifica se c'è già una finestra aperta
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        // Altrimenti apri una nuova finestra
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
  );
});

// Funzione per programmare una notifica
function scheduleNotification(title, options, timestamp) {
  // Calcola il tempo di attesa
  const now = Date.now();
  const timeToWait = Math.max(0, timestamp - now);
  
  console.log(`Service Worker: Programmazione notifica per ${new Date(timestamp).toLocaleString('it-IT')}, attesa di ${Math.round(timeToWait / 1000 / 60)} minuti`);
  
  // Se il tempo è già passato, mostra subito la notifica
  if (timeToWait <= 0) {
    self.registration.showNotification(title, options);
    return;
  }
  
  // Aggiungi la notifica all'elenco delle notifiche programmate
  scheduledNotifications.push({
    title,
    options,
    timestamp
  });
  
  // Salva le notifiche programmate
  saveScheduledNotifications();
  
  // Pianifica la notifica
  const notificationId = setTimeout(() => {
    console.log('Service Worker: Invio notifica programmata');
    
    // Verifica se è un giorno valido (se specificato nelle opzioni)
    let shouldShow = true;
    if (options.data && options.data.days) {
      const today = new Date().getDay();
      shouldShow = options.data.days.includes(today);
    }
    
    if (shouldShow) {
      self.registration.showNotification(title, options)
        .then(() => {
          // Rimuovi la notifica dall'elenco
          scheduledNotifications = scheduledNotifications.filter(n => n.timestamp !== timestamp);
          saveScheduledNotifications();
          
          // Invia un messaggio a tutti i client per confermare l'invio della notifica
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'NOTIFICATION_SENT',
                timestamp: Date.now()
              });
            });
          });
        })
        .catch(error => {
          console.error('Service Worker: Errore nell\'invio della notifica', error);
        });
    } else {
      console.log('Service Worker: Notifica non mostrata perché oggi non è un giorno valido');
    }
  }, timeToWait);
  
  return notificationId;
}

// Gestione delle notifiche programmate
self.addEventListener('message', (event) => {
  console.log('Service Worker: Messaggio ricevuto', event.data);
  
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, options, timestamp } = event.data;
    
    // Aggiungi i giorni della settimana alle opzioni se presenti
    if (event.data.days) {
      options.data = options.data || {};
      options.data.days = event.data.days;
    }
    
    // Programma la notifica
    scheduleNotification(title, options, timestamp);
    
    // Conferma la ricezione del messaggio
    if (event.source) {
      event.source.postMessage({
        type: 'NOTIFICATION_SCHEDULED',
        timestamp: timestamp
      });
    }
  }
  
  // Gestione della cancellazione delle notifiche
  if (event.data && event.data.type === 'CANCEL_NOTIFICATIONS') {
    console.log('Service Worker: Cancellazione notifiche richiesta');
    
    // Cancella tutte le notifiche programmate
    scheduledNotifications = [];
    saveScheduledNotifications();
    
    // Conferma la cancellazione
    if (event.source) {
      event.source.postMessage({
        type: 'NOTIFICATIONS_CANCELLED'
      });
    }
  }
  
  // Gestione della richiesta di test delle notifiche
  if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    console.log('Service Worker: Test notifica richiesto');
    
    const options = {
      body: 'Questa è una notifica di test. Se la vedi, le notifiche funzionano correttamente!',
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-72x72.png',
      tag: 'ore-pws-test',
      requireInteraction: true,
      vibrate: [100, 50, 100],
      actions: [
        {
          action: 'open-app',
          title: 'Apri App'
        },
        {
          action: 'dismiss',
          title: 'Chiudi'
        }
      ]
    };
    
    self.registration.showNotification('Test Notifica Ore PWS', options)
      .then(() => {
        if (event.source) {
          event.source.postMessage({
            type: 'TEST_NOTIFICATION_SENT',
            success: true
          });
        }
      })
      .catch(error => {
        console.error('Service Worker: Errore nel test della notifica', error);
        if (event.source) {
          event.source.postMessage({
            type: 'TEST_NOTIFICATION_SENT',
            success: false,
            error: error.message
          });
        }
      });
  }
});
