/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Synchronisation temps réel multi-appareils via Firestore.
 *
 * Les listes de fiches (consultations, patients, factures…) sont rangées « une fiche = un
 * document » (voir syncCore.ts) : plus de limite de 1 Mo pour toute une liste, et seules les
 * fiches modifiées sont envoyées. Les anciennes données sont migrées automatiquement.
 *
 * Fusion à trois voies conservée : un ajout, une modification ou une suppression faite sur un
 * poste n'est jamais écrasé par un autre poste ; deux postes modifiant EXACTEMENT la même fiche
 * au même instant : la saisie de ce poste l'emporte.
 */

import { db, firebase } from "./firebase";
import { nettoyerDonnees } from "./nettoyage";
import { creerSync, mergeThreeWay } from "./syncCore";

export { mergeThreeWay };

const dejaSignale = new Set<string>();
function signalerFicheTropGrosse(cle: string, id: string, octets: number) {
  console.error(`[sync] Fiche « ${id} » de « ${cle} » trop volumineuse (${Math.round(octets / 1024)} Ko) : non synchronisée.`);
  const k = cle + "/" + id;
  if (dejaSignale.has(k) || typeof document === "undefined") return;
  dejaSignale.add(k);
  const t = document.createElement("div");
  t.setAttribute("role", "alert");
  t.textContent = "⚠️ Une fiche est trop volumineuse pour être synchronisée (trop de photos ou de documents joints). Retirez ou réduisez des photos de cette fiche.";
  t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#b45309;color:#fff;padding:12px 16px;border-radius:12px;font:600 13px system-ui,sans-serif;max-width:calc(100% - 32px);box-shadow:0 10px 24px rgba(0,0,0,.25)";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 9000);
}

const sync = creerSync({
  db: () => db as any,
  supprimerChamp: () => firebase.firestore.FieldValue.delete(),
  nettoyer: nettoyerDonnees,
  signalerFicheTropGrosse,
});

/** S'abonne aux changements d'une clé (liste complète reconstituée). Retourne le désabonnement. */
export function subscribeToCloudKey(key: string, onUpdate: (data: any) => void): () => void {
  try {
    return sync.subscribe(key, onUpdate);
  } catch (err) {
    console.error(`[liveSync] Impossible de s'abonner à "${key}":`, err);
    return () => {};
  }
}

/** Échecs d'envoi répétés : message visible (sinon l'erreur reste cachée dans la console). */
const echecs: Record<string, { n: number; affiche: number }> = {};
function signalerEchec(key: string, err: any) {
  const e = (echecs[key] = echecs[key] || { n: 0, affiche: 0 });
  e.n++;
  if (e.n < 3 || Date.now() - e.affiche < 120_000 || typeof document === "undefined") return;
  e.affiche = Date.now();
  const t = document.createElement("div");
  t.setAttribute("role", "alert");
  t.textContent = `⚠️ Synchronisation bloquée (${key.replace(/^dg_/, "")}) : ${String(err?.code || err?.message || err).slice(0, 140)}. Vérifiez la connexion ; si le message revient, faites une capture.`;
  t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#b91c1c;color:#fff;padding:12px 16px;border-radius:12px;font:600 13px system-ui,sans-serif;max-width:calc(100% - 32px);box-shadow:0 10px 24px rgba(0,0,0,.25)";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 12000);
}

/** Envoi fusionné : retourne la valeur fusionnée réellement enregistrée. */
export function pushMergedToCloudKey(key: string, local: any, base: any): Promise<any> {
  return sync.pushMerged(key, local, base)
    .then((v) => { if (echecs[key]) echecs[key].n = 0; return v; })
    .catch((err: any) => {
      console.error(`[liveSync] Échec de l'envoi fusionné de "${key}":`, err);
      signalerEchec(key, err);
      throw err;
    });
}

/** Envoi direct : la valeur de ce poste remplace celle du cloud. */
export function pushToCloudKey(key: string, value: any): Promise<void> {
  return sync.push(key, value).catch((err: any) => {
    console.error(`[liveSync] Échec de l'envoi de "${key}" vers le cloud:`, err);
    throw err;
  });
}

/** Lecture ponctuelle de la valeur actuelle d'une clé dans le cloud. */
export function lireCloudKey(key: string): Promise<any> {
  return sync.lire(key);
}
