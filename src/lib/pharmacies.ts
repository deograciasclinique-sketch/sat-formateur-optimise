/**
 * Pharmacies de la zone et tour de garde automatique.
 *
 * • Les pharmacies et la configuration du tour de garde sont saisies UNE fois (onglet Pharmacie)
 *   et synchronisées entre tous les postes (clé « dg_pharmacies_zone »).
 * • La pharmacie de garde de la semaine est CALCULÉE automatiquement : on indique quel groupe
 *   est de garde à une date donnée, l'ordre des groupes et la durée d'une garde (7 jours) ;
 *   l'application en déduit le groupe de garde à n'importe quelle date.
 * • Une copie publique (sans les remarques internes) est publiée dans Firestore
 *   (pharmacies_public/zone) pour le portail patient.
 *
 * Utilisé par : onglet Pharmacie, ordonnance imprimée, message WhatsApp, portail patient.
 */

export interface Pharmacie {
  id: string;
  nom: string;
  quartier: string;
  telephone: string;
  telephone2?: string;
  /** Coordonnées GPS (facultatives). */
  lat?: number | null;
  lng?: number | null;
  /** Lien Google Maps collé tel quel (facultatif, https uniquement). */
  lienMaps?: string;
  horaires?: string;
  remarques?: string;
  /** Groupe du tour de garde (vide = ne fait pas partie du tour). */
  groupeId?: string;
}

export interface GroupeGarde {
  id: string;
  nom: string;
}

export interface ExceptionGarde {
  /** Début de la période concernée (AAAA-MM-JJ). */
  debut: string;
  groupeId: string;
}

export interface ConfigGarde {
  /** Groupes dans l'ordre du tour. */
  groupes: GroupeGarde[];
  /** Groupe qui est de garde à partir de dateReference. */
  groupeReferenceId: string;
  /** AAAA-MM-JJ */
  dateReference: string;
  /** HH:MM — heure de changement de garde. */
  heureChangement: string;
  /** Durée d'une garde en jours (7 en général). */
  dureeJours: number;
  /** Corrections ponctuelles (programme officiel modifié une semaine). */
  exceptions: ExceptionGarde[];
}

export interface DonneesPharmacies {
  zone: string;
  pharmacies: Pharmacie[];
  garde: ConfigGarde;
}

export const CLE_PHARMACIES = "dg_pharmacies_zone";

export const DONNEES_VIDES: DonneesPharmacies = {
  zone: "",
  pharmacies: [],
  garde: {
    groupes: [],
    groupeReferenceId: "",
    dateReference: "",
    heureChangement: "08:00",
    dureeJours: 7,
    exceptions: [],
  },
};

/** Normalise des données reçues (anciennes versions, champs manquants…). */
export function normaliser(d: any): DonneesPharmacies {
  const g = d?.garde || {};
  return {
    zone: typeof d?.zone === "string" ? d.zone : "",
    pharmacies: Array.isArray(d?.pharmacies) ? d.pharmacies.filter((p: any) => p && typeof p.id === "string") : [],
    garde: {
      groupes: Array.isArray(g.groupes) ? g.groupes.filter((x: any) => x && typeof x.id === "string") : [],
      groupeReferenceId: typeof g.groupeReferenceId === "string" ? g.groupeReferenceId : "",
      dateReference: typeof g.dateReference === "string" ? g.dateReference : "",
      heureChangement: /^\d{2}:\d{2}$/.test(g.heureChangement || "") ? g.heureChangement : "08:00",
      dureeJours: Number.isInteger(g.dureeJours) && g.dureeJours >= 1 && g.dureeJours <= 31 ? g.dureeJours : 7,
      exceptions: Array.isArray(g.exceptions) ? g.exceptions.filter((e: any) => e && typeof e.debut === "string") : [],
    },
  };
}

/** Lecture locale (dernière version synchronisée sur ce poste) — pour l'ordonnance et WhatsApp. */
export function lirePharmaciesLocal(): DonneesPharmacies {
  try {
    const raw = localStorage.getItem(CLE_PHARMACIES);
    return raw ? normaliser(JSON.parse(raw)) : DONNEES_VIDES;
  } catch {
    return DONNEES_VIDES;
  }
}

// ─── Calcul du tour de garde ─────────────────────────────────────────────

const JOUR_MS = 24 * 3600 * 1000;

function dateLocale(jour: string, heure: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  const h = /^(\d{2}):(\d{2})$/.exec(heure) || ["", "08", "00"];
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(h[1]), Number(h[2]), 0, 0);
}

