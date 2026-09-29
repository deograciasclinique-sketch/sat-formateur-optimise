/**
 * Validité du reçu de consultation.
 *
 * Un reçu de consultation payé au secrétariat reste valable pendant
 * VALIDITE_RECU_JOURS jours (jour du paiement compris) : si le patient
 * revient pendant cette période, en consultation ou sur rendez-vous, la
 * consultation n'est pas facturée une nouvelle fois.
 */

import { Consultation, Facture } from "../types";

export const VALIDITE_RECU_JOURS = 14;

const normNom = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const tel8 = (s?: string) => (s || "").replace(/\D/g, "").slice(-8);

const ajouterJours = (iso: string, n: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  const m = d.getMonth() + 1, j = d.getDate();
  return `${d.getFullYear()}-${m < 10 ? "0" : ""}${m}-${j < 10 ? "0" : ""}${j}`;
};

const joursEntre = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);

export interface RecuConsultation {
  facture: Facture;
  consultationOrigine?: Consultation;
  patient: string;
  contact: string;
  payeLe: string;
  valableJusquau: string; // dernier jour de validité (inclus)
  joursRestants: number;  // 0 = dernier jour
  valide: boolean;
  visitesGratuites: Consultation[];
}

function versRecu(f: Facture, consultations: Consultation[], today: string): RecuConsultation {
  const origine = f.consultationId ? consultations.find((c) => c.id === f.consultationId) : undefined;
  const valableJusquau = ajouterJours(f.date, VALIDITE_RECU_JOURS - 1);
  const joursRestants = joursEntre(today, valableJusquau);
  return {
    facture: f,
    consultationOrigine: origine,
    patient: f.patient,
    contact: origine?.contact || "",
    payeLe: f.date,
    valableJusquau,
    joursRestants,
    valide: f.date <= today && joursRestants >= 0,
    visitesGratuites: consultations.filter((c) => c.recuConsultationId === f.id),
  };
}

const estRecuConsultation = (f: Facture) =>
  f.typePaiement === "Consultation" && f.statut === "Payée" && (f.total || 0) > 0;

/** Dernier reçu de consultation d'un patient (valide ou non), ou null. */
export function dernierRecu(
  factures: Facture[], consultations: Consultation[], nom: string, contact: string | undefined, today: string
): RecuConsultation | null {
  const n = normNom(nom);
  if (!n) return null;
  const t = tel8(contact);
  const recus = factures
    .filter(estRecuConsultation)
    .filter((f) => normNom(f.patient) === n)
    .map((f) => versRecu(f, consultations, today))
    .filter((r) => !t || !tel8(r.contact) || tel8(r.contact) === t)
    .sort((a, b) => (b.payeLe + b.facture.createdAt).localeCompare(a.payeLe + a.facture.createdAt));
  return recus[0] || null;
}

/** Reçu encore valable pour ce patient aujourd'hui, ou null. */
export function recuValide(
  factures: Facture[], consultations: Consultation[], nom: string, contact: string | undefined, today: string
): RecuConsultation | null {
  const r = dernierRecu(factures, consultations, nom, contact, today);
  return r && r.valide ? r : null;
}

/** Tous les patients ayant un reçu de consultation encore valable (le plus récent par patient). */
export function listeRecusValides(factures: Facture[], consultations: Consultation[], today: string): RecuConsultation[] {
  const debut = ajouterJours(today, -(VALIDITE_RECU_JOURS - 1));
  const parPatient = new Map<string, RecuConsultation>();
  factures
    .filter(estRecuConsultation)
    .filter((f) => f.date >= debut && f.date <= today)
    .map((f) => versRecu(f, consultations, today))
    .forEach((r) => {
      const k = `${normNom(r.patient)}|${tel8(r.contact)}`;
      const prev = parPatient.get(k);
      if (!prev || r.payeLe > prev.payeLe) parPatient.set(k, r);
    });
  return [...parPatient.values()].sort((a, b) => a.joursRestants - b.joursRestants || a.patient.localeCompare(b.patient, "fr"));
}

export const dateCourteFr = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
