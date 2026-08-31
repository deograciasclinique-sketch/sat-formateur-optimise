/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Audit {
  id: string;
  date: string;
  dateFr?: string;
  score: number;
  realise: string;
  scores: Record<string, number>;
}

export interface ActionCorrective {
  id: string;
  probleme: string;
  action: string;
  responsable: string;
  echeance: string;
  priorite: "Haute" | "Normale" | "Basse";
  statut: "En cours" | "Réalisée" | "Annulée";
  date: string;
}

export interface Incident {
  id: string;
  date: string;
  type: string;
  gravite: "faible" | "modere" | "grave" | "critique";
  personnel: string;
  description: string;
  mesures: string;
}

export interface Staff {
  id: string;
  nom: string;
  poste: string;
  contact: string;
  horaire: string;
  codeEntree?: string;
}

export interface Task {
  id: string;
  label: string;
  assigne: string;
  cat: string;
  heure: string;
  priorite: "haute" | "normale" | "basse";
  date: string;
  notes: string;
  done: boolean;
  createdAt: string;
  agentCode?: string;
  completedByCode?: string;
}

export interface Medicament {
  id: string;
  nom: string;
  forme: string;
  dosage: string;
  categorie: string;
  stock: number;
  seuil: number;
  prixAchat: number;
  prixVente: number;
  peremption: string;
  fournisseur: string;
  codeBarre?: string;
  createdAt: string;
  // Cahier des charges point 6.2 : distingue médicaments, consommables et
  // réactifs de laboratoire au sein d'une même pharmacie/stock.
  // Absent = "Médicament" (valeur par défaut, compatible avec les fiches déjà créées).
  typeArticle?: "Médicament" | "Consommable" | "Matériel médical technique" | "Réactif de laboratoire";
}

// Acte médical tarifé du service (ex: Consultation générale, Pansement,
// Accouchement...). Rempli et maintenu par le responsable/directeur du service.
export interface ActeTarifaire {
  id: string;
  nom: string;
  categorie: string;
  prix: number;
  description?: string;
  createdAt: string;
}

export interface MouvementStock {
  id: string;
  medId: string;
  type: "entree" | "sortie";
  qte: number;
  motif: string;
  prixUnitaire: number;
  montant: number;
  date: string;
  createdAt: string;
}

export interface FactureLigne {
  id: string;
  designation: string;
  qte: number;
  prix: number;
  montant: number;
}

export interface Facture {
  id: string;
  patient: string;
  date: string;
  mode: string;
  lignes: FactureLigne[];
  total: number;
  montantPaye: number;
  statut: "Payée" | "Partielle" | "Impayée";
  createdAt: string;
}

export interface Depense {
  id: string;
  libelle: string;
  montant: number;
  date: string;
  categorie: string;
  mode: string;
  createdAt: string;
}

export interface RendezVous {
  id: string;
  patient: string;
  date: string;
  heure: string;
  contact: string;
  type: string;
  praticien: string;
  motif: string;
  notes: string;
  statut: "Planifié" | "Confirmé" | "Terminé" | "Annulé" | "Absent";
  createdAt: string;
}

export interface RhFiche {
  id: string;
  staffId: string;
  dateEmbauche: string;
  contrat: "CDI" | "CDD" | "Stage" | "Vacataire" | "Bénévole";
  dateFinContrat: string;
  salaire: number;
  matricule: string;
  congesAnnuels: number;
  createdAt: string;
}

export interface Conge {
  id: string;
  staffId: string;
  dateDebut: string;
  dateFin: string;
  jours: number;
  type: "Congé annuel" | "Congé maladie" | "Congé maternité / paternité" | "Sans solde" | "Autre";
  motif: string;
  statut: "En attente" | "Approuvé" | "Refusé";
  createdAt: string;
}

export interface Absence {
  id: string;
  staffId: string;
  date: string;
  type: "Absence non justifiée" | "Retard" | "Maladie sans certificat" | "Autre";
  notes: string;
  createdAt: string;
}

