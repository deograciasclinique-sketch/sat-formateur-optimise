/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Audit,
  ActionCorrective,
  Incident,
  Staff,
  Task,
  Medicament,
  MouvementStock,
  Facture,
  Depense,
  RendezVous,
  RhFiche,
  Conge,
  Absence,
  Hospitalisation,
  Evolution,
  Vaccination,
  ExamenLabo,
  Accouchement,
  Assureur,
  AdhesionPatient,
  PriseEnCharge,
  DocumentAdministratif,
  Consultation,
  ConsultationPrenatale,
  PatientUrgence,
  FichePediatrique,
  ClinicProfile
} from "./types";

export const DEFAULT_CLINIC_PROFILE: ClinicProfile = {
  name: "Cabinet Médical DEO-GRACIAS",
  slogan: "Excellence & Dévouement au Service de votre Santé",
  address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital",
  phone: "+226 20 97 12 34",
  email: "deograciasclinique@gmail.com",
  nif: "30009845X",
  rccm: "BF-BOB-2026-B-1402",
  currency: "FCFA",
  logoColor: "teal",
  stampText: "CACHET & SIGNATURE DEO-GRACIAS",
  logoUrl: "/logo-complet-fond-transparent.png",
  legalForm: "Cabinet Médical Privé (S.A.R.L.)",
  ownerName: "Dr. Deogracias",
  capital: "5 000 000 FCFA",
  taxRegime: "Régime Réel Simplifié",
  operatingStatus: "Actif",
  bylawsText: `STATUTS CONSTITUTIFS DE L'ÉTABLISSEMENT MÉDICAL

ARTICLE 1 : FORME JURIDIQUE & DENOMINATION
L'établissement est constitué sous la forme d'une Société à Responsabilité Limitée (S.A.R.L.) dénommée "Cabinet Médical DEO-GRACIAS".

ARTICLE 2 : OBJET SOCIAL
L'établissement a pour objet l'exploitation d'un cabinet médical pluridisciplinaire, de soins d'urgence, de surveillance pédiatrique, de suivi maternité/CPN, d'un laboratoire d'analyses médicales et d'un dépôt de pharmacie.

ARTICLE 3 : SIÈGE SOCIAL
Le siège social est fixé à : Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital, Burkina Faso.

ARTICLE 4 : CAPITAL SOCIAL
Le capital social est fixé à la somme de Cinq Millions (5 000 000) de Francs CFA, divisé en parts sociales détenues par l'associé unique gérant.

ARTICLE 5 : GERANCE & DIRECTION
La gérance et la direction médicale générale de l'établissement sont assurées par le Dr. Deogracias en sa qualité d'associé gérant fondateur.`
};

export const getClinicProfile = (): ClinicProfile => {
  return safeGet<ClinicProfile>("dg_clinic_profile", DEFAULT_CLINIC_PROFILE);
};


// Helper to generate UIDs
export const generateUid = (): string => {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
};

// Safe LocalStorage Fetch with fallbacks
export const safeGet = <T>(key: string, fallback: T): T => {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    console.error("Error reading key " + key, e);
    return fallback;
  }
};

// Safe LocalStorage Set
export const safeSet = <T>(key: string, val: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("Error writing key " + key, e);
  }
};

// Default Date Helper (YYYY-MM-DD)
export const getTodayStr = (): string => new Date().toISOString().slice(0, 10);

