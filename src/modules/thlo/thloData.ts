/**
 * THLO — Surveillance épidémiologique hebdomadaire (SIMR, Burkina Faso).
 *
 * Moteur de calcul : semaines épidémiologiques (lundi → dimanche), liste des
 * maladies surveillées et comptage automatique des cas et décès à partir
 * des dossiers de l'application (consultations, fiches pédiatriques,
 * hospitalisations).
 */

import { Consultation, ExamenLabo, FichePediatrique, Hospitalisation } from "../../types";
import { demandeTdrDengue, demandeTdrPalu, denguePositif, dengueComplet } from "./tdr";

export const TRANCHES_AGE = ["0-11 mois", "1-4 ans", "5-14 ans", "15 ans et +"] as const;
export type Compte = [number, number, number, number];
export const zero = (): Compte => [0, 0, 0, 0];
export const somme = (c: Compte) => c[0] + c[1] + c[2] + c[3];

export interface MaladieTHLO {
  id: string;
  nom: string;
  immediate?: boolean; // à notifier aussi dans les 24 h
  motsCles: string[];  // recherchés dans le diagnostic (sans accents, minuscules)
  exclut?: string[];   // si un de ces mots est présent, le cas va à une autre ligne
}

// Liste des maladies de la fiche hebdomadaire. Elle couvre les maladies à
// déclaration obligatoire de l'assistant MDO de l'app et les autres
// affections sous surveillance hebdomadaire.
export const MALADIES_THLO: MaladieTHLO[] = [
  { id: "meningite", nom: "Méningite", immediate: true, motsCles: ["mening"] },
  { id: "rougeole", nom: "Rougeole", immediate: true, motsCles: ["rougeole"] },
  { id: "fievre_jaune", nom: "Fièvre jaune", immediate: true, motsCles: ["fievre jaune"] },
  { id: "cholera", nom: "Choléra", immediate: true, motsCles: ["cholera"] },
  { id: "pfa", nom: "Paralysie flasque aiguë (PFA)", immediate: true, motsCles: ["paralysie flasque", "pfa", "poliomyel"] },
  { id: "tetanos_neonatal", nom: "Tétanos néonatal", immediate: true, motsCles: ["tetanos neonatal"] },
  { id: "dengue", nom: "Dengue", immediate: true, motsCles: ["dengue"] },
  { id: "fhv", nom: "Fièvres hémorragiques virales (Ebola, Marburg, Lassa)", immediate: true, motsCles: ["ebola", "marburg", "lassa", "fievre hemorragique"] },
  { id: "mpox", nom: "Mpox (variole simienne)", immediate: true, motsCles: ["mpox", "monkeypox", "variole simienne", "variole du singe"] },
  { id: "rage", nom: "Rage humaine", immediate: true, motsCles: ["rage humaine", "rage"] , exclut: ["morsure"] },
  { id: "covid", nom: "COVID-19", immediate: true, motsCles: ["covid", "sars-cov"] },
  { id: "diphterie", nom: "Diphtérie", immediate: true, motsCles: ["diphter"] },
  { id: "palu_grave", nom: "Paludisme grave", motsCles: ["paludisme grave", "palu grave", "paludisme severe", "neuropalu", "paludisme compliqu", "acces palustre grave", "palustre grave", "palustre severe"] },
  { id: "palu_simple", nom: "Paludisme simple", motsCles: ["paludisme", "palu ", "palustre", "plasmodium"], exclut: ["grave", "severe", "neuropalu", "compliqu"] },
  { id: "diarrhee_sanglante", nom: "Diarrhée sanglante (shigellose)", motsCles: ["diarrhee sanglante", "shigell", "dysenter"] },
  { id: "typhoide", nom: "Fièvre typhoïde", motsCles: ["typho"] },
  { id: "tuberculose", nom: "Tuberculose", motsCles: ["tubercul"] },
  { id: "coqueluche", nom: "Coqueluche", motsCles: ["coqueluche"] },
  { id: "grippe_iras", nom: "Grippe / IRAS", motsCles: ["grippe", "iras", "infection respiratoire aigue severe"] },
  { id: "morsures", nom: "Morsures de chien / animaux suspects de rage", motsCles: ["morsure"] },
];

/* ------------------------------------------------------------------ */
/*  Semaines épidémiologiques (lundi → dimanche, numérotation ISO)      */
/* ------------------------------------------------------------------ */

const pad = (n: number) => (n < 10 ? "0" : "") + n;
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string) => new Date(iso + "T00:00:00");

