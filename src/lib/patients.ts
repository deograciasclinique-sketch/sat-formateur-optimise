/**
 * Registre des patients du service : chaque patient est enregistré UNE seule
 * fois et reçoit un code patient (ex : DG-7K3PM). À chaque nouvelle visite,
 * le code suffit pour le retrouver, pré-remplir son identité et rattacher la
 * visite à son dossier (consultations, hospitalisations, factures…).
 *
 * Le registre est synchronisé entre tous les appareils (clé "dg_patients").
 */

import { Consultation } from "../types";

export interface PatientRegistre {
  code: string;          // ex : "DG-7K3PM"
  nom: string;           // nom complet tel qu'utilisé dans les dossiers
  sexe?: "Masculin" | "Féminin";
  anneeNaissance?: number; // déduite de l'âge à l'enregistrement : l'âge se met à jour tout seul
  dateNaissance?: string;
  contact?: string;
  commune?: string;
  villageSecteur?: string;
  profession?: string;
  zoneResidence?: string;
  createdAt: string;
  updatedAt?: string;
  origine?: "accueil" | "dossiers existants";
}

export const normNom = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const tel8 = (s?: string) => (s || "").replace(/\D/g, "").slice(-8);

// Lettres et chiffres faciles à lire et à recopier (sans 0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const PREFIXE = "DG-";
const LONGUEUR = 5;

/** Met un code saisi au propre : « dg 7k3pm » → « DG-7K3PM ». */
export function normaliserCode(saisie: string): string {
  const brut = (saisie || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const corps = brut.startsWith("DG") ? brut.slice(2) : brut;
  return corps ? PREFIXE + corps : "";
}

export function estUnCode(saisie: string): boolean {
  const c = normaliserCode(saisie).slice(PREFIXE.length);
  return c.length === LONGUEUR && [...c].every((x) => ALPHABET.includes(x));
}

/** Nouveau code au hasard, jamais déjà utilisé. */
export function nouveauCode(existants: Set<string>): string {
  for (;;) {
    let c = "";
    const alea = new Uint32Array(LONGUEUR);
    crypto.getRandomValues(alea);
    alea.forEach((n) => { c += ALPHABET[n % ALPHABET.length]; });
    const code = PREFIXE + c;
    if (!existants.has(code)) return code;
  }
}

/**
 * Code calculé à partir du nom et du téléphone. Utilisé pour les dossiers
 * qui existaient avant le registre : chaque appareil obtient le MÊME code
 * pour le même patient, sans risque de doublon entre appareils.
 */
export function codeDeterministe(nom: string, contact: string | undefined, existants: Map<string, PatientRegistre>): string {
  const base = `${normNom(nom)}|${tel8(contact)}`;
  for (let essai = 0; ; essai++) {
    // FNV-1a 32 bits
    let h = 0x811c9dc5;
    const s = essai ? `${base}#${essai}` : base;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    let c = "";
    for (let i = 0; i < LONGUEUR; i++) { c += ALPHABET[h % ALPHABET.length]; h = Math.floor(h / ALPHABET.length); }
    const code = PREFIXE + c;
    const deja = existants.get(code);
    if (!deja || cleIdentite(deja.nom, deja.contact) === cleIdentite(nom, contact)) return code;
  }
}

export const cleIdentite = (nom: string, contact?: string) => `${normNom(nom)}|${tel8(contact)}`;

/** Âge actuel (en années) d'après l'année ou la date de naissance. */
export function ageActuel(p: PatientRegistre, aujourdhui = new Date()): number | undefined {
  if (p.dateNaissance) {
    const d = new Date(p.dateNaissance + "T00:00:00");
    if (!isNaN(d.getTime())) {
      let a = aujourdhui.getFullYear() - d.getFullYear();
      const m = aujourdhui.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && aujourdhui.getDate() < d.getDate())) a--;
      return Math.max(0, a);
    }
  }
  if (p.anneeNaissance) return Math.max(0, aujourdhui.getFullYear() - p.anneeNaissance);
  return undefined;
}

export function anneeDepuisAge(age?: number, aujourdhui = new Date()): number | undefined {
  if (age === undefined || age === null || isNaN(age) || age <= 0) return undefined;
  return aujourdhui.getFullYear() - Math.floor(age);
}

