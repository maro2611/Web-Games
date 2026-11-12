/* Public web config from Firebase console (Project settings > Your apps > Web). It is not a secret.
   Real protection is in firestore.rules, which only lets the owner Google account write. */
window.OWNER_EMAIL = "marcelinofahmyatiia@gmail.com";
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBwhKCEP9mjbWqZ4xfx9LOuGCiiBn2kSxg",
  authDomain: "marcelino-games.firebaseapp.com",
  projectId: "marcelino-games",
  storageBucket: "marcelino-games.firebasestorage.app",
  messagingSenderId: "451098458088",
  appId: "1:451098458088:web:2afa29da464e5b5731965d"
};

/* Web Push key: Firebase console > Project settings > Cloud Messaging > Web Push certificates > Generate key pair.
   Notifications stay off until this is filled in. It is a public key, not a secret. */
window.VAPID_KEY = "PUT_VAPID_KEY_HERE";
