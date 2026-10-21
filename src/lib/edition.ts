/*
 * ÉDITIONS DE L'APPLICATION
 *
 *  • « cabinet » (par défaut) : l'application réelle du Cabinet Privé de Soins DEO-GRACIAS,
 *    reliée à sa base de données (activation de l'appareil + PIN des agents).
 *  • « demo » (VITE_EDITION=demo) : version de DÉMONSTRATION destinée à la vente (Google Play).
 *      - aucune base de données en ligne : tout reste sur l'appareil, impossible d'atteindre
 *        les données du cabinet ;
 *      - clinique fictive, agents et patients fictifs déjà saisis ;
 *      - assistants IA désactivés (réservés à la version complète) ;
 *      - bandeau « Version de démonstration · Acheter ».
 *  • « commercial » (VITE_EDITION=commercial) : l'application vendue « Santé Intégré 2.2 » (Google Play).
 *    Au premier lancement, la personne choisit :
 *      - « Essayer la démonstration » → mode démo ci-dessus ;
 *      - « Se connecter à ma clinique » → mode CLINIQUE (SaaS) : la clinique cliente se connecte
 *        avec son compte ; ses données vont dans SON espace de la base commerciale
 *        (cliniques/<id>/…), jamais visible des autres cliniques ; accès coupé par le serveur
 *        quand l'abonnement est expiré ou suspendu (voir firestore.commercial.rules).
 *  Le nom du cabinet dans les écrans et les impressions est remplacé à la construction
 *  (voir vite.config.ts) pour les éditions demo et commercial.
 */
import type { ClinicProfile, Staff, Medicament, Consultation, RendezVous } from "../types";

export const BUILD: "cabinet" | "demo" | "commercial" =
  import.meta.env.VITE_EDITION === "demo" ? "demo" : import.meta.env.VITE_EDITION === "commercial" ? "commercial" : "cabinet";
/** Éditions vendues (sans le nom du cabinet DEO-GRACIAS). */
export const COMMERCIAL: boolean = BUILD !== "cabinet";

const CLE_MODE = "si-mode";
function lireMode(): "demo" | "clinique" | null {
  if (BUILD === "demo") return "demo";
  if (BUILD !== "commercial") return null;
  try { const m = localStorage.getItem(CLE_MODE); return m === "demo" || m === "clinique" ? m : null; } catch { return null; }
}
/** Mode de l'application commerciale (null = pas encore choisi : écran d'accueil). */
export const MODE = lireMode();
export const DEMO: boolean = MODE === "demo";
/** Mode clinique cliente (abonnement, base commerciale). */
export const SAAS: boolean = MODE === "clinique";

/** Change de mode : efface d'abord les données de l'autre mode gardées sur l'appareil. */
export function choisirMode(m: "demo" | "clinique" | null) {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("dg_") || k.startsWith("deogracias") || k.startsWith("si-")).forEach((k) => localStorage.removeItem(k));
    if (m) localStorage.setItem(CLE_MODE, m);
  } catch { /* stockage indisponible */ }
  location.reload();
}

/**
 * Base de données COMMERCIALE (projet Firebase « sat formateur commercial ») : les cliniques clientes.
 * À remplir avec la configuration web du projet (console Firebase → Paramètres du projet → Vos applications).
 */
export const CONFIG_COMMERCIALE: Record<string, string> | null = {
  apiKey: "AIzaSyCNhKIJZaUt1gSjVXtdhtCJk-blfFDb8QM",
  authDomain: "sat-formateur-commercial.firebaseapp.com",
  projectId: "sat-formateur-commercial",
  storageBucket: "sat-formateur-commercial.firebasestorage.app",
  messagingSenderId: "924791333676",
  appId: "1:924791333676:web:3dd8b614e54a0d53560289",
};

/** Administrateur du SaaS : seul cet e-mail ouvre la console de gestion des cliniques. */
export const ADMIN_EMAILS: string[] = ["deograciasclinique@gmail.com"];
export const NOM_PRODUIT = "Système de Santé Intégré 2.2";

/** Contact commercial affiché dans la démo (bouton « Acheter la version complète »). */
export const CONTACT_VENTE = {
  nom: "Système de Santé Intégré — service commercial",
  whatsapp: "22676404327",
  telephone: "+226 76 40 43 27",
  message: "Bonjour, j'ai essayé la démonstration de Système de Santé Intégré 2.2 et je souhaite l'acheter pour ma clinique.",
};

