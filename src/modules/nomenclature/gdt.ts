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
