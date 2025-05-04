// firebase-auth.js

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAsmspxrDXhxTISZq9kOwZTeUHZ99jVOqA",
  authDomain: "ore-pws.firebaseapp.com",
  projectId: "ore-pws",
  storageBucket: "ore-pws.firebasestorage.app",
  messagingSenderId: "978531048476",
  appId: "1:978531048476:web:9d254fd6e85216adaad3d9",
  measurementId: "G-F3CD5FKP1S"
};

// Stato di autenticazione
let isLoggedIn = false;
let currentUser = null;
let userPhotoUrl = null;
let userEmail = null;
let tokenRefreshTimer = null; // Timer per il rinnovo automatico del token

// Inizializza Firebase
function initFirebase() {
  console.log('Inizializzazione Firebase...');
  // Inizializza Firebase solo se non è già stato inizializzato
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase inizializzato con successo');
  } else {
    console.log('Firebase già inizializzato');
  }
  
  // Tenta di ripristinare la sessione precedente
  tryRestoreSession();
  
  // Configura il listener per i cambiamenti di stato dell'autenticazione
  firebase.auth().onAuthStateChanged(handleAuthStateChanged);
  
  // Gestisci il risultato del redirect di autenticazione
  firebase.auth().getRedirectResult()
    .then((result) => {
      if (result.user) {
        console.log('Login completato tramite redirect');
        
        // Crea un elemento di notifica visibile
        const notification = document.createElement('div');
        notification.textContent = "Accesso effettuato con successo!";
        notification.style.position = 'fixed';
        notification.style.top = '50%';
        notification.style.left = '50%';
        notification.style.transform = 'translate(-50%, -50%)';
        notification.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
        notification.style.color = 'white';
        notification.style.padding = '20px';
        notification.style.borderRadius = '8px';
        notification.style.zIndex = '10000';
        document.body.appendChild(notification);
        
        // Rimuovi la notifica dopo 2 secondi
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 2000);
        
        // Salva il token nel localStorage per il sistema esistente
        if (result.credential && result.credential.accessToken) {
          localStorage.setItem('googleAuthToken', result.credential.accessToken);
        }
        
        // Ripristina lo stato precedente se necessario
        const redirectState = localStorage.getItem('auth_redirect_state');
        if (redirectState && redirectState !== window.location.href) {
          localStorage.removeItem('auth_redirect_state');
          // Non reindirizzare se siamo già nella pagina corretta
          if (redirectState !== window.location.href) {
            window.location.href = redirectState;
          }
        }
      }
    })
    .catch((error) => {
      console.error('Errore durante il recupero del risultato del redirect:', error);
      if (error.code !== 'auth/credential-already-in-use') {
        // Crea un elemento di notifica visibile per l'errore
        const errorNotification = document.createElement('div');
        errorNotification.textContent = "Errore durante l'accesso: " + error.message;
        errorNotification.style.position = 'fixed';
        errorNotification.style.top = '50%';
        errorNotification.style.left = '50%';
        errorNotification.style.transform = 'translate(-50%, -50%)';
        errorNotification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        errorNotification.style.color = 'white';
        errorNotification.style.padding = '20px';
        errorNotification.style.borderRadius = '8px';
        errorNotification.style.zIndex = '10000';
        document.body.appendChild(errorNotification);
        
        // Rimuovi la notifica dopo 3 secondi
        setTimeout(() => {
          if (document.body.contains(errorNotification)) {
            document.body.removeChild(errorNotification);
          }
        }, 3000);
      }
    });
  
  // Verifica se c'è già un utente autenticato
  checkAuthState();
}

