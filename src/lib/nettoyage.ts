/**
 * Nettoyage des données AVANT qu'elles touchent la base (Firestore) — et à leur réception.
 *
 * Toutes les écritures de l'application passent par liveSync.ts, qui appelle nettoyerDonnees() :
 *   • textes : suppression des balises HTML / scripts (« <script> », « <img onerror=…> »…),
 *     des caractères de contrôle et des caractères invisibles ; « TA<90 » reste intact ;
 *   • clés dangereuses (__proto__, constructor, prototype) supprimées ;
 *   • valeurs non enregistrables (undefined, fonctions, NaN, Infinity) retirées ou mises à null ;
 *   • profondeur limitée (protection contre les données piégées).
 *
 * Les photos, le logo et les fichiers joints (textes « data:…;base64,… ») ne sont pas modifiés.
 * Ce nettoyage protège en particulier les fiches imprimées (ordonnances, cartes, registres),
 * qui sont construites en HTML à partir des données saisies.
 */

const CARACTERES_INTERDITS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// Uniquement de vraies balises fermées (« <b> », « <img …> ») : un texte comme « Glycémie<Normale »
// ou « TA<90 » n'est plus coupé.
const BALISES = /<\/?[a-zA-Z!?][^<>]*>/g;
const CLES_INTERDITES = new Set(["__proto__", "constructor", "prototype"]);
const PROFONDEUR_MAX = 40;
const TEXTE_MAX = 200_000; // hors images

export function nettoyerTexte(t: string): string {
  if (t.startsWith("data:")) {
    // Fichier encodé (photo, logo, PDF…) : gardé tel quel s'il est bien en base64
    // (aucun guillemet ni balise possible) ; sinon refusé.
    return /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+(;[a-z0-9=._-]+)*;base64,[A-Za-z0-9+/=\s]*$/i.test(t) ? t : "";
  }
  let s = t.replace(CARACTERES_INTERDITS, "");
  // Balises fermées retirées ; un « < » restant devant une lettre est remplacé par « ‹ »
  // (le texte reste lisible, mais ne peut plus ouvrir une balise dans une fiche imprimée).
  if (s.includes("<")) s = s.replace(BALISES, "").replace(/<(?=[a-zA-Z!?\/])/g, "‹");
  if (/^\s*javascript:/i.test(s)) s = s.replace(/^\s*javascript:/i, "");
  if (s.length > TEXTE_MAX) s = s.slice(0, TEXTE_MAX);
  return s;
}

/** Retourne une copie nettoyée de n'importe quelle donnée (liste, objet, texte…). */
export function nettoyerDonnees<T>(valeur: T): T {
  return nettoyer(valeur, 0) as T;
}

function nettoyer(v: any, profondeur: number): any {
  if (v === null) return null;
  switch (typeof v) {
    case "string":
      return nettoyerTexte(v);
    case "number":
      return Number.isFinite(v) ? v : null;
    case "boolean":
      return v;
    case "undefined":
    case "function":
    case "symbol":
    case "bigint":
      return undefined;
  }
  if (profondeur >= PROFONDEUR_MAX) return null;
  if (Array.isArray(v)) {
    const out: any[] = [];
    for (const it of v) {
      const c = nettoyer(it, profondeur + 1);
      out.push(c === undefined ? null : c);
    }
    return out;
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  if (typeof v === "object") {
    // Objets Firestore (Timestamp, etc.) : on les laisse tels quels.
    if (typeof v.toMillis === "function" || typeof v.toDate === "function") return v;
    const out: Record<string, any> = {};
    for (const k of Object.keys(v)) {
      if (CLES_INTERDITES.has(k)) continue;
      const c = nettoyer(v[k], profondeur + 1);
      if (c !== undefined) out[nettoyerTexte(k).slice(0, 200)] = c;
    }
    return out;
  }
  return undefined;
}
