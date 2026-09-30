/**
 * Salle des soins (dans la Salle des Infirmiers) : registre de tous les soins
 * réalisés dans le service, pour chaque patient.
 *
 * Chaque soin garde : date, heure, patient, type de soin, produit / dose /
 * voie, constantes avant et après le soin, observations et l'agent qui l'a
 * réalisé. Les données sont enregistrées sous la clé "dg_soins" et
 * synchronisées en temps réel entre tous les postes (comme les consultations).
 */

import React, { useMemo, useState } from "react";
import { Syringe, Plus, Search, Trash2, X, User, Clock, Activity, ClipboardList } from "lucide-react";
import { Consultation, Hospitalisation, Medicament, SoinRealise, ConstantesSoin } from "../types";
import { generateUid } from "../data";

export const TYPES_SOINS = [
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
  "Administration de médicament oral",
  "Autre",
];

export const VOIES_SOIN = ["IV directe", "IV lente", "Perfusion IV", "IM", "SC", "ID", "Orale", "Locale / cutanée", "Inhalée", "Rectale", "Autre"];

const normNom = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const localDate = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const localHeure = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const dateLongue = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

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

/** Pré-remplissage du formulaire (ex. depuis « Soins à exécuter »). */
export interface PreRemplissageSoin {
  patient: string;
  contact?: string;
  consultationId?: string;
  hospitalisationId?: string;
  typeSoin?: string;
  produit?: string;
  dose?: string;
  voie?: string;
  observations?: string;
  // Texte de la prescription à rappeler en haut du formulaire.
  rappel?: string[];
}

/* ------------------------------------------------------------------ */
/*  Formulaire d'enregistrement d'un soin                              */
/* ------------------------------------------------------------------ */

type ChampsConst = { temperature: string; tensionArterielle: string; pouls: string; saturationO2: string; glycemie: string };
const constVides: ChampsConst = { temperature: "", tensionArterielle: "", pouls: "", saturationO2: "", glycemie: "" };

