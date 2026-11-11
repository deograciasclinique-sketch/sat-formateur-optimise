/**
 * Nomenclature du Guide de Diagnostic et de Traitement (GDT), 4e édition,
 * février 2024 — Ministère de la Santé et de l'Hygiène Publique du Burkina Faso.
 *
 * - SYMPTOMES_DOMINANTS : titres des ordinogrammes (1re partie du GDT), à
 *   choisir comme symptôme dominant (étape 2 de la consultation).
 * - DIAGNOSTICS : appellations à utiliser au registre (protocoles des
 *   maladies prioritaires, liste SIMR 2021 des 61 maladies, principaux motifs
 *   de consultation de l'annuaire statistique, diagnostics courants).
 */

export const SYMPTOMES_DOMINANTS: { section: string; items: string[] }[] = [
  {
    section: "Pathologie abdomino-digestive",
    items: [
      "Ballonnement abdominal / distension abdominale", "Constipation", "Diarrhée",
      "Mal à la bouche : bouche rouge", "Mal à la bouche : ulcération buccale", "Mal au ventre",
      "Prurit anal et/ou expulsion d'un parasite", "Sang dans les selles", "Vomissements / nausées",
    ],
  },
  {
    section: "Pathologie cardio-respiratoire et ORL",
    items: [
      "Douleurs thoraciques non irradiantes", "Douleurs thoraciques irradiantes", "Écoulement nasal",
      "État de choc", "Mal à l'oreille / troubles auriculaires", "Mal à la gorge",
      "Toux / dyspnée avec fièvre", "Toux / dyspnée sans fièvre",
    ],
  },
  {
    section: "Pathologies uro-génitales et IST",
    items: [
      "Douleurs mictionnelles", "Douleurs pelviennes chez l'homme", "Gonflement / douleurs des organes génitaux chez l'homme",
      "Pertes blanches ou leucorrhées", "Pertes génitales de sang chez la femme en grossesse < 6 mois",
      "Pertes génitales de sang chez la femme non en grossesse", "Prurit vulvaire", "Troubles urinaires",
      "Écoulement urétral chez l'homme", "Écoulement vaginal", "Douleurs pelviennes chez la femme", "Écoulement anal",
      "Conjonctivite purulente du nouveau-né", "Ulcération génitale", "Bubon inguinal", "Gonflement douloureux du scrotum",
    ],
  },
  {
    section: "Système nerveux et œil",
    items: [
      "Convulsions", "Mal à l'œil / troubles oculaires", "Mal à la tête", "Paralysie des membres",
      "Perte de connaissance", "Troubles du comportement", "Vertiges",
    ],
  },
  {
    section: "Symptômes généraux et divers",
    items: [
      "Abcès", "Amaigrissement", "Anémie", "Douleurs ostéo-articulaires", "Fatigue / asthénie", "Fièvre",
      "Ictère", "Œdèmes", "Plaies", "Prurit / lésions de la peau avec fièvre", "Prurit / lésions de la peau sans fièvre",
      "Traumatismes",
    ],
  },
];

