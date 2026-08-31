/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import { logActivity } from "../lib/activityLogger";
import { Facture, Depense, FactureLigne, ExamenLabo } from "../types";
import { generateUid, getTodayStr } from "../data";
import { 
  Plus, Trash2, Check, DollarSign, CreditCard, Filter, AlertTriangle, 
  ArrowUpRight, ArrowDownLeft, BookOpen, FileSpreadsheet, Calculator, 
  PlusCircle, Search, Percent, FileText, Scale, TrendingUp, CheckCircle2,
  Download, Printer, X, ShieldAlert, Key, Users, Lock, Unlock, Edit3
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { jsPDF } from "jspdf";

interface TabFacturationProps {
  factures: Facture[];
  depenses: Depense[];
  onUpdateFactures: (factures: Facture[]) => void;
  onUpdateDepenses: (depenses: Depense[]) => void;
  // Examens de laboratoire prescrits (depuis la Consultation), avec leur prix,
  // pour un report en un clic sur la facture du patient sans ressaisie.
  laboExamens?: ExamenLabo[];
  onUpdateLaboExamens?: (examens: ExamenLabo[]) => void;
}

// Default SYSCOHADA accounting plan tailored for a West African clinic
const DEFAULT_PLAN = [
  { code: "1011", label: "Capital Social (Clinique)", classe: "1", nature: "Crédit" },
  { code: "2441", label: "Matériel Médical & Chirurgical", classe: "2", nature: "Débit" },
  { code: "3111", label: "Stocks de Médicaments", classe: "3", nature: "Débit" },
  { code: "3112", label: "Stocks de Consommables Médicaux", classe: "3", nature: "Débit" },
  { code: "4011", label: "Fournisseurs de Biens & Services", classe: "4", nature: "Crédit" },
  { code: "4111", label: "Clients / Créances Patients", classe: "4", nature: "Débit" },
  { code: "4112", label: "Tiers Payants (Assurances & Mutuelles)", classe: "4", nature: "Débit" },
  { code: "5211", label: "Banque (Virements / Chèques)", classe: "5", nature: "Débit" },
  { code: "5711", label: "Caisse Espèces (Clinique)", classe: "5", nature: "Débit" },
  { code: "5712", label: "Caisse Mobile Money (Orange/Moov/Wave)", classe: "5", nature: "Débit" },
  { code: "6011", label: "Achats Médicaments & Produits Pharmaceutiques", classe: "6", nature: "Débit" },
  { code: "6012", label: "Achats de Consommables & Réactifs de Labo", classe: "6", nature: "Débit" },
  { code: "6221", label: "Loyers du Cabinet Médical", classe: "6", nature: "Débit" },
  { code: "6241", label: "Consommation Électricité (SONABEL)", classe: "6", nature: "Débit" },
  { code: "6242", label: "Consommation Eau (ONEA)", classe: "6", nature: "Débit" },
  { code: "6281", label: "Fournitures Bureau & Imprimés Médicaux", classe: "6", nature: "Débit" },
  { code: "6311", label: "Maintenance du Matériel Médical", classe: "6", nature: "Débit" },
  { code: "6411", label: "Salaires du Personnel Médical (Médecins/Infirmiers)", classe: "6", nature: "Débit" },
  { code: "6412", label: "Salaires du Personnel Administratif", classe: "6", nature: "Débit" },
  { code: "6582", label: "Gestion des Déchets Médicaux (DASRI)", classe: "6", nature: "Débit" },
  { code: "7011", label: "Ventes de Médicaments (Pharmacie)", classe: "7", nature: "Crédit" },
  { code: "7061", label: "Prestations - Consultations Médicales", classe: "7", nature: "Crédit" },
  { code: "7062", label: "Prestations - Analyses de Laboratoire", classe: "7", nature: "Crédit" },
  { code: "7063", label: "Prestations - Séjour Hospitalisation", classe: "7", nature: "Crédit" },
  { code: "7064", label: "Prestations - Actes de Soins & Petite Chirurgie", classe: "7", nature: "Crédit" },
  { code: "7065", label: "Prestations - Actes de Maternité & Accouchements", classe: "7", nature: "Crédit" },
  { code: "7066", label: "Prestations - Urgences Médicales", classe: "7", nature: "Crédit" }
];

export default function TabFacturation({
  factures,
  depenses,
  onUpdateFactures,
  onUpdateDepenses,
  laboExamens = [],
  onUpdateLaboExamens
}: TabFacturationProps) {
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

  // Navigation tabs inside the accounting workspace
  const [activeSubTab, setActiveSubTab] = useState<"dashboard" | "factures" | "depenses" | "plan" | "journal" | "ledger" | "agents" | "stats_rh">("dashboard");

  // Securisation des codes agents (Directeur) — synchronisé cloud en temps réel
  const [directorCode, setDirectorCode] = useCloudSyncedState<string>("dg_director_code", "1234");
  const [isDirectorUnlocked, setIsDirectorUnlocked] = useState(false);
  const [enteredCode, setEnteredCode] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [newDirectorCode, setNewDirectorCode] = useState("");
  const [isChangingDirectorCode, setIsChangingDirectorCode] = useState(false);

  const [agents, setAgents] = useCloudSyncedState<any[]>("dg_agents_codes_list", []);

  const [newAgentNom, setNewAgentNom] = useState("");
  const [newAgentFonction, setNewAgentFonction] = useState("Médecin");
  const [newAgentCode, setNewAgentCode] = useState("");
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  // États Statistiques RH — synchronisés cloud en temps réel
  const [hrLeaves, setHrLeaves] = useCloudSyncedState<any[]>("dg_hr_leaves", []);

  const [newLeaveAgent, setNewLeaveAgent] = useState("");
  const [newLeaveFonction, setNewLeaveFonction] = useState("Médecin Généraliste");
  const [newLeaveType, setNewLeaveType] = useState("Congé Annuel");
  const [newLeaveDebut, setNewLeaveDebut] = useState("");
  const [newLeaveFin, setNewLeaveFin] = useState("");
  const [newLeaveStatut, setNewLeaveStatut] = useState("Approuvé");

  const [hrAbsenteeismData, setHrAbsenteeismData] = useCloudSyncedState<any[]>("dg_hr_absenteeism", []);

  const [hrContractsData, setHrContractsData] = useCloudSyncedState<any[]>("dg_hr_contracts", []);

  const saveAgents = (newAgentsList: any[]) => {
    setAgents(newAgentsList);
  };

  const handleAddOrEditAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentNom.trim() || !newAgentCode.trim()) return;

    if (editingAgentId) {
      const updated = agents.map((a) =>
        a.id === editingAgentId
          ? { ...a, nom: newAgentNom.trim(), fonction: newAgentFonction, code: newAgentCode.trim().toUpperCase() }
          : a
      );
      saveAgents(updated);
      setEditingAgentId(null);
    } else {
      const newAgent = {
        id: "ag-" + Date.now(),
        nom: newAgentNom.trim(),
        fonction: newAgentFonction,
        code: newAgentCode.trim().toUpperCase()
      };
      saveAgents([...agents, newAgent]);
    }
    setNewAgentNom("");
    setNewAgentFonction("Médecin");
    setNewAgentCode("");
  };

  const handleDeleteAgent = (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer cet agent ?")) {
      const updated = agents.filter((a) => a.id !== id);
      saveAgents(updated);
    }
  };

  const handleEditClick = (agent: any) => {
    setEditingAgentId(agent.id);
    setNewAgentNom(agent.nom);
    setNewAgentFonction(agent.fonction);
    setNewAgentCode(agent.code);
  };

  const handleSaveDirectorCode = () => {
    if (!newDirectorCode.trim()) return;
    setDirectorCode(newDirectorCode.trim());
    setNewDirectorCode("");
    setIsChangingDirectorCode(false);
    alert("Le code d'accès Directeur a été modifié avec succès !");
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredCode.trim() === directorCode) {
      setIsDirectorUnlocked(true);
      setUnlockError("");
      setEnteredCode("");
    } else {
      setUnlockError("Code d'accès Directeur incorrect. Veuillez réessayer.");
    }
  };

  // Gestion des Congés & Absentéisme RH
  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaveAgent.trim() || !newLeaveDebut || !newLeaveFin) return;

    const d1 = new Date(newLeaveDebut);
    const d2 = new Date(newLeaveFin);
    const timeDiff = Math.abs(d2.getTime() - d1.getTime());
    const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

    const newL = {
      id: Date.now(),
      agent: newLeaveAgent.trim(),
      fonction: newLeaveFonction,
      type: newLeaveType,
      debut: newLeaveDebut,
      fin: newLeaveFin,
      jours: isNaN(days) ? 1 : days,
      statut: newLeaveStatut
    };

    const updated = [newL, ...hrLeaves];
    setHrLeaves(updated);

    // reset fields
    setNewLeaveAgent("");
    setNewLeaveDebut("");
    setNewLeaveFin("");
  };

  const handleDeleteLeave = (id: number) => {
    if (confirm("Voulez-vous supprimer ce congé planifié ?")) {
      const updated = hrLeaves.filter((l) => l.id !== id);
      setHrLeaves(updated);
    }
  };

  const handleUpdateAbsenteeismTaux = (monthName: string, value: number) => {
    const updated = hrAbsenteeismData.map((d) => 
      d.month === monthName ? { ...d, taux: parseFloat(value.toFixed(1)) } : d
    );
    setHrAbsenteeismData(updated);
  };

  // Invoicing states
  const [factPatient, setFactPatient] = useState("");
  const [factDate, setFactDate] = useState(getTodayStr());
  const [factMode, setFactMode] = useState("Espèces");
  const [factPaidAmount, setFactPaidAmount] = useState("");
  const [factLignes, setFactLignes] = useState<FactureLigne[]>([]);
  const [lineDesc, setLineDesc] = useState("");
  const [lineQte, setLineQte] = useState("1");
  const [linePrix, setLinePrix] = useState("");

  // Expenses states
  const [depDate, setDepDate] = useState(getTodayStr());
  const [depCategorie, setDepCategorie] = useState("Achat médicaments");
  const [depLibelle, setDepLibelle] = useState("");
  const [depMontant, setDepMontant] = useState("");
  const [depMode, setDepMode] = useState("Espèces");

  // Plan Comptable custom storage — synchronisé cloud en temps réel
  const [customAccounts, setCustomAccounts] = useCloudSyncedState<any[]>("dg_plan_comptable_custom", []);
  const [newAccCode, setNewAccCode] = useState("");
  const [newAccLabel, setNewAccLabel] = useState("");
  const [newAccClasse, setNewAccClasse] = useState("6");
  const [newAccNature, setNewAccNature] = useState("Débit");

  // Manual entries storage — synchronisé cloud en temps réel
  const [manualEntries, setManualEntries] = useCloudSyncedState<any[]>("dg_compta_manuelle", []);

  // Manual entry builder states
  const [meDate, setMeDate] = useState(getTodayStr());
  const [meLibelle, setMeLibelle] = useState("");
  const [meRef, setMeRef] = useState("");
  const [meLines, setMeLines] = useState<any[]>([]);
  const [meSelCompte, setMeSelCompte] = useState("5711");
  const [meDebitVal, setMeDebitVal] = useState("");
  const [meCreditVal, setMeCreditVal] = useState("");

  // General state filters
  const [filterStatut, setFilterStatut] = useState<string>("all");
  const [ledgerSelCompte, setLedgerSelCompte] = useState("5711");
  const [journalSearch, setJournalSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPrintJournalModalOpen, setIsPrintJournalModalOpen] = useState(false);

  const filteredFactures = React.useMemo(() => {
    return factures.filter((f) => {
      if (startDate && f.date < startDate) return false;
      if (endDate && f.date > endDate) return false;
      return true;
    });
  }, [factures, startDate, endDate]);

  const filteredDepenses = React.useMemo(() => {
    return depenses.filter((d) => {
      if (startDate && d.date < startDate) return false;
      if (endDate && d.date > endDate) return false;
      return true;
    });
  }, [depenses, startDate, endDate]);

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJournalPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const margin = 15;
    const pageHeight = 297;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);

    const primaryColor = [13, 148, 136]; // Teal-600
    const secondaryColor = [30, 41, 59]; // Slate-800
    const lightBgColor = [240, 253, 250]; // Teal-50
    const borderGray = [229, 231, 235]; // Gray-200
    const darkGray = [107, 114, 128]; // Gray-500

    let y = 15;

    // Header Helper
    const drawHeader = () => {
      // Top header
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("CABINET MÉDICAL DEO-GRACIAS", pageWidth / 2, y, { align: "center" });
      y += 4;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("BOBO-DIOULASSO, BURKINA FASO — TÉL: +226 44 92 01 62 — COMPTABILITÉ & FACTURATION", pageWidth / 2, y, { align: "center" });
      y += 4;

      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.6);
      doc.line(margin, y, margin + contentWidth, y);
      doc.setLineWidth(0.15);
      doc.line(margin, y + 0.8, margin + contentWidth, y + 0.8);
      y += 6;

      // Title Banner
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.rect(margin, y, contentWidth, 10, "F");
      doc.setDrawColor(204, 251, 241);
      doc.setLineWidth(0.25);
      doc.rect(margin, y, contentWidth, 10, "S");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("JOURNAL GÉNÉRAL DES ÉCRITURES COMPTABLES", pageWidth / 2, y + 6.5, { align: "center" });
      y += 15;
    };

    drawHeader();

    // Meta details
    doc.setFontSize(8.5);
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("Période du Rapport :", margin, y);
    doc.setFont("Helvetica", "normal");
    const periodStr = (startDate || endDate) 
      ? `${startDate ? `Du ${new Date(startDate).toLocaleDateString("fr-FR")}` : ""} ${endDate ? `au ${new Date(endDate).toLocaleDateString("fr-FR")}` : ""}`
      : "Toutes périodes";
    doc.text(periodStr, margin + 32, y);

    doc.setFont("Helvetica", "bold");
    doc.text("Date d'édition :", margin + 115, y);
    doc.setFont("Helvetica", "normal");
    doc.text(new Date().toLocaleString("fr-FR"), margin + 140, y);
    y += 8;

    // Summary block (KPIs)
    doc.setFillColor(250, 250, 249); // Warm background
    doc.rect(margin, y, contentWidth, 18, "F");
    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.rect(margin, y, contentWidth, 18, "S");

    // Inside Summary Row
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("ÉCRITURES TRAITÉES", margin + 10, y + 5);
    doc.text("TOTAL DÉBIT", margin + 65, y + 5);
    doc.text("TOTAL CRÉDIT", margin + 125, y + 5);

    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${filteredJournal.length} Transactions`, margin + 10, y + 12);
    doc.setTextColor(37, 99, 235); // Blue
    doc.text(`${printJournalTotalDebit.toLocaleString("fr-FR")} F CFA`, margin + 65, y + 12);
    doc.setTextColor(147, 51, 234); // Purple
    doc.text(`${printJournalTotalCredit.toLocaleString("fr-FR")} F CFA`, margin + 125, y + 12);

    y += 26;

    // Table of Journal Entries
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("LIVRE COMPTABLE DÉTAILLÉ", margin, y);
    y += 5;

    filteredJournal.forEach((entry) => {
      // Check space needed for entry: each entry header takes ~5mm, each row takes ~5mm.
      const linesCount = entry.lignes.length;
      const spaceNeeded = 10 + (linesCount * 5) + 5;

      if (y + spaceNeeded > 275) {
        doc.addPage();
        y = 15;
        // Draw small page header
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text("CABINET MÉDICAL DEO-GRACIAS — SUITE JOURNAL COMPTABLE", margin, y);
        y += 2.5;
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.4);
        doc.line(margin, y, margin + contentWidth, y);
        y += 6;
      }

      // Draw Entry Card Header
      doc.setFillColor(244, 244, 245); // Slate-100
      doc.rect(margin, y, contentWidth, 6.5, "F");
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.rect(margin, y, contentWidth, 6.5, "S");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(55, 65, 81);
      
      const formattedDate = new Date(entry.date).toLocaleDateString("fr-FR");
      doc.text(`${formattedDate}`, margin + 3, y + 4.5);
      doc.text(`[${entry.reference}]`, margin + 22, y + 4.5);
      
      const libTrunc = entry.libelle.length > 55 ? entry.libelle.slice(0, 52) + "..." : entry.libelle;
      doc.setTextColor(15, 23, 42);
      doc.text(libTrunc, margin + 48, y + 4.5);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text(entry.source.toUpperCase(), margin + 155, y + 4.5, { align: "right" });

      y += 6.5;

      // Inner Table Column Names
      doc.setFillColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("COMPTE", margin + 3, y + 4);
      doc.text("INTITULÉ SYSCOHADA", margin + 22, y + 4);
      doc.text("DÉBIT", margin + 125, y + 4, { align: "right" });
      doc.text("CRÉDIT", margin + 165, y + 4, { align: "right" });
      
      y += 4.5;

      // Inner Rows
      entry.lignes.forEach((line: any) => {
        doc.setDrawColor(244, 244, 245);
        doc.setLineWidth(0.1);
        doc.line(margin, y + 4, margin + contentWidth, y + 4);

        doc.setFont("Helvetica", "mono");
        doc.setFontSize(7);
        doc.setTextColor(55, 65, 81);
        doc.text(line.compte, margin + 3, y + 3.2);

        doc.setFont("Helvetica", "normal");
        const detail = planComptable.find((p) => p.code === line.compte);
        const detailLabel = detail?.label || "Compte personnalisé";
        const labelTrunc = detailLabel.length > 50 ? detailLabel.slice(0, 48) + ".." : detailLabel;
        doc.text(labelTrunc, margin + 22, y + 3.2);

        doc.setFont("Helvetica", "bold");
        if (line.debit > 0) {
          doc.setTextColor(37, 99, 235);
          doc.text(line.debit.toLocaleString("fr-FR"), margin + 125, y + 3.2, { align: "right" });
        }
        if (line.credit > 0) {
          doc.setTextColor(147, 51, 234);
          doc.text(line.credit.toLocaleString("fr-FR"), margin + 165, y + 3.2, { align: "right" });
        }
        y += 4;
      });

      y += 4; // space between entry cards
    });

    // Save PDF
    doc.save(`journal_comptable_${getTodayStr()}.pdf`);
  };


  const handleExportFacturesPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const margin = 15;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);
    let y = 15;

    // Brand Palette
    const primaryColor = [15, 118, 110]; // Teal 700
    const lightGray = [244, 244, 245];
    const darkGray = [63, 63, 70];

    // Header Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CABINET MÉDICAL DEO-GRACIAS", margin, y);
    
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("Récapitulatif des Factures Émises", margin, y);

    y += 6;
    let periodStr = "Période : Globale";
    if (startDate && endDate) periodStr = `Période du ${new Date(startDate).toLocaleDateString("fr-FR")} au ${new Date(endDate).toLocaleDateString("fr-FR")}`;
    else if (startDate) periodStr = `Depuis le ${new Date(startDate).toLocaleDateString("fr-FR")}`;
    else if (endDate) periodStr = `Jusqu'au ${new Date(endDate).toLocaleDateString("fr-FR")}`;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.text(periodStr, margin, y);
    
    y += 10;
    
    // Line separator
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + contentWidth, y);
    y += 5;

    const exportFactures = filteredFactures.filter((f) => filterStatut === "all" || f.statut === filterStatut);

    // Summary block (KPIs)
    let totalEncaisse = 0;
    let totalFacture = 0;
    let totalReste = 0;
    exportFactures.forEach(f => {
      totalEncaisse += f.montantPaye;
      totalFacture += f.total;
      totalReste += (f.total - f.montantPaye);
    });

    doc.setFillColor(250, 250, 249);
    doc.rect(margin, y, contentWidth, 18, "F");
    doc.setDrawColor(228, 228, 231);
    doc.rect(margin, y, contentWidth, 18, "S");

    // Inside Summary Row
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("NOMBRE DE FACTURES", margin + 5, y + 5);
    doc.text("TOTAL FACTURÉ", margin + 55, y + 5);
    doc.text("TOTAL ENCAISSÉ", margin + 105, y + 5);
    doc.text("RESTE À RECOUVRER", margin + 145, y + 5);

    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${exportFactures.length} Facture(s)`, margin + 5, y + 12);
    doc.text(`${totalFacture.toLocaleString("fr-FR")} F`, margin + 55, y + 12);
    doc.setTextColor(4, 120, 87); // Emerald
    doc.text(`${totalEncaisse.toLocaleString("fr-FR")} F`, margin + 105, y + 12);
    doc.setTextColor(190, 18, 60); // Rose
    doc.text(`${totalReste.toLocaleString("fr-FR")} F`, margin + 145, y + 12);

    y += 26;
    
    // Table Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("Helvetica", "bold");
    
    // Columns: Date, Patient, Statut, Total, Encaisse, Reste
    const cols = [
      { name: "Date", x: margin + 2 },
      { name: "Patient", x: margin + 22 },
      { name: "Statut", x: margin + 70 },
      { name: "Total", x: margin + 110 },
      { name: "Encaissé", x: margin + 140 },
      { name: "Reste", x: margin + 170 }
    ];
    
    cols.forEach(c => {
      doc.text(c.name, c.x, y + 5);
    });
    
    y += 8;

    // Rows
    exportFactures.forEach((f, idx) => {
      if (y > 275) {
        doc.addPage();
        y = margin;
      }
      
      const isEven = idx % 2 === 0;
      if (isEven) {
        doc.setFillColor(250, 250, 249); // Zinc-50
        doc.rect(margin, y, contentWidth, 7, "F");
      }
      
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      
      const rest = f.total - f.montantPaye;
      
      doc.text(new Date(f.date).toLocaleDateString("fr-FR"), cols[0].x, y + 4.5);
      
      const patientName = f.patient.length > 25 ? f.patient.slice(0, 23) + ".." : f.patient;
      doc.text(patientName, cols[1].x, y + 4.5);
      
      doc.text(f.statut, cols[2].x, y + 4.5);
      
      doc.setFont("Helvetica", "bold");
      doc.text(`${f.total.toLocaleString("fr-FR")} F`, cols[3].x, y + 4.5);
      
      doc.setTextColor(4, 120, 87);
      doc.text(`${f.montantPaye.toLocaleString("fr-FR")} F`, cols[4].x, y + 4.5);
      
      doc.setTextColor(190, 18, 60);
      doc.text(`${rest.toLocaleString("fr-FR")} F`, cols[5].x, y + 4.5);
      
      y += 7;
    });

    doc.save(`recapitulatif_factures_${getTodayStr()}.pdf`);
  };

  const handleExportFacturesCSV = () => {
    const headers = [
      "ID Facture",
      "Date",
      "Patient",
      "Assurance",
      "Statut",
      "Sous-total (FCFA)",
      "Remise (FCFA)",
      "Total (FCFA)",
      "Montant Paye (FCFA)",
      "Reste a Payer (FCFA)"
    ];

    const rows = filteredFactures.map((f: any) => {
      const rest = f.total - f.montantPaye;
      return [
        f.id,
        f.date || "",
        f.patientNom || f.patient || "",
        f.assuranceNom || "Aucune",
        f.statut || "",
        f.subtotal || f.total,
        f.remise || 0,
        f.total,
        f.montantPaye,
        rest
      ];
    });

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) =>
        row
          .map((val) => {
            const strVal = String(val).replace(/"/g, '""');
            return `"${strVal}"`;
          })
          .join(";")
      )
    ].join("\r\n");

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csvContent, `clinique_factures_filtrees_${dateStr}.csv`);
  };

  const handleExportDepensesCSV = () => {
    const headers = [
      "ID Depense",
      "Date",
      "Categorie",
      "Description",
      "Montant (FCFA)",
      "Beneficiaire",
      "Mode de Reglement"
    ];

    const rows = filteredDepenses.map((d: any) => [
      d.id,
      d.date || "",
      d.categorie || "",
      d.description || d.libelle || "",
      d.montant,
      d.beneficiaire || "",
      d.modeReglement || d.mode || ""
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map((row) =>
        row
          .map((val) => {
            const strVal = String(val).replace(/"/g, '""');
            return `"${strVal}"`;
          })
          .join(";")
      )
    ].join("\r\n");

    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCSV(csvContent, `clinique_depenses_filtrees_${dateStr}.csv`);
  };

  const planComptable = [...DEFAULT_PLAN, ...customAccounts];

  // Automated Double-entry Engine (realtime dynamic compilation of all records)
  const allJournalEntries = React.useMemo(() => {
    const entries: any[] = [];

    // Map factures
    factures.forEach((fac) => {
      const lines: any[] = [];
      let creditConsult = 0;
      let creditPharma = 0;
      let creditLabo = 0;
      let creditHosp = 0;

      fac.lignes.forEach((l) => {
        const desc = l.designation.toLowerCase();
        if (desc.includes("pharma") || desc.includes("médic") || desc.includes("comprim") || desc.includes("sirop")) {
          creditPharma += l.montant;
        } else if (desc.includes("labo") || desc.includes("analys") || desc.includes("exam") || desc.includes("test")) {
          creditLabo += l.montant;
        } else if (desc.includes("hosp") || desc.includes("chambre") || desc.includes("séjour") || desc.includes("lit")) {
          creditHosp += l.montant;
        } else {
          creditConsult += l.montant;
        }
      });

      if (creditConsult > 0) lines.push({ compte: "7061", debit: 0, credit: creditConsult });
      if (creditPharma > 0) lines.push({ compte: "7011", debit: 0, credit: creditPharma });
      if (creditLabo > 0) lines.push({ compte: "7062", debit: 0, credit: creditLabo });
      if (creditHosp > 0) lines.push({ compte: "7063", debit: 0, credit: creditHosp });

      const paid = fac.montantPaye || 0;
      const unpaid = fac.total - paid;

      if (paid > 0) {
        let modeAcc = "5711"; // Espèces
        if (fac.mode === "Mobile Money") modeAcc = "5712";
        else if (fac.mode === "Virement") modeAcc = "5211";
        else if (fac.mode === "Assurance maladie") modeAcc = "4111"; // Tiers payable
        lines.push({ compte: modeAcc, debit: paid, credit: 0 });
      }

      if (unpaid > 0) {
        lines.push({ compte: "4111", debit: unpaid, credit: 0 });
      }

      entries.push({
        id: `fac-${fac.id}`,
        date: fac.date,
        libelle: `Facturation client : ${fac.patient}`,
        reference: `FAC-${fac.id.substring(0, 6).toUpperCase()}`,
        lignes: lines,
        source: "Facture"
      });
    });

    // Map depenses
    depenses.forEach((dep) => {
      const lines: any[] = [];
      let dbAcc = "6581";
      if (dep.categorie === "Achat médicaments") dbAcc = "6011";
      else if (dep.categorie === "Salaires") dbAcc = "6411";
      else if (dep.categorie === "Loyer") dbAcc = "6221";
      else if (dep.categorie === "Électricité / Eau") {
        dbAcc = dep.libelle.toLowerCase().includes("eau") ? "6242" : "6241";
      } else if (dep.categorie === "Maintenance / Réparation") dbAcc = "6311";
      else if (dep.categorie === "Fournitures de bureau") dbAcc = "6281";

      lines.push({ compte: dbAcc, debit: dep.montant, credit: 0 });

      let crAcc = "5711";
      if (dep.mode === "Mobile Money") crAcc = "5712";
      else if (dep.mode === "Chèque" || dep.mode === "Virement") crAcc = "5211";
      lines.push({ compte: crAcc, debit: 0, credit: dep.montant });

      entries.push({
        id: `dep-${dep.id}`,
        date: dep.date,
        libelle: `Charge - ${dep.libelle} (${dep.categorie})`,
        reference: `DEP-${dep.id.substring(0, 6).toUpperCase()}`,
        lignes: lines,
        source: "Dépense"
      });
    });

    // Merge manual
    manualEntries.forEach((me) => {
      entries.push({
        id: me.id,
        date: me.date,
        libelle: me.libelle,
        reference: me.reference,
        lignes: me.lignes,
        source: "Manuel"
      });
    });

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [factures, depenses, manualEntries]);

  // Aggregate Debit / Credit for all accounts in the Plan
  const accountBalances = React.useMemo(() => {
    const balances: Record<string, { debit: number; credit: number }> = {};
    planComptable.forEach((p) => {
      balances[p.code] = { debit: 0, credit: 0 };
    });

    allJournalEntries.forEach((entry) => {
      entry.lignes.forEach((l: any) => {
        if (!balances[l.compte]) {
          balances[l.compte] = { debit: 0, credit: 0 };
        }
        balances[l.compte].debit += l.debit || 0;
        balances[l.compte].credit += l.credit || 0;
      });
    });

    return balances;
  }, [allJournalEntries, planComptable]);

  // Handle adding custom accounts
  const handleAddCustomAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccCode.trim() || !newAccLabel.trim()) {
      alert("Veuillez renseigner le code et l'intitulé.");
      return;
    }
    if (planComptable.some((p) => p.code === newAccCode)) {
      alert("Ce code de compte existe déjà.");
      return;
    }

    const newAcc = {
      code: newAccCode.trim(),
      label: newAccLabel.trim(),
      classe: newAccClasse,
      nature: newAccNature
    };

    const updated = [...customAccounts, newAcc];
    setCustomAccounts(updated);
    setNewAccCode("");
    setNewAccLabel("");
    alert("Compte " + newAcc.code + " inscrit avec succès au Plan Comptable.");
  };

  const handleDeleteCustomAccount = (code: string) => {
    if (confirm("Supprimer ce compte personnalisé ?")) {
      const updated = customAccounts.filter((a) => a.code !== code);
      setCustomAccounts(updated);
    }
  };

  // Examens de laboratoire prescrits pour le patient en cours de facturation,
  // pas encore reportés sur une facture — pour un ajout en un clic avec prix.
  const examensNonFactures = React.useMemo(() => {
    const q = factPatient.trim().toLowerCase();
    if (!q) return [];
    return laboExamens.filter(
      (e) => !e.facture && e.patient.trim().toLowerCase() === q
    );
  }, [laboExamens, factPatient]);

  const handleAddExamenALaFacture = (examen: ExamenLabo) => {
    const newLine: FactureLigne = {
      id: generateUid(),
      designation: examen.analyses || examen.examen || "Examen de laboratoire",
      qte: 1,
      prix: examen.prix || 0,
      montant: examen.prix || 0
    };
    setFactLignes((prev) => [...prev, newLine]);
    if (onUpdateLaboExamens) {
      onUpdateLaboExamens(
        laboExamens.map((e) => (e.id === examen.id ? { ...e, facture: true } : e))
      );
    }
  };

  const handleAddTousExamensALaFacture = () => {
    if (examensNonFactures.length === 0) return;
    const newLines: FactureLigne[] = examensNonFactures.map((examen) => ({
      id: generateUid(),
      designation: examen.analyses || examen.examen || "Examen de laboratoire",
      qte: 1,
      prix: examen.prix || 0,
      montant: examen.prix || 0
    }));
    setFactLignes((prev) => [...prev, ...newLines]);
    if (onUpdateLaboExamens) {
      const idsAFacturer = new Set(examensNonFactures.map((e) => e.id));
      onUpdateLaboExamens(
        laboExamens.map((e) => (idsAFacturer.has(e.id) ? { ...e, facture: true } : e))
      );
    }
  };

  // Facture and Line Actions
  const handleAddLine = () => {
    if (!lineDesc.trim() || !linePrix) {
      alert("Veuillez renseigner la désignation et le prix.");
      return;
    }
    const q = parseFloat(lineQte) || 1;
    const p = parseFloat(linePrix) || 0;

    const newLine: FactureLigne = {
      id: generateUid(),
      designation: lineDesc.trim(),
      qte: q,
      prix: p,
      montant: q * p
    };

    setFactLignes([...factLignes, newLine]);
    setLineDesc("");
    setLineQte("1");
    setLinePrix("");
  };

  const handleSaveInvoice = () => {
    if (!factPatient.trim()) {
      alert("Nom de patient requis.");
      return;
    }
    if (factLignes.length === 0) {
      alert("Veuillez ajouter au moins une prestation.");
      return;
    }

    const total = factLignes.reduce((s, l) => s + l.montant, 0);
    let paid = parseFloat(factPaidAmount);
    if (isNaN(paid)) paid = 0;
    if (paid > total) paid = total;

    const newFacture: Facture = {
      id: generateUid(),
      patient: factPatient.trim(),
      date: factDate || getTodayStr(),
      mode: factMode,
      lignes: [...factLignes],
      total,
      montantPaye: paid,
      statut: paid >= total ? "Payée" : paid > 0 ? "Partielle" : "Impayée",
      createdAt: new Date().toISOString()
    };

    onUpdateFactures([newFacture, ...factures]);
    setFactPatient("");
    setFactPaidAmount("");
    setFactLignes([]);
    alert("Facture enregistrée et comptabilisée automatiquement.");
  };

  const handleAddDepense = () => {
    if (!depLibelle.trim() || !depMontant) {
      alert("Veuillez remplir le libellé et le montant.");
      return;
    }

    const m = parseFloat(depMontant) || 0;
    const newDep: Depense = {
      id: generateUid(),
      libelle: depLibelle.trim(),
      montant: m,
      date: depDate || getTodayStr(),
      categorie: depCategorie,
      mode: depMode,
      createdAt: new Date().toISOString()
    };

    onUpdateDepenses([newDep, ...depenses]);
    setDepLibelle("");
    setDepMontant("");
    alert("Dépense enregistrée et comptabilisée.");
  };

  // Manual entry builder actions
  const handleAddMeLine = () => {
    const dVal = parseFloat(meDebitVal) || 0;
    const cVal = parseFloat(meCreditVal) || 0;

    if (dVal === 0 && cVal === 0) {
      alert("Veuillez renseigner soit un montant au Débit, soit au Crédit.");
      return;
    }
    if (dVal > 0 && cVal > 0) {
      alert("Une ligne ne peut pas comporter à la fois un Débit et un Crédit.");
      return;
    }

    const accountObj = planComptable.find((p) => p.code === meSelCompte);
    const newLine = {
      compte: meSelCompte,
      label: accountObj?.label || "Compte inconnu",
      debit: dVal,
      credit: cVal
    };

    setMeLines([...meLines, newLine]);
    setMeDebitVal("");
    setMeCreditVal("");
  };

  const handleSaveManualEntry = () => {
    if (!meLibelle.trim() || !meRef.trim()) {
      alert("Veuillez remplir le libellé et la référence.");
      return;
    }
    if (meLines.length < 2) {
      alert("Une écriture comptable doit comporter au moins 2 lignes (double-entrée).");
      return;
    }

    const totDeb = meLines.reduce((s, l) => s + l.debit, 0);
    const totCred = meLines.reduce((s, l) => s + l.credit, 0);

    if (Math.abs(totDeb - totCred) > 0.01) {
      alert(`Erreur : L'écriture n'est pas équilibrée !\nTotal Débit : ${totDeb} FCFA\nTotal Crédit : ${totCred} FCFA`);
      return;
    }

    const newME = {
      id: "MAN-" + Math.random().toString(36).substr(2, 9).toUpperCase(),
      date: meDate,
      libelle: meLibelle.trim(),
      reference: meRef.trim().toUpperCase(),
      lignes: meLines.map((l) => ({ compte: l.compte, debit: l.debit, credit: l.credit })),
      source: "Manuel"
    };

    const updated = [newME, ...manualEntries];
    setManualEntries(updated);

    setMeLibelle("");
    setMeRef("");
    setMeLines([]);
    alert("Écriture d'ajustement validée et inscrite au Journal.");
  };

  const handleDeleteManualEntry = (id: string) => {
    if (confirm("Supprimer cette écriture d'ajustement ?")) {
      const updated = manualEntries.filter((m) => m.id !== id);
      setManualEntries(updated);
    }
  };

  // Financial quick summaries
  const curMonth = getTodayStr().slice(0, 7);
  const totalRevenueMonth = filteredFactures
    .filter((f) => !startDate && !endDate ? f.date.slice(0, 7) === curMonth : true)
    .reduce((s, f) => s + f.montantPaye, 0);
  const totalExpensesMonth = filteredDepenses
    .filter((d) => !startDate && !endDate ? d.date.slice(0, 7) === curMonth : true)
    .reduce((s, d) => s + d.montant, 0);
  const totalOutstanding = filteredFactures
    .filter((f) => f.statut !== "Payée")
    .reduce((s, f) => s + (f.total - f.montantPaye), 0);

  // Aggregating monthly revenues vs operating expenses for Recharts
  const monthlyData = React.useMemo(() => {
    const dataMap: Record<string, { month: string; revenus: number; depenses: number }> = {};

    filteredFactures.forEach((f) => {
      if (!f.date) return;
      const mStr = f.date.slice(0, 7); // YYYY-MM
      if (!mStr) return;
      if (!dataMap[mStr]) {
        dataMap[mStr] = { month: mStr, revenus: 0, depenses: 0 };
      }
      dataMap[mStr].revenus += f.total;
    });

    filteredDepenses.forEach((d) => {
      if (!d.date) return;
      const mStr = d.date.slice(0, 7);
      if (!mStr) return;
      if (!dataMap[mStr]) {
        dataMap[mStr] = { month: mStr, revenus: 0, depenses: 0 };
      }
      dataMap[mStr].depenses += d.montant;
    });

    const sorted = Object.values(dataMap).sort((a, b) => a.month.localeCompare(b.month));

    const monthNamesFr: Record<string, string> = {
      "01": "Jan", "02": "Fév", "03": "Mar", "04": "Avr", "05": "Mai", "06": "Juin",
      "07": "Juil", "08": "Août", "09": "Sept", "10": "Oct", "11": "Nov", "12": "Déc"
    };

    return sorted.map((item) => {
      const [year, month] = item.month.split("-");
      const label = monthNamesFr[month] ? `${monthNamesFr[month]} ${year}` : item.month;
      return {
        month: item.month,
        label,
        revenus: item.revenus,
        depenses: item.depenses,
      };
    });
  }, [filteredFactures, filteredDepenses]);

  // Journal Search filter & Date Filters
  const filteredJournal = allJournalEntries.filter((entry) => {
    if (startDate && entry.date < startDate) return false;
    if (endDate && entry.date > endDate) return false;

    const term = journalSearch.toLowerCase();
    return (
      entry.libelle.toLowerCase().includes(term) ||
      entry.reference.toLowerCase().includes(term) ||
      entry.lignes.some((l: any) => l.compte.includes(term))
    );
  });

  const printJournalTotalDebit = React.useMemo(() => {
    return filteredJournal.reduce((s, entry) => {
      return s + entry.lignes.reduce((sub, line: any) => sub + (line.debit || 0), 0);
    }, 0);
  }, [filteredJournal]);

  const printJournalTotalCredit = React.useMemo(() => {
    return filteredJournal.reduce((s, entry) => {
      return s + entry.lignes.reduce((sub, line: any) => sub + (line.credit || 0), 0);
    }, 0);
  }, [filteredJournal]);

  return (
    <div className="space-y-6">
      {/* Sub-navigation Menu bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-stone-900 text-stone-200 p-4 rounded-2xl shadow-md border border-stone-850">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveSubTab("dashboard")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "dashboard" ? "bg-primary-600 text-white shadow-xs" : "hover:bg-stone-800 text-stone-300"
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Tableau de bord</span>
          </button>
          <button
            onClick={() => setActiveSubTab("factures")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "factures" ? "bg-primary-600 text-white shadow-xs" : "hover:bg-stone-800 text-stone-300"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Factures Patient</span>
          </button>
          <button
            onClick={() => setActiveSubTab("depenses")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "depenses" ? "bg-primary-600 text-white shadow-xs" : "hover:bg-stone-800 text-stone-300"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Dépenses Cabinet</span>
          </button>
          <button
            onClick={() => setActiveSubTab("plan")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "plan" ? "bg-primary-600 text-white shadow-xs" : "hover:bg-stone-800 text-stone-300"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Plan SYSCOHADA</span>
          </button>
          <button
            onClick={() => setActiveSubTab("journal")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "journal" ? "bg-primary-600 text-white shadow-xs" : "hover:bg-stone-800 text-stone-300"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Journal de Saisie</span>
          </button>
          <button
            onClick={() => setActiveSubTab("ledger")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "ledger" ? "bg-primary-600 text-white shadow-xs" : "hover:bg-stone-800 text-stone-300"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Grand Livre & Balance</span>
          </button>
          <button
            onClick={() => setActiveSubTab("agents")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "agents" ? "bg-primary-600 text-white shadow-xs" : "hover:bg-stone-800 text-stone-300"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Codes Agents (Directeur)</span>
          </button>
          <button
            onClick={() => setActiveSubTab("stats_rh")}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer ${
              activeSubTab === "stats_rh" ? "bg-primary-600 text-white shadow-xs" : "hover:bg-stone-800 text-stone-300"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Statistiques RH</span>
          </button>
        </div>
        <div className="text-xs uppercase font-black tracking-widest text-primary-400 bg-primary-950/40 border border-primary-900/40 px-2.5 py-1 rounded-lg">
          Intégration Comptable Active
        </div>
      </div>

      {/* Date Filter Bar */}
      <div id="financial-date-filters-bar" className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-stone-50 rounded-xl border border-stone-150">
            <Filter className="w-4 h-4 text-primary-700" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-serif font-bold text-stone-900">Période d'Analyse Comptable</h4>
            <p className="text-xs text-stone-500 font-medium">
              Filtrez dynamiquement les factures, les dépenses et le graphique comparatif des revenus.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Du</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white font-mono font-bold text-stone-700 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Au</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white font-mono font-bold text-stone-700 outline-none"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-danger-600 hover:text-danger-700 bg-danger-50 hover:bg-danger-100 rounded-lg transition-all border border-danger-200/50 cursor-pointer"
            >
              Réinitialiser
            </button>
          )}

          <div className="flex items-center gap-2 border-l border-stone-200 pl-3 ml-1">
            <button
              id="export-invoices-csv-btn"
              type="button"
              onClick={handleExportFacturesCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 hover:text-stone-900 font-bold rounded-lg text-sm shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
              title="Exporter l'historique filtré des factures au format CSV"
            >
              <Download className="w-3.5 h-3.5 text-primary-600" />
              <span>Exporter Factures</span>
            </button>
            <button
              id="export-expenses-csv-btn"
              type="button"
              onClick={handleExportDepensesCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 hover:text-stone-900 font-bold rounded-lg text-sm shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
              title="Exporter l'historique filtré des dépenses au format CSV"
            >
              <Download className="w-3.5 h-3.5 text-danger-600" />
              <span>Exporter Dépenses</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: DASHBOARD */}
      {activeSubTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-3xs border-t-4 border-t-success-600">
              <div className="text-xl font-semibold text-stone-900 font-mono">{(totalRevenueMonth).toLocaleString("fr-FR")} F</div>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Recettes du Mois</div>
              <div className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5">Comptes Classe 7</div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-3xs border-t-4 border-t-danger-600">
              <div className="text-xl font-semibold text-stone-900 font-mono">{(totalExpensesMonth).toLocaleString("fr-FR")} F</div>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Dépenses du Mois</div>
              <div className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5">Comptes Classe 6</div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-3xs border-t-4 border-t-warning-600">
              <div className="text-xl font-semibold text-stone-900 font-mono">{(totalOutstanding).toLocaleString("fr-FR")} F</div>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Créances Restantes</div>
              <div className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5">Compte 4111 (Clients)</div>
            </div>
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-3xs border-t-4 border-t-blue-600">
              <div className={`text-xl font-semibold font-mono ${totalRevenueMonth - totalExpensesMonth >= 0 ? "text-success-700" : "text-danger-700"}`}>
                {(totalRevenueMonth - totalExpensesMonth).toLocaleString("fr-FR")} F
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Résultat Provisoire</div>
              <div className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5">Bénéfice opérationnel</div>
            </div>
          </div>

          {/* Graphique de comparaison des Flux de Trésorerie Mensuels */}
          <div id="recharts-monthly-financials-card" className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-150 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-serif font-bold text-stone-900 flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-primary-700" />
                  Visualisation Graphique : Revenus vs Dépenses de Fonctionnement
                </h3>
                <p className="text-sm text-stone-500 font-medium">
                  Analyse comparative mensuelle du volume des factures patients générées contre les dépenses réglées.
                </p>
              </div>
              <span className="text-xs font-black uppercase tracking-wider bg-primary-50 text-primary-700 border border-primary-200/50 px-2.5 py-1 rounded-full self-start sm:self-auto">
                Recharts Live
              </span>
            </div>

            {monthlyData.length === 0 ? (
              <div className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">
                Aucune donnée mensuelle d'activité n'est enregistrée pour le moment.
              </div>
            ) : (
              <div className="w-full h-72 sm:h-80 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyData}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f0" vertical={false} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fill: "#57534e", fontSize: 10, fontWeight: 600 }} 
                      axisLine={{ stroke: "#e7e5e4" }}
                      tickLine={{ stroke: "#e7e5e4" }}
                    />
                    <YAxis 
                      tickFormatter={(val) => `${(val / 1000).toLocaleString("fr-FR")}k`}
                      tick={{ fill: "#57534e", fontSize: 10, fontWeight: 600 }}
                      axisLine={{ stroke: "#e7e5e4" }}
                      tickLine={{ stroke: "#e7e5e4" }}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`${Number(value).toLocaleString("fr-FR")} FCFA`, ""]}
                      contentStyle={{ 
                        backgroundColor: "#ffffff", 
                        border: "1px solid #e7e5e4", 
                        borderRadius: "12px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                        fontSize: "12px"
                      }}
                      labelClassName="font-serif font-bold text-stone-900 border-b border-stone-100 pb-1 mb-1"
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", fontWeight: 600 }}
                    />
                    <Bar 
                      name="Revenus (Facturation)" 
                      dataKey="revenus" 
                      fill="#0f766e" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={45}
                      isAnimationActive={true}
                      animationDuration={1200}
                      animationEasing="ease-out"
                      activeBar={{ fillOpacity: 0.85, stroke: "#115e59", strokeWidth: 1.5 }}
                    />
                    <Bar 
                      name="Dépenses de Fonctionnement" 
                      dataKey="depenses" 
                      fill="#e11d48" 
                      radius={[4, 4, 0, 0]} 
                      maxBarSize={45}
                      isAnimationActive={true}
                      animationDuration={1200}
                      animationEasing="ease-out"
                      activeBar={{ fillOpacity: 0.85, stroke: "#be123c", strokeWidth: 1.5 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs lg:col-span-2 space-y-4">
              <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary-700" />
                Structure des Flux de Trésorerie Automatisés (SYSCOHADA)
              </h3>
              <div className="space-y-4 pt-1">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-stone-600 mb-1">
                    <span>Recettes d'exploitation encaissées (Débit 5711/5712)</span>
                    <span className="font-bold text-success-700">{(totalRevenueMonth).toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-success-500 rounded-full" style={{ width: `${Math.min(100, Math.max(5, totalRevenueMonth > 0 ? 100 : 0))}%` }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold text-stone-600 mb-1">
                    <span>Charges et Décaissements payés (Crédit 5711/5712/5211)</span>
                    <span className="font-bold text-danger-700">{(totalExpensesMonth).toLocaleString("fr-FR")} FCFA</span>
                  </div>
                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-danger-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, totalRevenueMonth > 0 ? (totalExpensesMonth / totalRevenueMonth) * 100 : totalExpensesMonth > 0 ? 100 : 0))}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="border border-stone-150 rounded-xl p-4 bg-stone-50/50 mt-4 space-y-2">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wide">Diagnostic d'Équilibre Comptable Automatique</h4>
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  Le système génère des écritures en partie double. Chaque transaction clinique ou achat est comptabilisé. 
                  En cas d'apport ou d'ajustement fiscal (amortissement, charges constatées d'avance), vous pouvez passer des écritures manuelles dans l'onglet <strong>Journal de Saisie</strong>.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold text-success-700 pt-1">
                  <CheckCircle2 className="w-4 h-4 text-success-600" />
                  <span>Grand Livre et Balance en équilibre parfait (Total Débit = Total Crédit)</span>
                </div>
              </div>
            </div>

            {/* Quick Balance Sheet / Compte de Résultat */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs space-y-4">
              <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
                <Scale className="w-4 h-4 text-primary-700" />
                Compte de Résultat Simplifié
              </h3>
              <div className="space-y-3 pt-1 text-xs">
                <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                  <span className="font-bold text-stone-600">PRODUITS (CLASSE 7)</span>
                  <span className="font-bold text-success-700 font-mono">
                    {(Object.entries(accountBalances) as [string, { debit: number; credit: number }][])
                      .filter(([code]) => code.startsWith("7"))
                      .reduce((s, [, bal]) => s + (bal.credit - bal.debit), 0)
                      .toLocaleString("fr-FR")} F
                  </span>
                </div>
                <div className="pl-3 space-y-1.5 text-stone-500">
                  <div className="flex justify-between">
                    <span>• Prestations Médicales (7061)</span>
                    <span className="font-mono">{(accountBalances["7061"]?.credit || 0).toLocaleString("fr-FR")} F</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Ventes Pharmacie (7011)</span>
                    <span className="font-mono">{(accountBalances["7011"]?.credit || 0).toLocaleString("fr-FR")} F</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Analyses Labo (7062)</span>
                    <span className="font-mono">{(accountBalances["7062"]?.credit || 0).toLocaleString("fr-FR")} F</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-stone-100 pb-2 pt-3">
                  <span className="font-bold text-stone-600">CHARGES (CLASSE 6)</span>
                  <span className="font-bold text-danger-700 font-mono">
                    {(Object.entries(accountBalances) as [string, { debit: number; credit: number }][])
                      .filter(([code]) => code.startsWith("6"))
                      .reduce((s, [, bal]) => s + (bal.debit - bal.credit), 0)
                      .toLocaleString("fr-FR")} F
                  </span>
                </div>
                <div className="pl-3 space-y-1.5 text-stone-500 max-h-32 overflow-y-auto">
                  <div className="flex justify-between">
                    <span>• Achat Médicaments (6011)</span>
                    <span className="font-mono">{(accountBalances["6011"]?.debit || 0).toLocaleString("fr-FR")} F</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Salaires Personnel (6411)</span>
                    <span className="font-mono">{(accountBalances["6411"]?.debit || 0).toLocaleString("fr-FR")} F</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Loyers Cabinet (6221)</span>
                    <span className="font-mono">{(accountBalances["6221"]?.debit || 0).toLocaleString("fr-FR")} F</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Électricité & Eau</span>
                    <span className="font-mono">
                      {((accountBalances["6241"]?.debit || 0) + (accountBalances["6242"]?.debit || 0)).toLocaleString("fr-FR")} F
                    </span>
                  </div>
                </div>

                <div className="border-t border-stone-300 pt-3 flex justify-between items-center text-sm font-semibold text-stone-900 bg-stone-50 p-2 rounded-lg">
                  <span>RÉSULTAT NET COMPTABLE</span>
                  <span className={totalRevenueMonth - totalExpensesMonth >= 0 ? "text-success-700 font-mono" : "text-danger-700 font-mono"}>
                    {(totalRevenueMonth - totalExpensesMonth).toLocaleString("fr-FR")} F
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION CODE AGENT DIRECTEUR - INTÉGRÉE AU DASHBOARD GLOBAL */}
          <div className="pt-6 border-t border-stone-150 space-y-6">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
              <ShieldAlert className="w-5 h-5 text-primary-600" />
              <div>
                <h3 className="text-sm font-serif font-bold text-stone-900">Console de Sécurité & Codes Agents</h3>
                <p className="text-sm text-stone-500">Accès rapide réservé au directeur pour gérer les habilitations cliniques.</p>
              </div>
            </div>

            {!isDirectorUnlocked ? (
              /* LOCK SCREEN */
              <div className="max-w-md mx-auto bg-white border border-stone-200 rounded-2xl p-6 shadow-xs text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-primary-50 rounded-full flex items-center justify-center border border-primary-100 text-primary-600">
                  <Lock className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-serif font-bold text-stone-900">Identification requise</h4>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Saisissez votre code d'accès directeur pour afficher et modifier la liste confidentielle des agents.
                  </p>
                </div>

                <form onSubmit={handleUnlock} className="space-y-3">
                  <div className="space-y-1 text-left">
                    <input
                      type="password"
                      placeholder="Code Directeur (défaut: 1234)"
                      value={enteredCode}
                      onChange={(e) => setEnteredCode(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-stone-50 focus:bg-white text-center font-mono font-bold tracking-widest"
                    />
                    {unlockError && (
                      <p className="text-2xs text-danger-600 font-bold flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                        <span>{unlockError}</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Déverrouiller la Console</span>
                  </button>
                </form>
              </div>
            ) : (
              /* UNLOCKED MANAGEMENT CONSOLE */
              <div className="space-y-6">
                <div className="bg-primary-950 text-white p-4 rounded-xl border border-primary-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-primary-400" />
                      <h4 className="text-xs font-serif font-bold text-white">Espace de Gestion des Codes Confidentiels</h4>
                    </div>
                    <p className="text-xs text-primary-200">
                      Attribuez des codes uniques pour chaque médecin, infirmier et agent de la clinique.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDirectorUnlocked(false)}
                    className="px-2.5 py-1 bg-primary-850 hover:bg-primary-800 text-primary-100 hover:text-white border border-primary-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Verrouiller l'espace</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Form to Add / Edit Agent */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs space-y-3">
                    <div className="border-b border-stone-100 pb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary-750" />
                      <h5 className="text-xs font-bold font-serif text-stone-800">
                        {editingAgentId ? "Modifier l'Agent" : "Attribuer un Nouveau Code"}
                      </h5>
                    </div>

                    <form onSubmit={handleAddOrEditAgent} className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                          Nom complet de l'agent
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: Dr. Moussa Traoré"
                          value={newAgentNom}
                          onChange={(e) => setNewAgentNom(e.target.value)}
                          className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white outline-none font-medium text-stone-700"
                          required
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                          Fonction / Rôle
                        </label>
                        <select
                          value={newAgentFonction}
                          onChange={(e) => setNewAgentFonction(e.target.value)}
                          className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white outline-none font-bold text-stone-700"
                        >
                          <option value="Médecin Généraliste">Médecin Généraliste</option>
                          <option value="Médecin Spécialiste">Médecin Spécialiste</option>
                          <option value="Pédiatre Spécialiste">Pédiatre Spécialiste</option>
                          <option value="Gynécologue">Gynécologue</option>
                          <option value="Infirmier(e) d'État">Infirmier(e) d'État</option>
                          <option value="Sage-femme / Maïeuticien">Sage-femme / Maïeuticien</option>
                          <option value="Secrétaire Médicale">Secrétaire Médicale</option>
                          <option value="Chef de Réception">Chef de Réception</option>
                          <option value="Comptable Principal">Comptable Principal</option>
                          <option value="Pharmacien Clinique">Pharmacien Clinique</option>
                          <option value="Technicien de Laboratoire">Technicien de Laboratoire</option>
                          <option value="Agent de Soutien">Agent de Soutien</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                          Code secret / PIN
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: DR-202"
                          value={newAgentCode}
                          onChange={(e) => setNewAgentCode(e.target.value)}
                          className="w-full border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white outline-none font-mono font-semibold text-stone-700 tracking-wider uppercase"
                          required
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="submit"
                          className="flex-1 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer text-center"
                        >
                          {editingAgentId ? "Enregistrer" : "Créer & Attribuer"}
                        </button>
                        {editingAgentId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAgentId(null);
                              setNewAgentNom("");
                              setNewAgentFonction("Médecin Généraliste");
                              setNewAgentCode("");
                            }}
                            className="px-2.5 py-1.5 bg-stone-150 hover:bg-stone-200 text-stone-600 font-bold rounded-lg text-xs transition-all cursor-pointer"
                          >
                            Annuler
                          </button>
                        )}
                      </div>
                    </form>
                  </div>

                  {/* Agents list table */}
                  <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs lg:col-span-2 space-y-3">
                    <div className="border-b border-stone-100 pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-primary-700" />
                        <h5 className="text-xs font-bold font-serif text-stone-800">
                          Registre Confidentiel d'Attribution des Codes
                        </h5>
                      </div>
                      <span className="text-[8px] font-black uppercase bg-primary-50 border border-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-mono">
                        {agents.length} AGENTS
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-stone-150 rounded-lg">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50 border-b text-[8px] font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                            <th className="p-2 pl-3">Nom de l'Agent</th>
                            <th className="p-2">Fonction / Rôle</th>
                            <th className="p-2 text-center">Code Confidentiel</th>
                            <th className="p-2 text-right pr-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {agents.map((agent) => {
                            let badgeBg = "bg-stone-100 text-stone-700 border-stone-200";
                            if (agent.fonction.includes("Médecin") || agent.fonction.includes("Pédiatre") || agent.fonction.includes("Gynécologue")) {
                              badgeBg = "bg-blue-50 text-blue-700 border-blue-200/50";
                            } else if (agent.fonction.includes("Infirmier") || agent.fonction.includes("Sage-femme")) {
                              badgeBg = "bg-primary-50 text-primary-700 border-primary-200/50";
                            } else if (agent.fonction.includes("Réception") || agent.fonction.includes("Secrétaire")) {
                              badgeBg = "bg-danger-50 text-danger-700 border-danger-200/50";
                            } else if (agent.fonction.includes("Comptable")) {
                              badgeBg = "bg-purple-50 text-purple-700 border-purple-200/50";
                            } else if (agent.fonction.includes("Labo")) {
                              badgeBg = "bg-warning-50 text-warning-700 border-warning-200/50";
                            } else if (agent.fonction.includes("Pharmacien")) {
                              badgeBg = "bg-success-50 text-success-700 border-success-200/50";
                            }

                            return (
                              <tr key={agent.id} className="hover:bg-stone-50 transition-all text-sm">
                                <td className="p-2 pl-3 font-bold text-stone-850">{agent.nom}</td>
                                <td className="p-2">
                                  <span className={`inline-block text-[8px] font-semibold border rounded-lg px-1.5 py-0.5 uppercase ${badgeBg}`}>
                                    {agent.fonction}
                                  </span>
                                </td>
                                <td className="p-2 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-800 font-mono font-black text-xs rounded-lg border border-stone-200 tracking-wider">
                                    <Key className="w-2.5 h-2.5 text-warning-600" />
                                    {agent.code}
                                  </span>
                                </td>
                                <td className="p-2 text-right pr-3 space-x-1">
                                  <button
                                    onClick={() => handleEditClick(agent)}
                                    className="p-1 hover:bg-stone-100 hover:text-primary-700 rounded-lg text-stone-500 dark:text-stone-400 transition-all cursor-pointer"
                                    title="Modifier"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAgent(agent.id)}
                                    className="p-1 hover:bg-danger-50 hover:text-danger-600 rounded-lg text-stone-500 dark:text-stone-400 transition-all cursor-pointer"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Safety parameters for Director */}
                    <div className="pt-3 border-t border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1 bg-stone-50 border rounded-xl p-3">
                        <div className="flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-warning-600" />
                          <h6 className="text-xs font-bold text-stone-800 uppercase tracking-wide">
                            Modifier le Code d'accès Directeur
                          </h6>
                        </div>
                        <p className="text-2xs text-stone-500 leading-tight">
                          Pour des raisons de sécurité évidentes, modifiez régulièrement le code de cet espace.
                        </p>

                        {isChangingDirectorCode ? (
                          <div className="flex gap-1.5 pt-1">
                            <input
                              type="text"
                              placeholder="Nouveau code"
                              value={newDirectorCode}
                              onChange={(e) => setNewDirectorCode(e.target.value)}
                              className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white font-mono font-semibold text-stone-850 outline-none flex-1 uppercase"
                            />
                            <button
                              type="button"
                              onClick={handleSaveDirectorCode}
                              className="bg-primary-600 hover:bg-primary-700 text-white text-2xs font-semibold px-2 py-1 rounded-lg transition-all cursor-pointer"
                            >
                              Enregistrer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsChangingDirectorCode(false);
                                setNewDirectorCode("");
                              }}
                              className="bg-stone-200 text-stone-600 text-2xs font-semibold px-2 py-1 rounded-lg transition-all cursor-pointer"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsChangingDirectorCode(true)}
                            className="mt-1 px-2.5 py-1 bg-white hover:bg-stone-100 border border-stone-200 text-2xs font-semibold text-stone-700 rounded-lg transition-all cursor-pointer uppercase"
                          >
                            Changer le code
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col justify-center p-3 bg-primary-50/50 border border-primary-100/50 rounded-xl text-stone-600">
                        <p className="text-xs leading-relaxed">
                          <span className="font-semibold text-primary-850">ℹ️ Confidentialité :</span> Les codes de signature sont stockés localement sur ce navigateur.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: FACTURES PATIENT */}
      {activeSubTab === "factures" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs space-y-4 col-span-1 self-start">
            <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-primary-700" />
              Nouvelle Facture Clinique
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Patient *</label>
                <input
                  type="text"
                  placeholder="Nom complet"
                  value={factPatient}
                  onChange={(e) => setFactPatient(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date</label>
                  <input
                    type="date"
                    value={factDate}
                    onChange={(e) => setFactDate(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Règlement</label>
                  <select
                    value={factMode}
                    onChange={(e) => setFactMode(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50"
                  >
                    <option value="Espèces">💵 Espèces</option>
                    <option value="Mobile Money">📱 Mobile Money</option>
                    <option value="Virement">🏛️ Virement</option>
                    <option value="Assurance maladie">🛡️ Assurance</option>
                  </select>
                </div>
              </div>

              {factMode === "Mobile Money" && (
                <div className="text-xs bg-warning-50 text-warning-800 border border-warning-200/50 p-2.5 rounded-xl font-medium space-y-1">
                  <p className="font-semibold text-warning-900">📱 Compte de dépôt Mobile Money :</p>
                  <p className="font-mono text-xs font-black">N° Service : 44 92 01 62</p>
                  <p className="text-2xs text-stone-500">Service officiel de {profile.name}. Contact : {profile.phone}.</p>
                </div>
              )}

              {examensNonFactures.length > 0 && (
                <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs uppercase font-bold tracking-wider text-primary-700">
                      🧪 Examens prescrits non facturés ({examensNonFactures.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddTousExamensALaFacture}
                      className="text-2xs font-bold text-primary-700 hover:text-primary-900 underline"
                    >
                      Tout ajouter
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {examensNonFactures.map((e) => (
                      <div key={e.id} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 text-xs border border-primary-100">
                        <span className="font-semibold text-stone-700 truncate">{e.analyses || e.examen}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-stone-600">{(e.prix || 0).toLocaleString("fr-FR")} F</span>
                          <button
                            type="button"
                            onClick={() => handleAddExamenALaFacture(e)}
                            className="text-primary-600 hover:text-primary-800 font-bold"
                          >
                            + Ajouter
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-600 block">Prestation / Acte</span>
                <input
                  type="text"
                  placeholder="Désignation de l'acte"
                  value={lineDesc}
                  onChange={(e) => setLineDesc(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Prix U (F)"
                    value={linePrix}
                    onChange={(e) => setLinePrix(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-white"
                  />
                  <input
                    type="number"
                    placeholder="Qte"
                    value={lineQte}
                    onChange={(e) => setLineQte(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="w-full text-xs font-bold py-1.5 bg-stone-200 hover:bg-primary-600 hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  + Ajouter à la facture
                </button>
              </div>

              {factLignes.length > 0 && (
                <div className="border border-stone-100 rounded-lg max-h-32 overflow-y-auto text-sm">
                  {factLignes.map((l) => (
                    <div key={l.id} className="flex justify-between items-center p-2 border-b border-stone-50">
                      <div>
                        <div className="font-bold text-stone-800">{l.designation}</div>
                        <div className="text-stone-500 dark:text-stone-400">Qty: {l.qte} x {l.prix} F</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono">{l.montant} F</span>
                        <button onClick={() => setFactLignes(factLignes.filter((fl) => fl.id !== l.id))} className="text-danger-600 text-xs">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-xs font-bold text-stone-700">Total :</span>
                <span className="text-base font-black text-primary-700 font-mono">
                  {factLignes.reduce((s, l) => s + l.montant, 0).toLocaleString("fr-FR")} F
                </span>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Montant Payé (F)</label>
                <input
                  type="number"
                  placeholder="Montant encaissé"
                  value={factPaidAmount}
                  onChange={(e) => setFactPaidAmount(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveInvoice}
                className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DollarSign className="w-4 h-4" /> Enregistrer & Comptabiliser
              </button>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-serif font-bold text-stone-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary-700" />
                Grand Livre des Factures Émises
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportFacturesPDF}
                  className="bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Télécharger le récapitulatif des factures"
                >
                  <Download className="w-3 h-3" /> PDF Récapitulatif
                </button>
                <select
                  value={filterStatut}
                  onChange={(e) => setFilterStatut(e.target.value)}
                  className="text-xs font-bold bg-stone-50 border border-stone-200 text-stone-850 rounded-lg px-2 py-1 cursor-pointer"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="Payée">Payées</option>
                  <option value="Partielle">Partielles</option>
                  <option value="Impayée">Impayées</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200 text-xs uppercase">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Patient</th>
                    <th className="p-2.5 text-right">Total</th>
                    <th className="p-2.5 text-right">Encaissé</th>
                    <th className="p-2.5 text-right">Reste</th>
                    <th className="p-2.5 text-center">Règlement</th>
                    <th className="p-2.5 text-center">Statut</th>
                    <th className="p-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150">
                  {filteredFactures
                    .filter((f) => filterStatut === "all" || f.statut === filterStatut)
                    .map((f) => {
                      const rest = f.total - f.montantPaye;
                      return (
                        <tr key={f.id} className="hover:bg-stone-50">
                          <td className="p-2.5 font-mono text-stone-500 dark:text-stone-400">{new Date(f.date).toLocaleDateString("fr-FR")}</td>
                          <td className="p-2.5 font-bold text-stone-800">{f.patient}</td>
                          <td className="p-2.5 text-right font-bold font-mono">{f.total} F</td>
                          <td className="p-2.5 text-right text-success-700 font-mono">{f.montantPaye} F</td>
                          <td className={`p-2.5 text-right font-mono font-bold ${rest > 0 ? "text-danger-600" : "text-stone-500 dark:text-stone-400"}`}>{rest} F</td>
                          <td className="p-2.5 text-center text-stone-500 font-bold text-xs">{f.mode}</td>
                          <td className="p-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-2xs font-black uppercase ${
                              f.statut === "Payée" ? "bg-success-50 text-success-700" : f.statut === "Partielle" ? "bg-warning-50 text-warning-700" : "bg-danger-50 text-danger-700"
                            }`}>
                              {f.statut}
                            </span>
                          </td>
                          <td className="p-2.5 text-center space-x-1">
                            {f.statut !== "Payée" && (
                              <button
                                onClick={() => {
                                  const updated = factures.map((item) => item.id === f.id ? { ...item, statut: "Payée" as const, montantPaye: item.total } : item);
                                  onUpdateFactures(updated);
                                }}
                                className="bg-success-50 text-success-700 border border-success-200 px-1.5 py-0.5 rounded-lg text-2xs font-semibold cursor-pointer"
                              >
                                Encaisser
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm("Supprimer la facture ?")) {
                                  onUpdateFactures(factures.filter((item) => item.id !== f.id));
                                  logActivity(
                                    "Suppression de fiche (Facturation)",
                                    "suppression",
                                    `Suppression de la facture #${f.id} d'un montant de ${f.total || 0} F (Patient : ${f.patient || "Inconnu"}).`
                                  );
                                }
                              }}
                              className="text-stone-300 hover:text-danger-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CHARGES & DÉPENSES */}
      {activeSubTab === "depenses" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs space-y-4 col-span-1 self-start">
            <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-danger-600" />
              Saisir une Charge / Dépense
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Catégorie *</label>
                <select
                  value={depCategorie}
                  onChange={(e) => setDepCategorie(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white"
                >
                  <option value="Achat médicaments">Achat médicaments (Pharmacie)</option>
                  <option value="Salaires">Salaires et primes personnel</option>
                  <option value="Loyer">Loyer du cabinet</option>
                  <option value="Électricité / Eau">Électricité / Eau</option>
                  <option value="Maintenance / Réparation">Maintenance technique</option>
                  <option value="Fournitures de bureau">Fournitures bureau</option>
                  <option value="Autre">Autre charge</option>
                </select>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Libellé Descriptif *</label>
                <input
                  type="text"
                  placeholder="Ex: Facture SONABEL Juin"
                  value={depLibelle}
                  onChange={(e) => setDepLibelle(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Montant (F) *</label>
                  <input
                    type="number"
                    value={depMontant}
                    placeholder="Ex: 25000"
                    onChange={(e) => setDepMontant(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Mode de règlement</label>
                  <select
                    value={depMode}
                    onChange={(e) => setDepMode(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white"
                  >
                    <option value="Espèces">💵 Espèces</option>
                    <option value="Mobile Money">📱 Mobile Money</option>
                    <option value="Chèque">🧾 Chèque</option>
                    <option value="Virement">🏛️ Virement</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date</label>
                <input
                  type="date"
                  value={depDate}
                  onChange={(e) => setDepDate(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50"
                />
              </div>

              <button
                type="button"
                onClick={handleAddDepense}
                className="w-full py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowDownLeft className="w-4 h-4 text-danger-300" /> Enregistrer la dépense
              </button>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs lg:col-span-2 space-y-4">
            <h3 className="text-sm font-serif font-bold text-stone-900 border-b pb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-danger-600" />
              Livre de Caisse des Dépenses de Fonctionnement
            </h3>

            <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs uppercase">
                    <th className="p-2">Date</th>
                    <th className="p-2">Catégorie</th>
                    <th className="p-2">Libellé</th>
                    <th className="p-2 text-right">Montant</th>
                    <th className="p-2 text-center">Canal</th>
                    <th className="p-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredDepenses.map((d) => (
                    <tr key={d.id} className="hover:bg-stone-50">
                      <td className="p-2 font-mono text-stone-500 dark:text-stone-400">{new Date(d.date).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2 text-stone-600 font-bold">{d.categorie}</td>
                      <td className="p-2 text-stone-700 font-medium">{d.libelle}</td>
                      <td className="p-2 text-right font-mono font-bold text-danger-700">{d.montant.toLocaleString("fr-FR")} F</td>
                      <td className="p-2 text-center text-stone-500 font-bold text-xs">{d.mode}</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("Supprimer cette dépense ?")) {
                              onUpdateDepenses(depenses.filter((item) => item.id !== d.id));
                              logActivity(
                                "Suppression de fiche (Dépense)",
                                "suppression",
                                `Suppression de la dépense "${d.libelle}" (${d.categorie}) d'un montant de ${d.montant} F.`
                              );
                            }
                          }}
                          className="text-stone-300 hover:text-danger-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: PLAN COMPTABLE SYSCOHADA */}
      {activeSubTab === "plan" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs space-y-4 col-span-1 self-start">
            <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary-700" />
              Créer un Compte Personnalisé
            </h3>

            <form onSubmit={handleAddCustomAccount} className="space-y-3 text-xs">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Numéro de Compte *</label>
                <input
                  type="text"
                  placeholder="Ex: 7581"
                  value={newAccCode}
                  onChange={(e) => setNewAccCode(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 font-bold"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Intitulé du Compte *</label>
                <input
                  type="text"
                  placeholder="Ex: Subventions reçues"
                  value={newAccLabel}
                  onChange={(e) => setNewAccLabel(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Classe</label>
                  <select
                    value={newAccClasse}
                    onChange={(e) => setNewAccClasse(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50"
                  >
                    <option value="1">Classe 1 (Capitaux)</option>
                    <option value="2">Classe 2 (Actif Immo)</option>
                    <option value="3">Classe 3 (Stocks)</option>
                    <option value="4">Classe 4 (Tiers)</option>
                    <option value="5">Classe 5 (Trésorerie)</option>
                    <option value="6">Classe 6 (Charges)</option>
                    <option value="7">Classe 7 (Produits)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nature Habituelle</label>
                  <select
                    value={newAccNature}
                    onChange={(e) => setNewAccNature(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50"
                  >
                    <option value="Débit">Débit (Actif/Charges)</option>
                    <option value="Crédit">Crédit (Passif/Produits)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold transition-all cursor-pointer"
              >
                Inscrire au Plan Comptable
              </button>
            </form>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs lg:col-span-2 space-y-4">
            <h3 className="text-sm font-serif font-bold text-stone-900 border-b pb-3 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary-700" />
                Plan Comptable Régi (SYSCOHADA Simplifié)
              </span>
              <span className="text-xs font-bold text-stone-500 dark:text-stone-400 bg-stone-100 border px-2 py-1 rounded-lg">
                {planComptable.length} Comptes Enregistrés
              </span>
            </h3>

            <div className="overflow-x-auto max-h-[450px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs uppercase">
                    <th className="p-2">Classe</th>
                    <th className="p-2">Code Compte</th>
                    <th className="p-2">Intitulé SYSCOHADA</th>
                    <th className="p-2 text-center">Nature habituelle</th>
                    <th className="p-2 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {planComptable
                    .sort((a, b) => a.code.localeCompare(b.code))
                    .map((p) => {
                      const isCustom = customAccounts.some((c) => c.code === p.code);
                      return (
                        <tr key={p.code} className="hover:bg-stone-50">
                          <td className="p-2 text-stone-500 dark:text-stone-400 font-mono">Classe {p.classe}</td>
                          <td className="p-2 font-bold text-stone-800 font-mono">{p.code}</td>
                          <td className="p-2 text-stone-700 font-bold">{p.label}</td>
                          <td className="p-2 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-lg text-xs ${p.nature === "Débit" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
                              {p.nature}
                            </span>
                          </td>
                          <td className="p-2 text-center">
                            {isCustom ? (
                              <button
                                onClick={() => handleDeleteCustomAccount(p.code)}
                                className="text-danger-500 hover:text-danger-700 text-xs font-bold"
                              >
                                Supprimer
                              </button>
                            ) : (
                              <span className="text-xs font-black text-stone-500 dark:text-stone-400 uppercase tracking-widest">Réglementaire</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: JOURNAL DE SAISIE */}
      {activeSubTab === "journal" && (
        <div className="space-y-6">
          {/* Manual adjusting journal entry builder */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs space-y-4">
            <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary-700" />
              Saisie d'une Écriture d'Ajustement / OD (Opérations Diverses)
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
              {/* Form Info */}
              <div className="space-y-3 col-span-1 border-r border-stone-100 pr-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs uppercase font-semibold text-stone-500 block mb-1">Date d'opération</label>
                    <input
                      type="date"
                      value={meDate}
                      onChange={(e) => setMeDate(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg p-2 bg-stone-50"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase font-semibold text-stone-500 block mb-1">Référence / Pièce</label>
                    <input
                      type="text"
                      placeholder="Ex: OD-2026-01"
                      value={meRef}
                      onChange={(e) => setMeRef(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg p-2 bg-stone-50 font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold text-stone-500 block mb-1">Libellé de l'Écriture *</label>
                  <input
                    type="text"
                    placeholder="Ex: Apport personnel de capital social"
                    value={meLibelle}
                    onChange={(e) => setMeLibelle(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg p-2 bg-stone-50 font-bold"
                  />
                </div>

                <div className="bg-stone-50/50 p-3 rounded-xl border border-stone-150 space-y-2">
                  <span className="text-xs font-semibold uppercase text-stone-600 block mb-1">Ajouter une ligne d'imputation</span>
                  <select
                    value={meSelCompte}
                    onChange={(e) => setMeSelCompte(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg p-2 bg-white"
                  >
                    {planComptable.map((p) => (
                      <option key={p.code} value={p.code}>{p.code} - {p.label}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Montant Débit (F)"
                      value={meDebitVal}
                      onChange={(e) => setMeDebitVal(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg p-2 bg-white"
                    />
                    <input
                      type="number"
                      placeholder="Montant Crédit (F)"
                      value={meCreditVal}
                      onChange={(e) => setMeCreditVal(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg p-2 bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMeLine}
                    className="w-full py-1.5 bg-stone-250 hover:bg-primary-600 hover:text-white rounded-lg transition-all font-bold cursor-pointer"
                  >
                    + Imputer la ligne
                  </button>
                </div>
              </div>

              {/* Table Imputations */}
              <div className="col-span-2 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase text-stone-600 block">Lignes comptables saisies (Partie Double)</span>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-50 border-b text-xs uppercase font-bold text-stone-500">
                          <th className="p-2">Compte</th>
                          <th className="p-2">Libellé de compte</th>
                          <th className="p-2 text-right">Débit (FCFA)</th>
                          <th className="p-2 text-right">Crédit (FCFA)</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-medium">
                        {meLines.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center italic text-stone-500 dark:text-stone-400 bg-white">
                              Aucune imputation pour le moment. Remplissez le formulaire de gauche et cliquez sur "Imputer la ligne".
                            </td>
                          </tr>
                        ) : (
                          meLines.map((line, idx) => (
                            <tr key={idx} className="hover:bg-stone-50 bg-white">
                              <td className="p-2 font-mono font-bold text-stone-800">{line.compte}</td>
                              <td className="p-2 text-stone-700">{line.label}</td>
                              <td className="p-2 text-right font-mono font-bold text-blue-600">{line.debit > 0 ? line.debit.toLocaleString("fr-FR") : "—"}</td>
                              <td className="p-2 text-right font-mono font-bold text-purple-600">{line.credit > 0 ? line.credit.toLocaleString("fr-FR") : "—"}</td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setMeLines(meLines.filter((_, i) => i !== idx))}
                                  className="text-danger-500 hover:text-danger-700 text-xs font-black"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Validation and Totals footer */}
                {meLines.length > 0 && (
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex gap-4 text-xs font-black">
                      <span className="text-blue-700">Débits : {meLines.reduce((s, l) => s + l.debit, 0).toLocaleString("fr-FR")} F</span>
                      <span className="text-purple-700">Crédits : {meLines.reduce((s, l) => s + l.credit, 0).toLocaleString("fr-FR")} F</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {Math.abs(meLines.reduce((s, l) => s + l.debit, 0) - meLines.reduce((s, l) => s + l.credit, 0)) < 0.01 ? (
                        <div className="flex items-center gap-1.5 text-xs font-black text-success-700 bg-success-50 px-3 py-1.5 rounded-lg border border-success-250">
                          <Check className="w-4 h-4" /> Écriture équilibrée
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-black text-warning-700 bg-warning-50 px-3 py-1.5 rounded-lg border border-warning-250">
                          <AlertTriangle className="w-4 h-4" /> Déséquilibre : {(meLines.reduce((s, l) => s + l.debit, 0) - meLines.reduce((s, l) => s + l.credit, 0))} F
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleSaveManualEntry}
                        disabled={Math.abs(meLines.reduce((s, l) => s + l.debit, 0) - meLines.reduce((s, l) => s + l.credit, 0)) > 0.01}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-lg font-bold text-xs transition-all cursor-pointer"
                      >
                        Enregistrer l'OD
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sequential Journal Register */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-3">
              <h3 className="text-sm font-serif font-bold text-stone-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-700" />
                Journal Général des Écritures Comptables
              </h3>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
                <div className="relative max-w-xs w-full">
                  <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Rechercher par libellé, réf, compte..."
                    value={journalSearch}
                    onChange={(e) => setJournalSearch(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-1.5 focus:outline-none"
                  />
                </div>
                <button
                  id="print-journal-btn"
                  type="button"
                  onClick={() => setIsPrintJournalModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                  title="Imprimer le journal filtré"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer le Journal</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJournalPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg text-xs shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                  title="Exporter le journal en PDF"
                >
                  <Download className="w-4 h-4" />
                  <span>Exporter PDF</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
              {filteredJournal.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 py-8 text-center italic">Aucune écriture trouvée au journal.</p>
              ) : (
                filteredJournal.map((entry) => (
                  <div key={entry.id} className="border border-stone-150 rounded-xl bg-stone-50/20 p-3.5 space-y-2 text-xs hover:border-primary-500/30 transition-all">
                    <div className="flex items-center justify-between border-b border-dashed pb-1.5 text-stone-600">
                      <div className="flex items-center gap-2 font-bold">
                        <span className="font-mono text-stone-500 dark:text-stone-400">{new Date(entry.date).toLocaleDateString("fr-FR")}</span>
                        <span className="bg-stone-200/60 text-stone-700 px-2 py-0.5 rounded-lg text-xs font-mono">{entry.reference}</span>
                        <span className="text-stone-800">{entry.libelle}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xs font-semibold uppercase px-2 py-0.5 rounded-lg border ${
                          entry.source === "Facture" ? "bg-success-50 text-success-700 border-success-200" :
                          entry.source === "Dépense" ? "bg-danger-50 text-danger-700 border-danger-200" :
                          "bg-blue-50 text-blue-700 border-blue-200"
                        }`}>
                          {entry.source}
                        </span>
                        {entry.source === "Manuel" && (
                          <button onClick={() => handleDeleteManualEntry(entry.id)} className="text-stone-500 dark:text-stone-400 hover:text-danger-600">
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border overflow-hidden">
                      <table className="w-full text-sm text-left border-collapse">
                        <thead>
                          <tr className="bg-stone-50 border-b text-2xs uppercase font-bold text-stone-500 dark:text-stone-400">
                            <th className="p-1.5 w-24 pl-3">Compte</th>
                            <th className="p-1.5">Intitulé SYSCOHADA</th>
                            <th className="p-1.5 text-right w-28">Débit (F)</th>
                            <th className="p-1.5 text-right w-28 pr-3">Crédit (F)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50 font-medium">
                          {entry.lignes.map((line: any, idx: number) => {
                            const detail = planComptable.find((p) => p.code === line.compte);
                            return (
                              <tr key={idx} className="hover:bg-stone-50/50">
                                <td className="p-1.5 font-mono font-bold pl-3 text-stone-700">{line.compte}</td>
                                <td className="p-1.5 text-stone-500">{detail?.label || "Compte personnalisé"}</td>
                                <td className="p-1.5 text-right font-mono font-bold text-blue-600">{line.debit > 0 ? line.debit.toLocaleString("fr-FR") : ""}</td>
                                <td className="p-1.5 text-right font-mono font-bold text-purple-600 pr-3">{line.credit > 0 ? line.credit.toLocaleString("fr-FR") : ""}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: GRAND LIVRE & BALANCE */}
      {activeSubTab === "ledger" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grand Livre (Account Ledger explorer) */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs lg:col-span-1 space-y-4 self-start">
              <h3 className="text-sm font-serif font-bold text-stone-900 border-b pb-3 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary-700" />
                Grand Livre de Compte
              </h3>

              <div className="space-y-2">
                <label className="text-xs uppercase font-semibold text-stone-500 block">Sélectionner un compte d'imputation</label>
                <select
                  value={ledgerSelCompte}
                  onChange={(e) => setLedgerSelCompte(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg p-2 bg-stone-50 font-bold"
                >
                  {planComptable.map((p) => (
                    <option key={p.code} value={p.code}>{p.code} - {p.label}</option>
                  ))}
                </select>
              </div>

              {/* Transactions details */}
              <div className="space-y-3 pt-1">
                <div className="bg-stone-50 p-3 rounded-lg border text-xs">
                  <div className="flex justify-between font-bold mb-1">
                    <span className="text-stone-500">Mouvements Débit :</span>
                    <span className="text-blue-600 font-mono">
                      {(allJournalEntries
                        .flatMap((e) => e.lignes)
                        .filter((l) => l.compte === ledgerSelCompte)
                        .reduce((s, l) => s + (l.debit || 0), 0)
                      ).toLocaleString("fr-FR")} F
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-b border-stone-200 pb-1.5 mb-1.5">
                    <span className="text-stone-500">Mouvements Crédit :</span>
                    <span className="text-purple-600 font-mono">
                      {(allJournalEntries
                        .flatMap((e) => e.lignes)
                        .filter((l) => l.compte === ledgerSelCompte)
                        .reduce((s, l) => s + (l.credit || 0), 0)
                      ).toLocaleString("fr-FR")} F
                    </span>
                  </div>

                  {(() => {
                    const deb = allJournalEntries.flatMap((e) => e.lignes).filter((l) => l.compte === ledgerSelCompte).reduce((s, l) => s + (l.debit || 0), 0);
                    const cred = allJournalEntries.flatMap((e) => e.lignes).filter((l) => l.compte === ledgerSelCompte).reduce((s, l) => s + (l.credit || 0), 0);
                    const bal = planComptable.find((p) => p.code === ledgerSelCompte)?.nature === "Débit" ? deb - cred : cred - deb;
                    return (
                      <div className="flex justify-between items-center text-sm font-semibold text-stone-950 bg-stone-200/50 p-2 rounded-lg">
                        <span>Solde Net Comptable :</span>
                        <span className="font-mono">{bal.toLocaleString("fr-FR")} F</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="max-h-56 overflow-y-auto border border-stone-100 rounded-lg space-y-1.5 p-1 text-sm">
                  {allJournalEntries
                    .filter((e) => e.lignes.some((l: any) => l.compte === ledgerSelCompte))
                    .map((e, index) => {
                      const line = e.lignes.find((l: any) => l.compte === ledgerSelCompte);
                      return (
                        <div key={index} className="bg-stone-50/50 border p-2 rounded-lg flex justify-between gap-2">
                          <div>
                            <div className="font-bold text-stone-700 truncate max-w-[130px]" title={e.libelle}>{e.libelle}</div>
                            <div className="text-2xs text-stone-500 dark:text-stone-400 font-mono">{e.reference}</div>
                          </div>
                          <div className="text-right font-mono font-bold">
                            {line.debit > 0 ? (
                              <span className="text-blue-600">+{line.debit} D</span>
                            ) : (
                              <span className="text-purple-600">+{line.credit} C</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Trial Balance des Comptes */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-3xs lg:col-span-2 space-y-4">
              <h3 className="text-sm font-serif font-bold text-stone-900 border-b pb-3 flex items-center justify-between gap-4">
                <span className="flex items-center gap-2">
                  <Scale className="w-5 h-5 text-primary-700" />
                  Balance des Comptes (Séquence d'Équilibre)
                </span>
                <span className="text-xs font-black uppercase text-success-700 bg-success-50 border border-success-200 px-2 py-0.5 rounded-lg">
                  Double Entrée Validée
                </span>
              </h3>

              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs uppercase">
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Intitulé SYSCOHADA</th>
                      <th className="p-2.5 text-right">Cumul Débit</th>
                      <th className="p-2.5 text-right">Cumul Crédit</th>
                      <th className="p-2.5 text-right">Solde Débiteur</th>
                      <th className="p-2.5 text-right">Solde Créditeur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150 font-medium text-stone-800">
                    {planComptable
                      .filter((p) => {
                        const bal = accountBalances[p.code];
                        return bal && (bal.debit > 0 || bal.credit > 0);
                      })
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((p) => {
                        const b = accountBalances[p.code];
                        const sDeb = b.debit - b.credit > 0 ? b.debit - b.credit : 0;
                        const sCred = b.credit - b.debit > 0 ? b.credit - b.debit : 0;
                        return (
                          <tr key={p.code} className="hover:bg-stone-50">
                            <td className="p-2 font-mono font-bold">{p.code}</td>
                            <td className="p-2 text-stone-600 font-bold">{p.label}</td>
                            <td className="p-2 text-right font-mono text-stone-500">{b.debit > 0 ? b.debit.toLocaleString("fr-FR") : "—"}</td>
                            <td className="p-2 text-right font-mono text-stone-500">{b.credit > 0 ? b.credit.toLocaleString("fr-FR") : "—"}</td>
                            <td className="p-2 text-right font-mono font-bold text-blue-600">{sDeb > 0 ? sDeb.toLocaleString("fr-FR") : "—"}</td>
                            <td className="p-2 text-right font-mono font-bold text-purple-600">{sCred > 0 ? sCred.toLocaleString("fr-FR") : "—"}</td>
                          </tr>
                        );
                      })}

                    {/* Balance totals to prove mathematical balancing */}
                    <tr className="bg-stone-900 text-stone-100 font-black text-xs">
                      <td colSpan={2} className="p-3 pl-3 rounded-l-xl">CUMULS ET ÉQUILIBRE BALANCE (SYSCOHADA)</td>
                      <td className="p-3 text-right font-mono">
                        {allJournalEntries.flatMap(e => e.lignes).reduce((s, l) => s + (l.debit || 0), 0).toLocaleString("fr-FR")} F
                      </td>
                      <td className="p-3 text-right font-mono">
                        {allJournalEntries.flatMap(e => e.lignes).reduce((s, l) => s + (l.credit || 0), 0).toLocaleString("fr-FR")} F
                      </td>
                      <td className="p-3 text-right font-mono">
                        {planComptable
                          .reduce((s, p) => {
                            const b = accountBalances[p.code];
                            const sd = b ? b.debit - b.credit : 0;
                            return s + (sd > 0 ? sd : 0);
                          }, 0).toLocaleString("fr-FR")} F
                      </td>
                      <td className="p-3 text-right font-mono rounded-r-xl">
                        {planComptable
                          .reduce((s, p) => {
                            const b = accountBalances[p.code];
                            const sc = b ? b.credit - b.debit : 0;
                            return s + (sc > 0 ? sc : 0);
                          }, 0).toLocaleString("fr-FR")} F
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: AGENTS SÉCURISÉ */}
      {activeSubTab === "agents" && (
        <div className="space-y-6">
          {!isDirectorUnlocked ? (
            /* LOCK SCREEN */
            <div className="max-w-md mx-auto my-12 bg-white border border-stone-200 rounded-2xl p-8 shadow-md text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center border border-primary-100 text-primary-600 shadow-2xs">
                <Lock className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-serif font-bold text-stone-900">Accès Réservé au Directeur</h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Cette section confidentielle gère l'attribution des codes secrets d'identification de chaque praticien et agent de la clinique.
                </p>
              </div>

              <form onSubmit={handleUnlock} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                    Saisir le Code d'accès Directeur
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={enteredCode}
                      onChange={(e) => setEnteredCode(e.target.value)}
                      className="w-full text-sm border border-stone-200 rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-stone-50 focus:bg-white transition-all text-center font-mono font-bold tracking-widest text-stone-800"
                    />
                  </div>
                  {unlockError && (
                    <p className="text-xs text-danger-600 font-bold flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{unlockError}</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Déverrouiller l'Espace</span>
                </button>
              </form>

              <div className="pt-4 border-t border-stone-100">
                <p className="text-xs text-stone-500 dark:text-stone-400 italic">
                  Note : Par défaut pour la démonstration, le code d'accès est <span className="font-bold text-stone-600 font-mono">1234</span>. Vous pourrez le personnaliser à votre convenance une fois connecté.
                </p>
              </div>
            </div>
          ) : (
            /* UNLOCKED MANAGEMENT CONSOLE */
            <div className="space-y-6">
              {/* Top info and lock button bar */}
              <div className="bg-primary-950 text-white p-6 rounded-2xl shadow-md border border-primary-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-primary-400" />
                    <h3 className="text-base font-serif font-bold text-white">Espace de Gestion des Codes Confidentiels</h3>
                  </div>
                  <p className="text-sm text-primary-200">
                    Attribuez des codes d'accès/identification confidentiels uniques pour chaque médecin, infirmier et agent de {profile.name}.
                  </p>
                </div>
                <button
                  onClick={() => setIsDirectorUnlocked(false)}
                  className="px-3.5 py-1.5 bg-primary-850 hover:bg-primary-800 text-primary-100 hover:text-white border border-primary-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Verrouiller l'espace</span>
                </button>
              </div>

              {/* Main panel layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form to Add / Edit Agent */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
                  <div className="border-b border-stone-100 pb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-stone-50 rounded-lg text-primary-700 border border-stone-150">
                      <Users className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold font-serif text-stone-800">
                      {editingAgentId ? "Modifier l'Agent" : "Attribuer un Nouveau Code Agent"}
                    </h4>
                  </div>

                  <form onSubmit={handleAddOrEditAgent} className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                        Nom complet de l'agent
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Dr. Moussa Traoré, Marie Sanou"
                        value={newAgentNom}
                        onChange={(e) => setNewAgentNom(e.target.value)}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white outline-none font-medium text-stone-700"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                        Fonction / Rôle
                      </label>
                      <select
                        value={newAgentFonction}
                        onChange={(e) => setNewAgentFonction(e.target.value)}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white outline-none font-bold text-stone-700"
                      >
                        <option value="Médecin Généraliste">Médecin Généraliste</option>
                        <option value="Médecin Spécialiste">Médecin Spécialiste</option>
                        <option value="Pédiatre Spécialiste">Pédiatre Spécialiste</option>
                        <option value="Gynécologue">Gynécologue</option>
                        <option value="Infirmier(e) d'État">Infirmier(e) d'État</option>
                        <option value="Sage-femme / Maïeuticien">Sage-femme / Maïeuticien</option>
                        <option value="Secrétaire Médicale">Secrétaire Médicale</option>
                        <option value="Chef de Réception">Chef de Réception</option>
                        <option value="Comptable Principal">Comptable Principal</option>
                        <option value="Pharmacien Clinique">Pharmacien Clinique</option>
                        <option value="Technicien de Laboratoire">Technicien de Laboratoire</option>
                        <option value="Agent de Soutien">Agent de Soutien</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                        Code secret d'accès / PIN attribué
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: DR-202, COMP-12, REC-44"
                        value={newAgentCode}
                        onChange={(e) => setNewAgentCode(e.target.value)}
                        className="w-full border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white outline-none font-mono font-semibold text-stone-700 tracking-wider uppercase"
                        required
                      />
                      <p className="text-2xs text-stone-500 dark:text-stone-400 leading-tight italic mt-1">
                        Ce code servira d'identifiant unique à l'agent lors des signatures d'actes médicaux et opérations de caisse.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-2xs text-center"
                      >
                        {editingAgentId ? "Enregistrer" : "Créer & Attribuer"}
                      </button>
                      {editingAgentId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAgentId(null);
                            setNewAgentNom("");
                            setNewAgentFonction("Médecin Généraliste");
                            setNewAgentCode("");
                          }}
                          className="px-3 py-2 bg-stone-150 hover:bg-stone-200 text-stone-600 font-bold rounded-lg text-xs transition-all cursor-pointer"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Agents list table */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs lg:col-span-2 space-y-4">
                  <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-stone-50 rounded-lg text-primary-700 border border-stone-150">
                        <Users className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold font-serif text-stone-800">
                        Registre Confidentiel d'Attribution des Codes
                      </h4>
                    </div>
                    <span className="text-2xs font-black uppercase bg-primary-50 border border-primary-100 text-primary-700 px-2.5 py-0.5 rounded-full">
                      {agents.length} Agent(s) enregistré(s)
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-stone-150 rounded-xl">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-50 border-b text-2xs font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                          <th className="p-3 pl-4">Nom de l'Agent</th>
                          <th className="p-3">Fonction / Rôle</th>
                          <th className="p-3 text-center">Code Confidentiel</th>
                          <th className="p-3 text-right pr-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {agents.map((agent) => {
                          // Badge color helper based on function type
                          let badgeBg = "bg-stone-100 text-stone-700 border-stone-200";
                          if (agent.fonction.includes("Médecin") || agent.fonction.includes("Pédiatre") || agent.fonction.includes("Gynécologue")) {
                            badgeBg = "bg-blue-50 text-blue-700 border-blue-200/50";
                          } else if (agent.fonction.includes("Infirmier") || agent.fonction.includes("Sage-femme")) {
                            badgeBg = "bg-primary-50 text-primary-700 border-primary-200/50";
                          } else if (agent.fonction.includes("Réception") || agent.fonction.includes("Secrétaire")) {
                            badgeBg = "bg-danger-50 text-danger-700 border-danger-200/50";
                          } else if (agent.fonction.includes("Comptable")) {
                            badgeBg = "bg-purple-50 text-purple-700 border-purple-200/50";
                          } else if (agent.fonction.includes("Labo")) {
                            badgeBg = "bg-warning-50 text-warning-700 border-warning-200/50";
                          } else if (agent.fonction.includes("Pharmacien")) {
                            badgeBg = "bg-success-50 text-success-700 border-success-200/50";
                          }

                          return (
                            <tr key={agent.id} className="hover:bg-stone-50 transition-all">
                              <td className="p-3 pl-4 font-bold text-stone-800">{agent.nom}</td>
                              <td className="p-3">
                                <span className={`inline-block text-2xs font-bold border rounded-lg px-2 py-0.5 uppercase ${badgeBg}`}>
                                  {agent.fonction}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 text-stone-800 font-mono font-black text-sm rounded-lg border border-stone-200 tracking-wider">
                                  <Key className="w-3 h-3 text-warning-600" />
                                  {agent.code}
                                </span>
                              </td>
                              <td className="p-3 text-right pr-4 space-x-1.5">
                                <button
                                  onClick={() => handleEditClick(agent)}
                                  className="p-1.5 hover:bg-stone-100 hover:text-primary-700 rounded-lg text-stone-500 dark:text-stone-400 transition-all cursor-pointer"
                                  title="Modifier les coordonnées de cet agent"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAgent(agent.id)}
                                  className="p-1.5 hover:bg-danger-50 hover:text-danger-600 rounded-lg text-stone-500 dark:text-stone-400 transition-all cursor-pointer"
                                  title="Supprimer cet agent"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Safety parameters for Director */}
                  <div className="pt-4 border-t border-stone-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 bg-stone-50 border rounded-2xl p-4">
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-warning-600" />
                        <h5 className="text-sm font-bold text-stone-800 uppercase tracking-wide">
                          Modifier le Code d'accès Directeur
                        </h5>
                      </div>
                      <p className="text-xs text-stone-500 leading-relaxed">
                        Pour des raisons de sécurité évidents, nous vous conseillons de modifier régulièrement le code d'accès de votre espace de direction.
                      </p>

                      {isChangingDirectorCode ? (
                        <div className="flex gap-2 pt-1.5">
                          <input
                            type="text"
                            placeholder="Saisir nouveau code secret"
                            value={newDirectorCode}
                            onChange={(e) => setNewDirectorCode(e.target.value)}
                            className="text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white font-mono font-semibold text-stone-800 outline-none flex-1 uppercase"
                          />
                          <button
                            type="button"
                            onClick={handleSaveDirectorCode}
                            className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer uppercase"
                          >
                            Sauvegarder
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsChangingDirectorCode(false);
                              setNewDirectorCode("");
                            }}
                            className="bg-stone-200 text-stone-600 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsChangingDirectorCode(true)}
                          className="mt-1.5 px-3 py-1.5 bg-white hover:bg-stone-100 border border-stone-200 text-xs font-semibold text-stone-700 rounded-lg transition-all cursor-pointer uppercase"
                        >
                          Changer le code secret
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col justify-center p-4 bg-primary-50/50 border border-primary-100/50 rounded-2xl text-stone-600">
                      <p className="text-sm leading-relaxed">
                        <span className="font-semibold text-primary-850">ℹ️ Confidentialité stricte :</span> Les codes saisis sont enregistrés localement de manière sécurisée dans le navigateur de l'établissement et ne quittent jamais votre clinique.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB: STATISTIQUES RH */}
      {activeSubTab === "stats_rh" && (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="bg-stone-900 text-white p-6 rounded-2xl shadow-md border border-stone-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-400" />
                <h3 className="text-base font-serif font-bold text-white">Statistiques & Indicateurs des Ressources Humaines</h3>
              </div>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Visualisez la répartition des types de contrats, le taux d'absentéisme mensuel et gérez le calendrier prévisionnel des congés.
              </p>
            </div>
            <div className="bg-primary-950/40 border border-primary-900 text-primary-400 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-lg">
              {profile.name.slice(0, 15)} HR Analytics v1.2
            </div>
          </div>

          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-primary-50 rounded-xl text-primary-700 border border-primary-100">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">Effectif Total</span>
                <p className="text-lg font-black text-stone-800">
                  {hrContractsData.reduce((acc, curr) => acc + curr.value, 0)} agents
                </p>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-700 border border-blue-100">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">Absentéisme Moyen</span>
                <p className="text-lg font-black text-stone-800">
                  {(hrAbsenteeismData.reduce((acc, curr) => acc + curr.taux, 0) / hrAbsenteeismData.length).toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-purple-50 rounded-xl text-purple-700 border border-purple-100">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">Congés Actifs & Prévus</span>
                <p className="text-lg font-black text-stone-800">
                  {hrLeaves.filter(l => l.statut !== "Terminé").length} départs
                </p>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-2xs flex items-center gap-3">
              <div className="p-3 bg-warning-50 rounded-xl text-warning-700 border border-warning-100">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <span className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">Formation Interne</span>
                <p className="text-lg font-black text-stone-800">140 h / an</p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart: Répartition des Contrats */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="border-b border-stone-100 pb-3">
                <h4 className="text-xs font-bold font-serif text-stone-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary-600" />
                  Répartition des Contrats du Personnel
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Pourcentage et nombre absolu des types de contrats actifs</p>
              </div>

              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hrContractsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      isAnimationActive={true}
                    >
                      {hrContractsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => [`${value} Agents`, "Effectif"]}
                      contentStyle={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e5e5e0", fontSize: "11px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Legends */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs border-t border-stone-50 font-medium">
                {hrContractsData.map((entry, idx) => (
                  <div key={idx} className="flex flex-col items-center text-center p-2 bg-stone-50 rounded-lg">
                    <div className="flex items-center gap-1.5 font-bold text-stone-700">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                      <span>{entry.name}</span>
                    </div>
                    <span className="font-mono font-bold text-stone-800 mt-1">{entry.value} agents ({(entry.value / hrContractsData.reduce((a,c) => a+c.value, 0) * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar Chart: Taux d'Absentéisme Mensuel */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="border-b border-stone-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold font-serif text-stone-800 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-primary-600" />
                    Taux d'Absentéisme Mensuel (%)
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium">Évolution temporelle et seuil d'alerte RH de 4%</p>
                </div>
                <div className="text-2xs bg-warning-50 text-warning-800 border border-warning-100 rounded-lg px-2 py-0.5 font-bold uppercase shrink-0">
                  Paludisme accru en Juillet
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hrAbsenteeismData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#78716c" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#78716c" }} unit="%" domain={[0, 8]} />
                    <Tooltip 
                      formatter={(value: any) => [`${value}%`, "Taux d'absences"]}
                      contentStyle={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e5e5e0", fontSize: "11px" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Bar 
                      name="Taux réel observé" 
                      dataKey="taux" 
                      fill="#0284c7" 
                      radius={[4, 4, 0, 0]}
                      maxBarSize={35}
                      isAnimationActive={true}
                      animationDuration={1200}
                      animationEasing="ease-out"
                      activeBar={{ fillOpacity: 0.85, stroke: "#0369a1", strokeWidth: 1.5 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Interactive Simulation Panel for Absenteeism */}
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <span className="text-2xs uppercase font-black tracking-wider text-primary-800 block">Simulation & Ajustement interactif des taux</span>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {hrAbsenteeismData.map((d, idx) => (
                    <div key={idx} className="bg-stone-50 border p-1.5 rounded-lg flex flex-col items-center">
                      <span className="text-[8px] font-bold text-stone-500 font-mono">{d.month.slice(0, 4)}.</span>
                      <span className="text-xs font-black font-mono text-blue-700 mt-0.5">{d.taux}%</span>
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="0.1"
                        value={d.taux}
                        onChange={(e) => handleUpdateAbsenteeismTaux(d.month, parseFloat(e.target.value))}
                        className="w-full mt-1.5 accent-blue-600 h-1 cursor-pointer"
                        title={`Ajuster ${d.month}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Planned Leaves Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form to Schedule Leave */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-4">
              <div className="border-b border-stone-100 pb-3 flex items-center gap-2">
                <div className="p-1.5 bg-stone-50 rounded-lg text-primary-700 border border-stone-150">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold font-serif text-stone-800">
                  Planifier un nouveau congé d'agent
                </h4>
              </div>

              <form onSubmit={handleAddLeave} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                    Nom de l'agent
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Dr. Fatoumata Ouattara, Marie Sanou"
                    value={newLeaveAgent}
                    onChange={(e) => setNewLeaveAgent(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white outline-none font-medium text-stone-700"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Rôle / Fonction
                    </label>
                    <select
                      value={newLeaveFonction}
                      onChange={(e) => setNewLeaveFonction(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white outline-none font-bold text-stone-700"
                    >
                      <option value="Médecin Généraliste">Médecin</option>
                      <option value="Pédiatre Spécialiste">Pédiatre</option>
                      <option value="Sage-femme">Sage-femme</option>
                      <option value="Infirmier(e)">Infirmier(e)</option>
                      <option value="Chef de Réception">Réception</option>
                      <option value="Comptable Principal">Comptabilité</option>
                      <option value="Pharmacien Clinique">Pharmacie</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Type de congé
                    </label>
                    <select
                      value={newLeaveType}
                      onChange={(e) => setNewLeaveType(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white outline-none font-bold text-stone-700"
                    >
                      <option value="Congé Annuel">Congé Annuel</option>
                      <option value="Maladie">Repos Maladie</option>
                      <option value="Maternité">Maternité</option>
                      <option value="Formation">Formation</option>
                      <option value="Remplissage">Autre</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Date de début
                    </label>
                    <input
                      type="date"
                      value={newLeaveDebut}
                      onChange={(e) => setNewLeaveDebut(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white outline-none font-medium text-stone-700"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Date de fin
                    </label>
                    <input
                      type="date"
                      value={newLeaveFin}
                      onChange={(e) => setNewLeaveFin(e.target.value)}
                      className="w-full border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white outline-none font-medium text-stone-700"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                    Statut de validation
                  </label>
                  <select
                    value={newLeaveStatut}
                    onChange={(e) => setNewLeaveStatut(e.target.value)}
                    className="w-full border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white outline-none font-bold text-stone-700"
                  >
                    <option value="Approuvé">Approuvé & Validé</option>
                    <option value="En cours">En cours d'exécution</option>
                    <option value="En attente">En attente de signature</option>
                    <option value="Terminé">Terminé / Clos</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-2xs text-center"
                >
                  Ajouter au planning RH
                </button>
              </form>
            </div>

            {/* List of Planned Leaves */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs lg:col-span-2 space-y-4">
              <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-stone-50 rounded-lg text-primary-700 border border-stone-150">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold font-serif text-stone-800">
                    Planning & Calendrier Prévisionnel des Départs
                  </h4>
                </div>
                <span className="text-2xs font-black uppercase bg-stone-100 text-stone-600 border border-stone-200 px-2.5 py-0.5 rounded-full">
                  {hrLeaves.length} Fiches
                </span>
              </div>

              <div className="overflow-x-auto border border-stone-150 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b text-2xs font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                      <th className="p-3 pl-4">Nom de l'Agent</th>
                      <th className="p-3">Type / Rôle</th>
                      <th className="p-3">Période du Congé</th>
                      <th className="p-3 text-center">Durée (Jrs)</th>
                      <th className="p-3 text-center">Statut</th>
                      <th className="p-3 text-right pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {hrLeaves.map((leave) => {
                      // Status styling
                      let statusStyle = "bg-warning-50 text-warning-700 border-warning-250/50";
                      if (leave.statut === "Approuvé") {
                        statusStyle = "bg-primary-50 text-primary-700 border-primary-200";
                      } else if (leave.statut === "En cours") {
                        statusStyle = "bg-blue-50 text-blue-700 border-blue-200";
                      } else if (leave.statut === "Terminé") {
                        statusStyle = "bg-stone-100 text-stone-500 border-stone-200";
                      }

                      // Leave type badge colors
                      let typeColor = "text-purple-700 bg-purple-50";
                      if (leave.type === "Maladie") {
                        typeColor = "text-danger-700 bg-danger-50";
                      } else if (leave.type === "Maternité") {
                        typeColor = "text-warning-700 bg-warning-50";
                      } else if (leave.type === "Formation") {
                        typeColor = "text-blue-700 bg-blue-50";
                      }

                      return (
                        <tr key={leave.id} className="hover:bg-stone-50 transition-all font-medium">
                          <td className="p-3 pl-4">
                            <p className="font-bold text-stone-850">{leave.agent}</p>
                            <span className="text-2xs text-stone-500 dark:text-stone-400 font-medium">{leave.fonction}</span>
                          </td>
                          <td className="p-3">
                            <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-lg border border-transparent ${typeColor}`}>
                              {leave.type}
                            </span>
                          </td>
                          <td className="p-3 text-xs font-mono text-stone-500">
                            Du {new Date(leave.debut).toLocaleDateString("fr-FR")} au {new Date(leave.fin).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="p-3 text-center font-bold font-mono text-stone-800">
                            {leave.jours} jrs
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-lg border ${statusStyle}`}>
                              {leave.statut}
                            </span>
                          </td>
                          <td className="p-3 text-right pr-4">
                            <button
                              type="button"
                              onClick={() => handleDeleteLeave(leave.id)}
                              className="p-1 hover:bg-danger-50 hover:text-danger-600 rounded-lg text-stone-500 dark:text-stone-400 transition-all cursor-pointer"
                              title="Retirer ce congé du planning"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMPRESSION DU JOURNAL MODAL */}
      {isPrintJournalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print">
          <div className="w-full max-w-4xl rounded-2xl shadow-xl border overflow-hidden max-h-[90vh] flex flex-col bg-white border-stone-200 text-stone-800">
            {/* Modal Header */}
            <div className="p-4 border-b flex justify-between items-center no-print border-stone-100">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary-600" />
                <h3 className="font-serif font-bold text-base">Aperçu avant Impression du Journal</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer le journal
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintJournalModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
            </div>

            {/* Modal Content / Printable Document */}
            <div className="flex-1 overflow-y-auto p-8 print-full-width print:p-0 print:overflow-visible">
              <div className="print-card space-y-8 bg-white text-stone-900">
                {/* Header for print */}
                <div className="border-b-4 border-double border-primary-600 pb-4 text-center">
                  <h1 className="text-2xl font-serif font-semibold text-primary-700 uppercase tracking-wide">{profile.name}</h1>
                  <p className="text-xs font-mono uppercase tracking-widest text-stone-500 mt-1">{profile.address} — Tél/WhatsApp: {profile.phone} — {profile.slogan}</p>
                  <div className="mt-4 bg-primary-50 text-primary-800 py-1.5 px-4 rounded-full font-serif font-bold text-xs tracking-wide inline-block border border-primary-100">
                    JOURNAL GÉNÉRAL DES ÉCRITURES COMPTABLES
                  </div>
                </div>

                {/* Meta details & Period */}
                <div className="grid grid-cols-2 gap-4 text-xs border-b border-stone-100 pb-4">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-primary-800">Période du Rapport</h4>
                    <p className="mt-1 text-stone-700 font-bold">
                      {startDate || endDate ? (
                        <>
                          {startDate ? `Du ${new Date(startDate).toLocaleDateString("fr-FR")}` : ""} {endDate ? `au ${new Date(endDate).toLocaleDateString("fr-FR")}` : ""}
                        </>
                      ) : (
                        "Toutes périodes confondues"
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-primary-800 font-serif">Date d'édition</h4>
                    <p className="mt-1 text-stone-500 font-mono">{new Date().toLocaleString("fr-FR")}</p>
                  </div>
                </div>

                {/* Financial Summary KPIs */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-3">Synthèse du journal filtré</h3>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-stone-50 border p-2.5 rounded-lg text-center">
                      <span className="text-2xs uppercase tracking-wide text-stone-500 dark:text-stone-400 font-semibold">Nombre d'écritures</span>
                      <p className="text-sm font-bold text-stone-800 mt-0.5">{filteredJournal.length}</p>
                    </div>
                    <div className="bg-stone-50 border p-2.5 rounded-lg text-center">
                      <span className="text-2xs uppercase tracking-wide text-stone-500 dark:text-stone-400 font-semibold">Total Débit</span>
                      <p className="text-sm font-bold text-blue-700 mt-0.5">{printJournalTotalDebit.toLocaleString("fr-FR")} F</p>
                    </div>
                    <div className="bg-stone-50 border p-2.5 rounded-lg text-center">
                      <span className="text-2xs uppercase tracking-wide text-stone-500 dark:text-stone-400 font-semibold">Total Crédit</span>
                      <p className="text-sm font-bold text-purple-700 mt-0.5">{printJournalTotalCredit.toLocaleString("fr-FR")} F</p>
                    </div>
                    <div className="bg-stone-50 border p-2.5 rounded-lg text-center flex flex-col justify-center items-center">
                      <span className="text-2xs uppercase tracking-wide text-stone-500 dark:text-stone-400 font-semibold">Statut d'Équilibre</span>
                      {Math.abs(printJournalTotalDebit - printJournalTotalCredit) < 0.01 ? (
                        <span className="text-2xs font-bold text-success-700 bg-success-50 px-1.5 py-0.5 rounded-lg border border-success-200 mt-0.5 uppercase">Équilibré</span>
                      ) : (
                        <span className="text-2xs font-bold text-warning-700 bg-warning-50 px-1.5 py-0.5 rounded-lg border border-warning-200 mt-0.5 uppercase">Écart: {(printJournalTotalDebit - printJournalTotalCredit).toLocaleString("fr-FR")} F</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Journal Records */}
                <div className="space-y-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-2">Détail des Écritures</h3>
                  {filteredJournal.length === 0 ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 text-center italic py-4">Aucune écriture à afficher.</p>
                  ) : (
                    filteredJournal.map((entry, idx) => (
                      <div key={idx} className="border border-stone-200 rounded-lg overflow-hidden bg-stone-50/10">
                        <div className="bg-stone-50 border-b p-2 flex items-center justify-between text-sm font-bold text-stone-700">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-stone-500">{new Date(entry.date).toLocaleDateString("fr-FR")}</span>
                            <span className="bg-stone-200 text-stone-800 px-1.5 py-0.5 rounded-lg font-mono text-2xs">{entry.reference}</span>
                            <span className="text-stone-900">{entry.libelle}</span>
                          </div>
                          <span className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-lg border bg-white text-stone-600 border-stone-200">
                            {entry.source}
                          </span>
                        </div>
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="bg-white border-b text-[8px] uppercase font-bold text-stone-500 dark:text-stone-400">
                              <th className="p-1.5 w-20 pl-3">Compte</th>
                              <th className="p-1.5">Intitulé SYSCOHADA</th>
                              <th className="p-1.5 text-right w-24">Débit (FCFA)</th>
                              <th className="p-1.5 text-right w-24 pr-3">Crédit (FCFA)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 font-medium bg-white">
                            {entry.lignes.map((line: any, lIdx: number) => {
                              const detail = planComptable.find((p) => p.code === line.compte);
                              return (
                                <tr key={lIdx}>
                                  <td className="p-1.5 font-mono font-bold pl-3 text-stone-850">{line.compte}</td>
                                  <td className="p-1.5 text-stone-550">{detail?.label || "Compte personnalisé"}</td>
                                  <td className="p-1.5 text-right font-mono font-bold text-stone-800">{line.debit > 0 ? line.debit.toLocaleString("fr-FR") : "—"}</td>
                                  <td className="p-1.5 text-right font-mono font-bold text-stone-800 pr-3">{line.credit > 0 ? line.credit.toLocaleString("fr-FR") : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
                </div>

                {/* Signature zone */}
                <div className="pt-12 grid grid-cols-2 gap-4 text-center text-xs">
                  <div>
                    <p className="font-semibold text-stone-700 uppercase tracking-wide">Le Comptable</p>
                    <div className="h-16"></div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic">Signature & Cachet</p>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-700 uppercase tracking-wide">La Direction</p>
                    <div className="h-16"></div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic">Signature & Cachet</p>
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