const versConstantes = (c: ChampsConst): ConstantesSoin | undefined => {
  const n = (v: string) => {
    const x = parseFloat(v.replace(",", "."));
    return isNaN(x) ? undefined : x;
  };
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
  isDark, patientsSuggeres, medicaments, agentNom, preRemplissage, onAnnuler, onEnregistrer,
}: {
  isDark: boolean;
  patientsSuggeres: { nom: string; contact?: string; consultationId?: string; hospitalisationId?: string; origine: string }[];
  medicaments: Medicament[];
  agentNom: string;
  preRemplissage?: PreRemplissageSoin | null;
  onAnnuler: () => void;
  onEnregistrer: (s: SoinRealise) => void;
}) {
  const pre = preRemplissage || null;
  const [patient, setPatient] = useState(pre?.patient || "");
  const [contact, setContact] = useState(pre?.contact || "");
  const [liens, setLiens] = useState<{ consultationId?: string; hospitalisationId?: string }>({
    consultationId: pre?.consultationId,
    hospitalisationId: pre?.hospitalisationId,
  });
  const [date, setDate] = useState(localDate());
  const [heure, setHeure] = useState(localHeure());
  const [typeSoin, setTypeSoin] = useState(pre?.typeSoin && TYPES_SOINS.includes(pre.typeSoin) ? pre.typeSoin : pre?.typeSoin ? "Autre" : TYPES_SOINS[0]);
  const [typeAutre, setTypeAutre] = useState(pre?.typeSoin && !TYPES_SOINS.includes(pre.typeSoin) ? pre.typeSoin : "");
  const [produit, setProduit] = useState(pre?.produit || "");
  const [dose, setDose] = useState(pre?.dose || "");
  const [voie, setVoie] = useState(pre?.voie || "");
  const [avant, setAvant] = useState<ChampsConst>(constVides);
  const [apres, setApres] = useState<ChampsConst>(constVides);
  const [observations, setObservations] = useState(pre?.observations || "");
  const [agent, setAgent] = useState(agentNom || "");
  const [erreur, setErreur] = useState("");

  const bord = isDark ? "border-gray-700" : "border-gray-200";
  const muted = isDark ? "text-gray-400" : "text-gray-500";

  const choisirPatient = (nom: string) => {
    setPatient(nom);
    const p = patientsSuggeres.find((x) => normNom(x.nom) === normNom(nom));
    if (p) {
      if (p.contact && !contact) setContact(p.contact);
      setLiens({ consultationId: p.consultationId, hospitalisationId: p.hospitalisationId });
    }
  };

  const enregistrer = () => {
    const type = typeSoin === "Autre" ? typeAutre.trim() : typeSoin;
    if (!patient.trim()) return setErreur("Indiquez le nom du patient.");
    if (!type) return setErreur("Précisez le type de soin.");
    if (!agent.trim()) return setErreur("Indiquez le nom de l'agent qui a réalisé le soin.");
    const s: SoinRealise = {
      id: generateUid(),
      date,
      heure,
      patient: patient.trim(),
      typeSoin: type,
      agentNom: agent.trim(),
      createdAt: new Date().toISOString(),
    };
    // Firestore refuse les valeurs "undefined" : on n'ajoute que les champs remplis.
    if (contact.trim()) s.contact = contact.trim();
    if (liens.consultationId) s.consultationId = liens.consultationId;
    if (liens.hospitalisationId) s.hospitalisationId = liens.hospitalisationId;
    if (produit.trim()) s.produit = produit.trim();
    if (dose.trim()) s.dose = dose.trim();
    if (voie) s.voie = voie;
    const ca = versConstantes(avant), cp = versConstantes(apres);
    if (ca) s.constantesAvant = ca;
    if (cp) s.constantesApres = cp;
    if (observations.trim()) s.observations = observations.trim();
    onEnregistrer(s);
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
        className={`w-full sm:max-w-2xl max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 ${isDark ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2"><Syringe className="w-5 h-5 text-emerald-600" /> Enregistrer un soin</h3>
          <button onClick={onAnnuler} className={`p-1.5 rounded ${muted}`} aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>

        {pre?.rappel && pre.rappel.length > 0 && (
          <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-3 text-sm">
            <div className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Prescription à exécuter</div>
            <ul className="list-disc pl-5 space-y-0.5">{pre.rappel.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm font-semibold sm:col-span-2">
            Patient
            <input className={inputCls} list="soins-patients" value={patient} onChange={(e) => choisirPatient(e.target.value)} placeholder="Nom et prénom du patient" />
            <datalist id="soins-patients">
              {patientsSuggeres.map((p, i) => <option key={i} value={p.nom}>{p.origine}</option>)}
            </datalist>
          </label>
          <label className="text-sm font-semibold">
            Téléphone <span className={`font-normal ${muted}`}>(facultatif)</span>
            <input className={inputCls} inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="70 00 00 00" />
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

          <label className="text-sm font-semibold">
            Produit utilisé
            <input className={inputCls} list="soins-produits" value={produit} onChange={(e) => setProduit(e.target.value)} placeholder="Ex. : Ceftriaxone 1 g" />
            <datalist id="soins-produits">
              {medicaments.map((m) => <option key={m.id} value={m.nom} />)}
            </datalist>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-semibold">Dose<input className={inputCls} value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ex. : 1 g" /></label>
            <label className="text-sm font-semibold">
              Voie
              <select className={inputCls} value={voie} onChange={(e) => setVoie(e.target.value)}>
                <option value="">—</option>
                {VOIES_SOIN.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          </div>
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
          <button onClick={enregistrer} className="flex-[2] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 font-semibold">Enregistrer le soin</button>
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
  const prod = [s.produit, s.dose, s.voie].filter(Boolean).join(" · ");
  const av = texteConstantes(s.constantesAvant), ap = texteConstantes(s.constantesApres);
  return (
    <div className={`rounded-lg border p-3 ${bord}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-xs font-bold flex items-center gap-1 ${muted}`}><Clock className="w-3.5 h-3.5" />{afficherDate ? `${dateLongue(s.date)} · ` : ""}{s.heure}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{s.typeSoin}</span>
          </div>
          {afficherPatient && (
            <button onClick={() => onPatient && onPatient(s.patient)} className="font-semibold mt-1 text-left hover:underline">{s.patient}</button>
          )}
          {prod && <div className="text-sm mt-0.5"><span className={muted}>Produit : </span>{prod}</div>}
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
  return soins
    .filter((s) => normNom(s.patient) === n)
    .sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
}

/* ------------------------------------------------------------------ */
/*  Vue principale : registre des soins                                */
/* ------------------------------------------------------------------ */

export default function SalleDesSoins({
  soins, onUpdateSoins, consultations, hospitalisations, medicaments, agentNom, isDark, onOuvrirFormulaire,
}: {
  soins: SoinRealise[];
  onUpdateSoins: (s: SoinRealise[]) => void;
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
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const bord = isDark ? "border-gray-700" : "border-gray-200";

  // Patients à portée de main : hospitalisés / en observation, et vus aujourd'hui.
  const patientsDuService = useMemo(() => {
    const t = localDate();
    const out: { nom: string; contact?: string; consultationId?: string; hospitalisationId?: string; origine: string }[] = [];
    const vus = new Set<string>();
    hospitalisations
      .filter((h) => h.statut === "En cours")
      .forEach((h) => {
        const k = normNom(h.patient);
        if (vus.has(k)) return;
        vus.add(k);
        out.push({ nom: h.patient, hospitalisationId: h.id, origine: (h as any).typeAdmission || "Hospitalisé(e)" });
      });
    consultations
      .filter((c) => c.date === t)
      .forEach((c) => {
        const k = normNom(c.patient);
        if (vus.has(k)) return;
        vus.add(k);
        out.push({ nom: c.patient, contact: c.contact, consultationId: c.id, origine: "Consulté(e) aujourd'hui" });
      });
    return out;
  }, [consultations, hospitalisations]);

  const liste = useMemo(() => {
    const q = normNom(recherche);
    return soins
      .filter((s) => (tousLesJours || s.date === jour) && (!q || normNom(s.patient).includes(q) || normNom(s.typeSoin).includes(q) || normNom(s.produit || "").includes(q)))
      .sort((a, b) => (b.date + b.heure).localeCompare(a.date + a.heure));
  }, [soins, jour, tousLesJours, recherche]);

  // Regroupement par patient (puis par jour si "tous les jours").
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
    onUpdateSoins(soins.filter((x) => x.id !== s.id));
  };

  const auj = localDate();
  const nbAuj = soins.filter((s) => s.date === auj).length;
  const patientsAuj = new Set(soins.filter((s) => s.date === auj).map((s) => normNom(s.patient))).size;

  return (
    <div className="p-4 max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-emerald-600" /> Salle des soins</h2>
          <p className={`text-sm ${muted}`}>Registre de tous les soins réalisés dans le service, patient par patient.</p>
        </div>
        <button onClick={() => onOuvrirFormulaire(null)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Enregistrer un soin
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-lg border p-3 ${bord}`}><div className="text-2xl font-bold">{nbAuj}</div><div className={`text-xs ${muted}`}>soin(s) aujourd'hui</div></div>
        <div className={`rounded-lg border p-3 ${bord}`}><div className="text-2xl font-bold">{patientsAuj}</div><div className={`text-xs ${muted}`}>patient(s) soigné(s) aujourd'hui</div></div>
      </div>

      {patientsDuService.length > 0 && (
        <div>
          <div className={`text-xs font-bold uppercase tracking-wide mb-1.5 ${muted}`}>Soin rapide pour un patient du service</div>
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

      <div className={`flex flex-wrap items-end gap-2 border-t pt-3 ${bord}`}>
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
      </div>

      <div className={`text-sm font-semibold ${muted}`}>
        {tousLesJours ? "Tous les soins enregistrés" : `Soins du ${dateLongue(jour)}`} — {liste.length} soin(s), {groupes.length} patient(s)
      </div>

      {groupes.length === 0 ? (
        <div className={`rounded-lg border border-dashed p-6 text-center text-sm ${bord} ${muted}`}>
          Aucun soin enregistré {tousLesJours ? "" : "pour ce jour"}. Touchez « Enregistrer un soin » après chaque soin réalisé.
        </div>
      ) : (
        <div className="space-y-4">
          {groupes.map((g) => (
            <div key={g.nom}>
              <div className="flex items-center justify-between mb-1.5">
                <button onClick={() => setRecherche(g.nom)} className="font-bold flex items-center gap-1.5 hover:underline"><User className="w-4 h-4" /> {g.nom}</button>
                <button onClick={() => onOuvrirFormulaire({ patient: g.nom, contact: g.soins[0]?.contact, consultationId: g.soins[0]?.consultationId, hospitalisationId: g.soins[0]?.hospitalisationId })}
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouveau soin</button>
              </div>
              <div className="space-y-2">
                {g.soins.map((s) => (
                  <CarteSoin key={s.id} s={s} isDark={isDark} onSupprimer={supprimer} afficherPatient={false} afficherDate={tousLesJours} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