export interface Hospitalisation {
  id: string;
  patient: string;
  contact: string;
  dateAdmission: string;
  heureAdmission: string;
  service: string;
  chambre: string;
  medecin: string;
  motif: string;
  notesInitiales?: string;
  typeAdmission?: "Hospitalisation" | "Mise en Observation (72h)";
  statut: "En cours" | "Sorti(e) guéri(e)" | "Transféré(e)" | "Sortie contre avis médical" | "Décès";
  dateSortie: string;
  statutSortie: string;
  diagnosticSortie: string;
  createdAt: string;
}

export interface Evolution {
  id: string;
  hospId: string;
  date: string;
  note: string;
  createdAt: string;
}

export interface FicheReference {
  id: string;
  hospId?: string;
  patient: string;
  age?: number;
  sexe?: string;
  contact?: string;
  serviceActuel: string;
  structureDestination: string;
  serviceDestination?: string;
  motifTransfert: string;
  etatClinique: "Stable" | "Sérieux" | "Critique" | "Urgence vitale";
  observationsCliniques?: string;
  medecinReferent?: string;
  dateReference: string;
  heureReference?: string;
  createdAt: string;
}

export interface Vaccination {
  id: string;
  patient: string;
  dateNaissance: string;
  contact: string;
  vaccin: string;
  dose: string;
  dateAdmin: string;
  lot: string;
  site: string;
  agent: string;
  prochainRappel: string;
  effets: string;
  poidsActuel?: number;
  temperature?: number;
  etatGeneral?: "Bien portant" | "Malade / Fébrile" | "";
  contreIndication?: boolean;
  contreIndicationDetail?: string;
  consentementParent?: boolean;
  surveillance30min?: boolean;
  createdAt: string;
}

export interface ExamenLabo {
  id: string;
  patient: string;
  contact: string;
  dateDemande: string;
  examen?: string;
  analyses?: string;
  priorite?: "urgente" | "normale";
  prescripteur: string;
  technicien: string;
  notes?: string;
  statut: "Demandé" | "Prélevé" | "En cours d'analyse" | "Résultat disponible" | "Validé" | "En attente" | "Prêt" | "Prélevé";
  dateResultat: string;
  resultat: string;
  interpretation: "Normal" | "Anormal" | "Critique" | string;
  createdAt: string;
  // Prix de l'examen au moment de la prescription (repris depuis la grille
  // tarifaire "Actes & Tarifs", catégorie Laboratoire) — permet le calcul
  // automatique du montant à facturer au patient.
  prix?: number;
  // Marque l'examen comme déjà reporté sur une facture patient, pour éviter
  // de le facturer deux fois depuis l'onglet Facturation.
  facture?: boolean;
}

export interface CpnMaternite {
  id: string;
  patiente: string;
  numeroDossier: string;
  agentNom: string;
  agentTitre: string;
  age: string;
  taille: string;
  contact: string;
  mariNom: string;
  mariAge: string;
  mariProfession: string;
  ddr: string;
  dap: string;
  numeroCpn: string;
  dateCpn: string;
  poids: string;
  tension: string;
  hauteurUterine: string;
  bcf: string;
  agent: string;
  prochainRdv: string;
  observations: string;
  createdAt: string;
}

export interface Accouchement {
  id: string;
  patient: string;
  patiente?: string;
  date: string;
  heure: string;
  type?: string;
  mode: "Voie basse naturelle" | "Césarienne";
  sexeEnfant: "Masculin" | "Féminin";
  sexe?: "Masculin" | "Féminin";
  poidsEnfant: number;
  poidsBebe?: string;
  etatEnfant: string;
  complications: string;
  sageFemmeId?: string;
  agent?: string;
  createdAt: string;
}

export interface Assureur {
  id: string;
  nom: string;
  type: string;
  contact: string;
  taux: number;
  delai: number;
  createdAt: string;
}

export interface AdhesionPatient {
  id: string;
  patient: string;
  assureurId: string;
  numero: string;
  taux: number;
  dateAdhesion: string;
  dateExpiration: string;
  createdAt: string;
}

