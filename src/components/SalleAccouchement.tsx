/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Salle d'accouchement — Guide de soins du travail (LCG, OMS 2020).
 *
 * - Admission de la parturiente (préremplie depuis son dossier CPN).
 * - Saisie des observations (soins de soutien, bébé, femme, travail,
 *   médicaments, prise de décision partagée).
 * - Alertes automatiques selon les seuils du LCG + rappels des contrôles
 *   (BCF, pouls, contractions, TA, température, toucher vaginal).
 * - Courbe du col, courbe des BCF et grille LCG.
 * - Issue de l'accouchement (inscrite automatiquement au registre),
 *   transfert / référence, surveillance du post-partum immédiat.
 *
 * Les données sont synchronisées entre appareils (clé "dg_partogrammes"),
 * pour qu'une sage-femme puisse prendre la relève d'une collègue.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type {
  Accouchement,
  ConsultationPrenatale,
  IssueAccouchement,
  ObservationLCG,
  Partogramme,
  Staff,
  SurveillancePostPartum,
} from "../types";
import { generateUid } from "../data";
import { taElevee } from "../lib/lcg";
import {
  alertesEnCours,
  alertesObservation,
  dateHeureCourte,
  debutDeuxiemePhase,
  debutPhaseActive,
  dernierCol,
  formatDuree,
  heureCourte,
  prochainsControles,
  trierObservations,
  versInputLocal,
} from "../lib/lcg";
import { sendBrowserNotification } from "../lib/browserNotifications";
import { CourbeBCF, CourbeCol, GrilleLCG } from "./PartogrammeGraphiques";
import {
  Activity,
  AlertTriangle,
  Baby,
  Bell,
  CheckCircle,
  ClipboardList,
  Clock,
  HeartPulse,
  Plus,
  Printer,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

interface Props {
  partogrammes: Partogramme[];
  onUpdatePartogrammes: (p: Partogramme[]) => void;
  cpns: ConsultationPrenatale[];
  accouchements: Accouchement[];
  onUpdateAccouchements: (a: Accouchement[]) => void;
  staff: Staff[];
  currentUser?: Staff | null;
  /** Admission demandée depuis un autre écran (ex. patiente envoyée par le secrétariat). */
  admissionPrefill?: { patient: string; contact?: string; age?: number } | null;
  onAdmissionPrefillConsumed?: () => void;
  /** Ouvre la déclaration de naissance de l'accouchement (registre de la maternité). */
  onEtablirDeclaration?: (accouchementId: string) => void;
}

// --- Petits composants de formulaire -------------------------------------------------
const inputCls =
  "w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-pink-400";

function Champ({ label, children, alerte }: { label: string; children: React.ReactNode; alerte?: boolean }) {
  return (
    <div>
      <label className={`text-2xs uppercase font-semibold tracking-wider block mb-0.5 ${alerte ? "text-danger-700" : "text-stone-500"}`}>
        {alerte ? "⚠ " : ""}
        {label}
      </label>
      {children}
    </div>
  );
}

function Choix<T extends string>({
  value,
  onChange,
  options,
  alerte,
}: {
  value: T | "";
  onChange: (v: T | "") => void;
  options: { v: T; l: string }[];
  alerte?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T | "")}
      className={`${inputCls} ${alerte ? "!border-danger-400 !bg-danger-50 text-danger-800 font-bold" : ""}`}
    >
      <option value="">—</option>
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
}

const num = (s: string): number | undefined => {
  if (s.trim() === "") return undefined;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? undefined : n;
};
const txt = (s: string): string | undefined => (s.trim() ? s.trim() : undefined);
/** Supprime les clés undefined (Firestore refuse les valeurs undefined). */
function nettoyer<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

const OUI_NON = [
  { v: "O" as const, l: "Oui (O)" },
  { v: "N" as const, l: "Non (N)" },
];
const CROIX = [
  { v: "0" as const, l: "0" },
  { v: "+" as const, l: "+" },
  { v: "++" as const, l: "++" },
  { v: "+++" as const, l: "+++" },
];

// Formulaire d'observation vide
const OBS_VIDE = {
  dateHeure: "",
  accompagnant: "" as "" | "O" | "N",
  soulagementDouleur: "" as "" | "O" | "N",
  hydratationOrale: "" as "" | "O" | "N",
  positionMere: "" as "" | "SP" | "MO",
  bcf: "",
  decelerations: "" as "" | "N" | "P" | "T" | "V",
  liquideAmniotique: "" as "" | "I" | "C" | "M+" | "M++" | "M+++" | "S",
  positionFoetale: "" as "" | "OA" | "OP" | "OT",
  bosse: "" as "" | "0" | "+" | "++" | "+++",
  modelage: "" as "" | "0" | "+" | "++" | "+++",
  pouls: "",
  taSys: "",
  taDia: "",
  temperature: "",
  urineProteines: "" as "" | "0" | "+" | "++" | "+++",
  urineAcetone: "" as "" | "0" | "+" | "++" | "+++",
  contractionsPar10min: "",
  dureeContractions: "",
  col: "",
  descente: "",
  ocytocine: "",
  medicaments: "",
  liquidesIV: "",
  evaluation: "",
  plan: "",
};
type ObsForm = typeof OBS_VIDE;

function formVersObservation(f: ObsForm, agentNom?: string): ObservationLCG {
  return nettoyer<ObservationLCG>({
    id: generateUid(),
    dateHeure: new Date(f.dateHeure || Date.now()).toISOString(),
    accompagnant: f.accompagnant || undefined,
    soulagementDouleur: f.soulagementDouleur || undefined,
    hydratationOrale: f.hydratationOrale || undefined,
    positionMere: f.positionMere || undefined,
    bcf: num(f.bcf),
    decelerations: f.decelerations || undefined,
    liquideAmniotique: f.liquideAmniotique || undefined,
    positionFoetale: f.positionFoetale || undefined,
    bosse: f.bosse || undefined,
    modelage: f.modelage || undefined,
    pouls: num(f.pouls),
    taSys: num(f.taSys),
    taDia: num(f.taDia),
    temperature: num(f.temperature),
    urineProteines: f.urineProteines || undefined,
    urineAcetone: f.urineAcetone || undefined,
    contractionsPar10min: num(f.contractionsPar10min),
    dureeContractions: num(f.dureeContractions),
    col: num(f.col),
    descente: num(f.descente),
    ocytocine: txt(f.ocytocine),
    medicaments: txt(f.medicaments),
    liquidesIV: txt(f.liquidesIV),
    evaluation: txt(f.evaluation),
    plan: txt(f.plan),
    agentNom: agentNom || undefined,
    createdAt: new Date().toISOString(),
  });
}

