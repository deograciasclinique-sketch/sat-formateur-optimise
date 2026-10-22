/**
 * Bilans biologiques prédéfinis : un clic sur « Bilan hépatique » sélectionne
 * tous les examens qui le composent, avec leur prix.
 *
 * Prix : celui de la grille « Actes & Tarifs » (catégorie Laboratoire) quand l'examen y figure ;
 * sinon un tarif indicatif (FCFA), à ajuster par le responsable dans Actes & Tarifs
 * (bouton « Ajouter les examens des bilans »).
 */
import type { ActeTarifaire } from "../types";

export type ExamenType = { nom: string; prix: number; alias?: string[] };
export type Bilan = { id: string; nom: string; groupe: string; examens: string[] };

/** Examens de base et tarif indicatif. */
export const EXAMENS: Record<string, ExamenType> = {
  asat: { nom: "ASAT (TGO)", prix: 2000, alias: ["asat", "tgo", "sgot", "transaminases asat"] },
  alat: { nom: "ALAT (TGP)", prix: 2000, alias: ["alat", "tgp", "sgpt", "transaminases alat"] },
  ggt: { nom: "Gamma GT", prix: 3000, alias: ["gamma gt", "ggt", "gamma glutamyl transferase"] },
  pal: { nom: "Phosphatases alcalines", prix: 3000, alias: ["phosphatases alcalines", "pal"] },
  bilit: { nom: "Bilirubine totale", prix: 2500, alias: ["bilirubine totale", "bilirubine t"] },
  bilid: { nom: "Bilirubine directe (conjuguée)", prix: 2500, alias: ["bilirubine directe", "bilirubine conjuguee", "bilirubine d"] },
  prot: { nom: "Protides totaux", prix: 2500, alias: ["protides totaux", "proteines totales", "protidemie"] },
  alb: { nom: "Albumine", prix: 3000, alias: ["albumine", "albuminemie"] },
  tp: { nom: "TP / INR", prix: 4000, alias: ["tp", "inr", "tp / inr", "tp/inr", "taux de prothrombine"] },
  tca: { nom: "TCA (TCK)", prix: 4000, alias: ["tca", "tck", "temps de cephaline activee"] },
  fib: { nom: "Fibrinogène", prix: 5000, alias: ["fibrinogene", "fibrinemie"] },
  uree: { nom: "Urée", prix: 2000, alias: ["uree", "azotemie", "uree sanguine"] },
  creat: { nom: "Créatinine", prix: 2000, alias: ["creatinine", "creatininemie"] },
  au: { nom: "Acide urique", prix: 2500, alias: ["acide urique", "uricemie"] },
  iono: { nom: "Ionogramme sanguin (Na⁺, K⁺, Cl⁻)", prix: 7500, alias: ["ionogramme", "ionogramme sanguin"] },
  prot24: { nom: "Protéinurie de 24 h", prix: 3000, alias: ["proteinurie de 24 h", "proteinurie 24h", "proteinurie"] },
  chol: { nom: "Cholestérol total", prix: 2500, alias: ["cholesterol total", "cholesterol"] },
  hdl: { nom: "HDL-cholestérol", prix: 3000, alias: ["hdl", "hdl cholesterol", "hdl-cholesterol"] },
  ldl: { nom: "LDL-cholestérol", prix: 3000, alias: ["ldl", "ldl cholesterol", "ldl-cholesterol"] },
  tg: { nom: "Triglycérides", prix: 3000, alias: ["triglycerides", "tg"] },
  gaj: { nom: "Glycémie à jeun", prix: 1000, alias: ["glycemie a jeun", "glycemie"] },
  gpp: { nom: "Glycémie post-prandiale", prix: 1000, alias: ["glycemie post-prandiale", "glycemie post prandiale"] },
  hba1c: { nom: "Hémoglobine glyquée (HbA1c)", prix: 7500, alias: ["hba1c", "hemoglobine glyquee"] },
  nfs: { nom: "NFS (Hémogramme complet)", prix: 3500, alias: ["nfs", "hemogramme", "hemogramme complet", "numeration formule sanguine"] },
  vs: { nom: "Vitesse de sédimentation (VS)", prix: 1500, alias: ["vs", "vitesse de sedimentation"] },
  crp: { nom: "CRP", prix: 4000, alias: ["crp", "proteine c reactive"] },
  reti: { nom: "Réticulocytes", prix: 3000, alias: ["reticulocytes"] },
  frottis: { nom: "Frottis sanguin", prix: 2500, alias: ["frottis sanguin", "frottis"] },
  gsrh: { nom: "Groupe sanguin - Rhésus", prix: 2000, alias: ["groupe sanguin - rhesus", "groupe sanguin rhesus", "groupe sanguin", "gs rh"] },
  elechb: { nom: "Électrophorèse de l'hémoglobine", prix: 7500, alias: ["electrophorese de l'hemoglobine", "electrophorese hemoglobine", "electrophorese hb"] },
  emmel: { nom: "Test d'Emmel", prix: 1500, alias: ["test d'emmel", "emmel"] },
  fer: { nom: "Fer sérique", prix: 4000, alias: ["fer serique", "sideremie", "fer"] },
  ferri: { nom: "Ferritine", prix: 10000, alias: ["ferritine", "ferritinemie"] },
  cst: { nom: "Transferrine / CST", prix: 7500, alias: ["transferrine", "cst", "coefficient de saturation"] },
  ge: { nom: "Goutte épaisse (GE)", prix: 1500, alias: ["goutte epaisse", "ge", "goutte epaisse (ge / recherche palu)", "ge / recherche palu"] },
  tdrpalu: { nom: "TDR Paludisme", prix: 1000, alias: ["tdr paludisme", "tdr palu"] },
  widal: { nom: "Test de Widal (typhoïde)", prix: 3000, alias: ["test de widal", "widal", "serodiagnostic de widal"] },
  ecbu: { nom: "ECBU (Urine)", prix: 5000, alias: ["ecbu", "examen cytobacteriologique des urines"] },
  hemoc: { nom: "Hémoculture", prix: 10000, alias: ["hemoculture"] },
  bu: { nom: "Albumine - Sucre urinaires (bandelette)", prix: 1000, alias: ["albumine sucre", "albumine - sucre urinaires", "bandelette urinaire", "chimie des urines"] },
  vih: { nom: "Sérologie VIH 1 & 2", prix: 2500, alias: ["serologie vih", "serologie vih 1 & 2", "vih", "test vih"] },
  syph: { nom: "Sérologie Syphilis (TPHA / VDRL)", prix: 4000, alias: ["serologie syphilis", "tpha", "vdrl", "tpha/vdrl", "tpha / vdrl"] },
  aghbs: { nom: "Antigène HBs (Hépatite B)", prix: 3000, alias: ["antigene hbs", "aghbs", "ag hbs", "hepatite b"] },
  vhc: { nom: "Sérologie Hépatite C (Ac anti-VHC)", prix: 5000, alias: ["hepatite c", "vhc", "anti-vhc", "serologie hepatite c"] },
  toxo: { nom: "Toxoplasmose (IgG / IgM)", prix: 7500, alias: ["toxoplasmose", "serologie toxoplasmose"] },
  rub: { nom: "Rubéole (IgG)", prix: 7500, alias: ["rubeole", "serologie rubeole"] },
  hcg: { nom: "Test de grossesse (β-HCG)", prix: 2000, alias: ["test de grossesse", "test de grossesse hcg", "hcg", "beta hcg"] },
  tsh: { nom: "TSH", prix: 10000, alias: ["tsh", "tshus"] },
  t3: { nom: "T3 libre", prix: 10000, alias: ["t3 libre", "t3", "ft3"] },
  t4: { nom: "T4 libre", prix: 10000, alias: ["t4 libre", "t4", "ft4"] },
  ca: { nom: "Calcémie", prix: 3000, alias: ["calcemie", "calcium"] },
  phos: { nom: "Phosphorémie", prix: 3000, alias: ["phosphoremie", "phosphore"] },
  mg: { nom: "Magnésémie", prix: 3000, alias: ["magnesemie", "magnesium"] },
  vitd: { nom: "Vitamine D (25-OH)", prix: 20000, alias: ["vitamine d", "25-oh vitamine d"] },
  tropo: { nom: "Troponine", prix: 12000, alias: ["troponine", "troponine i", "troponine t"] },
  cpk: { nom: "CPK", prix: 5000, alias: ["cpk", "ck", "creatine kinase"] },
  ldh: { nom: "LDH", prix: 5000, alias: ["ldh", "lactate deshydrogenase"] },
  lipase: { nom: "Lipase", prix: 6000, alias: ["lipase", "lipasemie"] },
  amyl: { nom: "Amylase", prix: 5000, alias: ["amylase", "amylasemie"] },
  pv: { nom: "Prélèvement vaginal / urétral", prix: 5000, alias: ["prelevement genital", "prelevement genital (pv/pu)", "pv", "prelevement vaginal"] },
  chlam: { nom: "Chlamydia (sérologie / PCR)", prix: 10000, alias: ["chlamydia"] },
  fsh: { nom: "FSH", prix: 10000, alias: ["fsh"] },
  lh: { nom: "LH", prix: 10000, alias: ["lh"] },
  e2: { nom: "Œstradiol", prix: 10000, alias: ["oestradiol", "estradiol"] },
  prl: { nom: "Prolactine", prix: 10000, alias: ["prolactine"] },
  prog: { nom: "Progestérone", prix: 10000, alias: ["progesterone"] },
  cd4: { nom: "Taux de CD4", prix: 5000, alias: ["cd4", "taux de cd4"] },
  cv: { nom: "Charge virale VIH", prix: 25000, alias: ["charge virale", "charge virale vih"] },
  kaop: { nom: "Examen parasitologique des selles (KAOP)", prix: 1500, alias: ["eps (selles)", "eps", "kaop", "examen parasitologique des selles", "selles kaop"] },
  copro: { nom: "Coproculture", prix: 7500, alias: ["coproculture"] },
  sango: { nom: "Recherche de sang occulte (selles)", prix: 3000, alias: ["sang occulte", "recherche de sang dans les selles"] },
  psa: { nom: "PSA total", prix: 10000, alias: ["psa", "psa total"] },
  sperm: { nom: "Spermogramme", prix: 10000, alias: ["spermogramme"] },
};

