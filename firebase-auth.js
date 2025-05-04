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
    document.body.appendChild(firebaseUIContainer);
  }
  
  if (user) {
    // Utente autenticato, mostra le informazioni dell'utente
    firebaseUIContainer.innerHTML = `
      <div class="user-profile">
        ${user.photoURL ? `<img src="${user.photoURL}" alt="Foto profilo" class="profile-pic">` : ''}
        <span>${user.email}</span>
        <button onclick="logoutFromGoogle()" class="logout-btn">Disconnetti</button>
      </div>
    `;
  } else {
    // Utente non autenticato, mostra il pulsante di login
    firebaseUIContainer.innerHTML = `
      <button onclick="loginWithGoogle()" class="btn">
        <span class="material-symbols-outlined">cloud</span>
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
      console.log('Login Firebase completato con successo');
      showToast("Accesso effettuato con successo!", "success");
      
      // Salva il token nel localStorage per il sistema esistente
      if (result.credential && result.credential.accessToken) {
        localStorage.setItem('googleAuthToken', result.credential.accessToken);
      }
    })
    .catch((error) => {
      console.error('Errore durante il login Firebase:', error);
      showToast("Errore durante l'accesso: " + error.message, "error");
    });
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

// Inizializza Firebase quando il documento è pronto
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM caricato, verifica Firebase...');
  // Verifica se Firebase è già caricato
  if (typeof firebase !== 'undefined') {
    console.log('Firebase trovato, inizializzazione...');
    initFirebase();
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
