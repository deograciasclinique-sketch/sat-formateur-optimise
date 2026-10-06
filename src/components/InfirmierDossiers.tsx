/**
 * Salle infirmier : rendez-vous du jour, dossiers patients et
 * programmation de nouveaux rendez-vous.
 *
 * Le dossier d'un patient est reconstitué à partir de toutes ses
 * consultations, de ses rendez-vous (avec les constantes prises le jour du
 * RDV) et de ses hospitalisations : l'app n'a pas de fiche patient séparée,
 * le patient est reconnu par son nom (et son numéro quand plusieurs
 * personnes portent le même nom).
 */

import React, { useMemo, useState } from "react";
import {
  CalendarDays, CalendarPlus, ClipboardList, FolderOpen, HeartPulse, Search, Send, Stethoscope, UserX, X, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Consultation, ConstantesRdv, Hospitalisation, RendezVous, Staff, SoinRealise } from "../types";
import { CarteSoin, soinsDuPatient } from "./SalleDesSoins";
import { generateUid, getTodayStr } from "../data";
import { formatWhatsAppNumber } from "../lib/whatsapp";

export const RDV_TYPES = [
  { value: "Consultation", label: "Consultation générale" },
  { value: "Suivi", label: "Suivi / Contrôle" },
  { value: "Vaccination", label: "Vaccination" },
  { value: "Analyse laboratoire", label: "Analyse Labo" },
  { value: "Soins infirmiers", label: "Soins infirmiers" },
];

/* ------------------------------------------------------------------ */
/*  Outils                                                             */
/* ------------------------------------------------------------------ */

const normNom = (s: string) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const tel8 = (s?: string) => (s || "").replace(/\D/g, "").slice(-8);

export const dateFr = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const clinicName = () => {
  try {
    const p = JSON.parse(localStorage.getItem("dg_clinic_profile") || "null");
    return (p && p.name) || "Cabinet Privé de Soins DEO-GRACIAS";
  } catch {
    return "Cabinet Privé de Soins DEO-GRACIAS";
  }
};

export interface MesureConstantes {
  date: string;
  source: string;
  temperature?: number;
  tensionArterielle?: string;
  pouls?: number;
  frequenceRespiratoire?: number;
  saturationO2?: number;
  poids?: number;
  taille?: number;
  imc?: number;
  glycemie?: number;
}

export interface DossierPatient {
  key: string;
  code?: string; // code patient du registre
  nom: string;
  contact: string;
  age?: number;
  sexe?: string;
  profession?: string;
  commune?: string;
  consultations: Consultation[];
  rdvs: RendezVous[];
  hospitalisations: Hospitalisation[];
  mesures: MesureConstantes[];
  derniereVisite?: string;
  prochainRdv?: RendezVous;
}

// Valeurs hors normes courantes chez l'adulte, pour attirer l'attention.
export function alertesConstantes(m: Partial<MesureConstantes>): string[] {
  const a: string[] = [];
  if (m.temperature && m.temperature >= 38) a.push("Fièvre");
  if (m.temperature && m.temperature > 0 && m.temperature < 35.5) a.push("Hypothermie");
  const ta = (m.tensionArterielle || "").match(/(\d{2,3})\s*[/\-]\s*(\d{2,3})/);
  if (ta) {
    const sys = +ta[1], dia = +ta[2];
    if (sys >= 140 || dia >= 90) a.push("TA élevée");
    if (sys < 90) a.push("TA basse");
  }
  if (m.pouls && m.pouls > 100) a.push("Pouls rapide");
  if (m.pouls && m.pouls > 0 && m.pouls < 50) a.push("Pouls lent");
  if (m.saturationO2 && m.saturationO2 < 94) a.push("SpO₂ basse");
  if (m.frequenceRespiratoire && m.frequenceRespiratoire > 24) a.push("Respiration rapide");
  return a;
}

function mesureDepuisConsultation(c: Consultation): MesureConstantes | null {
  const v = c.vitals;
  if (!v || !(v.temperature || v.poids || v.tensionArterielle || v.pouls || v.glycemie)) return null;
  return {
    date: c.date, source: "Consultation",
    temperature: v.temperature || undefined, tensionArterielle: v.tensionArterielle || undefined,
    pouls: v.pouls || undefined, poids: v.poids || undefined, taille: v.taille, imc: v.imc, glycemie: v.glycemie || undefined,
  };
}

function mesureDepuisRdv(r: RendezVous): MesureConstantes | null {
  const k = r.constantes;
  if (!k) return null;
  return { date: r.date, source: `RDV ${r.type}`, ...k };
}

