/**
 * Examens réalisables en SALLE INFIRMIER (tests rapides au lit du patient).
 *
 * Une partie du laboratoire est déplacée en salle infirmier : les tests
 * simples (TDR, glycémie capillaire, test de grossesse, bandelette urinaire,
 * hémoglobine…) sont faits par l'infirmier(ère), qui remplit une fiche de
 * résultat ; le résultat repart automatiquement vers le médecin prescripteur
 * (même dossier ExamenLabo, statut « Prêt »).
 *
 * Pour ajouter ou retirer un examen de la salle infirmier, modifier la liste
 * TESTS_SALLE_INFIRMIER ci-dessous (mots-clés reconnus dans le nom de l'examen).
 */
import { ExamenLabo } from "../types";
import { demandeTdrPalu, demandeTdrDengue } from "../modules/thlo/tdr";

export type TypeTestInfirmier =
  | "tdr_palu"
  | "tdr_dengue"
  | "glycemie"
  | "grossesse"
  | "hemoglobine"
  | "bandelette"
  | "rapide"; // autre test rapide Positif / Négatif (VIH, syphilis, AgHBs…)

const norm = (s?: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface RegleTest {
  type: TypeTestInfirmier;
  libelle: string;
  match: (t: string, brut: string) => boolean;
}

export const TESTS_SALLE_INFIRMIER: RegleTest[] = [
  { type: "tdr_palu", libelle: "TDR Paludisme", match: (_t, brut) => demandeTdrPalu(brut) },
  { type: "tdr_dengue", libelle: "TDR Dengue (NS1 / IgM / IgG)", match: (_t, brut) => demandeTdrDengue(brut) },
  { type: "glycemie", libelle: "Glycémie capillaire", match: (t) => (/glyc[ea]mie|dextro|glucometre/.test(t) || (/glucose/.test(t) && !/urin/.test(t))) && !/hb ?a1c|hemoglobine glyquee|hgpo|provoquee/.test(t) },
  { type: "grossesse", libelle: "Test de grossesse urinaire", match: (t) => /test (de )?grossesse|beta ?hcg urinaire|hcg urinaire|tig\b/.test(t) },
  { type: "hemoglobine", libelle: "Hémoglobine (Hemocue)", match: (t) => /hemocue|taux d'?hemoglobine|\bhb capillaire|hemoglobine capillaire/.test(t) },
  { type: "bandelette", libelle: "Bandelette urinaire", match: (t) => /bandelette|labstix|multistix|combur/.test(t) },
  { type: "rapide", libelle: "Test rapide", match: (t) => /(test|tdr|trod).*(vih|hiv|syphilis|bw|ag ?hbs|hepatite b|vhc|hepatite c)|(vih|hiv|syphilis|ag ?hbs|vhc).*(rapide|tdr|trod)/.test(t) },
];

/** Types de tests infirmier détectés dans la demande (peut en contenir plusieurs). */
export function testsDetectes(analyses?: string): TypeTestInfirmier[] {
  const brut = analyses || "";
  const t = norm(brut);
  return TESTS_SALLE_INFIRMIER.filter((r) => r.match(t, brut)).map((r) => r.type);
}

/**
 * L'examen peut-il être fait en salle infirmier ? Uniquement si TOUTES les
 * analyses de la demande sont des tests rapides (une demande mixte, ou un
 * bilan, reste au laboratoire).
 */
export function realisableEnSalleInfirmier(analyses?: string, bilan?: string): boolean {
  if (bilan) return false;
  const parties = (analyses || "").split(/\s*\+\s*|\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  if (parties.length === 0) return false;
  return parties.every((p) => testsDetectes(p).length > 0);
}

/** Lieu d'exécution par défaut au moment de la prescription. */
export function lieuParDefaut(analyses?: string, bilan?: string): "Laboratoire" | "Salle infirmier" {
  return realisableEnSalleInfirmier(analyses, bilan) ? "Salle infirmier" : "Laboratoire";
}

export const enSalleInfirmier = (e: ExamenLabo) => e.lieuExecution === "Salle infirmier";

export const examenTermine = (e: ExamenLabo) =>
  e.statut === "Prêt" || e.statut === "Validé" || e.statut === "Résultat disponible";

/** Bandelette urinaire : paramètres et cotations usuelles. */
export const PARAMETRES_BANDELETTE = ["Leucocytes", "Nitrites", "Protéines", "Glucose", "Corps cétoniques", "Sang", "pH", "Densité"] as const;
export const COTATIONS_BANDELETTE = ["Négatif", "Traces", "+", "++", "+++"] as const;

/** Glycémie : interprétation indicative (g/L). */
export function interpreterGlycemie(valeurGL: number, aJeun: boolean): { libelle: string; anormal: boolean; critique: boolean } {
  if (valeurGL < 0.5) return { libelle: "Hypoglycémie sévère", anormal: true, critique: true };
  if (valeurGL < 0.7) return { libelle: "Hypoglycémie", anormal: true, critique: false };
  if (valeurGL >= 3) return { libelle: "Hyperglycémie majeure", anormal: true, critique: true };
  if (aJeun) {
    if (valeurGL >= 1.26) return { libelle: "Hyperglycémie à jeun (≥ 1,26 g/L)", anormal: true, critique: false };
    if (valeurGL > 1.1) return { libelle: "Glycémie à jeun limite (1,10 – 1,25 g/L)", anormal: true, critique: false };
    return { libelle: "Glycémie à jeun normale", anormal: false, critique: false };
  }
  if (valeurGL >= 2) return { libelle: "Hyperglycémie (≥ 2 g/L, hors jeûne)", anormal: true, critique: false };
  return { libelle: "Glycémie normale (hors jeûne)", anormal: false, critique: false };
}

/** Hémoglobine : interprétation indicative (g/dL). */
export function interpreterHb(hb: number): { libelle: string; anormal: boolean; critique: boolean } {
  if (hb < 7) return { libelle: "Anémie sévère (< 7 g/dL)", anormal: true, critique: true };
  if (hb < 10) return { libelle: "Anémie modérée (7 – 9,9 g/dL)", anormal: true, critique: false };
  if (hb < 11) return { libelle: "Anémie légère (10 – 10,9 g/dL)", anormal: true, critique: false };
  return { libelle: "Taux d'hémoglobine dans les normes", anormal: false, critique: false };
}
