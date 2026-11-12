/* Public web config from Firebase console (Project settings > Your apps > Web). It is not a secret.
   Real protection is in firestore.rules, which only lets the owner Google account write. */
window.OWNER_EMAIL = "marcelinofahmyatiia@gmail.com";
window.FIREBASE_CONFIG = {
  apiKey: "PUT_API_KEY_HERE",
  authDomain: "PUT_PROJECT_ID.firebaseapp.com",
  projectId: "PUT_PROJECT_ID",
  appId: "PUT_APP_ID"
};