export interface SemaineEpi {
  id: string;     // "2026-S39"
  annee: number;
  numero: number;
  debut: string;  // lundi
  fin: string;    // dimanche
}

export function semaineDe(iso: string): SemaineEpi {
  const d = parse(iso);
  const jour = (d.getDay() + 6) % 7; // lundi = 0
  const lundi = new Date(d); lundi.setDate(d.getDate() - jour);
  const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() + 6);
  // Numéro ISO : la semaine contenant le jeudi.
  const jeudi = new Date(lundi); jeudi.setDate(lundi.getDate() + 3);
  const annee = jeudi.getFullYear();
  const premierJeudi = new Date(annee, 0, 4);
  const lundiS1 = new Date(premierJeudi); lundiS1.setDate(premierJeudi.getDate() - ((premierJeudi.getDay() + 6) % 7));
  const numero = Math.round((lundi.getTime() - lundiS1.getTime()) / (7 * 86400000)) + 1;
  return { id: `${annee}-S${pad(numero)}`, annee, numero, debut: isoDate(lundi), fin: isoDate(dimanche) };
}

export function decalerSemaine(s: SemaineEpi, n: number): SemaineEpi {
  const d = parse(s.debut); d.setDate(d.getDate() + 7 * n);
  return semaineDe(isoDate(d));
}

/** La dernière semaine complète (celle qu'on transmet en début de semaine). */
export function semainePrecedente(today = isoDate(new Date())): SemaineEpi {
  return decalerSemaine(semaineDe(today), -1);
}

export const libelleSemaine = (s: SemaineEpi) => {
  const f = (iso: string) => parse(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `S${pad(s.numero)} / ${s.annee} — du lun. ${f(s.debut)} au dim. ${f(s.fin)}`;
};

/* ------------------------------------------------------------------ */
/*  Reconnaissance des diagnostics                                     */
/* ------------------------------------------------------------------ */

const norm = (s?: string) =>
  " " + (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9-]+/g, " ") + " ";

// Écarte les mentions niées : "paludisme négatif", "pas de méningite",
// "méningite écartée", "TDR palu négatif"…
function estNie(texte: string, pos: number, longueur: number): boolean {
  const avant = texte.slice(Math.max(0, pos - 18), pos);
  const apres = texte.slice(pos + longueur, pos + longueur + 22);
  return /\b(pas de|pas d|sans|non|absence de|elimin|ecart)\b/.test(avant) || /\b(negati|ecarte|exclu|elimine|infirme)/.test(apres);
}

/** Maladies reconnues dans un texte de diagnostic. */
export function maladiesDansTexte(texte?: string): MaladieTHLO[] {
  // "TDR+", "GE +" : le signe + veut dire positif.
  const t = norm((texte || "").replace(/\+/g, " positif "));
  if (t.trim() === "") return [];
  return MALADIES_THLO.filter((m) => {
    const trouve = m.motsCles.some((k) => {
      const key = k;
      let from = 0;
      for (;;) {
        const pos = t.indexOf(key, from);
        if (pos === -1) return false;
        // Le mot-clé doit commencer un mot.
        const debutMot = t[pos - 1] === " " || pos === 0;
        if (debutMot && !estNie(t, pos, key.length)) return true;
        from = pos + 1;
      }
    });
    if (!trouve) return false;
    if (m.exclut && m.exclut.some((x) => t.includes(x))) return false;
    return true;
  });
}

export function trancheAge(ageAns?: number | null): number {
  if (ageAns === undefined || ageAns === null || isNaN(ageAns)) return 3;
  if (ageAns < 1) return 0;
  if (ageAns < 5) return 1;
  if (ageAns < 15) return 2;
  return 3;
}

/* ------------------------------------------------------------------ */
/*  Comptage automatique                                              */
/* ------------------------------------------------------------------ */

export interface CasTHLO {
  maladieId: string;
  patient: string;
  date: string;
  tranche: number;
  source: string;
  texte: string;
  ageInconnu?: boolean;
  deces?: boolean;
  refId: string;
}

/** Une ligne de TDR (laboratoire) prise en compte dans le TLOH. */
export interface TdrTLOH {
  type: "palu" | "dengue";
  patient: string;
  date: string;
  resultat: "Positif" | "Négatif" | "En attente";
  examenId: string;
}