export interface PriseEnCharge {
  id: string;
  patient?: string;
  assureurId?: string;
  numeroDossier?: string;
  dateSoins?: string;
  montantTotal?: number;
  taux?: number;
  montantCouvert?: number;
  montantRestant?: number;
  motif?: string;
  dateSoumission?: string;
  dateReponse?: string;
  createdAt: string;

  // New fields:
  factureId?: string;
  assureur?: string;
  tauxCouverture?: number;
  numeroPriseEnCharge?: string;
  montantAssurance?: number;
  montantPatient?: number;
  statut: "Accordé" | "Refusé" | "En attente" | "Soumis" | "En cours de traitement" | "Approuvé" | "Rejeté" | "Remboursé";
  notes?: string;
}

export interface Urgence {
  id: string;
  patient: string;
  agentNom: string;
  agentTitre: string;
  age: string;
  sexe: string;
  contact: string;
  dateArrivee: string;
  heureArrivee: string;
  modeArrivee: string;
  motif: string;
  triage: "Niveau 1 — Urgence vitale" | "Niveau 2 — Urgence" | "Niveau 3 — Semi-urgent" | "Niveau 4 — Non urgent";
  tension: string;
  pouls: string;
  temperature: string;
  saturation: string;
  medecin: string;
  notes: string;
  statut: "En attente" | "En consultation" | "En observation" | "Sorti(e)" | "Hospitalisé(e)" | "Transféré(e)" | "Décès";
  diagnostic: string;
  heureSortie: string;
  dateSortie: string;
  createdAt: string;
}

export interface ConsultationPediatrique {
  id: string;
  enfant: string;
  agentNom: string;
  agentTitre: string;
  dateNaissance: string;
  sexe: string;
  contact: string;
  dateConsult: string;
  poids: string;
  taille: string;
  pb: string;
  oedemes: "Oui" | "Non";
  statutNutritionnel: string;
  temperature: string;
  vaccinAJour: "Oui" | "Non" | "Inconnu";
  motif: string;
  diagnostic: string;
  traitement: string;
  medecin: string;
  prochainRdv: string;
  notes: string;
  createdAt: string;
}

export interface ConsultationGenerale {
  id: string;
  patient: string;
  agentNom: string;
  agentTitre: string;
  age: string;
  sexe: string;
  contact: string;
  date: string;
  categorie: string;
  motif: string;
  tension: string;
  pouls: string;
  temperature: string;
  poids: string;
  antecedents: string;
  examen: string;
  examensDemandes: string;
  examensResultats: string;
  diagnostic: string;
  prescription: string;
  conduite: string;
  medecin: string;
  prochainRdv: string;
  createdAt: string;
}

export interface DocumentAdministratif {
  id: string;
  titre: string;
  categorie: "Autorisation d'ouverture" | "Contrat de service" | "Autre document";
  date: string;
  description: string;
  image: string; // Base64 data url
  createdAt: string;
}

export interface EchographieCPN {
  id: string;
  date: string;
  sa?: number;
  resultat?: string;
  fileName?: string;
  fileType?: string;
  base64Data?: string;
  createdAt: string;
}

export interface ConsultationPrenatale {
  id: string;
  patient: string;
  contact: string;
  ddr: string;
  sa: number;
  dpa: string;
  dateVisite: string;
  numeroVisite: "CPN 1" | "CPN 2" | "CPN 3" | "CPN 4" | "CPN 5" | "CPN 6" | "CPN 7" | "CPN 8";
  gestite?: number;
  parite?: number;
  avortements?: number;
  groupeSanguin?: string;
  rhesus?: string;
  serologieVIH?: string;
  serologieSyphilis?: string;
  serologieHepatiteB?: string;
  hemoglobine?: number;
  glycosurie?: string;
  hauteurUterine?: number;
  bcf?: string;
  bcfFrequence?: number;
  mafPresents?: boolean;
  presentation?: string;
  oedemesMembres?: boolean;
  palleurConjonctivale?: boolean;
  vatDoses?: number;
  tpiDoses?: number;
  dangerSaignement?: boolean;
  dangerCephalees?: boolean;
  dangerVisionFloue?: boolean;
  dangerDouleurEpigastrique?: boolean;
  dangerFievre?: boolean;
  dangerDiminutionMAF?: boolean;
  prochainRdv?: string;
  poids: number;
  ta: string;
  albuminurie: string;
  ferAcideFolique: boolean;
  mild: boolean;
  agentId?: string;
  notes: string;
  echographies?: EchographieCPN[];
  createdAt: string;
}