export const DEMO_PROFIL: Partial<ClinicProfile> = {
  name: "Clinique Démo Santé",
  slogan: "Version de démonstration — données fictives",
  address: "Ouagadougou, Burkina Faso (adresse fictive)",
  phone: "+226 00 00 00 00",
  email: "contact@clinique-demo.bf",
  nif: "DÉMO",
  rccm: "DÉMO",
  stampText: "CACHET & SIGNATURE",
  ownerName: "Dr. Démo",
  capital: "—",
  bylawsText: "Statuts de démonstration : renseignez ici les statuts de votre établissement.",
};

/** Agents fictifs : chacun ouvre les modules de son poste. Responsable : PIN 0000. */
export const DEMO_AGENTS: Staff[] = [
  { id: "demo-1", nom: "Dr Awa KABORÉ", poste: "Médecin", contact: "70 00 00 01", horaire: "07h-15h", codeEntree: "1111" },
  { id: "demo-2", nom: "Issa OUÉDRAOGO", poste: "Infirmier", contact: "70 00 00 02", horaire: "07h-15h", codeEntree: "2222" },
  { id: "demo-3", nom: "Mariam SAWADOGO", poste: "Sage-femme", contact: "70 00 00 03", horaire: "07h-15h", codeEntree: "3333" },
  { id: "demo-4", nom: "Fatou TRAORÉ", poste: "Secrétaire (Secrétariat)", contact: "70 00 00 04", horaire: "07h-15h", codeEntree: "4444" },
  { id: "demo-5", nom: "Paul ZONGO", poste: "Laborantin", contact: "70 00 00 05", horaire: "07h-15h", codeEntree: "5555" },
  { id: "demo-6", nom: "Rasmata ILBOUDO", poste: "Pharmacien", contact: "70 00 00 06", horaire: "07h-15h", codeEntree: "6666" },
];

const jour = (d: number) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const maintenant = () => new Date().toISOString();

function medicaments(): Medicament[] {
  const m = (id: string, nom: string, forme: string, dosage: string, categorie: string, stock: number, seuil: number, achat: number, vente: number, mois: number): Medicament => ({
    id, nom, forme, dosage, categorie, stock, seuil, prixAchat: achat, prixVente: vente, peremption: jour(mois * 30), fournisseur: "Fournisseur démo", createdAt: maintenant(), typeArticle: "Médicament",
  });
  return [
    m("dm-1", "Paracétamol", "Comprimé", "500 mg", "Antalgique", 480, 100, 10, 25, 14),
    m("dm-2", "Amoxicilline", "Gélule", "500 mg", "Antibiotique", 220, 60, 35, 75, 10),
    m("dm-3", "Artéméther-Luméfantrine", "Comprimé", "20/120 mg", "Antipaludique", 36, 50, 600, 1200, 8),
    m("dm-4", "Ceftriaxone", "Injectable", "1 g", "Antibiotique", 40, 20, 450, 900, 12),
    m("dm-5", "Métronidazole", "Comprimé", "250 mg", "Antiparasitaire", 300, 80, 8, 20, 18),
    m("dm-6", "Sels de réhydratation orale", "Sachet", "20,5 g", "Réhydratation", 150, 40, 50, 100, 20),
    m("dm-7", "Fer + acide folique", "Comprimé", "200/0,4 mg", "Supplément", 260, 60, 5, 15, 16),
    m("dm-8", "Ibuprofène", "Comprimé", "400 mg", "Anti-inflammatoire", 18, 40, 12, 30, 11),
  ];
}

