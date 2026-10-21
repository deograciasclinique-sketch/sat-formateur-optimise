import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/auth";

// (Édition démo : la configuration du cabinet n'est même pas incluse dans l'application.)
const firebaseConfig = (import.meta.env.VITE_EDITION === "demo" || import.meta.env.VITE_EDITION === "commercial") ? ({} as Record<string, string>) : {
  apiKey: "AIzaSyBSuvK7ZrKR5FoDXVtDSbR64vsa8nk3uks",
  authDomain: "deo-gracias-rdv-5d815.firebaseapp.com",
  projectId: "deo-gracias-rdv-5d815",
  storageBucket: "deo-gracias-rdv-5d815.firebasestorage.app",
  messagingSenderId: "149855015298",
  appId: "1:149855015298:web:e410d46341ee418942ff9b"
};

import { BUILD, DEMO, SAAS, CONFIG_COMMERCIALE } from "./edition";

let db: firebase.firestore.Firestore | null = null;
/** Base réelle (sans cloisonnement) : réservée aux comptes / abonnements du SaaS. */
let baseReelle: firebase.firestore.Firestore | null = null;

/* ---------- Cloisonnement par clinique (mode clinique du SaaS) ----------
   Toutes les collections de l'application (dg_live_sync, rdv, dg_backups…) sont rangées
   dans cliniques/<id clinique>/… : une clinique ne peut ni lire ni écrire chez une autre
   (les règles du serveur le vérifient aussi). */
let cliniqueActive: string | null = null;
export function definirClinique(id: string | null) { cliniqueActive = id; }
export function cliniqueCourante() { return cliniqueActive; }
function baseCloisonnee(reelle: firebase.firestore.Firestore): firebase.firestore.Firestore {
  return new Proxy(reelle, {
    get(cible, prop) {
      if (prop === "collection") {
        return (nom: string) => {
          if (!cliniqueActive) throw new Error("Aucune clinique active : connexion requise.");
          return cible.collection("cliniques").doc(cliniqueActive).collection(nom);
        };
      }
      const v = Reflect.get(cible, prop, cible);
      return typeof v === "function" ? v.bind(cible) : v;
    },
  }) as firebase.firestore.Firestore;
}

// Édition démo : aucune connexion (db reste vide, tout reste sur l'appareil).
// Mode clinique : base commerciale, cloisonnée par clinique. Édition cabinet : base du cabinet.
const configChoisie = SAAS ? CONFIG_COMMERCIALE : BUILD === "cabinet" ? firebaseConfig : null;
try {
  if (configChoisie && !firebase.apps.length) {
    firebase.initializeApp(configChoisie);
  }
  if (configChoisie) {
    baseReelle = firebase.firestore();
    db = SAAS ? baseCloisonnee(baseReelle) : baseReelle;
  }
  // Certains réseaux (pare-feu, antivirus, proxy du cabinet) coupent
  // silencieusement les connexions longue durée qu'utilise Firestore par
  // défaut pour le temps réel — les écritures et la lecture au chargement
  // de la page fonctionnent alors normalement, mais les mises à jour reçues
  // en direct depuis un autre appareil n'arrivent jamais tant que la page
  // n'est pas rechargée. Ce réglage détecte automatiquement ce cas et
  // bascule sur un mode de connexion ("long polling") plus compatible.
  if (baseReelle) baseReelle.settings({ experimentalAutoDetectLongPolling: true, useFetchStreams: false });
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// ─── Authentification ────────────────────────────────────────────────────
// Deux types de connexion, que les règles de sécurité Firestore distinguent :
//
//  • PORTAIL PATIENT (?mode=patient) : connexion ANONYME automatique. Un
//    patient peut seulement déposer une demande de RDV et voir/annuler SES
//    propres demandes (champ patientUid).
//
//  • APPLI DU PERSONNEL : l'APPAREIL est activé une seule fois avec le compte
//    du cabinet (e-mail + mot de passe Firebase). La connexion reste mémorisée
//    sur l'appareil ; les agents continuent ensuite à entrer avec leur PIN.
//    Seul ce type de connexion donne accès aux données médicales.

export const isPatientPortal: boolean =
  BUILD === "cabinet" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "patient";

let resolveAuthReady: () => void = () => {};
/** Résolu dès qu'une connexion VALIDE pour ce mode est établie (anonyme pour
 *  le portail patient, compte du cabinet pour l'appli du personnel). */
export const authReady: Promise<void> = new Promise((resolve) => { resolveAuthReady = resolve; });

type DeviceListener = (activated: boolean, email: string | null) => void;
const deviceListeners = new Set<DeviceListener>();
let deviceState: { known: boolean; activated: boolean; email: string | null } = { known: false, activated: false, email: null };

/** Abonnement à l'état d'activation de l'appareil (appli du personnel). */
export function onDeviceActivationChange(cb: DeviceListener): () => void {
  deviceListeners.add(cb);
  if (deviceState.known) cb(deviceState.activated, deviceState.email);
  return () => { deviceListeners.delete(cb); };
}

try {
  if (firebase.apps.length) {
    firebase.auth().onAuthStateChanged((user) => {
      if (isPatientPortal) {
        if (user) {
          resolveAuthReady();
        } else {
          firebase.auth().signInAnonymously().catch((error) => {
            console.error("Connexion Firebase anonyme impossible :", error);
            resolveAuthReady(); // on ne bloque pas l'affichage du portail
          });
        }
        return;
      }

      // Appli du personnel : une ancienne connexion anonyme n'a plus accès
      // aux données → on la ferme pour afficher l'écran d'activation.
      if (user && user.isAnonymous) {
        firebase.auth().signOut().catch(() => {});
        return;
      }
      deviceState = { known: true, activated: !!user, email: user?.email || null };
      deviceListeners.forEach((cb) => cb(deviceState.activated, deviceState.email));
      if (user) resolveAuthReady();
    });
  } else {
    resolveAuthReady();
  }
} catch (error) {
  console.error("Initialisation de l'authentification Firebase impossible :", error);
  resolveAuthReady();
}

/** Active cet appareil avec le compte du cabinet. Lève une erreur lisible. */
export async function activateDevice(email: string, password: string): Promise<void> {
  try {
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    await firebase.auth().signInWithEmailAndPassword(email.trim(), password);
  } catch (e: any) {
    const code = e?.code || "";
    if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found") || code.includes("invalid-email")) {
      throw new Error("E-mail ou mot de passe incorrect.");
    }
    if (code.includes("too-many-requests")) throw new Error("Trop d'essais. Patientez quelques minutes.");
    if (code.includes("network")) throw new Error("Pas de connexion internet.");
    if (code.includes("operation-not-allowed")) throw new Error("La connexion par e-mail n'est pas activée dans Firebase (Authentication → Sign-in method).");
    throw new Error("Activation impossible : " + (e?.message || code));
  }
}

/** Retire l'accès de cet appareil (ex : PC perdu, prêté, ou remplacé). */
export async function deactivateDevice(): Promise<void> {
  await firebase.auth().signOut();
}

/** Identifiant anonyme du patient sur ce téléphone (portail patient). */
export function getCurrentUid(): string | null {
  try { return firebase.auth().currentUser?.uid || null; } catch { return null; }
}

export { db };
/** Accès à la base commerciale non cloisonnée (comptes et abonnements uniquement). */
export function baseCommerciale() { return SAAS ? baseReelle : null; }
export { firebase };
