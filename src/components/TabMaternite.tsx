/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ConsultationPrenatale, Accouchement, Staff, ExamenLabo, EchographieCPN } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Calendar, Clipboard, Heart, HelpCircle, CheckCircle, FlaskConical, Upload, Image, Download, Eye, X, AlertTriangle, FolderOpen } from "lucide-react";

interface TabMaterniteProps {
  cpns: ConsultationPrenatale[];
  accouchements: Accouchement[];
  staff: Staff[];
  onUpdateCpns: (cpns: ConsultationPrenatale[]) => void;
  onUpdateAccouchements: (acc: Accouchement[]) => void;
  laboExamens?: ExamenLabo[];
  onUpdateLaboExamens?: (examens: ExamenLabo[]) => void;
  currentUser?: Staff | null;
  rdvs?: any[];
}

export default function TabMaternite({
  cpns,
  accouchements,
  staff,
  onUpdateCpns,
  onUpdateAccouchements,
  laboExamens = [],
  onUpdateLaboExamens,
  currentUser
}: TabMaterniteProps) {
  // --- Identification & terme ---
  const [cpnPatient, setCpnPatient] = useState("");
  const [cpnContact, setCpnContact] = useState("");
  const [cpnDdr, setCpnDdr] = useState("");
  const [cpnDateVisite, setCpnDateVisite] = useState(getTodayStr());
  const [cpnNumero, setCpnNumero] = useState<ConsultationPrenatale["numeroVisite"]>("CPN 1");
  const [cpnGestite, setCpnGestite] = useState("");
  const [cpnParite, setCpnParite] = useState("");
  const [cpnAvortements, setCpnAvortements] = useState("");

  // --- Examen clinique ---
  const [cpnPoids, setCpnPoids] = useState("");
  const [cpnTa, setCpnTa] = useState("");
  const [cpnHauteurUterine, setCpnHauteurUterine] = useState("");
  const [cpnBcf, setCpnBcf] = useState<"Présents" | "Absents" | "Non recherchés" | "">("");
  const [cpnBcfFrequence, setCpnBcfFrequence] = useState("");
  const [cpnMafPresents, setCpnMafPresents] = useState(true);
  const [cpnPresentation, setCpnPresentation] = useState("");
  const [cpnOedemesMembres, setCpnOedemesMembres] = useState(false);
  const [cpnPalleurConjonctivale, setCpnPalleurConjonctivale] = useState(false);

  // --- Examens complémentaires ---
  const [cpnAlbuminurie, setCpnAlbuminurie] = useState("Négatif");
  const [cpnGlycosurie, setCpnGlycosurie] = useState("Négatif");
  const [cpnHemoglobine, setCpnHemoglobine] = useState("");
  const [cpnGroupeSanguin, setCpnGroupeSanguin] = useState("");
  const [cpnRhesus, setCpnRhesus] = useState("");
  const [cpnSerologieVIH, setCpnSerologieVIH] = useState("");
  const [cpnSerologieSyphilis, setCpnSerologieSyphilis] = useState("");
  const [cpnSerologieHepatiteB, setCpnSerologieHepatiteB] = useState("");

  // --- Prophylaxie ---
  const [cpnFerAcideFolique, setCpnFerAcideFolique] = useState(true);
  const [cpnMild, setCpnMild] = useState(true);
  const [cpnVatDoses, setCpnVatDoses] = useState("");
  const [cpnTpiDoses, setCpnTpiDoses] = useState("");

  // --- Signes de danger de la grossesse ---
  const [dangerSaignement, setDangerSaignement] = useState(false);
  const [dangerCephalees, setDangerCephalees] = useState(false);
  const [dangerVisionFloue, setDangerVisionFloue] = useState(false);
  const [dangerDouleurEpigastrique, setDangerDouleurEpigastrique] = useState(false);
  const [dangerFievre, setDangerFievre] = useState(false);
  const [dangerDiminutionMAF, setDangerDiminutionMAF] = useState(false);

  // --- Échographies à joindre à cette visite ---
  const [tempEchographies, setTempEchographies] = useState<EchographieCPN[]>([]);
  const [echoDateInput, setEchoDateInput] = useState(getTodayStr());
  const [echoResultatInput, setEchoResultatInput] = useState("");

  // --- Suite ---
  const [cpnAgent, setCpnAgent] = useState("");
  const [cpnProchainRdv, setCpnProchainRdv] = useState("");
  const [cpnNotes, setCpnNotes] = useState("");

  const [cpnPrescriptionAnalyse, setCpnPrescriptionAnalyse] = useState("");

  // --- Dossier grossesse (vue par patiente) ---
  const [selectedPatientDossier, setSelectedPatientDossier] = useState<string | null>(null);
  const [selectedEchoPreview, setSelectedEchoPreview] = useState<EchographieCPN | null>(null);

  // Child-birth Form states
  const [accPatient, setAccPatient] = useState("");
  const [accDate, setAccDate] = useState(getTodayStr());
  const [accHeure, setAccHeure] = useState("");
  const [accMode, setAccMode] = useState<"Voie basse naturelle" | "Césarienne">("Voie basse naturelle");
  const [accSexeEnfant, setAccSexeEnfant] = useState<"Masculin" | "Féminin">("Masculin");
  const [accPoidsEnfant, setAccPoidsEnfant] = useState("");
  const [accEtatEnfant, setAccEtatEnfant] = useState("Vivant et bien portant");
  const [accComplications, setAccComplications] = useState("");
  const [accSageFemme, setAccSageFemme] = useState("");

  const handleEchoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const newEcho: EchographieCPN = {
        id: generateUid(),
        date: echoDateInput || getTodayStr(),
        sa: cpnDdr ? getAmenorrhoeaWeeks(cpnDdr) : undefined,
        resultat: echoResultatInput.trim(),
        fileName: file.name,
        fileType: file.type,
        base64Data: base64String,
        createdAt: new Date().toISOString()
      };
      setTempEchographies((prev) => [...prev, newEcho]);
      setEchoResultatInput("");
      alert("Échographie ajoutée à cette visite : " + file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleRemoveTempEcho = (id: string) => {
    setTempEchographies((prev) => prev.filter((e) => e.id !== id));
  };

  const handlePrescrireExamenCpn = () => {
    if (!cpnPatient) {
      alert("Veuillez d'abord renseigner le nom de la patiente avant de prescrire un examen.");
      return;
    }
    if (!cpnPrescriptionAnalyse.trim()) {
      alert("Veuillez préciser l'examen à prescrire.");
      return;
    }
    const newExam: ExamenLabo = {
      id: generateUid(),
      patient: cpnPatient,
      contact: cpnContact,
      dateDemande: getTodayStr(),
      analyses: cpnPrescriptionAnalyse,
      prescripteur: currentUser?.nom || "Sage-Femme / Médecin",
      technicien: "",
      statut: "En attente",
      dateResultat: "",
      resultat: "",
      interpretation: "",
      createdAt: new Date().toISOString()
    };
    if (onUpdateLaboExamens) {
      onUpdateLaboExamens([newExam, ...laboExamens]);
      alert(`Examen prescrit (${cpnPrescriptionAnalyse}) et envoyé directement au laboratoire !`);
      setCpnPrescriptionAnalyse("");
    }
  };

  const auMoinsUnSigneDanger = dangerSaignement || dangerCephalees || dangerVisionFloue || dangerDouleurEpigastrique || dangerFievre || dangerDiminutionMAF;

  const resetCpnForm = () => {
    setCpnPatient("");
    setCpnContact("");
    setCpnPoids("");
    setCpnTa("");
    setCpnHauteurUterine("");
    setCpnBcf("");
    setCpnBcfFrequence("");
    setCpnMafPresents(true);
    setCpnPresentation("");
    setCpnOedemesMembres(false);
    setCpnPalleurConjonctivale(false);
    setCpnGlycosurie("Négatif");
    setCpnHemoglobine("");
    setCpnGroupeSanguin("");
    setCpnRhesus("");
    setCpnSerologieVIH("");
    setCpnSerologieSyphilis("");
    setCpnSerologieHepatiteB("");
    setCpnVatDoses("");
    setCpnTpiDoses("");
    setDangerSaignement(false);
    setDangerCephalees(false);
    setDangerVisionFloue(false);
    setDangerDouleurEpigastrique(false);
    setDangerFievre(false);
    setDangerDiminutionMAF(false);
    setTempEchographies([]);
    setCpnProchainRdv("");
    setCpnNotes("");
    setCpnGestite("");
    setCpnParite("");
    setCpnAvortements("");
  };

  const handleAddCpn = () => {
    if (!cpnPatient.trim() || !cpnDdr) {
      alert("Veuillez saisir au moins le nom de la gestante et la date des dernières règles (DDR).");
      return;
    }

    const sa = getAmenorrhoeaWeeks(cpnDdr);
    const dpa = getExpectedDeliveryDate(cpnDdr);

    const newCpn: ConsultationPrenatale = {
      id: generateUid(),
      patient: cpnPatient.trim(),
      contact: cpnContact.trim(),
      ddr: cpnDdr,
      sa,
      dpa,
      dateVisite: cpnDateVisite || getTodayStr(),
      numeroVisite: cpnNumero,
      gestite: cpnGestite ? parseFloat(cpnGestite) : undefined,
      parite: cpnParite ? parseFloat(cpnParite) : undefined,
      avortements: cpnAvortements ? parseFloat(cpnAvortements) : undefined,
      groupeSanguin: cpnGroupeSanguin || undefined,
      rhesus: cpnRhesus || undefined,
      serologieVIH: cpnSerologieVIH || undefined,
      serologieSyphilis: cpnSerologieSyphilis || undefined,
      serologieHepatiteB: cpnSerologieHepatiteB || undefined,
      hemoglobine: cpnHemoglobine ? parseFloat(cpnHemoglobine) : undefined,
      glycosurie: cpnGlycosurie || undefined,
      hauteurUterine: cpnHauteurUterine ? parseFloat(cpnHauteurUterine) : undefined,
      bcf: cpnBcf || undefined,
      bcfFrequence: cpnBcfFrequence ? parseFloat(cpnBcfFrequence) : undefined,
      mafPresents: cpnMafPresents,
      presentation: cpnPresentation || undefined,
      oedemesMembres: cpnOedemesMembres,
      palleurConjonctivale: cpnPalleurConjonctivale,
      vatDoses: cpnVatDoses ? parseFloat(cpnVatDoses) : undefined,
      tpiDoses: cpnTpiDoses ? parseFloat(cpnTpiDoses) : undefined,
      dangerSaignement,
      dangerCephalees,
      dangerVisionFloue,
      dangerDouleurEpigastrique,
      dangerFievre,
      dangerDiminutionMAF,
      prochainRdv: cpnProchainRdv || undefined,
      poids: parseFloat(cpnPoids) || 0,
      ta: cpnTa.trim(),
      albuminurie: cpnAlbuminurie,
      ferAcideFolique: cpnFerAcideFolique,
      mild: cpnMild,
      agentId: cpnAgent,
      notes: cpnNotes.trim(),
      echographies: tempEchographies.length > 0 ? [...tempEchographies] : undefined,
      createdAt: new Date().toISOString()
    };

    onUpdateCpns([newCpn, ...cpns]);
    resetCpnForm();
    alert("Consultation Prénatale (CPN) enregistrée pour : " + newCpn.patient);
  };

  const handleAddAccouchement = () => {
    if (!accPatient.trim() || !accPoidsEnfant) {
      alert("Veuillez renseigner le nom de la accouchée et le poids de l'enfant né.");
      return;
    }

    const p = parseFloat(accPoidsEnfant) || 0;

    const newAcc: Accouchement = {
      id: generateUid(),
      patient: accPatient.trim(),
      date: accDate || getTodayStr(),
      heure: accHeure || "—",
      mode: accMode,
      sexeEnfant: accSexeEnfant,
      poidsEnfant: p,
      etatEnfant: accEtatEnfant.trim(),
      complications: accComplications.trim(),
      sageFemmeId: accSageFemme,
      createdAt: new Date().toISOString()
    };

    onUpdateAccouchements([newAcc, ...accouchements]);
    setAccPatient("");
    setAccPoidsEnfant("");
    setAccComplications("");
    alert("Nouvel accouchement consigné au registre de la maternité.");
  };

  const handleDeleteCpn = (id: string) => {
    if (confirm("Supprimer cette fiche CPN ? Les échographies liées seront également supprimées.")) {
      onUpdateCpns(cpns.filter((c) => c.id !== id));
    }
  };

  const handleDeleteAcc = (id: string) => {
    if (confirm("Supprimer cet accouchement ?")) {
      onUpdateAccouchements(accouchements.filter((a) => a.id !== id));
    }
  };

  const handleDownloadEcho = (echo: EchographieCPN) => {
    if (!echo.base64Data) return;
    const link = document.createElement("a");
    link.href = echo.base64Data;
    link.download = echo.fileName || `echographie_${echo.date}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // DDR Gestational Date Calculators (SA)
  const getAmenorrhoeaWeeks = (ddrStr: string): number => {
    if (!ddrStr) return 0;
    const ddr = new Date(ddrStr);
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - ddr.getTime());
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return Math.floor(diffDays / 7);
  };

  const getExpectedDeliveryDate = (ddrStr: string): string => {
    if (!ddrStr) return "";
    const ddr = new Date(ddrStr);
    // Naegele's rule roughly: +9 months +7 days (approx 280 days total)
    const dpa = new Date(ddr.getTime() + 280 * 24 * 60 * 60 * 1000);
    return dpa.toISOString().slice(0, 10);
  };

  // Calculations
  const curMonth = getTodayStr().slice(0, 7);

  const cpnsThisMonth = cpns.filter((c) => c.dateVisite.slice(0, 7) === curMonth).length;
  const birthsThisMonth = accouchements.filter((a) => a.date.slice(0, 7) === curMonth).length;
  const cesariennesCount = accouchements.filter((a) => a.mode === "Césarienne").length;
  const deliveryAnemiaRisk = cpns.filter((c) => c.albuminurie === "Positive" || (c.ta && parseFloat(c.ta.split("/")[0]) >= 140)).length;
  const dangerCasesCount = cpns.filter(
    (c) => c.dangerSaignement || c.dangerCephalees || c.dangerVisionFloue || c.dangerDouleurEpigastrique || c.dangerFievre || c.dangerDiminutionMAF
  ).length;

  // Dossier grossesse : toutes les visites + échographies d'une patiente
  const dossierPatienteVisites = selectedPatientDossier
    ? cpns.filter((c) => c.patient.toLowerCase().trim() === selectedPatientDossier.toLowerCase().trim()).sort((a, b) => a.dateVisite.localeCompare(b.dateVisite))
    : [];
  const dossierPatienteEchos = dossierPatienteVisites.flatMap((c) => (c.echographies || []).map((e) => ({ ...e, visiteLabel: c.numeroVisite, visiteDate: c.dateVisite })));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{cpnsThisMonth}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">CPN ce mois</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Consultations prénatales</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-700">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{dangerCasesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Signes de Danger</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🚨 Référence requise</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-pink-600">
          <div className="text-3xl font-semibold text-pink-700 font-serif">{birthsThisMonth}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Naissances mois</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Nouveaux-nés enregistrés</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{cesariennesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Césariennes</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Taux chirurgical maternité</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{deliveryAnemiaRisk}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Gestantes à risque</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Proteinurie ou HTA détectée</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Antenatal Care Form (CPN) */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary-700" />
            Nouvelle Consultation Prénatale (CPN)
          </h3>

          <div className="space-y-3">
            {/* 1. Identification */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">1. Identification</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom de la gestante *</label>
                <input type="text" placeholder="Madame..." value={cpnPatient} onChange={(e) => setCpnPatient(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Téléphone</label>
                <input type="tel" placeholder="+226..." value={cpnContact} onChange={(e) => setCpnContact(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Gestité (G)</label>
                <input type="number" value={cpnGestite} onChange={(e) => setCpnGestite(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Parité (P)</label>
                <input type="number" value={cpnParite} onChange={(e) => setCpnParite(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Avortements</label>
                <input type="number" value={cpnAvortements} onChange={(e) => setCpnAvortements(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-100">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-danger-800 block mb-1">DDR *</label>
                <input type="date" value={cpnDdr} onChange={(e) => setCpnDdr(e.target.value)} className="w-full text-sm border border-stone-200 rounded-lg p-1.5 bg-white focus:outline-none font-bold" />
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Âge de grossesse</span>
                <span className="text-xs font-bold text-primary-700 font-mono py-1.5 px-2 bg-white rounded-lg border border-stone-200 text-center block">
                  {cpnDdr ? `${getAmenorrhoeaWeeks(cpnDdr)} SA` : "— SA"}
                </span>
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">DPA Prévue</span>
                <span className="text-sm font-bold text-danger-700 font-mono py-1.5 px-2 bg-white rounded-lg border border-stone-200 text-center block truncate">
                  {cpnDdr ? new Date(getExpectedDeliveryDate(cpnDdr)).toLocaleDateString("fr-FR") : "—"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date Visite</label>
                <input type="date" value={cpnDateVisite} onChange={(e) => setCpnDateVisite(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg p-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Numéro visite CPN</label>
                <select value={cpnNumero} onChange={(e) => setCpnNumero(e.target.value as any)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="CPN 1">CPN 1 (T1)</option>
                  <option value="CPN 2">CPN 2 (T2)</option>
                  <option value="CPN 3">CPN 3 (T2/T3)</option>
                  <option value="CPN 4">CPN 4 (T3)</option>
                  <option value="CPN 5">CPN 5</option>
                  <option value="CPN 6">CPN 6</option>
                  <option value="CPN 7">CPN 7</option>
                  <option value="CPN 8">CPN 8 (Fin)</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Poids (kg)</label>
                <input type="number" placeholder="Ex: 65" value={cpnPoids} onChange={(e) => setCpnPoids(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
            </div>

            {/* 2. Examen clinique obstétrical */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700 pt-1">2. Examen Clinique Obstétrical</h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Tension (TA)</label>
                <input type="text" placeholder="Ex: 12/8" value={cpnTa} onChange={(e) => setCpnTa(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Hauteur Utérine (cm)</label>
                <input type="number" value={cpnHauteurUterine} onChange={(e) => setCpnHauteurUterine(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Présentation fœtale</label>
                <select value={cpnPresentation} onChange={(e) => setCpnPresentation(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">—</option>
                  <option value="Céphalique">Céphalique</option>
                  <option value="Siège">Siège</option>
                  <option value="Transverse">Transverse</option>
                  <option value="Indéterminée">Indéterminée</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Bruits du cœur fœtal (BCF)</label>
                <div className="flex gap-2">
                  <select value={cpnBcf} onChange={(e) => setCpnBcf(e.target.value as any)} className="flex-1 text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                    <option value="">—</option>
                    <option value="Présents">Présents</option>
                    <option value="Absents">Absents</option>
                    <option value="Non recherchés">Non recherchés</option>
                  </select>
                  <input type="number" placeholder="bpm" value={cpnBcfFrequence} onChange={(e) => setCpnBcfFrequence(e.target.value)} className="w-20 text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none" />
                </div>
              </div>
              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer py-2">
                  <input type="checkbox" checked={cpnMafPresents} onChange={(e) => setCpnMafPresents(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Mouvements actifs fœtaux (MAF) perçus
                </label>
              </div>
            </div>

            <div className="flex items-center gap-4 py-1">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={cpnOedemesMembres} onChange={(e) => setCpnOedemesMembres(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Œdèmes des membres
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={cpnPalleurConjonctivale} onChange={(e) => setCpnPalleurConjonctivale(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Pâleur conjonctivale
              </label>
            </div>

            {/* 3. Examens complémentaires */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700 pt-1">3. Examens Complémentaires</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Albuminurie</label>
                <select value={cpnAlbuminurie} onChange={(e) => setCpnAlbuminurie(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="Négatif">Négatif</option>
                  <option value="Traces">Traces</option>
                  <option value="Positive">Positive (+)</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Glycosurie</label>
                <select value={cpnGlycosurie} onChange={(e) => setCpnGlycosurie(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="Négatif">Négatif</option>
                  <option value="Traces">Traces</option>
                  <option value="Positive">Positive (+)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Hémoglobine (g/dL)</label>
                <input type="number" step="0.1" value={cpnHemoglobine} onChange={(e) => setCpnHemoglobine(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Groupe Sanguin</label>
                <select value={cpnGroupeSanguin} onChange={(e) => setCpnGroupeSanguin(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">—</option>
                  <option value="O">O</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Rhésus</label>
                <select value={cpnRhesus} onChange={(e) => setCpnRhesus(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">—</option>
                  <option value="Positif">Positif (+)</option>
                  <option value="Négatif">Négatif (-)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sérologie VIH</label>
                <select value={cpnSerologieVIH} onChange={(e) => setCpnSerologieVIH(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">Non fait</option>
                  <option value="Négatif">Négatif</option>
                  <option value="Positif">Positif</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sérologie Syphilis</label>
                <select value={cpnSerologieSyphilis} onChange={(e) => setCpnSerologieSyphilis(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">Non fait</option>
                  <option value="Négatif">Négatif</option>
                  <option value="Positif">Positif</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Hépatite B (AgHBs)</label>
                <select value={cpnSerologieHepatiteB} onChange={(e) => setCpnSerologieHepatiteB(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">Non fait</option>
                  <option value="Négatif">Négatif</option>
                  <option value="Positif">Positif</option>
                </select>
              </div>
            </div>

            {/* 4. Échographies */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700 pt-1 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" /> 4. Échographie(s) de cette visite
            </h4>
            <div className="bg-stone-50 border border-stone-100 rounded-xl p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Date de l'échographie</label>
                  <input type="date" value={echoDateInput} onChange={(e) => setEchoDateInput(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Résultat / Observation (court)</label>
                  <input type="text" placeholder="Ex: Grossesse évolutive, biométrie normale" value={echoResultatInput} onChange={(e) => setEchoResultatInput(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                </div>
              </div>
              <label className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 bg-white hover:bg-stone-100 text-primary-700 border border-dashed border-primary-300 rounded-lg cursor-pointer transition-all">
                <Upload className="w-3.5 h-3.5" />
                Importer une image / un PDF d'échographie
                <input type="file" accept="image/*,application/pdf" onChange={handleEchoFileUpload} className="hidden" />
              </label>

              {tempEchographies.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {tempEchographies.map((echo) => (
                    <div key={echo.id} className="flex items-center justify-between bg-white border border-stone-200 rounded-lg px-2 py-1.5">
                      <div className="text-xs">
                        <span className="font-semibold text-stone-700">{echo.fileName}</span>
                        <span className="text-stone-500 dark:text-stone-400 ml-1.5">({new Date(echo.date).toLocaleDateString("fr-FR")})</span>
                      </div>
                      <button type="button" onClick={() => handleRemoveTempEcho(echo.id)} className="text-danger-500 hover:text-danger-700">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Prophylaxie */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700 pt-1">5. Prophylaxie</h4>
            <div className="flex items-center gap-4 py-1.5 bg-stone-50/50 p-2.5 rounded-lg border border-stone-100 flex-wrap">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={cpnFerAcideFolique} onChange={(e) => setCpnFerAcideFolique(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Fer + Acide Folique
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={cpnMild} onChange={(e) => setCpnMild(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Moustiquaire (MILDA)
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Doses VAT reçues</label>
                <input type="number" min="0" max="5" value={cpnVatDoses} onChange={(e) => setCpnVatDoses(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Doses TPI/SP reçues</label>
                <input type="number" min="0" max="4" value={cpnTpiDoses} onChange={(e) => setCpnTpiDoses(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
            </div>

            {/* 6. Signes de danger */}
            <div className={`space-y-2 p-3 rounded-xl border ${auMoinsUnSigneDanger ? "bg-danger-50 border-danger-300" : "bg-stone-50 border-stone-100"}`}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-danger-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> 6. Signes de Danger de la Grossesse
              </h4>
              <div className="grid grid-cols-2 gap-1">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={dangerSaignement} onChange={(e) => setDangerSaignement(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Saignement vaginal
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={dangerCephalees} onChange={(e) => setDangerCephalees(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Céphalées sévères
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={dangerVisionFloue} onChange={(e) => setDangerVisionFloue(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Vision floue
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={dangerDouleurEpigastrique} onChange={(e) => setDangerDouleurEpigastrique(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Douleur épigastrique
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={dangerFievre} onChange={(e) => setDangerFievre(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Fièvre
                </label>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={dangerDiminutionMAF} onChange={(e) => setDangerDiminutionMAF(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Diminution des MAF
                </label>
              </div>
              {auMoinsUnSigneDanger && (
                <p className="text-xs font-bold text-danger-700 pt-1">🚨 Signe(s) de danger présent(s) : référence vers une structure de niveau supérieur recommandée.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Prochain RDV CPN</label>
                <input type="date" value={cpnProchainRdv} onChange={(e) => setCpnProchainRdv(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sage-femme / Agent</label>
                <select value={cpnAgent} onChange={(e) => setCpnAgent(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {staff
                    .filter((s) => s.poste === "Sage-femme" || s.poste === "Infirmier" || s.poste === "Médecin")
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.nom}</option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Notes complémentaires / Conduite à tenir</label>
              <textarea
                placeholder="Ex: Conseils nutritionnels donnés, plan d'accouchement discuté..."
                value={cpnNotes}
                onChange={(e) => setCpnNotes(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>

            {/* Prescription Laboratory module */}
            <div className="pt-3 border-t border-stone-100 space-y-2">
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-primary-600" />
                Prescrire un examen au laboratoire
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Ex: Groupe sanguin, Sérologie, NFS..."
                  value={cpnPrescriptionAnalyse}
                  onChange={(e) => setCpnPrescriptionAnalyse(e.target.value)}
                  className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2.5 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <button type="button" onClick={handlePrescrireExamenCpn} className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-xs shrink-0 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Prescrire
                </button>
              </div>
              <p className="text-2xs text-stone-500 dark:text-stone-400">
                Le bulletin d'examen apparaîtra directement dans l'onglet Laboratoire.
              </p>
            </div>

            <button type="button" onClick={handleAddCpn} className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2">
              Enregistrer la consultation CPN
            </button>
          </div>
        </div>

        {/* Childbirth register Form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4 self-start">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-600" />
            Registre d'Accouchement (Maternité)
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom de l'accouchée *</label>
                <input type="text" placeholder="Madame..." value={accPatient} onChange={(e) => setAccPatient(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Heure de délivrance</label>
                <input type="time" value={accHeure} onChange={(e) => setAccHeure(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date d'accouchement</label>
                <input type="date" value={accDate} onChange={(e) => setAccDate(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Mode d'accouchement</label>
                <select value={accMode} onChange={(e) => setAccMode(e.target.value as any)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="Voie basse naturelle">Voie basse naturelle</option>
                  <option value="Césarienne">Césarienne programmée / urgence</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sexe du bébé</label>
                <select value={accSexeEnfant} onChange={(e) => setAccSexeEnfant(e.target.value as any)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="Masculin">🩵 Garçon / Masculin</option>
                  <option value="Féminin">🩷 Fille / Féminin</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Poids bébé (g) *</label>
                <input type="number" placeholder="Ex: 3200" value={accPoidsEnfant} onChange={(e) => setAccPoidsEnfant(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sage-femme accoucheuse</label>
                <select value={accSageFemme} onChange={(e) => setAccSageFemme(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {staff
                    .filter((s) => s.poste === "Sage-femme" || s.poste === "Médecin")
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.nom}</option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">État de santé de l'enfant né</label>
              <input type="text" placeholder="Ex: Cri immédiat, score d'Apgar 10/10 à 5 min..." value={accEtatEnfant} onChange={(e) => setAccEtatEnfant(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none" />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Complications / Détails mère (Déchirure, hémorragie...)</label>
              <textarea placeholder="RAS ou préciser complications..." value={accComplications} onChange={(e) => setAccComplications(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none" />
            </div>

            <button type="button" onClick={handleAddAccouchement} className="w-full text-xs font-bold py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-all mt-2">
              Enregistrer la naissance
            </button>
          </div>
        </div>
      </div>

      {/* CPN consult ledger */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <Clipboard className="w-5 h-5 text-primary-700" />
          Grand Livre de Suivi Prénatal (Registre CPN)
        </h3>
        {cpns.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun dossier de suivi prénatal consigné.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Visite</th>
                  <th className="p-3">Gestante</th>
                  <th className="p-3 text-center">Terme (SA)</th>
                  <th className="p-3 text-center">DPA estimée</th>
                  <th className="p-3 text-center">TA / HU</th>
                  <th className="p-3 text-center">Proteinurie</th>
                  <th className="p-3 text-center">Échographies</th>
                  <th className="p-3 text-center">Alertes</th>
                  <th className="p-3">Observations</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {cpns.map((c) => {
                  const hasDanger = c.dangerSaignement || c.dangerCephalees || c.dangerVisionFloue || c.dangerDouleurEpigastrique || c.dangerFievre || c.dangerDiminutionMAF;
                  return (
                    <tr key={c.id} className={`hover:bg-stone-50/50 ${hasDanger ? "bg-danger-50/40" : ""}`}>
                      <td className="p-3 font-bold text-primary-700">{c.numeroVisite}</td>
                      <td className="p-3 font-bold text-stone-800">
                        <button type="button" onClick={() => setSelectedPatientDossier(c.patient)} className="hover:underline text-left">
                          {c.patient}
                        </button>
                        {c.contact && <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">📞 {c.contact}</div>}
                      </td>
                      <td className="p-3 text-center font-bold text-primary-700 font-mono">{c.sa} SA</td>
                      <td className="p-3 text-center font-mono text-danger-700 font-bold">{new Date(c.dpa).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3 text-center font-mono font-semibold">
                        <div>{c.ta || "—"}</div>
                        <div className="text-stone-500 dark:text-stone-400 text-2xs">{c.hauteurUterine ? `HU ${c.hauteurUterine}cm` : ""}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${c.albuminurie === "Positive" ? "bg-danger-100 text-danger-800 font-semibold" : "bg-success-100 text-success-800"}`}>
                          {c.albuminurie}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {c.echographies && c.echographies.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-lg border border-primary-200">
                            <Image className="w-3 h-3" /> {c.echographies.length}
                          </span>
                        ) : (
                          <span className="text-stone-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {hasDanger ? <span className="text-danger-600 font-bold text-sm animate-pulse">🚨</span> : <span className="text-stone-300">—</span>}
                      </td>
                      <td className="p-3 text-stone-500 italic truncate max-w-[150px]" title={c.notes}>
                        {c.notes || "—"}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={() => setSelectedPatientDossier(c.patient)} className="text-primary-600 hover:text-primary-800 transition-all" title="Voir le dossier grossesse complet">
                            <FolderOpen className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDeleteCpn(c.id)} className="text-stone-300 hover:text-danger-600 transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deliveries birth ledger */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-600" />
          Grand Registre d'Accouchements Réalisés à la Maternité
        </h3>
        {accouchements.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun accouchement répertorié dans ce registre.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Date / Heure</th>
                  <th className="p-3">Mère accouchée</th>
                  <th className="p-3">Mode d'accouchement</th>
                  <th className="p-3 text-center">Sexe Enfant</th>
                  <th className="p-3 text-center">Poids à la naissance</th>
                  <th className="p-3">État de l'enfant</th>
                  <th className="p-3">Sage-femme / Assistant</th>
                  <th className="p-3">Complications signalées</th>
                  <th className="p-3 text-center">Effacer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {accouchements.map((a) => {
                  const s = staff.find((item) => item.id === a.sageFemmeId);
                  return (
                    <tr key={a.id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-mono text-stone-500 dark:text-stone-400">
                        <div>{new Date(a.date).toLocaleDateString("fr-FR")}</div>
                        <div className="text-xs font-bold text-stone-500 dark:text-stone-400">{a.heure}</div>
                      </td>
                      <td className="p-3 font-bold text-stone-800">{a.patient}</td>
                      <td className="p-3 font-semibold text-stone-700">
                        {a.mode === "Césarienne" ? <span className="text-pink-700">🩺 Césarienne</span> : <span>👶 Voie basse</span>}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${a.sexeEnfant === "Féminin" ? "bg-pink-100 text-pink-800" : "bg-blue-100 text-blue-800"}`}>
                          {a.sexeEnfant}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold font-mono text-primary-800">{a.poidsEnfant} g</td>
                      <td className="p-3 text-success-800 font-semibold">{a.etatEnfant}</td>
                      <td className="p-3 font-semibold text-stone-700">{s ? s.nom : "—"}</td>
                      <td className={`p-3 text-stone-600 font-medium italic ${a.complications ? "text-danger-600 font-bold" : "text-stone-500 dark:text-stone-400"}`}>
                        {a.complications || "Aucune"}
                      </td>
                      <td className="p-3 text-center">
                        <button type="button" onClick={() => handleDeleteAcc(a.id)} className="text-stone-300 hover:text-danger-600 transition-all p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dossier Grossesse (par patiente) */}
      {selectedPatientDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl shadow-xl border border-stone-200 bg-white overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center">
              <h3 className="font-serif font-bold text-base flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary-700" />
                Dossier Grossesse — {selectedPatientDossier}
              </h3>
              <button type="button" onClick={() => setSelectedPatientDossier(null)} className="p-1.5 rounded-lg hover:bg-stone-100 transition-all">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Historique des visites ({dossierPatienteVisites.length})</h4>
                <div className="space-y-2">
                  {dossierPatienteVisites.map((v) => (
                    <div key={v.id} className="border border-stone-200 rounded-xl p-3 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-primary-700">{v.numeroVisite}</span>
                        <span className="font-mono text-stone-500 dark:text-stone-400">{new Date(v.dateVisite).toLocaleDateString("fr-FR")} — {v.sa} SA</span>
                      </div>
                      <div className="text-stone-600">TA: {v.ta || "—"} · HU: {v.hauteurUterine || "—"}cm · Poids: {v.poids}kg</div>
                      {v.notes && <div className="text-stone-500 dark:text-stone-400 italic mt-1">{v.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5" /> Échographies du dossier ({dossierPatienteEchos.length})
                </h4>
                {dossierPatienteEchos.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400 italic py-4 text-center border border-dashed border-stone-200 rounded-xl">
                    Aucune échographie enregistrée pour cette patiente.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {dossierPatienteEchos.map((echo) => (
                      <div key={echo.id} className="border border-stone-200 rounded-xl overflow-hidden">
                        {echo.fileType?.startsWith("image/") && echo.base64Data ? (
                          <img src={echo.base64Data} alt={echo.fileName} className="w-full h-24 object-cover cursor-pointer" onClick={() => setSelectedEchoPreview(echo)} />
                        ) : (
                          <div className="w-full h-24 bg-stone-100 flex items-center justify-center cursor-pointer" onClick={() => setSelectedEchoPreview(echo)}>
                            <FlaskConical className="w-8 h-8 text-stone-400" />
                          </div>
                        )}
                        <div className="p-2 text-2xs">
                          <div className="font-bold text-stone-700">{echo.visiteLabel} — {new Date(echo.date).toLocaleDateString("fr-FR")}</div>
                          {echo.resultat && <div className="text-stone-500 dark:text-stone-400 truncate" title={echo.resultat}>{echo.resultat}</div>}
                          <div className="flex items-center gap-2 mt-1">
                            <button type="button" onClick={() => setSelectedEchoPreview(echo)} className="text-primary-600 hover:text-primary-800"><Eye className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => handleDownloadEcho(echo)} className="text-success-600 hover:text-success-800"><Download className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Echo preview modal */}
      {selectedEchoPreview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedEchoPreview(null)}>
          <div className="max-w-3xl max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {selectedEchoPreview.fileType?.startsWith("image/") && selectedEchoPreview.base64Data ? (
              <img src={selectedEchoPreview.base64Data} alt={selectedEchoPreview.fileName} className="max-w-full max-h-[70vh] object-contain rounded-xl" />
            ) : (
              <div className="bg-white p-8 rounded-xl text-center">
                <FlaskConical className="w-12 h-12 text-stone-400 mx-auto mb-2" />
                <p className="text-sm text-stone-600">{selectedEchoPreview.fileName}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">Aperçu non disponible pour ce type de fichier.</p>
              </div>
            )}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => handleDownloadEcho(selectedEchoPreview)} className="bg-success-600 hover:bg-success-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5">
                <Download className="w-4 h-4" /> Télécharger
              </button>
              <button type="button" onClick={() => setSelectedEchoPreview(null)} className="bg-white text-stone-700 text-xs font-bold px-4 py-2 rounded-lg">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