export const DIAGNOSTICS: { groupe: string; items: string[] }[] = [
  {
    groupe: "Maladies prioritaires (protocoles du GDT)",
    items: [
      "Paludisme simple", "Paludisme grave", "Pneumonie", "Pneumonie grave", "Rougeole", "Méningite bactérienne",
      "Diarrhée sans déshydratation", "Diarrhée avec signes évidents de déshydratation", "Diarrhée avec déshydratation sévère",
      "Diarrhée persistante", "Shigellose (diarrhée sanglante)", "Tuberculose pulmonaire", "Tuberculose extrapulmonaire",
      "Infection à VIH", "Hypertension artérielle", "Diabète sucré", "Malnutrition aiguë modérée", "Malnutrition aiguë sévère",
      "Dengue", "Covid-19",
    ],
  },
  {
    groupe: "Motifs de consultation les plus fréquents",
    items: [
      "Infection respiratoire aiguë (IRA) haute", "Rhinopharyngite", "Angine", "Bronchite aiguë", "Otite moyenne aiguë",
      "Conjonctivite", "Parasitose intestinale", "Plaie", "Affection de la peau", "Ulcère gastro-duodénal / gastrite",
      "Anémie", "Infection urinaire",
    ],
  },
  {
    groupe: "IST et uro-génital",
    items: [
      "Écoulement urétral (IST)", "Écoulement vaginal (IST)", "Ulcération génitale (IST)", "Bubon inguinal (IST)",
      "Douleurs pelviennes / infection génitale haute", "Candidose vulvo-vaginale", "Orchi-épididymite",
    ],
  },
  {
    groupe: "Autres maladies sous surveillance (SIMR 2021)",
    items: [
      "Choléra", "Fièvre jaune", "Méningite (cas suspect)", "Maladie à virus Ebola", "Fièvre de Lassa", "Chikungunya",
      "Charbon", "Brucellose", "Peste", "Poliomyélite / paralysie flasque aiguë (PFA)", "Tétanos néonatal", "Rubéole",
      "Coqueluche", "Fièvre typhoïde", "Schistosomiase", "Onchocercose", "Filariose lymphatique", "Lèpre", "Trachome",
      "Trypanosomiase", "Leishmaniose", "Ulcère de Buruli", "Noma", "Pian / tréponématose endémique", "Dracunculose",
      "Hépatite B", "Hépatite C", "Hépatite E", "Rage humaine", "Morsure de chien / animal suspect de rage",
      "Envenimation (morsure de serpent)", "Intoxication alimentaire", "Traumatisme (accident de la circulation)",
      "Drépanocytose", "Asthme", "Épilepsie", "Dépression", "Schizophrénie", "Cataracte",
    ],
  },
  {
    groupe: "Autres diagnostics courants",
    items: [
      "Abcès", "Brûlure", "Céphalées", "Lombalgie", "Arthrose", "Douleurs ostéo-articulaires", "Constipation",
      "Vomissements / gastro-entérite", "Ictère (à explorer)", "Otite externe", "Sinusite", "Dermatose / mycose cutanée",
      "Gale", "Teigne", "Varicelle", "Oreillons", "Grossesse (consultation curative)", "Infection néonatale",
      "Accident vasculaire cérébral (AVC)", "Insuffisance cardiaque",
    ],
  },
];

export const TOUS_DIAGNOSTICS: string[] = DIAGNOSTICS.flatMap((g) => g.items);

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Appellations du paludisme que le GDT demande de ne plus utiliser dans les
 * supports de collecte : « accès pernicieux », « syndrome palustre »,
 * « accès palustre », « paludisme » seul, « paludisme chronique »,
 * « neuropaludisme ». Renvoie un conseil, ou null si le texte convient.
 */
export function alertePaludismeNomenclature(texte: string): string | null {
  const t = norm(texte);
  if (!/palu|palustre|pernicieux/.test(t)) return null;
  if (/paludisme (simple|grave)|\bps\b|\bpg\b/.test(t) && !/neuro|pernicieux|syndrome palustre|acces palustre|chronique/.test(t)) return null;
  return "Le GDT 2024 demande d'écrire « Paludisme simple » ou « Paludisme grave » (plus « accès palustre », « neuropaludisme », « syndrome palustre », « paludisme chronique » ni « paludisme » seul).";
}

/** Le texte correspond-il exactement à une appellation de la nomenclature ? */
export const estDansNomenclature = (texte: string) => TOUS_DIAGNOSTICS.some((d) => norm(d) === norm(texte));

/** Plan de l'examen physique décrit par le GDT (étape 1). */
export const PLAN_EXAMEN_GDT = [
  "État général (conscience, poids/taille) : ",
  "Signes vitaux (respiration, pouls, T°, TA, coloration des téguments, déshydratation, œdèmes) : ",
  "Oreilles, yeux, gorge, nez, cou, ganglions : ",
  "Thorax, cœur, poumons, seins : ",
  "Abdomen : ",
  "Pelvis, organes génitaux, rectum : ",
  "Appareil locomoteur (os, muscles, articulations, colonne, membres) : ",
].join("\n");

/* ------------------------------------------------------------------ */
/*  Consultation du GDT pendant la consultation                        */
/* ------------------------------------------------------------------ */

/** PDF du GDT servi par l'application (public/gdt). */
export const GDT_PDF = "/gdt/GDT_2024_4e_edition.pdf";

/** Page imprimée du GDT → page du fichier PDF (la couverture n'est pas numérotée). */
export const pagePdf = (pageImprimee: number) => pageImprimee + 1;