/** Regroupe consultations, RDV et hospitalisations par patient. */
export function construireDossiers(consultations: Consultation[], rdvs: RendezVous[], hospitalisations: Hospitalisation[]): DossierPatient[] {
  type Rec = { nom: string; contact: string; kind: "c" | "r" | "h"; item: any };
  const recs: Rec[] = [
    ...consultations.map((c) => ({ nom: c.patient, contact: c.contact, kind: "c" as const, item: c })),
    ...rdvs.map((r) => ({ nom: r.patient, contact: r.contact, kind: "r" as const, item: r })),
    ...hospitalisations.map((h) => ({ nom: h.patient, contact: h.contact, kind: "h" as const, item: h })),
  ].filter((r) => normNom(r.nom));

  // Même nom mais plusieurs numéros différents = plusieurs personnes.
  const numerosParNom = new Map<string, Set<string>>();
  recs.forEach((r) => {
    const n = normNom(r.nom);
    if (!numerosParNom.has(n)) numerosParNom.set(n, new Set());
    if (tel8(r.contact)) numerosParNom.get(n)!.add(tel8(r.contact));
  });
  // Code patient : les visites qui portent un code sont regroupées par code ;
  // les autres (RDV, anciennes hospitalisations…) rejoignent le code connu
  // pour ce nom quand il n'y en a qu'un et que le téléphone ne contredit pas.
  const codesParNom = new Map<string, Map<string, string>>(); // nom -> code -> tel
  recs.forEach((r) => {
    const code = r.item?.codePatient;
    if (!code) return;
    const n = normNom(r.nom);
    if (!codesParNom.has(n)) codesParNom.set(n, new Map());
    const m = codesParNom.get(n)!;
    if (!m.get(code)) m.set(code, tel8(r.contact));
  });
  const cle = (r: Rec) => {
    if (r.item?.codePatient) return `code:${r.item.codePatient}`;
    const codes = codesParNom.get(normNom(r.nom));
    if (codes) {
      const t = tel8(r.contact);
      const ok = [...codes.entries()].filter(([, tc]) => !t || !tc || tc === t);
      if (ok.length === 1) return `code:${ok[0][0]}`;
    }
    const n = normNom(r.nom);
    const nums = numerosParNom.get(n)!;
    if (nums.size <= 1) return n;
    return `${n}|${tel8(r.contact) || [...nums][0]}`;
  };

  const map = new Map<string, DossierPatient>();
  recs.forEach((r) => {
    const k = cle(r);
    if (!map.has(k)) {
      map.set(k, { key: k, code: k.startsWith("code:") ? k.slice(5) : undefined, nom: r.nom.trim(), contact: "", consultations: [], rdvs: [], hospitalisations: [], mesures: [] });
    }
    const d = map.get(k)!;
    if (!d.contact && r.contact) d.contact = r.contact;
    if (r.kind === "c") d.consultations.push(r.item);
    else if (r.kind === "r") d.rdvs.push(r.item);
    else d.hospitalisations.push(r.item);
  });

  const today = getTodayStr();
  return [...map.values()].map((d) => {
    d.consultations.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    d.rdvs.sort((a, b) => `${b.date}${b.heure}`.localeCompare(`${a.date}${a.heure}`));
    d.hospitalisations.sort((a, b) => (b.dateAdmission || "").localeCompare(a.dateAdmission || ""));
    const last = d.consultations[0];
    if (last) {
      d.age = last.age || undefined; d.sexe = last.sexe; d.profession = last.profession; d.commune = last.commune;
      if (last.contact) d.contact = last.contact;
    }
    // Une consultation créée depuis un RDV reprend les constantes du RDV :
    // on ne garde que la mesure du RDV (plus complète) pour éviter les doublons.
    const issuesDeRdv = new Set(d.rdvs.filter((r) => r.constantes && r.consultationId).map((r) => r.consultationId));
    d.mesures = [
      ...d.consultations.filter((c) => !issuesDeRdv.has(c.id)).map(mesureDepuisConsultation),
      ...d.rdvs.map(mesureDepuisRdv),
    ].filter(Boolean).sort((a, b) => (b!.date || "").localeCompare(a!.date || "")) as MesureConstantes[];
    const dates = [
      ...d.consultations.map((c) => c.date),
      ...d.rdvs.filter((r) => r.date <= today && r.statut !== "Annulé" && r.statut !== "Absent").map((r) => r.date),
      ...d.hospitalisations.map((h) => h.dateAdmission),
    ].filter(Boolean).sort();
    d.derniereVisite = dates[dates.length - 1];
    d.prochainRdv = [...d.rdvs]
      .filter((r) => r.date >= today && (r.statut === "Planifié" || r.statut === "Confirmé"))
      .sort((a, b) => `${a.date}${a.heure}`.localeCompare(`${b.date}${b.heure}`))[0];
    return d;
  }).sort((a, b) => (b.derniereVisite || "").localeCompare(a.derniereVisite || ""));
}

