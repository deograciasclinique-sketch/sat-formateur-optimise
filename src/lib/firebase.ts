import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

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
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

export { db };