export const BILANS: Bilan[] = [
  { id: "hepatique", groupe: "Biochimie", nom: "Bilan hépatique", examens: ["asat", "alat", "ggt", "pal", "bilit", "bilid", "prot", "alb"] },
  { id: "renal", groupe: "Biochimie", nom: "Bilan rénal", examens: ["uree", "creat", "au", "iono"] },
  { id: "lipidique", groupe: "Biochimie", nom: "Bilan lipidique", examens: ["chol", "hdl", "ldl", "tg"] },
  { id: "glucidique", groupe: "Biochimie", nom: "Bilan glucidique (diabète)", examens: ["gaj", "gpp", "hba1c"] },
  { id: "hta", groupe: "Biochimie", nom: "Bilan de l'HTA", examens: ["creat", "uree", "iono", "au", "gaj", "chol", "tg", "prot24"] },
  { id: "phosphocalcique", groupe: "Biochimie", nom: "Bilan phosphocalcique", examens: ["ca", "phos", "mg", "vitd"] },
  { id: "pancreatique", groupe: "Biochimie", nom: "Bilan pancréatique", examens: ["lipase", "amyl"] },
  { id: "cardiaque", groupe: "Biochimie", nom: "Bilan cardiaque", examens: ["tropo", "cpk", "ldh", "iono"] },
  { id: "inflammatoire", groupe: "Hématologie", nom: "Bilan inflammatoire", examens: ["nfs", "vs", "crp", "fib"] },
  { id: "anemie", groupe: "Hématologie", nom: "Bilan d'anémie", examens: ["nfs", "reti", "frottis", "ferri", "elechb", "ge"] },
  { id: "martial", groupe: "Hématologie", nom: "Bilan martial (fer)", examens: ["fer", "ferri", "cst"] },
  { id: "drepano", groupe: "Hématologie", nom: "Bilan de drépanocytose", examens: ["nfs", "elechb", "emmel", "reti"] },
  { id: "hemostase", groupe: "Hématologie", nom: "Bilan d'hémostase", examens: ["nfs", "tp", "tca", "fib"] },
  { id: "fievre", groupe: "Infectiologie", nom: "Bilan fébrile", examens: ["nfs", "ge", "tdrpalu", "crp", "widal", "ecbu", "hemoc"] },
  { id: "ist", groupe: "Infectiologie", nom: "Bilan IST", examens: ["vih", "syph", "aghbs", "vhc", "pv", "chlam"] },
  { id: "vih", groupe: "Infectiologie", nom: "Bilan de suivi VIH", examens: ["cd4", "cv", "nfs", "creat", "alat", "gaj"] },
  { id: "selles", groupe: "Infectiologie", nom: "Bilan des selles", examens: ["kaop", "copro", "sango"] },
  { id: "urinaire", groupe: "Infectiologie", nom: "Bilan urinaire", examens: ["ecbu", "bu", "prot24"] },
  { id: "prenatal", groupe: "Mère et enfant", nom: "Bilan prénatal (CPN)", examens: ["nfs", "gsrh", "gaj", "vih", "syph", "aghbs", "toxo", "rub", "bu", "elechb"] },
  { id: "preop", groupe: "Chirurgie", nom: "Bilan préopératoire", examens: ["nfs", "gsrh", "tp", "tca", "gaj", "creat", "vih", "aghbs"] },
  { id: "thyroidien", groupe: "Hormonologie", nom: "Bilan thyroïdien", examens: ["tsh", "t3", "t4"] },
  { id: "hormonal-f", groupe: "Hormonologie", nom: "Bilan hormonal féminin (infertilité)", examens: ["fsh", "lh", "e2", "prl", "prog"] },
  { id: "infertilite-h", groupe: "Hormonologie", nom: "Bilan d'infertilité masculine", examens: ["sperm", "fsh", "lh", "chlam"] },
  { id: "prostate", groupe: "Hormonologie", nom: "Bilan prostatique", examens: ["psa", "ecbu", "creat"] },
];

