/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Consultation, Staff } from "../types";
import { generateUid, getTodayStr, safeGet, safeSet } from "../data";
import { Activity, ShieldAlert, CheckCircle, RefreshCw, Filter, Plus, Trash2, Users, AlertTriangle, Printer, FileDown } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { jsPDF } from "jspdf";

// Helper function to map a diagnosis string to a standard medical category
const mapToCategory = (diagnostic: string): string => {
  const diag = (diagnostic || "").toLowerCase().trim();
  if (!diag) return "Non spécifié";
  if (diag.includes("palud") || diag.includes("malaria") || diag.includes("mousti")) return "Paludisme / Parasitologie";
  if (diag.includes("pneumo") || diag.includes("bronch") || diag.includes("toux") || diag.includes("rhume") || diag.includes("grippe") || diag.includes("respiratoire") || diag.includes("angine")) return "Infections Respiratoires";
  if (diag.includes("gastro") || diag.includes("diarrh") || diag.includes("vomis") || diag.includes("coliqu") || diag.includes("intestin") || diag.includes("typh")) return "Gastro-entérologie";
  if (diag.includes("tension") || diag.includes("hta") || diag.includes("hyperten") || diag.includes("cardia") || diag.includes("coeur")) return "Cardio-vasculaire";
  if (diag.includes("infect") || diag.includes("uro") || diag.includes("vagin") || diag.includes("salping") || diag.includes("chlamyd") || diag.includes("urinaire")) return "Infections Urogénitales";
  if (diag.includes("anem") || diag.includes("fer") || diag.includes("sang")) return "Hématologie";
  if (diag.includes("diab") || diag.includes("glycem") || diag.includes("sucre")) return "Endocrinologie / Métabolisme";
  if (diag.includes("dermat") || diag.includes("peau") || diag.includes("prurit") || diag.includes("mycose") || diag.includes("eczema") || diag.includes("abcès")) return "Dermatologie";
  if (diag.includes("trauma") || diag.includes("fract") || diag.includes("plaie") || diag.includes("brulure") || diag.includes("chute") || diag.includes("accident")) return "Traumatologie / Chirurgie";
  if (diag.includes("grossesse") || diag.includes("prenatal") || diag.includes("matern") || diag.includes("accouch")) return "Gynécologie / Obstétrique";
  return "Autres pathologies";
};

const COLORS = [
  "#0f766e", // teal-700
  "#be123c", // rose-700
  "#b45309", // amber-700
  "#1d4ed8", // blue-700
  "#6d28d9", // violet-700
  "#047857", // emerald-700
  "#c2410c", // orange-700
  "#4338ca", // indigo-700
  "#a21caf", // fuchsia-700
  "#7c2d12", // red-800
];

interface TabIndicateursProps {
  consultations: Consultation[];
  staff: Staff[];
}