// =====================================================================================
export default function SalleAccouchement({
  partogrammes,
  onUpdatePartogrammes,
  cpns,
  accouchements,
  onUpdateAccouchements,
  staff,
  currentUser,
  admissionPrefill,
  onAdmissionPrefillConsumed,
  onEtablirDeclaration,
}: Props) {
  const [maintenant, setMaintenant] = useState(new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdmission, setShowAdmission] = useState(false);
  // Correction des informations d'admission d'un partogramme existant.
  const [editPartoId, setEditPartoId] = useState<string | null>(null);
  const [vueDetail, setVueDetail] = useState<"saisie" | "grille" | "issue" | "postpartum">("saisie");

  // Horloge : rafraîchit les alertes et les rappels toutes les 30 s.
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const enCours = useMemo(
    () => partogrammes.filter((p) => p.statut === "En cours").sort((a, b) => a.admission.localeCompare(b.admission)),
    [partogrammes]
  );
  const termines = useMemo(
    () => partogrammes.filter((p) => p.statut !== "En cours").sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)),
    [partogrammes]
  );
  const selected = partogrammes.find((p) => p.id === selectedId) || null;

  // Sélectionne automatiquement la première parturiente en cours.
  useEffect(() => {
    if (!selectedId && enCours.length > 0) setSelectedId(enCours[0].id);
  }, [enCours, selectedId]);

  // --- Notifications (application ouverte) : contrôle en retard / nouvelle alerte ---
  const dejaNotifie = useRef<Set<string>>(new Set());
  useEffect(() => {
    enCours.forEach((p) => {
      prochainsControles(p, maintenant)
        .filter((c) => c.enRetard)
        .forEach((c) => {
          const cle = `${p.id}|${c.label}|${c.echeance.getTime()}`;
          if (dejaNotifie.current.has(cle)) return;
          dejaNotifie.current.add(cle);
          sendBrowserNotification(`Salle d'accouchement — ${p.patient}`, `Contrôle à faire : ${c.label} (prévu à ${heureCourte(c.echeance.toISOString())})`, cle);
        });
      alertesEnCours(p, maintenant).forEach((a) => {
        const cle = `${p.id}|alerte|${a.message}`;
        if (dejaNotifie.current.has(cle)) return;
        dejaNotifie.current.add(cle);
        sendBrowserNotification(`⚠ Alerte LCG — ${p.patient}`, a.message, cle);
      });
    });
  }, [enCours, maintenant]);

  const majPartogramme = (id: string, maj: (p: Partogramme) => Partogramme) => {
    onUpdatePartogrammes(
      partogrammes.map((p) => (p.id === id ? nettoyer({ ...maj(p), updatedAt: new Date().toISOString() }) : p))
    );
  };

  // ================================================================ Admission
  const [adm, setAdm] = useState({
    patient: "",
    contact: "",
    age: "",
    gestite: "",
    parite: "",
    ddr: "",
    admission: versInputLocal(),
    debutTravail: "",
    ruptureMembranes: "",
    facteursRisque: "",
    sageFemmeId: "",
  });

  // Patientes connues en CPN (dernière visite de chacune)
  const patientesCpn = useMemo(() => {
    const m = new Map<string, ConsultationPrenatale>();
    [...cpns].sort((a, b) => a.dateVisite.localeCompare(b.dateVisite)).forEach((c) => m.set(c.patient.trim().toLowerCase(), c));
    return m;
  }, [cpns]);

  const remplirDepuisCpn = (nom: string) => {
    const c = patientesCpn.get(nom.trim().toLowerCase());
    if (!c) return;
    const risques: string[] = [];
    if (taElevee(c.ta)) risques.push(`TA ${c.ta} en CPN`);
    if (c.albuminurie === "Positive") risques.push("Albuminurie positive en CPN");
    if (c.hemoglobine !== undefined && c.hemoglobine < 11) risques.push(`Hb ${c.hemoglobine} g/dL`);
    if (c.serologieVIH === "Positif") risques.push("VIH+");
    if (c.rhesus === "Négatif") risques.push("Rhésus négatif");
    if (c.presentation && c.presentation !== "Céphalique") risques.push(`Présentation ${c.presentation.toLowerCase()} à la dernière CPN`);
    setAdm((a) => ({
      ...a,
      patient: c.patient,
      contact: c.contact || a.contact,
      gestite: c.gestite?.toString() ?? a.gestite,
      parite: c.parite?.toString() ?? a.parite,
      ddr: c.ddr || a.ddr,
      facteursRisque: a.facteursRisque || risques.join(" ; "),
    }));
  };

  useEffect(() => {
    if (admissionPrefill) {
      setAdm((a) => ({
        ...a,
        patient: admissionPrefill.patient,
        contact: admissionPrefill.contact || "",
        age: admissionPrefill.age ? String(admissionPrefill.age) : "",
        admission: versInputLocal(),
      }));
      remplirDepuisCpn(admissionPrefill.patient);
      setShowAdmission(true);
      onAdmissionPrefillConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionPrefill]);

  const saAuJour = (ddr: string): number | undefined => {
    if (!ddr) return undefined;
    return Math.floor((Date.now() - new Date(ddr).getTime()) / (7 * 24 * 3600 * 1000));
  };

  const ouvrirCorrectionAdmission = (p: Partogramme) => {
    const loc = (iso?: string) => (iso ? versInputLocal(new Date(iso)) : "");
    setAdm({
      patient: p.patient || "", contact: p.contact || "", age: p.age !== undefined ? String(p.age) : "",
      gestite: p.gestite !== undefined ? String(p.gestite) : "", parite: p.parite !== undefined ? String(p.parite) : "",
      ddr: p.ddr || "", admission: loc(p.admission), debutTravail: loc(p.debutTravail), ruptureMembranes: loc(p.ruptureMembranes),
      facteursRisque: p.facteursRisque || "", sageFemmeId: p.sageFemmeId || "",
    });
    setEditPartoId(p.id);
    setShowAdmission(true);
  };

  const handleAdmettre = () => {
    if (!adm.patient.trim()) {
      alert("Veuillez saisir le nom de la parturiente.");
      return;
    }
    if (editPartoId) {
      onUpdatePartogrammes(partogrammes.map((p) => p.id !== editPartoId ? p : nettoyer<Partogramme>({
        ...p,
        patient: adm.patient.trim(), contact: txt(adm.contact), age: num(adm.age), gestite: num(adm.gestite), parite: num(adm.parite),
        ddr: txt(adm.ddr), saAdmission: adm.ddr ? saAuJour(adm.ddr) : p.saAdmission,
        admission: adm.admission ? new Date(adm.admission).toISOString() : p.admission,
        debutTravail: adm.debutTravail ? new Date(adm.debutTravail).toISOString() : undefined,
        ruptureMembranes: adm.ruptureMembranes ? new Date(adm.ruptureMembranes).toISOString() : undefined,
        facteursRisque: txt(adm.facteursRisque), sageFemmeId: adm.sageFemmeId || p.sageFemmeId,
      })));
      setEditPartoId(null);
      setShowAdmission(false);
      setAdm({ patient: "", contact: "", age: "", gestite: "", parite: "", ddr: "", admission: versInputLocal(), debutTravail: "", ruptureMembranes: "", facteursRisque: "", sageFemmeId: "" });
      return;
    }
    if (enCours.some((p) => p.patient.trim().toLowerCase() === adm.patient.trim().toLowerCase())) {
      alert("Cette patiente a déjà un partogramme en cours.");
      return;
    }
    const nouveau: Partogramme = nettoyer<Partogramme>({
      id: generateUid(),
      patient: adm.patient.trim(),
      contact: txt(adm.contact),
      age: num(adm.age),
      gestite: num(adm.gestite),
      parite: num(adm.parite),
      ddr: txt(adm.ddr),
      saAdmission: saAuJour(adm.ddr),
      admission: new Date(adm.admission || Date.now()).toISOString(),
      debutTravail: adm.debutTravail ? new Date(adm.debutTravail).toISOString() : undefined,
      ruptureMembranes: adm.ruptureMembranes ? new Date(adm.ruptureMembranes).toISOString() : undefined,
      facteursRisque: txt(adm.facteursRisque),
      statut: "En cours",
      observations: [],
      sageFemmeId: adm.sageFemmeId || currentUser?.id || undefined,
      createdAt: new Date().toISOString(),
    });
    onUpdatePartogrammes([nouveau, ...partogrammes]);
    setSelectedId(nouveau.id);
    setVueDetail("saisie");
    setShowAdmission(false);
    setAdm({ patient: "", contact: "", age: "", gestite: "", parite: "", ddr: "", admission: versInputLocal(), debutTravail: "", ruptureMembranes: "", facteursRisque: "", sageFemmeId: "" });
  };

  // ================================================================ Observation
  const [obs, setObs] = useState<ObsForm>({ ...OBS_VIDE, dateHeure: versInputLocal() });
  const setO = <K extends keyof ObsForm>(k: K, v: ObsForm[K]) => setObs((o) => ({ ...o, [k]: v }));

  // Aperçu des alertes de l'observation en cours de saisie
  const apercu = useMemo(() => {
    if (!selected) return [];
    const o = formVersObservation(obs);
    const p = { ...selected, observations: [...selected.observations, o] };
    return alertesObservation(o, p);
  }, [obs, selected]);
  const enAlerte = (champ: string) => apercu.some((a) => a.champ === champ || (champ === "col" && a.champ === "progressionCol"));

  const handleAjouterObservation = () => {
    if (!selected) return;
    const o = formVersObservation(obs, currentUser?.nom);
    const rempli = Object.keys(o).filter((k) => !["id", "dateHeure", "createdAt", "agentNom"].includes(k));
    if (rempli.length === 0) {
      alert("Saisissez au moins une valeur (BCF, pouls, col, contractions...).");
      return;
    }
    if (o.col !== undefined && (o.col < 0 || o.col > 10)) {
      alert("La dilatation du col doit être comprise entre 0 et 10 cm.");
      return;
    }
    if (apercu.length > 0 && !o.evaluation && !o.plan) {
      const ok = confirm(
        `⚠ ${apercu.length} valeur(s) en alerte :\n- ${apercu.map((a) => a.message).join("\n- ")}\n\nLe LCG demande d'inscrire une évaluation et un plan (prise de décision partagée). Enregistrer quand même sans plan ?`
      );
      if (!ok) return;
    }
    majPartogramme(selected.id, (p) => ({ ...p, observations: [...p.observations, o] }));
    // On garde les soins de soutien (souvent inchangés) et on vide les mesures.
    setObs((f) => ({
      ...OBS_VIDE,
      dateHeure: versInputLocal(),
      accompagnant: f.accompagnant,
      soulagementDouleur: f.soulagementDouleur,
      hydratationOrale: f.hydratationOrale,
      positionMere: f.positionMere,
      ocytocine: f.ocytocine,
      liquidesIV: f.liquidesIV,
    }));
  };

  const handleSupprimerObservation = (pid: string, oid: string) => {
    if (!confirm("Supprimer cette observation ?")) return;
    majPartogramme(pid, (p) => ({ ...p, observations: p.observations.filter((x) => x.id !== oid) }));
  };

  // ================================================================ Issue / transfert
  const [issue, setIssue] = useState({
    dateHeure: versInputLocal(),
    mode: "Voie basse naturelle" as IssueAccouchement["mode"],
    sexeEnfant: "Féminin" as IssueAccouchement["sexeEnfant"],
    poidsEnfant: "",
    apgar1: "",
    apgar5: "",
    reanimation: false,
    gatpa: true,
    delivranceComplete: true,
    perteSanguineMl: "",
    perinee: "Intact" as NonNullable<IssueAccouchement["perinee"]>,
    etatMere: "Bon état général",
    etatEnfant: "Vivant, cri immédiat",
    notes: "",
  });

  const handleEnregistrerIssue = () => {
    if (!selected) return;
    const poids = num(issue.poidsEnfant);
    if (!poids) {
      alert("Veuillez renseigner le poids du nouveau-né (g).");
      return;
    }
    const iss: IssueAccouchement = nettoyer<IssueAccouchement>({
      dateHeure: new Date(issue.dateHeure || Date.now()).toISOString(),
      mode: issue.mode,
      sexeEnfant: issue.sexeEnfant,
      poidsEnfant: poids,
      apgar1: num(issue.apgar1),
      apgar5: num(issue.apgar5),
      reanimation: issue.reanimation,
      gatpa: issue.gatpa,
      delivranceComplete: issue.delivranceComplete,
      perteSanguineMl: num(issue.perteSanguineMl),
      perinee: issue.perinee,
      etatMere: txt(issue.etatMere),
      etatEnfant: txt(issue.etatEnfant),
      notes: txt(issue.notes),
    });
    const d = new Date(iss.dateHeure);
    const complications = [
      iss.perinee && iss.perinee !== "Intact" ? iss.perinee : "",
      (iss.perteSanguineMl ?? 0) >= 500 ? `Hémorragie (${iss.perteSanguineMl} ml)` : "",
      iss.delivranceComplete === false ? "Délivrance incomplète" : "",
      iss.reanimation ? "Réanimation néonatale" : "",
      iss.notes || "",
    ].filter(Boolean).join(" ; ");
    const acc: Accouchement = {
      id: generateUid(),
      patient: selected.patient,
      date: versInputLocal(d).slice(0, 10),
      heure: versInputLocal(d).slice(11, 16),
      mode: iss.mode === "Césarienne" ? "Césarienne" : "Voie basse naturelle",
      type: iss.mode,
      sexeEnfant: iss.sexeEnfant,
      poidsEnfant: poids,
      etatEnfant: `${iss.etatEnfant || ""}${iss.apgar1 !== undefined ? ` — Apgar ${iss.apgar1}/${iss.apgar5 ?? "?"}` : ""}`.trim(),
      complications,
      sageFemmeId: selected.sageFemmeId || currentUser?.id || "",
      createdAt: new Date().toISOString(),
    };
    onUpdateAccouchements([acc, ...accouchements]);
    majPartogramme(selected.id, (p) => ({
      ...p,
      statut: iss.mode === "Césarienne" ? "Césarienne" : "Accouchée",
      issue: iss,
      accouchementId: acc.id,
    }));
    setVueDetail("postpartum");
    if (onEtablirDeclaration && confirm("Accouchement enregistré et inscrit au registre de la maternité. Démarrez la surveillance du post-partum (toutes les 15 min pendant 2 h).\n\nÉtablir maintenant la déclaration de naissance ?")) {
      onEtablirDeclaration(acc.id);
    } else if (!onEtablirDeclaration) {
      alert("Accouchement enregistré et inscrit au registre de la maternité. Démarrez la surveillance du post-partum (toutes les 15 min pendant 2 h).");
    }
  };

  const handleTransfert = () => {
    if (!selected) return;
    const motif = prompt("Motif du transfert / de la référence (structure, raison) :");
    if (!motif) return;
    majPartogramme(selected.id, (p) => ({ ...p, statut: "Transférée / Référée", motifTransfert: motif }));
  };

  const handleSupprimerPartogramme = (id: string) => {
    if (!confirm("Supprimer définitivement ce partogramme ?")) return;
    onUpdatePartogrammes(partogrammes.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleRouvrir = (id: string) => {
    if (!confirm("Remettre ce partogramme « En cours » ?")) return;
    majPartogramme(id, (p) => ({ ...p, statut: "En cours" }));
  };

  // ================================================================ Post-partum
  const [pp, setPp] = useState({ dateHeure: versInputLocal(), pouls: "", taSys: "", taDia: "", temperature: "", globeSecurite: true, saignement: "Normal" as NonNullable<SurveillancePostPartum["saignement"]>, notes: "" });
  const handleAjouterPP = () => {
    if (!selected) return;
    const s: SurveillancePostPartum = nettoyer<SurveillancePostPartum>({
      id: generateUid(),
      dateHeure: new Date(pp.dateHeure || Date.now()).toISOString(),
      pouls: num(pp.pouls),
      taSys: num(pp.taSys),
      taDia: num(pp.taDia),
      temperature: num(pp.temperature),
      globeSecurite: pp.globeSecurite,
      saignement: pp.saignement,
      notes: txt(pp.notes),
      agentNom: currentUser?.nom || undefined,
    });
    majPartogramme(selected.id, (p) => ({ ...p, postPartum: [...(p.postPartum || []), s] }));
    setPp({ dateHeure: versInputLocal(), pouls: "", taSys: "", taDia: "", temperature: "", globeSecurite: true, saignement: "Normal", notes: "" });
  };
  const ppAlerte = (s: SurveillancePostPartum): string[] => {
    const a: string[] = [];
    if (s.pouls !== undefined && (s.pouls < 60 || s.pouls >= 100)) a.push(`Pouls ${s.pouls}`);
    if (s.taSys !== undefined && (s.taSys < 90 || s.taSys >= 140)) a.push(`TAS ${s.taSys}`);
    if (s.taDia !== undefined && s.taDia >= 90) a.push(`TAD ${s.taDia}`);
    if (s.temperature !== undefined && s.temperature >= 38) a.push(`T° ${s.temperature}`);
    if (s.globeSecurite === false) a.push("Pas de globe de sécurité");
    if (s.saignement && s.saignement !== "Normal") a.push(`Saignement ${s.saignement.toLowerCase()}`);
    return a;
  };

  const nomAgent = (id?: string) => staff.find((s) => s.id === id)?.nom || "—";

  // ================================================================ Rendu
  const alertesSel = selected ? alertesEnCours(selected, maintenant) : [];
  const controlesSel = selected ? prochainsControles(selected, maintenant) : [];
  const dPA = selected ? debutPhaseActive(selected) : undefined;
  const d2 = selected ? debutDeuxiemePhase(selected) : undefined;

  return (
    <div className="space-y-5">
      {/* Bandeau : parturientes en cours */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-pink-600" /> Salle d'accouchement — Guide de soins du travail (LCG OMS 2020)
          </h3>
          <button
            type="button"
            onClick={() => {
              if (editPartoId) {
                setEditPartoId(null);
                setAdm({ patient: "", contact: "", age: "", gestite: "", parite: "", ddr: "", admission: versInputLocal(), debutTravail: "", ruptureMembranes: "", facteursRisque: "", sageFemmeId: "" });
              }
              setShowAdmission(true);
            }}
            className="px-4 py-2 text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" /> Admettre une parturiente
          </button>
        </div>

        {enCours.length === 0 ? (
          <p className="text-xs text-stone-500 italic py-3 text-center">Aucune parturiente en travail actuellement.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {enCours.map((p) => {
              const al = alertesEnCours(p, maintenant);
              const retards = prochainsControles(p, maintenant).filter((c) => c.enRetard);
              const col = dernierCol(p);
              const actif = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setSelectedId(p.id); setVueDetail("saisie"); }}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    actif ? "border-pink-500 ring-2 ring-pink-200 bg-pink-50" : al.length ? "border-danger-300 bg-danger-50/50" : "border-stone-200 hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-800 text-sm truncate">{p.patient}</span>
                    <span className="text-xs font-mono font-bold text-pink-700">{col !== undefined ? `${col} cm` : "— cm"}</span>
                  </div>
                  <div className="text-2xs text-stone-500 mt-0.5">
                    G{p.gestite ?? "?"}P{p.parite ?? "?"} · admise à {heureCourte(p.admission)} · {p.observations.length} obs.
                    {debutDeuxiemePhase(p) ? " · 2e phase" : debutPhaseActive(p) ? " · phase active" : " · phase latente"}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {al.length > 0 && (
                      <span className="text-2xs font-bold bg-danger-600 text-white rounded px-1.5 py-0.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {al.length} alerte(s)
                      </span>
                    )}
                    {retards.length > 0 && (
                      <span className="text-2xs font-bold bg-warning-100 text-warning-800 border border-warning-300 rounded px-1.5 py-0.5 flex items-center gap-1">
                        <Bell className="w-3 h-3" /> À contrôler : {retards.map((r) => r.label).join(", ")}
                      </span>
                    )}
                    {al.length === 0 && retards.length === 0 && (
                      <span className="text-2xs font-bold bg-success-100 text-success-800 rounded px-1.5 py-0.5 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> RAS
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Dossier de la parturiente sélectionnée */}
      {selected && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-lg font-serif font-bold text-stone-900">{selected.patient}</h3>
              <div className="text-xs text-stone-500 mt-0.5">
                {selected.age ? `${selected.age} ans · ` : ""}G{selected.gestite ?? "?"} P{selected.parite ?? "?"}
                {selected.saAdmission !== undefined ? ` · ${selected.saAdmission} SA` : ""} · {selected.contact || "sans contact"} · Sage-femme : {nomAgent(selected.sageFemmeId)}
              </div>
              <div className="text-xs text-stone-600 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                <span>Admission : <b>{dateHeureCourte(selected.admission)}</b></span>
                {selected.debutTravail && <span>Début travail : <b>{dateHeureCourte(selected.debutTravail)}</b></span>}
                {selected.ruptureMembranes && (
                  <span>
                    Rupture membranes : <b>{dateHeureCourte(selected.ruptureMembranes)}</b>
                    {selected.statut === "En cours" && ` (${formatDuree((maintenant.getTime() - new Date(selected.ruptureMembranes).getTime()) / 3600000)})`}
                  </span>
                )}
                <span>Phase active (≥ 5 cm) : <b>{dPA ? dateHeureCourte(dPA) : "non atteinte"}</b></span>
                {d2 && <span>2e phase : <b>{dateHeureCourte(d2)}</b></span>}
              </div>
              {selected.facteursRisque && (
                <div className="text-xs text-warning-800 bg-warning-50 border border-warning-200 rounded-lg px-2 py-1 mt-2 inline-block">
                  Facteurs de risque : {selected.facteursRisque}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  selected.statut === "En cours" ? "bg-pink-100 text-pink-800" : selected.statut === "Transférée / Référée" ? "bg-warning-100 text-warning-800" : "bg-success-100 text-success-800"
                }`}
              >
                {selected.statut}
              </span>
              <button type="button" onClick={() => window.print()} className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50" title="Imprimer">
                <Printer className="w-4 h-4 text-stone-600" />
              </button>
              {selected.statut === "En cours" ? (
                <button type="button" onClick={handleTransfert} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-warning-300 text-warning-800 hover:bg-warning-50 flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" /> Transférer / Référer
                </button>
              ) : (
                <button type="button" onClick={() => handleRouvrir(selected.id)} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50">
                  Remettre en cours
                </button>
              )}
              <button type="button" onClick={() => ouvrirCorrectionAdmission(selected)} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-50">
                Corriger l'admission
              </button>
              <button type="button" onClick={() => handleSupprimerPartogramme(selected.id)} className="p-2 rounded-lg text-stone-400 hover:text-danger-600" title="Supprimer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {selected.motifTransfert && (
            <div className="text-xs bg-warning-50 border border-warning-200 text-warning-900 rounded-lg p-2">Transfert / référence : {selected.motifTransfert}</div>
          )}

          {/* Alertes + rappels */}
          {selected.statut === "En cours" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className={`rounded-xl border p-3 ${alertesSel.length ? "bg-danger-50 border-danger-300" : "bg-success-50 border-success-200"}`}>
                <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1 ${alertesSel.length ? "text-danger-800" : "text-success-800"}`}>
                  {alertesSel.length ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {alertesSel.length ? `Alertes LCG (${alertesSel.length})` : "Aucune alerte sur la dernière observation"}
                </div>
                {alertesSel.length > 0 && (
                  <>
                    <ul className="text-xs text-danger-800 space-y-0.5 list-disc pl-5">
                      {alertesSel.map((a, i) => (
                        <li key={i}><b>{a.section} :</b> {a.message}</li>
                      ))}
                    </ul>
                    <p className="text-2xs text-danger-700 mt-1.5">Évaluez la situation et inscrivez un plan dans la prochaine observation (prise de décision partagée).</p>
                  </>
                )}
              </div>
              <div className="rounded-xl border border-stone-200 p-3">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-4 h-4" /> Prochains contrôles
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {controlesSel.map((c) => (
                    <span
                      key={c.label}
                      title={`Toutes les ${c.intervalleMin >= 60 ? formatDuree(c.intervalleMin / 60) : c.intervalleMin + " min"} — dernier : ${heureCourte(c.dernier)}`}
                      className={`text-2xs font-bold rounded-lg px-2 py-1 border ${c.enRetard ? "bg-warning-100 border-warning-400 text-warning-900" : "bg-stone-50 border-stone-200 text-stone-700"}`}
                    >
                      {c.enRetard ? "⏰ " : ""}
                      {c.label} : {c.enRetard ? `en retard (prévu ${heureCourte(c.echeance.toISOString())})` : heureCourte(c.echeance.toISOString())}
                    </span>
                  ))}
                </div>
                <p className="text-2xs text-stone-500 mt-1.5">
                  BCF toutes les 30 min (5 min en 2e phase) · pouls et contractions toutes les 30 min · TA, température et toucher vaginal toutes les 4 h.
                </p>
              </div>
            </div>
          )}

          {/* Courbes */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="border border-stone-200 rounded-xl p-3">
              <div className="text-xs font-bold text-stone-700 mb-1">
                Dilatation du col (cm) — heures depuis 5 cm
                <span className="font-normal text-stone-500"> · seuils : 5 cm ≥ 6 h, 6 cm ≥ 5 h, 7 cm ≥ 3 h, 8 cm ≥ 2 h 30, 9 cm ≥ 2 h</span>
              </div>
              <CourbeCol p={selected} maintenant={maintenant} />
            </div>
            <div className="border border-stone-200 rounded-xl p-3">
              <div className="text-xs font-bold text-stone-700 mb-1">
                Bruits du cœur fœtal (/min) <span className="font-normal text-stone-500">· zone normale 110–159</span>
              </div>
              <CourbeBCF p={selected} />
            </div>
          </div>

          {/* Onglets du dossier */}
          <div className="flex flex-wrap gap-1 border-b border-stone-200">
            {(
              [
                ["saisie", "Nouvelle observation", selected.statut === "En cours"],
                ["grille", `Grille LCG (${selected.observations.length})`, true],
                ["issue", "Issue de l'accouchement", true],
                ["postpartum", `Post-partum (${selected.postPartum?.length || 0})`, selected.statut !== "En cours" && selected.statut !== "Transférée / Référée"],
              ] as [typeof vueDetail, string, boolean][]
            )
              .filter(([, , visible]) => visible)
              .map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVueDetail(id)}
                  className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px ${vueDetail === id ? "border-pink-600 text-pink-700" : "border-transparent text-stone-500 hover:text-stone-800"}`}
                >
                  {label}
                </button>
              ))}
          </div>

          {/* --- Saisie d'une observation --- */}
          {vueDetail === "saisie" && selected.statut === "En cours" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Champ label="Date et heure">
                  <input type="datetime-local" value={obs.dateHeure} onChange={(e) => setO("dateHeure", e.target.value)} className={inputCls} />
                </Champ>
                <div className="flex items-end">
                  <button type="button" onClick={() => setO("dateHeure", versInputLocal())} className="text-2xs font-bold text-pink-700 underline">
                    Mettre l'heure actuelle
                  </button>
                </div>
              </div>

              <fieldset className="border border-stone-200 rounded-xl p-3">
                <legend className="text-xs font-bold uppercase tracking-wider text-primary-700 px-1">1. Soins de soutien</legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Champ label="Accompagnant" alerte={enAlerte("accompagnant")}><Choix value={obs.accompagnant} onChange={(v) => setO("accompagnant", v)} options={OUI_NON} alerte={enAlerte("accompagnant")} /></Champ>
                  <Champ label="Soulagement douleur" alerte={enAlerte("soulagementDouleur")}><Choix value={obs.soulagementDouleur} onChange={(v) => setO("soulagementDouleur", v)} options={OUI_NON} alerte={enAlerte("soulagementDouleur")} /></Champ>
                  <Champ label="Hydratation orale" alerte={enAlerte("hydratationOrale")}><Choix value={obs.hydratationOrale} onChange={(v) => setO("hydratationOrale", v)} options={OUI_NON} alerte={enAlerte("hydratationOrale")} /></Champ>
                  <Champ label="Position" alerte={enAlerte("positionMere")}>
                    <Choix value={obs.positionMere} onChange={(v) => setO("positionMere", v)} options={[{ v: "MO", l: "Mobile / autre (MO)" }, { v: "SP", l: "Décubitus dorsal (SP)" }]} alerte={enAlerte("positionMere")} />
                  </Champ>
                </div>
              </fieldset>

              <fieldset className="border border-stone-200 rounded-xl p-3">
                <legend className="text-xs font-bold uppercase tracking-wider text-primary-700 px-1">2. Bébé</legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Champ label="BCF de base (/min)" alerte={enAlerte("bcf")}>
                    <input type="number" inputMode="numeric" placeholder="110–159" value={obs.bcf} onChange={(e) => setO("bcf", e.target.value)} className={`${inputCls} ${enAlerte("bcf") ? "!border-danger-400 !bg-danger-50 font-bold" : ""}`} />
                  </Champ>
                  <Champ label="Décélérations" alerte={enAlerte("decelerations")}>
                    <Choix value={obs.decelerations} onChange={(v) => setO("decelerations", v)} options={[{ v: "N", l: "Aucune (N)" }, { v: "P", l: "Précoces (P)" }, { v: "T", l: "Tardives (T)" }, { v: "V", l: "Variables (V)" }]} alerte={enAlerte("decelerations")} />
                  </Champ>
                  <Champ label="Liquide amniotique" alerte={enAlerte("liquideAmniotique")}>
                    <Choix
                      value={obs.liquideAmniotique}
                      onChange={(v) => setO("liquideAmniotique", v)}
                      options={[{ v: "I", l: "Membranes intactes (I)" }, { v: "C", l: "Clair (C)" }, { v: "M+", l: "Méconial M+" }, { v: "M++", l: "Méconial M++" }, { v: "M+++", l: "Méconial épais M+++" }, { v: "S", l: "Sanglant (S)" }]}
                      alerte={enAlerte("liquideAmniotique")}
                    />
                  </Champ>
                  <Champ label="Position fœtale" alerte={enAlerte("positionFoetale")}>
                    <Choix value={obs.positionFoetale} onChange={(v) => setO("positionFoetale", v)} options={[{ v: "OA", l: "Occipito-antérieure (OA)" }, { v: "OP", l: "Occipito-postérieure (OP)" }, { v: "OT", l: "Occipito-transverse (OT)" }]} alerte={enAlerte("positionFoetale")} />
                  </Champ>
                  <Champ label="Bosse séro-sanguine" alerte={enAlerte("bosse")}><Choix value={obs.bosse} onChange={(v) => setO("bosse", v)} options={CROIX} alerte={enAlerte("bosse")} /></Champ>
                  <Champ label="Modelage" alerte={enAlerte("modelage")}><Choix value={obs.modelage} onChange={(v) => setO("modelage", v)} options={CROIX} alerte={enAlerte("modelage")} /></Champ>
                </div>
              </fieldset>

              <fieldset className="border border-stone-200 rounded-xl p-3">
                <legend className="text-xs font-bold uppercase tracking-wider text-primary-700 px-1">3. Femme</legend>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Champ label="Pouls (/min)" alerte={enAlerte("pouls")}>
                    <input type="number" inputMode="numeric" value={obs.pouls} onChange={(e) => setO("pouls", e.target.value)} className={`${inputCls} ${enAlerte("pouls") ? "!border-danger-400 !bg-danger-50 font-bold" : ""}`} />
                  </Champ>
                  <Champ label="TA systolique (mmHg)" alerte={enAlerte("taSys")}>
                    <input type="number" inputMode="numeric" placeholder="ex. 120" value={obs.taSys} onChange={(e) => setO("taSys", e.target.value)} className={`${inputCls} ${enAlerte("taSys") ? "!border-danger-400 !bg-danger-50 font-bold" : ""}`} />
                  </Champ>
                  <Champ label="TA diastolique (mmHg)" alerte={enAlerte("taDia")}>
                    <input type="number" inputMode="numeric" placeholder="ex. 80" value={obs.taDia} onChange={(e) => setO("taDia", e.target.value)} className={`${inputCls} ${enAlerte("taDia") ? "!border-danger-400 !bg-danger-50 font-bold" : ""}`} />
                  </Champ>
                  <Champ label="Température (°C)" alerte={enAlerte("temperature")}>
                    <input type="number" step="0.1" inputMode="decimal" value={obs.temperature} onChange={(e) => setO("temperature", e.target.value)} className={`${inputCls} ${enAlerte("temperature") ? "!border-danger-400 !bg-danger-50 font-bold" : ""}`} />
                  </Champ>
                  <Champ label="Urine : protéines" alerte={enAlerte("urineProteines")}><Choix value={obs.urineProteines} onChange={(v) => setO("urineProteines", v)} options={CROIX} alerte={enAlerte("urineProteines")} /></Champ>
                  <Champ label="Urine : acétone" alerte={enAlerte("urineAcetone")}><Choix value={obs.urineAcetone} onChange={(v) => setO("urineAcetone", v)} options={CROIX} alerte={enAlerte("urineAcetone")} /></Champ>
                </div>
              </fieldset>

              <fieldset className="border border-stone-200 rounded-xl p-3">
                <legend className="text-xs font-bold uppercase tracking-wider text-primary-700 px-1">4. Progression du travail</legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Champ label="Contractions / 10 min" alerte={enAlerte("contractionsPar10min")}>
                    <input type="number" inputMode="numeric" placeholder="3–5" value={obs.contractionsPar10min} onChange={(e) => setO("contractionsPar10min", e.target.value)} className={`${inputCls} ${enAlerte("contractionsPar10min") ? "!border-danger-400 !bg-danger-50 font-bold" : ""}`} />
                  </Champ>
                  <Champ label="Durée contractions (s)" alerte={enAlerte("dureeContractions")}>
                    <input type="number" inputMode="numeric" placeholder="20–60" value={obs.dureeContractions} onChange={(e) => setO("dureeContractions", e.target.value)} className={`${inputCls} ${enAlerte("dureeContractions") ? "!border-danger-400 !bg-danger-50 font-bold" : ""}`} />
                  </Champ>
                  <Champ label="Col — dilatation (cm)" alerte={enAlerte("col")}>
                    <input type="number" inputMode="numeric" min={0} max={10} placeholder="0–10" value={obs.col} onChange={(e) => setO("col", e.target.value)} className={`${inputCls} ${enAlerte("col") ? "!border-danger-400 !bg-danger-50 font-bold" : ""}`} />
                  </Champ>
                  <Champ label="Descente (cinquièmes, 5→0)">
                    <select value={obs.descente} onChange={(e) => setO("descente", e.target.value)} className={inputCls}>
                      <option value="">—</option>
                      {[5, 4, 3, 2, 1, 0].map((d) => (
                        <option key={d} value={d}>{d}/5</option>
                      ))}
                    </select>
                  </Champ>
                </div>
              </fieldset>

              <fieldset className="border border-stone-200 rounded-xl p-3">
                <legend className="text-xs font-bold uppercase tracking-wider text-primary-700 px-1">5. Médicaments</legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Champ label="Ocytocine (UI/L, gouttes/min)"><input type="text" placeholder="ex. 5 UI/L — 10 gttes/min" value={obs.ocytocine} onChange={(e) => setO("ocytocine", e.target.value)} className={inputCls} /></Champ>
                  <Champ label="Médicaments"><input type="text" placeholder="ex. Paracétamol 1 g IV" value={obs.medicaments} onChange={(e) => setO("medicaments", e.target.value)} className={inputCls} /></Champ>
                  <Champ label="Liquides IV"><input type="text" placeholder="ex. Ringer lactate 500 ml" value={obs.liquidesIV} onChange={(e) => setO("liquidesIV", e.target.value)} className={inputCls} /></Champ>
                </div>
              </fieldset>

              <fieldset className={`border rounded-xl p-3 ${apercu.length ? "border-danger-300 bg-danger-50/40" : "border-stone-200"}`}>
                <legend className={`text-xs font-bold uppercase tracking-wider px-1 ${apercu.length ? "text-danger-800" : "text-primary-700"}`}>6. Prise de décision partagée</legend>
                {apercu.length > 0 && (
                  <div className="text-xs text-danger-800 mb-2">
                    <b>⚠ Valeurs en alerte :</b> {apercu.map((a) => a.message).join(" · ")}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Champ label="Évaluation"><textarea value={obs.evaluation} onChange={(e) => setO("evaluation", e.target.value)} placeholder="Ce que vous constatez, cause probable..." className={`${inputCls} h-16 resize-none`} /></Champ>
                  <Champ label="Plan"><textarea value={obs.plan} onChange={(e) => setO("plan", e.target.value)} placeholder="Conduite à tenir convenue avec la femme..." className={`${inputCls} h-16 resize-none`} /></Champ>
                </div>
              </fieldset>

              <button type="button" onClick={handleAjouterObservation} className="w-full text-sm font-bold py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Enregistrer l'observation
              </button>
            </div>
          )}

          {/* --- Grille LCG --- */}
          {vueDetail === "grille" && (
            <div className="space-y-3">
              <GrilleLCG p={selected} />
              {selected.observations.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer font-bold text-stone-600">Corriger / supprimer une observation</summary>
                  <div className="mt-2 space-y-1">
                    {trierObservations(selected.observations).map((o) => (
                      <div key={o.id} className="flex items-center justify-between border border-stone-100 rounded-lg px-2 py-1">
                        <span>
                          <b>{dateHeureCourte(o.dateHeure)}</b> — {o.agentNom || "agent ?"}
                          {o.col !== undefined ? ` · col ${o.col} cm` : ""}
                          {o.bcf !== undefined ? ` · BCF ${o.bcf}` : ""}
                        </span>
                        <button type="button" onClick={() => handleSupprimerObservation(selected.id, o.id)} className="text-stone-400 hover:text-danger-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {/* --- Issue --- */}
          {vueDetail === "issue" &&
            (selected.issue ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  ["Date / heure", dateHeureCourte(selected.issue.dateHeure)],
                  ["Mode", selected.issue.mode],
                  ["Sexe", selected.issue.sexeEnfant],
                  ["Poids", `${selected.issue.poidsEnfant} g`],
                  ["Apgar 1 / 5 min", `${selected.issue.apgar1 ?? "—"} / ${selected.issue.apgar5 ?? "—"}`],
                  ["Réanimation", selected.issue.reanimation ? "Oui" : "Non"],
                  ["GATPA", selected.issue.gatpa ? "Oui" : "Non"],
                  ["Délivrance complète", selected.issue.delivranceComplete === false ? "Non" : "Oui"],
                  ["Pertes sanguines", selected.issue.perteSanguineMl !== undefined ? `${selected.issue.perteSanguineMl} ml` : "—"],
                  ["Périnée", selected.issue.perinee || "—"],
                  ["État de la mère", selected.issue.etatMere || "—"],
                  ["État de l'enfant", selected.issue.etatEnfant || "—"],
                ].map(([l, v]) => (
                  <div key={l} className="border border-stone-200 rounded-lg p-2">
                    <div className="text-2xs uppercase font-semibold text-stone-500">{l}</div>
                    <div className="font-bold text-stone-800">{v}</div>
                  </div>
                ))}
                {selected.issue.notes && <div className="col-span-full text-stone-600 italic">{selected.issue.notes}</div>}
                <div className="col-span-full text-2xs text-success-700 font-semibold">✓ Inscrit au registre d'accouchement de la maternité.</div>
                {onEtablirDeclaration && selected.accouchementId && (() => {
                  const acc = accouchements.find((a) => a.id === selected.accouchementId);
                  if (!acc) return null;
                  return (
                    <div className="col-span-full">
                      <button type="button" onClick={() => onEtablirDeclaration(acc.id)} className="px-3 py-2 rounded-lg text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white">
                        {acc.declarationNaissance ? `Déclaration de naissance ${acc.declarationNaissance.numero} — voir / imprimer` : "Établir la déclaration de naissance"}
                      </button>
                    </div>
                  );
                })()}
              </div>
            ) : selected.statut === "En cours" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Champ label="Date / heure de naissance"><input type="datetime-local" value={issue.dateHeure} onChange={(e) => setIssue({ ...issue, dateHeure: e.target.value })} className={inputCls} /></Champ>
                  <Champ label="Mode">
                    <select value={issue.mode} onChange={(e) => setIssue({ ...issue, mode: e.target.value as any })} className={inputCls}>
                      <option>Voie basse naturelle</option>
                      <option>Voie basse instrumentale</option>
                      <option>Césarienne</option>
                    </select>
                  </Champ>
                  <Champ label="Sexe">
                    <select value={issue.sexeEnfant} onChange={(e) => setIssue({ ...issue, sexeEnfant: e.target.value as any })} className={inputCls}>
                      <option value="Féminin">Fille</option>
                      <option value="Masculin">Garçon</option>
                    </select>
                  </Champ>
                  <Champ label="Poids (g) *"><input type="number" inputMode="numeric" placeholder="ex. 3200" value={issue.poidsEnfant} onChange={(e) => setIssue({ ...issue, poidsEnfant: e.target.value })} className={inputCls} /></Champ>
                  <Champ label="Apgar 1 min"><input type="number" min={0} max={10} value={issue.apgar1} onChange={(e) => setIssue({ ...issue, apgar1: e.target.value })} className={inputCls} /></Champ>
                  <Champ label="Apgar 5 min"><input type="number" min={0} max={10} value={issue.apgar5} onChange={(e) => setIssue({ ...issue, apgar5: e.target.value })} className={inputCls} /></Champ>
                  <Champ label="Pertes sanguines (ml)"><input type="number" inputMode="numeric" value={issue.perteSanguineMl} onChange={(e) => setIssue({ ...issue, perteSanguineMl: e.target.value })} className={inputCls} /></Champ>
                  <Champ label="Périnée">
                    <select value={issue.perinee} onChange={(e) => setIssue({ ...issue, perinee: e.target.value as any })} className={inputCls}>
                      {["Intact", "Déchirure 1er degré", "Déchirure 2e degré", "Déchirure 3e/4e degré", "Épisiotomie"].map((x) => <option key={x}>{x}</option>)}
                    </select>
                  </Champ>
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-semibold text-stone-700">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={issue.gatpa} onChange={(e) => setIssue({ ...issue, gatpa: e.target.checked })} /> GATPA réalisée</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={issue.delivranceComplete} onChange={(e) => setIssue({ ...issue, delivranceComplete: e.target.checked })} /> Délivrance complète</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={issue.reanimation} onChange={(e) => setIssue({ ...issue, reanimation: e.target.checked })} /> Réanimation néonatale</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Champ label="État de la mère"><input type="text" value={issue.etatMere} onChange={(e) => setIssue({ ...issue, etatMere: e.target.value })} className={inputCls} /></Champ>
                  <Champ label="État de l'enfant"><input type="text" value={issue.etatEnfant} onChange={(e) => setIssue({ ...issue, etatEnfant: e.target.value })} className={inputCls} /></Champ>
                  <Champ label="Observations"><input type="text" value={issue.notes} onChange={(e) => setIssue({ ...issue, notes: e.target.value })} className={inputCls} /></Champ>
                </div>
                {(num(issue.perteSanguineMl) ?? 0) >= 500 && (
                  <div className="text-xs font-bold text-danger-700 bg-danger-50 border border-danger-200 rounded-lg p-2">🚨 Pertes ≥ 500 ml : hémorragie du post-partum — appliquez le protocole HPP.</div>
                )}
                <button type="button" onClick={handleEnregistrerIssue} className="w-full text-sm font-bold py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center justify-center gap-2">
                  <Baby className="w-4 h-4" /> Enregistrer la naissance (et l'inscrire au registre)
                </button>
              </div>
            ) : (
              <p className="text-xs text-stone-500 italic">Pas d'accouchement enregistré pour ce partogramme ({selected.statut}).</p>
            ))}

          {/* --- Post-partum --- */}
          {vueDetail === "postpartum" && (
            <div className="space-y-3">
              <p className="text-2xs text-stone-500">Surveillance toutes les 15 min pendant les 2 premières heures, puis toutes les 30 min la 3e heure : pouls, TA, globe de sécurité, saignements.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
                <Champ label="Date / heure"><input type="datetime-local" value={pp.dateHeure} onChange={(e) => setPp({ ...pp, dateHeure: e.target.value })} className={inputCls} /></Champ>
                <Champ label="Pouls"><input type="number" value={pp.pouls} onChange={(e) => setPp({ ...pp, pouls: e.target.value })} className={inputCls} /></Champ>
                <Champ label="TA sys."><input type="number" value={pp.taSys} onChange={(e) => setPp({ ...pp, taSys: e.target.value })} className={inputCls} /></Champ>
                <Champ label="TA dia."><input type="number" value={pp.taDia} onChange={(e) => setPp({ ...pp, taDia: e.target.value })} className={inputCls} /></Champ>
                <Champ label="T° (°C)"><input type="number" step="0.1" value={pp.temperature} onChange={(e) => setPp({ ...pp, temperature: e.target.value })} className={inputCls} /></Champ>
                <Champ label="Saignement">
                  <select value={pp.saignement} onChange={(e) => setPp({ ...pp, saignement: e.target.value as any })} className={inputCls}>
                    <option>Normal</option>
                    <option>Abondant</option>
                    <option>Hémorragie</option>
                  </select>
                </Champ>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 pb-2">
                  <input type="checkbox" checked={pp.globeSecurite} onChange={(e) => setPp({ ...pp, globeSecurite: e.target.checked })} /> Globe de sécurité
                </label>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder="Notes (ex. mise au sein, massage utérin...)" value={pp.notes} onChange={(e) => setPp({ ...pp, notes: e.target.value })} className={inputCls} />
                <button type="button" onClick={handleAjouterPP} className="shrink-0 px-4 text-xs font-bold bg-pink-600 hover:bg-pink-700 text-white rounded-lg flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
              </div>
              {(selected.postPartum || []).length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-50 text-stone-600 uppercase text-2xs">
                        <th className="p-2 text-left">Heure</th><th className="p-2">Pouls</th><th className="p-2">TA</th><th className="p-2">T°</th><th className="p-2">Globe</th><th className="p-2">Saignement</th><th className="p-2 text-left">Alertes / notes</th><th className="p-2 text-left">Agent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {[...(selected.postPartum || [])].sort((a, b) => a.dateHeure.localeCompare(b.dateHeure)).map((s) => {
                        const al = ppAlerte(s);
                        return (
                          <tr key={s.id} className={al.length ? "bg-danger-50" : ""}>
                            <td className="p-2 font-mono">{dateHeureCourte(s.dateHeure)}</td>
                            <td className="p-2 text-center">{s.pouls ?? "—"}</td>
                            <td className="p-2 text-center">{s.taSys ?? "—"}/{s.taDia ?? "—"}</td>
                            <td className="p-2 text-center">{s.temperature ?? "—"}</td>
                            <td className="p-2 text-center">{s.globeSecurite ? "Oui" : "Non"}</td>
                            <td className="p-2 text-center">{s.saignement}</td>
                            <td className="p-2">{al.length ? <b className="text-danger-700">⚠ {al.join(", ")}</b> : ""} {s.notes}</td>
                            <td className="p-2">{s.agentNom || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Historique */}
      {termines.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
          <h3 className="text-sm font-serif font-bold text-stone-900 mb-3 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-stone-600" /> Partogrammes terminés ({termines.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 uppercase text-2xs text-left">
                  <th className="p-2">Patiente</th><th className="p-2">Admission</th><th className="p-2">Issue</th><th className="p-2">Statut</th><th className="p-2">Obs.</th><th className="p-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {termines.map((p) => (
                  <tr key={p.id} className={p.id === selectedId ? "bg-pink-50" : ""}>
                    <td className="p-2 font-bold">{p.patient}</td>
                    <td className="p-2 font-mono">{dateHeureCourte(p.admission)}</td>
                    <td className="p-2">{p.issue ? `${dateHeureCourte(p.issue.dateHeure)} · ${p.issue.mode} · ${p.issue.poidsEnfant} g` : p.motifTransfert || "—"}</td>
                    <td className="p-2">{p.statut}</td>
                    <td className="p-2">{p.observations.length}</td>
                    <td className="p-2 text-right">
                      <button type="button" onClick={() => { setSelectedId(p.id); setVueDetail("grille"); }} className="text-pink-700 font-bold hover:underline flex items-center gap-1 ml-auto">
                        <Activity className="w-3.5 h-3.5" /> Ouvrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fenêtre d'admission */}
      {showAdmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-stone-200 max-h-[92vh] overflow-y-auto">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-serif font-bold text-base flex items-center gap-2"><UserPlus className="w-5 h-5 text-pink-600" /> {editPartoId ? "Corriger l'admission" : "Admission en salle d'accouchement"}</h3>
              <button type="button" onClick={() => { setShowAdmission(false); setEditPartoId(null); }} className="p-1.5 rounded-lg hover:bg-stone-100"><X className="w-5 h-5 text-stone-500" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Champ label="Nom de la parturiente *">
                    <input
                      type="text"
                      list="liste-patientes-cpn"
                      value={adm.patient}
                      onChange={(e) => { setAdm({ ...adm, patient: e.target.value }); remplirDepuisCpn(e.target.value); }}
                      placeholder="Tapez le nom (les patientes suivies en CPN sont proposées)"
                      className={inputCls}
                    />
                    <datalist id="liste-patientes-cpn">
                      {[...patientesCpn.values()].map((c) => <option key={c.id} value={c.patient} />)}
                    </datalist>
                  </Champ>
                  {patientesCpn.has(adm.patient.trim().toLowerCase()) && (
                    <p className="text-2xs text-success-700 font-semibold mt-0.5">✓ Dossier CPN trouvé : gestité, parité, DDR et facteurs de risque repris.</p>
                  )}
                </div>
                <Champ label="Téléphone"><input type="tel" value={adm.contact} onChange={(e) => setAdm({ ...adm, contact: e.target.value })} className={inputCls} /></Champ>
                <Champ label="Âge"><input type="number" value={adm.age} onChange={(e) => setAdm({ ...adm, age: e.target.value })} className={inputCls} /></Champ>
                <Champ label="Gestité (G)"><input type="number" value={adm.gestite} onChange={(e) => setAdm({ ...adm, gestite: e.target.value })} className={inputCls} /></Champ>
                <Champ label="Parité (P)"><input type="number" value={adm.parite} onChange={(e) => setAdm({ ...adm, parite: e.target.value })} className={inputCls} /></Champ>
                <Champ label="DDR"><input type="date" value={adm.ddr} onChange={(e) => setAdm({ ...adm, ddr: e.target.value })} className={inputCls} /></Champ>
                <div className="flex items-end text-xs text-stone-600 pb-2">{adm.ddr ? <span>Terme : <b>{saAuJour(adm.ddr)} SA</b></span> : null}</div>
                <Champ label="Sage-femme responsable">
                  <select value={adm.sageFemmeId} onChange={(e) => setAdm({ ...adm, sageFemmeId: e.target.value })} className={inputCls}>
                    <option value="">{currentUser ? `${currentUser.nom} (moi)` : "— Sélectionner —"}</option>
                    {staff.filter((s) => s.poste === "Sage-femme" || s.poste === "Médecin" || s.poste === "Infirmier").map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </Champ>
                <Champ label="Admission (date / heure)"><input type="datetime-local" value={adm.admission} onChange={(e) => setAdm({ ...adm, admission: e.target.value })} className={inputCls} /></Champ>
                <Champ label="Début du travail"><input type="datetime-local" value={adm.debutTravail} onChange={(e) => setAdm({ ...adm, debutTravail: e.target.value })} className={inputCls} /></Champ>
                <Champ label="Rupture des membranes"><input type="datetime-local" value={adm.ruptureMembranes} onChange={(e) => setAdm({ ...adm, ruptureMembranes: e.target.value })} className={inputCls} /></Champ>
              </div>
              <Champ label="Facteurs de risque">
                <textarea value={adm.facteursRisque} onChange={(e) => setAdm({ ...adm, facteursRisque: e.target.value })} placeholder="Ex. utérus cicatriciel, HTA, anémie, grossesse gémellaire..." className={`${inputCls} h-16 resize-none`} />
              </Champ>
              <button type="button" onClick={handleAdmettre} className="w-full text-sm font-bold py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-lg">
                {editPartoId ? "Enregistrer les corrections" : "Admettre et ouvrir le partogramme"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
