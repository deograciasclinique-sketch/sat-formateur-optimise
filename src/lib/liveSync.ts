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
import { nettoyerDonnees } from "./nettoyage";

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
            // Données reçues nettoyées aussi (protège contre d'anciennes données piégées).
            onUpdate(nettoyerDonnees(payload.data));
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
 *
 * Note : Firestore refuse catégoriquement toute valeur `undefined` dans un
 * document (même imbriquée). On passe donc la valeur par un aller-retour
 * JSON (stringify/parse), qui élimine naturellement tous les champs
 * `undefined` sans toucher aux autres types de données (null, dates en
 * chaîne, tableaux, etc. restent intacts).
 */
// ─── Fusion à trois voies ────────────────────────────────────────────────
// Avant, une mise à jour reçue d'un autre appareil REMPLAÇAIT toute la liste
// locale, et un envoi REMPLAÇAIT toute la liste du cloud. Résultat : un
// patient enregistré au secrétariat pouvait être effacé par la liste (plus
// ancienne) d'un autre poste, arrivée juste avant l'envoi — il fallait alors
// refaire l'enregistrement. Désormais on fusionne fiche par fiche (champ "id")
// en comparant à la dernière version commune connue ("base") : un ajout, une
// modification ou une suppression faite d'un côté n'est jamais écrasé par
// l'autre côté.

function sameJson(a: any, b: any): boolean {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function isIdList(v: any): v is Array<{ id: string }> {
  return Array.isArray(v) && v.every((it) => it && typeof it === "object" && typeof it.id === "string");
}

/**
 * Fusionne la version locale et la version distante d'une clé, à partir de
 * la dernière version commune (base). Retourne la valeur fusionnée.
 */
export function mergeThreeWay(base: any, local: any, remote: any): any {
  if (local === undefined) return remote;
  if (remote === undefined || remote === null) return local;

  if (!isIdList(local) || !isIdList(remote)) {
    // Valeur simple (nombre, réglages…) : le changement local non encore
    // envoyé l'emporte, sinon on prend la version distante.
    return sameJson(local, base) ? remote : local;
  }

  const baseMap = new Map<string, any>();
  if (isIdList(base)) base.forEach((it) => baseMap.set(it.id, it));
  const localMap = new Map<string, any>(local.map((it) => [it.id, it] as [string, any]));
  const remoteMap = new Map<string, any>(remote.map((it) => [it.id, it] as [string, any]));

  const pick = (id: string): any | undefined => {
    const b = baseMap.get(id);
    const l = localMap.get(id);
    const r = remoteMap.get(id);
    if (l && r) {
      if (sameJson(l, r)) return r;
      if (b && sameJson(l, b)) return r; // seul le distant a changé
      if (b && sameJson(r, b)) return l; // seul le local a changé
      return l; // modifié des deux côtés : la saisie de ce poste l'emporte
    }
    if (l && !r) {
      if (!b) return l; // nouvel ajout local, pas encore envoyé
      return sameJson(l, b) ? undefined : l; // supprimé ailleurs (sauf si modifié ici)
    }
    if (r && !l) {
      if (!b) return r; // nouvel ajout venu d'un autre poste
      return sameJson(r, b) ? undefined : r; // supprimé ici (sauf si modifié ailleurs)
    }
    return undefined;
  };

  // Ordre : celui du cloud, avec les nouveaux ajouts locaux placés en tête
  // ou en queue comme dans la liste locale (les listes ajoutent souvent en tête).
  const firstSharedIndex = local.findIndex((it) => remoteMap.has(it.id));
  const head: any[] = [];
  const tail: any[] = [];
  local.forEach((it, idx) => {
    if (remoteMap.has(it.id)) return;
    const v = pick(it.id);
    if (v === undefined) return;
    if (firstSharedIndex === -1 || idx < firstSharedIndex) head.push(v);
    else tail.push(v);
  });
  const middle: any[] = [];
  remote.forEach((it) => {
    const v = pick(it.id);
    if (v !== undefined) middle.push(v);
  });
  const merged = [...head, ...middle, ...tail];
  return sameJson(merged, remote) ? remote : merged;
}

/**
 * Envoie une clé vers le cloud SANS écraser les changements des autres
 * postes : lit la version actuelle du cloud, la fusionne avec la version
 * locale (fusion à trois voies), puis écrit le résultat — le tout dans une
 * transaction Firestore. Retourne la valeur fusionnée réellement enregistrée.
 */
export function pushMergedToCloudKey(key: string, local: any, base: any): Promise<any> {
  if (!db) return Promise.resolve(local);
  const firestore = db;
  const ref = firestore.collection(COLLECTION).doc(key);

  return firestore
    .runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const remote = snap.exists ? (snap.data() as any)?.data : undefined;
      const merged = mergeThreeWay(base, local, remote);
      let sanitized: any;
      sanitized = merged === undefined ? null : nettoyerDonnees(JSON.parse(JSON.stringify(merged)));
      tx.set(ref, { data: sanitized, updatedAt: Date.now() }, { merge: true });
      return sanitized;
    })
    .catch((err: any) => {
      console.error(`[liveSync] Échec de l'envoi fusionné de "${key}":`, err);
      throw err;
    });
}

export function pushToCloudKey(key: string, value: any): Promise<void> {
  if (!db) return Promise.resolve();

  let sanitized: any;
  try {
    // Nettoyage de chaque champ AVANT d'écrire dans la base (voir nettoyage.ts).
    sanitized = value === undefined ? null : nettoyerDonnees(JSON.parse(JSON.stringify(value)));
  } catch (err) {
    console.error(`[liveSync] Impossible de préparer "${key}" pour l'envoi:`, err);
    return Promise.reject(err);
  }

  return db
    .collection(COLLECTION)
    .doc(key)
    .set(
      {
        data: sanitized,
        updatedAt: Date.now(),
      },
      { merge: true }
    )
    .catch((err: any) => {
      console.error(`[liveSync] Échec de l'envoi de "${key}" vers le cloud:`, err);
      throw err;
    });
}