export default function TabIndicateurs({ consultations, staff }: TabIndicateursProps) {
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

  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">("all");
  const [manualEntries, setManualEntries] = useState<any[]>(() => safeGet("dg_indicateurs_manuels", []));

  // Manual form states
  const [manDate, setManDate] = useState(getTodayStr());
  const [manMaladie, setManMaladie] = useState("");
  const [manCas, setManCas] = useState("1");
  const [manSexe, setManSexe] = useState<"M" | "F" | "M/F">("M");
  const [manAge, setManAge] = useState("0–5 ans");
  const [manGravite, setManGravite] = useState("Légère");

  const handleAddManuel = () => {
    if (!manMaladie.trim()) {
      alert("Veuillez saisir le nom de la maladie.");
      return;
    }

    const newEntry = {
      id: generateUid(),
      date: manDate,
      maladie: manMaladie,
      cas: manCas,
      sexe: manSexe,
      age: manAge,
      gravite: manGravite
    };

    const updated = [newEntry, ...manualEntries];
    setManualEntries(updated);
    safeSet("dg_indicateurs_manuels", updated);
    setManMaladie("");
    setManCas("1");
  };

  const handleDeleteManuel = (id: string) => {
    const updated = manualEntries.filter((m) => m.id !== id);
    setManualEntries(updated);
    safeSet("dg_indicateurs_manuels", updated);
  };

  // Filter consultations based on selected period
  const getFilteredConsultations = (): Consultation[] => {
    const now = new Date();
    return consultations.filter((c) => {
      if (period === "all") return true;
      const cDateStr = c.date || getTodayStr();
      if (period === "today") return cDateStr === getTodayStr();
      if (period === "week") {
        const cDate = new Date(cDateStr);
        const limitDate = new Date(now.getTime() - 7 * 86400000);
        return cDate >= limitDate;
      }
      if (period === "month") {
        return cDateStr.slice(0, 7) === getTodayStr().slice(0, 7);
      }
      return true;
    });
  };

  const filteredConsults = getFilteredConsultations();

  // KPIs Calculations
  const totalCount = filteredConsults.length;
  const hommesCount = filteredConsults.filter((c) => c.sexe === "Masculin").length;
  const femmesCount = filteredConsults.filter((c) => c.sexe === "Féminin").length;

  const ages = filteredConsults.map((c) => typeof c.age === "number" ? c.age : parseInt(c.age)).filter((a) => !isNaN(a));
  const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;

  const badConditionCount = filteredConsults.filter((c) => {
    const temp = c.vitals ? c.vitals.temperature : parseFloat((c as any).temperature);
    return !isNaN(temp) && (temp > 38.5 || temp < 35.5);
  }).length;

  const activeCliniciansCount = new Set(filteredConsults.map((c) => (c as any).agentNom || staff.find((s) => s.id === c.medecinId)?.nom || "").filter(Boolean)).size;

  // Alerts
  const feverCount = filteredConsults.filter((c) => {
    const t = c.vitals ? c.vitals.temperature : parseFloat((c as any).temperature);
    return !isNaN(t) && t >= 38.5;
  }).length;

  // Process diagnostics from clinical consults and manual logs
  const processDiagnostics = () => {
    const counts: Record<string, { label: string; count: number; h: number; f: number }> = {};

    // 1. From live consultations
    filteredConsults.forEach((c) => {
      if (c.diagnostic) {
        const diagClean = c.diagnostic.trim();
        const key = diagClean.toLowerCase().slice(0, 40);
        if (!counts[key]) {
          counts[key] = { label: diagClean, count: 0, h: 0, f: 0 };
        }
        counts[key].count++;
        if (c.sexe === "Masculin") counts[key].h++;
        if (c.sexe === "Féminin") counts[key].f++;
      }
    });

    // 2. From manual entries
    manualEntries.forEach((m) => {
      const diagClean = m.maladie.trim();
      const key = diagClean.toLowerCase().slice(0, 40);
      const caseCount = parseInt(m.cas) || 1;
      if (!counts[key]) {
        counts[key] = { label: diagClean, count: 0, h: 0, f: 0 };
      }
      counts[key].count += caseCount;
      if (m.sexe === "M") counts[key].h += caseCount;
      else if (m.sexe === "F") counts[key].f += caseCount;
      else {
        counts[key].h += Math.floor(caseCount / 2);
        counts[key].f += Math.ceil(caseCount / 2);
      }
    });

    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 15);
  };

  const topDiags = processDiagnostics();
  const maxDiagCount = topDiags.length > 0 ? Math.max(...topDiags.map((d) => d.count)) : 1;

  // Pie chart equivalents for genders
  const malePercent = totalCount > 0 ? Math.round((hommesCount / totalCount) * 100) : 0;
  const femalePercent = totalCount > 0 ? Math.round((femmesCount / totalCount) * 100) : 0;

  // Temp chart
  const abnormalTempCount = filteredConsults.filter((c) => {
    const t = c.vitals ? c.vitals.temperature : parseFloat((c as any).temperature);
    return !isNaN(t) && (t < 36.0 || t > 38.0);
  }).length;
  const normalTempCount = totalCount - abnormalTempCount;

  // Clinicians distribution
  const cliniciansDist: Record<string, number> = {};
  filteredConsults.forEach((c) => {
    const name = (c as any).agentNom || staff.find((s) => s.id === c.medecinId)?.nom || "Généraliste";
    if (name) {
      cliniciansDist[name] = (cliniciansDist[name] || 0) + 1;
    }
  });

  // Ages categories
  const ageCategories = [
    { label: "0–5 ans", count: ages.filter((a) => a <= 5).length },
    { label: "6–14 ans", count: ages.filter((a) => a > 5 && a <= 14).length },
    { label: "15–24 ans", count: ages.filter((a) => a > 14 && a <= 24).length },
    { label: "25–44 ans", count: ages.filter((a) => a > 24 && a <= 44).length },
    { label: "45–64 ans", count: ages.filter((a) => a > 44 && a <= 64).length },
    { label: "65 ans et +", count: ages.filter((a) => a >= 65).length }
  ];

  // Calculation of current month's diagnoses by category (for Pie Chart)
  const processCurrentMonthCategories = () => {
    const counts: Record<string, number> = {};
    const currentMonthStr = getTodayStr().slice(0, 7); // e.g. "2026-07"

    // 1. From live consultations
    consultations.forEach((c) => {
      const cDateStr = c.date || getTodayStr();
      if (cDateStr.slice(0, 7) === currentMonthStr && c.diagnostic) {
        const cat = mapToCategory(c.diagnostic);
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });

    // 2. From manual entries
    manualEntries.forEach((m) => {
      const mDateStr = m.date || getTodayStr();
      if (mDateStr.slice(0, 7) === currentMonthStr && m.maladie) {
        const cat = mapToCategory(m.maladie);
        const caseCount = parseInt(m.cas) || 1;
        counts[cat] = (counts[cat] || 0) + caseCount;
      }
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };

  const currentMonthCategoriesData = processCurrentMonthCategories();

  // CSV Export handler for consultations of the current month
  const handleExportCSV = () => {
    const currentMonthStr = getTodayStr().slice(0, 7);
    const monthConsults = consultations.filter((c) => {
      const cDateStr = c.date || getTodayStr();
      return cDateStr.slice(0, 7) === currentMonthStr;
    });

    if (monthConsults.length === 0) {
      alert("Aucune donnée de consultation pour le mois en cours à exporter.");
      return;
    }

    // CSV Headers
    const headers = [
      "ID Consultation",
      "Date",
      "Patient",
      "Age",
      "Sexe",
      "Contact",
      "Plainte",
      "Diagnostic",
      "Categorie Pathologique",
      "Temperature (C)",
      "Poids (kg)",
      "Tension Arterielle",
      "Pouls (bpm)",
      "Glycemie (g/L)",
      "Medecin / Praticien",
      "Prescription (Ordonnance)"
    ];

    // CSV Rows
    const rows = monthConsults.map((c) => {
      const medName = staff.find((s) => s.id === c.medecinId)?.nom || "Généraliste";
      const prescriptionText = c.ordonnance
        ? c.ordonnance.map((o) => `${o.medicamentNom} (${o.posologie} - ${o.duree})`).join("; ")
        : "";
      const cat = mapToCategory(c.diagnostic || "");

      return [
        c.id,
        c.date || "",
        c.patient || "",
        c.age || "",
        c.sexe || "",
        c.contact || "",
        `"${(c.plainte || "").replace(/"/g, '""')}"`,
        `"${(c.diagnostic || "").replace(/"/g, '""')}"`,
        `"${cat}"`,
        c.vitals?.temperature || "",
        c.vitals?.poids || "",
        c.vitals?.tensionArterielle || "",
        c.vitals?.pouls || "",
        c.vitals?.glycemie || "",
        `"${medName}"`,
        `"${prescriptionText.replace(/"/g, '""')}"`
      ];
    });

    // Construct CSV String
    const BOM = "\uFEFF";
    const csvContent = BOM + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `consultations_epidemiologiques_${currentMonthStr}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Export for currently filtered medical statistics & activity report
  const handleExportFilteredPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const addHeaderAndFooter = (pageNum: number) => {
      // Top bar decorative block
      doc.setFillColor(15, 118, 110); // teal-700
      doc.rect(0, 0, 210, 10, "F");

      // Header Text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(`${profile.name.toUpperCase()} • RAPPORT DE DIRECTION`, 15, 6.5);

      // Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`${profile.name} — Rapport confidentiel de la Direction`, 15, 287);
      doc.text(`Page ${pageNum}`, 190, 287);
    };

    // PAGE 1
    addHeaderAndFooter(1);

    let y = 22;

    // Cabinet Details & Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39); // dark slate
    doc.text(`${profile.name}`, 15, y);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${profile.address} | Tél: ${profile.phone}`, 15, y + 4.5);
    
    // Period details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    const periodLabel = period === "all" ? "Toute la période" : period === "today" ? "Aujourd'hui" : period === "week" ? "Cette semaine (7 derniers jours)" : "Ce mois-ci";
    doc.text(`RAPPORT DE STATISTIQUES MÉDICALES`, 115, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Période filtrée : ${periodLabel}`, 115, y + 4.5);
    doc.text(`Généré le : ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`, 115, y + 8.5);

    y += 12;
    doc.setDrawColor(220, 220, 220);
    doc.line(15, y, 195, y);

    y += 8;

    // Section 1 Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 118, 110); // teal-700
    doc.text("1. Indicateurs Synthétiques Globaux", 15, y);

    y += 5;

    // KPIs Grid
    // Total Consultations
    doc.setFillColor(245, 245, 240);
    doc.roundedRect(15, y, 55, 20, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("TOTAL CONSULTATIONS", 18, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text(`${totalCount}`, 18, y + 13);

    // Gender breakdown
    doc.setFillColor(245, 245, 240);
    doc.roundedRect(75, y, 55, 20, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("RÉPARTITION PAR GENRE", 78, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(`Hommes : ${hommesCount} (${malePercent}%)`, 78, y + 11);
    doc.text(`Femmes : ${femmesCount} (${femalePercent}%)`, 78, y + 16);

    // Patients age and doctors active
    doc.setFillColor(245, 245, 240);
    doc.roundedRect(135, y, 60, 20, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text("ÂGE MOYEN & CLINICIENS", 138, y + 5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);
    doc.text(`Âge moyen : ${avgAge !== null ? avgAge + " ans" : "N/A"}`, 138, y + 11);
    doc.text(`Praticiens actifs : ${activeCliniciansCount}`, 138, y + 16);

    y += 25;

    // Abnormal Temps and alert status
    doc.setFillColor(254, 242, 242); // soft red
    doc.roundedRect(15, y, 180, 12, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(153, 27, 27); // red-800
    doc.text(`ALERTE DE VIGILANCE MÉDICALE :`, 18, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Températures anormales (<36°C ou >38°C) : ${badConditionCount} cas. Cas de fièvre sévère (>=38.5°C) : ${feverCount} cas.`, 18, y + 9);

    y += 18;

    // Section 2 Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 118, 110); // teal-700
    doc.text("2. Distribution Détaillée des Diagnostics & Pathologies (Top 10)", 15, y);

    y += 5;

    // Table Headers
    doc.setFillColor(15, 118, 110);
    doc.rect(15, y, 180, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Rang", 17, y + 4.5);
    doc.text("Pathologie / Diagnostic", 30, y + 4.5);
    doc.text("Cas Totaux", 110, y + 4.5);
    doc.text("Hommes", 135, y + 4.5);
    doc.text("Femmes", 160, y + 4.5);
    doc.text("Part %", 182, y + 4.5);

    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 50);

    const diagsToPrint = topDiags.slice(0, 10);
    if (diagsToPrint.length === 0) {
      doc.text("Aucun diagnostic enregistré pour cette période.", 20, y + 5);
      y += 10;
    } else {
      diagsToPrint.forEach((d, idx) => {
        // Alternating row colors
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, y, 180, 6, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}`, 17, y + 4.5);
        doc.setFont("helvetica", "normal");
        doc.text(d.label.length > 50 ? d.label.slice(0, 48) + "..." : d.label, 30, y + 4.5);
        doc.setFont("helvetica", "bold");
        doc.text(`${d.count}`, 110, y + 4.5);
        doc.setFont("helvetica", "normal");
        doc.text(`${d.h}`, 135, y + 4.5);
        doc.text(`${d.f}`, 160, y + 4.5);
        
        const pct = totalCount > 0 ? Math.round((d.count / (totalCount + manualEntries.length)) * 100) : 100;
        doc.setFont("helvetica", "bold");
        doc.text(`${pct}%`, 182, y + 4.5);

        y += 6;
      });
    }

    y += 8;

    // Section 3: Demographic Profiling & Clinician Workload (Side-by-side)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 118, 110); // teal-700
    doc.text("3. Profils Démographiques & Activités Cliniciens", 15, y);

    y += 5;

    // Draw side-by-side tables
    // Left: Ages
    doc.setFillColor(248, 250, 252);
    doc.rect(15, y, 85, 42, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(15, y, 85, 42, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text("Tranche d'Âge", 18, y + 5);
    doc.text("Nombre", 85, y + 5, { align: "right" });
    doc.line(15, y + 7, 100, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    let ageY = y + 11;
    ageCategories.forEach((c) => {
      doc.text(c.label, 18, ageY);
      doc.setFont("helvetica", "bold");
      doc.text(`${c.count} cas`, 85, ageY, { align: "right" });
      doc.setFont("helvetica", "normal");
      ageY += 5;
    });

    // Right: Clinician loads
    doc.setFillColor(248, 250, 252);
    doc.rect(110, y, 85, 42, "F");
    doc.rect(110, y, 85, 42, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(17, 24, 39);
    doc.text("Praticien / Clinicien", 113, y + 5);
    doc.text("Consultations", 190, y + 5, { align: "right" });
    doc.line(110, y + 7, 195, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    let clinY = y + 11;
    const clinsToPrint = Object.entries(cliniciansDist).slice(0, 6);
    if (clinsToPrint.length === 0) {
      doc.text("Aucun clinicien documenté.", 113, clinY);
    } else {
      clinsToPrint.forEach(([clin, count]) => {
        doc.text(clin.length > 28 ? clin.slice(0, 26) + "..." : clin, 113, clinY);
        doc.setFont("helvetica", "bold");
        doc.text(`${count} rdv`, 190, clinY, { align: "right" });
        doc.setFont("helvetica", "normal");
        clinY += 5;
      });
    }

    y += 48;

    // Check if we need page break for manual logs & signature block
    const needsPage2 = manualEntries.length > 0 || y > 220;

    if (needsPage2) {
      doc.addPage();
      addHeaderAndFooter(2);
      y = 20;
    }

    if (manualEntries.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 118, 110); // teal-700
      doc.text("4. Surveillance Épidémiologique Manuelle (Registres Consolidés)", 15, y);

      y += 5;

      doc.setFillColor(15, 118, 110);
      doc.rect(15, y, 180, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("Date d'Enregistrement", 18, y + 4.5);
      doc.text("Pathologie Déclarée", 55, y + 4.5);
      doc.text("Nombre de Cas (N)", 130, y + 4.5);
      doc.text("Répartition Genre", 165, y + 4.5);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 50);

      manualEntries.slice(0, 15).forEach((m, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, y, 180, 6, "F");
        }
        doc.text(new Date(m.date).toLocaleDateString("fr-FR"), 18, y + 4.5);
        doc.text(m.maladie.length > 45 ? m.maladie.slice(0, 43) + "..." : m.maladie, 55, y + 4.5);
        doc.setFont("helvetica", "bold");
        doc.text(`${m.cas}`, 130, y + 4.5);
        doc.setFont("helvetica", "normal");
        doc.text(`${m.sexe}`, 165, y + 4.5);

        y += 6;
      });

      y += 8;
    }

    // Closing block
    y = Math.max(y, needsPage2 ? 100 : 190);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y, 195, y);
    
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text("Observations de la Direction :", 15, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("Ce rapport confidentiel compile les indicateurs sanitaires clés pour la gouvernance de la clinique.", 15, y + 5);
    doc.text("La répartition épidémiologique sert à optimiser la pharmacie et le planning du personnel médical.", 15, y + 9);

    // Signature Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(17, 24, 39);
    doc.text("Le Médecin Chef / Responsable Direction", 120, y);
    
    doc.setDrawColor(180, 180, 180);
    doc.line(120, y + 25, 185, y + 25);
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text("(Signature officielle et cachet)", 125, y + 29);

    // Save
    doc.save(`Rapport_Medical_${profile.name.replace(/[^a-zA-Z0-9]/g, "_")}_${periodLabel.replace(/ /g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Excel / CSV Export of filtered medical statistics & activity list
  const handleExportFilteredExcelCSV = () => {
    const periodLabel = period === "all" ? "Toute la période" : period === "today" ? "Aujourd'hui" : period === "week" ? "Cette semaine (7 derniers jours)" : "Ce mois-ci";
    
    // Header Info
    const lines: string[] = [];
    lines.push("RAPPORT D'ACTIVITÉ ET STATISTIQUES MÉDICALES - DIRECTION");
    lines.push(`Établissement,${profile.name} (${profile.address})`);
    lines.push(`Date de Génération,${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}`);
    lines.push(`Période Filtrée,${periodLabel}`);
    lines.push("");

    // Section 1: KPIs
    lines.push("1. INDICATEURS OPÉRATIONNELS GLOBAUX");
    lines.push("Indicateur,Valeur,Détails / Proportion");
    lines.push(`Total Consultations Médicales,${totalCount},Dossiers numériques sur la période`);
    lines.push(`Consultations Hommes,${hommesCount},${malePercent}% du total`);
    lines.push(`Consultations Femmes,${femmesCount},${femalePercent}% du total`);
    lines.push(`Âge Moyen des Patients,${avgAge !== null ? avgAge + " ans" : "N/A"},Moyenne sur la période`);
    lines.push(`Températures Anormales (<36°C ou >38°C),${badConditionCount},Cas nécessitant une attention`);
    lines.push(`Cas de Forte Fièvre (>=38.5°C),${feverCount},Indicateur épidémiologique`);
    lines.push(`Praticiens Actifs,${activeCliniciansCount},Personnel médical en consultation`);
    lines.push(`Enregistrements Manuels Consolidés,${manualEntries.length},Saisies directes (papier)`);
    lines.push("");

    // Section 2: Top Pathologies
    lines.push("2. CLASSIFICATION DES PATHOLOGIES ET DIAGNOSTICS (TOP 15)");
    lines.push("Rang,Pathologie / Diagnostic,Nombre de cas,Cas Masculins (M),Cas Féminins (F),Proportion (%)");
    topDiags.forEach((d, idx) => {
      const pct = totalCount > 0 ? Math.round((d.count / (totalCount + manualEntries.length)) * 100) : 100;
      lines.push(`${idx + 1},"${d.label.replace(/"/g, '""')}",${d.count},${d.h},${d.f},${pct}%`);
    });
    lines.push("");

    // Section 3: Age Groups
    lines.push("3. RÉPARTITION DES TRANCHES D'ÂGE");
    lines.push("Tranche d'Âge,Nombre de Cas");
    ageCategories.forEach((c) => {
      lines.push(`${c.label},${c.count} cas`);
    });
    lines.push("");

    // Section 4: Clinicians Load
    lines.push("4. CHARGE OPÉRATIONNELLE PAR CLINICIEN");
    lines.push("Praticien / Clinicien,Nombre de Consultations Réalisées");
    Object.entries(cliniciansDist).forEach(([clin, count]) => {
      lines.push(`"${clin.replace(/"/g, '""')}",${count} rdv`);
    });
    lines.push("");

    // Section 5: Filtered Consultations Detail List
    lines.push("5. LISTE DÉTAILLÉE DES CONSULTATIONS SUR LA PÉRIODE");
    lines.push(
      "ID Consultation,Date,Patient,Âge,Sexe,Contact,Plainte,Diagnostic,Catégorie Pathologique,Température (C),Poids (kg),Tension Artérielle,Pouls (bpm),Glycémie (g/L),Praticien,Prescription (Ordonnance)"
    );
    filteredConsults.forEach((c) => {
      const medName = staff.find((s) => s.id === c.medecinId)?.nom || "Généraliste";
      const prescriptionText = c.ordonnance
        ? c.ordonnance.map((o) => `${o.medicamentNom} (${o.posologie} - ${o.duree})`).join("; ")
        : "";
      const cat = mapToCategory(c.diagnostic || "");

      lines.push([
        c.id,
        c.date || "",
        c.patient || "",
        c.age || "",
        c.sexe || "",
        c.contact || "",
        `"${(c.plainte || "").replace(/"/g, '""')}"`,
        `"${(c.diagnostic || "").replace(/"/g, '""')}"`,
        `"${cat}"`,
        c.vitals?.temperature || "",
        c.vitals?.poids || "",
        c.vitals?.tensionArterielle || "",
        c.vitals?.pouls || "",
        c.vitals?.glycemie || "",
        `"${medName.replace(/"/g, '""')}"`,
        `"${prescriptionText.replace(/"/g, '""')}"`
      ].join(","));
    });

    // Manual entries if any
    if (manualEntries.length > 0) {
      lines.push("");
      lines.push("6. ENREGISTREMENTS MANUELS CONSOLIDÉS (PAPIER)");
      lines.push("Date,Pathologie,Cas (N),Sexe");
      manualEntries.forEach((m) => {
        lines.push(`${m.date},"${m.maladie.replace(/"/g, '""')}",${m.cas},${m.sexe}`);
      });
    }

    // Construct CSV String
    const BOM = "\uFEFF";
    const csvContent = BOM + lines.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `rapport_statistiques_medicales_${periodLabel.replace(/ /g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-stone-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary-700" />
            <span className="text-sm font-bold text-stone-800">Filtrer l'analyse :</span>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="text-xs font-semibold bg-stone-50 border border-stone-200 text-stone-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-600"
          >
            <option value="all">Toute la période</option>
            <option value="today">Aujourd'hui uniquement</option>
            <option value="week">Cette semaine (7j)</option>
            <option value="month">Ce mois-ci</option>
          </select>

          {/* PDF Report Export Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 text-xs font-black bg-stone-700 hover:bg-stone-800 text-white rounded-lg px-4 py-2 border border-stone-800 shadow-3xs hover:shadow-2xs transition-all cursor-pointer"
            title="Ouvrir l'interface d'impression pour générer un PDF avec mise en page papier"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer le Rapport (PDF)</span>
          </button>

          {/* PDF Direct download Button */}
          <button
            type="button"
            onClick={handleExportFilteredPDF}
            className="flex items-center gap-2 text-xs font-black bg-primary-600 hover:bg-primary-700 text-white rounded-lg px-4 py-2 border border-primary-700 shadow-3xs hover:shadow-2xs transition-all cursor-pointer"
            title="Télécharger directement le rapport d'activité filtré au format PDF"
          >
            <FileDown className="w-4 h-4" />
            <span>Télécharger Rapport (PDF Direct)</span>
          </button>

          {/* Excel Filtered Export Button */}
          <button
            type="button"
            onClick={handleExportFilteredExcelCSV}
            className="flex items-center gap-2 text-xs font-black bg-success-600 hover:bg-success-700 text-white rounded-lg px-4 py-2 border border-success-700 shadow-3xs hover:shadow-2xs transition-all cursor-pointer"
            title="Exporter l'analyse complète (indicateurs, pathologies, liste détaillée) au format Excel/CSV"
          >
            <FileDown className="w-4 h-4" />
            <span>Exporter Statistiques & Données (Excel/CSV)</span>
          </button>
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400 font-medium flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 animate-spin" />
          Mise à jour en temps réel des dossiers patients
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{totalCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Consultations</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Période filtrée</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{hommesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Hommes</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{malePercent}% du total</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{femmesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Femmes</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">{femalePercent}% du total</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{avgAge !== null ? `${avgAge} ans` : "—"}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Âge moyen</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Moyenne calculée</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-orange-600">
          <div className="text-3xl font-semibold text-orange-700 font-serif">{badConditionCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Temp. anormales</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">&lt;36°C ou &gt;38°C</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-purple-600">
          <div className="text-3xl font-semibold text-purple-700 font-serif">{activeCliniciansCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Praticiens actifs</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Effectif en consultation</div>
        </div>
      </div>

      {/* Epid Alerts */}
      {feverCount > 3 && (
        <div className="bg-danger-50 border border-danger-200 rounded-2xl p-4 flex items-center gap-3 text-danger-700 text-xs font-bold shadow-2xs">
          <AlertTriangle className="w-5 h-5 text-danger-600 flex-shrink-0" />
          <div>
            Alerte Épidémiologique : {feverCount} cas de forte fièvre (≥38.5°C) recensés sur la période de filtrage. Vigilance
            accrue recommandée (Paludisme, Dengue ou autres syndromes infectieux).
          </div>
        </div>
      )}

      {totalCount === 0 && manualEntries.length === 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 flex items-center gap-3 text-primary-800 text-xs font-bold shadow-2xs">
          <CheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0" />
          Aucun patient enregistré ou indicateur saisi pour cette période.
        </div>
      )}

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Diagnostics Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-danger-600" />
            Top 15 — Diagnostics et Pathologies Fréquents
          </h3>
          {topDiags.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">
              Aucune donnée de diagnostic disponible pour la période sélectionnée.
            </p>
          ) : (
            <div className="space-y-4">
              {topDiags.map((d, index) => {
                const widthPercent = Math.round((d.count / maxDiagCount) * 100);
                const colors = ["bg-primary-600", "bg-danger-600", "bg-warning-600", "bg-blue-600", "bg-purple-600"];
                const color = colors[index % colors.length];
                return (
                  <div key={d.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                      <span className="truncate max-w-[280px]" title={d.label}>
                        {d.label}
                      </span>
                      <span className="font-mono bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded-lg">
                        {d.count} cas (H:{d.h} | F:{d.f})
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${widthPercent}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie Chart of Diagnostics Categories (Current Month) */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-600" />
              Répartition des Diagnostics par Catégorie (Mois en Cours)
            </h3>
            {currentMonthCategoriesData.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 py-24 text-center italic">
                Aucune donnée catégorisée disponible pour le mois en cours.
              </p>
            ) : (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currentMonthCategoriesData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {currentMonthCategoriesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} cas`, name]}
                      contentStyle={{
                        backgroundColor: "#f5f5f4",
                        border: "1px solid #d6d3d1",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontFamily: "Inter, sans-serif"
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={50}
                      iconType="circle"
                      iconSize={6}
                      wrapperStyle={{
                        fontSize: "10px",
                        fontFamily: "Inter, sans-serif",
                        lineHeight: "14px"
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {currentMonthCategoriesData.length > 0 && (
            <div className="mt-4 pt-3 border-t border-stone-100 text-center">
              <span className="text-xs font-mono text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
                Total : {currentMonthCategoriesData.reduce((sum, item) => sum + item.value, 0)} cas classifiés ce mois-ci
              </span>
            </div>
          )}
        </div>

        {/* Demographics Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6 lg:col-span-2">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-1 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            Répartition des Tranches d'Âge et Paramètres Physiques
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Age Distribution Chart */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-warning-800">Par Tranche d'Âge</h4>
              {ages.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-4">Aucune donnée d'âge renseignée.</p>
              ) : (
                <div className="space-y-3">
                  {ageCategories.map((c) => {
                    const maxAgeCount = Math.max(...ageCategories.map((item) => item.count), 1);
                    const w = Math.round((c.count / maxAgeCount) * 100);
                    return (
                      <div key={c.label} className="flex items-center justify-between text-xs gap-3">
                        <span className="w-24 font-medium text-stone-600 text-right">{c.label}</span>
                        <div className="flex-1 bg-stone-100 h-2 rounded-full overflow-hidden">
                          <div className="h-full bg-primary-600 rounded-full" style={{ width: `${w}%` }}></div>
                        </div>
                        <span className="w-12 font-mono text-stone-500 font-bold text-left">{c.count} cas</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Clinicians load */}
            <div className="space-y-3 md:border-l md:border-stone-100 md:pl-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-warning-800">Charge par Clinicien</h4>
              {Object.keys(cliniciansDist).length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-4">Aucun clinicien documenté sur cette période.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(cliniciansDist).map(([clin, count]) => {
                    const maxClinCount = Math.max(...Object.values(cliniciansDist), 1);
                    const w = Math.round((count / maxClinCount) * 100);
                    return (
                      <div key={clin} className="flex items-center justify-between text-xs gap-3">
                        <span className="w-28 font-medium text-stone-600 truncate text-right">{clin}</span>
                        <div className="flex-1 bg-stone-100 h-2 rounded-full overflow-hidden">
                          <div className="h-full bg-warning-500 rounded-full" style={{ width: `${w}%` }}></div>
                        </div>
                        <span className="w-12 font-mono text-stone-500 font-bold text-left">{count} rdv</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table grid of diseases */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-600" />
          Tableau Récapitulatif des Maladies
        </h3>
        {topDiags.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun cas diagnostiqué.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3">Pathologie / Diagnostic</th>
                  <th className="p-3 text-center">Cas Total</th>
                  <th className="p-3 text-center">Hommes (M)</th>
                  <th className="p-3 text-center">Femmes (F)</th>
                  <th className="p-3 text-center">Pourcentage</th>
                  <th className="p-3">Répartition visuelle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {topDiags.map((d, index) => {
                  const percent = totalCount > 0 ? Math.round((d.count / (totalCount + manualEntries.length)) * 100) : 100;
                  return (
                    <tr key={d.label} className="hover:bg-stone-50/50">
                      <td className="p-3 text-center text-stone-500 dark:text-stone-400 font-bold font-mono">{index + 1}</td>
                      <td className="p-3 font-semibold text-stone-800">{d.label}</td>
                      <td className="p-3 text-center font-bold text-stone-950 font-mono">{d.count}</td>
                      <td className="p-3 text-center text-stone-600 font-mono">{d.h}</td>
                      <td className="p-3 text-center text-stone-600 font-mono">{d.f}</td>
                      <td className="p-3 text-center font-bold text-stone-600 font-mono">{percent}%</td>
                      <td className="p-3">
                        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden max-w-[120px]">
                          <div className="h-full bg-primary-600 rounded-full" style={{ width: `${percent}%` }}></div>
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

      {/* Saisie Manuelle section */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-warning-600" />
          Saisie Manuelle d'Indicateurs Épidémiologiques (Hors consultations numériques)
        </h3>
        <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
          Permet de saisir des données consolidées issues de registres papier du cabinet (Maternité, Vaccination, Urgences papier).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end bg-stone-50 p-4 rounded-xl border border-stone-100">
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date</label>
            <input
              type="date"
              value={manDate}
              onChange={(e) => setManDate(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom de la pathologie</label>
            <input
              type="text"
              placeholder="Ex: Diarrhée aiguë à rotavirus"
              value={manMaladie}
              onChange={(e) => setManMaladie(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
          </div>
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nombre de cas</label>
            <input
              type="number"
              min="1"
              value={manCas}
              placeholder="Ex: 3"
              onChange={(e) => setManCas(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
          </div>
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sexe</label>
            <select
              value={manSexe}
              onChange={(e) => setManSexe(e.target.value as any)}
              className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none"
            >
              <option value="M">Masculin (M)</option>
              <option value="F">Féminin (F)</option>
              <option value="M/F">Mixte / Les deux</option>
            </select>
          </div>
          <div>
            <button
              type="button"
              onClick={handleAddManuel}
              className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all"
            >
              Enregistrer
            </button>
          </div>
        </div>

        {/* Manual entries list */}
        {manualEntries.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <h4 className="text-xs font-semibold tracking-wider uppercase text-stone-500 mb-3">Données Manuelles Saisies</h4>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                  <th className="p-2">Date</th>
                  <th className="p-2">Maladie</th>
                  <th className="p-2 text-center">Nombre de cas</th>
                  <th className="p-2 text-center">Sexe</th>
                  <th className="p-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {manualEntries.map((m) => (
                  <tr key={m.id} className="hover:bg-stone-50/50">
                    <td className="p-2 font-mono text-stone-500">{new Date(m.date).toLocaleDateString("fr-FR")}</td>
                    <td className="p-2 font-medium text-stone-800">{m.maladie}</td>
                    <td className="p-2 text-center font-bold text-stone-700 font-mono">{m.cas}</td>
                    <td className="p-2 text-center font-semibold text-stone-600">{m.sexe}</td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteManuel(m.id)}
                        className="text-stone-500 dark:text-stone-400 hover:text-danger-600 p-1 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Styled inline style block for crisp executive PDF prints */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Setup perfect pure white page conditions */
          html, body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 10px !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide interactive screen components completely */
          aside, nav, header, footer, button, select, input, .no-print, [role="tablist"], [role="banner"], h3 svg {
            display: none !important;
          }
          /* Override body elements and nested screens */
          #root, .min-h-screen, main, .space-y-6, div {
            background: #ffffff !important;
            box-shadow: none !important;
            border-color: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          /* Hide standard screen dashboard sections during print */
          .space-y-6 > div:not(.print-container) {
            display: none !important;
          }
          /* Display the print-only container prominently */
          .print-container {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 24px !important;
          }
          .print-card {
            border: 1px solid #d1d5db !important;
            background-color: #f9fafb !important;
          }
          .page-break {
            page-break-before: always !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          th, td {
            border: 1px solid #e5e7eb !important;
            padding: 6px 8px !important;
          }
          thead th {
            background-color: #f3f4f6 !important;
            color: #111827 !important;
          }
        }
      `}} />

      {/* Dedicated Print-only executive PDF report layout */}
      <div className="hidden print:block print-container font-sans bg-white text-black p-4 space-y-6">
        {/* Letterhead */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4">
          <div className="space-y-1">
            <h1 className="text-xl font-bold uppercase tracking-wide text-black">{profile.name}</h1>
            <p className="text-xs italic text-stone-600">« {profile.slogan} »</p>
            <p className="text-2xs text-stone-600 leading-tight">
              {profile.address}<br />
              Tél : {profile.phone}<br />
              Email : {profile.email}
            </p>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-700">Rapport de Performance</p>
            <p className="text-2xs text-stone-600">
              Date : <strong>{new Date().toLocaleDateString("fr-FR", { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
            </p>
            <p className="text-2xs text-stone-600">
              Période : <strong>
                {period === "all" ? "Toute la période" : period === "today" ? "Aujourd'hui" : period === "week" ? "7 derniers jours" : "Ce mois-ci"}
              </strong>
            </p>
            <p className="text-2xs text-stone-600">Généré par : <strong>Responsable Médical</strong></p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center py-4 space-y-1">
          <h2 className="text-base font-bold uppercase tracking-wider text-black">
            Rapport Clinique & Épidémiologique Officiel
          </h2>
          <p className="text-xs text-stone-600 font-medium">
            Document officiel d'analyse des indicateurs de santé publique et de charge opérationnelle de l'établissement.
          </p>
        </div>

        {/* Grid or Table of KPI Summaries */}
        <div className="print-card border border-stone-300 rounded-xl p-4 bg-stone-50/50">
          <h3 className="text-xs font-bold uppercase tracking-wide border-b border-stone-200 pb-1.5 mb-2">
            1. Indicateurs Synthétiques Globaux
          </h3>
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr className="border-b border-stone-200">
                <td className="py-1.5 font-medium text-stone-600">Consultations médicales numériques</td>
                <td className="py-1.5 text-right font-bold text-black">{totalCount} dossiers</td>
                <td className="py-1.5 pl-6 font-medium text-stone-600">Cas de fortes fièvres (&ge; 38.5°C)</td>
                <td className="py-1.5 text-right font-bold text-black">{feverCount} cas</td>
              </tr>
              <tr className="border-b border-stone-200">
                <td className="py-1.5 font-medium text-stone-600">Ratio Hommes / Femmes (Dossiers)</td>
                <td className="py-1.5 text-right font-bold text-black">
                  H : {hommesCount} ({malePercent}%) | F : {femmesCount} ({femalePercent}%)
                </td>
                <td className="py-1.5 pl-6 font-medium text-stone-600">Âge moyen des patients</td>
                <td className="py-1.5 text-right font-bold text-black">
                  {avgAge !== null ? `${avgAge} ans` : "—"}
                </td>
              </tr>
              <tr className="border-b border-stone-200">
                <td className="py-1.5 font-medium text-stone-600">Températures anormales (&lt;36°C ou &gt;38°C)</td>
                <td className="py-1.5 text-right font-bold text-black">{badConditionCount} cas</td>
                <td className="py-1.5 pl-6 font-medium text-stone-600">Praticiens actifs sur la période</td>
                <td className="py-1.5 text-right font-bold text-black">{activeCliniciansCount} praticiens</td>
              </tr>
              <tr>
                <td className="py-1.5 font-medium text-stone-600">Enregistrements manuels consolidés</td>
                <td className="py-1.5 text-right font-bold text-black">{manualEntries.length} saisies</td>
                <td className="py-1.5 pl-6 font-medium text-stone-600">Total charge pathologique cumulée</td>
                <td className="py-1.5 text-right font-bold text-black">{totalCount + manualEntries.length} cas traités</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Epid warnings inside PDF if fever is high */}
        {feverCount > 3 && (
          <div className="border border-red-300 bg-red-50 text-red-800 p-3 rounded-lg text-2xs font-bold space-y-1">
            <p className="uppercase tracking-wider">⚠️ ALERTE DE SURVEILLANCE ÉPIDÉMIOLOGIQUE ACTIVE :</p>
            <p className="font-medium leading-relaxed">
              Il a été recensé {feverCount} épisodes de températures corporelles sévères (&ge;38.5°C) durant cette période. Ce seuil indique une prévalence suspecte de pathologies infectieuses (ex: paludisme à plasmodium, viroses saisonnières). Il convient de maintenir un stock de sécurité d'antipaludiques, de paracétamol injectable, de réactifs de TDR et de sensibiliser la patientèle sur l'usage des moustiquaires imprégnées.
            </p>
          </div>
        )}

        {/* Diagnostics list */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide border-b border-stone-200 pb-1.5">
            2. Distribution Détaillée des Pathologies & Diagnostics (Top 15)
          </h3>
          {topDiags.length === 0 ? (
            <p className="text-xs text-stone-500 italic py-2">Aucun diagnostic documenté sur cette période.</p>
          ) : (
            <table className="w-full text-left text-2xs border-collapse border border-stone-200">
              <thead>
                <tr className="bg-stone-100 text-stone-700 font-bold border-b border-stone-200 uppercase text-[8px]">
                  <th className="p-2 border-r border-stone-200 text-center w-8">N°</th>
                  <th className="p-2 border-r border-stone-200">Pathologie Diagnostiquée</th>
                  <th className="p-2 border-r border-stone-200 text-center w-16">Cas Totaux</th>
                  <th className="p-2 border-r border-stone-200 text-center w-16">Hommes (M)</th>
                  <th className="p-2 border-r border-stone-200 text-center w-16">Femmes (F)</th>
                  <th className="p-2 text-center w-20">Part Cas (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {topDiags.map((d, index) => {
                  const percent = totalCount > 0 ? Math.round((d.count / (totalCount + manualEntries.length)) * 100) : 100;
                  return (
                    <tr key={d.label} className="hover:bg-stone-50/50">
                      <td className="p-1.5 border-r border-stone-200 text-center font-bold font-mono">{index + 1}</td>
                      <td className="p-1.5 border-r border-stone-200 font-semibold text-stone-800">{d.label}</td>
                      <td className="p-1.5 border-r border-stone-200 text-center font-bold font-mono text-black">{d.count}</td>
                      <td className="p-1.5 border-r border-stone-200 text-center font-mono">{d.h}</td>
                      <td className="p-1.5 border-r border-stone-200 text-center font-mono">{d.f}</td>
                      <td className="p-1.5 text-center font-bold font-mono">{percent}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Demographics and Clinician load side-by-side in PDF */}
        <div className="grid grid-cols-2 gap-4">
          {/* Demographic breakdown table */}
          <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/30">
            <h4 className="text-xs font-bold uppercase tracking-wider text-black border-b border-stone-200 pb-1 mb-2">
              3. Profils Démographiques Patients (Ages)
            </h4>
            <table className="w-full text-2xs border-collapse">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase text-[8px]">
                  <th className="py-1 text-left">Tranche d'Âge</th>
                  <th className="py-1 text-right">Nombre de cas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ageCategories.map((c) => (
                  <tr key={c.label}>
                    <td className="py-1 font-medium text-stone-600">{c.label}</td>
                    <td className="py-1 text-right font-mono font-bold text-black">{c.count} rdv</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Clinician loads */}
          <div className="border border-stone-200 rounded-xl p-3 bg-stone-50/30">
            <h4 className="text-xs font-bold uppercase tracking-wider text-black border-b border-stone-200 pb-1 mb-2">
              4. Charge Opérationnelle par Praticien
            </h4>
            {Object.keys(cliniciansDist).length === 0 ? (
              <p className="text-2xs text-stone-500 dark:text-stone-400 italic">Aucun praticien documenté.</p>
            ) : (
              <table className="w-full text-2xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-bold uppercase text-[8px]">
                    <th className="py-1 text-left">Praticien / Clinicien</th>
                    <th className="py-1 text-right">Consultations réalisées</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {Object.entries(cliniciansDist).map(([clin, count]) => (
                    <tr key={clin}>
                      <td className="py-1 font-medium text-stone-600 truncate max-w-[120px]">{clin}</td>
                      <td className="py-1 text-right font-mono font-bold text-black">{count} rdv</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Manual entries if any in print */}
        {manualEntries.length > 0 && (
          <div className="space-y-1 page-break">
            <h3 className="text-xs font-bold uppercase tracking-wide border-b border-stone-200 pb-1.5">
              5. Surveillance Épidémiologique Manuelle (Données Consolidées Papier)
            </h3>
            <table className="w-full text-left text-2xs border-collapse border border-stone-200">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200 uppercase text-[8px]">
                  <th className="p-1.5 border-r border-stone-200">Date d'Enregistrement</th>
                  <th className="p-1.5 border-r border-stone-200">Pathologie déclarée</th>
                  <th className="p-1.5 border-r border-stone-200 text-center w-24">Nombre de Cas (N)</th>
                  <th className="p-1.5 text-center w-24">Répartition Genre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {manualEntries.map((m) => (
                  <tr key={m.id}>
                    <td className="p-1.5 border-r border-stone-200 font-mono text-stone-500">
                      {new Date(m.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="p-1.5 border-r border-stone-200 font-medium text-stone-850">{m.maladie}</td>
                    <td className="p-1.5 border-r border-stone-200 text-center font-bold text-black font-mono">{m.cas}</td>
                    <td className="p-1.5 text-center font-semibold text-stone-600">{m.sexe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Executive closing/signature block */}
        <div className="pt-8 border-t border-dashed border-stone-300 flex justify-between items-start text-2xs text-stone-600 page-break">
          <div className="space-y-1 max-w-[340px]">
            <p className="font-bold uppercase text-stone-800">Remarques & Observations de la Direction :</p>
            <div className="border border-stone-200 rounded-lg p-2 h-16 w-[320px] bg-stone-50/20 italic">
              Rapport d'analyse validé pour archivage et transmission réglementaire aux autorités sanitaires.
            </div>
            <p className="text-[8px] text-stone-500 dark:text-stone-400">
              Rapport chiffré généré numériquement le {new Date().toLocaleDateString("fr-FR")} à {new Date().toLocaleTimeString("fr-FR")} via le système de gestion sécurisé de {profile.name}.
            </p>
          </div>
          <div className="text-center space-y-12 pr-6">
            <p className="font-bold uppercase text-stone-800">Le Médecin Chef / Responsable Clinique</p>
            <div className="w-48 border-b border-stone-400 mx-auto"></div>
            <p className="text-[8px] italic text-stone-500 dark:text-stone-400">(Signature officielle & Tampon de l'établissement)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
