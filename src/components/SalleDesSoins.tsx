/**
 * Salle des soins (dans la Salle des Infirmiers).
 *
 * 1. Registre de tous les soins réalisés, patient par patient (clé "dg_soins").
 * 2. Plans de traitement (clé "dg_plans_soins") : quand un agent administre
 *    plusieurs médicaments avec une durée (ex. Ceftriaxone 2 fois / jour
 *    pendant 5 jours), l'app garde le plan. Chaque jour, n'importe quel
 *    collègue voit les prises à faire, les fait, et le plan avance jusqu'au
 *    dernier jour. Les prises oubliées sont signalées en retard, et le plan se
 *    termine tout seul quand la dernière dose est donnée.
 * Tout est synchronisé en temps réel entre les postes, comme les consultations.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Syringe, Plus, Search, Trash2, X, User, Clock, Activity, ClipboardList, CalendarClock, CheckCircle2, AlertTriangle, Ban, Pill, Bell,
} from "lucide-react";
import {
  Consultation, Hospitalisation, Medicament, SoinRealise, ConstantesSoin, PlanSoins, LigneTraitement, MedicamentAdministre,
} from "../types";
import { generateUid } from "../data";

/* ------------------------------------------------------------------ */
/*  Listes                                                             */
/* ------------------------------------------------------------------ */

export const TYPES_SOINS = [
  "Administration de médicaments",
  "Injection IM",
  "Injection IV",
  "Injection SC",
  "Perfusion",
  "Pose de voie veineuse",
  "Pansement simple",
  "Pansement complexe",
  "Suture",
  "Ablation de fils",
  "Prélèvement sanguin",
  "Test de diagnostic rapide (TDR)",
  "Aérosol / nébulisation",
  "Oxygénothérapie",
  "Sondage urinaire",
  "Sonde nasogastrique",
  "Lavement",
  "Soins de cordon",
  "Prise de constantes",
  "Autre",
];

export const VOIES_SOIN = ["IV directe", "IV lente", "Perfusion IV", "IM", "SC", "ID", "Orale", "Locale / cutanée", "Inhalée", "Rectale", "Autre"];

export const FREQUENCES = [
  { value: "1/j", label: "1 fois / jour", prises: 1, horaires: ["08:00"] },
  { value: "2/j", label: "2 fois / jour (toutes les 12 h)", prises: 2, horaires: ["08:00", "20:00"] },
  { value: "3/j", label: "3 fois / jour (toutes les 8 h)", prises: 3, horaires: ["06:00", "14:00", "22:00"] },
  { value: "4/j", label: "4 fois / jour (toutes les 6 h)", prises: 4, horaires: ["06:00", "12:00", "18:00", "00:00"] },
  { value: "unique", label: "Dose unique", prises: 1, horaires: [] as string[] },
];
const freqParValeur = (v: string) => FREQUENCES.find((f) => f.value === v) || FREQUENCES[0];

/** Convertit une fréquence écrite ("2 fois / jour…", "Dose unique") en valeur de la liste. */
export function frequenceDepuisTexte(t?: string): string {
  const s = (t || "").toLowerCase();
  if (s.includes("unique")) return "unique";
  const m = s.match(/(\d)\s*fois/);
  if (m && ["1", "2", "3", "4"].includes(m[1])) return `${m[1]}/j`;
  return "1/j";
}
/** Convertit une durée écrite ("5 jours", "Jusqu'au relais oral") en nombre de jours. */
export function dureeDepuisTexte(t?: string): number {
  const m = (t || "").match(/(\d+)/);
  return m ? Math.max(1, Math.min(60, parseInt(m[1], 10))) : 3;
}

/* ------------------------------------------------------------------ */
/*  Outils                                                             */
/* ------------------------------------------------------------------ */

const normNom = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export const localDate = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const localHeure = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const versDate = (iso: string) => new Date(iso + "T00:00:00");
const ajouterJours = (iso: string, n: number) => { const d = versDate(iso); d.setDate(d.getDate() + n); return localDate(d); };
const ecartJours = (de: string, a: string) => Math.round((versDate(a).getTime() - versDate(de).getTime()) / 86400000);