function consultations(): Consultation[] {
  const c = (id: string, patient: string, age: number, sexe: "Masculin" | "Féminin", d: number, plainte: string, diagnostic: string, ordonnance: Consultation["ordonnance"], statut: Consultation["statut"], vitals: Partial<Consultation["vitals"]>, extra: Partial<Consultation> = {}): Consultation => ({
    id, codePatient: "DEMO-" + id.slice(-3).toUpperCase(), patient, age, sexe, contact: "70 11 22 " + id.slice(-2), commune: "Ouagadougou",
    date: jour(d), medecinId: "demo-1", statut, montantConsultation: 2000,
    vitals: { temperature: 37, poids: 60, tensionArterielle: "12/8", pouls: 78, glycemie: 1, ...vitals },
    plainte, diagnostic, ordonnance, createdAt: maintenant(), agentCode: "1111", ...extra,
  });
  return [
    c("dc-101", "Salif COMPAORÉ", 34, "Masculin", 0, "Fièvre et céphalées depuis 3 jours, frissons", "Paludisme simple (TDR +)",
      [{ id: "o1", medicamentNom: "Artéméther-Luméfantrine 20/120 mg", posologie: "4 cp matin et soir", duree: "3 jours", medicamentId: "dm-3", quantitePrescrite: 24 },
       { id: "o2", medicamentNom: "Paracétamol 500 mg", posologie: "2 cp 3 fois par jour", duree: "3 jours", medicamentId: "dm-1", quantitePrescrite: 18 }],
      "Terminée", { temperature: 39.2, poids: 72, pouls: 98 }, { classementPalu: "PS", decision: "Retour à domicile", diagnosticFinal: "Paludisme simple" }),
    c("dc-102", "Aminata DIALLO", 26, "Féminin", 0, "Toux productive depuis 1 semaine", "Infection respiratoire aiguë",
      [{ id: "o3", medicamentNom: "Amoxicilline 500 mg", posologie: "2 gél. 2 fois par jour", duree: "7 jours", medicamentId: "dm-2", quantitePrescrite: 28 }],
      "Attente paiement actes", { temperature: 38.1, poids: 58 }),
    c("dc-103", "Boukary NIKIEMA", 7, "Masculin", 0, "Diarrhée et vomissements depuis hier", "Gastro-entérite, déshydratation légère",
      [{ id: "o4", medicamentNom: "Sels de réhydratation orale", posologie: "1 sachet après chaque selle", duree: "3 jours", medicamentId: "dm-6", quantitePrescrite: 10 }],
      "Attente consultation médecin", { temperature: 37.8, poids: 21, tensionArterielle: "10/6", pouls: 110 }),
    c("dc-104", "Clarisse YAMÉOGO", 45, "Féminin", -1, "Douleurs articulaires des genoux", "Arthrose des genoux",
      [{ id: "o5", medicamentNom: "Ibuprofène 400 mg", posologie: "1 cp 2 fois par jour après repas", duree: "5 jours", medicamentId: "dm-8", quantitePrescrite: 10 }],
      "Terminée", { poids: 81, tensionArterielle: "14/9" }, { decision: "Retour à domicile" }),
    c("dc-105", "Moussa SANOU", 52, "Masculin", -2, "Fièvre élevée, vomissements, grande fatigue", "Paludisme grave (TDR +)",
      [{ id: "o6", medicamentNom: "Ceftriaxone 1 g", posologie: "1 g IV par jour", duree: "5 jours", medicamentId: "dm-4", quantitePrescrite: 5 }],
      "Terminée", { temperature: 40.1, poids: 68, pouls: 120, tensionArterielle: "9/6" }, { classementPalu: "PG", decision: "Mise en observation", diagnosticFinal: "Paludisme grave" }),
    c("dc-106", "Nafissatou OUATTARA", 19, "Féminin", 0, "Nouvelle patiente, contrôle", "—", [], "Attente paiement consultation", {}),
  ];
}

function rendezVous(): RendezVous[] {
  const r = (id: string, patient: string, d: number, heure: string, type: string, motif: string, statut: RendezVous["statut"]): RendezVous => ({
    id, patient, date: jour(d), heure, contact: "70 22 33 " + id.slice(-2), type, praticien: "Dr Awa KABORÉ", motif, notes: "", statut, createdAt: maintenant(),
  });
  return [
    r("dr-201", "Salif COMPAORÉ", 3, "08:30", "Contrôle", "Contrôle après traitement du paludisme", "Planifié"),
    r("dr-202", "Clarisse YAMÉOGO", 1, "10:00", "Consultation", "Suivi de la tension", "Confirmé"),
    r("dr-203", "Aïcha KONÉ", 2, "09:00", "CPN", "Consultation prénatale (2e trimestre)", "Planifié"),
    r("dr-204", "Yacouba BARRY", 0, "15:30", "Consultation", "Douleurs abdominales", "Confirmé"),
  ];
}

/** Données de démonstration écrites au premier lancement (et après « Réinitialiser la démo »). */
export function donneesDemo(): Record<string, unknown> {
  return {
    dg_staff: DEMO_AGENTS,
    dg_pharma_stock: medicaments(),
    dg_consultations: consultations(),
    dg_rdv: rendezVous(),
  };
}

/** Efface toutes les données de la démo et repart des patients fictifs. */
export function reinitialiserDemo() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("dg_") || k.startsWith("deogracias")).forEach((k) => localStorage.removeItem(k));
  } catch { /* stockage indisponible */ }
  location.reload();
}

/** Profil de départ d'une clinique cliente (son nom vient de son compte). */
export function profilClinique(nom: string): Partial<ClinicProfile> {
  return {
    ...DEMO_PROFIL, name: nom || "Ma clinique", slogan: "", address: "", phone: "", email: "", nif: "", rccm: "",
    ownerName: "", capital: "", bylawsText: "",
  };
}

export function lienAchat(): string {
  return `https://wa.me/${CONTACT_VENTE.whatsapp}?text=${encodeURIComponent(CONTACT_VENTE.message)}`;
}
