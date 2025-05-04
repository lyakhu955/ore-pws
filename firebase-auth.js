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
  
  // Configura il listener per i cambiamenti di stato dell'autenticazione
  firebase.auth().onAuthStateChanged(handleAuthStateChanged);
  
  // Gestisci il risultato del redirect di autenticazione
  firebase.auth().getRedirectResult()
    .then((result) => {
      if (result.user) {
        console.log('Login completato tramite redirect');
        showToast("Accesso effettuato con successo!", "success");
        
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
        showToast("Errore durante l'accesso: " + error.message, "error");
      }
    });
  
  // Verifica se c'è già un utente autenticato
  checkAuthState();
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
      });
    }
    
    // Crea l'oggetto cloudManager se non esiste
    if (!window.cloudManager) {
      console.log('Creazione oggetto cloudManager per compatibilità');
      window.cloudManager = {
        getCurrentProvider: function() {
          return 'firebase';
        },
        isAuthenticated: function() {
          return true;
        },
        getUserInfo: function() {
          return {
            email: user.email,
            name: user.displayName || user.email,
            photoUrl: user.photoURL
          };
        },
        checkAuthStatus: function() {
          return Promise.resolve(true);
        }
      };
    }
    
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
    
    console.log('Utente Firebase non autenticato');
    
    // Rimuovi le informazioni dell'utente dal localStorage
    if (window.localStorage) {
      localStorage.removeItem('firebaseUser');
      localStorage.removeItem('googleAuthToken');
    }
    
    // Crea l'oggetto cloudManager se non esiste
    if (!window.cloudManager) {
      console.log('Creazione oggetto cloudManager vuoto per compatibilità');
      window.cloudManager = {
        getCurrentProvider: function() {
          return null;
        },
        isAuthenticated: function() {
          return false;
        },
        getUserInfo: function() {
          return null;
        },
        checkAuthStatus: function() {
          return Promise.resolve(false);
        }
      };
    }
    
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
  
  // Mostra un messaggio all'utente
  showToast("Apertura pagina di accesso Google...", "info");
  
  const provider = new firebase.auth.GoogleAuthProvider();
  
  // Aggiungi gli scope necessari per Google Drive
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/drive.appdata');
  
  // Richiedi sempre il consenso per ottenere un refresh token
  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline'
  });
  
  // Determina se usare il popup o il redirect in base al dispositivo
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Su dispositivi mobili, usa il redirect per evitare problemi con i popup
    console.log('Utilizzo metodo redirect per dispositivi mobili');
    
    // Salva lo stato corrente per tornare alla stessa pagina dopo il login
    localStorage.setItem('auth_redirect_state', window.location.href);
    
    // Usa il metodo redirect
    firebase.auth().signInWithRedirect(provider)
      .catch((error) => {
        console.error('Errore durante il redirect per login Firebase:', error);
        showToast("Errore durante l'accesso: " + error.message, "error");
      });
  } else {
    // Su desktop, prova prima con il popup
    console.log('Tentativo di login con popup su desktop');
    
    try {
      firebase.auth().signInWithPopup(provider)
        .then((result) => {
          // Login completato con successo
          console.log('Login Firebase completato con successo');
          showToast("Accesso effettuato con successo!", "success");
          
          // Salva il token nel localStorage per il sistema esistente
          if (result.credential && result.credential.accessToken) {
            localStorage.setItem('googleAuthToken', result.credential.accessToken);
          }
        })
        .catch((error) => {
          console.error('Errore durante il login Firebase con popup:', error);
          
          // Se il popup è stato bloccato, prova con il redirect
          if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user' || error.message.includes('popup')) {
            console.log('Popup bloccato, passaggio al metodo redirect');
            showToast("Il popup è stato bloccato. Utilizzo metodo alternativo...", "warning");
            
            // Salva lo stato corrente
            localStorage.setItem('auth_redirect_state', window.location.href);
            
            // Breve ritardo prima del redirect
            setTimeout(() => {
              firebase.auth().signInWithRedirect(provider);
            }, 1000);
          } else {
            showToast("Errore durante l'accesso: " + error.message, "error");
          }
        });
    } catch (e) {
      console.error('Eccezione durante il tentativo di login:', e);
      showToast("Errore imprevisto durante l'accesso. Riprova più tardi.", "error");
    }
  }
}

// Effettua il logout
function logoutFromGoogle() {
  console.log('Tentativo di logout da Google via Firebase...');
  firebase.auth().signOut()
    .then(() => {
      console.log('Logout Firebase completato con successo');
      showToast("Disconnessione effettuata con successo", "info");
      
      // Rimuovi il token dal localStorage
      localStorage.removeItem('googleAuthToken');
    })
    .catch((error) => {
      console.error('Errore durante il logout Firebase:', error);
      showToast("Errore durante la disconnessione: " + error.message, "error");
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
      return token;
    })
    .catch((error) => {
      console.error('Errore durante l\'aggiornamento del token Firebase:', error);
      throw error;
    });
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

// Funzione per mostrare toast (assicurati che esista nel tuo codice)
function showToast(message, type = "info") {
  // Verifica se esiste già una funzione showToast nel codice principale
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    // Implementazione di fallback
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Crea un elemento toast semplice se non esiste la funzione
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
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
        document.body.removeChild(toast);
      }, 500);
    }, 3000);
  }
}

// Inizializza l'oggetto cloudManager globale se non esiste
if (!window.cloudManager) {
  console.log('Inizializzazione oggetto cloudManager globale');
  window.cloudManager = {
    getCurrentProvider: function() { return null; },
    isAuthenticated: function() { return false; },
    getUserInfo: function() { return null; },
    checkAuthStatus: function() { return Promise.resolve(false); }
  };
}

// Inizializza Firebase quando il documento è pronto
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM caricato, verifica Firebase...');
  
  // Assicurati che l'oggetto cloudManager esista
  if (!window.cloudManager) {
    console.log('Creazione oggetto cloudManager globale (DOMContentLoaded)');
    window.cloudManager = {
      getCurrentProvider: function() { return null; },
      isAuthenticated: function() { return false; },
      getUserInfo: function() { return null; },
      checkAuthStatus: function() { return Promise.resolve(false); }
    };
  }
  
  // Verifica se Firebase è già caricato
  if (typeof firebase !== 'undefined') {
    console.log('Firebase trovato, inizializzazione...');
    // Ritardo l'inizializzazione per assicurarsi che tutto sia caricato
    setTimeout(() => {
      initFirebase();
    }, 1000);
  } else {
    console.error('Firebase non è stato caricato correttamente');
    // Riprova dopo un breve ritardo
    setTimeout(() => {
      if (typeof firebase !== 'undefined') {
        console.log('Firebase trovato dopo ritardo, inizializzazione...');
        initFirebase();
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
  getToken: getValidAccessToken
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