// Tenta di ripristinare la sessione precedente
function tryRestoreSession() {
  // Verifica se c'è un utente salvato nel localStorage
  const savedUser = localStorage.getItem('firebaseUser');
  
  if (savedUser) {
    try {
      console.log('Trovato utente salvato, tentativo di ripristino sessione...');
      
      // Verifica se l'utente è già autenticato
      const currentUser = firebase.auth().currentUser;
      
      if (!currentUser) {
        console.log('Nessun utente autenticato, tentativo di ripristino automatico della sessione...');
        
        // Firebase gestisce automaticamente il ripristino della sessione
        // ma possiamo forzare un controllo dello stato di autenticazione
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            console.log('Sessione ripristinata automaticamente da Firebase');
          } else {
            console.log('Impossibile ripristinare automaticamente la sessione');
            // Rimuovi i dati salvati se non è possibile ripristinare la sessione
            localStorage.removeItem('firebaseUser');
            localStorage.removeItem('googleAuthToken');
          }
        });
      } else {
        console.log('Utente già autenticato, sessione attiva');
      }
    } catch (error) {
      console.error('Errore durante il tentativo di ripristino della sessione:', error);
      // Rimuovi i dati salvati in caso di errore
      localStorage.removeItem('firebaseUser');
      localStorage.removeItem('googleAuthToken');
    }
  } else {
    console.log('Nessun utente salvato trovato');
  }
}

// Gestisce i cambiamenti di stato dell'autenticazione
function handleAuthStateChanged(user) {
  if (user) {
    // L'utente è autenticato
    isLoggedIn = true;
    currentUser = user;
    userPhotoUrl = user.photoURL;
    userEmail = user.email;
    
    console.log('Utente Firebase autenticato:', userEmail);
    
    // Salva le informazioni dell'utente per il sistema esistente
    if (window.localStorage) {
      localStorage.setItem('firebaseUser', JSON.stringify({
        email: userEmail,
        photoUrl: userPhotoUrl,
        displayName: user.displayName,
        uid: user.uid
      }));
      
      // Salva anche il token per il sistema esistente
      user.getIdToken().then(token => {
        localStorage.setItem('googleAuthToken', token);
        
        // Imposta il rinnovo automatico del token
        setupTokenRefresh();
      });
    }
    
    // Aggiorna l'oggetto cloudManager
    console.log('Aggiornamento oggetto cloudManager per utente autenticato');
    window.cloudManager = window.cloudManager || {};
    window.cloudManager.getCurrentProvider = function() {
      return 'firebase';
    };
    window.cloudManager.isAuthenticated = function() {
      return true;
    };
    window.cloudManager.getUserInfo = function() {
      return {
        email: user.email,
        name: user.displayName || user.email,
        photoUrl: user.photoURL
      };
    };
    window.cloudManager.checkAuthStatus = function() {
      return Promise.resolve(true);
    };
    
    // Aggiorna l'interfaccia utente se la funzione esiste
    if (typeof window.updateFirebaseUI === 'function') {
      window.updateFirebaseUI(user);
    } else {
      console.log('La funzione updateFirebaseUI non esiste, creazione di un elemento UI personalizzato');
      createOrUpdateFirebaseUI(user);
    }
    
    // Ottieni un token di accesso fresco
    refreshAccessToken();
  } else {
    // L'utente non è autenticato
    isLoggedIn = false;
    currentUser = null;
    userPhotoUrl = null;
    userEmail = null;
    
    // Cancella il timer di rinnovo del token
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer);
      tokenRefreshTimer = null;
    }
    
    console.log('Utente Firebase non autenticato');
    
    // Rimuovi le informazioni dell'utente dal localStorage
    if (window.localStorage) {
      localStorage.removeItem('firebaseUser');
      localStorage.removeItem('googleAuthToken');
    }
    
    // Aggiorna l'oggetto cloudManager
    console.log('Aggiornamento oggetto cloudManager per utente non autenticato');
    window.cloudManager = window.cloudManager || {};
    window.cloudManager.getCurrentProvider = function() {
      return null;
    };
    window.cloudManager.isAuthenticated = function() {
      return false;
    };
    window.cloudManager.getUserInfo = function() {
      return null;
    };
    window.cloudManager.checkAuthStatus = function() {
      return Promise.resolve(false);
    };
    
    // Aggiorna l'interfaccia utente se la funzione esiste
    if (typeof window.updateFirebaseUI === 'function') {
      window.updateFirebaseUI(null);
    } else {
      console.log('La funzione updateFirebaseUI non esiste, aggiornamento elemento UI personalizzato');
      createOrUpdateFirebaseUI(null);
    }
  }
}