export interface BlocTDR {
  palu: TdrTLOH[];        // TDR palu réalisés ou en attente dans la semaine
  dengue: TdrTLOH[];
  paluNonClasses: TdrTLOH[]; // TDR palu + sans classement PS / PG par le médecin
  dengueSuspects: string[];  // patients (TDR dengue fait ou diagnostic dengue)
  dengueProbables: string[]; // patients avec NS1 + et/ou IgM +
}

export interface ResultatAuto {
  cas: Record<string, Compte>;
  deces: Record<string, Compte>;
  details: CasTHLO[];
  nbDossiersAnalyses: number;
  sansDiagnostic: number; // consultations de la semaine encore sans diagnostic
  tdr: BlocTDR;
}

const normNom = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function compterSemaine(
  semaine: SemaineEpi,
  consultations: Consultation[],
  pediatrie: FichePediatrique[],
  hospitalisations: Hospitalisation[],
  examens: ExamenLabo[] = []
): ResultatAuto {
  const dansSemaine = (d?: string) => !!d && d >= semaine.debut && d <= semaine.fin;
  const details: CasTHLO[] = [];
  const dejaCompte = new Set<string>(); // un patient = un cas par maladie et par semaine
  let nb = 0;
  let sansDiag = 0;

  const ajouter = (c: CasTHLO) => {
    const k = `${c.maladieId}|${normNom(c.patient)}|${c.deces ? "d" : "c"}`;
    if (dejaCompte.has(k)) return;
    dejaCompte.add(k);
    details.push(c);
  };

  consultations.filter((c) => dansSemaine(c.date)).forEach((c) => {
    nb++;
    // Le diagnostic final (de sortie) prime sur le diagnostic de présomption.
    const texte = [c.diagnosticFinal || c.diagnostic, c.mdoDeclare].filter(Boolean).join(" · ");
    if (!texte.trim() && !c.classementPalu) sansDiag++;
    let maladies = maladiesDansTexte(texte);
    // Le classement PS / PG choisi par le médecin prime sur le texte du diagnostic.
    if (c.classementPalu) {
      maladies = maladies.filter((m) => m.id !== "palu_simple" && m.id !== "palu_grave");
      const m = MALADIES_THLO.find((x) => x.id === (c.classementPalu === "PG" ? "palu_grave" : "palu_simple"));
      if (m) maladies.push(m);
    }
    maladies.forEach((m) =>
      ajouter({
        // Un âge à 0 correspond le plus souvent à un âge non saisi à
        // l'accueil : il est signalé pour vérification.
        maladieId: m.id, patient: c.patient, date: c.date, tranche: trancheAge(c.age > 0 ? c.age : undefined),
        ageInconnu: !(c.age > 0), source: "Consultation",
        texte: c.classementPalu && (m.id === "palu_simple" || m.id === "palu_grave") ? `Classé ${c.classementPalu} par le médecin${texte ? ` · ${texte}` : ""}` : texte,
        refId: c.id,
      })
    );
  });

  pediatrie.filter((p) => dansSemaine(p.date)).forEach((p) => {
    nb++;
    const age = typeof p.ageMois === "number" ? p.ageMois / 12 : undefined;
    maladiesDansTexte(p.diagnostic).forEach((m) =>
      ajouter({ maladieId: m.id, patient: p.patient, date: p.date, tranche: trancheAge(age), ageInconnu: age === undefined, source: "Pédiatrie", texte: p.diagnostic, refId: p.id })
    );
  });

  // Décès : hospitalisations sorties avec le statut « Décès » pendant la semaine.
  hospitalisations
    .filter((h) => h.statut === "Décès" && dansSemaine(h.dateSortie || h.dateAdmission))
    .forEach((h) => {
      const texte = [h.diagnosticSortie, h.motif].filter(Boolean).join(" · ");
      const cons = consultations.find((c) => normNom(c.patient) === normNom(h.patient) && c.age > 0);
      maladiesDansTexte(texte).forEach((m) =>
        ajouter({
          maladieId: m.id, patient: h.patient, date: h.dateSortie || h.dateAdmission, tranche: trancheAge(cons?.age),
          ageInconnu: !cons, source: "Hospitalisation (décès)", texte, refId: h.id, deces: true,
        })
      );
    });

  const cas: Record<string, Compte> = {};
  const deces: Record<string, Compte> = {};
  MALADIES_THLO.forEach((m) => { cas[m.id] = zero(); deces[m.id] = zero(); });
  details.forEach((d) => {
    (d.deces ? deces : cas)[d.maladieId][d.tranche]++;
  });
  // Un décès est aussi un cas : si le patient décédé n'a pas été compté
  // comme cas (ex. arrivé directement en hospitalisation), on l'ajoute.
  details.filter((d) => d.deces).forEach((d) => {
    const k = `${d.maladieId}|${normNom(d.patient)}|c`;
    if (!dejaCompte.has(k)) { dejaCompte.add(k); cas[d.maladieId][d.tranche]++; }
  });

  // TDR du laboratoire : un TDR est compté dans la semaine de son résultat
  // (ou de sa demande s'il est encore en attente).
  const palu: TdrTLOH[] = [];
  const dengue: TdrTLOH[] = [];
  examens.forEach((e) => {
    const aPalu = demandeTdrPalu(e.analyses || e.examen) || !!e.tdrPalu;
    const aDengue = demandeTdrDengue(e.analyses || e.examen) || !!e.tdrDengue;
    if (!aPalu && !aDengue) return;
    if (aPalu) {
      // Anciens résultats saisis en texte libre (avant les boutons Positif / Négatif).
      const t = (e.resultat || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const texteRes: "Positif" | "Négatif" | undefined = !t.trim() ? undefined : /negati|\bneg\b|absence/.test(t) ? "Négatif" : /positi|\bpos\b|falciparum|trophozo|\+/.test(t) ? "Positif" : undefined;
      const res = e.tdrPalu || (!aDengue ? texteRes : undefined);
      const date = res ? (e.dateResultat || e.dateDemande) : e.dateDemande;
      if (dansSemaine(date)) palu.push({ type: "palu", patient: e.patient, date, resultat: res || "En attente", examenId: e.id });
    }
    if (aDengue) {
      const fait = dengueComplet(e.tdrDengue);
      const date = fait ? (e.dateResultat || e.dateDemande) : e.dateDemande;
      if (dansSemaine(date))
        dengue.push({ type: "dengue", patient: e.patient, date, resultat: fait ? (denguePositif(e.tdrDengue) ? "Positif" : "Négatif") : "En attente", examenId: e.id });
    }
  });

  const classes = new Set(
    details.filter((d) => !d.deces && (d.maladieId === "palu_simple" || d.maladieId === "palu_grave")).map((d) => normNom(d.patient))
  );
  // Un patient classé PS/PG dans une consultation récente (cette semaine ou
  // la précédente) est considéré comme classé.
  const debutLarge = new Date(semaine.debut + "T00:00:00"); debutLarge.setDate(debutLarge.getDate() - 7);
  const dl = isoDate(debutLarge);
  consultations.filter((c) => c.classementPalu && c.date >= dl && c.date <= semaine.fin).forEach((c) => classes.add(normNom(c.patient)));
  const vus = new Set<string>();
  const paluNonClasses = palu.filter((t) => {
    const k = normNom(t.patient);
    if (t.resultat !== "Positif" || classes.has(k) || vus.has(k)) return false;
    vus.add(k);
    return true;
  });

  const suspects = new Map<string, string>();
  dengue.forEach((t) => suspects.set(normNom(t.patient), t.patient));
  details.filter((d) => d.maladieId === "dengue" && !d.deces).forEach((d) => suspects.set(normNom(d.patient), d.patient));
  const probables = new Map<string, string>();
  dengue.filter((t) => t.resultat === "Positif").forEach((t) => probables.set(normNom(t.patient), t.patient));

  return {
    cas, deces, details, nbDossiersAnalyses: nb, sansDiagnostic: sansDiag,
    tdr: { palu, dengue, paluNonClasses, dengueSuspects: [...suspects.values()], dengueProbables: [...probables.values()] },
  };
}

/* ------------------------------------------------------------------ */
/*  Fiche TLOH (format du District)                                    */
/* ------------------------------------------------------------------ */

export const CHAMPS_FICHE = [
  { id: "tdr_realises", label: "TDR réalisés", groupe: "Paludisme" },
  { id: "tdr_pos", label: "TDR +", groupe: "Paludisme" },
  { id: "tdr_neg", label: "TDR −", groupe: "Paludisme" },
  { id: "ps", label: "PS (paludisme simple)", groupe: "Paludisme" },
  { id: "pg", label: "PG (paludisme grave)", groupe: "Paludisme" },
  { id: "dengue_tdr_realises", label: "TDR Dengue réalisés", groupe: "Dengue" },
  { id: "dengue_tdr_pos", label: "TDR Dengue +", groupe: "Dengue" },
  { id: "dengue_tdr_neg", label: "TDR Dengue −", groupe: "Dengue" },
  { id: "dengue_suspects", label: "Dengue — cas suspects", groupe: "Dengue" },
  { id: "dengue_probables", label: "Dengue — cas probables", groupe: "Dengue" },
  { id: "autres", label: "Autres maladies sous surveillance (cas)", groupe: "Autres" },
] as const;
export type ChampFiche = (typeof CHAMPS_FICHE)[number]["id"];
export type Fiche = Record<ChampFiche, number>;

/** Valeurs automatiques de la fiche TLOH. */
export function ficheAuto(auto: ResultatAuto, v: { cas: Record<string, Compte> }): Fiche {
  const n = (r: "Positif" | "Négatif", l: TdrTLOH[]) => l.filter((t) => t.resultat === r).length;
  const autres = MALADIES_THLO.filter((m) => !["palu_simple", "palu_grave", "dengue"].includes(m.id))
    .reduce((s, m) => s + somme(v.cas[m.id]), 0);
  return {
    tdr_realises: n("Positif", auto.tdr.palu) + n("Négatif", auto.tdr.palu),
    tdr_pos: n("Positif", auto.tdr.palu),
    tdr_neg: n("Négatif", auto.tdr.palu),
    ps: somme(v.cas.palu_simple),
    pg: somme(v.cas.palu_grave),
    dengue_tdr_realises: n("Positif", auto.tdr.dengue) + n("Négatif", auto.tdr.dengue),
    dengue_tdr_pos: n("Positif", auto.tdr.dengue),
    dengue_tdr_neg: n("Négatif", auto.tdr.dengue),
    dengue_suspects: auto.tdr.dengueSuspects.length,
    dengue_probables: auto.tdr.dengueProbables.length,
    autres,
  };
}

/** Fiche finale : figée si le rapport est validé, sinon automatique + corrections. */
export function ficheFinale(r: RapportTHLO | undefined, a: Fiche): Fiche {
  if (r?.ficheFigee && r.statut !== "Brouillon") return { ...a, ...r.ficheFigee };
  const out = { ...a };
  Object.entries(r?.correctionsFiche || {}).forEach(([k, val]) => {
    if (val !== null && val !== undefined && k in out) (out as any)[k] = val;
  });
  return out;
}

/* ------------------------------------------------------------------ */
/*  Rapport enregistré                                                 */
/* ------------------------------------------------------------------ */

export type StatutRapport = "Brouillon" | "Validé" | "Transmis";

export interface RapportTHLO {
  id: string;          // = id de la semaine ("2026-S39")
  annee: number;
  semaine: number;
  debut: string;
  fin: string;
  // Valeurs corrigées à la main (sinon, valeurs automatiques).
  // Correction case par case : null = valeur automatique conservée.
  corrections: Record<string, { cas?: (number | null)[]; deces?: (number | null)[] }>;
  // Chiffres figés au moment de la validation (ce qui a été transmis).
  valeursFigees?: { cas: Record<string, Compte>; deces: Record<string, Compte> };
  // Fiche TLOH (TDR, PS/PG, dengue, autres) : corrections et valeurs figées.
  correctionsFiche?: Partial<Record<ChampFiche, number | null>>;
  ficheFigee?: Partial<Fiche>;
  observations: string;
  redigePar: string;
  statut: StatutRapport;
  valideLe?: string;
  transmisLe?: string;
  transmisPar?: string;
  moyenTransmission?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigTHLO {
  formationSanitaire: string;
  district: string;
  region: string;
  responsable: string;
  telephoneDistrict: string; // point focal surveillance du District
  jourLimite: number;        // 1 = lundi … 7 = dimanche (jour limite de transmission)
  heureTransmission?: string; // "08:00" : heure de transmission le jour limite
}

export const CONFIG_THLO_DEFAUT: ConfigTHLO = {
  formationSanitaire: "CSI DEO GRACIAS",
  district: "",
  region: "",
  responsable: "",
  telephoneDistrict: "",
  jourLimite: 1,
  heureTransmission: "08:00",
};

/** Complète une configuration enregistrée avant l'ajout de l'heure de transmission. */
export function normaliserConfig(c?: Partial<ConfigTHLO>): ConfigTHLO {
  const out: ConfigTHLO = { ...CONFIG_THLO_DEFAUT, ...(c || {}) };
  if (!c?.heureTransmission) {
    // Règle du cabinet : le TLOH part chaque lundi à 8h00.
    out.jourLimite = 1;
    out.heureTransmission = "08:00";
  }
  if (!out.formationSanitaire || out.formationSanitaire === "Cabinet Privé de Soins DEO-GRACIAS") out.formationSanitaire = "CSI DEO GRACIAS";
  return out;
}

/** Moment (date + heure) de transmission attendu pour une semaine. */
export function momentTransmission(s: SemaineEpi, cfg: ConfigTHLO): Date {
  const [h, m] = (cfg.heureTransmission || "08:00").split(":").map((x) => parseInt(x, 10) || 0);
  const d = new Date(dateLimite(s, cfg) + "T00:00:00");
  d.setHours(h, m, 0, 0);
  return d;
}

/** Valeurs finales d'une ligne : figées si le rapport est validé, sinon auto + corrections. */
export function valeursFinales(r: RapportTHLO | undefined, auto: ResultatAuto) {
  const cas: Record<string, Compte> = {};
  const deces: Record<string, Compte> = {};
  MALADIES_THLO.forEach((m) => {
    if (r?.valeursFigees && r.statut !== "Brouillon") {
      cas[m.id] = r.valeursFigees.cas[m.id] || zero();
      deces[m.id] = r.valeursFigees.deces[m.id] || zero();
    } else {
      const fusion = (corr: (number | null)[] | undefined, a: Compte): Compte =>
        a.map((v, i) => (corr && corr[i] !== null && corr[i] !== undefined ? (corr[i] as number) : v)) as Compte;
      cas[m.id] = fusion(r?.corrections?.[m.id]?.cas, auto.cas[m.id]);
      deces[m.id] = fusion(r?.corrections?.[m.id]?.deces, auto.deces[m.id]);
    }
  });
  return { cas, deces };
}

/** Date limite de transmission du rapport d'une semaine (jour de la semaine suivante). */
export function dateLimite(s: SemaineEpi, cfg: ConfigTHLO): string {
  const d = parse(s.fin);
  d.setDate(d.getDate() + Math.min(7, Math.max(1, cfg.jourLimite || 2)));
  return isoDate(d);
}

export function texteTHLO(
  s: SemaineEpi, cfg: ConfigTHLO, v: { cas: Record<string, Compte>; deces: Record<string, Compte> }, r?: RapportTHLO, fiche?: Fiche
): string {
  const L: string[] = [];
  L.push(`*${cfg.formationSanitaire || "CSI DEO GRACIAS"}*`);
  L.push(`*TLOH N° ${pad(s.numero)}/${s.annee}* — Rapport hebdomadaire de surveillance`);
  L.push(`Semaine ${libelleSemaine(s)}`);
  if (cfg.district) L.push(`District sanitaire : ${cfg.district}${cfg.region ? ` (${cfg.region})` : ""}`);
  L.push("");
  if (fiche) {
    L.push(`*Paludisme* : TDR réalisés ${fiche.tdr_realises} · TDR+ ${fiche.tdr_pos} · TDR− ${fiche.tdr_neg} · PS ${fiche.ps} · PG ${fiche.pg}`);
    L.push(`*Dengue* : TDR réalisés ${fiche.dengue_tdr_realises} (+ ${fiche.dengue_tdr_pos} / − ${fiche.dengue_tdr_neg}) · cas suspects ${fiche.dengue_suspects} · cas probables ${fiche.dengue_probables}`);
    L.push(`*Autres* : ${fiche.autres} cas`);
    L.push("");
  }
  const avecCas = MALADIES_THLO.filter((m) => somme(v.cas[m.id]) > 0 || somme(v.deces[m.id]) > 0);
  if (avecCas.length) {
    L.push("*Cas et décès* (0-11 mois / 1-4 ans / 5-14 ans / 15 ans et +)");
    avecCas.forEach((m) => {
      const c = v.cas[m.id], d = v.deces[m.id];
      L.push(`• ${m.nom}${m.immediate ? " ⚠️" : ""} : ${somme(c)} cas (${c.join("/")}) — ${somme(d)} décès${somme(d) ? ` (${d.join("/")})` : ""}`);
    });
  } else {
    L.push("*Aucun cas* de maladie sous surveillance cette semaine.");
  }
  const sansCas = MALADIES_THLO.filter((m) => !avecCas.includes(m));
  if (sansCas.length && avecCas.length) L.push("", `Zéro cas : ${sansCas.map((m) => m.nom).join(", ")}.`);
  if (r?.observations) L.push("", `*Observations* : ${r.observations}`);
  L.push("", `Rédigé par : ${r?.redigePar || cfg.responsable || "—"}`);
  return L.join("\n");
}