export function normaliser(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
/** Nom d'acte sans le texte entre parenthèses (« NFS (Hémogramme complet) » → « nfs »). */
function noyau(t: string): string {
  return normaliser(t.replace(/\([^)]*\)/g, " "));
}

/** L'acte de la grille tarifaire qui correspond à cet examen, s'il existe. */
export function acteCorrespondant(cle: string, catalogue: ActeTarifaire[]): ActeTarifaire | undefined {
  const ex = EXAMENS[cle];
  if (!ex) return undefined;
  const cibles = new Set([normaliser(ex.nom), noyau(ex.nom), ...(ex.alias || []).map(normaliser)]);
  return catalogue.find((a) => cibles.has(normaliser(a.nom)) || cibles.has(noyau(a.nom)));
}

export type LigneBilan = { cle: string; nom: string; prix: number; indicatif: boolean };

/** Examens d'un bilan avec le prix de la clinique (ou indicatif). */
export function lignesBilan(bilan: Bilan, catalogue: ActeTarifaire[]): LigneBilan[] {
  return bilan.examens.map((cle) => {
    const acte = acteCorrespondant(cle, catalogue);
    const ex = EXAMENS[cle];
    return acte
      ? { cle, nom: acte.nom, prix: acte.prix, indicatif: false }
      : { cle, nom: ex.nom, prix: ex.prix, indicatif: true };
  });
}

/** Examens des bilans absents de la grille tarifaire (pour les y ajouter). */
export function examensManquants(catalogue: ActeTarifaire[]): ExamenType[] {
  const cles = new Set(BILANS.flatMap((b) => b.examens));
  return [...cles].filter((c) => !acteCorrespondant(c, catalogue)).map((c) => EXAMENS[c]);
}
