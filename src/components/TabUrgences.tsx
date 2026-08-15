/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { PatientUrgence, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Clock, ShieldAlert, HeartHandshake, Check, Printer, X, Eye, Download } from "lucide-react";

interface TabUrgencesProps {
  isLoading?: boolean;
  urgences: PatientUrgence[];
  staff: Staff[];
  onUpdateUrgences: (urgences: PatientUrgence[]) => void;
  filterPatientQuery?: string;
  theme?: "light" | "dark";
}

export default function TabUrgences({ urgences, staff, onUpdateUrgences, filterPatientQuery, theme = "light", isLoading }: TabUrgencesProps) {
  // Load dynamic clinic profile from LocalStorage safely
  const profile = (() => {
    try {
      const saved = localStorage.getItem("dg_clinic_profile");
      return saved ? JSON.parse(saved) : {
        name: "Cabinet Médical DEO-GRACIAS",
        slogan: "Excellence & Dévouement au Service de votre Santé",
        address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital",
        phone: "+226 20 97 12 34",
        email: "deograciasclinique@gmail.com",
        stampText: "CACHET & SIGNATURE DEO-GRACIAS"
      };
    } catch {
      return {
        name: "Cabinet Médical DEO-GRACIAS",
        slogan: "Excellence & Dévouement au Service de votre Santé",
        address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital",
        phone: "+226 20 97 12 34",
        email: "deograciasclinique@gmail.com",
        stampText: "CACHET & SIGNATURE DEO-GRACIAS"
      };
    }
  })();

  // Form states
  const [urgPatient, setUrgPatient] = useState("");
  const [urgContact, setUrgContact] = useState("");
  const [urgSeverite, setUrgSeverite] = useState<PatientUrgence["severite"]>("Urgent (Jaune)");
  const [urgPlainte, setUrgPlainte] = useState("");
  const [urgConstantes, setUrgConstantes] = useState("");
  const [urgMedecin, setUrgMedecin] = useState("");

  // Force re-renders for elapsed stopwatch waiting timers
  const [, setTick] = useState(0);
  const [selectedUrgence, setSelectedUrgence] = useState<PatientUrgence | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000); // refresh elapsed minutes every 15s
    return () => clearInterval(timer);
  }, []);

  const handleAddEmergency = () => {
    if (!urgPatient.trim() || !urgPlainte.trim()) {
      alert("Veuillez saisir le nom du patient et le motif/plainte d'urgence.");
      return;
    }

    const newUrg: PatientUrgence = {
      id: generateUid(),
      patient: urgPatient.trim(),
      contact: urgContact.trim(),
      severite: urgSeverite,
      plainte: urgPlainte.trim(),
      constantes: urgConstantes.trim(),
      medecinId: urgMedecin,
      dateArrivee: getTodayStr(),
      heureArrivee: new Date().toTimeString().slice(0, 5),
      statut: "En attente de médecin",
      createdAt: new Date().toISOString()
    };

    onUpdateUrgences([newUrg, ...urgences]);
    setUrgPatient("");
    setUrgContact("");
    setUrgPlainte("");
    setUrgConstantes("");
    alert("Patient admis en Urgence. Tri effectué.");
  };

  const handleUpdateStatut = (id: string, statut: PatientUrgence["statut"]) => {
    const updated = urgences.map((u) => (u.id === id ? { ...u, statut } : u));
    onUpdateUrgences(updated);
  };

  const handleDeleteUrg = (id: string) => {
    if (confirm("Supprimer ce dossier d'urgence ?")) {
      onUpdateUrgences(urgences.filter((u) => u.id !== id));
    }
  };

  const handleDownloadPDF = (urg: PatientUrgence) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const doctorName = staff.find((s) => s.id === urg.medecinId)?.nom || "Médecin de Garde";

    const margin = 15;
    const pageHeight = 297;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);

    const primaryColor = [225, 29, 72]; 
    const secondaryColor = [30, 41, 59];
    const lightBgColor = [254, 242, 242]; 
    const borderGray = [224, 224, 224];
    const darkGray = [100, 116, 139];

    let y = 20;

    const drawSectionHeader = (title: string) => {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(title.toUpperCase(), margin, y);
      y += 1.5;
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;
    };

    // Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CABINET MÉDICAL DEO-GRACIAS", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("BOBO-DIOULASSO, BURKINA FASO — TÉL: +226 44 92 01 62 — SERVICE DES URGENCES CLINIQUES", pageWidth / 2, y, { align: "center" });
    y += 4;

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + contentWidth, y);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 1, margin + contentWidth, y + 1);
    y += 8;

    // Document Title Banner
    doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
    doc.rect(margin, y, contentWidth, 10, "F");
    doc.setDrawColor(254, 202, 202);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 10, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("FICHE D'ADMISSION & BILLET DE TRI D'URGENCE", pageWidth / 2, y + 6.5, { align: "center" });
    y += 16;

    // 1. Informations Patient
    drawSectionHeader("1. Informations Patient & Enregistrement");

    const infoGrid = [
      { k: "Patient admis :", v: urg.patient, k2: "Date d'Admission :", v2: `${new Date(urg.dateArrivee).toLocaleDateString("fr-FR")} à ${urg.heureArrivee}` },
      { k: "Tuteur / Contact :", v: urg.contact || "—", k2: "Garde Assignée :", v2: doctorName },
      { k: "ID Urgence :", v: `#${urg.id.slice(0, 8).toUpperCase()}`, k2: "Statut Actuel :", v2: urg.statut }
    ];

    doc.setFontSize(9);
    infoGrid.forEach((row) => {
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(row.k, margin, y);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(row.v, margin + 35, y);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(row.k2, margin + 105, y);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(row.v2, margin + 135, y);

      y += 6;
    });
    y += 4;

    // 2. Triage Level
    drawSectionHeader("2. Niveau de Gravité & Triage");
    
    doc.setFillColor(255, 251, 235); 
    doc.rect(margin, y, contentWidth, 12, "F");
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.35);
    doc.rect(margin, y, contentWidth, 12, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(180, 83, 9);
    doc.text("ÉCHELLE DE SEVÉRITÉ ET DE TRI :", margin + 3, y + 5);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(urg.severite, margin + 3, y + 9.5);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("Temps d'attente à l'admission :", margin + 120, y + 5);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(getElapsedMinutesDisplay(urg.createdAt), margin + 120, y + 9.5);

    y += 18;

    // 3. Motif & Constantes
    drawSectionHeader("3. Motifs Cliniques d'Admission");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("DESCRIPTION DES SYMPTÔMES / PLAINTES :", margin, y);
    y += 4.5;

    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const wrappedPlainte = doc.splitTextToSize(`"${urg.plainte}"`, contentWidth - 4);
    wrappedPlainte.forEach((line: string) => {
      doc.text(line, margin + 2, y);
      y += 4.5;
    });
    y += 4;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("CONSTANTES VITALES RELEVÉES :", margin, y);
    y += 4.5;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const wrappedConst = doc.splitTextToSize(urg.constantes || "Aucune constante enregistrée", contentWidth - 4);
    wrappedConst.forEach((line: string) => {
      doc.text(line, margin + 2, y);
      y += 4.5;
    });
    y += 15;

    // Footer
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 25;
    }

    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("BILLET IMPRIMÉ LE :", margin, y);
    doc.setFont("Helvetica", "normal");
    doc.text(new Date().toLocaleString("fr-FR"), margin + 45, y);

    const sigX = margin + 115;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("Médecin de Garde Référent", sigX, y);
    
    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(8.5);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(doctorName, sigX, y + 4.5);

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
    doc.rect(sigX, y + 7.5, contentWidth - 115, 12, "F");
    doc.rect(sigX, y + 7.5, contentWidth - 115, 12, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CACHET & SIGNATURE URGENCES", sigX + 2, y + 15.5);

    doc.save(`billet_urgences_${urg.patient.toLowerCase().replace(/\s+/g, "_")}.pdf`);
  };

  // Elapsed minute calculator
  const getElapsedMinutesDisplay = (createdAtStr: string): string => {
    const start = new Date(createdAtStr);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - start.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  // Calculations
  const activeQueue = urgences.filter((u) => {
    const isNotSorti = u.statut !== "Sorti(e) ou Libéré(e)";
    if (!filterPatientQuery) return isNotSorti;
    const query = filterPatientQuery.toLowerCase().trim();
    return u.patient.toLowerCase().includes(query) || 
           u.id.toLowerCase().includes(query) || 
           (u.contact && u.contact.includes(query));
  });
  const redCount = activeQueue.filter((u) => u.severite === "Urgence Vitale (Rouge)").length;
  const orangeCount = activeQueue.filter((u) => u.severite === "Très Urgent (Orange)").length;
  const totalWaiting = activeQueue.filter((u) => u.statut === "En attente de médecin").length;
  const averageWaitTimeMins = 20; // Simulated indicator based on stats

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{activeQueue.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Urgences actives</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Présents au cabinet</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{redCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Urgence Vitale</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🔴 Tri 1 - Immédiat</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-orange-500">
          <div className="text-3xl font-semibold text-orange-600 font-serif">{orangeCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Très Urgent</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🟠 Tri 2 - &lt; 15 min</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{totalWaiting}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Attente médecin</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">En cours de tri</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{averageWaitTimeMins} min</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Attente Moyenne</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Indicateur qualité</div>
        </div>
      </div>

      {/* Extreme priority alert box */}
      {redCount > 0 && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-xl text-xs font-bold flex items-center gap-3 shadow-2xs animate-pulse">
          <ShieldAlert className="w-5 h-5 text-danger-600 flex-shrink-0" />
          <div>
            <strong>ALERTE ROUGE :</strong> Vous avez actuellement <strong>{redCount} patient(s) en état d'Urgence Vitale absolue</strong>. Réanimation requise en urgence. Un médecin doit intervenir immédiatement.
          </div>
        </div>
      )}

      {filterPatientQuery && (
        <div className="bg-primary-50 border border-primary-200 text-primary-800 p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-3xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse"></span>
            <span>Filtre de recherche global actif aux urgences : <strong>"{filterPatientQuery}"</strong></span>
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400 font-normal italic">Saisie dans le moteur global</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Arrival Triage admission Form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Admettre un Patient aux Urgences (Tri)
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Patient en détresse *</label>
              <input
                type="text"
                placeholder="Nom complet"
                value={urgPatient}
                onChange={(e) => setUrgPatient(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Numéro d'urgence tuteur / Famille</label>
              <input
                type="tel"
                placeholder="+226..."
                value={urgContact}
                onChange={(e) => setUrgContact(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Échelle de Triage / Sévérité *</label>
              <select
                value={urgSeverite}
                onChange={(e) => setUrgSeverite(e.target.value as any)}
                className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
              >
                <option value="Urgence Vitale (Rouge)" className="text-danger-700 font-bold">🔴 URGENCE VITALE (Rouge) — Immédiat</option>
                <option value="Très Urgent (Orange)" className="text-orange-600 font-bold">🟠 TRÈS URGENT (Orange) — &lt; 15 min</option>
                <option value="Urgent (Jaune)" className="text-warning-600 font-bold">🟡 URGENT (Jaune) — &lt; 60 min</option>
                <option value="Non Urgent (Vert)" className="text-success-600 font-bold">🟢 NON URGENT (Vert) — &lt; 120 min</option>
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Médecin Référent de Garde</label>
              <select
                value={urgMedecin}
                onChange={(e) => setUrgMedecin(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              >
                <option value="">— Médecin de garde —</option>
                {staff
                  .filter((s) => s.poste === "Médecin")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Plainte principale / Symptômes d'urgence *</label>
              <textarea
                placeholder="Ex: Douleur thoracique intense, dyspnée ou convulsions..."
                value={urgPlainte}
                onChange={(e) => setUrgPlainte(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-20 resize-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Constantes vitales (TA, Pouls, T°C, SpO2)</label>
              <input
                type="text"
                placeholder="Ex: TA=11/7, T°C=39.5, Pouls=110, SpO2=94%"
                value={urgConstantes}
                onChange={(e) => setUrgConstantes(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>

            <button
              type="button"
              onClick={handleAddEmergency}
              className="w-full text-xs font-bold py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-all mt-2 flex items-center justify-center gap-1.5"
            >
              <HeartHandshake className="w-4 h-4 text-danger-200" /> Admettre aux Urgences
            </button>
          </div>
        </div>

        {/* Live Active Urgency board */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-700 animate-spin-slow" />
            Tableau Clinique de Garde des Urgences Actives
          </h3>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse bg-stone-100 dark:bg-stone-800 rounded-xl p-4 h-28 border border-stone-200 dark:border-stone-700"></div>
              ))}
            </div>
          ) : activeQueue.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun malade aux urgences actuellement.</p>
          ) : (
            <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
              {activeQueue
                .sort((a, b) => {
                  const sVal = {
                    "Urgence Vitale (Rouge)": 1,
                    "Très Urgent (Orange)": 2,
                    "Urgent (Jaune)": 3,
                    "Non Urgent (Vert)": 4
                  };
                  return (sVal[a.severite] || 5) - (sVal[b.severite] || 5);
                })
                .map((u) => {
                  const mName = staff.find((s) => s.id === u.medecinId)?.nom || "Garde générale";
                  const colorMap = {
                    "Urgence Vitale (Rouge)": "border-l-danger-600 bg-danger-50/50 text-danger-900",
                    "Très Urgent (Orange)": "border-l-orange-500 bg-orange-50/30 text-orange-900",
                    "Urgent (Jaune)": "border-l-warning-500 bg-warning-50/30 text-warning-900",
                    "Non Urgent (Vert)": "border-l-success-500 bg-success-50/30 text-success-900"
                  };
                  const colorClass = colorMap[u.severite] || "border-l-stone-300";

                  return (
                    <div
                      key={u.id}
                      className={`border-l-4 rounded-xl p-4 border border-stone-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all shadow-2xs hover:shadow-xs ${colorClass}`}
                    >
                      <div className="space-y-1 w-full md:w-3/4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{u.patient}</span>
                          <span className="text-xs font-semibold uppercase bg-stone-200 text-stone-800 px-2 py-0.5 rounded-full">
                            {u.severite.split(" ")[0]}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-stone-800">
                          Plainte : <span className="font-semibold italic">"{u.plainte}"</span>
                        </div>
                        {u.constantes && (
                          <div className="text-xs font-semibold text-stone-600 font-mono">
                            Constantes : {u.constantes}
                          </div>
                        )}
                        <div className="text-xs text-stone-500 font-semibold flex flex-wrap items-center gap-2 pt-1">
                          <span>🚪 Arrivée : <strong>{u.heureArrivee}</strong></span>
                          <span>👨‍⚕️ Médecin : <strong>{mName}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        {/* Live Waiting stopwatch timer clock */}
                        <div className="flex items-center gap-1 bg-stone-100 text-stone-800 text-sm font-bold px-2 py-1 rounded-lg border border-stone-200">
                          <Clock className="w-3.5 h-3.5 text-danger-600" />
                          <span>Wait: {getElapsedMinutesDisplay(u.createdAt)}</span>
                        </div>

                        <select
                          value={u.statut}
                          onChange={(e) => handleUpdateStatut(u.id, e.target.value as any)}
                          className="border border-stone-200 rounded-lg p-1 bg-white text-stone-700 text-xs font-bold focus:outline-none"
                        >
                          <option value="En attente de médecin">Attente doc</option>
                          <option value="Examen clinique en cours">Exam en cours</option>
                          <option value="Sous surveillance infirmière">Sous obs</option>
                          <option value="Sorti(e) ou Libéré(e)">Libéré / Sorti</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setSelectedUrgence(u)}
                          className="bg-primary-50 hover:bg-primary-100 text-primary-700 text-sm font-bold px-2 py-1 rounded-lg border border-primary-200 transition-all flex items-center gap-1"
                          title="Consulter et Imprimer la Fiche"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Fiche</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteUrg(u.id)}
                          className="text-stone-300 hover:text-danger-600 transition-all p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Emergency Detail Modal (Printable) */}
      {selectedUrgence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print">
          <div className={`w-full max-w-3xl rounded-2xl shadow-xl border overflow-hidden max-h-[90vh] flex flex-col ${
            theme === "dark" ? "bg-stone-900 border-stone-800 text-stone-100" : "bg-white border-stone-200 text-stone-800"
          }`}>
            {/* Modal Header */}
            <div className={`p-4 border-b flex justify-between items-center no-print ${
              theme === "dark" ? "border-stone-800" : "border-stone-100"
            }`}>
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-danger-600" />
                <h3 className="font-serif font-bold text-base">Fiche de Tri & Billet d'Urgence</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPDF(selectedUrgence)}
                  className="bg-success-600 hover:bg-success-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Télécharger le PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-danger-600 hover:bg-danger-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer le dossier
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedUrgence(null)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
            </div>

            {/* Modal Content / Printable Document */}
            <div className="flex-1 overflow-y-auto p-8 print-full-width print:p-0 print:overflow-visible">
              <div className="print-card space-y-8">
                {/* Header for print */}
                <div className="border-b-4 border-double border-danger-600 pb-4 text-center">
                  <h1 className="text-2xl font-serif font-semibold text-danger-700 uppercase tracking-wide">{profile.name}</h1>
                  <p className="text-xs font-mono uppercase tracking-widest text-stone-500 mt-1">{profile.address} — Tél/WhatsApp: {profile.phone} — {profile.slogan}</p>
                  <div className="mt-4 bg-danger-50 text-danger-800 py-1.5 px-4 rounded-full font-serif font-bold text-sm tracking-wide inline-block border border-danger-100">
                    FICHE D'ADMISSION & BILLET DE TRI D'URGENCE
                  </div>
                </div>

                {/* Admission Metadata */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-danger-800 border-b pb-1 mb-3">1. Informations Patient & Enregistrement</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Patient admis :</span>
                      <p className={`font-semibold text-sm mt-0.5 ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedUrgence.patient}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Tuteur / Contact d'Urgence :</span>
                      <p className={`font-mono font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedUrgence.contact || "—"}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Date d'Admission :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{new Date(selectedUrgence.dateArrivee).toLocaleDateString("fr-FR")} à {selectedUrgence.heureArrivee}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Médecin de Garde assigné :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>
                        {staff.find((s) => s.id === selectedUrgence.medecinId)?.nom || "Garde Générale"}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Identifiant Urgence :</span>
                      <p className="font-mono font-bold mt-0.5 text-stone-500">#{selectedUrgence.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Statut Clinique Actuel :</span>
                      <p className={`font-semibold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedUrgence.statut}</p>
                    </div>
                  </div>
                </div>

                {/* Triage Scale Section */}
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  selectedUrgence.severite.includes("Rouge")
                    ? "bg-danger-50/50 border-danger-200 text-danger-900"
                    : selectedUrgence.severite.includes("Orange")
                    ? "bg-orange-50/50 border-orange-200 text-orange-900"
                    : selectedUrgence.severite.includes("Jaune")
                    ? "bg-warning-50/50 border-warning-200 text-warning-900"
                    : "bg-success-50/50 border-success-200 text-success-900"
                }`}>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-danger-800">2. Échelle de Gravité et Niveau de Triage</h3>
                    <p className="text-sm font-semibold mt-1">{selectedUrgence.severite}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase block text-stone-450">Temps d'Attente Clinique :</span>
                    <span className="text-sm font-mono font-semibold text-danger-600">
                      {getElapsedMinutesDisplay(selectedUrgence.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Clinical Notes */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-danger-800 border-b pb-1 mb-3">3. Motif principal d'admission & Constantes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-4 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-xs font-bold text-stone-450 uppercase block mb-1">Description des Symptômes / Plainte</span>
                      <p className="text-xs italic text-stone-700 font-semibold">"{selectedUrgence.plainte}"</p>
                    </div>
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-4 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-xs font-bold text-stone-450 uppercase block mb-1">Constantes Vitales relevées</span>
                      <p className="text-xs font-mono font-bold text-stone-800">{selectedUrgence.constantes || "Aucune constante enregistrée"}</p>
                    </div>
                  </div>
                </div>

                {/* Footnotes & Signatures */}
                <div className="pt-8 border-t border-dashed border-stone-200 flex justify-between text-xs">
                  <div>
                    <p className="font-bold text-stone-450 uppercase text-2xs">Généré le :</p>
                    <p className="font-mono text-stone-500">{new Date().toLocaleString("fr-FR")}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${theme === "dark" ? "text-white" : "text-stone-800"}`}>Médecin de Garde Référent</p>
                    <p className="text-stone-500 italic mt-0.5">
                      {staff.find((s) => s.id === selectedUrgence.medecinId)?.nom || "Médecin Clinique de Triage"}
                    </p>
                    <div className="mt-4 border border-dashed border-danger-500 text-danger-600 inline-block px-4 py-2 rounded-lg font-bold uppercase text-2xs">
                      Cachet & Signature Urgences
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