export function versJour(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface PeriodeGarde {
  debut: Date;
  fin: Date;
  groupe: GroupeGarde | null;
  pharmacies: Pharmacie[];
  /** true si la période a été corrigée à la main. */
  corrigee: boolean;
}

/** Le tour de garde est-il assez renseigné pour être calculé ? */
export function gardeConfiguree(d: DonneesPharmacies): boolean {
  const g = d.garde;
  return g.groupes.length > 0
    && g.groupes.some((x) => x.id === g.groupeReferenceId)
    && !!dateLocale(g.dateReference, g.heureChangement);
}

/**
 * Période de garde contenant la date donnée (décalage = 0), ou la suivante (1), la précédente (-1)…
 * Retourne null si le tour de garde n'est pas configuré.
 */
export function periodeDeGarde(d: DonneesPharmacies, date: Date = new Date(), decalage = 0): PeriodeGarde | null {
  if (!gardeConfiguree(d)) return null;
  const g = d.garde;
  const ref = dateLocale(g.dateReference, g.heureChangement)!;
  const n = g.groupes.length;
  const indexRef = g.groupes.findIndex((x) => x.id === g.groupeReferenceId);

  // Nombre de périodes écoulées depuis la référence (en jours calendaires, pour ignorer
  // d'éventuels changements d'heure), puis décalage demandé.
  const debutRef = ref.getTime();
  let k = Math.floor((date.getTime() - debutRef) / (g.dureeJours * JOUR_MS));
  k += decalage;

  const debut = new Date(ref);
  debut.setDate(ref.getDate() + k * g.dureeJours);
  const fin = new Date(debut);
  fin.setDate(debut.getDate() + g.dureeJours);

  const exception = g.exceptions.find((e) => e.debut === versJour(debut));
  let groupe: GroupeGarde | null = g.groupes[(((indexRef + k) % n) + n) % n] || null;
  let corrigee = false;
  if (exception) {
    const ge = g.groupes.find((x) => x.id === exception.groupeId);
    if (ge) {
      groupe = ge;
      corrigee = true;
    }
  }
  const pharmacies = groupe ? d.pharmacies.filter((p) => p.groupeId === groupe!.id) : [];
  return { debut, fin, groupe, pharmacies, corrigee };
}

// ─── Affichage ───────────────────────────────────────────────────────────

const FMT_JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const FMT_HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** « du samedi 24 octobre à 08:00 au samedi 31 octobre à 08:00 » */
export function libellePeriode(p: PeriodeGarde): string {
  return `du ${FMT_JOUR.format(p.debut)} à ${FMT_HEURE.format(p.debut)} au ${FMT_JOUR.format(p.fin)} à ${FMT_HEURE.format(p.fin)}`;
}

export function telephones(p: Pharmacie): string {
  return [p.telephone, p.telephone2].filter(Boolean).join(" / ");
}

/** Lien d'itinéraire (Google Maps), ou null. */
export function lienItineraire(p: Pharmacie): string | null {
  if (typeof p.lat === "number" && typeof p.lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  }
  if (p.lienMaps && /^https:\/\//i.test(p.lienMaps)) return p.lienMaps;
  return null;
}

/**
 * Lit une position saisie : « 11.1771, -4.2979 », ou un lien Google Maps contenant
 * des coordonnées (…@11.1771,-4.2979… ou …q=11.1771,-4.2979…).
 * Retourne { lat, lng } si trouvé, sinon { lien } si c'est un lien https, sinon null.
 */
export function lirePosition(texte: string): { lat: number; lng: number } | { lien: string } | null {
  const t = texte.trim();
  if (!t) return null;
  const m = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/.exec(t);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  if (/^https:\/\/\S+$/i.test(t) && t.length <= 500) return { lien: t };
  return null;
}

/** Texte de la garde, pour WhatsApp ou un partage. */
export function texteGarde(d: DonneesPharmacies, p: PeriodeGarde, avecTitre = true): string {
  const lignes: string[] = [];
  if (avecTitre) lignes.push(`💊 *Pharmacie${p.pharmacies.length > 1 ? "s" : ""} de garde${d.zone ? " — " + d.zone : ""}*`);
  lignes.push(`(${libellePeriode(p)})`);
  if (p.pharmacies.length === 0) {
    lignes.push(`${p.groupe ? p.groupe.nom + " : " : ""}aucune pharmacie enregistrée pour ce groupe.`);
  }
  p.pharmacies.forEach((ph) => {
    const details = [ph.quartier, telephones(ph) && `☎ ${telephones(ph)}`].filter(Boolean).join(" — ");
    lignes.push(`• ${ph.nom}${details ? " — " + details : ""}`);
    const lien = lienItineraire(ph);
    if (lien) lignes.push(`  📍 ${lien}`);
  });
  return lignes.join("\n");
}

/** Échappe un texte pour l'insérer dans une page HTML imprimée. */
export function echapperHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Bloc HTML « pharmacie de garde » pour le bas de l'ordonnance (vide si non configuré). */
export function blocGardeHtml(d: DonneesPharmacies = lirePharmaciesLocal(), date = new Date()): string {
  const p = periodeDeGarde(d, date);
  if (!p || p.pharmacies.length === 0) return "";
  const lignes = p.pharmacies
    .map((ph) => `<div style="margin:2px 0"><strong>${echapperHtml(ph.nom)}</strong>${ph.quartier ? " — " + echapperHtml(ph.quartier) : ""}${telephones(ph) ? " — Tél : " + echapperHtml(telephones(ph)) : ""}${ph.horaires ? ` <span style="color:#78716c">(${echapperHtml(ph.horaires)})</span>` : ""}</div>`)
    .join("");
  return `<div style="margin-top:30px;padding:10px 14px;border:1px solid #0d9488;border-radius:8px;font-size:12px;page-break-inside:avoid">
    <div style="font-weight:bold;color:#0d9488;text-transform:uppercase;font-size:11px;letter-spacing:.5px;margin-bottom:4px">Pharmacie${p.pharmacies.length > 1 ? "s" : ""} de garde${d.zone ? " — " + echapperHtml(d.zone) : ""}</div>
    <div style="color:#57534e;font-size:11px;margin-bottom:4px">${echapperHtml(libellePeriode(p))}</div>
    ${lignes}
  </div>`;
}

/** Données publiées pour le portail patient (sans remarques internes). */
export function donneesPubliques(d: DonneesPharmacies) {
  return {
    zone: d.zone,
    garde: d.garde,
    pharmacies: d.pharmacies.map(({ remarques: _r, ...reste }) => reste),
  };
}