export interface PatientUrgence {
  id: string;
  patient: string;
  contact: string;
  severite: "Urgence Vitale (Rouge)" | "Très Urgent (Orange)" | "Urgent (Jaune)" | "Non Urgent (Vert)";
  plainte: string;
  constantes: string;
  medecinId?: string;
  dateArrivee: string;
  heureArrivee: string;
  statut: "En attente de médecin" | "Examen clinique en cours" | "Sous surveillance infirmière" | "Sorti(e) ou Libéré(e)";
  createdAt: string;
}

export interface FichePediatrique {
  id: string;
  patient: string;
  sexe?: "Masculin" | "Féminin";
  dateNaissance?: string;
  ageMois: number;
  contact: string;
  temperature?: number;
  motif?: string;
  poids: number;
  taille?: number;
  pc?: number;
  pb: number;
  oedemes: boolean;
  statutNutritionnel: string;
  vaccinsAJour: boolean;
  alimentation: string;
  consultant?: string;

  // Signes Généraux de Danger (PCIME)
  dangerNePeutBoireOuTeter?: boolean;
  dangerVomitTout?: boolean;
  dangerConvulsions?: boolean;
  dangerLethargiqueInconscient?: boolean;

  // Toux ou difficulté à respirer
  touxPresent?: boolean;
  touxDureeJours?: number;
  freqRespiratoire?: number;
  tirageSousCostal?: boolean;
  stridor?: boolean;
  classificationRespiratoire?: string;

  // Diarrhée
  diarrheePresent?: boolean;
  diarrheeDureeJours?: number;
  diarrheeSangSelles?: boolean;
  diarrheeLethargiqueAgite?: boolean;
  diarrheeYeuxEnfonces?: boolean;
  diarrheeBoitAvidement?: boolean;
  diarrheePliCutanePersistant?: boolean;
  classificationDiarrhee?: string;

  // Fièvre
  fievrePresent?: boolean;
  fievreDureeJours?: number;
  fievreTypePalu?: boolean;
  fievreTypeRougeole?: boolean;
  classificationFievre?: string;

  // Problème d'oreille
  oreilleDouleur?: boolean;
  oreilleEcoulement?: boolean;
  oreilleDureeJours?: number;
  classificationOreille?: string;

  // Malnutrition / Anémie
  palmesPales?: boolean;

  // Vaccination & Vitamine A
  vitAAdministree?: boolean;
  deparasitageFait?: boolean;

  classificationGlobale?: string;
  conduiteATenir?: string;

  diagnostic: string;
  date: string;
  createdAt: string;
}

export interface LigneOrdonnance {
  id: string;
  medicamentNom: string;
  posologie: string;
  duree: string;
  // Lien vers la pharmacie pour permettre la déduction automatique du stock
  // (cahier des charges, point 6.3). Absent si le médicament a été saisi
  // librement (non trouvé dans la pharmacie).
  medicamentId?: string;
  quantitePrescrite?: number;
}

