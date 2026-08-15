/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { FichePediatrique, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Search, Activity, ShieldAlert, AlertTriangle, Eye, Download, X } from "lucide-react";

interface TabPediatrieProps {
  pediatrie: FichePediatrique[];
  staff: Staff[];
  onUpdatePediatrie: (p: FichePediatrique[]) => void;
  theme?: "light" | "dark";
}

export default function TabPediatrie({ pediatrie, staff, onUpdatePediatrie, theme = "light" }: TabPediatrieProps) {
  // Load dynamic clinic profile from LocalStorage safely
  const profile = (() => {
    try {
      const saved = localStorage.getItem("dg_clinic_profile");
      return saved ? JSON.parse(saved) : {
        name: "Cabinet Médical DEO-GRACIAS",
        address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital",
        phone: "+226 20 97 12 34"
      };
    } catch {
      return { name: "Cabinet Médical DEO-GRACIAS", address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital", phone: "+226 20 97 12 34" };
    }
  })();

  // --- Identification ---
  const [pedPatient, setPedPatient] = useState("");
  const [pedSexe, setPedSexe] = useState<"Masculin" | "Féminin" | "">("");
  const [pedDateNaissance, setPedDateNaissance] = useState("");
  const [pedAgeMois, setPedAgeMois] = useState("");
  const [pedContact, setPedContact] = useState("");
  const [pedTemperature, setPedTemperature] = useState("");
  const [pedMotif, setPedMotif] = useState("");

  // --- Mesures anthropométriques ---
  const [pedPoids, setPedPoids] = useState("");
  const [pedTaille, setPedTaille] = useState("");
  const [pedPc, setPedPc] = useState("");
  const [pedPb, setPedPb] = useState("");
  const [pedOedemes, setPedOedemes] = useState(false);
  const [pedPalmesPales, setPedPalmesPales] = useState(false);

  // --- Signes Généraux de Danger (PCIME) ---
  const [dangerNePeutBoire, setDangerNePeutBoire] = useState(false);
  const [dangerVomitTout, setDangerVomitTout] = useState(false);
  const [dangerConvulsions, setDangerConvulsions] = useState(false);
  const [dangerLethargique, setDangerLethargique] = useState(false);

  // --- Toux / difficulté respiratoire ---
  const [touxPresent, setTouxPresent] = useState(false);
  const [touxDureeJours, setTouxDureeJours] = useState("");
  const [freqRespiratoire, setFreqRespiratoire] = useState("");
  const [tirageSousCostal, setTirageSousCostal] = useState(false);
  const [stridor, setStridor] = useState(false);
  const [classifRespiratoire, setClassifRespiratoire] = useState("");

  // --- Diarrhée ---
  const [diarrheePresent, setDiarrheePresent] = useState(false);
  const [diarrheeDureeJours, setDiarrheeDureeJours] = useState("");
  const [diarrheeSangSelles, setDiarrheeSangSelles] = useState(false);
  const [diarrheeLethargiqueAgite, setDiarrheeLethargiqueAgite] = useState(false);
  const [diarrheeYeuxEnfonces, setDiarrheeYeuxEnfonces] = useState(false);
  const [diarrheeBoitAvidement, setDiarrheeBoitAvidement] = useState(false);
  const [diarrheePliCutane, setDiarrheePliCutane] = useState(false);
  const [classifDiarrhee, setClassifDiarrhee] = useState("");

  // --- Fièvre ---
  const [fievrePresent, setFievrePresent] = useState(false);
  const [fievreDureeJours, setFievreDureeJours] = useState("");
  const [fievreTypePalu, setFievreTypePalu] = useState(false);
  const [fievreTypeRougeole, setFievreTypeRougeole] = useState(false);
  const [classifFievre, setClassifFievre] = useState("");

  // --- Problème d'oreille ---
  const [oreilleDouleur, setOreilleDouleur] = useState(false);
  const [oreilleEcoulement, setOreilleEcoulement] = useState(false);
  const [oreilleDureeJours, setOreilleDureeJours] = useState("");
  const [classifOreille, setClassifOreille] = useState("");

  // --- Vaccination / Vitamine A ---
  const [pedVaccinsAJour, setPedVaccinsAJour] = useState(true);
  const [vitAAdministree, setVitAAdministree] = useState(false);
  const [deparasitageFait, setDeparasitageFait] = useState(false);
  const [pedAlimentation, setPedAlimentation] = useState("Allaitement maternel exclusif");

  // --- Conclusion ---
  const [pedConsultant, setPedConsultant] = useState("");
  const [classificationGlobale, setClassificationGlobale] = useState("");
  const [pedConduiteATenir, setPedConduiteATenir] = useState("");
  const [pedDiagnostic, setPedDiagnostic] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiche, setSelectedFiche] = useState<FichePediatrique | null>(null);

  // Calcul automatique de l'âge en mois à partir de la date de naissance
  const computeAgeMoisFromDob = (dob: string): number | null => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months -= 1;
    return Math.max(0, months);
  };

  const handleDateNaissanceChange = (val: string) => {
    setPedDateNaissance(val);
    const computed = computeAgeMoisFromDob(val);
    if (computed !== null) setPedAgeMois(String(computed));
  };

  const auMoinsUnSigneDanger = dangerNePeutBoire || dangerVomitTout || dangerConvulsions || dangerLethargique;

  // Nutritional MUAC Classifier
  const getNutritionStatus = (pbVal: number, hasOedemes: boolean): { status: string; color: string; label: string } => {
    if (hasOedemes) {
      return { status: "MAS", color: "bg-danger-100 text-danger-800 border-danger-200", label: "🔴 Malnutrition Aiguë Sévère (MAS - avec oedèmes)" };
    }
    if (!pbVal) return { status: "Non évalué", color: "bg-stone-100 text-stone-600 border-stone-200", label: "Non évalué" };

    if (pbVal < 11.5) {
      return { status: "MAS", color: "bg-danger-100 text-danger-800 border-danger-200 animate-pulse", label: "🔴 Malnutrition Aiguë Sévère (MAS)" };
    } else if (pbVal >= 11.5 && pbVal < 12.5) {
      return { status: "MAM", color: "bg-warning-100 text-warning-800 border-warning-200", label: "🟡 Malnutrition Aiguë Modérée (MAM)" };
    } else {
      return { status: "Normal", color: "bg-success-100 text-success-800 border-success-200", label: "🟢 Normal (Eutrophique)" };
    }
  };

  const resetForm = () => {
    setPedPatient("");
    setPedSexe("");
    setPedDateNaissance("");
    setPedAgeMois("");
    setPedContact("");
    setPedTemperature("");
    setPedMotif("");
    setPedPoids("");
    setPedTaille("");
    setPedPc("");
    setPedPb("");
    setPedOedemes(false);
    setPedPalmesPales(false);
    setDangerNePeutBoire(false);
    setDangerVomitTout(false);
    setDangerConvulsions(false);
    setDangerLethargique(false);
    setTouxPresent(false);
    setTouxDureeJours("");
    setFreqRespiratoire("");
    setTirageSousCostal(false);
    setStridor(false);
    setClassifRespiratoire("");
    setDiarrheePresent(false);
    setDiarrheeDureeJours("");
    setDiarrheeSangSelles(false);
    setDiarrheeLethargiqueAgite(false);
    setDiarrheeYeuxEnfonces(false);
    setDiarrheeBoitAvidement(false);
    setDiarrheePliCutane(false);
    setClassifDiarrhee("");
    setFievrePresent(false);
    setFievreDureeJours("");
    setFievreTypePalu(false);
    setFievreTypeRougeole(false);
    setClassifFievre("");
    setOreilleDouleur(false);
    setOreilleEcoulement(false);
    setOreilleDureeJours("");
    setClassifOreille("");
    setVitAAdministree(false);
    setDeparasitageFait(false);
    setClassificationGlobale("");
    setPedConduiteATenir("");
    setPedDiagnostic("");
  };

  const handleAddPediatrie = () => {
    if (!pedPatient.trim() || !pedAgeMois || !pedPoids) {
      alert("Veuillez saisir le nom de l'enfant, son âge (mois) et son poids.");
      return;
    }

    const age = parseFloat(pedAgeMois) || 1;
    const poids = parseFloat(pedPoids) || 0;
    const taille = parseFloat(pedTaille) || 0;
    const pc = parseFloat(pedPc) || 0;
    const pb = parseFloat(pedPb) || 0;

    const nutObj = getNutritionStatus(pb, pedOedemes);

    const newFiche: FichePediatrique = {
      id: generateUid(),
      patient: pedPatient.trim(),
      sexe: pedSexe || undefined,
      dateNaissance: pedDateNaissance || undefined,
      ageMois: age,
      contact: pedContact.trim(),
      temperature: pedTemperature ? parseFloat(pedTemperature) : undefined,
      motif: pedMotif.trim(),
      poids,
      taille,
      pc,
      pb,
      oedemes: pedOedemes,
      statutNutritionnel: nutObj.status,
      vaccinsAJour: pedVaccinsAJour,
      alimentation: pedAlimentation,
      consultant: pedConsultant,

      dangerNePeutBoireOuTeter: dangerNePeutBoire,
      dangerVomitTout: dangerVomitTout,
      dangerConvulsions: dangerConvulsions,
      dangerLethargiqueInconscient: dangerLethargique,

      touxPresent,
      touxDureeJours: touxDureeJours ? parseFloat(touxDureeJours) : undefined,
      freqRespiratoire: freqRespiratoire ? parseFloat(freqRespiratoire) : undefined,
      tirageSousCostal,
      stridor,
      classificationRespiratoire: classifRespiratoire || undefined,

      diarrheePresent,
      diarrheeDureeJours: diarrheeDureeJours ? parseFloat(diarrheeDureeJours) : undefined,
      diarrheeSangSelles,
      diarrheeLethargiqueAgite,
      diarrheeYeuxEnfonces,
      diarrheeBoitAvidement,
      diarrheePliCutanePersistant: diarrheePliCutane,
      classificationDiarrhee: classifDiarrhee || undefined,

      fievrePresent,
      fievreDureeJours: fievreDureeJours ? parseFloat(fievreDureeJours) : undefined,
      fievreTypePalu,
      fievreTypeRougeole,
      classificationFievre: classifFievre || undefined,

      oreilleDouleur,
      oreilleEcoulement,
      oreilleDureeJours: oreilleDureeJours ? parseFloat(oreilleDureeJours) : undefined,
      classificationOreille: classifOreille || undefined,

      palmesPales: pedPalmesPales,

      vitAAdministree,
      deparasitageFait,

      classificationGlobale: classificationGlobale || (auMoinsUnSigneDanger ? "Rouge (Référence urgente)" : undefined),
      conduiteATenir: pedConduiteATenir.trim(),

      diagnostic: pedDiagnostic.trim(),
      date: getTodayStr(),
      createdAt: new Date().toISOString()
    };

    onUpdatePediatrie([newFiche, ...pediatrie]);
    resetForm();
    alert("Fiche de consultation pédiatrique (PCIME) sauvegardée.");
  };

  const handleDeletePed = (id: string) => {
    if (confirm("Supprimer cette fiche pédiatrique ?")) {
      onUpdatePediatrie(pediatrie.filter((p) => p.id !== id));
    }
  };

  const handleDownloadPDF = (p: FichePediatrique) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(13, 148, 136);
    doc.text(profile.name, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${profile.address} — Tél: ${profile.phone}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFillColor(240, 253, 250);
    doc.rect(margin, y, contentWidth, 9, "F");
    doc.setDrawColor(13, 148, 136);
    doc.rect(margin, y, contentWidth, 9, "S");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(13, 148, 136);
    doc.text("FICHE DE CONSULTATION PÉDIATRIQUE (PCIME)", pageWidth / 2, y + 6, { align: "center" });
    y += 16;

    const drawRow = (label: string, value: string) => {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 70);
      doc.text(label, margin, y);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      const lines = doc.splitTextToSize(value || "—", contentWidth - 55);
      doc.text(lines, margin + 55, y);
      y += 5.5 * lines.length;
    };

    const drawSectionTitle = (title: string) => {
      y += 2;
      doc.setFillColor(245, 245, 244);
      doc.rect(margin, y, contentWidth, 6, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 70);
      doc.text(title, margin + 2, y + 4.3);
      y += 9;
    };

    drawRow("Nom de l'enfant :", p.patient);
    drawRow("Sexe / Date de naissance :", `${p.sexe || "—"} / ${p.dateNaissance ? new Date(p.dateNaissance).toLocaleDateString("fr-FR") : "—"}`);
    drawRow("Âge :", `${p.ageMois} mois`);
    drawRow("Contact parent :", p.contact || "—");
    drawRow("Température :", p.temperature ? `${p.temperature} °C` : "—");
    drawRow("Motif de consultation :", p.motif || "—");

    drawSectionTitle("MESURES ANTHROPOMÉTRIQUES");
    drawRow("Poids / Taille :", `${p.poids} kg / ${p.taille || "—"} cm`);
    drawRow("Périmètre crânien / MUAC (PB) :", `${p.pc || "—"} cm / ${p.pb || "—"} cm`);
    drawRow("Oedèmes / Pâleur palmaire :", `${p.oedemes ? "Oui" : "Non"} / ${p.palmesPales ? "Oui" : "Non"}`);
    drawRow("Statut nutritionnel :", p.statutNutritionnel);

    if (p.dangerNePeutBoireOuTeter || p.dangerVomitTout || p.dangerConvulsions || p.dangerLethargiqueInconscient) {
      drawSectionTitle("⚠ SIGNES GÉNÉRAUX DE DANGER");
      const signes: string[] = [];
      if (p.dangerNePeutBoireOuTeter) signes.push("Ne peut boire/téter");
      if (p.dangerVomitTout) signes.push("Vomit tout");
      if (p.dangerConvulsions) signes.push("Convulsions");
      if (p.dangerLethargiqueInconscient) signes.push("Léthargique/Inconscient");
      drawRow("Signes présents :", signes.join(", "));
    }

    if (p.touxPresent) {
      drawSectionTitle("TOUX / DIFFICULTÉ À RESPIRER");
      drawRow("Durée / Fréq. respiratoire :", `${p.touxDureeJours || "—"} j / ${p.freqRespiratoire || "—"} cpm`);
      drawRow("Tirage sous-costal / Stridor :", `${p.tirageSousCostal ? "Oui" : "Non"} / ${p.stridor ? "Oui" : "Non"}`);
      drawRow("Classification :", p.classificationRespiratoire || "—");
    }

    if (p.diarrheePresent) {
      drawSectionTitle("DIARRHÉE");
      drawRow("Durée / Sang dans selles :", `${p.diarrheeDureeJours || "—"} j / ${p.diarrheeSangSelles ? "Oui" : "Non"}`);
      drawRow("Léthargique-agité / Yeux enfoncés :", `${p.diarrheeLethargiqueAgite ? "Oui" : "Non"} / ${p.diarrheeYeuxEnfonces ? "Oui" : "Non"}`);
      drawRow("Boit avidement / Pli cutané persist. :", `${p.diarrheeBoitAvidement ? "Oui" : "Non"} / ${p.diarrheePliCutanePersistant ? "Oui" : "Non"}`);
      drawRow("Classification :", p.classificationDiarrhee || "—");
    }

    if (p.fievrePresent) {
      drawSectionTitle("FIÈVRE");
      drawRow("Durée / Type suspecté :", `${p.fievreDureeJours || "—"} j / ${[p.fievreTypePalu ? "Palu" : "", p.fievreTypeRougeole ? "Rougeole" : ""].filter(Boolean).join(", ") || "—"}`);
      drawRow("Classification :", p.classificationFievre || "—");
    }

    if (p.oreilleDouleur || p.oreilleEcoulement) {
      drawSectionTitle("PROBLÈME D'OREILLE");
      drawRow("Douleur / Écoulement :", `${p.oreilleDouleur ? "Oui" : "Non"} / ${p.oreilleEcoulement ? "Oui" : "Non"}`);
      drawRow("Durée / Classification :", `${p.oreilleDureeJours || "—"} j / ${p.classifOreille || p.classificationOreille || "—"}`);
    }

    drawSectionTitle("VACCINATION & COMPLÉMENTS");
    drawRow("PEV à jour / Vitamine A :", `${p.vaccinsAJour ? "Oui" : "Non"} / ${p.vitAAdministree ? "Administrée" : "Non"}`);
    drawRow("Déparasitage / Alimentation :", `${p.deparasitageFait ? "Fait" : "Non"} / ${p.alimentation}`);

    drawSectionTitle("CONCLUSION");
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFillColor(
      p.classificationGlobale?.includes("Rouge") ? 254 : p.classificationGlobale?.includes("Jaune") ? 255 : 240,
      p.classificationGlobale?.includes("Rouge") ? 226 : p.classificationGlobale?.includes("Jaune") ? 247 : 253,
      p.classificationGlobale?.includes("Rouge") ? 226 : p.classificationGlobale?.includes("Jaune") ? 205 : 250
    );
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(`CLASSIFICATION GLOBALE : ${p.classificationGlobale || "Non renseignée"}`, margin + 2, y + 5.5);
    y += 12;

    drawRow("Diagnostic :", p.diagnostic);
    drawRow("Conduite à tenir :", p.conduiteATenir || "—");
    y += 8;
    const doctorStaff = staff.find((s) => s.id === p.consultant);
    drawRow("Consultant :", doctorStaff ? doctorStaff.nom : "—");

    doc.save(`fiche_pediatrique_${p.patient.replace(/\s+/g, "_")}_${p.date}.pdf`);
  };

  // Calculations
  const curMonth = getTodayStr().slice(0, 7);
  const pediatrieMonth = pediatrie.filter((p) => p.date.slice(0, 7) === curMonth);
  const totalConsultsMonth = pediatrieMonth.length;

  const severeMalnutritionCases = pediatrie.filter((p) => p.statutNutritionnel === "MAS");
  const moderateMalnutritionCases = pediatrie.filter((p) => p.statutNutritionnel === "MAM");
  const nonVaccinesCount = pediatrie.filter((p) => !p.vaccinsAJour).length;
  const dangerCasesCount = pediatrie.filter(
    (p) => p.dangerNePeutBoireOuTeter || p.dangerVomitTout || p.dangerConvulsions || p.dangerLethargiqueInconscient
  ).length;

  const filteredPedList = pediatrie
    .filter((p) => p.patient.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const cardBase = theme === "dark" ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200";

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600`}>
          <div className="text-3xl font-semibold text-primary-700 font-serif">{totalConsultsMonth}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Consults Pédiatriques</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Mois en cours</div>
        </div>
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-700`}>
          <div className="text-3xl font-semibold text-danger-700 font-serif">{dangerCasesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Signes de Danger</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🚨 Référence urgente</div>
        </div>
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600`}>
          <div className="text-3xl font-semibold text-danger-700 font-serif">{severeMalnutritionCases.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Malnutrition Sévère (MAS)</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🔴 Tri 1 - Prise en charge CREN</div>
        </div>
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600`}>
          <div className="text-3xl font-semibold text-warning-700 font-serif">{moderateMalnutritionCases.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Malnutrition Modérée (MAM)</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🟡 Suivi nutritionnel</div>
        </div>
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-purple-600`}>
          <div className="text-3xl font-semibold text-purple-700 font-serif">{nonVaccinesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Vaccins non à jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Relances PEV requises</div>
        </div>
      </div>

      {/* Critical nutritional warning alerts */}
      {severeMalnutritionCases.length > 0 && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-xl text-xs font-bold flex items-center gap-3 shadow-2xs">
          <ShieldAlert className="w-5 h-5 text-danger-600 flex-shrink-0" />
          <div>
            <strong>ALERTE CREN :</strong> Il y a actuellement <strong>{severeMalnutritionCases.length} cas de Malnutrition Aiguë Sévère (MAS)</strong> enregistrés. Supplémentation ATPE (Aliments Thérapeutiques Prêts à l'Emploi / Plumpy'Nut) et transfert CREN requis.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PCIME consultation entry form */}
        <div className={`${cardBase} border rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4`}>
          <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Nouvelle Consultation Pédiatrique (PCIME)
          </h3>

          {/* 1. Identification */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">1. Identification</h4>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom complet de l'enfant *</label>
              <input
                type="text"
                placeholder="Prénom Nom"
                value={pedPatient}
                onChange={(e) => setPedPatient(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sexe</label>
                <select
                  value={pedSexe}
                  onChange={(e) => setPedSexe(e.target.value as "Masculin" | "Féminin" | "")}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="Masculin">Masculin</option>
                  <option value="Féminin">Féminin</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date de naissance</label>
                <input
                  type="date"
                  value={pedDateNaissance}
                  onChange={(e) => handleDateNaissanceChange(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Âge de l'enfant (Mois) *</label>
                <input
                  type="number"
                  placeholder="Ex: 18"
                  value={pedAgeMois}
                  onChange={(e) => setPedAgeMois(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Téléphone Parent</label>
                <input
                  type="tel"
                  placeholder="+226..."
                  value={pedContact}
                  onChange={(e) => setPedContact(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Température (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 38.5"
                  value={pedTemperature}
                  onChange={(e) => setPedTemperature(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Motif de consultation</label>
                <input
                  type="text"
                  placeholder="Ex: Toux + fièvre"
                  value={pedMotif}
                  onChange={(e) => setPedMotif(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Signes Généraux de Danger */}
          <div className={`space-y-2 p-3 rounded-xl border ${auMoinsUnSigneDanger ? "bg-danger-50 border-danger-300" : "bg-stone-50 border-stone-100"}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-danger-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> 2. Signes Généraux de Danger
            </h4>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={dangerNePeutBoire} onChange={(e) => setDangerNePeutBoire(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
              Ne peut pas boire ou téter
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={dangerVomitTout} onChange={(e) => setDangerVomitTout(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
              Vomit tout ce qu'il consomme
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={dangerConvulsions} onChange={(e) => setDangerConvulsions(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
              Convulsions (actuelles ou récentes)
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={dangerLethargique} onChange={(e) => setDangerLethargique(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
              Léthargique ou inconscient
            </label>
            {auMoinsUnSigneDanger && (
              <p className="text-xs font-bold text-danger-700 pt-1">🚨 Au moins un signe de danger présent : référence urgente recommandée.</p>
            )}
          </div>

          {/* 3. Toux / difficulté respiratoire */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 cursor-pointer">
              <input type="checkbox" checked={touxPresent} onChange={(e) => setTouxPresent(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
              3. Toux ou difficulté à respirer
            </label>
            {touxPresent && (
              <div className="space-y-2 pl-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée (jours)</label>
                    <input type="number" value={touxDureeJours} onChange={(e) => setTouxDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Fréq. respiratoire (cpm)</label>
                    <input type="number" value={freqRespiratoire} onChange={(e) => setFreqRespiratoire(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={tirageSousCostal} onChange={(e) => setTirageSousCostal(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Tirage sous-costal
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={stridor} onChange={(e) => setStridor(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Stridor chez un enfant calme
                </label>
                <select value={classifRespiratoire} onChange={(e) => setClassifRespiratoire(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none font-semibold">
                  <option value="">— Classification —</option>
                  <option value="Rouge — Pneumonie grave / Maladie très grave">🔴 Pneumonie grave / Maladie très grave</option>
                  <option value="Jaune — Pneumonie">🟡 Pneumonie</option>
                  <option value="Vert — Pas de pneumonie, toux ou rhume">🟢 Pas de pneumonie (toux/rhume)</option>
                </select>
              </div>
            )}
          </div>

          {/* 4. Diarrhée */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 cursor-pointer">
              <input type="checkbox" checked={diarrheePresent} onChange={(e) => setDiarrheePresent(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
              4. Diarrhée
            </label>
            {diarrheePresent && (
              <div className="space-y-2 pl-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée (jours)</label>
                    <input type="number" value={diarrheeDureeJours} onChange={(e) => setDiarrheeDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer self-end pb-1.5">
                    <input type="checkbox" checked={diarrheeSangSelles} onChange={(e) => setDiarrheeSangSelles(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                    Sang dans les selles
                  </label>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={diarrheeLethargiqueAgite} onChange={(e) => setDiarrheeLethargiqueAgite(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Léthargique ou agité(e) / irritable
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={diarrheeYeuxEnfonces} onChange={(e) => setDiarrheeYeuxEnfonces(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Yeux enfoncés
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={diarrheeBoitAvidement} onChange={(e) => setDiarrheeBoitAvidement(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Boit avidement, assoiffé
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={diarrheePliCutane} onChange={(e) => setDiarrheePliCutane(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Pli cutané s'efface lentement / très lentement
                </label>
                <select value={classifDiarrhee} onChange={(e) => setClassifDiarrhee(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none font-semibold">
                  <option value="">— Classification (déshydratation) —</option>
                  <option value="Rouge — Déshydratation sévère">🔴 Déshydratation sévère</option>
                  <option value="Jaune — Déshydratation modérée">🟡 Déshydratation modérée (Plan B)</option>
                  <option value="Vert — Pas de déshydratation">🟢 Pas de déshydratation (Plan A)</option>
                </select>
              </div>
            )}
          </div>

          {/* 5. Fièvre */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 cursor-pointer">
              <input type="checkbox" checked={fievrePresent} onChange={(e) => setFievrePresent(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
              5. Fièvre
            </label>
            {fievrePresent && (
              <div className="space-y-2 pl-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée (jours)</label>
                    <input type="number" value={fievreDureeJours} onChange={(e) => setFievreDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                  <div className="flex flex-col justify-end gap-1">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                      <input type="checkbox" checked={fievreTypePalu} onChange={(e) => setFievreTypePalu(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                      Suspicion Paludisme
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={fievreTypeRougeole} onChange={(e) => setFievreTypeRougeole(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Éruption cutanée généralisée (suspicion Rougeole)
                </label>
                <select value={classifFievre} onChange={(e) => setClassifFievre(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none font-semibold">
                  <option value="">— Classification —</option>
                  <option value="Rouge — Maladie fébrile très grave / Paludisme grave">🔴 Maladie fébrile très grave / Palu grave</option>
                  <option value="Jaune — Paludisme simple">🟡 Paludisme simple</option>
                  <option value="Vert — Fièvre, palu peu probable">🟢 Fièvre, palu peu probable</option>
                </select>
              </div>
            )}
          </div>

          {/* 6. Problème d'oreille */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">6. Problème d'oreille</h4>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                <input type="checkbox" checked={oreilleDouleur} onChange={(e) => setOreilleDouleur(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Douleur auriculaire
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                <input type="checkbox" checked={oreilleEcoulement} onChange={(e) => setOreilleEcoulement(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Écoulement auriculaire
              </label>
            </div>
            {(oreilleDouleur || oreilleEcoulement) && (
              <div className="space-y-2 pl-1">
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée de l'écoulement (jours)</label>
                  <input type="number" value={oreilleDureeJours} onChange={(e) => setOreilleDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                </div>
                <select value={classifOreille} onChange={(e) => setClassifOreille(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none font-semibold">
                  <option value="">— Classification —</option>
                  <option value="Rouge — Mastoïdite">🔴 Mastoïdite</option>
                  <option value="Jaune — Infection aiguë/chronique de l'oreille">🟡 Infection aiguë / chronique</option>
                  <option value="Vert — Pas d'infection">🟢 Pas d'infection de l'oreille</option>
                </select>
              </div>
            )}
          </div>

          {/* 7. Mesures anthropométriques & nutrition */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">7. Croissance & État Nutritionnel</h4>
            <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-xl border border-stone-100">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Poids (kg) *</label>
                <input type="number" step="0.1" placeholder="Ex: 9.5" value={pedPoids} onChange={(e) => setPedPoids(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white focus:outline-none font-bold" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Taille (cm)</label>
                <input type="number" step="0.1" placeholder="Ex: 80" value={pedTaille} onChange={(e) => setPedTaille(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white focus:outline-none font-bold" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">P. Cranien (cm)</label>
                <input type="number" step="0.1" placeholder="Ex: 46" value={pedPc} onChange={(e) => setPedPc(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white focus:outline-none font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-danger-50/50 p-3 rounded-xl border border-danger-100">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-danger-900 block mb-1">MUAC (PB) (cm) *</label>
                <input type="number" step="0.1" placeholder="Périmètre brachial" value={pedPb} onChange={(e) => setPedPb(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none font-bold text-danger-800" />
              </div>
              <div className="flex flex-col justify-end gap-1">
                <label className="flex items-center gap-1.5 text-xs font-bold text-danger-900 cursor-pointer">
                  <input type="checkbox" checked={pedOedemes} onChange={(e) => setPedOedemes(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Oedèmes (+ bilateral)
                </label>
                <label className="flex items-center gap-1.5 text-xs font-bold text-danger-900 cursor-pointer">
                  <input type="checkbox" checked={pedPalmesPales} onChange={(e) => setPedPalmesPales(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Pâleur palmaire
                </label>
              </div>
              <div className="col-span-2 pt-1">
                <span className="text-2xs uppercase font-bold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Indice nutritionnel automatique</span>
                <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border text-center block ${getNutritionStatus(parseFloat(pedPb) || 0, pedOedemes).color}`}>
                  {getNutritionStatus(parseFloat(pedPb) || 0, pedOedemes).label}
                </span>
              </div>
            </div>
          </div>

          {/* 8. Vaccination, vitamine A, alimentation */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">8. Vaccination & Alimentation</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Alimentation enfant</label>
                <select value={pedAlimentation} onChange={(e) => setPedAlimentation(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white focus:outline-none font-medium">
                  <option value="Allaitement maternel exclusif">🤱 Allaitement maternel exclusif</option>
                  <option value="Allaitement diversifié">👶 Allaitement + Diversifié</option>
                  <option value="Alimentation familiale">🍲 Alimentation familiale</option>
                  <option value="Lait artificiel">🍼 Lait artificiel premier âge</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Pédiatre / Consultant</label>
                <select value={pedConsultant} onChange={(e) => setPedConsultant(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 py-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={pedVaccinsAJour} onChange={(e) => setPedVaccinsAJour(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Vaccinations à jour (PEV)
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={vitAAdministree} onChange={(e) => setVitAAdministree(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Vitamine A donnée
              </label>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={deparasitageFait} onChange={(e) => setDeparasitageFait(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
              Déparasitage effectué
            </label>
          </div>

          {/* 9. Conclusion */}
          <div className="space-y-2 border-t border-stone-100 pt-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">9. Conclusion</h4>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Classification globale</label>
              <select value={classificationGlobale} onChange={(e) => setClassificationGlobale(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold">
                <option value="">— Choisir —</option>
                <option value="Rouge (Référence urgente)">🔴 Rouge — Référence urgente</option>
                <option value="Jaune (Traitement ambulatoire)">🟡 Jaune — Traitement ambulatoire</option>
                <option value="Vert (Traitement à domicile)">🟢 Vert — Traitement / conseils à domicile</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Diagnostic clinique</label>
              <textarea
                placeholder="Ex: Rhinopharyngite aiguë avec poussée fébrile."
                value={pedDiagnostic}
                onChange={(e) => setPedDiagnostic(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-14 resize-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Conduite à tenir / Traitement prescrit</label>
              <textarea
                placeholder="Ex: Paracétamol sirop, ACT selon poids, conseils à la mère..."
                value={pedConduiteATenir}
                onChange={(e) => setPedConduiteATenir(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddPediatrie}
            className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2"
          >
            Enregistrer l'examen de l'enfant
          </button>
        </div>

        {/* Pediatric consult ledger list */}
        <div className={`${cardBase} border rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4`}>
          <div className="border-b border-stone-100 dark:border-stone-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-700" />
              Registre de Surveillance Pédiatrique & CREN
            </h3>

            <div className="relative w-full md:w-48">
              <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher enfant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {filteredPedList.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun examen pédiatrique trouvé.</p>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                    <th className="p-3">Date</th>
                    <th className="p-3">Enfant / Parent</th>
                    <th className="p-3 text-center">Sexe / Âge</th>
                    <th className="p-3 text-center">Poids / Taille</th>
                    <th className="p-3 text-center">MUAC (PB)</th>
                    <th className="p-3 text-center">État Nutritionnel</th>
                    <th className="p-3 text-center">Classification</th>
                    <th className="p-3 text-center">PEV</th>
                    <th className="p-3">Diagnostic</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredPedList.map((p) => {
                    const doc = staff.find((s) => s.id === p.consultant);
                    const nutObj = getNutritionStatus(p.pb, p.oedemes);
                    const hasDanger = p.dangerNePeutBoireOuTeter || p.dangerVomitTout || p.dangerConvulsions || p.dangerLethargiqueInconscient;

                    return (
                      <tr key={p.id} className={`hover:bg-stone-50/50 ${hasDanger ? "bg-danger-50/40" : ""}`}>
                        <td className="p-3 font-mono text-stone-500 dark:text-stone-400">{new Date(p.date).toLocaleDateString("fr-FR")}</td>
                        <td className="p-3 font-bold text-stone-800">
                          <div className="flex items-center gap-1">
                            {hasDanger && <span title="Signe de danger présent">🚨</span>}
                            {p.patient}
                          </div>
                          {p.contact && <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">📞 {p.contact}</div>}
                        </td>
                        <td className="p-3 text-center font-bold text-stone-700">
                          <div>{p.sexe === "Masculin" ? "M" : p.sexe === "Féminin" ? "F" : "—"}</div>
                          <div className="font-mono text-stone-500 dark:text-stone-400">{p.ageMois} mois</div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="font-bold text-stone-900 font-mono">{p.poids} kg</div>
                          <div className="text-xs text-stone-500 dark:text-stone-400 font-mono">{p.taille || "—"} cm</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-danger-700">{p.pb ? `${p.pb} cm` : "—"}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold inline-block border ${nutObj.color}`}>
                            {p.statutNutritionnel}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {p.classificationGlobale ? (
                            <span
                              className={`px-2 py-0.5 rounded-lg text-xs font-semibold inline-block border ${
                                p.classificationGlobale.includes("Rouge")
                                  ? "bg-danger-100 text-danger-800 border-danger-200"
                                  : p.classificationGlobale.includes("Jaune")
                                  ? "bg-warning-100 text-warning-800 border-warning-200"
                                  : "bg-success-100 text-success-800 border-success-200"
                              }`}
                            >
                              {p.classificationGlobale.split(" ")[0]}
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {p.vaccinsAJour ? (
                            <span className="text-success-700 font-semibold text-sm">🟢 Oui</span>
                          ) : (
                            <span className="text-danger-600 font-semibold text-sm animate-pulse">🔴 Non</span>
                          )}
                        </td>
                        <td className="p-3 text-stone-600 font-medium max-w-[150px] truncate" title={p.diagnostic}>
                          <div>{p.diagnostic || "—"}</div>
                          <div className="text-2xs text-stone-500 dark:text-stone-400 font-semibold uppercase mt-0.5">By: {doc ? doc.nom : "Pédiatrie"}</div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => setSelectedFiche(p)} className="text-primary-600 hover:text-primary-800 transition-all" title="Voir la fiche complète">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDownloadPDF(p)} className="text-success-600 hover:text-success-800 transition-all" title="Télécharger le PDF">
                              <Download className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDeletePed(p.id)} className="text-stone-300 hover:text-danger-600 transition-all" title="Supprimer">
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
      </div>

      {/* Detail modal */}
      {selectedFiche && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className={`w-full max-w-2xl rounded-2xl shadow-xl border overflow-hidden max-h-[90vh] flex flex-col ${theme === "dark" ? "bg-stone-900 border-stone-800 text-stone-100" : "bg-white border-stone-200 text-stone-800"}`}>
            <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
              <h3 className="font-serif font-bold text-base">Fiche PCIME — {selectedFiche.patient}</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleDownloadPDF(selectedFiche)} className="bg-success-600 hover:bg-success-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5">
                  <Download className="w-4 h-4" /> PDF
                </button>
                <button type="button" onClick={() => setSelectedFiche(null)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-all">
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Sexe :</span> {selectedFiche.sexe || "—"}</div>
                <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Âge :</span> {selectedFiche.ageMois} mois</div>
                <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Température :</span> {selectedFiche.temperature ? `${selectedFiche.temperature} °C` : "—"}</div>
                <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Motif :</span> {selectedFiche.motif || "—"}</div>
              </div>

              {(selectedFiche.dangerNePeutBoireOuTeter || selectedFiche.dangerVomitTout || selectedFiche.dangerConvulsions || selectedFiche.dangerLethargiqueInconscient) && (
                <div className="bg-danger-50 border border-danger-200 rounded-xl p-3">
                  <span className="font-bold text-danger-800">🚨 Signes de danger : </span>
                  {[
                    selectedFiche.dangerNePeutBoireOuTeter && "Ne peut boire/téter",
                    selectedFiche.dangerVomitTout && "Vomit tout",
                    selectedFiche.dangerConvulsions && "Convulsions",
                    selectedFiche.dangerLethargiqueInconscient && "Léthargique/Inconscient"
                  ].filter(Boolean).join(", ")}
                </div>
              )}

              {selectedFiche.classificationGlobale && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-3">
                  <span className="font-bold text-primary-800">Classification globale : </span>{selectedFiche.classificationGlobale}
                </div>
              )}

              <div>
                <span className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">Diagnostic :</span>
                <p className="bg-stone-50 dark:bg-stone-800 p-2 rounded-lg">{selectedFiche.diagnostic || "—"}</p>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">Conduite à tenir :</span>
                <p className="bg-stone-50 dark:bg-stone-800 p-2 rounded-lg">{selectedFiche.conduiteATenir || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