export function trouverDossier(dossiers: DossierPatient[], nom: string, contact?: string, code?: string) {
  if (code) {
    const parCode = dossiers.find((d) => d.code === code);
    if (parCode) return parCode;
  }
  const n = normNom(nom);
  const t = tel8(contact);
  return dossiers.find((d) => normNom(d.nom) === n && (!t || !tel8(d.contact) || tel8(d.contact) === t))
    || dossiers.find((d) => normNom(d.nom) === n);
}

/* ------------------------------------------------------------------ */
/*  Éléments d'interface                                               */
/* ------------------------------------------------------------------ */

function Modal({ title, onClose, isDark, children }: { title: string; onClose: () => void; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 shadow-xl ${isDark ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"}`}
      >
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-1 rounded hover:bg-gray-500/10"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full mt-1 px-3 py-2 rounded border bg-transparent";
const labelCls = "text-sm font-medium";

function StatutRdv({ statut }: { statut: RendezVous["statut"] }) {
  const map: Record<string, string> = {
    Planifié: "bg-blue-500/15 text-blue-600",
    Confirmé: "bg-indigo-500/15 text-indigo-600",
    Terminé: "bg-emerald-500/15 text-emerald-600",
    Annulé: "bg-gray-500/15 text-gray-500",
    Absent: "bg-red-500/15 text-red-600",
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[statut] || ""}`}>{statut}</span>;
}

function AlertesBadges({ m }: { m: Partial<MesureConstantes> }) {
  const a = alertesConstantes(m);
  if (!a.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {a.map((x) => (
        <span key={x} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {x}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Prise des constantes pour un RDV                                   */
/* ------------------------------------------------------------------ */

export interface EtatRecu {
  valide: boolean;
  texte: string;
}

export function ConstantesRdvForm({
  rdv, dossier, staff, isDark, onClose, onSave, recu,
}: {
  rdv: RendezVous;
  dossier?: DossierPatient;
  staff: Staff[];
  isDark: boolean;
  recu?: EtatRecu;
  onClose: () => void;
  onSave: (constantes: ConstantesRdv, envoiMedecin: null | { age: number; sexe: "Masculin" | "Féminin"; praticienId: string }) => void;
}) {
  const k = rdv.constantes;
  const derniereTaille = dossier?.mesures.find((m) => m.taille)?.taille;
  const [f, setF] = useState({
    temperature: k?.temperature ? String(k.temperature) : "",
    tensionArterielle: k?.tensionArterielle || "",
    pouls: k?.pouls ? String(k.pouls) : "",
    frequenceRespiratoire: k?.frequenceRespiratoire ? String(k.frequenceRespiratoire) : "",
    saturationO2: k?.saturationO2 ? String(k.saturationO2) : "",
    poids: k?.poids ? String(k.poids) : "",
    taille: k?.taille ? String(k.taille) : derniereTaille ? String(derniereTaille) : "",
    glycemie: k?.glycemie ? String(k.glycemie) : "",
    observations: k?.observations || "",
    prisesPar: k?.prisesPar || "",
  });
  const dejaEnvoye = !!rdv.consultationId;
  const [envoyer, setEnvoyer] = useState(!dejaEnvoye && (rdv.type === "Consultation" || rdv.type === "Suivi"));
  const [age, setAge] = useState(dossier?.age ? String(dossier.age) : "");
  const [sexe, setSexe] = useState<"" | "Masculin" | "Féminin">((dossier?.sexe as any) || "");
  const [erreur, setErreur] = useState("");
  const set = (key: keyof typeof f, v: string) => { setF((p) => ({ ...p, [key]: v })); setErreur(""); };

  const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return isNaN(n) ? undefined : n; };
  const poids = num(f.poids), taille = num(f.taille);
  const imc = poids && taille ? parseFloat((poids / ((taille / 100) ** 2)).toFixed(1)) : undefined;
  const apercu = { temperature: num(f.temperature), tensionArterielle: f.tensionArterielle, pouls: num(f.pouls), saturationO2: num(f.saturationO2), frequenceRespiratoire: num(f.frequenceRespiratoire) };

  const submit = () => {
    if (!f.temperature && !f.tensionArterielle && !f.pouls && !f.poids) {
      setErreur("Saisissez au moins une constante (température, tension, pouls ou poids).");
      return;
    }
    if (envoyer && (!num(age) || !sexe)) {
      setErreur("Pour envoyer le patient au médecin, indiquez son âge et son sexe.");
      return;
    }
    const staffNom = staff.find((s) => s.id === f.prisesPar)?.nom;
    onSave(
      {
        temperature: num(f.temperature), tensionArterielle: f.tensionArterielle.trim() || undefined,
        pouls: num(f.pouls), frequenceRespiratoire: num(f.frequenceRespiratoire), saturationO2: num(f.saturationO2),
        poids, taille, imc, glycemie: num(f.glycemie), observations: f.observations.trim() || undefined,
        prisesLe: new Date().toISOString(), prisesPar: staffNom || undefined,
      },
      envoyer ? { age: num(age)!, sexe: sexe as "Masculin" | "Féminin", praticienId: f.prisesPar } : null
    );
  };

  const champ = (key: keyof typeof f, label: string, placeholder: string, mode: "decimal" | "text" = "decimal") => (
    <div>
      <label className={labelCls}>{label}</label>
      <input className={inputCls} inputMode={mode} placeholder={placeholder} value={f[key]} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <Modal title={`Constantes — ${rdv.patient}`} onClose={onClose} isDark={isDark}>
      <p className={`text-sm mb-3 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        RDV du {dateFr(rdv.date)} à {rdv.heure} · {rdv.type}{rdv.motif ? ` · ${rdv.motif}` : ""}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {champ("temperature", "Température (°C)", "37.2")}
        {champ("tensionArterielle", "Tension (mmHg)", "120/80", "text")}
        {champ("pouls", "Pouls (bpm)", "80")}
        {champ("frequenceRespiratoire", "Fréq. respiratoire (/min)", "18")}
        {champ("saturationO2", "SpO₂ (%)", "98")}
        {champ("glycemie", "Glycémie", "1.05")}
        {champ("poids", "Poids (kg)", "65")}
        {champ("taille", "Taille (cm)", "170")}
        <div>
          <label className={labelCls}>IMC</label>
          <div className={`mt-1 px-3 py-2 rounded border ${isDark ? "border-gray-700" : "border-gray-200"} font-semibold`}>{imc ?? "—"}</div>
        </div>
      </div>
      <AlertesBadges m={apercu} />

      <div className="mt-3">
        <label className={labelCls}>Observations</label>
        <textarea className={inputCls + " min-h-[70px]"} value={f.observations} onChange={(e) => set("observations", e.target.value)} placeholder="Plaintes du jour, état général…" />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Constantes prises par</label>
        <select className={inputCls} value={f.prisesPar} onChange={(e) => set("prisesPar", e.target.value)}>
          <option value="">— Choisir —</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
        </select>
      </div>

      <div className={`mt-4 rounded-lg border p-3 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
        {dejaEnvoye ? (
          <p className="text-sm text-emerald-600 font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Ce patient a déjà été envoyé au médecin pour ce RDV.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={envoyer} onChange={(e) => setEnvoyer(e.target.checked)} />
              <Stethoscope className="w-4 h-4" /> Envoyer le patient au médecin (crée son dossier de consultation)
            </label>
            {envoyer && recu && (
              <p className={`text-sm mt-2 font-medium ${recu.valide ? "text-emerald-600" : "text-amber-600"}`}>
                {recu.valide ? "✓ " : "⚠ "}{recu.texte}
              </p>
            )}
            {envoyer && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={labelCls}>Âge (ans)</label>
                  <input className={inputCls} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Sexe</label>
                  <select className={inputCls} value={sexe} onChange={(e) => setSexe(e.target.value as any)}>
                    <option value="">— Choisir —</option>
                    <option value="Masculin">Masculin</option>
                    <option value="Féminin">Féminin</option>
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {erreur && <p className="text-sm text-red-600 font-medium mt-3">{erreur}</p>}
      <button onClick={submit} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg py-2.5">
        {!envoyer ? "Enregistrer les constantes" : recu && !recu.valide ? "Enregistrer et envoyer à la caisse" : "Enregistrer et envoyer au médecin"}
      </button>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Programmer un nouveau rendez-vous                                  */
/* ------------------------------------------------------------------ */

export function NouveauRdvForm({
  patient, contact, rdvPrecedentId, rdvs, staff, isDark, onClose, onSave,
}: {
  patient?: string;
  contact?: string;
  rdvPrecedentId?: string;
  rdvs: RendezVous[];
  staff: Staff[];
  isDark: boolean;
  onClose: () => void;
  onSave: (rdv: RendezVous) => void;
}) {
  const dans7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({
    patient: patient || "", contact: contact || "", date: dans7, heure: "08:00", type: "Suivi", praticien: "", motif: "", notes: "",
  });
  const [enregistre, setEnregistre] = useState<RendezVous | null>(null);
  const [erreur, setErreur] = useState("");
  const set = (k: keyof typeof f, v: string) => { setF((p) => ({ ...p, [k]: v })); setErreur(""); };

  const conflit = rdvs.find((r) => r.date === f.date && r.heure === f.heure && r.statut !== "Annulé" && (!f.praticien || r.praticien === f.praticien));
  const memeJour = rdvs.filter((r) => r.date === f.date && r.statut !== "Annulé").length;

  const submit = () => {
    if (!f.patient.trim()) { setErreur("Indiquez le nom du patient."); return; }
    if (!f.date || !f.heure) { setErreur("Indiquez la date et l'heure."); return; }
    if (f.date < getTodayStr()) { setErreur("La date du rendez-vous est déjà passée."); return; }
    const rdv: RendezVous = {
      id: generateUid(), patient: f.patient.trim(), contact: f.contact.trim(), date: f.date, heure: f.heure,
      type: f.type, praticien: f.praticien, motif: f.motif.trim(), notes: f.notes.trim(), statut: "Planifié",
      createdAt: new Date().toISOString(), rdvPrecedentId, creePar: "Salle infirmier",
    };
    onSave(rdv);
    setEnregistre(rdv);
  };

  if (enregistre) {
    const num = formatWhatsAppNumber(enregistre.contact);
    const prat = staff.find((s) => s.id === enregistre.praticien)?.nom;
    const msg = [
      `*${clinicName()}*`, "",
      `Bonjour ${enregistre.patient},`,
      `Votre prochain rendez-vous est programmé :`,
      `📅 ${dateFr(enregistre.date)} à ${enregistre.heure}`,
      `🩺 ${RDV_TYPES.find((t) => t.value === enregistre.type)?.label || enregistre.type}${enregistre.motif ? ` — ${enregistre.motif}` : ""}`,
      prat ? `👨‍⚕️ Avec : ${prat}` : "",
      "", "Merci de venir avec votre carnet. En cas d'empêchement, prévenez-nous.",
    ].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");
    return (
      <Modal title="Rendez-vous programmé" onClose={onClose} isDark={isDark}>
        <div className="rounded-lg bg-emerald-500/10 text-emerald-700 p-3 mb-3 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-semibold">{enregistre.patient}</div>
            {dateFr(enregistre.date)} à {enregistre.heure} · {enregistre.type}
          </div>
        </div>
        {num ? (
          <a href={`https://wa.me/${num}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold rounded-lg py-2.5">
            <Send className="w-4 h-4" /> Prévenir le patient par WhatsApp
          </a>
        ) : (
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Pas de numéro valable : le patient ne peut pas être prévenu par WhatsApp.</p>
        )}
        <button onClick={onClose} className={`w-full mt-2 rounded-lg py-2.5 font-semibold border ${isDark ? "border-gray-700" : "border-gray-200"}`}>Terminer</button>
      </Modal>
    );
  }

  return (
    <Modal title="Programmer un nouveau rendez-vous" onClose={onClose} isDark={isDark}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Patient</label>
          <input className={inputCls} value={f.patient} onChange={(e) => set("patient", e.target.value)} placeholder="Nom et prénom" />
        </div>
        <div>
          <label className={labelCls}>Téléphone</label>
          <input className={inputCls} inputMode="tel" value={f.contact} onChange={(e) => set("contact", e.target.value)} placeholder="70 00 00 00" />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" className={inputCls} min={getTodayStr()} value={f.date} onChange={(e) => set("date", e.target.value)} />
          <div className="flex gap-1 mt-1 flex-wrap">
            {[["+1 sem.", 7], ["+2 sem.", 14], ["+1 mois", 30], ["+3 mois", 90]].map(([l, j]) => (
              <button key={l as string} type="button" onClick={() => set("date", new Date(Date.now() + (j as number) * 86400000).toISOString().slice(0, 10))}
                className={`text-xs px-2 py-0.5 rounded-full border ${isDark ? "border-gray-700" : "border-gray-300"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Heure</label>
          <input type="time" className={inputCls} value={f.heure} onChange={(e) => set("heure", e.target.value)} />
          <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>{memeJour} RDV déjà prévu(s) ce jour-là</p>
        </div>
        <div>
          <label className={labelCls}>Type</label>
          <select className={inputCls} value={f.type} onChange={(e) => set("type", e.target.value)}>
            {RDV_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Praticien</label>
          <select className={inputCls} value={f.praticien} onChange={(e) => set("praticien", e.target.value)}>
            <option value="">— Non assigné —</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>Motif</label>
        <input className={inputCls} value={f.motif} onChange={(e) => set("motif", e.target.value)} placeholder="Ex. Contrôle de la tension, renouvellement du traitement" />
      </div>
      <div className="mt-3">
        <label className={labelCls}>Notes</label>
        <textarea className={inputCls + " min-h-[60px]"} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      {conflit && (
        <p className="text-sm text-amber-600 font-medium mt-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Il y a déjà un RDV à cette heure{f.praticien ? " avec ce praticien" : ""} : {conflit.patient}.
        </p>
      )}
      {erreur && <p className="text-sm text-red-600 font-medium mt-3">{erreur}</p>}
      <button onClick={submit} className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2">
        <CalendarPlus className="w-4 h-4" /> Programmer le rendez-vous
      </button>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Dossier d'un patient                                               */
/* ------------------------------------------------------------------ */

export function DossierPatientView({
  dossier, isDark, onClose, onNouveauRdv, onConstantes, soins = [],
}: {
  dossier: DossierPatient;
  isDark: boolean;
  onClose: () => void;
  onNouveauRdv: () => void;
  onConstantes: (r: RendezVous) => void;
  soins?: SoinRealise[];
}) {
  const [onglet, setOnglet] = useState<"constantes" | "soins" | "consultations" | "rdv" | "hospit">("constantes");
  const soinsPatient = useMemo(() => soinsDuPatient(soins, dossier.nom), [soins, dossier.nom]);
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const bord = isDark ? "border-gray-700" : "border-gray-200";
  const today = getTodayStr();
  const d = dossier;

  const onglets: [typeof onglet, string][] = [
    ["constantes", `Constantes (${d.mesures.length})`],
    ["soins", `Soins réalisés (${soinsPatient.length})`],
    ["consultations", `Consultations (${d.consultations.length})`],
    ["rdv", `Rendez-vous (${d.rdvs.length})`],
    ["hospit", `Hospitalisations (${d.hospitalisations.length})`],
  ];

  return (
    <Modal title={`Dossier — ${d.code ? `${d.code} · ` : ""}${d.nom}`} onClose={onClose} isDark={isDark}>
      <div className={`rounded-lg border p-3 mb-3 ${bord}`}>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {d.age ? <span><b>{d.age} ans</b></span> : null}
          {d.sexe && <span>{d.sexe}</span>}
          {d.contact && <span>📞 {d.contact}</span>}
          {d.profession && <span>{d.profession}</span>}
          {d.commune && <span>{d.commune}</span>}
        </div>
        <div className={`text-xs mt-1 ${muted}`}>
          Dernière visite : {d.derniereVisite ? dateFr(d.derniereVisite) : "—"}
          {d.prochainRdv ? ` · Prochain RDV : ${dateFr(d.prochainRdv.date)} à ${d.prochainRdv.heure}` : " · Aucun RDV à venir"}
        </div>
        <button onClick={onNouveauRdv} className="mt-3 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center justify-center gap-2">
          <CalendarPlus className="w-4 h-4" /> Programmer un nouveau RDV
        </button>
      </div>

      <div className={`flex gap-1 overflow-x-auto mb-3 border-b ${bord}`}>
        {onglets.map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)}
            className={`px-3 py-2 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${onglet === k ? "border-emerald-600 text-emerald-600" : `border-transparent ${muted}`}`}>{l}</button>
        ))}
      </div>

      {onglet === "constantes" && (
        d.mesures.length === 0 ? <p className={`text-sm ${muted}`}>Aucune constante enregistrée.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left text-xs uppercase ${muted}`}>
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">T°</th><th className="py-2 pr-3">TA</th><th className="py-2 pr-3">Pouls</th>
                  <th className="py-2 pr-3">SpO₂</th><th className="py-2 pr-3">Poids</th><th className="py-2 pr-3">IMC</th><th className="py-2 pr-3">Glyc.</th>
                </tr>
              </thead>
              <tbody>
                {d.mesures.map((m, i) => {
                  const al = alertesConstantes(m);
                  return (
                    <tr key={i} className={`border-t ${bord} align-top`}>
                      <td className="py-2 pr-3 whitespace-nowrap">{dateFr(m.date)}<div className={`text-[11px] ${muted}`}>{m.source}</div></td>
                      <td className={`py-2 pr-3 ${m.temperature && (m.temperature >= 38 || m.temperature < 35.5) ? "text-red-600 font-bold" : ""}`}>{m.temperature ?? "—"}</td>
                      <td className={`py-2 pr-3 whitespace-nowrap ${al.some((x) => x.startsWith("TA")) ? "text-red-600 font-bold" : ""}`}>{m.tensionArterielle || "—"}</td>
                      <td className={`py-2 pr-3 ${al.some((x) => x.startsWith("Pouls")) ? "text-red-600 font-bold" : ""}`}>{m.pouls ?? "—"}</td>
                      <td className={`py-2 pr-3 ${m.saturationO2 && m.saturationO2 < 94 ? "text-red-600 font-bold" : ""}`}>{m.saturationO2 ?? "—"}</td>
                      <td className="py-2 pr-3">{m.poids ?? "—"}</td>
                      <td className="py-2 pr-3">{m.imc ?? "—"}</td>
                      <td className="py-2 pr-3">{m.glycemie ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {onglet === "consultations" && (
        d.consultations.length === 0 ? <p className={`text-sm ${muted}`}>Aucune consultation.</p> : (
          <div className="space-y-2">
            {d.consultations.map((c) => (
              <div key={c.id} className={`rounded-lg border p-3 ${bord}`}>
                <div className="flex justify-between gap-2 text-sm">
                  <b>{dateFr(c.date)}</b>
                  <span className={`text-xs ${muted}`}>{c.statut || "Terminée"}</span>
                </div>
                {c.plainte && <div className="text-sm mt-1"><span className={muted}>Motif : </span>{c.plainte}</div>}
                {(c.diagnosticFinal || c.diagnostic) && <div className="text-sm"><span className={muted}>Diagnostic : </span>{c.diagnosticFinal || c.diagnostic}</div>}
                {c.decision && <div className="text-sm"><span className={muted}>Décision : </span>{c.decision}{c.referenceService ? ` (${c.referenceService})` : ""}</div>}
                {c.ordonnance?.length > 0 && (
                  <div className="text-sm mt-1"><span className={muted}>Traitement : </span>{c.ordonnance.map((l) => `${l.medicamentNom}${l.posologie ? ` (${l.posologie})` : ""}`).join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {onglet === "rdv" && (
        d.rdvs.length === 0 ? <p className={`text-sm ${muted}`}>Aucun rendez-vous.</p> : (
          <div className="space-y-2">
            {d.rdvs.map((r) => (
              <div key={r.id} className={`rounded-lg border p-3 ${bord}`}>
                <div className="flex justify-between items-center gap-2 text-sm">
                  <b>{dateFr(r.date)} à {r.heure}</b>
                  <StatutRdv statut={r.statut} />
                </div>
                <div className="text-sm">{r.type}{r.motif ? ` — ${r.motif}` : ""}</div>
                {r.constantes && (
                  <div className={`text-xs mt-1 ${muted}`}>
                    Constantes : {[r.constantes.temperature && `T° ${r.constantes.temperature}`, r.constantes.tensionArterielle && `TA ${r.constantes.tensionArterielle}`, r.constantes.pouls && `Pouls ${r.constantes.pouls}`, r.constantes.poids && `${r.constantes.poids} kg`].filter(Boolean).join(" · ")}
                  </div>
                )}
                {r.date === today && r.statut !== "Annulé" && (
                  <button onClick={() => onConstantes(r)} className="mt-2 text-sm font-semibold text-emerald-600 flex items-center gap-1">
                    <HeartPulse className="w-4 h-4" /> {r.constantes ? "Modifier les constantes" : "Prendre les constantes"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {onglet === "soins" && (
        soinsPatient.length === 0 ? <p className={`text-sm ${muted}`}>Aucun soin enregistré dans la Salle des soins.</p> : (
          <div className="space-y-2">
            {soinsPatient.map((s) => <CarteSoin key={s.id} s={s} isDark={isDark} afficherPatient={false} afficherDate />)}
          </div>
        )
      )}

      {onglet === "hospit" && (
        d.hospitalisations.length === 0 ? <p className={`text-sm ${muted}`}>Aucune hospitalisation.</p> : (
          <div className="space-y-2">
            {d.hospitalisations.map((h) => (
              <div key={h.id} className={`rounded-lg border p-3 ${bord}`}>
                <div className="flex justify-between gap-2 text-sm"><b>{dateFr(h.dateAdmission)}</b><span className={`text-xs ${muted}`}>{h.statut}</span></div>
                <div className="text-sm">{h.typeAdmission || h.service}{h.motif ? ` — ${h.motif}` : ""}</div>
                {h.diagnosticSortie && <div className="text-sm"><span className={muted}>Diagnostic de sortie : </span>{h.diagnosticSortie}</div>}
              </div>
            ))}
          </div>
        )
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Onglets de la salle infirmier                                      */
/* ------------------------------------------------------------------ */

export function RdvDuJour({
  rdvs, dossiers, isDark, onConstantes, onDossier, onNouveauRdv, onAbsent, etatRecu,
}: {
  etatRecu?: (r: RendezVous) => EtatRecu | null;
  rdvs: RendezVous[];
  dossiers: DossierPatient[];
  isDark: boolean;
  onConstantes: (r: RendezVous) => void;
  onDossier: (d: DossierPatient) => void;
  onNouveauRdv: (r?: RendezVous) => void;
  onAbsent: (r: RendezVous) => void;
}) {
  const [date, setDate] = useState(getTodayStr());
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const liste = rdvs.filter((r) => r.date === date && r.statut !== "Annulé").sort((a, b) => (a.heure || "").localeCompare(b.heure || ""));
  const faits = liste.filter((r) => r.constantes).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <label className={labelCls}>Rendez-vous du</label>
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button onClick={() => onNouveauRdv()} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-2 flex items-center gap-2">
          <CalendarPlus className="w-4 h-4" /> Nouveau RDV
        </button>
      </div>
      <p className={`text-sm ${muted}`}>{liste.length} rendez-vous · constantes prises pour {faits}</p>

      {liste.length === 0 ? (
        <p className={`text-sm ${muted}`}>Aucun rendez-vous ce jour-là.</p>
      ) : liste.map((r) => {
        const d = trouverDossier(dossiers, r.patient, r.contact);
        return (
          <div key={r.id} className={`rounded-lg border p-3 ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"} ${r.constantes ? "border-l-4 border-l-emerald-500" : ""}`}>
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="font-semibold">{r.heure} · {r.patient}</div>
                <div className={`text-sm ${muted}`}>
                  {RDV_TYPES.find((t) => t.value === r.type)?.label || r.type}{r.motif ? ` — ${r.motif}` : ""}
                  {d?.age ? ` · ${d.age} ans` : ""}{r.contact ? ` · ${r.contact}` : ""}
                </div>
              </div>
              <StatutRdv statut={r.statut} />
            </div>
            {(() => {
              const e = !r.consultationId && r.statut !== "Absent" ? etatRecu?.(r) : null;
              return e ? (
                <div className={`text-xs mt-1 font-medium ${e.valide ? "text-emerald-600" : "text-amber-600"}`}>{e.valide ? "✓ " : "⚠ "}{e.texte}</div>
              ) : null;
            })()}
            {r.constantes && (
              <div className="text-sm mt-2">
                <span className={muted}>Constantes : </span>
                {[r.constantes.temperature && `T° ${r.constantes.temperature}°C`, r.constantes.tensionArterielle && `TA ${r.constantes.tensionArterielle}`, r.constantes.pouls && `Pouls ${r.constantes.pouls}`, r.constantes.saturationO2 && `SpO₂ ${r.constantes.saturationO2}%`, r.constantes.poids && `${r.constantes.poids} kg`].filter(Boolean).join(" · ")}
                {r.consultationId && <span className="text-emerald-600 font-medium"> · envoyé au médecin</span>}
                <AlertesBadges m={r.constantes} />
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {r.statut !== "Absent" && (
                <button onClick={() => onConstantes(r)} className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3 py-1.5 flex items-center gap-1">
                  <HeartPulse className="w-4 h-4" /> {r.constantes ? "Modifier les constantes" : "Prendre les constantes"}
                </button>
              )}
              {d && (
                <button onClick={() => onDossier(d)} className={`text-sm font-semibold rounded-lg px-3 py-1.5 border flex items-center gap-1 ${isDark ? "border-gray-600" : "border-gray-300"}`}>
                  <FolderOpen className="w-4 h-4" /> Dossier
                </button>
              )}
              <button onClick={() => onNouveauRdv(r)} className={`text-sm font-semibold rounded-lg px-3 py-1.5 border flex items-center gap-1 ${isDark ? "border-gray-600" : "border-gray-300"}`}>
                <CalendarPlus className="w-4 h-4" /> Prochain RDV
              </button>
              {!r.constantes && r.statut !== "Absent" && r.statut !== "Terminé" && (
                <button onClick={() => onAbsent(r)} className="text-sm font-semibold rounded-lg px-3 py-1.5 text-red-600 flex items-center gap-1">
                  <UserX className="w-4 h-4" /> Absent
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ListeDossiers({
  dossiers, isDark, onDossier,
}: {
  dossiers: DossierPatient[];
  isDark: boolean;
  onDossier: (d: DossierPatient) => void;
}) {
  const [q, setQ] = useState("");
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const filtres = useMemo(() => {
    const n = normNom(q);
    const t = q.replace(/\D/g, "");
    if (!n) return dossiers.slice(0, 50);
    const qc = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    return dossiers.filter((d) =>
      normNom(d.nom).includes(n) ||
      (t.length >= 3 && (d.contact || "").replace(/\D/g, "").includes(t)) ||
      (qc.length >= 3 && !!d.code && d.code.replace(/[^A-Z0-9]/g, "").includes(qc))
    ).slice(0, 100);
  }, [dossiers, q]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
        <input className="w-full pl-9 pr-3 py-2 rounded border bg-transparent" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un patient par code (DG-…), nom ou téléphone…" />
      </div>
      <p className={`text-sm ${muted}`}>{dossiers.length} dossiers patients{!q ? " · les 50 derniers vus" : ""}</p>
      {filtres.length === 0 ? (
        <p className={`text-sm ${muted}`}>Aucun patient trouvé.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtres.map((d) => (
            <button key={d.key} onClick={() => onDossier(d)}
              className={`text-left rounded-lg border p-3 transition ${isDark ? "border-gray-700 bg-gray-800 hover:bg-gray-700" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
              <div className="font-semibold">
                {d.code && <span className="font-mono text-emerald-600 mr-1.5">{d.code}</span>}{d.nom}
              </div>
              <div className={`text-xs ${muted}`}>
                {[d.age ? `${d.age} ans` : "", d.sexe, d.contact].filter(Boolean).join(" · ")}
              </div>
              <div className={`text-xs mt-1 ${muted}`}>
                {d.consultations.length} consult. · {d.rdvs.length} RDV
                {d.derniereVisite ? ` · vu le ${dateFr(d.derniereVisite)}` : ""}
              </div>
              {d.prochainRdv && (
                <div className="text-xs mt-1 text-emerald-600 font-medium flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Prochain RDV : {dateFr(d.prochainRdv.date)} à {d.prochainRdv.heure}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const InfirmierIcons = { ClipboardList, CalendarDays, FolderOpen };
