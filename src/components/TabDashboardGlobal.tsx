import React, { useRef } from "react";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import html2canvas from "html2canvas";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { 
  Hospitalisation, 
  Medicament, 
  RendezVous, 
  PatientUrgence, 
  Consultation, 
  Staff,
  GardeAgent,
  ExamenLabo
} from "../types";
import { 
  HeartPulse, 
  Percent, 
  AlertTriangle, 
  Calendar, 
  Users, 
  TrendingUp, 
  Clock, 
  ChevronRight, 
  Package, 
  ShieldAlert, 
  Stethoscope,
  ArrowUpRight,
  Plus,
  FileDown,
  Lock,
  Unlock,
  Key,
  Edit3,
  Trash2,
  Search,
  Printer,
  X,
  FileText,
  CheckCircle,
  HelpCircle,
  Check,
  History,
  Bell,
  Wallet
} from "lucide-react";
import { jsPDF } from "jspdf";

interface TabDashboardGlobalProps {
  hospitalisations: Hospitalisation[];
  hospCapacite: number;
  medicaments: Medicament[];
  rdvs: RendezVous[];
  urgences: PatientUrgence[];
  consultations: Consultation[];
  staff: Staff[];
  setActiveTab: (tab: string) => void;
  setHeaderSearchQuery?: (query: string) => void;
  filterPatientQuery?: string;
  theme: "light" | "dark";
  medTypeThresholds?: Record<string, number>;
  medCategoryThresholds?: Record<string, number>;
  thresholdApplyMode?: "category" | "individual";
  laboExamens?: ExamenLabo[];
}

