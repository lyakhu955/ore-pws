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
    
    // Cerca se esiste già un file di backup
    const searchResponse = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27ore_pws_backup.json%27', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Errore API: ${searchResponse.status} ${searchResponse.statusText}`);
    }
    
    const searchResult = await searchResponse.json();
    const fileExists = searchResult.files && searchResult.files.length > 0;
    const fileId = fileExists ? searchResult.files[0].id : null;
    
    // Prepara i dati del backup
    const backupData = {
      data: data,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    // Converti in JSON
    const fileContent = JSON.stringify(backupData);
    
    // Crea un Blob con il contenuto
    const blob = new Blob([fileContent], {type: 'application/json'});
    
    if (fileExists) {
      // Aggiorna il file esistente
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({
        name: 'ore_pws_backup.json',
        mimeType: 'application/json'
      })], {type: 'application/json'}));
      form.append('file', blob);
      
      const updateResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: form
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Errore durante l'aggiornamento: ${updateResponse.status} ${updateResponse.statusText}`);
      }
      
      const updateResult = await updateResponse.json();
      showToast("Backup aggiornato con successo!", "success");
      return updateResult;
    } else {
      // Crea un nuovo file
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({
        name: 'ore_pws_backup.json',
        mimeType: 'application/json',
        parents: ['appDataFolder']
      })], {type: 'application/json'}));
      form.append('file', blob);
      
      const createResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: form
      });
      
      if (!createResponse.ok) {
        throw new Error(`Errore durante la creazione: ${createResponse.status} ${createResponse.statusText}`);
      }
      
      const createResult = await createResponse.json();
      showToast("Backup creato con successo!", "success");
      return createResult;
    }
  } catch (error) {
    console.error('Errore durante il backup:', error);
    showToast("Errore durante il backup: " + error.message, "error");
    return null;
  }
}

// Funzione per il ripristino da Google Drive
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
    
    // Cerca il file di backup
    const searchResponse = await fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name%3D%27ore_pws_backup.json%27', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Errore API: ${searchResponse.status} ${searchResponse.statusText}`);
    }
    
    const searchResult = await searchResponse.json();
    
    if (!searchResult.files || searchResult.files.length === 0) {
      showToast("Nessun backup trovato", "warning");
      return null;
    }
    
    const fileId = searchResult.files[0].id;
    
    // Scarica il contenuto del file
    const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!downloadResponse.ok) {
      throw new Error(`Errore durante il download: ${downloadResponse.status} ${downloadResponse.statusText}`);
    }
    
    const backupContent = await downloadResponse.json();
    
    // Verifica che il backup sia valido
    if (!backupContent.data || !backupContent.timestamp) {
      throw new Error('Il formato del backup non è valido');
    }
    
    // Ripristina i dati
    // Qui dovresti implementare la logica per ripristinare i dati nella tua applicazione
    // ...
    
    showToast(`Ripristino completato con successo! Backup del ${new Date(backupContent.timestamp).toLocaleString()}`, "success");
    return backupContent.data;
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

// Esponi le funzioni globalmente
window.loginWithGoogle = loginWithGoogle;
window.logoutFromGoogle = logoutFromGoogle;
window.backupToGoogleDrive = backupToGoogleDrive;
window.restoreFromGoogleDrive = restoreFromGoogleDrive;
window.checkAuthState = checkAuthState;