export interface Consultation {
  id: string;
  patient: string;
  age: number;
  sexe: "Masculin" | "Féminin";
  profession?: string;
  femmeEnceinte?: boolean;
  contact: string;
  commune?: string;
  villageSecteur?: string;
  zoneResidence?: "0-4 km" | "5-9 km" | "10 km et plus" | string;
  modeEntree?: "Auto orienté" | "Référé" | "Evacué" | "Transféré (CMA)" | string;
  ancienConsultant?: boolean;
  date: string;
  medecinId?: string;
  vitals: {
    temperature: number;
    poids: number;
    tensionArterielle: string;
    pouls: number;
    glycemie: number;
    taille?: number;
    imc?: number;
  };
  plainte: string;
  examenPhysique?: string;
  diagnostic: string;
  diagnosticFinal?: string;
  ordonnance: LigneOrdonnance[];
  photos?: string[];
  createdAt: string;
  agentCode?: string;
  labResults?: ExamenLabo[];
  observations?: string;
  // Décision prise en Consultation Générale (cahier des charges, points 1-3) :
  // c'est ici, et uniquement ici, que se décide l'orientation du patient
  // (retour à domicile, observation, hospitalisation, référence ou urgences).
  decision?: "Retour à domicile" | "Mise en observation" | "Hospitalisation" | "Référer vers un autre service" | "Admission aux urgences";
  referenceService?: string;
  // Renseigné automatiquement quand la décision crée un dossier lié
  // (hospitalisation ou urgences), pour tracer le lien entre les deux dossiers.
  linkedHospitalisationId?: string;
  linkedUrgenceId?: string;
}

export interface DocumentArchive {
  id: string;
  titre: string;
  patient: string;
  categorie: string;
  dateUpload: string;
  description: string;
  base64Data: string;
  fileType?: string;
  fileName?: string;
  createdAt: string;
}

export interface PinAuditLog {
  id: string;
  date: string;
  action: "Création" | "Modification" | "Révocation";
  responsableId: string;
  agentId: string;
  agentNom: string;
  details: string;
}

export interface GardeAgent {
  id: string;
  agentId: string;
  agentNom: string;
  agentFonction: string;
  date: string;
  shift: "Matin (07h-14h)" | "Après-midi (14h-21h)" | "Nuit (21h-07h)" | "Garde 24h" | string;
  service: "Urgences" | "Maternité" | "Pédiatrie" | "Médecine Générale" | "Pharmacie" | string;
  statut: "Confirmé" | "Remplacé" | "En attente" | string;
  notes?: string;
}

export interface FichePlanifFamiliale {
  id: string;
  patient: string;
  nomPatiente?: string;
  prenomPatiente?: string;
  adresse?: string;
  nomEpoux?: string;
  nombreEnfants?: number;
  programmeProchainEnfant?: string;
  ancienneMethode?: string;
  estNouvelleFois?: boolean;
  age: number;
  contact: string;
  methodeChoisie: string;
  dateDebut: string;
  dateSuiviPrevu: string;
  counselingEffectue: boolean;
  consentementSigne: boolean;
  ta: string;
  poids: number;
  contraintesSelectionnees: string[];
  notesMedicales: string;
  agentId: string;
  statut: "En cours" | "Terminé" | "Effets indésirables" | "Retrait effectué" | string;
  createdAt: string;
}

export interface ClinicProfile {
  name: string;
  slogan: string;
  address: string;
  phone: string;
  email: string;
  nif: string;       // Tax/Corporate registry
  rccm: string;      // Commerce registry
  currency: string;  // e.g., "FCFA", "EUR"
  logoColor: string; // "teal", "indigo", "rose", "emerald", "amber"
  stampText: string; // custom stamp text
  logoUrl?: string; // custom logo URL or base64 string
  legalForm?: string; // e.g. "S.A.R.L.", "S.A.", "Cabinet Individuel"
  ownerName?: string; // e.g. "Dr. Deogracias"
  capital?: string; // e.g. "2 000 000 FCFA"
  taxRegime?: string; // e.g. "Régime Réel Simplifié"
  operatingStatus?: string; // e.g. "Actif", "En cours de rachat", "Transition"
  bylawsText?: string; // Articles of association / Legal Bylaws custom document
  buyerName?: string;  // Name of the new buyer/purchaser
  buyerPhone?: string; // Phone of the new buyer/purchaser
  buyerEmail?: string; // Email of the new buyer/purchaser
  cessionAmount?: number; // Cession/rachat amount in current currency
  cessionDate?: string; // Planned/effective date of ownership transfer
  isCessionCompleted?: boolean; // True if ownership has been fully transferred
}



