/**
 * TDR (tests de diagnostic rapide) — Paludisme et Dengue.
 *
 * Reconnaissance des TDR dans les demandes d'examen, interprétation du TDR
 * Dengue combiné (NS1 / IgM / IgG) et règles de classement pour le TLOH :
 *  - TDR Paludisme : Positif / Négatif (obligatoire). Le classement PS / PG
 *    est décidé par le médecin selon la clinique (champ classementPalu de la
 *    consultation), jamais automatiquement.
 *  - TDR Dengue : NS1 + et/ou IgM + => cas probable ; sinon le patient reste
 *    cas suspect.
 */

export type ResultatTDR = "Positif" | "Négatif";

export interface TdrDengue {
  ns1?: ResultatTDR;
  igm?: ResultatTDR;
  igg?: ResultatTDR;
  jourFievre?: number; // J1 = premier jour de fièvre
}

const norm = (s?: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La demande contient-elle un TDR paludisme ? */
export function demandeTdrPalu(analyses?: string): boolean {
  const t = norm(analyses);
  return /\b(tdr|trp|test (de diagnostic )?rapide|test rapide)\b/.test(t) && /palu|malaria|plasmodium/.test(t);
}

/** La demande contient-elle un TDR (ou test rapide) dengue ? */
export function demandeTdrDengue(analyses?: string): boolean {
  const t = norm(analyses);
  return /dengue/.test(t);
}

/** Le TDR Dengue est-il complètement saisi (les 3 bandes) ? */
export const dengueComplet = (d?: TdrDengue) => !!(d && d.ns1 && d.igm && d.igg);

/** TDR Dengue positif au sens de la surveillance : NS1 + et/ou IgM +. */
export const denguePositif = (d?: TdrDengue) => !!d && (d.ns1 === "Positif" || d.igm === "Positif");

export interface InterpretationDengue {
  libelle: string;
  probable: boolean;
  niveau: "positif" | "negatif" | "a_verifier";
}

export function interpreterDengue(d?: TdrDengue): InterpretationDengue | null {
  if (!dengueComplet(d)) return null;
  const { ns1, igm, igg } = d!;
  if (ns1 === "Positif") return { libelle: "Infection aiguë à dengue (phase précoce, NS1 positif)", probable: true, niveau: "positif" };
  if (igm === "Positif" && igg === "Positif") return { libelle: "Infection secondaire récente à dengue (IgM + et IgG +)", probable: true, niveau: "positif" };
  if (igm === "Positif") return { libelle: "Infection primaire récente à dengue (IgM +)", probable: true, niveau: "positif" };
  if (igg === "Positif") return { libelle: "IgG seuls : infection ancienne ou secondaire tardive — à corréler à la clinique", probable: false, niveau: "a_verifier" };
  return { libelle: "TDR Dengue négatif (NS1 −, IgM −, IgG −)", probable: false, niveau: "negatif" };
}

/**
 * Alerte quand un résultat négatif tombe à un moment où le test est peu
 * fiable : le NS1 est surtout détectable les 5 premiers jours de fièvre, les
 * IgM apparaissent plutôt après le 5e jour.
 */
export function alerteDengue(d?: TdrDengue): string | null {
  if (!dengueComplet(d) || denguePositif(d) || !d!.jourFievre) return null;
  const j = d!.jourFievre;
  if (j > 5 && d!.ns1 === "Négatif")
    return `NS1 négatif au J${j} de fièvre : le NS1 peut déjà avoir disparu. Un TDR négatif n'exclut pas la dengue — à interpréter avec prudence, recontrôler si la clinique est évocatrice.`;
  if (j <= 5 && d!.igm === "Négatif")
    return `IgM négatif au J${j} de fièvre : les IgM peuvent ne pas être encore apparues. Un TDR négatif n'exclut pas la dengue — recontrôler après J5 si la clinique est évocatrice.`;
  return null;
}

/** Texte de résultat lisible, repris dans le bulletin d'analyse. */
export function texteResultatTdr(palu?: ResultatTDR, dengue?: TdrDengue): string {
  const L: string[] = [];
  if (palu) L.push(`TDR Paludisme : ${palu.toUpperCase()}`);
  if (dengueComplet(dengue)) {
    L.push(`TDR Dengue : NS1 ${dengue!.ns1 === "Positif" ? "+" : "−"} · IgM ${dengue!.igm === "Positif" ? "+" : "−"} · IgG ${dengue!.igg === "Positif" ? "+" : "−"}${dengue!.jourFievre ? ` (J${dengue!.jourFievre} de fièvre)` : ""}`);
    const i = interpreterDengue(dengue);
    if (i) L.push(`→ ${i.libelle}`);
  }
  return L.join("\n");
}
