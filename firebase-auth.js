// firebase-auth.js

// Configurazione Firebase
const firebaseConfig = {
  // Inserisci qui la tua configurazione Firebase copiata dal passo 3
  apiKey: "TUA_API_KEY",
  authDomain: "tuo-progetto.firebaseapp.com",
  projectId: "tuo-progetto",
  storageBucket: "tuo-progetto.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:a1b2c3d4e5f6g7h8i9j0"
};

// Stato di autenticazione
let isLoggedIn = false;
let currentUser = null;
let userPhotoUrl = null;
let userEmail = null;

// Inizializza Firebase
function initFirebase() {
  // Inizializza Firebase solo se non è già stato inizializzato
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  
  // Configura il listener per i cambiamenti di stato dell'autenticazione
  firebase.auth().onAuthStateChanged(handleAuthStateChanged);
  
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
    
    console.log('Utente autenticato:', userEmail);
    
    // Aggiorna l'interfaccia utente
    if (typeof updateCloudAccountUI === 'function') {
      updateCloudAccountUI();
    }
    
    // Ottieni un token di accesso fresco
    refreshAccessToken();
  } else {
    // L'utente non è autenticato
    isLoggedIn = false;
    currentUser = null;
    userPhotoUrl = null;
    userEmail = null;
    
    console.log('Utente non autenticato');
    
    // Aggiorna l'interfaccia utente
    if (typeof updateCloudAccountUI === 'function') {
      updateCloudAccountUI();
    }
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
  const provider = new firebase.auth.GoogleAuthProvider();
  
  // Aggiungi gli scope necessari per Google Drive
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.addScope('https://www.googleapis.com/auth/drive.appdata');
  
  // Richiedi sempre il consenso per ottenere un refresh token
  provider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline'
  });
  
  // Mostra il popup di login
  firebase.auth().signInWithPopup(provider)
    .then((result) => {
      // Login completato con successo
      showToast("Accesso effettuato con successo!", "success");
    })
    .catch((error) => {
      console.error('Errore durante il login:', error);
      showToast("Errore durante l'accesso: " + error.message, "error");
    });
}

// Effettua il logout
function logoutFromGoogle() {
  firebase.auth().signOut()
    .then(() => {
      showToast("Disconnessione effettuata con successo", "info");
    })
    .catch((error) => {
      console.error('Errore durante il logout:', error);
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
    console.error('Errore durante il recupero del token:', error);
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
      console.log('Token aggiornato con successo');
      return token;
    })
    .catch((error) => {
      console.error('Errore durante l\'aggiornamento del token:', error);
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
    
    // Qui puoi implementare la logica per creare o aggiornare il file di backup
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

// Inizializza Firebase quando il documento è pronto
document.addEventListener('DOMContentLoaded', () => {
  // Verifica se Firebase è già caricato
  if (typeof firebase !== 'undefined') {
    initFirebase();
  } else {
    console.error('Firebase non è stato caricato correttamente');
  }
});