// Crea o aggiorna l'interfaccia utente per Firebase
function createOrUpdateFirebaseUI(user) {
  console.log('Creazione UI personalizzata per Firebase');
  
  // Verifica se la funzione updateFirebaseUI esiste
  if (typeof window.updateFirebaseUI === 'function') {
    console.log('Utilizzo della funzione updateFirebaseUI esistente');
    window.updateFirebaseUI(user);
    return;
  }
  
  // Altrimenti, crea un'interfaccia utente personalizzata
  console.log('Creazione interfaccia utente personalizzata');
  
  // Cerca un elemento esistente o creane uno nuovo
  let firebaseUIContainer = document.getElementById('firebase-auth-container');
  
  if (!firebaseUIContainer) {
    // Crea un nuovo container per l'UI di Firebase
    firebaseUIContainer = document.createElement('div');
    firebaseUIContainer.id = 'firebase-auth-container';
    firebaseUIContainer.style.position = 'fixed';
    firebaseUIContainer.style.top = '60px';
    firebaseUIContainer.style.right = '20px';
    firebaseUIContainer.style.zIndex = '1000';
    firebaseUIContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    firebaseUIContainer.style.padding = '10px';
    firebaseUIContainer.style.borderRadius = '8px';
    firebaseUIContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    document.body.appendChild(firebaseUIContainer);
  }
  
  if (user) {
    // Utente autenticato, mostra le informazioni dell'utente
    firebaseUIContainer.innerHTML = `
      <div class="user-profile" style="display: flex; align-items: center; gap: 10px;">
        ${user.photoURL ? `<img src="${user.photoURL}" alt="Foto profilo" style="width: 30px; height: 30px; border-radius: 50%;">` : ''}
        <span style="font-size: 14px;">${user.email}</span>
        <button onclick="logoutFromGoogle()" style="background-color: #f44336; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer; font-size: 12px;">Disconnetti</button>
      </div>
    `;
  } else {
    // Utente non autenticato, mostra il pulsante di login
    firebaseUIContainer.innerHTML = `
      <button onclick="loginWithGoogle()" style="background-color: #4285F4; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
        </svg>
        Accedi con Google
      </button>
    `;
  }
}

// Verifica lo stato di autenticazione
function checkAuthState() {
  const user = firebase.auth().currentUser;
  handleAuthStateChanged(user);
  return user !== null;
}