const dateLongue = (iso: string) => {
  const d = versDate(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const dateCourte = (iso: string) => {
  const d = versDate(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
};

// Firestore refuse les valeurs "undefined" : on les retire avant d'enregistrer.
const propre = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

const inputCls = "w-full mt-1 px-3 py-2 rounded border bg-transparent";

/** Texte court des constantes : "T° 38,5 · TA 12/8 · Pouls 96". */
export function texteConstantes(c?: ConstantesSoin): string {
  if (!c) return "";
  const f = (n: number) => n.toLocaleString("fr-FR");
  const parts = [
    c.temperature != null ? `T° ${f(c.temperature)}` : "",
    c.tensionArterielle ? `TA ${c.tensionArterielle}` : "",
    c.pouls != null ? `Pouls ${f(c.pouls)}` : "",
    c.saturationO2 != null ? `SpO₂ ${f(c.saturationO2)}%` : "",
    c.glycemie != null ? `Glyc. ${f(c.glycemie)}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Médicaments d'un soin (ancien format à un seul produit compris). */
export function medicamentsDuSoin(s: SoinRealise): MedicamentAdministre[] {
  if (s.medicaments && s.medicaments.length) return s.medicaments;
  if (s.produit) return [{ produit: s.produit, dose: s.dose, voie: s.voie }];
  return [];
}

const texteMed = (m: { produit: string; dose?: string; voie?: string }) => [m.produit, m.dose, m.voie].filter(Boolean).join(" · ");

/* ------------------------------------------------------------------ */
/*  Suivi d'un plan de traitement                                      */
/* ------------------------------------------------------------------ */

export interface EtatLigne {
  ligne: LigneTraitement;
  jour: number;                 // jour du traitement pour cette ligne (1 = premier jour)
  active: boolean;              // la ligne est à donner ce jour-là
  faites: { heure: string; agent: string }[];
  reste: number;                // prises encore à faire ce jour-là
  manquees: number;             // prises oubliées les jours précédents
  totalFaites: number;
  totalPrevues: number;
}
export interface EtatPlan {
  plan: PlanSoins;
  jour: number;
  joursTotal: number;
  dateFin: string;
  lignes: EtatLigne[];
  resteAujourdhui: number;
  manquees: number;
  complet: boolean;
}

const prisesDuJour = (soins: SoinRealise[], planId: string, ligneId: string, date: string) =>
  soins.filter((s) => s.planId === planId && s.date === date && (s.medicaments || []).some((m) => m.ligneId === ligneId));

export function etatPlan(plan: PlanSoins, soins: SoinRealise[], date: string): EtatPlan {
  const duSoin = soins.filter((s) => s.planId === plan.id);
  const joursTotal = Math.max(1, ...plan.lignes.map((l) => l.dureeJours || 1));
  const jour = ecartJours(plan.dateDebut, date) + 1;
  const lignes: EtatLigne[] = plan.lignes.map((l) => {
    const duree = l.dureeJours || 1;
    const active = jour >= 1 && jour <= duree;
    const faitesJour = prisesDuJour(duSoin, plan.id, l.id, date);
    const faites = faitesJour.map((s) => ({ heure: s.heure, agent: s.agentNom }));
    let manquees = 0;
    for (let j = 1; j < Math.min(jour, duree + 1); j++) {
      const d = ajouterJours(plan.dateDebut, j - 1);
      manquees += Math.max(0, l.prisesParJour - prisesDuJour(duSoin, plan.id, l.id, d).length);
    }
    const totalFaites = duSoin.reduce((n, s) => n + (s.medicaments || []).filter((m) => m.ligneId === l.id).length, 0);
    return {
      ligne: l, jour, active, faites,
      reste: active ? Math.max(0, l.prisesParJour - faites.length) : 0,
      manquees, totalFaites, totalPrevues: l.prisesParJour * duree,
    };
  });
  const complet = lignes.every((x) => x.totalFaites >= x.totalPrevues);
  return {
    plan, jour, joursTotal, dateFin: ajouterJours(plan.dateDebut, joursTotal - 1), lignes,
    resteAujourdhui: lignes.reduce((n, x) => n + x.reste, 0),
    manquees: lignes.reduce((n, x) => n + x.manquees, 0),
    complet,
  };
}

/** Plans « En cours » dont toutes les prises ont été données : passent en « Terminé ». */
export function cloturerPlansComplets(plans: PlanSoins[], soins: SoinRealise[]): PlanSoins[] {
  let change = false;
  const out = plans.map((p) => {
    if (p.statut !== "En cours") return p;
    if (etatPlan(p, soins, localDate()).complet) { change = true; return { ...p, statut: "Terminé" as const }; }
    return p;
  });
  return change ? out : plans;
}

/* ------------------------------------------------------------------ */
/*  Horaires des prises et alertes (30 min avant l'heure)              */
/* ------------------------------------------------------------------ */

export const MINUTES_AVANT_ALERTE = 30;

/** "HH:MM" → minutes depuis minuit. */
const minutesBrutes = (h: string) => {
  const [a, b] = (h || "").split(":").map((x) => parseInt(x, 10));
  return (isNaN(a) ? 0 : a) * 60 + (isNaN(b) ? 0 : b);
};
/** Minutes d'un horaire de prise : « 00:00 » = minuit en fin de journée (24:00). */
const minutesCreneau = (h: string) => { const m = minutesBrutes(h); return m === 0 ? 1440 : m; };

/** Horaires proposés par défaut pour une fréquence. */
export const horairesParDefaut = (frequence: string): string[] => [...freqParValeur(frequence).horaires];

export type StatutCreneau = "fait" | "a_venir" | "bientot" | "retard" | "hors_plan";
export interface CreneauPrise {
  plan: PlanSoins;
  ligne: LigneTraitement;
  date: string;
  heure: string;        // horaire prévu "HH:MM"
  minutes: number;      // minutes depuis minuit (00:00 = 1440)
  fait?: { heure: string; agent: string };
  statut: StatutCreneau;
  ecartMinutes: number; // minutes avant l'heure (> 0) ou de retard (< 0)
}

/**
 * Horaires prévus d'un plan pour un jour donné, avec leur état.
 * Chaque prise enregistrée « couvre » l'horaire prévu le plus proche
 * (une prise donnée jusqu'à 30 min en avance compte pour cet horaire).
 */
export function creneauxDuJour(plan: PlanSoins, soins: SoinRealise[], date: string, maintenant = new Date()): CreneauPrise[] {
  const out: CreneauPrise[] = [];
  const jour = ecartJours(plan.dateDebut, date) + 1;
  const estAujourdhui = date === localDate(maintenant);
  const minNow = maintenant.getHours() * 60 + maintenant.getMinutes();
  // Le 1er jour, les horaires d'avant le début du traitement ne comptent pas.
  const debut = plan.createdAt ? new Date(plan.createdAt) : null;
  const minDebut = debut && !isNaN(debut.getTime()) && localDate(debut) === date && date === plan.dateDebut
    ? debut.getHours() * 60 + debut.getMinutes() : -1;

  plan.lignes.forEach((l) => {
    if (jour < 1 || jour > (l.dureeJours || 1)) return;
    const horaires = (l.horaires || []).filter((h) => /^\d{1,2}:\d{2}$/.test(h));
    if (!horaires.length) return;
    const creneaux = horaires.map((h) => ({ heure: h, minutes: minutesCreneau(h), fait: undefined as undefined | { heure: string; agent: string } }))
      .sort((a, b) => a.minutes - b.minutes);
    const prises = prisesDuJour(soins, plan.id, l.id, date)
      .map((s) => ({ heure: s.heure, agent: s.agentNom, m: minutesBrutes(s.heure) }))
      .sort((a, b) => a.m - b.m);
    prises.forEach((p) => {
      const libres = creneaux.filter((c) => !c.fait);
      if (!libres.length) return;
      const avant = libres.filter((c) => c.minutes <= p.m + MINUTES_AVANT_ALERTE);
      const cible = avant.length ? avant[avant.length - 1] : libres[0];
      cible.fait = { heure: p.heure, agent: p.agent };
    });
    creneaux.forEach((c) => {
      let statut: StatutCreneau;
      const ecart = c.minutes - minNow;
      if (c.fait) statut = "fait";
      else if (minDebut >= 0 && c.minutes < minDebut) statut = "hors_plan";
      else if (!estAujourdhui) statut = date > localDate(maintenant) ? "a_venir" : "retard";
      else if (ecart <= 0) statut = "retard";
      else if (ecart <= MINUTES_AVANT_ALERTE) statut = "bientot";
      else statut = "a_venir";
      out.push({ plan, ligne: l, date, heure: c.minutes === 1440 ? "00:00" : c.heure, minutes: c.minutes, fait: c.fait, statut, ecartMinutes: estAujourdhui ? ecart : 0 });
    });
  });
  return out.sort((a, b) => a.minutes - b.minutes);
}

/** Groupe d'alerte : un patient, un horaire, un ou plusieurs médicaments. */
export interface AlerteSoin {
  cle: string;          // planId|date|heure
  plan: PlanSoins;
  heure: string;
  minutes: number;
  statut: "bientot" | "retard";
  ecartMinutes: number;
  lignes: LigneTraitement[];
}

/** Prises d'aujourd'hui à faire dans les 30 prochaines minutes ou en retard. */
export function alertesSoins(plans: PlanSoins[], soins: SoinRealise[], maintenant = new Date()): AlerteSoin[] {
  const date = localDate(maintenant);
  const groupes = new Map<string, AlerteSoin>();
  plans.filter((p) => p.statut === "En cours").forEach((p) => {
    creneauxDuJour(p, soins, date, maintenant).forEach((c) => {
      if (c.statut !== "bientot" && c.statut !== "retard") return;
      const cle = `${p.id}|${date}|${c.heure}`;
      const g = groupes.get(cle);
      if (g) g.lignes.push(c.ligne);
      else groupes.set(cle, { cle, plan: p, heure: c.heure, minutes: c.minutes, statut: c.statut, ecartMinutes: c.ecartMinutes, lignes: [c.ligne] });
    });
  });
  return [...groupes.values()].sort((a, b) => a.minutes - b.minutes || a.plan.patient.localeCompare(b.plan.patient));
}

/** Nombre de prises restant à faire aujourd'hui, tous plans confondus (pour les compteurs). */
export function prisesAFaireAujourdhui(plans: PlanSoins[], soins: SoinRealise[]): number {
  const t = localDate();
  return plans.filter((p) => p.statut === "En cours").reduce((n, p) => n + etatPlan(p, soins, t).resteAujourdhui, 0);
}

/* ------------------------------------------------------------------ */
/*  Formulaire d'enregistrement d'un soin                              */
/* ------------------------------------------------------------------ */

/** Pré-remplissage du formulaire (ex. depuis « Soins à exécuter » ou un plan). */
export interface PreRemplissageSoin {
  patient: string;
  contact?: string;
  consultationId?: string;
  hospitalisationId?: string;
  typeSoin?: string;
  observations?: string;
  // Médicaments proposés (mode libre) — avec fréquence et durée si connues.
  lignes?: { produit: string; dose?: string; voie?: string; frequence?: string; dureeJours?: number }[];
  // Mode « plan » : prises du jour d'un plan de traitement existant.
  planId?: string;
  // Texte de la prescription à rappeler en haut du formulaire.
  rappel?: string[];
  // Depuis une alerte : médicaments du plan à cocher (ceux de l'horaire signalé).
  lignesACocher?: string[];
}

type LigneForm = { key: string; produit: string; dose: string; voie: string; frequence: string; duree: string; horaires: string[] };
const ligneVide = (): LigneForm => ({ key: generateUid(), produit: "", dose: "", voie: "", frequence: "1/j", duree: "1", horaires: horairesParDefaut("1/j") });

type ChampsConst = { temperature: string; tensionArterielle: string; pouls: string; saturationO2: string; glycemie: string };
const constVides: ChampsConst = { temperature: "", tensionArterielle: "", pouls: "", saturationO2: "", glycemie: "" };
const versConstantes = (c: ChampsConst): ConstantesSoin | undefined => {
  const n = (v: string) => { const x = parseFloat(v.replace(",", ".")); return isNaN(x) ? undefined : x; };
  const out: ConstantesSoin = {};
  const t = n(c.temperature), p = n(c.pouls), s = n(c.saturationO2), g = n(c.glycemie);
  if (t !== undefined) out.temperature = t;
  if (c.tensionArterielle.trim()) out.tensionArterielle = c.tensionArterielle.trim();
  if (p !== undefined) out.pouls = p;
  if (s !== undefined) out.saturationO2 = s;
  if (g !== undefined) out.glycemie = g;
  return Object.keys(out).length ? out : undefined;
};

export function FormulaireSoin({
  isDark, patientsSuggeres, medicaments, agentNom, preRemplissage, plans, soins, onAnnuler, onEnregistrer, onOuvrirPlan,
}: {
  isDark: boolean;
  patientsSuggeres: { nom: string; contact?: string; consultationId?: string; hospitalisationId?: string; origine: string }[];
  medicaments: Medicament[];
  agentNom: string;
  preRemplissage?: PreRemplissageSoin | null;
  plans: PlanSoins[];
  soins: SoinRealise[];
  onAnnuler: () => void;
  onEnregistrer: (s: SoinRealise, nouveauPlan?: PlanSoins) => void;
  onOuvrirPlan?: (planId: string) => void;
}) {
  const pre = preRemplissage || null;
  const planExistant = pre?.planId ? plans.find((p) => p.id === pre.planId) || null : null;
  const [date, setDate] = useState(localDate());
  const [heure, setHeure] = useState(localHeure());
  const etat = planExistant ? etatPlan(planExistant, soins, date) : null;

  const [patient, setPatient] = useState(planExistant?.patient || pre?.patient || "");
  const [contact, setContact] = useState(planExistant?.contact || pre?.contact || "");
  const [liens, setLiens] = useState<{ consultationId?: string; hospitalisationId?: string }>({
    consultationId: planExistant?.consultationId || pre?.consultationId,
    hospitalisationId: planExistant?.hospitalisationId || pre?.hospitalisationId,
  });
  const typeInitial = pre?.typeSoin || (planExistant || pre?.lignes?.length ? "Administration de médicaments" : TYPES_SOINS[0]);
  const [typeSoin, setTypeSoin] = useState(TYPES_SOINS.includes(typeInitial) ? typeInitial : "Autre");
  const [typeAutre, setTypeAutre] = useState(TYPES_SOINS.includes(typeInitial) ? "" : typeInitial);

  // Mode libre : lignes de médicaments modifiables.
  const [lignes, setLignes] = useState<LigneForm[]>(() =>
    pre?.lignes && pre.lignes.length
      ? pre.lignes.map((l) => { const f = frequenceDepuisTexte(l.frequence); return { key: generateUid(), produit: l.produit, dose: l.dose || "", voie: l.voie || "", frequence: f, duree: String(l.dureeJours || 1), horaires: horairesParDefaut(f) }; })
      : []
  );
  // Mode plan : prises cochées (par défaut, celles qui restent à faire aujourd'hui).
  const [coches, setCoches] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {};
    const cibles = pre?.lignesACocher && pre.lignesACocher.length ? new Set(pre.lignesACocher) : null;
    if (planExistant) etatPlan(planExistant, soins, localDate()).lignes.forEach((x) => (o[x.ligne.id] = x.active && x.reste > 0 && (!cibles || cibles.has(x.ligne.id))));
    return o;
  });
  const [creerPlan, setCreerPlan] = useState<boolean | null>(null); // null = automatique
  const [avant, setAvant] = useState<ChampsConst>(constVides);
  const [apres, setApres] = useState<ChampsConst>(constVides);
  const [observations, setObservations] = useState(pre?.observations || "");
  const [agent, setAgent] = useState(agentNom || "");
  const [erreur, setErreur] = useState("");

  const bord = isDark ? "border-gray-700" : "border-gray-200";
  const muted = isDark ? "text-gray-400" : "text-gray-500";

  const lignesRemplies = lignes.filter((l) => l.produit.trim());
  const besoinPlan = lignesRemplies.some((l) => l.frequence !== "unique" && (parseInt(l.duree, 10) > 1 || freqParValeur(l.frequence).prises > 1));
  const planACreer = !planExistant && (creerPlan === null ? besoinPlan : creerPlan) && lignesRemplies.length > 0;

  // Plan déjà en cours pour ce patient (en mode libre) : on le propose.
  const planDuPatient = !planExistant && patient.trim()
    ? plans.find((p) => p.statut === "En cours" && normNom(p.patient) === normNom(patient))
    : undefined;

  const choisirPatient = (nom: string) => {
    setPatient(nom);
    const p = patientsSuggeres.find((x) => normNom(x.nom) === normNom(nom));
    if (p) {
      if (p.contact && !contact) setContact(p.contact);
      setLiens({ consultationId: p.consultationId, hospitalisationId: p.hospitalisationId });
    }
  };
  const majLigne = (key: string, champ: Exclude<keyof LigneForm, "horaires">, val: string) =>
    setLignes((ls) => ls.map((l) => (l.key !== key ? l : champ === "frequence" ? { ...l, frequence: val, horaires: horairesParDefaut(val) } : { ...l, [champ]: val })));
  const majHoraire = (key: string, i: number, val: string) =>
    setLignes((ls) => ls.map((l) => (l.key === key ? { ...l, horaires: l.horaires.map((h, j) => (j === i ? val : h)) } : l)));

  const enregistrer = () => {
    const type = typeSoin === "Autre" ? typeAutre.trim() : typeSoin;
    if (!patient.trim()) return setErreur("Indiquez le nom du patient.");
    if (!type) return setErreur("Précisez le type de soin.");
    if (!agent.trim()) return setErreur("Indiquez le nom de l'agent qui a réalisé le soin.");

    let meds: MedicamentAdministre[] = [];
    let plan: PlanSoins | undefined;
    let planId = planExistant?.id;

    if (planExistant) {
      meds = planExistant.lignes
        .filter((l) => coches[l.id])
        .map((l) => ({ produit: l.produit, dose: l.dose, voie: l.voie, ligneId: l.id }));
      if (!meds.length) return setErreur("Cochez au moins un médicament donné au patient.");
    } else {
      const invalides = lignesRemplies.filter((l) => l.frequence !== "unique" && !(parseInt(l.duree, 10) >= 1));
      if (invalides.length) return setErreur("Indiquez la durée (en jours) de chaque médicament.");
      if (planACreer && lignesRemplies.some((l) => l.horaires.some((h) => !/^\d{1,2}:\d{2}$/.test(h))))
        return setErreur("Indiquez toutes les heures de prise (pour les alertes).");
      if (planACreer) {
        const lt: LigneTraitement[] = lignesRemplies.map((l) => {
          const f = freqParValeur(l.frequence);
          return {
            id: generateUid(), produit: l.produit.trim(), dose: l.dose.trim() || undefined, voie: l.voie || undefined,
            frequence: f.label, prisesParJour: f.prises, dureeJours: l.frequence === "unique" ? 1 : parseInt(l.duree, 10),
            horaires: [...l.horaires].sort((a, b) => minutesCreneau(a) - minutesCreneau(b)),
          } as LigneTraitement;
        });
        plan = propre({
          id: generateUid(), patient: patient.trim(), contact: contact.trim() || undefined,
          consultationId: liens.consultationId, hospitalisationId: liens.hospitalisationId,
          dateDebut: date, lignes: lt, statut: "En cours" as const, creePar: agent.trim(), createdAt: new Date().toISOString(),
        });
        planId = plan.id;
        meds = lt.map((l) => ({ produit: l.produit, dose: l.dose, voie: l.voie, ligneId: l.id }));
      } else {
        meds = lignesRemplies.map((l) => ({ produit: l.produit.trim(), dose: l.dose.trim() || undefined, voie: l.voie || undefined }));
      }
    }

    const s: SoinRealise = propre({
      id: generateUid(),
      date, heure,
      patient: patient.trim(),
      contact: contact.trim() || undefined,
      consultationId: liens.consultationId,
      hospitalisationId: liens.hospitalisationId,
      typeSoin: type,
      medicaments: meds.length ? meds : undefined,
      planId,
      jourTraitement: planExistant ? etat?.jour : plan ? 1 : undefined,
      constantesAvant: versConstantes(avant),
      constantesApres: versConstantes(apres),
      observations: observations.trim() || undefined,
      agentNom: agent.trim(),
      createdAt: new Date().toISOString(),
    });
    onEnregistrer(s, plan);
  };

  const champConst = (label: string, key: keyof ChampsConst, val: ChampsConst, set: (c: ChampsConst) => void, ph: string, mode: "decimal" | "text" = "decimal") => (
    <label className="text-xs font-semibold">
      {label}
      <input className={inputCls} inputMode={mode} placeholder={ph} value={val[key]} onChange={(e) => set({ ...val, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onAnnuler}>
      <div
        className={`w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 ${isDark ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Syringe className="w-5 h-5 text-emerald-600" /> {planExistant ? "Soins du jour — plan de traitement" : "Enregistrer un soin"}
          </h3>
          <button onClick={onAnnuler} className={`p-1.5 rounded ${muted}`} aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>

        {pre?.rappel && pre.rappel.length > 0 && (
          <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3 text-sm">
            <div className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Prescription du médecin</div>
            <ul className="list-disc pl-5 space-y-0.5">{pre.rappel.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm font-semibold sm:col-span-2">
            Patient
            <input className={inputCls} list="soins-patients" value={patient} disabled={!!planExistant} onChange={(e) => choisirPatient(e.target.value)} placeholder="Nom et prénom du patient" />
            <datalist id="soins-patients">
              {patientsSuggeres.map((p, i) => <option key={i} value={p.nom}>{p.origine}</option>)}
            </datalist>
          </label>
          {planDuPatient && onOuvrirPlan && (
            <div className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-3 text-sm flex flex-wrap items-center justify-between gap-2">
              <span>Ce patient a déjà un <b>traitement en cours</b> ({planDuPatient.lignes.map((l) => l.produit).join(", ")}).</span>
              <button onClick={() => onOuvrirPlan(planDuPatient.id)} className="rounded-lg bg-amber-600 text-white px-3 py-1.5 font-semibold">Faire les soins de ce plan</button>
            </div>
          )}
          <label className="text-sm font-semibold">
            Téléphone <span className={`font-normal ${muted}`}>(facultatif)</span>
            <input className={inputCls} inputMode="tel" value={contact} disabled={!!planExistant} onChange={(e) => setContact(e.target.value)} placeholder="70 00 00 00" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-semibold">Date<input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label className="text-sm font-semibold">Heure<input type="time" className={inputCls} value={heure} onChange={(e) => setHeure(e.target.value)} /></label>
          </div>
          <label className="text-sm font-semibold">
            Type de soin
            <select className={inputCls} value={typeSoin} onChange={(e) => setTypeSoin(e.target.value)}>
              {TYPES_SOINS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {typeSoin === "Autre" ? (
            <label className="text-sm font-semibold">
              Préciser le soin
              <input className={inputCls} value={typeAutre} onChange={(e) => setTypeAutre(e.target.value)} placeholder="Ex. : Drainage d'abcès" />
            </label>
          ) : <div className="hidden sm:block" />}
        </div>

        {/* ---------------- Médicaments ---------------- */}
        <div className={`mt-4 rounded-lg border p-3 ${bord}`}>
          {planExistant && etat ? (
            <>
              <div className="text-sm font-bold mb-1 flex items-center gap-1.5"><Pill className="w-4 h-4" /> Médicaments à donner — jour {Math.max(1, etat.jour)} / {etat.joursTotal}</div>
              <p className={`text-xs mb-2 ${muted}`}>Cochez ce que vous donnez maintenant.</p>
              <div className="space-y-2">
                {etat.lignes.map((x) => (
                  <label key={x.ligne.id} className={`flex items-start gap-3 rounded-lg border p-2.5 ${bord} ${!x.active ? "opacity-50" : ""}`}>
                    <input type="checkbox" className="mt-1 w-5 h-5" checked={!!coches[x.ligne.id]} disabled={!x.active}
                      onChange={(e) => setCoches({ ...coches, [x.ligne.id]: e.target.checked })} />
                    <span className="text-sm">
                      <b>{texteMed(x.ligne)}</b>
                      <span className={`block text-xs ${muted}`}>
                        {x.ligne.frequence} · {x.ligne.dureeJours} jour(s)
                        {x.active ? ` · aujourd'hui : ${x.faites.length}/${x.ligne.prisesParJour} faite(s)` : " · pas prévu ce jour"}
                        {x.faites.length ? ` (${x.faites.map((f) => `${f.heure} par ${f.agent}`).join(", ")})` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-sm font-bold flex items-center gap-1.5"><Pill className="w-4 h-4" /> Médicaments administrés</div>
                <button onClick={() => setLignes([...lignes, ligneVide()])} className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> Ajouter un médicament
                </button>
              </div>
              {lignes.length === 0 && (
                <p className={`text-xs ${muted}`}>Aucun médicament (ex. pansement seul). Touchez « Ajouter un médicament » pour en noter un ou plusieurs.</p>
              )}
              <datalist id="soins-produits">{medicaments.map((m) => <option key={m.id} value={m.nom} />)}</datalist>
              <div className="space-y-2">
                {lignes.map((l, i) => (
                  <div key={l.key} className={`rounded-lg border p-2.5 ${bord}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold ${muted}`}>Médicament {i + 1}</span>
                      <button onClick={() => setLignes(lignes.filter((x) => x.key !== l.key))} className="text-red-600 p-1" aria-label="Retirer ce médicament"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <label className="text-xs font-semibold col-span-2">Produit<input className={inputCls} list="soins-produits" value={l.produit} onChange={(e) => majLigne(l.key, "produit", e.target.value)} placeholder="Ex. : Ceftriaxone 1 g" /></label>
                      <label className="text-xs font-semibold">Dose<input className={inputCls} value={l.dose} onChange={(e) => majLigne(l.key, "dose", e.target.value)} placeholder="1 g" /></label>
                      <label className="text-xs font-semibold">Voie
                        <select className={inputCls} value={l.voie} onChange={(e) => majLigne(l.key, "voie", e.target.value)}>
                          <option value="">—</option>{VOIES_SOIN.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold">Fréquence
                        <select className={inputCls} value={l.frequence} onChange={(e) => majLigne(l.key, "frequence", e.target.value)}>
                          {FREQUENCES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold">Durée (jours)
                        <input className={inputCls} type="number" min={1} max={60} inputMode="numeric" disabled={l.frequence === "unique"}
                          value={l.frequence === "unique" ? "1" : l.duree} onChange={(e) => majLigne(l.key, "duree", e.target.value)} />
                      </label>
                    </div>
                    {l.horaires.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <span className={`text-xs font-semibold pb-2 flex items-center gap-1 ${muted}`}><Bell className="w-3.5 h-3.5" /> Heures de prise :</span>
                        {l.horaires.map((h, j) => (
                          <input key={j} type="time" className="px-2 py-1.5 rounded border bg-transparent text-sm" value={h}
                            onChange={(e) => majHoraire(l.key, j, e.target.value)} aria-label={`Heure de la prise ${j + 1}`} />
                        ))}
                        <span className={`text-xs pb-2 ${muted}`}>alerte 30 min avant</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {lignesRemplies.length > 0 && (
                <label className={`mt-3 flex items-start gap-2 text-sm rounded-lg p-2.5 ${planACreer ? "bg-emerald-50 dark:bg-emerald-900/20" : ""}`}>
                  <input type="checkbox" className="mt-0.5 w-5 h-5" checked={planACreer} onChange={(e) => setCreerPlan(e.target.checked)} />
                  <span>
                    <b>Créer le plan de traitement</b> — ce soin compte comme la 1ʳᵉ prise (jour 1). Les collègues verront chaque jour les prises à faire
                    {lignesRemplies.length ? `, jusqu'au ${dateCourte(ajouterJours(date, Math.max(...lignesRemplies.map((l) => (l.frequence === "unique" ? 1 : parseInt(l.duree, 10) || 1))) - 1))} inclus` : ""}.
                  </span>
                </label>
              )}
            </>
          )}
        </div>

        <div className={`mt-4 rounded-lg border p-3 ${bord}`}>
          <div className="text-sm font-bold mb-1 flex items-center gap-1.5"><Activity className="w-4 h-4" /> Constantes avant le soin</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {champConst("T° (°C)", "temperature", avant, setAvant, "37,5")}
            {champConst("TA", "tensionArterielle", avant, setAvant, "12/8", "text")}
            {champConst("Pouls", "pouls", avant, setAvant, "80")}
            {champConst("SpO₂ (%)", "saturationO2", avant, setAvant, "98")}
            {champConst("Glycémie", "glycemie", avant, setAvant, "1,0")}
          </div>
          <div className="text-sm font-bold mt-3 mb-1 flex items-center gap-1.5"><Activity className="w-4 h-4" /> Constantes après le soin</div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {champConst("T° (°C)", "temperature", apres, setApres, "37,5")}
            {champConst("TA", "tensionArterielle", apres, setApres, "12/8", "text")}
            {champConst("Pouls", "pouls", apres, setApres, "80")}
            {champConst("SpO₂ (%)", "saturationO2", apres, setApres, "98")}
            {champConst("Glycémie", "glycemie", apres, setApres, "1,0")}
          </div>
          <p className={`text-xs mt-2 ${muted}`}>Laisser vide ce qui n'a pas été mesuré.</p>
        </div>

        <label className="block text-sm font-semibold mt-3">
          Observations
          <textarea className={inputCls + " min-h-[80px]"} value={observations} onChange={(e) => setObservations(e.target.value)} placeholder="Réaction du patient, déroulement, incident, remarque…" />
        </label>
        <label className="block text-sm font-semibold mt-3">
          Soin réalisé par
          <input className={inputCls} value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="Nom de l'agent" />
        </label>

        {erreur && <p className="text-sm text-red-600 font-semibold mt-3">{erreur}</p>}

        <div className="flex gap-2 mt-4">
          <button onClick={onAnnuler} className={`flex-1 rounded-lg border px-4 py-2.5 font-semibold ${bord}`}>Annuler</button>
          <button onClick={enregistrer} className="flex-[2] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 font-semibold">
            {planACreer ? "Enregistrer et créer le plan" : "Enregistrer le soin"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Carte d'un soin                                                    */
/* ------------------------------------------------------------------ */

export function CarteSoin({ s, isDark, onSupprimer, afficherPatient = true, afficherDate = false, onPatient }: {
  s: SoinRealise;
  isDark: boolean;
  onSupprimer?: (s: SoinRealise) => void;
  afficherPatient?: boolean;
  afficherDate?: boolean;
  onPatient?: (nom: string) => void;
}) {
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const bord = isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white";
  const meds = medicamentsDuSoin(s);
  const av = texteConstantes(s.constantesAvant), ap = texteConstantes(s.constantesApres);
  return (
    <div className={`rounded-lg border p-3 ${bord}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-xs font-bold flex items-center gap-1 ${muted}`}><Clock className="w-3.5 h-3.5" />{afficherDate ? `${dateLongue(s.date)} · ` : ""}{s.heure}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{s.typeSoin}</span>
            {s.planId && s.jourTraitement ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">Traitement · jour {s.jourTraitement}</span> : null}
          </div>
          {afficherPatient && (
            <button onClick={() => onPatient && onPatient(s.patient)} className="font-semibold mt-1 text-left hover:underline">{s.patient}</button>
          )}
          {meds.length > 0 && (
            <ul className="text-sm mt-0.5 list-disc pl-5">{meds.map((m, i) => <li key={i}>{texteMed(m)}</li>)}</ul>
          )}
          {av && <div className="text-sm"><span className={muted}>Avant : </span>{av}</div>}
          {ap && <div className="text-sm"><span className={muted}>Après : </span>{ap}</div>}
          {s.observations && <div className="text-sm mt-0.5 whitespace-pre-wrap"><span className={muted}>Observations : </span>{s.observations}</div>}
          <div className={`text-xs mt-1 flex items-center gap-1 ${muted}`}><User className="w-3.5 h-3.5" /> {s.agentNom}</div>
        </div>
        {onSupprimer && (
          <button onClick={() => onSupprimer(s)} className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-none" aria-label="Supprimer ce soin" title="Supprimer ce soin">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Soins d'un patient (utilisé dans le dossier patient). */
export function soinsDuPatient(soins: SoinRealise[], nom: string): SoinRealise[] {
  const n = normNom(nom);
  return soins.filter((s) => normNom(s.patient) === n).sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
}

/* ------------------------------------------------------------------ */
/*  Carte d'un plan de traitement                                      */
/* ------------------------------------------------------------------ */

function PastilleCreneau({ c }: { c: CreneauPrise }) {
  const styles: Record<StatutCreneau, string> = {
    fait: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    a_venir: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    bientot: "bg-amber-400 text-amber-950 animate-pulse",
    retard: "bg-red-600 text-white",
    hors_plan: "bg-gray-100 text-gray-400 line-through dark:bg-gray-800 dark:text-gray-500",
  };
  const titre =
    c.statut === "fait" ? `Faite à ${c.fait?.heure} par ${c.fait?.agent}` :
    c.statut === "bientot" ? `Dans ${c.ecartMinutes} min` :
    c.statut === "retard" ? "Pas encore faite : en retard" :
    c.statut === "hors_plan" ? "Avant le début du traitement" : "À venir";
  const icone = c.statut === "fait" ? "✓ " : c.statut === "bientot" ? "⏰ " : c.statut === "retard" ? "⚠ " : "";
  return <span title={titre} className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded ${styles[c.statut]}`}>{icone}{c.heure}</span>;
}

export function CartePlan({ e, isDark, date, creneaux, onFaire, onArreter, onHistorique, onHoraires }: {
  e: EtatPlan;
  isDark: boolean;
  date: string;
  creneaux?: CreneauPrise[];
  onFaire?: () => void;
  onArreter?: () => void;
  onHistorique?: () => void;
  onHoraires?: () => void;
}) {
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const bord = isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white";
  const p = e.plan;
  const fini = p.statut !== "En cours";
  const aFaire = e.resteAujourdhui > 0;
  return (
    <div className={`rounded-xl border-2 p-3 ${fini ? bord : aFaire ? "border-amber-400 " + (isDark ? "bg-gray-800" : "bg-amber-50/40") : "border-emerald-400 " + (isDark ? "bg-gray-800" : "bg-emerald-50/40")}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <button onClick={onHistorique} className="font-bold text-base hover:underline flex items-center gap-1.5"><User className="w-4 h-4" /> {p.patient}</button>
          <div className={`text-xs ${muted}`}>
            Du {dateCourte(p.dateDebut)} au {dateCourte(e.dateFin)} · commencé par {p.creePar}
          </div>
        </div>
        <div className="text-right">
          {fini ? (
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.statut === "Terminé" ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"}`}>
              {p.statut === "Terminé" ? "✓ Traitement terminé" : `Arrêté${p.motifArret ? " — " + p.motifArret : ""}`}
            </span>
          ) : (
            e.jour > e.joursTotal ? (
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-800">Période finie — prises manquées, à clôturer</span>
            ) : (
              <span className="text-sm font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                Jour {Math.max(e.jour, 1)} / {e.joursTotal}
              </span>
            )
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {e.lignes.map((x) => (
          <div key={x.ligne.id} className="text-sm flex flex-wrap items-baseline justify-between gap-x-3">
            <span><b>{texteMed(x.ligne)}</b> <span className={`text-xs ${muted}`}>· {x.ligne.frequence} · {x.ligne.dureeJours} j</span></span>
            <span className="text-xs">
              {!x.active ? (
                <span className={muted}>{x.jour > x.ligne.dureeJours ? "fini" : "pas encore commencé"}</span>
              ) : (
                <>
                  <span className={x.reste > 0 ? "text-amber-700 dark:text-amber-400 font-bold" : "text-emerald-700 dark:text-emerald-400 font-bold"}>
                    {x.faites.length}/{x.ligne.prisesParJour} {date === localDate() ? "aujourd'hui" : "ce jour"}
                  </span>
                  {x.faites.length > 0 && <span className={muted}> ({x.faites.map((f) => `${f.heure} ${f.agent.split(" ")[0]}`).join(", ")})</span>}
                  {creneaux && creneaux.some((c) => c.ligne.id === x.ligne.id) && (
                    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                      {creneaux.filter((c) => c.ligne.id === x.ligne.id).map((c) => <PastilleCreneau key={c.heure} c={c} />)}
                    </span>
                  )}
                </>
              )}
              {x.manquees > 0 && <span className="ml-1 text-red-600 font-bold">· {x.manquees} prise(s) manquée(s)</span>}
            </span>
          </div>
        ))}
      </div>

      {!fini && (
        <div className="flex flex-wrap gap-2 mt-3">
          {onFaire && (
            <button onClick={onFaire} disabled={!aFaire}
              className={`flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm font-semibold flex items-center justify-center gap-1.5 ${aFaire ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
              {aFaire ? <><Syringe className="w-4 h-4" /> Faire les soins ({e.resteAujourdhui} prise(s) à faire)</> : <><CheckCircle2 className="w-4 h-4" /> Toutes les prises du jour sont faites</>}
            </button>
          )}
          {onHoraires && (
            <button onClick={onHoraires} className={`rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}>
              <Bell className="w-4 h-4" /> Horaires
            </button>
          )}
          {onArreter && (
            <button onClick={onArreter} className={`rounded-lg border px-3 py-2 text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}>
              <Ban className="w-4 h-4" /> {e.jour > e.joursTotal ? "Clôturer" : "Arrêter"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modifier les heures de prise d'un plan                             */
/* ------------------------------------------------------------------ */

function EditeurHoraires({ plan, isDark, onAnnuler, onEnregistrer }: {
  plan: PlanSoins;
  isDark: boolean;
  onAnnuler: () => void;
  onEnregistrer: (p: PlanSoins) => void;
}) {
  const [h, setH] = useState<Record<string, string[]>>(() => {
    const o: Record<string, string[]> = {};
    plan.lignes.forEach((l) => {
      const base = (l.horaires || []).slice(0, l.prisesParJour);
      while (base.length < l.prisesParJour) base.push("");
      o[l.id] = base;
    });
    return o;
  });
  const [erreur, setErreur] = useState("");
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const bord = isDark ? "border-gray-700" : "border-gray-200";
  const valider = () => {
    if (Object.values(h).some((arr) => arr.some((x) => !/^\d{1,2}:\d{2}$/.test(x)))) return setErreur("Indiquez toutes les heures.");
    onEnregistrer(propre({
      ...plan,
      lignes: plan.lignes.map((l) => ({ ...l, horaires: [...(h[l.id] || [])].sort((a, b) => minutesCreneau(a) - minutesCreneau(b)) })),
    }));
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onAnnuler}>
      <div className={`w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 ${isDark ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold flex items-center gap-2"><Bell className="w-5 h-5 text-amber-600" /> Heures de prise — {plan.patient}</h3>
          <button onClick={onAnnuler} className={`p-1.5 rounded ${muted}`} aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        <p className={`text-sm mb-3 ${muted}`}>Une alerte sonne {MINUTES_AVANT_ALERTE} minutes avant chaque heure, sur tous les postes de la salle des soins.</p>
        <div className="space-y-2">
          {plan.lignes.filter((l) => l.prisesParJour > 0 && l.dureeJours > 0).map((l) => (
            <div key={l.id} className={`rounded-lg border p-3 ${bord}`}>
              <div className="text-sm font-bold">{texteMed(l)}</div>
              <div className={`text-xs mb-2 ${muted}`}>{l.frequence}</div>
              <div className="flex flex-wrap gap-2">
                {(h[l.id] || []).map((x, i) => (
                  <input key={i} type="time" className="px-2 py-1.5 rounded border bg-transparent text-sm" value={x} aria-label={`Heure de la prise ${i + 1}`}
                    onChange={(e) => setH({ ...h, [l.id]: h[l.id].map((y, j) => (j === i ? e.target.value : y)) })} />
                ))}
              </div>
            </div>
          ))}
        </div>
        {erreur && <p className="text-sm text-red-600 font-semibold mt-3">{erreur}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onAnnuler} className={`flex-1 rounded-lg border px-4 py-2.5 font-semibold ${bord}`}>Annuler</button>
          <button onClick={valider} className="flex-[2] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 font-semibold">Enregistrer les horaires</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vue principale                                                     */
/* ------------------------------------------------------------------ */

export default function SalleDesSoins({
  soins, onUpdateSoins, plans, onUpdatePlans, consultations, hospitalisations, agentNom, isDark, onOuvrirFormulaire,
}: {
  soins: SoinRealise[];
  onUpdateSoins: (s: SoinRealise[]) => void;
  plans: PlanSoins[];
  onUpdatePlans: (p: PlanSoins[]) => void;
  consultations: Consultation[];
  hospitalisations: Hospitalisation[];
  medicaments: Medicament[];
  agentNom: string;
  isDark: boolean;
  onOuvrirFormulaire: (pre?: PreRemplissageSoin | null) => void;
}) {
  const [jour, setJour] = useState(localDate());
  const [tousLesJours, setTousLesJours] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [voirTermines, setVoirTermines] = useState(false);
  const [planHoraires, setPlanHoraires] = useState<string | null>(null);
  // Horloge : rafraîchit l'état des horaires (bientôt / en retard) chaque 30 s.
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setMaintenant(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const bord = isDark ? "border-gray-700" : "border-gray-200";

  // Traitements du jour choisi : en cours, et dont la période couvre ce jour
  // (ou déjà terminée avec des prises manquées, à clôturer).
  const etats = useMemo(() => plans.map((p) => etatPlan(p, soins, jour)), [plans, soins, jour]);
  const enCours = etats
    .filter((e) => e.plan.statut === "En cours" && e.jour >= 1)
    .sort((a, b) => b.resteAujourdhui - a.resteAujourdhui || a.plan.patient.localeCompare(b.plan.patient));
  const termines = etats
    .filter((e) => e.plan.statut !== "En cours")
    .sort((a, b) => b.dateFin.localeCompare(a.dateFin))
    .slice(0, 20);

  const patientsDuService = useMemo(() => {
    const t = localDate();
    const out: { nom: string; contact?: string; consultationId?: string; hospitalisationId?: string; origine: string }[] = [];
    const vus = new Set<string>(plans.filter((p) => p.statut === "En cours").map((p) => normNom(p.patient)));
    hospitalisations.filter((h) => h.statut === "En cours").forEach((h) => {
      const k = normNom(h.patient); if (vus.has(k)) return; vus.add(k);
      out.push({ nom: h.patient, hospitalisationId: h.id, origine: h.typeAdmission || "Hospitalisé(e)" });
    });
    consultations.filter((c) => c.date === t).forEach((c) => {
      const k = normNom(c.patient); if (vus.has(k)) return; vus.add(k);
      out.push({ nom: c.patient, contact: c.contact, consultationId: c.id, origine: "Consulté(e) aujourd'hui" });
    });
    return out;
  }, [consultations, hospitalisations, plans]);

  const liste = useMemo(() => {
    const q = normNom(recherche);
    return soins
      .filter((s) => (tousLesJours || s.date === jour) && (!q || normNom(s.patient).includes(q) || normNom(s.typeSoin).includes(q) || medicamentsDuSoin(s).some((m) => normNom(m.produit).includes(q))))
      .sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
  }, [soins, jour, tousLesJours, recherche]);

  const groupes = useMemo(() => {
    const m = new Map<string, { nom: string; soins: SoinRealise[] }>();
    liste.forEach((s) => {
      const k = normNom(s.patient);
      if (!m.has(k)) m.set(k, { nom: s.patient, soins: [] });
      m.get(k)!.soins.push(s);
    });
    return [...m.values()];
  }, [liste]);

  const supprimer = (s: SoinRealise) => {
    if (!window.confirm(`Supprimer ce soin (${s.typeSoin} — ${s.patient}, ${s.heure}) ?`)) return;
    const reste = soins.filter((x) => x.id !== s.id);
    onUpdateSoins(reste);
    // Si la suppression retire une prise d'un plan terminé, il redevient « En cours ».
    if (s.planId) {
      const p = plans.find((x) => x.id === s.planId);
      if (p && p.statut === "Terminé" && !etatPlan(p, reste, localDate()).complet) {
        onUpdatePlans(plans.map((x) => (x.id === p.id ? { ...x, statut: "En cours" } : x)));
      }
    }
  };

  const arreter = (p: PlanSoins) => {
    const motif = window.prompt(`Arrêter le traitement de ${p.patient} ?\nIndiquez le motif (ex. : relais par voie orale, sortie, décision du médecin) :`, "");
    if (motif === null) return;
    onUpdatePlans(plans.map((x) => (x.id === p.id ? propre({ ...x, statut: "Arrêté" as const, motifArret: motif.trim() || undefined, arretePar: agentNom || undefined, dateArret: localDate() }) : x)));
  };

  const auj = localDate();
  const nbAuj = soins.filter((s) => s.date === auj).length;
  const aFaireAuj = prisesAFaireAujourdhui(plans, soins);
  const retard = etats.filter((e) => e.plan.statut === "En cours").reduce((n, e) => n + e.manquees, 0);

  return (
    <div className="p-4 max-w-4xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-emerald-600" /> Salle des soins</h2>
          <p className={`text-sm ${muted}`}>Traitements en cours et registre de tous les soins réalisés dans le service.</p>
        </div>
        <button onClick={() => onOuvrirFormulaire(null)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Enregistrer un soin
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className={`rounded-lg border p-3 ${bord}`}><div className="text-2xl font-bold">{plans.filter((p) => p.statut === "En cours").length}</div><div className={`text-xs ${muted}`}>traitement(s) en cours</div></div>
        <div className={`rounded-lg border p-3 ${aFaireAuj ? "border-amber-400" : bord}`}><div className={`text-2xl font-bold ${aFaireAuj ? "text-amber-600" : ""}`}>{aFaireAuj}</div><div className={`text-xs ${muted}`}>prise(s) à faire aujourd'hui</div></div>
        <div className={`rounded-lg border p-3 ${retard ? "border-red-400" : bord}`}><div className={`text-2xl font-bold ${retard ? "text-red-600" : ""}`}>{retard}</div><div className={`text-xs ${muted}`}>prise(s) manquée(s)</div></div>
        <div className={`rounded-lg border p-3 ${bord}`}><div className="text-2xl font-bold">{nbAuj}</div><div className={`text-xs ${muted}`}>soin(s) noté(s) aujourd'hui</div></div>
      </div>

      {/* ---------------- Traitements en cours ---------------- */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="font-bold flex items-center gap-2"><CalendarClock className="w-5 h-5 text-sky-600" /> Traitements en cours {jour !== auj ? `— ${dateLongue(jour)}` : "— aujourd'hui"}</h3>
        </div>
        {enCours.length === 0 ? (
          <div className={`rounded-lg border border-dashed p-4 text-sm ${bord} ${muted}`}>
            Aucun traitement en cours. Quand vous notez des médicaments avec une durée (ex. 2 fois / jour pendant 5 jours), le plan apparaît ici pour que les collègues continuent les soins.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {enCours.map((e) => (
              <CartePlan key={e.plan.id} e={e} isDark={isDark} date={jour}
                creneaux={creneauxDuJour(e.plan, soins, jour, maintenant)}
                onFaire={() => onOuvrirFormulaire({ patient: e.plan.patient, planId: e.plan.id })}
                onHoraires={() => setPlanHoraires(e.plan.id)}
                onArreter={() => arreter(e.plan)}
                onHistorique={() => { setRecherche(e.plan.patient); setTousLesJours(true); }} />
            ))}
          </div>
        )}
        {termines.length > 0 && (
          <div className="mt-2">
            <button onClick={() => setVoirTermines(!voirTermines)} className={`text-sm font-semibold underline ${muted}`}>
              {voirTermines ? "Masquer" : "Voir"} les traitements terminés ou arrêtés ({termines.length})
            </button>
            {voirTermines && (
              <div className="grid gap-3 md:grid-cols-2 mt-2">
                {termines.map((e) => (
                  <CartePlan key={e.plan.id} e={e} isDark={isDark} date={jour} onHistorique={() => { setRecherche(e.plan.patient); setTousLesJours(true); }} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {patientsDuService.length > 0 && (
        <div>
          <div className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${muted}`}>Nouveau soin pour un patient du service</div>
          <div className="flex flex-wrap gap-2">
            {patientsDuService.slice(0, 12).map((p) => (
              <button key={p.nom} onClick={() => onOuvrirFormulaire({ patient: p.nom, contact: p.contact, consultationId: p.consultationId, hospitalisationId: p.hospitalisationId })}
                className={`text-sm rounded-full border px-3 py-1.5 flex items-center gap-1.5 ${bord} hover:border-emerald-500`}>
                <Plus className="w-3.5 h-3.5 text-emerald-600" /> {p.nom} <span className={`text-xs ${muted}`}>· {p.origine}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- Registre ---------------- */}
      <section className={`border-t pt-4 ${bord}`}>
        <h3 className="font-bold flex items-center gap-2 mb-2"><ClipboardList className="w-5 h-5" /> Registre des soins réalisés</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-semibold">
            Jour
            <input type="date" className={inputCls} value={jour} disabled={tousLesJours} onChange={(e) => setJour(e.target.value)} />
          </label>
          <label className="text-sm flex items-center gap-2 pb-2.5">
            <input type="checkbox" checked={tousLesJours} onChange={(e) => setTousLesJours(e.target.checked)} /> Tous les jours
          </label>
          <label className="text-sm font-semibold flex-1 min-w-[180px]">
            Rechercher
            <div className="relative">
              <Search className={`w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 mt-0.5 ${muted}`} />
              <input className={inputCls + " pl-8"} value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Patient, soin ou produit" />
            </div>
          </label>
          {(recherche || tousLesJours) && (
            <button onClick={() => { setRecherche(""); setTousLesJours(false); setJour(localDate()); }} className={`text-sm underline pb-2.5 ${muted}`}>Effacer</button>
          )}
        </div>

        <div className={`text-sm font-semibold mt-3 ${muted}`}>
          {tousLesJours ? "Tous les soins enregistrés" : `Soins du ${dateLongue(jour)}`} — {liste.length} soin(s), {groupes.length} patient(s)
        </div>

        {groupes.length === 0 ? (
          <div className={`mt-2 rounded-lg border border-dashed p-6 text-center text-sm ${bord} ${muted}`}>
            Aucun soin enregistré {tousLesJours ? "" : "pour ce jour"}.
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {groupes.map((g) => (
              <div key={g.nom}>
                <div className="flex items-center justify-between mb-1.5">
                  <button onClick={() => { setRecherche(g.nom); }} className="font-bold flex items-center gap-1.5 hover:underline"><User className="w-4 h-4" /> {g.nom}</button>
                  <button onClick={() => onOuvrirFormulaire({ patient: g.nom, contact: g.soins[0]?.contact, consultationId: g.soins[0]?.consultationId, hospitalisationId: g.soins[0]?.hospitalisationId })}
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouveau soin</button>
                </div>
                <div className="space-y-2">
                  {g.soins.map((s) => <CarteSoin key={s.id} s={s} isDark={isDark} onSupprimer={supprimer} afficherPatient={false} afficherDate={tousLesJours} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {planHoraires && plans.find((p) => p.id === planHoraires) && (
        <EditeurHoraires
          plan={plans.find((p) => p.id === planHoraires)!}
          isDark={isDark}
          onAnnuler={() => setPlanHoraires(null)}
          onEnregistrer={(np) => { onUpdatePlans(plans.map((x) => (x.id === np.id ? np : x))); setPlanHoraires(null); }}
        />
      )}

      {retard > 0 && (
        <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Des prises ont été manquées : vérifiez avec le médecin s'il faut prolonger ou adapter le traitement.</p>
      )}
    </div>
  );
}