export const getTodayFr = (): string => {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

// Criterion for quality control
export interface QualityCriterion {
  id: string;
  cat: string;
  label: string;
  note: string;
}

export const QUALITY_CRITERIA: QualityCriterion[] = [
  { id: "a1", cat: "A — Accueil & prise en charge", label: "Accueil du patient dans les 10 minutes", note: "Délai de prise en charge initial" },
  { id: "a2", cat: "A — Accueil & prise en charge", label: "Identification correcte du patient (nom, âge, dossier)", note: "" },
  { id: "a3", cat: "A — Accueil & prise en charge", label: "Triage et évaluation de la priorité réalisés", note: "Urgences identifiées et traitées en premier" },
  { id: "b1", cat: "B — Dossier clinique", label: "Dossier clinique complet et lisible", note: "Tous les champs obligatoires remplis" },
  { id: "b2", cat: "B — Dossier clinique", label: "Anamnèse complète documentée", note: "Motif, histoire, antécédents" },
  { id: "b3", cat: "B — Dossier clinique", label: "Examen clinique complet (4 étapes par appareil)", note: "Obs/Palp/Perc/Ausc" },
  { id: "b4", cat: "B — Dossier clinique", label: "Hypothèse diagnostique formulée et documentée", note: "" },
  { id: "b5", cat: "B — Dossier clinique", label: "Conduite à tenir clairement indiquée", note: "" },
  { id: "c1", cat: "C — Qualité des soins", label: "Soins réalisés conformément à la prescription", note: "" },
  { id: "c2", cat: "C — Qualité des soins", label: "Hygiène des mains respectée (avant/après soins)", note: "Friction ou lavage" },
  { id: "c3", cat: "C — Qualité des soins", label: "Matériel stérile ou à usage unique utilisé", note: "" },
  { id: "c4", cat: "C — Qualité des soins", label: "Surveillance post-soin documentée", note: "Constantes, évolution" },
  { id: "d1", cat: "D — Communication & éducation", label: "Patient informé de son diagnostic et traitement", note: "Consentement éclairé" },
  { id: "d2", cat: "D — Communication & éducation", label: "Conseils hygiéno-diététiques donnés", note: "" },
  { id: "d3", cat: "D — Communication & éducation", label: "Rendez-vous de suivi planifié", note: "" },
  { id: "e1", cat: "E — Environnement & sécurité", label: "Local propre et ordonné pendant la consultation", note: "" },
  { id: "e2", cat: "E — Environnement & sécurité", label: "Confidentialité préservée", note: "Pas d'autres patients présents" },
  { id: "e3", cat: "E — Environnement & sécurité", label: "Élimination correcte des déchets (tri, conteneurs)", note: "" }
];

// INITIAL SEED DATA
const defaultStaff: Staff[] = [];

const defaultMedicaments: Medicament[] = [];

const defaultAssureurs: Assureur[] = [];

const defaultAdhesions: AdhesionPatient[] = [];

const defaultTasks: Task[] = [];

const defaultConsultations: Consultation[] = [];

const defaultPediatrie: FichePediatrique[] = [];

const defaultMaterniteCpn: ConsultationPrenatale[] = [];

const defaultRendezVous: RendezVous[] = [];

const defaultHospitalisations: Hospitalisation[] = [];

const defaultEvolutions: Evolution[] = [];

const defaultInvoices: Facture[] = [];

const defaultDepenses: Depense[] = [];

const defaultIncidents: Incident[] = [];

const defaultActions: ActionCorrective[] = [];

const defaultAudits: Audit[] = [];

const defaultPec: PriseEnCharge[] = [];

const defaultUrgences: PatientUrgence[] = [];

const defaultVaccinations: Vaccination[] = [];

const defaultExamenLabo: ExamenLabo[] = [];

// Initialize all LocalStorage values if not seeded
export const seedLocalStorage = (force = false): void => {
  const checkAndSeed = (key: string, defaultValue: any) => {
    if (!localStorage.getItem(key) || force) {
      safeSet(key, defaultValue);
    }
  };

  checkAndSeed("dg_staff", defaultStaff);
  checkAndSeed("dg_pharma_stock", defaultMedicaments);
  checkAndSeed("dg_pharma_mouvements", []);
  checkAndSeed("dg_assureurs", defaultAssureurs);
  checkAndSeed("dg_assures", defaultAdhesions);
  checkAndSeed("dg_tasks", defaultTasks);
  checkAndSeed("dg_consultations", defaultConsultations);
  checkAndSeed("dg_pediatrie", defaultPediatrie);
  checkAndSeed("dg_maternite_cpn", defaultMaterniteCpn);
  checkAndSeed("dg_maternite_accouchements", []);
  checkAndSeed("dg_rdv", defaultRendezVous);
  checkAndSeed("dg_hosp_capacite", 20);
  checkAndSeed("dg_hospitalisations", defaultHospitalisations);
  checkAndSeed("dg_hosp_evolutions", defaultEvolutions);
  checkAndSeed("dg_factures", defaultInvoices);
  checkAndSeed("dg_depenses", defaultDepenses);
  checkAndSeed("dg_incidents", defaultIncidents);
  checkAndSeed("dg_actions", defaultActions);
  checkAndSeed("dg_audits", defaultAudits);
  checkAndSeed("dg_audit_current", {});
  checkAndSeed("dg_conges", []);
  checkAndSeed("dg_absences", []);
  checkAndSeed("dg_rh", []);
  checkAndSeed("dg_prises_charge", defaultPec);
  checkAndSeed("dg_urgences", defaultUrgences);
  checkAndSeed("dg_vaccinations", defaultVaccinations);
  checkAndSeed("dg_labo_examens", defaultExamenLabo);
  checkAndSeed("dg_documents", []);
};

// Robust staff data migration helper to ensure default PINs are populated
export function migrateStaff(items: any[]): Staff[] {
  if (!Array.isArray(items) || items.length === 0) {
    return defaultStaff;
  }
  const defaultCodes: Record<string, string> = {
    "st-1": "1111",
    "st-2": "2222",
    "st-3": "3333",
    "st-4": "4444",
    "st-5": "5555",
    "st-6": "6666"
  };
  return items.map((item) => {
    const updated = { ...item };
    if (!updated.codeEntree && defaultCodes[updated.id]) {
      updated.codeEntree = defaultCodes[updated.id];
    }
    if (updated.id === "st-6" && updated.poste === "Agent d'accueil") {
      updated.poste = "Secrétaire (Secrétariat)";
    }
    return updated as Staff;
  });
}

// Robust clinical data migration helper functions to fix any old data stored in user's browser
export function migrateConsultations(items: any[]): Consultation[] {
  if (!Array.isArray(items)) return [];
  return items.map((c) => {
    if (c && c.vitals && Array.isArray(c.ordonnance)) {
      return c as Consultation;
    }
    return {
      id: c.id || generateUid(),
      patient: c.patient || "Patient Inconnu",
      age: parseFloat(c.age) || 0,
      sexe: (c.sexe === "Féminin" || c.sexe === "F" ? "Féminin" : "Masculin"),
      contact: c.contact || "",
      date: c.date || getTodayStr(),
      medecinId: c.medecin || "st-1",
      vitals: {
        temperature: parseFloat(c.temperature) || 37,
        poids: parseFloat(c.poids) || 70,
        tensionArterielle: c.tension || "120/80",
        pouls: parseFloat(c.pouls) || 80,
        glycemie: 1.0
      },
      plainte: c.plainte || c.motif || "Consultation médicale",
      examenPhysique: c.examen || c.examenPhysique || "",
      diagnostic: c.diagnostic || "A préciser",
      ordonnance: Array.isArray(c.ordonnance) ? c.ordonnance : (c.prescription ? [
        { id: generateUid(), medicamentNom: c.prescription, posologie: "A suivre", duree: "3 jours" }
      ] : []),
      createdAt: c.createdAt || new Date().toISOString()
    };
  });
}

export function migrateMaterniteCpns(items: any[]): ConsultationPrenatale[] {
  if (!Array.isArray(items)) return [];
  return items.map((c) => {
    if (c && c.patient && c.dateVisite) {
      return c as ConsultationPrenatale;
    }
    return {
      id: c.id || generateUid(),
      patient: c.patient || c.patiente || "Patiente Inconnu",
      contact: c.contact || "",
      ddr: c.ddr || getTodayStr(),
      sa: parseFloat(c.sa) || 28,
      dpa: c.dpa || c.dap || getTodayStr(),
      dateVisite: c.dateVisite || c.dateCpn || c.date || getTodayStr(),
      numeroVisite: (c.numeroVisite || (c.numeroCpn === "3ème CPN" ? "CPN 3" : "CPN 1")) as any,
      poids: parseFloat(c.poids) || 60,
      ta: c.ta || c.tension || "110/70",
      albuminurie: c.albuminurie || "Négative",
      ferAcideFolique: c.ferAcideFolique !== undefined ? c.ferAcideFolique : true,
      mild: c.mild !== undefined ? c.mild : true,
      agentId: c.agentId || c.agent || "st-2",
      notes: c.notes || c.observations || "",
      createdAt: c.createdAt || new Date().toISOString()
    };
  });
}

export function migrateUrgences(items: any[]): PatientUrgence[] {
  if (!Array.isArray(items)) return [];
  return items.map((u) => {
    if (u && u.patient && u.severite && u.constantes) {
      return u as PatientUrgence;
    }
    let sev: "Urgence Vitale (Rouge)" | "Très Urgent (Orange)" | "Urgent (Jaune)" | "Non Urgent (Vert)" = "Urgent (Jaune)";
    const triageLower = (u.triage || u.severite || "").toLowerCase();
    if (triageLower.includes("rouge") || triageLower.includes("vitale") || triageLower.includes("niveau 1")) {
      sev = "Urgence Vitale (Rouge)";
    } else if (triageLower.includes("orange") || triageLower.includes("très") || triageLower.includes("niveau 2")) {
      sev = "Très Urgent (Orange)";
    } else if (triageLower.includes("jaune") || triageLower.includes("urg") || triageLower.includes("niveau 3")) {
      sev = "Urgent (Jaune)";
    } else if (triageLower.includes("vert") || triageLower.includes("non") || triageLower.includes("niveau 4")) {
      sev = "Non Urgent (Vert)";
    }

    let stat: "En attente de médecin" | "Examen clinique en cours" | "Sous surveillance infirmière" | "Sorti(e) ou Libéré(e)" = "En attente de médecin";
    const statusLower = (u.statut || "").toLowerCase();
    if (statusLower.includes("sorti") || statusLower.includes("libéré") || statusLower.includes("termine")) {
      stat = "Sorti(e) ou Libéré(e)";
    } else if (statusLower.includes("surveillance") || statusLower.includes("observation")) {
      stat = "Sous surveillance infirmière";
    } else if (statusLower.includes("examen") || statusLower.includes("cours")) {
      stat = "Examen clinique en cours";
    }

    const consts = `TA: ${u.tension || "120/80"}, Temp: ${u.temperature || "37"}°C, Pouls: ${u.pouls || "80"} bpm, Sat: ${u.saturation || "98"}%`;

    return {
      id: u.id || generateUid(),
      patient: u.patient || "Patient Inconnu",
      contact: u.contact || "",
      severite: sev,
      plainte: u.plainte || u.motif || "Motif non précisé",
      constantes: u.constantes || consts,
      medecinId: u.medecinId || u.medecin || "st-1",
      dateArrivee: u.dateArrivee || u.date || getTodayStr(),
      heureArrivee: u.heureArrivee || "08:00",
      statut: stat,
      createdAt: u.createdAt || new Date().toISOString()
    };
  });
}

export function migratePediatrie(items: any[]): FichePediatrique[] {
  if (!Array.isArray(items)) return [];
  return items.map((p) => {
    if (p && p.patient && typeof p.ageMois === "number") {
      return p as FichePediatrique;
    }
    let ageM = 12;
    if (p.dateNaissance) {
      const birth = new Date(p.dateNaissance);
      const now = new Date();
      ageM = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
      if (ageM < 0) ageM = 0;
    }

    return {
      id: p.id || generateUid(),
      patient: p.patient || p.enfant || "Enfant Inconnu",
      ageMois: ageM,
      contact: p.contact || "",
      poids: parseFloat(p.poids) || 8,
      taille: parseFloat(p.taille) || 75,
      pb: parseFloat(p.pb) || 12,
      oedemes: p.oedemes === "Oui" || p.oedemes === true,
      statutNutritionnel: p.statutNutritionnel || "Normal",
      vaccinsAJour: p.vaccinAJour === "Oui" || p.vaccinsAJour === true,
      alimentation: p.alimentation || p.traitement || "Normal",
      consultant: p.consultant || p.agentNom || "Pédiatre",
      diagnostic: p.diagnostic || "Suivi",
      date: p.date || p.dateConsult || getTodayStr(),
      createdAt: p.createdAt || new Date().toISOString()
    };
  });
}