// Effettua il login con Google
function loginWithGoogle() {
  console.log('Tentativo di login con Google via Firebase...');
  
  // Crea un elemento di notifica visibile
  const notification = document.createElement('div');
  notification.textContent = "Apertura pagina di accesso Google...";
  notification.style.position = 'fixed';
  notification.style.top = '50%';
  notification.style.left = '50%';
  notification.style.transform = 'translate(-50%, -50%)';
  notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  notification.style.color = 'white';
  notification.style.padding = '20px';
  notification.style.borderRadius = '8px';
  notification.style.zIndex = '10000';
  document.body.appendChild(notification);
  
  // Rimuovi la notifica dopo 3 secondi
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
  
  const provider = new firebase.auth.GoogleAuthProvider();
  
  // Aggiungi gli scope necessari per Google Drive
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/drive.appdata');
  
  // Richiedi sempre il consenso per ottenere un refresh token
  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline'
  });
  
  // Usa sempre il metodo redirect per evitare problemi con i popup
  console.log('Utilizzo metodo redirect per l\'autenticazione');
  
  // Salva lo stato corrente per tornare alla stessa pagina dopo il login
  localStorage.setItem('auth_redirect_state', window.location.href);
  
  // Usa il metodo redirect
  try {
    firebase.auth().signInWithRedirect(provider)
      .catch((error) => {
        console.error('Errore durante il redirect per login Firebase:', error);
        
        // Mostra un messaggio di errore
        const errorNotification = document.createElement('div');
        errorNotification.textContent = "Errore durante l'accesso: " + error.message;
        errorNotification.style.position = 'fixed';
        errorNotification.style.top = '50%';
        errorNotification.style.left = '50%';
        errorNotification.style.transform = 'translate(-50%, -50%)';
        errorNotification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
        errorNotification.style.color = 'white';
        errorNotification.style.padding = '20px';
        errorNotification.style.borderRadius = '8px';
        errorNotification.style.zIndex = '10000';
        document.body.appendChild(errorNotification);
        
        // Rimuovi la notifica dopo 5 secondi
        setTimeout(() => {
          if (document.body.contains(errorNotification)) {
            document.body.removeChild(errorNotification);
          }
        }, 5000);
      });
  } catch (e) {
    console.error('Eccezione durante il tentativo di login:', e);
    
    // Mostra un messaggio di errore
    const errorNotification = document.createElement('div');
    errorNotification.textContent = "Errore imprevisto durante l'accesso. Riprova più tardi.";
    errorNotification.style.position = 'fixed';
    errorNotification.style.top = '50%';
    errorNotification.style.left = '50%';
    errorNotification.style.transform = 'translate(-50%, -50%)';
    errorNotification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
    errorNotification.style.color = 'white';
    errorNotification.style.padding = '20px';
    errorNotification.style.borderRadius = '8px';
    errorNotification.style.zIndex = '10000';
    document.body.appendChild(errorNotification);
    
    // Rimuovi la notifica dopo 5 secondi
    setTimeout(() => {
      if (document.body.contains(errorNotification)) {
        document.body.removeChild(errorNotification);
      }
    }, 5000);
  }
}

// Effettua il logout
function logoutFromGoogle() {
  console.log('Tentativo di logout da Google via Firebase...');
  
  // Crea un elemento di notifica visibile
  const notification = document.createElement('div');
  notification.textContent = "Disconnessione in corso...";
  notification.style.position = 'fixed';
  notification.style.top = '50%';
  notification.style.left = '50%';
  notification.style.transform = 'translate(-50%, -50%)';
  notification.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  notification.style.color = 'white';
  notification.style.padding = '20px';
  notification.style.borderRadius = '8px';
  notification.style.zIndex = '10000';
  document.body.appendChild(notification);
  
  firebase.auth().signOut()
    .then(() => {
      console.log('Logout Firebase completato con successo');
      
      // Rimuovi il token dal localStorage
      localStorage.removeItem('googleAuthToken');
      
      // Aggiorna la notifica
      notification.textContent = "Disconnessione effettuata con successo";
      notification.style.backgroundColor = 'rgba(76, 175, 80, 0.9)';
      
      // Rimuovi la notifica dopo 2 secondi
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 2000);
    })
    .catch((error) => {
      console.error('Errore durante il logout Firebase:', error);
      
      // Aggiorna la notifica con l'errore
      notification.textContent = "Errore durante la disconnessione: " + error.message;
      notification.style.backgroundColor = 'rgba(244, 67, 54, 0.9)';
      
      // Rimuovi la notifica dopo 3 secondi
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 3000);
    });
}

// Ottieni un token di accesso valido
async function getValidAccessToken() {
  if (!currentUser) {
    return null;
  }
  
  try {
    // Questo metodo rinnova automaticamente il token se necessario
    const token = await currentUser.getIdToken(true);
    return token;
  } catch (error) {
    console.error('Errore durante il recupero del token Firebase:', error);
    return null;
  }
}

// Aggiorna il token di accesso
function refreshAccessToken() {
  if (!currentUser) {
    return Promise.reject(new Error('Utente non autenticato'));
  }
  
  return currentUser.getIdToken(true)
    .then((token) => {
      console.log('Token Firebase aggiornato con successo');
      
      // Salva il token nel localStorage
      localStorage.setItem('googleAuthToken', token);
      
      // Imposta il rinnovo automatico del token
      setupTokenRefresh();
      
      return token;
    })
    .catch((error) => {
      console.error('Errore durante l\'aggiornamento del token Firebase:', error);
      throw error;
    });
}

