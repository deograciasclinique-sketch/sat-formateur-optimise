/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Validation + nettoyage de CHAQUE champ reçu par les routes /api, avant tout usage.
// Règle : on ne garde que les champs attendus (liste blanche), avec le bon type et
// une taille raisonnable. Tout le reste est rejeté ou ignoré.

import { ErreurPublique } from "./securite.js";

// Caractères de contrôle (sauf tabulation / retour à la ligne), caractères invisibles
// et caractères d'inversion de sens d'écriture (utilisés pour masquer du texte).
const CARACTERES_INTERDITS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// Balises HTML / scripts (« <script> », « <img onerror=…> », « </div> »…).
// « TA<90 » ou « 3 < 5 » ne sont pas touchés (pas de lettre juste après « < »).
// Uniquement de vraies balises fermées (« <b> », « <img …> ») : un texte comme « Glycémie<Normale »
// ou « TA<90 » n'est plus coupé.
const BALISES = /<\/?[a-zA-Z!?][^<>]*>/g;

/** Nettoie un texte libre. Retourne une chaîne (éventuellement vide). */
export function nettoyerTexte(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "string" && typeof v !== "number") return "";
  return String(v)
    .normalize("NFC")
    .replace(CARACTERES_INTERDITS, "")
    .replace(BALISES, "")
    .replace(/<(?=[a-zA-Z!?\/])/g, "‹")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function texte(v: unknown, nomChamp: string, max: number, obligatoire = false): string {
  if (v !== null && v !== undefined && typeof v !== "string" && typeof v !== "number") {
    throw new ErreurPublique(`Le champ « ${nomChamp} » n'est pas valide.`);
  }
  const t = nettoyerTexte(v);
  if (obligatoire && !t) throw new ErreurPublique(`Le champ « ${nomChamp} » est obligatoire.`);
  if (t.length > max) throw new ErreurPublique(`Le champ « ${nomChamp} » est trop long (${max} caractères maximum).`);
  return t;
}

function nombre(v: unknown, nomChamp: string, min: number, max: number, entier = true): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < min || n > max || (entier && !Number.isInteger(n))) {
    throw new ErreurPublique(`Le champ « ${nomChamp} » doit être un nombre entre ${min} et ${max}.`);
  }
  return n;
}

function objet(v: unknown, nomChamp: string): Record<string, unknown> {
  if (v === null || v === undefined) return {};
  if (typeof v !== "object" || Array.isArray(v)) throw new ErreurPublique(`Le champ « ${nomChamp} » n'est pas valide.`);
  return v as Record<string, unknown>;
}

const GRAND = 1_000_000;

// ─── /api/gemini/compliance ─────────────────────────────────────────────────
const CHAMPS_MANQUANTS = [
  "patient", "age", "sexe", "contact", "temperature", "tensionArterielle",
  "poids", "pouls", "glycemie", "plainte", "diagnostic", "ordonnance",
] as const;

export function validerCompliance(body: unknown) {
  const b = objet(body, "requête");
  const manquants = objet(b.missingFieldsSummary, "champs manquants");
  const missingFieldsSummary: Record<string, number> = {};
  for (const k of CHAMPS_MANQUANTS) {
    if (k in manquants) missingFieldsSummary[k] = nombre(manquants[k], k, 0, GRAND);
  }
  const m = objet(b.additionalMetrics, "indicateurs");
  return {
    totalConsultations: nombre(b.totalConsultations, "total consultations", 0, GRAND),
    completeDossiers: nombre(b.completeDossiers, "dossiers complets", 0, GRAND),
    incompleteDossiers: nombre(b.incompleteDossiers, "dossiers incomplets", 0, GRAND),
    completenessRate: nombre(b.completenessRate, "taux de complétude", 0, 100, false),
    missingFieldsSummary,
    additionalMetrics: {
      recentAuditsCount: nombre(m.recentAuditsCount, "audits", 0, GRAND),
      lastAuditScore: nombre(m.lastAuditScore, "score d'audit", 0, 100, false),
      incidentsCount: nombre(m.incidentsCount, "incidents", 0, GRAND),
      activeCorrectiveActions: nombre(m.activeCorrectiveActions, "actions correctives", 0, GRAND),
    },
  };
}

// ─── /api/app-optimize ──────────────────────────────────────────────────────
const CHAMPS_STATS = [
  "totalConsultations", "totalMedicaments", "lowStockCount", "totalFactures", "totalStaff",
  "totalTasks", "totalUrgences", "totalHospitalisations",
] as const;

export function validerOptimisation(body: unknown) {
  const b = objet(body, "requête");
  const s = objet(b.clinicStats, "statistiques");
  const clinicStats: Record<string, number> = {};
  for (const k of CHAMPS_STATS) clinicStats[k] = nombre(s[k], k, 0, GRAND);
  // Montants en FCFA : peuvent être grands, mais restent bornés.
  clinicStats.totalRevenues = nombre(s.totalRevenues, "revenus", 0, 1e13, false);
  clinicStats.totalDepenses = nombre(s.totalDepenses, "dépenses", 0, 1e13, false);
  return { clinicStats };
}

// ─── /api/gemini/consultation-assistant ─────────────────────────────────────
const CONSTANTES = ["temperature", "poids", "taille", "tension", "pouls", "glycemie"] as const;

export function validerConsultation(body: unknown) {
  const b = objet(body, "requête");
  const plainte = texte(b.plainte, "plainte", 2000);
  const notes = texte(b.notes, "notes d'examen", 6000);
  if (!plainte && !notes) throw new ErreurPublique("Renseignez la plainte du patient et/ou les notes d'examen clinique.");
  const c = objet(b.constantes, "constantes");
  const constantes: Record<string, string> = {};
  for (const k of CONSTANTES) {
    const v = texte(c[k], k, 20);
    if (v) constantes[k] = v;
  }
  return {
    plainte,
    notes,
    constantes,
    age: texte(b.age, "âge", 30),
    sexe: texte(b.sexe, "sexe", 20),
  };
}

// ─── /api/gemini/lab-procedure ──────────────────────────────────────────────
export function validerProcedureLabo(body: unknown) {
  const b = objet(body, "requête");
  return { examen: texte(b.examen, "examen", 200, true) };
}
