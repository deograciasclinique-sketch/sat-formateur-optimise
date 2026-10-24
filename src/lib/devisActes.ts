/**
 * Ordre du médecin → coût pour le patient (secrétariat).
 *
 * À partir de la décision du médecin (conduite à tenir, injectables, ordonnance, examens labo),
 * propose automatiquement les lignes à facturer, avec les prix de la grille « Actes & Tarifs »
 * et les prix de vente de la pharmacie. La secrétaire peut tout corriger avant d'encaisser.
 */
import { ActeTarifaire, Consultation, ExamenLabo, Medicament } from "../types";
import { normaliser } from "./bilans";

export type LigneDevis = {
  uid: string;
  designation: string;
  qte: number;
  prix: number;
  /** origine de la ligne (pour l'affichage) */
  source: "soin" | "injectable" | "médicament" | "examen" | "ajout";
  /** prix à fixer par la secrétaire (rien trouvé dans la grille) */
  aTarifer?: boolean;
  examenId?: string;
};

let compteur = 0;
const uid = () => `l${Date.now().toString(36)}${(compteur++).toString(36)}`;

const MOTS_VIDES = new Set(["de", "du", "des", "la", "le", "les", "et", "a", "au", "aux", "en", "par", "pour", "sur", "simple", "acte", "soin", "soins"]);
const motsCles = (t: string) => normaliser(t).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((m) => m.length >= 4 && !MOTS_VIDES.has(m));

/** Acte de la grille qui correspond le mieux à un texte libre (« faire un pansement… »). */
export function acteDepuisTexte(texte: string, actes: ActeTarifaire[], exclureCategories: string[] = ["Consultation", "Laboratoire"]): ActeTarifaire | undefined {
  const t = " " + normaliser(texte).replace(/[^a-z0-9 ]/g, " ") + " ";
  let meilleur: { a: ActeTarifaire; score: number } | undefined;
  for (const a of actes) {
    if (exclureCategories.some((c) => normaliser(a.categorie || "") === normaliser(c))) continue;
    const nom = normaliser(a.nom).replace(/\(.*?\)/g, "").replace(/[^a-z0-9 ]/g, " ").trim();
    let score = 0;
    if (nom && t.includes(" " + nom + " ")) score = 100 + nom.length;
    else {
      const mots = motsCles(nom);
      const trouves = mots.filter((m) => t.includes(" " + m) || t.includes(m));
      if (mots.length && trouves.length === mots.length) score = 50 + trouves.join("").length;
      else if (trouves.length) score = trouves.join("").length;
    }
    if (score >= 5 && (!meilleur || score > meilleur.score)) meilleur = { a, score };
  }
  return meilleur?.a;
}

/** Acte d'injection selon la voie (perfusion, IV, IM, SC…). */
function acteInjection(voie: string, actes: ActeTarifaire[]): ActeTarifaire | undefined {
  const v = normaliser(voie);
  const cherche = (re: RegExp) => actes.find((a) => re.test(normaliser(a.nom)));
  if (v.includes("perfusion")) return cherche(/perfusion/) || cherche(/injection/);
  if (/\biv\b|intraveineuse/.test(v)) return cherche(/(\biv\b|intraveineuse)/) || cherche(/injection/);
  if (/\bim\b|intramusculaire/.test(v)) return cherche(/(\bim\b|intramusculaire)/) || cherche(/injection/);
  if (/\bsc\b|sous.?cutan/.test(v)) return cherche(/(\bsc\b|sous.?cutan)/) || cherche(/injection/);
  return cherche(/injection/);
}

const memePatient = (a: string, b: string) => normaliser(a) === normaliser(b);

/** Examens labo demandés pour ce patient lors de cette visite et pas encore facturés. */
export function examensAFacturer(c: Consultation, examens: ExamenLabo[]): ExamenLabo[] {
  return examens.filter((e) => !e.facture && memePatient(e.patient, c.patient) && (e.dateDemande || "") >= (c.date || ""));
}

/** Lignes proposées automatiquement pour l'ordre du médecin. */
export function proposerDevis(c: Consultation, actes: ActeTarifaire[], medicaments: Medicament[], examens: ExamenLabo[]): LigneDevis[] {
  const lignes: LigneDevis[] = [];
  const ajouterActe = (a: ActeTarifaire | undefined, libre: string, source: LigneDevis["source"]) => {
    if (a) {
      const ex = lignes.find((l) => l.designation === a.nom && !l.aTarifer);
      if (ex) ex.qte += 1;
      else lignes.push({ uid: uid(), designation: a.nom, qte: 1, prix: a.prix, source });
    } else if (libre.trim()) {
      lignes.push({ uid: uid(), designation: libre.trim().slice(0, 120), qte: 1, prix: 0, source, aTarifer: true });
    }
  };

  // 1) Conduite à tenir : soins infirmiers et injectables.
  for (const it of c.conduiteATenir || []) {
    if (it.type === "Voie injectable" && it.injectable) {
      const inj = it.injectable;
      ajouterActe(acteInjection(inj.voie || "", actes), `Injection ${inj.voie || ""} — ${inj.produit}`, "injectable");
      const med = inj.medicamentId ? medicaments.find((m) => m.id === inj.medicamentId) : undefined;
      if (med && med.prixVente > 0) lignes.push({ uid: uid(), designation: `${med.nom}${med.dosage ? " " + med.dosage : ""}`, qte: 1, prix: med.prixVente, source: "médicament" });
    } else if (it.type === "Soins infirmiers") {
      ajouterActe(acteDepuisTexte(it.description, actes), `Soin : ${it.description}`, "soin");
    }
  }
  // 2) Consignes libres du médecin pour la salle infirmière (si aucun soin structuré).
  if (c.consignesInfirmier && !lignes.some((l) => l.source === "soin" || l.source === "injectable")) {
    const a = acteDepuisTexte(c.consignesInfirmier, actes);
    ajouterActe(a, `Soins : ${c.consignesInfirmier}`, "soin");
  }
  // 3) Ordonnance : médicaments de la pharmacie du cabinet.
  for (const l of c.ordonnance || []) {
    const med = l.medicamentId ? medicaments.find((m) => m.id === l.medicamentId) : undefined;
    if (med && med.prixVente > 0) lignes.push({ uid: uid(), designation: med.nom + (med.dosage ? " " + med.dosage : ""), qte: Math.max(1, l.quantitePrescrite || 1), prix: med.prixVente, source: "médicament" });
  }
  // 4) Examens de laboratoire demandés.
  for (const e of examensAFacturer(c, examens)) {
    lignes.push({ uid: uid(), designation: `🧪 ${e.bilan || e.analyses || e.examen || "Examen"}`, qte: 1, prix: e.prix || 0, source: "examen", aTarifer: !e.prix, examenId: e.id });
  }
  return lignes;
}

export const totalDevis = (lignes: { qte: number; prix: number }[]) => lignes.reduce((s, l) => s + (l.qte || 0) * (l.prix || 0), 0);

export const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

/** Message pour annoncer le coût au patient (WhatsApp / SMS). */
export function texteDevis(c: Consultation, lignes: { designation: string; qte: number; prix: number }[], nomCabinet: string): string {
  const l = [`*${nomCabinet}* — Coût des soins prescrits`, `Patient : ${c.patient}`, ""];
  lignes.forEach((x) => l.push(`• ${x.designation}${x.qte > 1 ? ` × ${x.qte}` : ""} : ${fcfa(x.qte * x.prix)}`));
  l.push("", `*Total : ${fcfa(totalDevis(lignes))}*`, "À régler au secrétariat avant les soins. Merci.");
  return l.join("\n");
}