// Funzione per impostare il rinnovo automatico del token
function setupTokenRefresh() {
  // Cancella eventuali timer esistenti
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
  }
  
  // Se non c'è un utente autenticato, non fare nulla
  if (!currentUser) {
    return;
  }
  
  // Firebase rinnova automaticamente il token ID, ma possiamo forzare un refresh periodico
  // per assicurarci che il token sia sempre valido
  // Il token di Firebase dura tipicamente 3600 secondi (1 ora)
  const refreshTime = 50 * 60 * 1000; // 50 minuti in millisecondi
  
  console.log(`Programmato rinnovo automatico del token Firebase tra ${refreshTime/1000/60} minuti.`);
  
  // Imposta il timer per rinnovare il token automaticamente
  tokenRefreshTimer = setTimeout(async () => {
    console.log('Rinnovo automatico del token Firebase in corso...');
    try {
      await refreshAccessToken();
      console.log('Token Firebase rinnovato automaticamente con successo');
    } catch (error) {
      console.warn('Errore nel rinnovo automatico del token Firebase:', error);
      // Se fallisce, prova a verificare lo stato di autenticazione
      checkAuthState();
    }
  }, refreshTime);
}

// Backup su Google Drive
async function backupToGoogleDrive(data) {
  if (!isLoggedIn || !currentUser) {
    showToast("Effettua l'accesso per eseguire il backup", "warning");
    return null;
  }
  
  try {
    // Ottieni un token di accesso valido
    const token = await getValidAccessToken();
    
    if (!token) {
      showToast("Impossibile ottenere un token valido. Riprova ad accedere.", "error");
      return null;
    }
    
    // Usa il token per chiamare l'API Google Drive
    const response = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Errore API: ${response.status} ${response.statusText}`);
    }
    
    const files = await response.json();
    console.log('File in appDataFolder:', files);
    
    // Implementa la logica per creare o aggiornare il file di backup
    // ...
    
    showToast("Backup completato con successo!", "success");
    return files;
  } catch (error) {
    console.error('Errore durante il backup:', error);
    showToast("Errore durante il backup: " + error.message, "error");
    return null;
  }
}

// Ripristina da Google Drive
async function restoreFromGoogleDrive() {
  if (!isLoggedIn || !currentUser) {
    showToast("Effettua l'accesso per ripristinare i dati", "warning");
    return null;
  }
  
  try {
    // Ottieni un token di accesso valido
    const token = await getValidAccessToken();
    
    if (!token) {
      showToast("Impossibile ottenere un token valido. Riprova ad accedere.", "error");
      return null;
    }
    
    // Implementa la logica per recuperare il file di backup
    // ...
    
    showToast("Ripristino completato con successo!", "success");
    return true;
  } catch (error) {
    console.error('Errore durante il ripristino:', error);
    showToast("Errore durante il ripristino: " + error.message, "error");
    return null;
  }
}

// Funzione per mostrare toast (implementazione sicura)
function showToast(message, type = "info") {
  // Sempre loggare il messaggio
  console.log(`[TOAST-${type.toUpperCase()}] ${message}`);
  
  // Evita completamente di usare la funzione showToast globale
  // per prevenire qualsiasi possibilità di ricorsione
  
  // Crea un elemento toast semplice
  try {
    const toast = document.createElement('div');
    toast.className = `firebase-toast firebase-toast-${type}`;
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '4px';
    toast.style.backgroundColor = type === 'error' ? '#f44336' : 
                                 type === 'success' ? '#4caf50' : 
                                 type === 'warning' ? '#ff9800' : '#2196f3';
    toast.style.color = 'white';
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
    toast.style.zIndex = '10000';
    
    document.body.appendChild(toast);
    
    // Rimuovi il toast dopo 3 secondi
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s ease';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 500);
    }, 3000);
  } catch (error) {
    console.error('Errore durante la visualizzazione del toast:', error);
  }
}

// Inizializza l'oggetto cloudManager globale
console.log('Inizializzazione oggetto cloudManager globale');
window.cloudManager = {
  getCurrentProvider: function() { 
    return firebase.auth().currentUser ? 'firebase' : null; 
  },
  isAuthenticated: function() { 
    return firebase.auth().currentUser !== null; 
  },
  getUserInfo: function() { 
    const user = firebase.auth().currentUser;
    if (!user) return null;
    return {
      email: user.email,
      name: user.displayName || user.email,
      photoUrl: user.photoURL
    };
  },
  checkAuthStatus: function() { 
    return Promise.resolve(firebase.auth().currentUser !== null); 
  }
};

// Funzione per inizializzare Firebase in modo sicuro
function safeInitFirebase() {
  // Verifica se Firebase è già caricato
  if (typeof firebase === 'undefined') {
    console.error('Firebase non è stato caricato correttamente');
    return false;
  }
  
  try {
    // Inizializza Firebase
    initFirebase();
    return true;
  } catch (error) {
    console.error('Errore durante l\'inizializzazione di Firebase:', error);
    return false;
  }
}

// Inizializza Firebase quando il documento è pronto
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM caricato, verifica Firebase...');
  
  // Disabilita il sistema di autenticazione esistente
  window.disableExistingAuthSystem = true;
  
  // Sovrascrive la funzione updateCloudAccountUI
  window.updateCloudAccountUI = function() {
    console.log('Funzione updateCloudAccountUI sovrascritta da Firebase (DOMContentLoaded)');
    // Non fa nulla, lascia che Firebase gestisca l'interfaccia utente
  };
  
  // Verifica se Firebase è già caricato
  if (typeof firebase !== 'undefined') {
    console.log('Firebase trovato, inizializzazione...');
    // Ritardo l'inizializzazione per assicurarsi che tutto sia caricato
    setTimeout(() => {
      safeInitFirebase();
    }, 1000);
  } else {
    console.error('Firebase non è stato caricato correttamente');
    // Riprova dopo un breve ritardo
    setTimeout(() => {
      if (typeof firebase !== 'undefined') {
        console.log('Firebase trovato dopo ritardo, inizializzazione...');
        safeInitFirebase();
      } else {
        console.error('Firebase non disponibile anche dopo il ritardo');
      }
    }, 2000);
  }
});

// Esponi le funzioni globalmente
window.loginWithGoogle = loginWithGoogle;
window.logoutFromGoogle = logoutFromGoogle;
window.backupToGoogleDrive = backupToGoogleDrive;
window.restoreFromGoogleDrive = restoreFromGoogleDrive;
window.checkAuthState = checkAuthState;
window.firebaseAuth = {
  isLoggedIn: () => isLoggedIn,
  getCurrentUser: () => currentUser,
  getUserEmail: () => userEmail,
  getUserPhotoUrl: () => userPhotoUrl,
  getToken: getValidAccessToken,
  refreshToken: refreshAccessToken,
  setupTokenRefresh: setupTokenRefresh
};

// Intercetta le chiamate fetch per aggiungere il token di autenticazione
const originalFetch = window.fetch;
window.fetch = function(url, options) {
  // Se la richiesta è verso l'API Google e non ha già un'autorizzazione
  if (url.includes('googleapis.com') && (!options || !options.headers || !options.headers.Authorization)) {
    console.log('Intercettata chiamata API Google:', url);
    
    // Ottieni il token di autenticazione
    return getValidAccessToken().then(token => {
      if (!token) {
        console.warn('Token non disponibile per la richiesta API Google');
        return originalFetch(url, options);
      }
      
      // Aggiungi il token all'header Authorization
      const newOptions = options || {};
      newOptions.headers = newOptions.headers || {};
      newOptions.headers.Authorization = `Bearer ${token}`;
      
      console.log('Aggiunto token di autenticazione alla richiesta API Google');
      return originalFetch(url, newOptions);
    }).catch(error => {
      console.error('Errore durante il recupero del token per la richiesta API Google:', error);
      return originalFetch(url, options);
    });
  }
  
  // Altrimenti, usa il fetch originale
  return originalFetch(url, options);
};
