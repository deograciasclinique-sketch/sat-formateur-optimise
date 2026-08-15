/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Synchronisation temps réel multi-appareils via Firestore.
 *
 * Chaque "clé" de données (ex: dg_consultations, dg_tasks, dg_rdv...) est stockée
 * dans un document Firestore unique de la collection "dg_live_sync". Chaque appareil
 * connecté écoute les changements en temps réel (onSnapshot) et pousse ses propres
 * modifications après les avoir enregistrées localement.
 *
 * Limite connue : la fusion est "dernier écrit gagne" au niveau de la liste entière
 * (pas de fusion champ par champ). Deux agents modifiant EXACTEMENT la même fiche au
 * même instant sur deux appareils différents peuvent voir l'un des deux changements
 * écrasé. Pour un usage normal (un agent travaille, un autre reprend après), cela ne
 * pose pas de problème.
 */

import { db } from "./firebase";

const COLLECTION = "dg_live_sync";

/**
 * S'abonne aux changements distants d'une clé de données.
 * Retourne une fonction de désabonnement à appeler au démontage.
 */
export function subscribeToCloudKey(
  key: string,
  onUpdate: (data: any) => void
): () => void {
  if (!db) return () => {};

  try {
    const unsubscribe = db
      .collection(COLLECTION)
      .doc(key)
      .onSnapshot(
        (snap) => {
          if (!snap.exists) return;
          const payload = snap.data();
          if (payload && Object.prototype.hasOwnProperty.call(payload, "data")) {
            onUpdate(payload.data);
          }
        },
        (err) => {
          console.error(`[liveSync] Erreur d'écoute pour "${key}":`, err);
        }
      );
    return unsubscribe;
  } catch (err) {
    console.error(`[liveSync] Impossible de s'abonner à "${key}":`, err);
    return () => {};
  }
}

/**
 * Pousse la valeur d'une clé de données vers Firestore.
 * Retourne une Promise qui se résout une fois l'écriture confirmée.
 */
export function pushToCloudKey(key: string, value: any): Promise<void> {
  if (!db) return Promise.resolve();

  return db
    .collection(COLLECTION)
    .doc(key)
    .set(
      {
        data: value,
        updatedAt: Date.now(),
      },
      { merge: true }
    )
    .catch((err: any) => {
      console.error(`[liveSync] Échec de l'envoi de "${key}" vers le cloud:`, err);
      throw err;
    });
}