/** Page (imprimée) de l'ordinogramme de chaque symptôme dominant. */
export const PAGE_ORDINOGRAMME: Record<string, number> = {
  "Ballonnement abdominal / distension abdominale": 21, "Constipation": 23, "Diarrhée": 25,
  "Mal à la bouche : bouche rouge": 27, "Mal à la bouche : ulcération buccale": 29, "Mal au ventre": 31,
  "Prurit anal et/ou expulsion d'un parasite": 33, "Sang dans les selles": 35, "Vomissements / nausées": 37,
  "Douleurs thoraciques non irradiantes": 40, "Douleurs thoraciques irradiantes": 42, "Écoulement nasal": 44,
  "État de choc": 46, "Mal à l'oreille / troubles auriculaires": 48, "Mal à la gorge": 50,
  "Toux / dyspnée avec fièvre": 52, "Toux / dyspnée sans fièvre": 54,
  "Douleurs mictionnelles": 57, "Douleurs pelviennes chez l'homme": 61, "Gonflement / douleurs des organes génitaux chez l'homme": 63,
  "Pertes blanches ou leucorrhées": 65, "Pertes génitales de sang chez la femme en grossesse < 6 mois": 67,
  "Pertes génitales de sang chez la femme non en grossesse": 74, "Prurit vulvaire": 76, "Troubles urinaires": 78,
  "Écoulement urétral chez l'homme": 83, "Écoulement vaginal": 85, "Douleurs pelviennes chez la femme": 89,
  "Écoulement anal": 91, "Conjonctivite purulente du nouveau-né": 93, "Ulcération génitale": 95, "Bubon inguinal": 97,
  "Gonflement douloureux du scrotum": 99,
  "Convulsions": 104, "Mal à l'œil / troubles oculaires": 109, "Mal à la tête": 111, "Paralysie des membres": 113,
  "Perte de connaissance": 115, "Troubles du comportement": 117, "Vertiges": 119,
  "Abcès": 122, "Amaigrissement": 124, "Anémie": 126, "Douleurs ostéo-articulaires": 128, "Fatigue / asthénie": 130,
  "Fièvre": 132, "Ictère": 134, "Œdèmes": 136, "Plaies": 138, "Prurit / lésions de la peau avec fièvre": 140,
  "Prurit / lésions de la peau sans fièvre": 143, "Traumatismes": 146,
};

/** Protocoles de traitement (2e partie) et gestes pratiques (3e partie), page imprimée. */
export const PROTOCOLES_GDT: { titre: string; page: number; motsCles: RegExp }[] = [
  { titre: "Paludisme", page: 155, motsCles: /palu/ },
  { titre: "Pneumonie", page: 165, motsCles: /pneumo/ },
  { titre: "Rougeole", page: 167, motsCles: /rougeole|rubeole/ },
  { titre: "Méningites bactériennes", page: 168, motsCles: /mening/ },
  { titre: "Diarrhée avec déshydratation", page: 171, motsCles: /diarrhee|deshydrat/ },
  { titre: "Diarrhée sanguinolente (shigellose)", page: 178, motsCles: /shigell|sanglante|dysenter/ },
  { titre: "Tuberculose", page: 179, motsCles: /tubercul/ },
  { titre: "Infection à VIH / Sida", page: 184, motsCles: /\bvih\b|sida/ },
  { titre: "Hypertension artérielle", page: 202, motsCles: /hypertension|\bhta\b/ },
  { titre: "Malnutrition aiguë", page: 204, motsCles: /malnutrition|\bmas\b|\bmam\b/ },
  { titre: "Dengue", page: 223, motsCles: /dengue/ },
  { titre: "Covid-19", page: 228, motsCles: /covid/ },
  { titre: "Diabète sucré", page: 233, motsCles: /diabet/ },
  { titre: "Traitement symptomatique de la fièvre et des convulsions", page: 237, motsCles: /^$/ },
  { titre: "Solutions de perfusion", page: 238, motsCles: /^$/ },
  { titre: "Ponction lombaire", page: 240, motsCles: /^$/ },
  { titre: "Brûlure", page: 242, motsCles: /brulure/ },
  { titre: "Morsures d'animaux et piqûres d'insectes", page: 243, motsCles: /morsure|envenim|rage/ },
  { titre: "Intoxications / empoisonnement", page: 247, motsCles: /intoxic|empoison/ },
  { titre: "Choc hémorragique du post-partum", page: 248, motsCles: /post.?partum/ },
  { titre: "Crises d'éclampsie", page: 250, motsCles: /eclampsi/ },
  { titre: "Prévention et contrôle des infections / AES", page: 254, motsCles: /^$/ },
  { titre: "Accident vasculaire cérébral (AVC)", page: 268, motsCles: /\bavc\b|vasculaire cerebral/ },
];

/** Protocole du GDT correspondant à un diagnostic saisi, s'il y en a un. */
export function protocolePour(diagnostic: string) {
  const t = norm(diagnostic);
  if (!t) return undefined;
  return PROTOCOLES_GDT.find((p) => p.motsCles.test(t));
}