export default function TabDashboardGlobal({
  hospitalisations,
  hospCapacite = 20,
  medicaments,
  rdvs,
  urgences,
  consultations,
  staff,
  setActiveTab,
  setHeaderSearchQuery,
  filterPatientQuery,
  theme,
  laboExamens = []
}: TabDashboardGlobalProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = React.useState(false);
  const [showHistorique, setShowHistorique] = React.useState(false);

  // Rappel réunion mensuelle du service (annoncée par WhatsApp chaque 5 du mois)
  const reunionMonthKey = `dg_reunion_reminder_dismissed_${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [reunionReminderDismissed, setReunionReminderDismissed] = useCloudSyncedState<boolean>(reunionMonthKey, false);
  const todayDate = new Date();
  const showReunionReminder = todayDate.getDate() >= 5 && !reunionReminderDismissed;
  const dismissReunionReminder = () => {
    setReunionReminderDismissed(true);
  };

  // Rappel paie mensuelle (annoncée par WhatsApp chaque 5 du mois)
  const paieMonthKey = `dg_paie_reminder_dismissed_${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [paieReminderDismissed, setPaieReminderDismissed] = useCloudSyncedState<boolean>(paieMonthKey, false);
  const showPaieReminder = todayDate.getDate() >= 5 && !paieReminderDismissed;
  const dismissPaieReminder = () => {
    setPaieReminderDismissed(true);
  };

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

  const reunionWhatsAppMessage = encodeURIComponent(
    `📅 Rappel — Réunion mensuelle du service\n\n` +
    `Bonjour à tous,\n\n` +
    `Merci de noter la tenue de la réunion mensuelle du service ce mois-ci. Votre présence est importante.\n\n` +
    `— ${profile.name}`
  );

  const paieWhatsAppMessage = encodeURIComponent(
    `💰 Rappel — Paie mensuelle\n\n` +
    `Bonjour,\n\n` +
    `Merci de procéder au traitement de la paie du personnel pour le mois en cours.\n\n` +
    `— ${profile.name}`
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  // Securisation des codes agents (Directeur) - Dashboard global
  // Synchronisé en temps réel via Firestore (useCloudSyncedState) : un
  // changement de code sur un appareil est immédiatement visible sur les autres.
  const [directorCode, setDirectorCode] = useCloudSyncedState<string>("dg_director_code", "1234");
  const [isDirectorUnlocked, setIsDirectorUnlocked] = React.useState(false);
  const [enteredCode, setEnteredCode] = React.useState("");
  const [unlockError, setUnlockError] = React.useState("");
  const [newDirectorCode, setNewDirectorCode] = React.useState("");
  const [isChangingDirectorCode, setIsChangingDirectorCode] = React.useState(false);

  const [agents, setAgents] = useCloudSyncedState<any[]>("dg_agents_codes_list", []);

  const [newAgentNom, setNewAgentNom] = React.useState("");
  const [newAgentFonction, setNewAgentFonction] = React.useState("Médecin Généraliste");
  const [newAgentCode, setNewAgentCode] = React.useState("");
  const [editingAgentId, setEditingAgentId] = React.useState<string | null>(null);

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
    setNewAgentFonction("Médecin Généraliste");
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

  // --- ÉTATS PORTAIL DE GARDE DES AGENTS ---
  const [gardes, setGardes] = useCloudSyncedState<GardeAgent[]>("dg_staff_gardes_schedule", []);

  const [filterGardeDate, setFilterGardeDate] = React.useState(todayStr);
  const [filterGardeService, setFilterGardeService] = React.useState("Tous");

  // State variables for Scheduling a Guard
  const [newGardeAgentId, setNewGardeAgentId] = React.useState("");
  const [newGardeAgentNom, setNewGardeAgentNom] = React.useState("");
  const [newGardeDate, setNewGardeDate] = React.useState(todayStr);
  const [newGardeShift, setNewGardeShift] = React.useState("Nuit (21h-07h)");
  const [newGardeService, setNewGardeService] = React.useState("Urgences");
  const [newGardeStatut, setNewGardeStatut] = React.useState("Confirmé");
  const [newGardeNotes, setNewGardeNotes] = React.useState("");
  const [editingGardeId, setEditingGardeId] = React.useState<string | null>(null);

  const saveGardes = (newGardes: GardeAgent[]) => {
    setGardes(newGardes);
  };

  const handleAddOrEditGarde = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Determine agent name and role
    let finalNom = newGardeAgentNom.trim();
    let finalFonction = "Personnel Clinique";
    
    if (newGardeAgentId) {
      const selectedStaff = staff.find(s => s.id === newGardeAgentId);
      if (selectedStaff) {
        finalNom = selectedStaff.nom;
        finalFonction = selectedStaff.poste;
      }
    }

    if (!finalNom) {
      alert("Veuillez sélectionner un membre du personnel ou écrire son nom.");
      return;
    }

    if (editingGardeId) {
      const updated = gardes.map(g => g.id === editingGardeId ? {
        ...g,
        agentId: newGardeAgentId,
        agentNom: finalNom,
        agentFonction: finalFonction,
        date: newGardeDate,
        shift: newGardeShift,
        service: newGardeService,
        statut: newGardeStatut,
        notes: newGardeNotes.trim()
      } : g);
      saveGardes(updated);
      setEditingGardeId(null);
      alert("Garde mise à jour avec succès !");
    } else {
      const newG = {
        id: "garde-" + Date.now(),
        agentId: newGardeAgentId,
        agentNom: finalNom,
        agentFonction: finalFonction,
        date: newGardeDate,
        shift: newGardeShift,
        service: newGardeService,
        statut: newGardeStatut,
        notes: newGardeNotes.trim()
      };
      saveGardes([newG, ...gardes]);
      alert("Garde planifiée avec succès !");
    }

    // Reset inputs
    setNewGardeAgentId("");
    setNewGardeAgentNom("");
    setNewGardeNotes("");
  };

  const handleDeleteGarde = (id: string) => {
    if (confirm("Voulez-vous vraiment annuler cette garde ?")) {
      const updated = gardes.filter(g => g.id !== id);
      saveGardes(updated);
    }
  };

  const handleEditGardeClick = (garde: GardeAgent) => {
    setEditingGardeId(garde.id);
    setNewGardeAgentId(garde.agentId || "");
    setNewGardeAgentNom(garde.agentNom);
    setNewGardeDate(garde.date);
    setNewGardeShift(garde.shift);
    setNewGardeService(garde.service);
    setNewGardeStatut(garde.statut);
    setNewGardeNotes(garde.notes || "");
  };

  // Filter guards schedule
  const filteredGardes = React.useMemo(() => {
    return gardes.filter(g => {
      const matchesDate = g.date === filterGardeDate;
      const matchesService = filterGardeService === "Tous" || g.service === filterGardeService;
      return matchesDate && matchesService;
    });
  }, [gardes, filterGardeDate, filterGardeService]);

  const handlePrintGardes = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    doc.setFillColor(13, 148, 136); // teal-600
    doc.rect(0, 0, 210, 12, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.text(`${profile.name.toUpperCase()} • ROSTER DE GARDE`, 15, 8);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    // format date as French string
    let dateStrFr = filterGardeDate;
    try {
      const d = new Date(filterGardeDate);
      if (!isNaN(d.getTime())) {
        dateStrFr = d.toLocaleDateString("fr-FR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
    } catch(e){}

    doc.text(`Registre du personnel de garde du : ${dateStrFr}`, 15, 22);
    doc.text(`Service filtré : ${filterGardeService}`, 15, 27);

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 32, 195, 32);

    // Table Headers
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text("Agent", 15, 38);
    doc.text("Fonction / Poste", 60, 38);
    doc.text("Service", 110, 38);
    doc.text("Shift / Horaire", 145, 38);
    doc.text("Statut", 182, 38);

    doc.line(15, 41, 195, 41);

    // Table rows
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);

    let y = 47;
    filteredGardes.forEach((g) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(g.agentNom, 15, y);
      doc.text(g.agentFonction, 60, y);
      doc.text(g.service, 110, y);
      doc.text(g.shift, 145, y);
      doc.text(g.statut, 182, y);
      
      if (g.notes) {
        y += 5;
        doc.setFont("Helvetica", "oblique");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`Note: ${g.notes}`, 20, y);
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(70, 70, 70);
      }

      y += 8;
    });

    if (filteredGardes.length === 0) {
      doc.text("Aucun agent de garde planifié pour ce jour ou ce service.", 15, y + 10);
    }

    doc.save(`planning_garde_${filterGardeDate}.pdf`);
  };

  // 1. Hospitalized patients stats
  const activeHosp = hospitalisations.filter((h) => h.statut === "En cours");
  const activeHospCount = activeHosp.length;

  // 2. Bed occupancy calculations
  const occupancyRate = hospCapacite > 0 ? Math.round((activeHospCount / hospCapacite) * 100) : 0;

  // 3. Urgent stock alerts
  const urgentMeds = medicaments.filter((m) => m.stock <= m.seuil);
  const urgentMedsCount = urgentMeds.length;

  // 4. Appointments of the day
  const todayRdvs = rdvs.filter((r) => r.date === todayStr);
  const todayRdvsCount = todayRdvs.length;

  // Helper stats for trend/context
  const activeUrgencesCount = urgences.filter((u) => u.statut !== "Sorti(e) ou Libéré(e)").length;
  const todayConsultationsCount = consultations.filter((c) => c.date === todayStr).length;

  const getElapsedMinutesDisplay = (createdAtStr: string): string => {
    if (!createdAtStr) return "0 min";
    const start = new Date(createdAtStr);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - start.getTime());
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const criticalPatients = React.useMemo(() => {
    return urgences
      .filter(
        (u) =>
          u.statut !== "Sorti(e) ou Libéré(e)" &&
          (u.severite === "Urgence Vitale (Rouge)" || u.severite === "Très Urgent (Orange)")
      )
      .sort((a, b) => {
        const scoreA = a.severite === "Urgence Vitale (Rouge)" ? 2 : 1;
        const scoreB = b.severite === "Urgence Vitale (Rouge)" ? 2 : 1;
        return scoreB - scoreA;
      });
  }, [urgences]);

  // Calcul de la répartition des statuts des examens de laboratoire
  const labChartData = React.useMemo(() => {
    let enAttente = 0;
    let preleve = 0;
    let enAnalyse = 0;
    let valide = 0;
    
    laboExamens.forEach(exam => {
      if (exam.statut === "En attente" || exam.statut === "Demandé") enAttente++;
      else if (exam.statut === "Prélevé") preleve++;
      else if (exam.statut === "En cours d'analyse") enAnalyse++;
      else valide++; // Validé, Prêt, Résultat disponible
    });

    return [
      { name: "En attente", value: enAttente, color: "#f59e0b" }, // amber-500
      { name: "Prélevé", value: preleve, color: "#0ea5e9" }, // sky-500
      { name: "En analyse", value: enAnalyse, color: "#4f46e5" }, // indigo-600
      { name: "Validé", value: valide, color: "#10b981" } // emerald-500
    ].filter(d => d.value > 0); // Only show statuses with exams
  }, [laboExamens]);

  // Calcul du flux des patients sur les 7 derniers jours (arrivées vs sorties)
  const chartData = React.useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

      // Arrivées: consultations du jour + admissions hospitalisations + urgences admises
      const dailyConsults = consultations.filter((c) => c.date === dateStr || (c.createdAt && c.createdAt.slice(0, 10) === dateStr)).length;
      const dailyHosp = hospitalisations.filter((h) => h.dateAdmission === dateStr || (h.createdAt && h.createdAt.slice(0, 10) === dateStr)).length;
      const dailyUrguences = urgences.filter((u) => u.dateArrivee === dateStr || (u.createdAt && u.createdAt.slice(0, 10) === dateStr)).length;

      // Sorties: hospitalisations libérées + urgences sorties
      const dailyDischarges = hospitalisations.filter((h) => h.statut !== "En cours" && h.dateSortie === dateStr).length;
      const dailyUrgReleased = urgences.filter((u) => u.statut === "Sorti(e) ou Libéré(e)" && (u.createdAt && u.createdAt.slice(0, 10) === dateStr)).length;

      data.push({
        name: label,
        date: dateStr,
        "Arrivées (Consults/Admissions)": dailyConsults + dailyHosp + dailyUrguences,
        "Départs (Sorties/Clôtures)": dailyDischarges + dailyUrgReleased,
        "Consultations": dailyConsults,
      });
    }
    return data;
  }, [consultations, hospitalisations, urgences]);

  // Bed breakdown per service
  const serviceStats: Record<string, number> = {
    "Pédiatrie": 0,
    "Maternité": 0,
    "Médecine Générale": 0,
    "Urgences / Obs": 0
  };

  activeHosp.forEach((h) => {
    const s = h.service || "Médecine Générale";
    if (serviceStats[s] !== undefined) {
      serviceStats[s]++;
    } else {
      serviceStats[s] = 1;
    }
  });

  const exportPdf = async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const addHeader = (pageNum: number) => {
      // Top bar color (teal)
      doc.setFillColor(13, 148, 136); // teal-600
      doc.rect(0, 0, 210, 12, "F");

      // Title
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(`${profile.name.toUpperCase()} • RAPPORT OPÉRATIONNEL`, 15, 8);

      // Page num
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Page ${pageNum}`, 190, 8);
    };

    const addFooter = () => {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(115, 115, 115); // stone-500
      doc.text(`Document confidentiel généré par l'application ${profile.name}. Tous droits réservés.`, 15, 287);
      doc.text(`Date d'export : ${new Date().toLocaleString("fr-FR")}`, 145, 287);
    };

    // PAGE 1
    addHeader(1);

    let y = 25;

    // Document Title Section
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(28, 25, 23); // stone-900
    doc.text("Tableau de Bord Décisionnel", 15, y);
    
    y += 6;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 113, 108); // stone-500
    doc.text(`Date du rapport : ${new Date().toLocaleDateString("fr-FR", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 15, y);
    
    y += 10;
    
    // Draw a divider line
    doc.setDrawColor(231, 229, 228); // stone-200
    doc.line(15, y, 195, y);
    
    y += 10;

    // KPI Cards: Patients Hospitalisés & Occupation Lits
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text("1. Indicateurs Opérationnels Clés", 15, y);
    
    y += 8;

    // We can draw 4 KPI blocks using rectangles
    const cardW = 85;
    const cardH = 22;

    // Card 1: Patients Hospitalisés
    doc.setFillColor(245, 245, 244); // stone-100
    doc.roundedRect(15, y, cardW, cardH, 3, 3, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108); // stone-500
    doc.text("PATIENTS HOSPITALISÉS", 19, y + 6);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text(`${activeHospCount}`, 19, y + 16);

    // Card 2: Taux d'Occupation
    doc.roundedRect(110, y, cardW, cardH, 3, 3, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108); // stone-500
    doc.text("OCCUPATION DES LITS", 114, y + 6);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(16, 185, 129); // emerald-500
    doc.text(`${occupancyRate}%`, 114, y + 16);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text(`(${activeHospCount} occupés sur ${hospCapacite})`, 134, y + 15);

    y += cardH + 6;

    // Card 3: Stocks Critiques
    doc.setFillColor(245, 245, 244);
    doc.roundedRect(15, y, cardW, cardH, 3, 3, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text("STOCKS PHARMACIE CRITIQUES", 19, y + 6);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(220, 38, 38); // rose-600
    doc.text(`${urgentMedsCount}`, 19, y + 16);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text("médicaments sous le seuil", 27, y + 15);

    // Card 4: Rendez-vous
    doc.roundedRect(110, y, cardW, cardH, 3, 3, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120, 113, 108);
    doc.text("RENDEZ-VOUS DU JOUR", 114, y + 6);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(217, 119, 6); // amber-600
    doc.text(`${todayRdvsCount}`, 114, y + 16);
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text("consultations planifiées", 124, y + 15);

    y += cardH + 12;

    // Section 2: Répartition de la Capacité Clinique
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text("2. État d'Occupation des Lits par Service", 15, y);

    y += 8;

    // Draw horizontal bar meters
    const barW = 100;
    const barH = 4;
    Object.entries(serviceStats).forEach(([srv, count]) => {
      const pct = hospCapacite > 0 ? (count / hospCapacite) : 0;
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(68, 64, 60); // stone-700
      doc.text(srv, 15, y + 3.5);
      doc.setFont("Helvetica", "normal");
      doc.text(`${count} lit(s) occupé(s)`, 65, y + 3.5);

      // Draw gray track
      doc.setFillColor(231, 229, 228);
      doc.roundedRect(110, y, barW, barH, 2, 2, "F");
      // Draw filled portion
      if (pct > 0) {
        doc.setFillColor(13, 148, 136); // teal
        doc.roundedRect(110, y, barW * pct, barH, 2, 2, "F");
      }

      y += 8;
    });

    y += 6;

    // Section 3: Activités Cliniques Générales
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136);
    doc.text("3. Activités Cliniques Clés", 15, y);

    y += 8;

    // A small elegant table for general activities
    doc.setFillColor(245, 245, 244);
    doc.rect(15, y, 180, 24, "F");
    doc.setDrawColor(214, 211, 209);
    doc.rect(15, y, 180, 24, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(68, 64, 60);
    doc.text("TYPE D'ACTIVITÉ", 20, y + 6);
    doc.text("MÉTRIQUES GLOBALES", 110, y + 6);
    doc.text("CONTEXTE & DÉTAILS", 145, y + 6);

    doc.line(15, y + 9, 195, y + 9);

    doc.setFont("Helvetica", "normal");
    doc.text("Consultations de médecine générale (Aujourd'hui)", 20, y + 14);
    doc.setFont("Helvetica", "bold");
    doc.text(`${todayConsultationsCount} consultations`, 110, y + 14);
    doc.setFont("Helvetica", "normal");
    doc.text("Dossier d'admission complet", 145, y + 14);

    doc.text("Urgences actives en observation triage", 20, y + 20);
    doc.setFont("Helvetica", "bold");
    doc.text(`${activeUrgencesCount} urgences`, 110, y + 20);
    doc.setFont("Helvetica", "normal");
    doc.text("Prise en charge prioritaire", 145, y + 20);

    addFooter();

    // PAGE 2: Rendez-vous et Stocks Pharmacie
    doc.addPage();
    addHeader(2);

    y = 25;

    // Section 4: Agenda Détaillé des Rendez-vous
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136);
    doc.text("4. Liste des Rendez-vous du Jour", 15, y);

    y += 8;

    if (todayRdvs.length === 0) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 113, 108);
      doc.text("Aucun rendez-vous planifié aujourd'hui.", 15, y);
      y += 10;
    } else {
      // Table Header
      doc.setFillColor(13, 148, 136); // Teal header
      doc.rect(15, y, 180, 8, "F");
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("Heure", 20, y + 5.5);
      doc.text("Nom du Patient", 45, y + 5.5);
      doc.text("Médecin Traitant", 95, y + 5.5);
      doc.text("Type", 145, y + 5.5);
      doc.text("Statut", 175, y + 5.5);

      y += 8;

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(68, 64, 60);

      todayRdvs.forEach((r, idx) => {
        // Alternating row background
        if (idx % 2 === 1) {
          doc.setFillColor(245, 245, 244);
          doc.rect(15, y, 180, 8, "F");
        }
        
        doc.setFont("Helvetica", "bold");
        doc.text(r.heure, 20, y + 5.5);
        doc.setFont("Helvetica", "normal");
        doc.text(r.patient, 45, y + 5.5);
        doc.text(r.praticien, 95, y + 5.5);
        doc.text(r.type || "Générale", 145, y + 5.5);
        doc.setFont("Helvetica", "bold");
        if (r.statut === "Confirmé" || r.statut === "Planifié") {
          doc.setTextColor(29, 78, 216); // blue
        } else if (r.statut === "Terminé") {
          doc.setTextColor(4, 120, 87); // emerald
        } else {
          doc.setTextColor(217, 119, 6); // amber
        }
        doc.text(r.statut, 175, y + 5.5);
        doc.setTextColor(68, 64, 60); // reset color

        y += 8;
      });

      y += 6;
    }

    // Section 5: Alertes de Stocks Critiques Pharmacie
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136);
    doc.text("5. Inventaire des Stocks Critiques Pharmacie", 15, y);

    y += 8;

    if (urgentMeds.length === 0) {
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(120, 113, 108);
      doc.text("Aucun médicament sous le seuil d'alerte. Stock optimal.", 15, y);
      y += 10;
    } else {
      // Table Header
      doc.setFillColor(13, 148, 136); // Teal header
      doc.rect(15, y, 180, 8, "F");
      
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("Médicament", 20, y + 5.5);
      doc.text("Dosage", 75, y + 5.5);
      doc.text("Forme", 105, y + 5.5);
      doc.text("Stock Actuel", 135, y + 5.5);
      doc.text("Seuil d'Alerte", 165, y + 5.5);

      y += 8;

      doc.setFont("Helvetica", "normal");
      doc.setTextColor(68, 64, 60);

      urgentMeds.slice(0, 15).forEach((med, idx) => {
        // Alternating row background
        if (idx % 2 === 1) {
          doc.setFillColor(245, 245, 244);
          doc.rect(15, y, 180, 8, "F");
        }
        
        doc.setFont("Helvetica", "bold");
        doc.text(med.nom, 20, y + 5.5);
        doc.setFont("Helvetica", "normal");
        doc.text(med.dosage, 75, y + 5.5);
        doc.text(med.forme, 105, y + 5.5);
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(220, 38, 38); // rose
        doc.text(`${med.stock} U`, 135, y + 5.5);
        doc.setTextColor(68, 64, 60); // reset
        doc.text(`${med.seuil} U`, 165, y + 5.5);

        y += 8;
      });

      if (urgentMeds.length > 15) {
        doc.setFont("Helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 113, 108);
        doc.text(`* Affichage limité aux 15 premières alertes sur un total de ${urgentMeds.length} médicaments en alerte de stock.`, 15, y + 5);
      }
    }

    addFooter();

    // Section 6: Graphique de Fréquentation
    if (chartRef.current) {
      try {
        const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL("image/png");
        
        doc.addPage();
        addHeader((doc.internal as any).getNumberOfPages ? (doc.internal as any).getNumberOfPages() : (doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : 1);
        y = 25;
        
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(13, 148, 136);
        doc.text("6. Graphique de Fréquentation Journalière", 15, y);
        
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = doc.internal.pageSize.getHeight();
        const imgProps = doc.getImageProperties(imgData);
        const margin = 15;
        const availableWidth = pdfWidth - margin * 2;
        const imgRatio = imgProps.height / imgProps.width;
        let finalWidth = availableWidth;
        let finalHeight = finalWidth * imgRatio;
        
        if (y + 10 + finalHeight > pdfHeight - 20) {
           finalHeight = pdfHeight - y - 30;
           finalWidth = finalHeight / imgRatio;
        }

        doc.addImage(imgData, "PNG", margin, y + 10, finalWidth, finalHeight);
      } catch (err) {
        console.error("Error capturing chart:", err);
      }
    }

    // Save the PDF
    doc.save(`${profile.name.replace(/[^a-zA-Z0-9]/g, "_")}_Dashboard_${new Date().toISOString().slice(0, 10)}.pdf`);
    setIsExporting(false);
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in">

      {/* HISTORIQUE PATIENT MODAL */}
      {showHistorique && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-stone-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-stone-900 rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-full border border-stone-200 dark:border-stone-800 overflow-hidden">
            <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-purple-50/50 dark:bg-purple-900/20">
              <div>
                <h3 className="text-xl font-serif font-black text-purple-900 dark:text-purple-100 flex items-center gap-2">
                  <History className="w-6 h-6" /> Dossier Patient : {filterPatientQuery}
                </h3>
                <p className="text-xs text-purple-700/70 dark:text-purple-300/70 font-semibold mt-1 uppercase tracking-widest">
                  Synthèse complète des passages
                </p>
              </div>
              <button
                onClick={() => setShowHistorique(false)}
                className="p-2 hover:bg-white dark:hover:bg-stone-800 rounded-lg transition-all shadow-sm bg-purple-100 dark:bg-purple-900/50 text-purple-900 dark:text-purple-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {/* Consultations */}
              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-3 border-b border-stone-100 pb-2">Consultations</h4>
                <div className="space-y-2">
                  {consultations.filter(c => c.patient.toLowerCase().includes(filterPatientQuery?.toLowerCase() || "")).length === 0 ? (
                    <p className="text-xs text-stone-500 italic">Aucune consultation trouvée.</p>
                  ) : (
                    consultations.filter(c => c.patient.toLowerCase().includes(filterPatientQuery?.toLowerCase() || "")).map(c => (
                      <div key={c.id} className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl border border-stone-100 dark:border-stone-800 text-xs">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-primary-700">{new Date(c.date).toLocaleDateString("fr-FR")}</span>
                          <span className="font-mono text-2xs text-stone-500 dark:text-stone-400">ID: {c.id.slice(0,8)}</span>
                        </div>
                        <p><span className="font-semibold text-stone-600">Diagnostic :</span> {c.diagnostic}</p>
                        <p className="mt-1"><span className="font-semibold text-stone-600">Ordonnance :</span> {c.ordonnance?.length || 0} médicament(s)</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Urgences */}
              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-3 border-b border-stone-100 pb-2">Passages aux Urgences</h4>
                <div className="space-y-2">
                  {urgences.filter(u => u.patient.toLowerCase().includes(filterPatientQuery?.toLowerCase() || "")).length === 0 ? (
                    <p className="text-xs text-stone-500 italic">Aucun passage aux urgences.</p>
                  ) : (
                    urgences.filter(u => u.patient.toLowerCase().includes(filterPatientQuery?.toLowerCase() || "")).map(u => (
                      <div key={u.id} className="p-3 bg-danger-50/50 dark:bg-danger-900/20 rounded-xl border border-danger-100 dark:border-danger-900/50 text-xs">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-danger-700">{new Date(u.dateArrivee).toLocaleDateString("fr-FR")} à {u.heureArrivee}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white text-stone-700">{u.severite}</span>
                        </div>
                        <p><span className="font-semibold text-stone-600">Plainte :</span> {u.plainte}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Laboratoire */}
              <div>
                <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100 mb-3 border-b border-stone-100 pb-2">Examens de Laboratoire</h4>
                <div className="space-y-2">
                  {(laboExamens || []).filter(e => e.patient.toLowerCase().includes(filterPatientQuery?.toLowerCase() || "")).length === 0 ? (
                    <p className="text-xs text-stone-500 italic">Aucun examen de laboratoire.</p>
                  ) : (
                    (laboExamens || []).filter(e => e.patient.toLowerCase().includes(filterPatientQuery?.toLowerCase() || "")).map(e => (
                      <div key={e.id} className="p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/50 text-xs">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-blue-700">{new Date(e.dateDemande).toLocaleDateString("fr-FR")}</span>
                          <span className="font-mono text-2xs text-stone-500 dark:text-stone-400">ID: {e.id.slice(0,8)}</span>
                        </div>
                        <p><span className="font-semibold text-stone-600">Examen :</span> {e.examen}</p>
                        <p className="mt-1"><span className="font-semibold text-stone-600">Résultat :</span> {e.resultat || "En attente"}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Dynamic Header Welcoming Block */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-primary-900 via-primary-800 to-stone-900 p-6 sm:p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.15),transparent_50%)]"></div>
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-primary-500/20 text-primary-300 text-xs font-black uppercase px-2.5 py-1 rounded-full tracking-wider border border-primary-500/30">
            <TrendingUp className="w-3.5 h-3.5" />
            {profile.name} • Tableau Décisionnel
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight font-serif">
            Bonjour, Responsable Médical
          </h1>
          <p className="text-primary-100/80 text-xs sm:text-sm max-w-xl font-medium">
            Voici la synthèse opérationnelle des activités cliniques et administratives de votre établissement pour aujourd'hui.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-2.5">
          <button
            onClick={exportPdf}
            className="bg-stone-850 hover:bg-stone-800 text-white border border-stone-750 text-xs font-black px-4 py-2.5 rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-primary-300" />
            Exporter le Dashboard
          </button>
          <button
            onClick={() => setActiveTab("medecine")}
            className="bg-white hover:bg-stone-50 text-primary-900 text-xs font-black px-4 py-2.5 rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-primary-600" />
            Nouvelle Consultation
          </button>
          <button
            onClick={() => setActiveTab("urgences")}
            className="bg-primary-500 hover:bg-primary-600 text-white text-xs font-black px-4 py-2.5 rounded-lg transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <ShieldAlert className="w-4 h-4 text-primary-100" />
            Admission Urgence
          </button>
        </div>
      </div>

      {/* Rappel Réunion Mensuelle du Service — visible à partir du 5 du mois */}
      {showReunionReminder && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-warning-50 dark:bg-warning-950/20 border border-warning-200 dark:border-warning-900/40 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning-100 dark:bg-warning-900/40 flex items-center justify-center shrink-0">
              <Bell className="w-4.5 h-4.5 text-warning-600 dark:text-warning-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-warning-900 dark:text-warning-200">
                Rappel : Réunion mensuelle du service
              </p>
              <p className="text-xs text-warning-700 dark:text-warning-400 mt-0.5">
                À annoncer aux agents par WhatsApp (rappel programmé chaque 5 du mois).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
            <a
              href={`https://wa.me/22644920162?text=${reunionWhatsAppMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismissReunionReminder}
              className="bg-success-600 hover:bg-success-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.456h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
              </svg>
              Annoncer sur WhatsApp
            </a>
            <button
              onClick={dismissReunionReminder}
              title="Marquer comme fait, sans envoyer"
              className="p-2 rounded-lg text-warning-600 dark:text-warning-400 hover:bg-warning-100 dark:hover:bg-warning-900/40 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Rappel Paie Mensuelle — visible à partir du 5 du mois */}
      {showPaieReminder && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-info-50 dark:bg-info-950/20 border border-info-200 dark:border-info-900/40 p-4 sm:p-5 rounded-2xl">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-info-100 dark:bg-info-900/40 flex items-center justify-center shrink-0">
              <Wallet className="w-4.5 h-4.5 text-info-600 dark:text-info-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-info-900 dark:text-info-200">
                Rappel : Paie mensuelle du personnel
              </p>
              <p className="text-xs text-info-700 dark:text-info-400 mt-0.5">
                À traiter et à annoncer au comptable par WhatsApp (rappel programmé chaque 5 du mois).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
            <a
              href={`https://wa.me/22644920162?text=${paieWhatsAppMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismissPaieReminder}
              className="bg-success-600 hover:bg-success-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.456h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
              </svg>
              Annoncer sur WhatsApp
            </a>
            <button
              onClick={dismissPaieReminder}
              title="Marquer comme fait, sans envoyer"
              className="p-2 rounded-lg text-info-600 dark:text-info-400 hover:bg-info-100 dark:hover:bg-info-900/40 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Visual KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Active Hospitalizations */}
        <div 
          onClick={() => setActiveTab("hospit")}
          className={`p-6 rounded-2xl border transition-all cursor-pointer group shadow-2xs hover:shadow-md ${
            theme === "dark" 
              ? "bg-stone-900/60 border-stone-800 hover:border-primary-800/80 hover:bg-stone-900" 
              : "bg-white border-stone-200 hover:border-primary-200 hover:bg-primary-50/10"
          }`}
          id="kpi-card-hosp"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-black tracking-wider text-stone-500">Patients Hospitalisés</span>
            <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-primary-950/40 text-primary-400' : 'bg-primary-50 text-primary-600'}`}>
              <HeartPulse className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-3xl font-black tracking-tight font-mono">{activeHospCount}</div>
            <p className="text-xs text-stone-500 font-medium">Patients en observation interne</p>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between text-xs font-bold text-primary-600 dark:text-primary-400">
            <span>Gérer les admissions</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* KPI 2: Bed Occupancy Rate */}
        <div 
          onClick={() => setActiveTab("hospit")}
          className={`p-6 rounded-2xl border transition-all cursor-pointer group shadow-2xs hover:shadow-md ${
            theme === "dark" 
              ? "bg-stone-900/60 border-stone-800 hover:border-success-800/80 hover:bg-stone-900" 
              : "bg-white border-stone-200 hover:border-success-200 hover:bg-success-50/10"
          }`}
          id="kpi-card-beds"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-black tracking-wider text-stone-500">Occupation des Lits</span>
            <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-success-950/40 text-success-400' : 'bg-success-50 text-success-600'}`}>
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-3xl font-black tracking-tight font-mono">{occupancyRate}%</div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
              <span>{activeHospCount} lits occupés sur {hospCapacite}</span>
            </div>
            {/* Visual Mini Progress Bar */}
            <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  occupancyRate >= 85 ? 'bg-danger-500' : occupancyRate >= 60 ? 'bg-warning-500' : 'bg-success-500'
                }`}
                style={{ width: `${Math.min(occupancyRate, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="mt-2 pt-3 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between text-xs font-bold text-success-600 dark:text-success-400">
            <span>Visualiser les lits</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* KPI 3: Urgent Stock Alerts */}
        <div 
          onClick={() => setActiveTab("pharma")}
          className={`p-6 rounded-2xl border transition-all cursor-pointer group shadow-2xs hover:shadow-md ${
            urgentMedsCount > 0 
              ? (theme === "dark" ? "bg-danger-950/10 border-danger-900/50 hover:bg-danger-950/20" : "bg-danger-50/40 border-danger-200 hover:bg-danger-50")
              : (theme === "dark" ? "bg-stone-900/60 border-stone-800 hover:bg-stone-900" : "bg-white border-stone-200 hover:bg-stone-50/10")
          }`}
          id="kpi-card-stock"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-black tracking-wider text-stone-500">Stocks Critiques</span>
            <div className={`p-2.5 rounded-xl ${urgentMedsCount > 0 ? 'bg-danger-100 text-danger-600 dark:bg-danger-950/40 dark:text-danger-400' : 'bg-stone-100 text-stone-500'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-3xl font-black tracking-tight font-mono text-danger-600 dark:text-danger-400">{urgentMedsCount}</div>
            <p className="text-xs text-stone-500 font-medium">Médicaments sous le seuil d'alerte</p>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between text-xs font-bold text-danger-600 dark:text-danger-400">
            <span>Rapprovisionner le stock</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

        {/* KPI 4: Today's Appointments */}
        <div 
          onClick={() => setActiveTab("rdv")}
          className={`p-6 rounded-2xl border transition-all cursor-pointer group shadow-2xs hover:shadow-md ${
            theme === "dark" 
              ? "bg-stone-900/60 border-stone-800 hover:border-warning-800/80 hover:bg-stone-900" 
              : "bg-white border-stone-200 hover:border-warning-200 hover:bg-warning-50/10"
          }`}
          id="kpi-card-rdvs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-black tracking-wider text-stone-500">Rendez-vous du Jour</span>
            <div className={`p-2.5 rounded-xl ${theme === 'dark' ? 'bg-warning-950/40 text-warning-400' : 'bg-warning-50 text-warning-600'}`}>
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-3xl font-black tracking-tight font-mono">{todayRdvsCount}</div>
            <p className="text-xs text-stone-500 font-medium">Consultations planifiées aujourd'hui</p>
          </div>
          <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between text-xs font-bold text-warning-600 dark:text-warning-400">
            <span>Consulter l'agenda du jour</span>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </div>

      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        
        {/* 7-Day Patient Flow Analytics Chart */}
        <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-6 bg-primary-600 rounded-full"></div>
              <div>
                <h3 className="text-base font-black tracking-tight text-stone-800 dark:text-stone-100">
                  Fréquentation & Flux des Patients (7 derniers jours)
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">
                  Analyse comparative des entrées (consultations, urgences, hospitalisations) et des sorties
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-stone-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500"></span>
                <span>Arrivées (Consults/Admissions)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-warning-500"></span>
                <span>Départs (Sorties/Clôtures)</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorArrivals" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#2e2e2e' : '#f0f0f0'} />
                <XAxis 
                  dataKey="name" 
                  tickLine={false}
                  axisLine={false}
                  stroke={theme === 'dark' ? '#78716c' : '#a8a29e'} 
                  style={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  stroke={theme === 'dark' ? '#78716c' : '#a8a29e'} 
                  style={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1c1917' : '#ffffff',
                    borderColor: theme === 'dark' ? '#2e2e2e' : '#e7e5e4',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: theme === 'dark' ? '#f5f5f4' : '#1c1917',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="Arrivées (Consults/Admissions)" 
                  stroke="#14b8a6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorArrivals)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="Départs (Sorties/Clôtures)" 
                  stroke="#f59e0b" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorExits)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7-Day Consultation Trends Line Chart */}
        <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
              <div>
                <h3 className="text-base font-black tracking-tight text-stone-800 dark:text-stone-100">
                  Évolution des Consultations (7 derniers jours)
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">
                  Volume quotidien total de consultations médicales
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-stone-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                <span>Nombre de Consultations</span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#2e2e2e' : '#f0f0f0'} />
                <XAxis 
                  dataKey="name" 
                  tickLine={false}
                  axisLine={false}
                  stroke={theme === 'dark' ? '#78716c' : '#a8a29e'} 
                  style={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  stroke={theme === 'dark' ? '#78716c' : '#a8a29e'} 
                  style={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1c1917' : '#ffffff',
                    borderColor: theme === 'dark' ? '#2e2e2e' : '#e7e5e4',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: theme === 'dark' ? '#f5f5f4' : '#1c1917',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Consultations" 
                  stroke="#3b82f6" 
                  strokeWidth={4}
                  dot={{ r: 4, strokeWidth: 2, fill: "#ffffff" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
      
      {/* 7-Day Patient Bar Chart */}
      <div className="grid grid-cols-1 mb-8">
        <div ref={chartRef} className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-6 bg-info-600 rounded-full"></div>
              <div>
                <h3 className="text-base font-black tracking-tight text-stone-800 dark:text-stone-100">
                  Fréquentation Journalière des Patients
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">
                  Arrivées totales (Consultations, Urgences, Admissions)
                </p>
              </div>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#2e2e2e' : '#f0f0f0'} />
                <XAxis 
                  dataKey="name" 
                  tickLine={false}
                  axisLine={false}
                  stroke={theme === 'dark' ? '#78716c' : '#a8a29e'} 
                  style={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  stroke={theme === 'dark' ? '#78716c' : '#a8a29e'} 
                  style={{ fontSize: '11px', fontWeight: 'bold' }}
                />
                <Tooltip
                  cursor={{ fill: theme === 'dark' ? '#2e2e2e' : '#f5f5f4' }}
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#1c1917' : '#ffffff',
                    borderColor: theme === 'dark' ? '#2e2e2e' : '#e7e5e4',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: theme === 'dark' ? '#f5f5f4' : '#1c1917',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Bar 
                  dataKey="Arrivées (Consults/Admissions)" 
                  fill="#4f46e5"
                  radius={[6, 6, 0, 0]}
                  name="Fréquentation"
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Operational Analysis Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Today's Agenda (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section: Priorités Médicales */}
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs`}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-danger-500"></span>
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-stone-800 dark:text-stone-100">
                    Priorités Médicales
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">Patients critiques - Triage & Urgences</p>
                </div>
              </div>
              <span className="text-xs uppercase font-black tracking-wider bg-danger-100 dark:bg-danger-950/40 text-danger-700 dark:text-danger-400 px-2.5 py-1 rounded-lg border border-danger-200/50 dark:border-danger-900/30">
                {criticalPatients.length} en attente
              </span>
            </div>

            {criticalPatients.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <div className="w-10 h-10 bg-success-50 dark:bg-success-950/20 text-success-600 dark:text-success-400 rounded-full flex items-center justify-center mx-auto border border-success-100 dark:border-success-900/30">
                  <Check className="w-5 h-5" />
                </div>
                <p className="text-xs text-stone-500 italic font-semibold">Aucun patient en état critique actuellement.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {criticalPatients.map((patient) => {
                  const isRed = patient.severite === "Urgence Vitale (Rouge)";
                  return (
                    <div 
                      key={patient.id} 
                      className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isRed 
                          ? "bg-danger-50/40 border-danger-200 dark:bg-danger-950/10 dark:border-danger-900/40" 
                          : "bg-orange-50/40 border-orange-200 dark:bg-orange-950/10 dark:border-orange-900/40"
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-black ${theme === 'dark' ? 'text-white' : 'text-stone-900'}`}>
                            {patient.patient}
                          </span>
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                            isRed 
                              ? "bg-danger-600 text-white" 
                              : "bg-orange-500 text-white"
                          }`}>
                            {isRed ? "Urgence Vitale" : "Très Urgent"}
                          </span>
                          <span className="text-xs text-stone-500 dark:text-stone-400 font-mono font-bold">
                            #{patient.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
                          <div>
                            <span className="font-semibold text-stone-500 dark:text-stone-400">Motif :</span>{" "}
                            <span className="italic font-medium">"{patient.plainte || "Non renseigné"}"</span>
                          </div>
                          <div>
                            <span className="font-semibold text-stone-500 dark:text-stone-400">Constantes :</span>{" "}
                            <span className="font-mono text-xs font-semibold">{patient.constantes || "Non relevées"}</span>
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold text-stone-500 dark:text-stone-400">Arrivé à :</span>{" "}
                            <span className="font-semibold">{patient.heureArrivee} ({getElapsedMinutesDisplay(patient.createdAt)} d'attente)</span>
                          </div>
                          <div className="mt-1">
                            <span className="font-semibold text-stone-500 dark:text-stone-400">Garde assignée :</span>{" "}
                            <span className="font-bold text-stone-600 dark:text-stone-300">
                              {staff.find(s => s.id === patient.medecinId)?.nom || "Garde Générale"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center shrink-0">
                        <button
                          onClick={() => {
                            if (setHeaderSearchQuery) {
                              setHeaderSearchQuery(patient.patient);
                            }
                            setActiveTab("urgences");
                          }}
                          className={`w-full md:w-auto text-xs font-black px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-3xs ${
                            isRed 
                              ? "bg-danger-600 hover:bg-danger-700 text-white" 
                              : "bg-orange-600 hover:bg-orange-700 text-white"
                          }`}
                        >
                          <span>Intervenir</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs`}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-6 bg-primary-600 rounded-full"></div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-stone-800 dark:text-stone-100">
                    Agenda des Rendez-vous du Jour
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">Planification en temps réel</p>
                </div>
              </div>
              <span className="text-sm font-mono bg-stone-100 dark:bg-stone-850 text-stone-500 px-2.5 py-1 rounded-lg font-bold">
                {new Date().toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </div>

            {todayRdvs.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Calendar className="w-10 h-10 text-stone-300 mx-auto" />
                <p className="text-xs text-stone-500 italic font-medium">Aucun rendez-vous planifié pour aujourd'hui.</p>
                <button
                  onClick={() => setActiveTab("rdv")}
                  className="text-xs font-black text-primary-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Planifier un rendez-vous <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800/50">
                {todayRdvs.map((r, idx) => {
                  return (
                    <div key={idx} className="py-3.5 flex items-center justify-between hover:bg-stone-50/50 dark:hover:bg-stone-850/20 px-2 rounded-xl transition-all">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 font-mono font-bold text-xs px-2.5 py-1.5 rounded-xl border border-primary-100 dark:border-primary-900/50 w-16">
                          <Clock className="w-3.5 h-3.5 mb-0.5" />
                          <span>{r.heure}</span>
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-black text-stone-800 dark:text-stone-100">{r.patient}</div>
                          <div className="text-sm text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wide">
                            Docteur : <span className="text-stone-500 dark:text-stone-300 font-black">{r.praticien}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-lg">
                          {r.type || "Générale"}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black border ${
                          r.statut === "Confirmé" || r.statut === "Planifié"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40"
                            : r.statut === "Terminé"
                            ? "bg-success-50 text-success-700 border-success-200 dark:bg-success-950/30 dark:text-success-400 dark:border-success-900/40"
                            : "bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-950/30 dark:text-warning-400 dark:border-warning-900/40"
                        }`}>
                          {r.statut}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {todayRdvs.length > 0 && (
              <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
                <button
                  onClick={() => setActiveTab("rdv")}
                  className="text-xs font-black text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Voir tous les rendez-vous ({rdvs.length}) <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Service breakdown & beds visualizer */}
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs`}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-6 bg-success-600 rounded-full"></div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-stone-800 dark:text-stone-100">
                    Plan Clinique : Répartition des lits
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">Remplissage des chambres</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left inner col: progress breakdown */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-stone-500 uppercase tracking-wider">Répartition par service</h4>
                {Object.entries(serviceStats).map(([srv, count], idx) => {
                  const pct = hospCapacite > 0 ? Math.round((count / hospCapacite) * 100) : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                        <span>{srv}</span>
                        <span className="font-mono">{count} lit(s)</span>
                      </div>
                      <div className="w-full bg-stone-100 dark:bg-stone-850 h-2 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right inner col: Bed grid visualizer */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-stone-500 uppercase tracking-wider">Visualisation de la capacité</h4>
                <div className="grid grid-cols-5 gap-2.5">
                  {Array.from({ length: hospCapacite }).map((_, idx) => {
                    const isOccupied = idx < activeHospCount;
                    return (
                      <div
                        key={idx}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center border text-2xs font-mono font-bold transition-all ${
                          isOccupied
                            ? "bg-primary-500 border-primary-600 text-white shadow-3xs animate-pulse"
                            : "bg-stone-50 border-stone-200 dark:bg-stone-850 dark:border-stone-800 text-stone-500 dark:text-stone-400"
                        }`}
                        title={isOccupied ? `Lit ${idx + 1} : Occupé` : `Lit ${idx + 1} : Disponible`}
                      >
                        <span>L{idx + 1}</span>
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isOccupied ? "bg-white" : "bg-stone-300 dark:bg-stone-700"}`}></div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 text-xs font-bold text-stone-500 justify-center pt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-lg bg-primary-500"></div>
                    <span>Occupé</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-lg bg-stone-100 border border-stone-200 dark:bg-stone-850 dark:border-stone-800"></div>
                    <span>Disponible</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Stock Alerts & General Stats (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Urgent Stock Alerts Block */}
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs`}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-6 bg-danger-600 rounded-full"></div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-stone-800 dark:text-stone-100">
                    Alertes de Stocks Pharmacie
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">Contrôle de sécurité</p>
                </div>
              </div>
              <span className={`text-xs font-black px-2.5 py-1 rounded-full ${
                urgentMedsCount > 0 ? "bg-danger-100 text-danger-700 dark:bg-danger-950/40 dark:text-danger-400 animate-bounce" : "bg-success-100 text-success-800"
              }`}>
                {urgentMedsCount > 0 ? `${urgentMedsCount} Alerte(s)` : "Stock OK"}
              </span>
            </div>

            {urgentMeds.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Package className="w-10 h-10 text-success-300 mx-auto" />
                <p className="text-xs text-stone-500 italic font-medium">Tous les médicaments de la pharmacie ont des stocks optimaux.</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1">
                {urgentMeds.slice(0, 5).map((med, idx) => (
                  <div key={idx} className="p-3 bg-stone-50 dark:bg-stone-850/30 rounded-xl border border-stone-150 dark:border-stone-800/60 hover:border-danger-200 dark:hover:border-danger-900 transition-all flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-xs font-black text-stone-800 dark:text-stone-100">{med.nom}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wide">
                        {med.dosage} • {med.forme}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="text-xs font-black font-mono text-danger-600 dark:text-danger-400">
                        Reste : {med.stock} U
                      </div>
                      <div className="text-2xs text-stone-500 dark:text-stone-400 font-bold">
                        Alerte : {med.seuil} U
                      </div>
                    </div>
                  </div>
                ))}
                {urgentMedsCount > 5 && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 italic text-center font-medium">
                    + {urgentMedsCount - 5} autres alertes de stock en cours.
                  </p>
                )}
              </div>
            )}

            {urgentMedsCount > 0 && (
              <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-end">
                <button
                  onClick={() => setActiveTab("pharma")}
                  className="text-xs font-black text-danger-600 hover:text-danger-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Rapprovisionner en urgence <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Clinic Activity overview */}
          <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs`}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-6 bg-warning-600 rounded-full"></div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-stone-800 dark:text-stone-100">
                    Activités Cliniques du Jour
                  </h3>
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">Statistiques de fréquentation</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-850/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-50 dark:bg-primary-950/20 text-primary-600 rounded-lg">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-stone-800 dark:text-stone-100">Consultations médicales</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">Reçues aujourd'hui</div>
                  </div>
                </div>
                <div className="text-sm font-black font-mono bg-primary-100 text-primary-800 dark:bg-primary-950/40 dark:text-primary-400 px-3 py-1 rounded-lg">
                  {todayConsultationsCount}
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-850/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-danger-50 dark:bg-danger-950/20 text-danger-600 rounded-lg">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-stone-800 dark:text-stone-100">Triage & Urgences actives</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">Cas critiques en attente ou soin</div>
                  </div>
                </div>
                <div className="text-sm font-black font-mono bg-danger-100 text-danger-800 dark:bg-danger-950/40 dark:text-danger-400 px-3 py-1 rounded-lg">
                  {activeUrgencesCount}
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-stone-850/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-950/20 text-blue-600 rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-stone-800 dark:text-stone-100">Personnel de service</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">Médecins, infirmiers & administratifs</div>
                  </div>
                </div>
                <div className="text-sm font-black font-mono bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 px-3 py-1 rounded-lg">
                  {staff.length}
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ========================================== */}
      {/* SECTION SECRÉTARIAT */}
      {/* ========================================== */}
      <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-sm space-y-6 mb-8`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 dark:border-stone-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-info-50 dark:bg-info-950/20 text-info-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-stone-800 dark:text-stone-100 font-serif">
                Espace Secrétariat
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-medium uppercase tracking-wider">
                Vue d'ensemble des tâches de réception et gestion
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
               onClick={() => {
                 if (!filterPatientQuery) {
                   alert("Veuillez d'abord rechercher et sélectionner un patient via la barre de recherche en haut.");
                   return;
                 }
                 setShowHistorique(true);
               }}
               className="bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-purple-200 transition-all flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5" /> Historique Patient
            </button>
            <button
               onClick={() => setActiveTab("rdv")}
               className="bg-info-50 hover:bg-info-100 text-info-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-info-200 transition-all flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" /> Gérer les RDV
            </button>
            <button
               onClick={() => setActiveTab("documents")}
               className="bg-success-50 hover:bg-success-100 text-success-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-success-200 transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> Documents
            </button>
            <button
               onClick={() => setActiveTab("facturation")}
               className="bg-stone-50 hover:bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-stone-200 transition-all flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" /> Facturation
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-stone-50 dark:bg-stone-850/30 rounded-xl border border-stone-150 dark:border-stone-800 flex items-center gap-4">
            <div className="p-3 bg-blue-100 text-blue-700 rounded-full">
               <Calendar className="w-5 h-5" />
            </div>
            <div>
               <div className="text-2xl font-black text-stone-800 dark:text-stone-100">{todayRdvs.length}</div>
               <div className="text-xs font-semibold text-stone-500 uppercase">RDV aujourd'hui</div>
            </div>
          </div>
          <div className="p-4 bg-stone-50 dark:bg-stone-850/30 rounded-xl border border-stone-150 dark:border-stone-800 flex items-center gap-4">
            <div className="p-3 bg-success-100 text-success-700 rounded-full">
               <CheckCircle className="w-5 h-5" />
            </div>
            <div>
               <div className="text-2xl font-black text-stone-800 dark:text-stone-100">{consultations.filter(c => c.date === new Date().toISOString().slice(0,10)).length}</div>
               <div className="text-xs font-semibold text-stone-500 uppercase">Consultations du jour</div>
            </div>
          </div>
          <div className="p-4 bg-stone-50 dark:bg-stone-850/30 rounded-xl border border-stone-150 dark:border-stone-800 flex items-center gap-4 cursor-pointer hover:border-info-300 transition-all" onClick={() => setActiveTab('rdv')}>
            <div className="p-3 bg-info-100 text-info-700 rounded-full">
               <Plus className="w-5 h-5" />
            </div>
            <div>
               <div className="text-sm font-black text-stone-800 dark:text-stone-100 mt-1">Nouveau Patient</div>
               <div className="text-xs font-semibold text-stone-500 uppercase">Accéder au portail RDV</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* SECTION 1: PORTAIL DE GARDE DES AGENTS (PLANIFICATION & CONSULTATION) */}
      {/* ========================================== */}
      <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-sm space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 dark:border-stone-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-primary-50 dark:bg-primary-950/20 text-primary-600 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-stone-800 dark:text-stone-100 font-serif">
                Portail Clinique de Garde des Agents
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">
                Planification et consultation en temps réel des rôles et permanences médicales.
              </p>
            </div>
          </div>
          <button
            onClick={handlePrintGardes}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimer le Roster (PDF)</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Consultation de Garde (7 columns) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-50 dark:bg-stone-850/50 p-3.5 rounded-xl border border-stone-150 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                <span className="text-xs font-black text-stone-700 dark:text-stone-300">Consultation des Gardes</span>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={filterGardeDate}
                  onChange={(e) => setFilterGardeDate(e.target.value)}
                  className="text-xs border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 focus:outline-none"
                />
                
                <select
                  value={filterGardeService}
                  onChange={(e) => setFilterGardeService(e.target.value)}
                  className="text-xs border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 focus:outline-none font-bold"
                >
                  <option value="Tous">Tous services</option>
                  <option value="Urgences">Urgences</option>
                  <option value="Maternité">Maternité</option>
                  <option value="Pédiatrie">Pédiatrie</option>
                  <option value="Médecine Générale">Médecine Générale</option>
                  <option value="Pharmacie">Pharmacie</option>
                </select>
              </div>
            </div>

            {filteredGardes.length === 0 ? (
              <div className="py-12 border border-dashed border-stone-200 dark:border-stone-800 rounded-xl text-center space-y-2">
                <Clock className="w-8 h-8 text-stone-300 mx-auto" />
                <p className="text-xs text-stone-500 dark:text-stone-400 italic font-medium">
                  Aucun agent planifié de garde pour cette date ({filterGardeDate}) ou ce service.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredGardes.map((g) => {
                  let badgeBg = "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-750";
                  if (g.service === "Urgences") {
                    badgeBg = "bg-danger-50 text-danger-700 border-danger-200 dark:bg-danger-950/20 dark:text-danger-400 dark:border-danger-900/30";
                  } else if (g.service === "Maternité") {
                    badgeBg = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30";
                  } else if (g.service === "Pédiatrie") {
                    badgeBg = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30";
                  } else if (g.service === "Médecine Générale") {
                    badgeBg = "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-950/20 dark:text-primary-400 dark:border-primary-900/30";
                  } else if (g.service === "Pharmacie") {
                    badgeBg = "bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-950/20 dark:text-warning-400 dark:border-warning-900/30";
                  }

                  let shiftColor = "text-primary-600 bg-primary-50 dark:bg-primary-950/20 dark:text-primary-400";
                  if (g.shift.includes("Nuit")) {
                    shiftColor = "text-info-600 bg-info-50 dark:bg-info-950/20 dark:text-info-400";
                  } else if (g.shift.includes("24h")) {
                    shiftColor = "text-purple-600 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400";
                  }

                  return (
                    <div key={g.id} className="p-4 bg-white dark:bg-stone-900 rounded-xl border border-stone-150 dark:border-stone-800 hover:border-primary-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-850 dark:text-stone-100 text-xs sm:text-sm">{g.agentNom}</span>
                          <span className={`text-2xs font-black uppercase border rounded-lg px-1.5 py-0.5 tracking-wider ${badgeBg}`}>
                            {g.service}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500 font-medium">
                          <span className="font-bold text-stone-700 dark:text-stone-300">{g.agentFonction}</span>
                          <span className="text-stone-300 dark:text-stone-700">•</span>
                          <span className={`inline-flex items-center gap-1 font-mono text-xs font-bold px-1.5 py-0.5 rounded-lg ${shiftColor}`}>
                            <Clock className="w-3 h-3" />
                            {g.shift}
                          </span>
                        </div>
                        {g.notes && (
                          <p className="text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-850 p-2 rounded-lg italic border border-stone-100 dark:border-stone-800">
                            Note : {g.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-auto">
                        <span className="text-xs font-black uppercase bg-success-50 text-success-700 border border-success-200 dark:bg-success-950/20 dark:text-success-400 dark:border-success-900/30 px-2 py-0.5 rounded-full">
                          {g.statut}
                        </span>
                        <div className="flex items-center gap-1 border-l border-stone-150 dark:border-stone-800 pl-2">
                          <button
                            onClick={() => handleEditGardeClick(g)}
                            className="p-1 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg text-stone-500 dark:text-stone-400 hover:text-primary-600 transition-all cursor-pointer"
                            title="Modifier"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteGarde(g.id)}
                            className="p-1 hover:bg-danger-50 dark:hover:bg-danger-950/20 rounded-lg text-stone-500 dark:text-stone-400 hover:text-danger-600 transition-all cursor-pointer"
                            title="Supprimer / Annuler"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Planifier une Garde Form (5 columns) */}
          <div className="lg:col-span-5 bg-stone-50 dark:bg-stone-850/30 border border-stone-150 dark:border-stone-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-200 dark:border-stone-800 pb-2">
              <Plus className="w-4 h-4 text-primary-600" />
              <h4 className="text-xs font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                {editingGardeId ? "Modifier la Garde" : "Planifier une Garde"}
              </h4>
            </div>

            <form onSubmit={handleAddOrEditGarde} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                  Sélectionner un agent du personnel
                </label>
                <select
                  value={newGardeAgentId}
                  onChange={(e) => {
                    setNewGardeAgentId(e.target.value);
                    if (e.target.value === "Autre") {
                      setNewGardeAgentNom("");
                    } else {
                      const sel = staff.find(s => s.id === e.target.value);
                      if (sel) setNewGardeAgentNom(sel.nom);
                    }
                  }}
                  className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none focus:ring-1 focus:ring-primary-600"
                  required
                >
                  <option value="">— Choisir l'employé —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                  ))}
                  <option value="Autre">— Autre nom externe —</option>
                </select>
              </div>

              {newGardeAgentId === "Autre" && (
                <div className="space-y-1">
                  <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                    Saisir le nom complet
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Dr. Moussa Traoré"
                    value={newGardeAgentNom}
                    onChange={(e) => setNewGardeAgentNom(e.target.value)}
                    className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                    Date de Garde
                  </label>
                  <input
                    type="date"
                    value={newGardeDate}
                    onChange={(e) => setNewGardeDate(e.target.value)}
                    className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                    Service affecté
                  </label>
                  <select
                    value={newGardeService}
                    onChange={(e) => setNewGardeService(e.target.value)}
                    className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none"
                  >
                    <option value="Urgences">Urgences</option>
                    <option value="Maternité">Maternité</option>
                    <option value="Pédiatrie">Pédiatrie</option>
                    <option value="Médecine Générale">Médecine Générale</option>
                    <option value="Pharmacie">Pharmacie</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                    Shift / Horaire
                  </label>
                  <select
                    value={newGardeShift}
                    onChange={(e) => setNewGardeShift(e.target.value)}
                    className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none"
                  >
                    <option value="Matin (07h-14h)">Matin (07h-14h)</option>
                    <option value="Après-midi (14h-21h)">Après-midi (14h-21h)</option>
                    <option value="Nuit (21h-07h)">Nuit (21h-07h)</option>
                    <option value="Garde 24h">Garde 24h</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                    Statut
                  </label>
                  <select
                    value={newGardeStatut}
                    onChange={(e) => setNewGardeStatut(e.target.value)}
                    className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none"
                  >
                    <option value="Confirmé">Confirmé</option>
                    <option value="En attente">En attente</option>
                    <option value="Remplacé">Remplacé</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-2xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                  Notes ou instructions de garde
                </label>
                <textarea
                  placeholder="Ex: Référer les cas complexes de pédiatrie au Dr. Sawadogo."
                  value={newGardeNotes}
                  onChange={(e) => setNewGardeNotes(e.target.value)}
                  className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer text-center"
                >
                  {editingGardeId ? "Enregistrer les modifications" : "Planifier la permanence"}
                </button>
                {editingGardeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGardeId(null);
                      setNewGardeAgentId("");
                      setNewGardeAgentNom("");
                      setNewGardeNotes("");
                    }}
                    className="px-3 py-2 bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-lg text-xs transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* SECTION 2: CONSOLE CONFIDENTIELLE DIRECTEUR & CODES AGENTS */}
      {/* ========================================== */}
      <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-sm space-y-6`}>
        <div className="flex items-center gap-2.5 border-b border-stone-100 dark:border-stone-800 pb-4">
          <div className="p-2.5 bg-warning-50 dark:bg-warning-950/20 text-warning-600 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-stone-800 dark:text-stone-100 font-serif">
              Console de Sécurité & Codes Agents (Directeur)
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">
              Espace directeur d'attribution et de gestion des habilitations et signatures cliniques de sécurité.
            </p>
          </div>
        </div>

        {!isDirectorUnlocked ? (
          /* UNLOCKED SYSTEM LOCKSCREEN */
          <div className="max-w-md mx-auto bg-stone-50 dark:bg-stone-850/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 text-center space-y-4 shadow-3xs">
            <div className="mx-auto w-12 h-12 bg-warning-50 dark:bg-warning-950/20 rounded-full flex items-center justify-center border border-warning-100 dark:border-warning-900 text-warning-600">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-black text-stone-800 dark:text-stone-100 uppercase tracking-wide">Identification requise</h4>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
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
                  className="w-full text-xs border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-primary-600 bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-100 text-center font-mono font-bold tracking-widest"
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
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Déverrouiller la Console Directeur</span>
              </button>
            </form>
          </div>
        ) : (
          /* CONFIDENTIAL SYSTEM PANEL */
          <div className="space-y-6">
            <div className="bg-primary-950 text-white p-4 rounded-xl border border-primary-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary-400" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">Espace de Gestion des Codes Confidentiels</h4>
                </div>
                <p className="text-xs text-primary-200">
                  Attribuez et supervisez les codes uniques pour chaque médecin, infirmier et agent de la clinique.
                </p>
              </div>
              <button
                onClick={() => setIsDirectorUnlocked(false)}
                className="px-2.5 py-1 bg-primary-850 hover:bg-primary-800 text-primary-100 hover:text-white border border-primary-850 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <Lock className="w-3 h-3" />
                <span>Verrouiller l'espace</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form to Add / Edit Agent (4 Cols) */}
              <div className="lg:col-span-4 bg-stone-50 dark:bg-stone-850/30 border border-stone-150 dark:border-stone-800 rounded-xl p-4 space-y-3">
                <div className="border-b border-stone-200 dark:border-stone-800 pb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary-600" />
                  <h5 className="text-xs font-black text-stone-800 dark:text-stone-200 uppercase tracking-wide">
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
                      className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none"
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
                      className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none font-bold"
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
                      className="w-full border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 outline-none font-mono font-semibold tracking-wider uppercase"
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
                        className="px-2.5 py-1.5 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold rounded-lg text-xs transition-all cursor-pointer"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Table of conf codes (8 Cols) */}
              <div className="lg:col-span-8 space-y-4">
                <div className="overflow-x-auto border border-stone-150 dark:border-stone-800 rounded-lg">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 dark:bg-stone-850 border-b border-stone-150 dark:border-stone-800 text-[8px] font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">
                        <th className="p-3 pl-4">Nom de l'Agent</th>
                        <th className="p-3">Fonction / Rôle</th>
                        <th className="p-3 text-center">Code Confidentiel</th>
                        <th className="p-3 text-right pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {agents.map((agent) => {
                        let badgeBg = "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300";
                        if (agent.fonction.includes("Médecin") || agent.fonction.includes("Pédiatre") || agent.fonction.includes("Gynécologue")) {
                          badgeBg = "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400";
                        } else if (agent.fonction.includes("Infirmier") || agent.fonction.includes("Sage-femme")) {
                          badgeBg = "bg-primary-50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-400";
                        } else if (agent.fonction.includes("Réception") || agent.fonction.includes("Secrétaire")) {
                          badgeBg = "bg-danger-50 text-danger-700 dark:bg-danger-950/20 dark:text-danger-400";
                        } else if (agent.fonction.includes("Comptable")) {
                          badgeBg = "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400";
                        }

                        return (
                          <tr key={agent.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-850/10 transition-all text-sm text-stone-700 dark:text-stone-300">
                            <td className="p-3 pl-4 font-bold">{agent.nom}</td>
                            <td className="p-3">
                              <span className={`inline-block text-[8px] font-semibold rounded-lg px-1.5 py-0.5 uppercase ${badgeBg}`}>
                                {agent.fonction}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-mono font-black text-xs rounded-lg border border-stone-200 dark:border-stone-750 tracking-wider">
                                <Key className="w-2.5 h-2.5 text-warning-500 shrink-0" />
                                {agent.code}
                              </span>
                            </td>
                            <td className="p-3 text-right pr-4 space-x-1">
                              <button
                                onClick={() => handleEditClick(agent)}
                                className="p-1 hover:bg-stone-50 dark:hover:bg-stone-800 hover:text-primary-600 rounded-lg text-stone-500 dark:text-stone-400 transition-all cursor-pointer"
                                title="Modifier"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAgent(agent.id)}
                                className="p-1 hover:bg-danger-50 dark:hover:bg-danger-950/20 hover:text-danger-600 rounded-lg text-stone-500 dark:text-stone-400 transition-all cursor-pointer"
                                title="Supprimer"
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
                <div className="pt-3 border-t border-stone-150 dark:border-stone-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 bg-stone-50 dark:bg-stone-850/40 border border-stone-150 dark:border-stone-800 rounded-xl p-3.5 text-xs">
                    <div className="flex items-center gap-1.5 mb-1 text-stone-800 dark:text-stone-200">
                      <Lock className="w-3.5 h-3.5 text-warning-500" />
                      <h6 className="font-black uppercase text-xs tracking-wider">
                        Changer le Code d'accès Directeur
                      </h6>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 leading-normal mb-2">
                      Pour assurer la stricte confidentialité des signatures de la clinique, changez régulièrement votre code de sécurité.
                    </p>

                    {isChangingDirectorCode ? (
                      <div className="flex gap-1.5">
                        <input
                          type="password"
                          placeholder="Nouveau code"
                          value={newDirectorCode}
                          onChange={(e) => setNewDirectorCode(e.target.value)}
                          className="text-xs border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 bg-white dark:bg-stone-900 text-stone-850 dark:text-stone-100 font-mono font-bold outline-none flex-1"
                        />
                        <button
                          type="button"
                          onClick={handleSaveDirectorCode}
                          className="bg-primary-600 hover:bg-primary-700 text-white text-2xs font-black uppercase px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsChangingDirectorCode(false);
                            setNewDirectorCode("");
                          }}
                          className="bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-2xs font-black uppercase px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsChangingDirectorCode(true)}
                        className="px-3 py-1.5 bg-white dark:bg-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-850 text-2xs font-black text-stone-700 dark:text-stone-300 rounded-lg transition-all cursor-pointer uppercase tracking-wider shadow-3xs"
                      >
                        Changer le code directeur
                      </button>
                    )}
                  </div>

                  <div className="flex items-center p-3.5 bg-primary-50/40 dark:bg-primary-950/10 border border-primary-150/30 dark:border-primary-900/30 rounded-xl text-sm text-stone-600 dark:text-stone-400 leading-relaxed font-medium">
                    <p>
                      <strong className="text-primary-700 dark:text-primary-400 font-bold">ℹ️ Synchronisation Locale :</strong> Ces codes d'accès et d'identification de sécurité sont enregistrés de façon sécurisée dans la mémoire de votre navigateur et synchronisés avec l'espace de facturation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