/** Recherche par code, nom ou téléphone (les codes exacts d'abord). */
export function chercherPatients(registre: PatientRegistre[], saisie: string, max = 8): PatientRegistre[] {
  const q = saisie.trim();
  if (q.length < 2) return [];
  const code = normaliserCode(q);
  const exact = registre.filter((p) => p.code === code);
  if (exact.length) return exact;
  const n = normNom(q);
  const chiffres = q.replace(/\D/g, "");
  return registre
    .filter((p) =>
      (code.length > PREFIXE.length + 1 && p.code.startsWith(code)) ||
      normNom(p.nom).includes(n) ||
      (chiffres.length >= 4 && tel8(p.contact).includes(chiffres))
    )
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))
    .slice(0, max);
}

/** Patients probablement identiques (même nom, et même téléphone s'il y en a un). */
export function doublonsPossibles(registre: PatientRegistre[], nom: string, contact?: string): PatientRegistre[] {
  const n = normNom(nom);
  const t = tel8(contact);
  if (!n) return [];
  return registre.filter((p) => normNom(p.nom) === n && (!t || !tel8(p.contact) || tel8(p.contact) === t));
}

/**
 * Rattache au registre les consultations qui n'ont pas encore de code
 * (dossiers créés avant le registre, ou visites créées depuis un RDV, les
 * urgences…). Renvoie le registre complété et les consultations à jour, ou
 * null si rien n'a changé.
 */
export function rattacherConsultations(
  registre: PatientRegistre[],
  consultations: Consultation[]
): { registre: PatientRegistre[]; consultations: Consultation[] } | null {
  const sansCode = consultations.filter((c) => !c.codePatient && normNom(c.patient));
  if (sansCode.length === 0) return null;

  registre = registre.map((p) => ({ ...p })); // ne jamais modifier l'état d'origine
  const parCode = new Map(registre.map((p) => [p.code, p]));
  const parIdentite = new Map<string, PatientRegistre>();
  const parNom = new Map<string, PatientRegistre[]>();
  registre.forEach((p) => {
    parIdentite.set(cleIdentite(p.nom, p.contact), p);
    const n = normNom(p.nom);
    parNom.set(n, [...(parNom.get(n) || []), p]);
  });

  const nouveaux: PatientRegistre[] = [];
  const codeDe = new Map<string, string>(); // id consultation -> code

  // Les plus anciennes d'abord : la première visite fixe l'identité.
  [...sansCode].sort((a, b) => (a.createdAt || a.date || "").localeCompare(b.createdAt || b.date || "")).forEach((c) => {
    const t = tel8(c.contact);
    let p = parIdentite.get(cleIdentite(c.patient, c.contact));
    if (!p) {
      // Même nom : on rattache si les téléphones ne se contredisent pas.
      const memesNoms = parNom.get(normNom(c.patient)) || [];
      const compatibles = memesNoms.filter((x) => !t || !tel8(x.contact) || tel8(x.contact) === t);
      if (compatibles.length === 1) p = compatibles[0];
    }
    if (!p) {
      const code = codeDeterministe(c.patient, c.contact, parCode);
      p = {
        code, nom: c.patient.trim(), sexe: c.sexe, anneeNaissance: anneeDepuisAge(c.age, new Date(c.date || Date.now())),
        contact: c.contact || undefined, commune: c.commune || undefined, villageSecteur: c.villageSecteur, profession: c.profession,
        zoneResidence: c.zoneResidence, createdAt: c.createdAt || new Date().toISOString(), origine: "dossiers existants",
      };
      nouveaux.push(p);
      parCode.set(code, p);
      parIdentite.set(cleIdentite(p.nom, p.contact), p);
      const n = normNom(p.nom);
      parNom.set(n, [...(parNom.get(n) || []), p]);
    } else if (!p.contact && t) {
      p.contact = c.contact;
      parIdentite.set(cleIdentite(p.nom, p.contact), p);
    }
    codeDe.set(c.id, p.code);
  });

  const registreFinal = nouveaux.length ? [...registre, ...nouveaux] : [...registre];
  return {
    registre: registreFinal,
    consultations: consultations.map((c) => (codeDe.has(c.id) ? { ...c, codePatient: codeDe.get(c.id) } : c)),
  };
}
