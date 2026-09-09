import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBSuvK7ZrKR5FoDXVtDSbR64vsa8nk3uks",
  authDomain: "deo-gracias-rdv-5d815.firebaseapp.com",
  projectId: "deo-gracias-rdv-5d815",
  storageBucket: "deo-gracias-rdv-5d815.firebasestorage.app",
  messagingSenderId: "149855015298",
  appId: "1:149855015298:web:e410d46341ee418942ff9b"
};

let db: firebase.firestore.Firestore | null = null;

try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
  // Certains réseaux (pare-feu, antivirus, proxy du cabinet) coupent
  // silencieusement les connexions longue durée qu'utilise Firestore par
  // défaut pour le temps réel — les écritures et la lecture au chargement
  // de la page fonctionnent alors normalement, mais les mises à jour reçues
  // en direct depuis un autre appareil n'arrivent jamais tant que la page
  // n'est pas rechargée. Ce réglage détecte automatiquement ce cas et
  // bascule sur un mode de connexion ("long polling") plus compatible.
  db.settings({ experimentalAutoDetectLongPolling: true, useFetchStreams: false });
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// Connexion anonyme automatique et invisible pour l'utilisateur (pas de mot
// de passe demandé, aucun changement pour le personnel qui continue à
// utiliser son code PIN). Elle sert uniquement à ce que Firestore puisse
// vérifier "request.auth != null" dans ses règles de sécurité, pour empêcher
// une lecture/écriture directe des données par quelqu'un qui ne passe pas
// par l'application.
export const authReady: Promise<void> = new Promise((resolve) => {
  try {
    if (!firebase.apps.length) {
      resolve();
      return;
    }
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        resolve();
      } else {
        firebase
          .auth()
          .signInAnonymously()
          .catch((error) => {
            console.error("Connexion Firebase anonyme impossible :", error);
            // On résout quand même pour ne pas bloquer indéfiniment l'app :
            // elle continuera de fonctionner en local (localStorage) sans
            // synchronisation cloud tant que la connexion échoue.
            resolve();
          });
      }
    });
  } catch (error) {
    console.error("Initialisation de l'authentification Firebase impossible :", error);
    resolve();
  }
});

export { db };
