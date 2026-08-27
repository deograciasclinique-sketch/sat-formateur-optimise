/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import { Staff, Task, GardeAgent } from "../types";
import { generateUid, getTodayStr, safeSet } from "../data";
import { 
  Users, 
  ClipboardList, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  CheckSquare, 
  Sparkles, 
  Filter,
  Search,
  ShieldAlert, 
  Lock, 
  Unlock, 
  Key, 
  AlertTriangle, 
  Printer, 
  Edit3, 
  X, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle,
  HelpCircle,
  LayoutGrid,
  CalendarDays
} from "lucide-react";
import { jsPDF } from "jspdf";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface TabTachesProps {
  staff: Staff[];
  tasks: Task[];
  onUpdateStaff: (staff: Staff[]) => void;
  onUpdateTasks: (tasks: Task[]) => void;
  isResponsable?: boolean;
  currentUser?: Staff | null;
}

export default function TabTaches({ staff, tasks, onUpdateStaff, onUpdateTasks, isResponsable = false, currentUser }: TabTachesProps) {
  // Staff form states
  const [staffNom, setStaffNom] = useState("");
  const [staffPoste, setStaffPoste] = useState("");
  const [staffContact, setStaffContact] = useState("");
  const [staffHoraire, setStaffHoraire] = useState("7h – 14h");
  const [staffCodeEntree, setStaffCodeEntree] = useState("");

  // Staff search & department filter states
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [staffDepartmentFilter, setStaffDepartmentFilter] = useState("all");

  const filteredStaffList = React.useMemo(() => {
    return staff.filter((s) => {
      const q = staffSearchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.nom.toLowerCase().includes(q) ||
        s.poste.toLowerCase().includes(q) ||
        (s.contact && s.contact.toLowerCase().includes(q));

      if (staffDepartmentFilter === "all") return matchesSearch;

      if (staffDepartmentFilter === "medical") {
        return matchesSearch && s.poste.toLowerCase().includes("médecin");
      }
      if (staffDepartmentFilter === "maternite") {
        return matchesSearch && (s.poste.toLowerCase().includes("sage-femme") || s.poste.toLowerCase().includes("gynéco"));
      }
      if (staffDepartmentFilter === "infirmier") {
        return matchesSearch && s.poste.toLowerCase().includes("infirmier");
      }
      if (staffDepartmentFilter === "labo") {
        return matchesSearch && s.poste.toLowerCase().includes("labo");
      }
      if (staffDepartmentFilter === "accueil") {
        return matchesSearch && (s.poste.toLowerCase().includes("secrétaire") || s.poste.toLowerCase().includes("accueil"));
      }
      if (staffDepartmentFilter === "pharma") {
        return matchesSearch && s.poste.toLowerCase().includes("pharma");
      }
      return matchesSearch && s.poste === staffDepartmentFilter;
    });
  }, [staff, staffSearchQuery, staffDepartmentFilter]);

  // Task form states
  const [taskLabel, setTaskLabel] = useState("");
  const [taskCat, setTaskCat] = useState("Soins infirmiers");
  const [taskAssigne, setTaskAssigne] = useState("");

  // Seul le responsable du service peut attribuer une tâche/un dossier à un
  // autre agent (cahier des charges, point 4). Un agent non-responsable ne
  // peut créer une tâche que pour lui-même : on verrouille automatiquement le
  // champ "Assigné à" sur son propre identifiant dès qu'il est connu.
  React.useEffect(() => {
    if (!isResponsable && currentUser?.id) {
      setTaskAssigne(currentUser.id);
    }
  }, [isResponsable, currentUser?.id]);
  const [taskHeure, setTaskHeure] = useState("");
  const [taskPriorite, setTaskPriorite] = useState<"haute" | "normale" | "basse">("normale");
  const [taskDate, setTaskDate] = useState(getTodayStr());
  const [taskNotes, setTaskNotes] = useState("");

  // Filters
  const [filterStaff, setFilterStaff] = useState("all");
  const [filterDate, setFilterDate] = useState("today");

  // --- SUB-TABS NAVIGATION ---
  const [activeSubTab, setActiveSubTab] = useState<"tasks" | "gardes">("tasks");

  // --- ÉTATS PORTAIL DE GARDE DES AGENTS (WEEKLY ROSTER) --- synchronisé cloud
  const [gardes, setGardes] = useCloudSyncedState<GardeAgent[]>("dg_staff_gardes_schedule", []);

  const [selectedWeekDate, setSelectedWeekDate] = useState(getTodayStr());
  const [gardeViewMode, setGardeViewMode] = useState<"weekly_grid" | "monthly_calendar">("weekly_grid");

  // Selected month for participation stats (default: current month e.g., "2026-07")
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return getTodayStr().slice(0, 7); // e.g. "2026-07"
  });

  const calendarDays = React.useMemo(() => {
    if (!selectedMonth) return [];
    try {
      const parts = selectedMonth.split("-");
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);

      const firstDayDate = new Date(year, month - 1, 1);
      const startDayIndex = (firstDayDate.getDay() + 6) % 7;

      const totalDays = new Date(year, month, 0).getDate();
      const prevMonthTotalDays = new Date(year, month - 1, 0).getDate();

      const days = [];

      for (let i = startDayIndex - 1; i >= 0; i--) {
        const prevDay = prevMonthTotalDays - i;
        const prevMonthNum = month === 1 ? 12 : month - 1;
        const prevYearNum = month === 1 ? year - 1 : year;
        const dateStr = `${prevYearNum}-${String(prevMonthNum).padStart(2, "0")}-${String(prevDay).padStart(2, "0")}`;
        days.push({
          dayNumber: prevDay,
          dateStr,
          isCurrentMonth: false,
        });
      }

      for (let i = 1; i <= totalDays; i++) {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
        days.push({
          dayNumber: i,
          dateStr,
          isCurrentMonth: true,
        });
      }

      const totalCellsNeeded = days.length <= 35 ? 35 : 42;
      const paddingNeeded = totalCellsNeeded - days.length;
      for (let i = 1; i <= paddingNeeded; i++) {
        const nextMonthNum = month === 12 ? 1 : month + 1;
        const nextYearNum = month === 12 ? year + 1 : year;
        const dateStr = `${nextYearNum}-${String(nextMonthNum).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
        days.push({
          dayNumber: i,
          dateStr,
          isCurrentMonth: false,
        });
      }

      return days;
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [selectedMonth]);

  const CHART_COLORS = [
    "#0d9488", // Teal
    "#4f46e5", // Indigo
    "#f59e0b", // Amber
    "#059669", // Emerald
    "#f43f5e", // Rose
    "#7c3aed", // Violet
    "#0ea5e9", // Sky
    "#f97316"  // Orange
  ];

  const monthlyParticipationData = React.useMemo(() => {
    // Filter guards for the selected month
    const monthlyGardes = gardes.filter(g => g.date.startsWith(selectedMonth));
    
    // Group by agent
    const counts: Record<string, { nom: string; count: number; poste: string }> = {};
    
    monthlyGardes.forEach(g => {
      const key = g.agentId || g.agentNom;
      if (!counts[key]) {
        counts[key] = {
          nom: g.agentNom,
          count: 0,
          poste: g.agentFonction || "Personnel"
        };
      }
      counts[key].count += 1;
    });

    const data = Object.entries(counts).map(([key, value]) => ({
      name: value.nom,
      poste: value.poste,
      value: value.count,
    }));

    return data.sort((a, b) => b.value - a.value);
  }, [gardes, selectedMonth]);

  const totalGuardsCount = React.useMemo(() => {
    return monthlyParticipationData.reduce((sum, item) => sum + item.value, 0);
  }, [monthlyParticipationData]);

  // Helper to add/subtract days to a YYYY-MM-DD date string safely
  const getOffsetDateStr = (dateStr: string, offsetDays: number): string => {
    try {
      const d = new Date(dateStr + "T12:00:00");
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    } catch (e) {
      return dateStr;
    }
  };

  // Validates if an agent has double assignment or insufficient rest on a date
  const checkGardeValidation = React.useCallback((agentId: string, dateStr: string) => {
    if (!agentId) return null;

    // 1. Check double assignment (multiple distinct guards on the same day)
    const dayGardes = gardes.filter((g) => g.agentId === agentId && g.date === dateStr);
    if (dayGardes.length > 1) {
      return {
        type: "conflict" as const,
        message: "Double affectation simultanée : cet agent est planifié sur plusieurs services différents de garde ce même jour."
      };
    }

    // Get current guard on this day, if any
    const currentGarde = dayGardes[0];
    if (!currentGarde) return null;

    // 2. Check previous day for Rest violation (24h or Nuit)
    const prevDateStr = getOffsetDateStr(dateStr, -1);
    const prevGardes = gardes.filter((g) => g.agentId === agentId && g.date === prevDateStr);

    for (const prev of prevGardes) {
      // Rule A: If previous day was a Garde 24h, the agent MUST have rest on the current day.
      if (prev.shift.includes("24h") || prev.shift.includes("24")) {
        return {
          type: "rest" as const,
          message: "Repos insuffisant : l'agent a effectué une Garde 24h le jour précédent et doit obligatoirement se reposer."
        };
      }

      // Rule B: If previous day was Nuit (ends at 07h), they cannot do Matin, Après-midi, or Garde 24h on the current day.
      if (prev.shift.includes("Nuit")) {
        if (
          currentGarde.shift.includes("Matin") ||
          currentGarde.shift.includes("Après-midi") ||
          currentGarde.shift.includes("24h") ||
          currentGarde.shift.includes("24")
        ) {
          return {
            type: "rest" as const,
            message: "Repos insuffisant : l'agent de garde Nuit (finissant à 07h) ne peut pas faire de garde de Jour (Matin, Après-midi ou 24h) aujourd'hui."
          };
        }
      }
    }

    // 3. Check next day for rest symmetry (e.g. if next day is 24h and today is Nuit)
    const nextDateStr = getOffsetDateStr(dateStr, 1);
    const nextGardes = gardes.filter((g) => g.agentId === agentId && g.date === nextDateStr);

    for (const next of nextGardes) {
      if (next.shift.includes("24h") || next.shift.includes("24")) {
        // If they have a 24h shift tomorrow, they cannot work a Nuit or 24h shift today
        if (currentGarde.shift.includes("Nuit") || currentGarde.shift.includes("24h") || currentGarde.shift.includes("24")) {
          return {
            type: "rest" as const,
            message: "Repos insuffisant : l'agent a une Garde 24h planifiée pour demain, il doit être au repos aujourd'hui."
          };
        }
      }
    }

    return null;
  }, [gardes]);

  // Securisation des codes agents (Directeur) — synchronisé cloud
  const [directorCode, setDirectorCode] = useCloudSyncedState<string>("dg_director_code", "1234");
  const [isDirectorUnlocked, setIsDirectorUnlocked] = useState(false);
  const [enteredCode, setEnteredCode] = useState("");
  const [unlockError, setUnlockError] = useState("");

  // Form states for Quick Schedule/Edit
  const [editingGardeId, setEditingGardeId] = useState<string | null>(null);
  const [newGardeAgentId, setNewGardeAgentId] = useState("");
  const [newGardeAgentNom, setNewGardeAgentNom] = useState("");
  const [newGardeDate, setNewGardeDate] = useState(getTodayStr());
  const [newGardeShift, setNewGardeShift] = useState("Nuit (21h-07h)");
  const [newGardeService, setNewGardeService] = useState("Urgences");
  const [newGardeStatut, setNewGardeStatut] = useState("Confirmé");
  const [newGardeNotes, setNewGardeNotes] = useState("");

  const saveGardes = (newGardes: GardeAgent[]) => {
    setGardes(newGardes);
  };

  const handleUnlockDirector = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredCode.trim() === directorCode) {
      setIsDirectorUnlocked(true);
      setUnlockError("");
      setEnteredCode("");
    } else {
      setUnlockError("Code d'accès Directeur incorrect.");
    }
  };

  const handleAddOrEditGarde = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDirectorUnlocked) {
      alert("Erreur de sécurité : vous devez déverrouiller le Mode Directeur pour modifier le tableau des gardes.");
      return;
    }

    let finalNom = newGardeAgentNom.trim();
    let finalFonction = "Personnel Clinique";

    if (newGardeAgentId && newGardeAgentId !== "Autre") {
      const selectedStaff = staff.find(s => s.id === newGardeAgentId);
      if (selectedStaff) {
        finalNom = selectedStaff.nom;
        finalFonction = selectedStaff.poste;
      }
    }

    if (!finalNom) {
      alert("Veuillez sélectionner un membre du personnel ou saisir son nom.");
      return;
    }

    if (editingGardeId) {
      const updated = gardes.map(g => g.id === editingGardeId ? {
        ...g,
        agentId: newGardeAgentId === "Autre" ? "" : newGardeAgentId,
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
      alert("Garde modifiée avec succès !");
    } else {
      const newG: GardeAgent = {
        id: "garde-" + Date.now(),
        agentId: newGardeAgentId === "Autre" ? "" : newGardeAgentId,
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

    // Reset Form
    setNewGardeAgentId("");
    setNewGardeAgentNom("");
    setNewGardeNotes("");
  };

  const handleDeleteGarde = (id: string) => {
    if (!isDirectorUnlocked) {
      alert("Action réservée au Directeur.");
      return;
    }
    if (confirm("Voulez-vous vraiment supprimer cet enregistrement de garde ?")) {
      const updated = gardes.filter(g => g.id !== id);
      saveGardes(updated);
    }
  };

  const handleCellClick = (agent: Staff, dateStr: string) => {
    if (!isDirectorUnlocked) {
      // Prompt director to unlock
      const element = document.getElementById("director-unlock-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    const existing = gardes.find(g => g.agentId === agent.id && g.date === dateStr);
    if (existing) {
      setEditingGardeId(existing.id);
      setNewGardeAgentId(agent.id);
      setNewGardeAgentNom(agent.nom);
      setNewGardeDate(existing.date);
      setNewGardeShift(existing.shift);
      setNewGardeService(existing.service);
      setNewGardeStatut(existing.statut);
      setNewGardeNotes(existing.notes || "");
    } else {
      setEditingGardeId(null);
      setNewGardeAgentId(agent.id);
      setNewGardeAgentNom(agent.nom);
      setNewGardeDate(dateStr);
      setNewGardeShift("Nuit (21h-07h)");
      setNewGardeService("Urgences");
      setNewGardeStatut("Confirmé");
      setNewGardeNotes("");
    }

    // Scroll to the creator panel smoothly
    const formElement = document.getElementById("guard-creator-form-panel");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleEditGardeFromCalendar = (g: GardeAgent) => {
    if (!isDirectorUnlocked) {
      const element = document.getElementById("director-unlock-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    setEditingGardeId(g.id);
    setNewGardeAgentId(g.agentId || "Autre");
    setNewGardeAgentNom(g.agentNom);
    setNewGardeDate(g.date);
    setNewGardeShift(g.shift);
    setNewGardeService(g.service);
    setNewGardeStatut(g.statut);
    setNewGardeNotes(g.notes || "");

    const formElement = document.getElementById("guard-creator-form-panel");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleAddGardeFromCalendar = (dateStr: string) => {
    if (!isDirectorUnlocked) {
      const element = document.getElementById("director-unlock-section");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    setEditingGardeId(null);
    setNewGardeAgentId("");
    setNewGardeAgentNom("");
    setNewGardeDate(dateStr);
    setNewGardeShift("Nuit (21h-07h)");
    setNewGardeService("Urgences");
    setNewGardeStatut("Confirmé");
    setNewGardeNotes("");

    const formElement = document.getElementById("guard-creator-form-panel");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Helper to generate the 7 dates of the selected week
  const weekDates = React.useMemo(() => {
    const baseDate = new Date(selectedWeekDate);
    const day = baseDate.getDay();
    // Monday calculation (accounting for Sunday as 0)
    const diff = baseDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(baseDate.setDate(diff));

    const dates = [];
    const daysFr = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    const shortDaysFr = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dStr = d.toISOString().slice(0, 10);
      dates.push({
        dateStr: dStr,
        label: d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
        dayName: daysFr[i],
        shortDayName: shortDaysFr[i]
      });
    }
    return dates;
  }, [selectedWeekDate]);

  const handlePrevWeek = () => {
    const d = new Date(selectedWeekDate);
    d.setDate(d.getDate() - 7);
    setSelectedWeekDate(d.toISOString().slice(0, 10));
  };

  const handleNextWeek = () => {
    const d = new Date(selectedWeekDate);
    d.setDate(d.getDate() + 7);
    setSelectedWeekDate(d.toISOString().slice(0, 10));
  };

  const handlePrintWeeklyRoster = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    // Elegant teal banner
    doc.setFillColor(13, 148, 136); // teal-600
    doc.rect(0, 0, 297, 15, "F");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text("CLINIQUE DEO-GRACIAS • ROSTER HEBDOMADAIRE DES GARDES", 15, 10);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const firstDay = weekDates[0].dateStr;
    const lastDay = weekDates[6].dateStr;
    doc.text(`Planning hebdomadaire du ${firstDay} au ${lastDay}`, 15, 24);

    doc.setDrawColor(200, 200, 200);
    doc.line(15, 28, 282, 28);

    // Headers
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text("Agent / Personnel", 15, 34);

    let xOffset = 65;
    weekDates.forEach((d, idx) => {
      doc.text(`${d.dayName}\n${d.label}`, xOffset + (idx * 30), 32, { align: "center" });
    });

    doc.line(15, 38, 282, 38);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(70, 70, 70);

    let y = 45;
    staff.forEach((s) => {
      if (y > 185) {
        doc.addPage();
        y = 25;
      }
      doc.setFont("Helvetica", "bold");
      doc.text(s.nom, 15, y);
      doc.setFont("Helvetica", "normal");
      doc.text(s.poste, 15, y + 4);

      // Render columns for each day
      weekDates.forEach((d, idx) => {
        const g = gardes.find(g => g.agentId === s.id && g.date === d.dateStr);
        const colX = xOffset + (idx * 30);
        if (g) {
          doc.setFont("Helvetica", "bold");
          doc.text(g.shift.split(" ")[0], colX, y, { align: "center" });
          doc.setFont("Helvetica", "normal");
          doc.text(g.service, colX, y + 4, { align: "center" });
        } else {
          doc.setTextColor(180, 180, 180);
          doc.text("Repos", colX, y + 2, { align: "center" });
          doc.setTextColor(70, 70, 70);
        }
      });

      doc.setDrawColor(230, 230, 230);
      doc.line(15, y + 7, 282, y + 7);
      y += 12;
    });

    doc.save(`roster_hebdo_${firstDay}.pdf`);
  };

  const handleAddStaff = () => {
    if (!staffNom.trim() || !staffPoste) {
      alert("Veuillez renseigner le nom complet et le poste de l'agent.");
      return;
    }

    const newStaff: Staff = {
      id: generateUid(),
      nom: staffNom.trim(),
      poste: staffPoste,
      contact: staffContact.trim(),
      horaire: staffHoraire,
      codeEntree: staffCodeEntree.trim() || undefined
    };

    onUpdateStaff([...staff, newStaff]);
    setStaffNom("");
    setStaffContact("");
    setStaffCodeEntree("");
  };

  const handleDeleteStaff = (id: string) => {
    if (confirm("Supprimer cet agent ? Les tâches associées resteront enregistrées.")) {
      onUpdateStaff(staff.filter((s) => s.id !== id));
    }
  };

  const handleAddTask = () => {
    // Garde-fou : même si l'état local était manipulé, un agent non-responsable
    // ne peut jamais attribuer une tâche à quelqu'un d'autre que lui-même.
    const effectiveAssigne = isResponsable ? taskAssigne : (currentUser?.id || taskAssigne);

    if (!taskLabel.trim() || !effectiveAssigne) {
      alert("Veuillez saisir le libellé de la tâche et l'assigner à un agent.");
      return;
    }

    const newTask: Task = {
      id: generateUid(),
      label: taskLabel.trim(),
      assigne: effectiveAssigne,
      cat: taskCat,
      heure: taskHeure || "—",
      priorite: taskPriorite,
      date: taskDate || getTodayStr(),
      notes: taskNotes.trim(),
      done: false,
      createdAt: new Date().toISOString(),
      agentCode: currentUser?.codeEntree || "0000"
    };

    onUpdateTasks([newTask, ...tasks]);
    setTaskLabel("");
    setTaskNotes("");
    setTaskHeure("");
  };

  const handleToggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: !t.done, completedByCode: !t.done ? (currentUser?.codeEntree || "0000") : undefined } : t));
    onUpdateTasks(updated);
  };

  const handleDeleteTask = (id: string) => {
    onUpdateTasks(tasks.filter((t) => t.id !== id));
  };

  const handleClearCompleted = () => {
    if (confirm("Supprimer toutes les tâches terminées ?")) {
      onUpdateTasks(tasks.filter((t) => !t.done));
    }
  };

  // Predefined duties to seed easily
  const handleSeedDefaultTasks = () => {
    if (staff.length === 0) {
      alert("Veuillez d'abord ajouter du personnel clinique pour pouvoir leur assigner des tâches.");
      return;
    }

    const defaultDuties = [
      { label: "Prise des constantes de garde", cat: "Surveillance", heure: "07:30", priorite: "haute" as const },
      { label: "Administration des traitements du matin", cat: "Administration médicaments", heure: "08:00", priorite: "haute" as const },
      { label: "Réfection des pansements stériles", cat: "Soins infirmiers", heure: "09:00", priorite: "normale" as const },
      { label: "Accueil et orientation des patients", cat: "Accueil / Triage", heure: "07:15", priorite: "haute" as const },
      { label: "Entretien des plateaux de soins", cat: "Nettoyage / Hygiène", heure: "12:00", priorite: "normale" as const }
    ];

    const newTasks: Task[] = defaultDuties.map((d, index) => {
      const agent = staff[index % staff.length];
      return {
        id: generateUid(),
        label: d.label,
        assigne: agent.id,
        cat: d.cat,
        heure: d.heure,
        priorite: d.priorite,
        date: getTodayStr(),
        notes: "Génération automatique",
        done: false,
        createdAt: new Date().toISOString()
      };
    });

    onUpdateTasks([...newTasks, ...tasks]);
  };

  // Filter tasks list based on selections
  const getFilteredTasks = () => {
    return tasks.filter((t) => {
      if (filterStaff !== "all" && t.assigne !== filterStaff) return false;
      if (filterDate === "today" && t.date !== getTodayStr()) return false;
      return true;
    });
  };

  const filteredTasksList = getFilteredTasks();
  const totalTasksCount = filteredTasksList.length;
  const completedTasksCount = filteredTasksList.filter((t) => t.done).length;
  const globalProgress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Tab Switch Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-150 dark:border-stone-800 pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("tasks")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "tasks"
                ? "bg-primary-600 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-800 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span>Tâches & Activités Quotidiennes</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("gardes")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "gardes"
                ? "bg-primary-600 text-white shadow-xs"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-800 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-750"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Tableau de Bord des Gardes (Hebdo)</span>
          </button>
        </div>
        <div className="text-sm text-stone-500 dark:text-stone-400 font-medium">
          Plan de Garde : <span className="text-primary-700 dark:text-primary-400 font-black font-mono">Hebdomadaire</span>
        </div>
      </div>

      {activeSubTab === "gardes" ? (
        <div className="space-y-6 animate-fade-in">
          {/* Header & Print actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-6 rounded-2xl shadow-xs">
            <div className="space-y-1">
              <h3 className="text-base font-serif font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-700 dark:text-primary-400" />
                Tableau de Bord Hebdomadaire des Gardes
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                Supervision, rotation et planification des permanences médicales de la clinique.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePrintWeeklyRoster}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Exporter en PDF (Roster)</span>
              </button>
            </div>
          </div>

          {/* Week Navigator & Lock State Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Week Selection */}
            <div className="lg:col-span-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 rounded-2xl shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <span className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Période du Roster
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrevWeek}
                    className="p-2 border border-stone-200 dark:border-stone-750 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-all text-stone-600 dark:text-stone-300 cursor-pointer"
                    title="Semaine précédente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={selectedWeekDate}
                    onChange={(e) => setSelectedWeekDate(e.target.value)}
                    className="text-xs font-bold border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 text-center flex-1 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleNextWeek}
                    className="p-2 border border-stone-200 dark:border-stone-750 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-lg transition-all text-stone-600 dark:text-stone-300 cursor-pointer"
                    title="Semaine suivante"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-primary-50/60 dark:bg-primary-950/20 p-3.5 rounded-xl border border-primary-150/40 text-xs text-primary-850 dark:text-primary-300 font-medium">
                <span className="font-bold">Semaine affichée :</span> du{" "}
                <span className="font-semibold font-mono">
                  {weekDates[0].dateStr}
                </span>{" "}
                au{" "}
                <span className="font-semibold font-mono">
                  {weekDates[6].dateStr}
                </span>
              </div>
            </div>

            {/* Lock / Unlock Director Access */}
            <div id="director-unlock-section" className="lg:col-span-6 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-5 rounded-2xl shadow-xs flex flex-col justify-between space-y-3">
              {isDirectorUnlocked ? (
                <div className="space-y-3 h-full flex flex-col justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-success-50 dark:bg-success-950/20 text-success-600 dark:text-success-400 rounded-xl border border-success-100 dark:border-success-900/30">
                      <Unlock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                        🔓 Mode Directeur Activé
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 leading-normal">
                        Vous disposez des droits exclusifs de modification du planning hebdomadaire. Cliquez sur n'importe quelle cellule pour planifier.
                      </p>
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setIsDirectorUnlocked(false);
                      setEditingGardeId(null);
                    }}
                    className="w-full py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold rounded-lg text-xs transition-all cursor-pointer border border-stone-200 dark:border-stone-750 text-center"
                  >
                    Verrouiller le Mode Modification
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUnlockDirector} className="space-y-2.5 h-full flex flex-col justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="p-2 bg-warning-50 dark:bg-warning-950/20 text-warning-600 dark:text-warning-400 rounded-xl border border-warning-100 dark:border-warning-900/30">
                      <Lock className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wide">
                        🔒 Mode Lecture Seule (Sécurisé)
                      </h4>
                      <p className="text-xs text-stone-500 dark:text-stone-400 leading-normal">
                        Entrez le code secret Directeur pour planifier et modifier la grille hebdomadaire des gardes.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <input
                        type="password"
                        placeholder="Code Directeur (défaut: 1234)"
                        value={enteredCode}
                        onChange={(e) => setEnteredCode(e.target.value)}
                        className="w-full text-xs border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-1.5 bg-stone-50 dark:bg-stone-850 text-stone-850 dark:text-stone-100 text-center font-mono font-bold tracking-widest focus:outline-none"
                      />
                      {unlockError && (
                        <p className="text-2xs text-danger-600 font-bold mt-1">⚠️ {unlockError}</p>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-xs self-start"
                    >
                      Déverrouiller
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Taux de participation aux gardes (Pie Chart) */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-150 dark:border-stone-800 pb-4 mb-6">
              <div className="space-y-1">
                <h4 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  Taux de Participation aux Gardes par Agent
                </h4>
                <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">
                  Répartition et volume des permanences médicales pour le mois sélectionné.
                </p>
              </div>

              {/* Month Picker */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">Période :</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs font-bold border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-1.5 bg-stone-50 dark:bg-stone-850 text-stone-850 dark:text-stone-200 focus:outline-none"
                />
              </div>
            </div>

            {monthlyParticipationData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-stone-500 dark:text-stone-400 space-y-2">
                <Calendar className="w-10 h-10 text-stone-300 dark:text-stone-700 stroke-1" />
                <p className="text-xs font-medium">Aucune garde enregistrée pour le mois de {new Date(selectedMonth + "-02").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}.</p>
                <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs">Planifiez des gardes pour voir s'afficher le graphique de participation.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Statistics Table List */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400">
                    Volume de gardes ({totalGuardsCount} au total)
                  </div>
                  <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {monthlyParticipationData.map((item, index) => {
                      const pct = ((item.value / totalGuardsCount) * 100).toFixed(1);
                      const color = CHART_COLORS[index % CHART_COLORS.length];
                      return (
                        <div key={item.name} className="flex items-center justify-between p-2.5 bg-stone-50 hover:bg-stone-100/70 dark:bg-stone-850/40 dark:hover:bg-stone-800/40 border border-stone-150/40 dark:border-stone-800/60 rounded-xl transition-all">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <div className="min-w-0">
                              <div className="font-bold text-stone-800 dark:text-stone-200 text-xs truncate">{item.name}</div>
                              <div className="text-2xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">{item.poste}</div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono text-xs font-black text-stone-850 dark:text-stone-100">{item.value} garde{item.value > 1 ? "s" : ""}</div>
                            <div className="text-xs font-semibold text-primary-700 dark:text-primary-400 font-mono">{pct}%</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Donut / Pie Chart */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center h-[240px] relative">
                  <div className="w-full h-full max-w-[240px] max-h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={monthlyParticipationData}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {monthlyParticipationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(28, 25, 23, 0.95)",
                            border: "none",
                            borderRadius: "12px",
                            fontSize: "11px",
                            color: "#f5f5f4",
                            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
                          }}
                          itemStyle={{ color: "#f5f5f4" }}
                          formatter={(value: any, name: string) => {
                            const percentage = ((Number(value) / totalGuardsCount) * 100).toFixed(1);
                            return [`${value} garde(s) (${percentage}%)`, name];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-semibold uppercase tracking-widest text-stone-500 dark:text-stone-400">Total</span>
                    <span className="text-xl font-mono font-black text-stone-850 dark:text-stone-100">{totalGuardsCount}</span>
                    <span className="text-xs font-bold text-stone-500 dark:text-stone-400">Gardes</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Toggle pour changer de vue */}
          <div className="flex bg-stone-100 dark:bg-stone-800 p-1.5 rounded-2xl border border-stone-200 dark:border-stone-750 self-start gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setGardeViewMode("weekly_grid")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                gardeViewMode === "weekly_grid"
                  ? "bg-white dark:bg-stone-900 text-primary-700 dark:text-primary-400 shadow-xs"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Grille par agent (Hebdo)</span>
            </button>
            <button
              type="button"
              onClick={() => setGardeViewMode("monthly_calendar")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                gardeViewMode === "monthly_calendar"
                  ? "bg-white dark:bg-stone-900 text-primary-700 dark:text-primary-400 shadow-xs"
                  : "text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Calendrier mensuel global</span>
            </button>
          </div>

          {gardeViewMode === "weekly_grid" ? (
            /* Weekly Grid Table */
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="p-4 bg-stone-50 dark:bg-stone-850 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                <span className="text-xs font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider">
                  Grille des Rotations de Garde
                </span>
                <span className="text-xs text-stone-500 dark:text-stone-400 italic">
                  {isDirectorUnlocked ? "💡 Cliquez sur un créneau ou un 'Repos' pour l'éditer" : "🔒 Consultation uniquement"}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-850 border-b border-stone-200 dark:border-stone-800 text-xs font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                      <th className="p-4 border-r border-stone-200 dark:border-stone-800 w-48 shrink-0 bg-stone-100/30 dark:bg-stone-850/50">Personnel / Agent</th>
                      {weekDates.map((d) => (
                        <th key={d.dateStr} className="p-3 border-r border-stone-150 dark:border-stone-800 text-center min-w-[120px]">
                          <div className="font-semibold text-stone-800 dark:text-stone-200">{d.dayName}</div>
                          <div className="text-2xs text-stone-500 dark:text-stone-400 font-mono mt-0.5">{d.label}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-150 dark:divide-stone-800">
                    {staff.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-stone-500 dark:text-stone-400 italic">
                          Aucun membre du personnel configuré. Veuillez en ajouter dans l'onglet "Tâches & Activités".
                        </td>
                      </tr>
                    ) : (
                      staff.map((s) => (
                        <tr key={s.id} className="hover:bg-stone-50/40 dark:hover:bg-stone-850/10 transition-colors">
                          {/* Agent profile col */}
                          <td className="p-4 border-r border-stone-200 dark:border-stone-800 bg-stone-50/20 dark:bg-stone-850/20">
                            <div className="font-bold text-stone-800 dark:text-stone-100">{s.nom}</div>
                            <div className="text-2xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider mt-0.5">
                              {s.poste}
                            </div>
                          </td>

                          {/* 7 Days cols */}
                          {weekDates.map((d) => {
                            const agentGarde = gardes.find((g) => g.agentId === s.id && g.date === d.dateStr);
                            const validation = checkGardeValidation(s.id, d.dateStr);

                            // Style color picker based on service and shift
                            let cellStyle = "bg-stone-50/20 border-dashed border-stone-200 dark:border-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-100/50";
                            let badgeText = "Repos";
                            let serviceText = "";

                            if (agentGarde) {
                              badgeText = agentGarde.shift.split(" ")[0]; // "Matin", "Après-midi", "Nuit", "Garde 24h"
                              serviceText = agentGarde.service;

                              if (agentGarde.shift.includes("Nuit")) {
                                cellStyle = "bg-info-50 border border-info-200 text-info-800 hover:border-info-400 hover:bg-info-100/50 dark:bg-info-950/20 dark:border-info-900/30 dark:text-info-400";
                              } else if (agentGarde.shift.includes("Matin")) {
                                cellStyle = "bg-primary-50 border border-primary-200 text-primary-800 hover:border-primary-400 hover:bg-primary-100/50 dark:bg-primary-950/20 dark:border-primary-900/30 dark:text-primary-400";
                              } else if (agentGarde.shift.includes("Après-midi")) {
                                cellStyle = "bg-warning-50 border border-warning-200 text-warning-800 hover:border-warning-400 hover:bg-warning-100/50 dark:bg-warning-950/20 dark:border-warning-900/30 dark:text-warning-400";
                              } else {
                                cellStyle = "bg-purple-50 border border-purple-200 text-purple-800 hover:border-purple-400 hover:bg-purple-100/50 dark:bg-purple-950/20 dark:border-purple-900/30 dark:text-purple-400";
                              }
                            }

                            if (validation) {
                              cellStyle += " border-red-500 dark:border-red-500 ring-2 ring-red-500/20 underline decoration-red-600 dark:decoration-red-400 decoration-2 underline-offset-4";
                            }

                            return (
                              <td
                                key={d.dateStr}
                                onClick={() => handleCellClick(s, d.dateStr)}
                                className={`p-2.5 border-r border-stone-150 dark:border-stone-800 text-center align-middle transition-all ${
                                  isDirectorUnlocked ? "cursor-pointer" : ""
                                }`}
                                title={validation ? validation.message : undefined}
                              >
                                <div className={`p-2 rounded-xl transition-all text-xs font-bold flex flex-col justify-center items-center gap-0.5 shadow-3xs ${cellStyle}`}>
                                  <div className="text-xs font-black uppercase tracking-wider flex items-center gap-1">
                                    {validation && <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />}
                                    <span>{badgeText}</span>
                                  </div>
                                  {serviceText && (
                                    <div className="text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-lg bg-white/70 dark:bg-stone-900/50 mt-1 border border-stone-200/40 dark:border-stone-800">
                                      {serviceText}
                                    </div>
                                  )}
                                  {validation ? (
                                    <div className="text-[8px] font-bold text-red-700 dark:text-red-400 leading-normal mt-1 max-w-[100px] text-center line-clamp-2">
                                      {validation.type === "conflict" ? "Conflit !" : "Repos insuff."}
                                    </div>
                                  ) : (
                                    agentGarde?.notes && (
                                      <div className="text-[8px] font-medium text-stone-500 dark:text-stone-450 italic mt-0.5 truncate max-w-[90px]" title={agentGarde.notes}>
                                        {agentGarde.notes}
                                      </div>
                                    )
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Calendrier Mensuel Global View */
            <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs overflow-hidden animate-fade-in">
              <div className="p-4 bg-stone-50 dark:bg-stone-850 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider block">
                    Calendrier Mensuel Global de Garde
                  </span>
                  <span className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 block font-semibold">
                    Vue d'ensemble de la couverture pour {new Date(selectedMonth + "-02").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-500 dark:text-stone-400 italic">
                    {isDirectorUnlocked ? "💡 Cliquez sur un jour ou un badge de garde pour planifier / modifier" : "🔒 Consultation uniquement"}
                  </span>
                </div>
              </div>

              <div className="p-4 overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Calendar Headers */}
                  <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-black uppercase tracking-wider text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-850/40 p-2.5 rounded-xl mb-1.5 border border-stone-150 dark:border-stone-800">
                    <div>Lundi</div>
                    <div>Mardi</div>
                    <div>Mercredi</div>
                    <div>Jeudi</div>
                    <div>Vendredi</div>
                    <div>Samedi</div>
                    <div>Dimanche</div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1.5 bg-stone-50/50 dark:bg-stone-950 p-2 rounded-2xl border border-stone-150 dark:border-stone-800">
                    {calendarDays.map((day) => {
                      const dayGardes = gardes.filter((g) => g.date === day.dateStr);
                      const isToday = day.dateStr === getTodayStr();

                      return (
                        <div
                          key={day.dateStr}
                          onClick={() => {
                            if (!isDirectorUnlocked) return;
                            handleAddGardeFromCalendar(day.dateStr);
                          }}
                          className={`min-h-[120px] p-2.5 rounded-xl transition-all border flex flex-col justify-between select-none group relative ${
                            day.isCurrentMonth
                              ? isToday
                                ? "bg-primary-50/40 dark:bg-primary-950/15 border-primary-500 dark:border-primary-500 shadow-3xs"
                                : "bg-white dark:bg-stone-900 border-stone-150 dark:border-stone-800 hover:border-primary-500/50 dark:hover:border-primary-500/40 hover:bg-stone-50/40 dark:hover:bg-stone-850/20"
                              : "bg-stone-50/20 dark:bg-stone-900/10 border-stone-100 dark:border-stone-850/20 text-stone-500 dark:text-stone-400 dark:text-stone-600 opacity-60"
                          } ${isDirectorUnlocked ? "cursor-pointer" : ""}`}
                        >
                          {/* Top row of the cell */}
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-black font-mono px-2 py-0.5 rounded-full ${
                                isToday
                                  ? "bg-primary-600 text-white"
                                  : day.isCurrentMonth
                                  ? "text-stone-700 dark:text-stone-300"
                                  : "text-stone-500 dark:text-stone-400 dark:text-stone-600"
                              }`}
                            >
                              {day.dayNumber}
                            </span>

                            {/* Tiny '+' add button on hover */}
                            {isDirectorUnlocked && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddGardeFromCalendar(day.dateStr);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg text-primary-600 dark:text-primary-400 transition-all cursor-pointer border-0"
                                title="Planifier une garde"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* List of guards on this day */}
                          <div className="mt-2 space-y-1.5 flex-1 flex flex-col justify-end">
                            {dayGardes.length === 0 ? (
                              <div className="h-full flex items-center justify-center py-2">
                                <span className="text-2xs font-semibold text-stone-350 dark:text-stone-700 uppercase tracking-widest">
                                  Pas de garde
                                </span>
                              </div>
                            ) : (
                              dayGardes.map((g) => {
                                const validation = checkGardeValidation(g.agentId || "", day.dateStr);

                                // Colors matching the style guide
                                let badgeStyle = "bg-primary-50/60 dark:bg-primary-950/20 text-primary-800 dark:text-primary-300 border border-primary-100 dark:border-primary-900/30";
                                if (g.shift.includes("Après-midi") || g.shift.includes("Soir")) {
                                  badgeStyle = "bg-warning-50/60 dark:bg-warning-950/20 text-warning-800 dark:text-warning-300 border border-warning-100 dark:border-warning-900/30";
                                } else if (g.shift.includes("Nuit")) {
                                  badgeStyle = "bg-info-50/60 dark:bg-info-950/20 text-info-800 dark:text-info-300 border border-info-100 dark:border-info-900/30";
                                } else if (g.shift.includes("24")) {
                                  badgeStyle = "bg-danger-50/60 dark:bg-danger-950/20 text-danger-800 dark:text-danger-300 border border-danger-100 dark:border-danger-900/30";
                                }

                                if (validation) {
                                  badgeStyle = "bg-danger-50 dark:bg-danger-950/30 text-danger-700 dark:text-red-400 border-2 border-red-500 animate-pulse";
                                }

                                return (
                                  <div
                                    key={g.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditGardeFromCalendar(g);
                                    }}
                                    className={`p-1.5 rounded-lg text-xs font-bold transition-all text-left ${
                                      isDirectorUnlocked ? "hover:scale-[1.02] cursor-pointer" : ""
                                    } ${badgeStyle}`}
                                    title={`${g.agentNom} - ${g.shift} [${g.service}]${
                                      validation ? `\n⚠️ CONFLIT : ${validation.message}` : ""
                                    }`}
                                  >
                                    <div className="flex items-center gap-1 min-w-0">
                                      {validation && <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />}
                                      <span className="truncate font-black text-stone-800 dark:text-stone-150">{g.agentNom}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[8px] font-bold text-stone-500 dark:text-stone-450 mt-0.5">
                                      <span className="truncate">{g.shift.split(" ")[0]}</span>
                                      <span className="font-semibold uppercase bg-white/60 dark:bg-stone-900/40 px-1 rounded-lg border border-stone-200/20 text-[7px]">
                                        {g.service.slice(0, 4)}.
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Schedule Creator / Editor */}
          {isDirectorUnlocked && (
            <div id="guard-creator-form-panel" className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-stone-150 dark:border-stone-800 pb-3">
                <h4 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                  {editingGardeId ? `Modifier l'affectation de garde` : `Planifier une rotation de garde`}
                </h4>
                
                {editingGardeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingGardeId(null);
                      setNewGardeAgentId("");
                      setNewGardeAgentNom("");
                      setNewGardeNotes("");
                    }}
                    className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <form onSubmit={handleAddOrEditGarde} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Select staff */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Agent concerné
                    </label>
                    <select
                      value={newGardeAgentId}
                      onChange={(e) => {
                        setNewGardeAgentId(e.target.value);
                        if (e.target.value === "Autre") {
                          setNewGardeAgentNom("");
                        } else {
                          const sel = staff.find((s) => s.id === e.target.value);
                          if (sel) setNewGardeAgentNom(sel.nom);
                        }
                      }}
                      className="w-full border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 font-semibold focus:outline-none focus:ring-1 focus:ring-primary-600"
                      required
                    >
                      <option value="">— Sélectionner l'employé —</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nom} ({s.poste})
                        </option>
                      ))}
                      <option value="Autre">— Autre agent externe —</option>
                    </select>
                  </div>

                  {/* Name field if custom external agent */}
                  {newGardeAgentId === "Autre" && (
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                        Saisir le nom de l'agent
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Dr. Moussa Traoré"
                        value={newGardeAgentNom}
                        onChange={(e) => setNewGardeAgentNom(e.target.value)}
                        className="w-full border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 focus:outline-none"
                        required
                      />
                    </div>
                  )}

                  {/* Date Picker */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Date de Garde
                    </label>
                    <input
                      type="date"
                      value={newGardeDate}
                      onChange={(e) => setNewGardeDate(e.target.value)}
                      className="w-full border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 font-bold focus:outline-none"
                      required
                    />
                  </div>

                  {/* Service selector */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Service clinique
                    </label>
                    <select
                      value={newGardeService}
                      onChange={(e) => setNewGardeService(e.target.value)}
                      className="w-full border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 font-semibold focus:outline-none"
                    >
                      <option value="Urgences">Urgences</option>
                      <option value="Maternité">Maternité</option>
                      <option value="Pédiatrie">Pédiatrie</option>
                      <option value="Médecine Générale">Médecine Générale</option>
                      <option value="Pharmacie">Pharmacie</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Shift Selection */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Shift / Horaire
                    </label>
                    <select
                      value={newGardeShift}
                      onChange={(e) => setNewGardeShift(e.target.value)}
                      className="w-full border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 font-semibold focus:outline-none"
                    >
                      <option value="Matin (07h-14h)">Matin (07h-14h)</option>
                      <option value="Après-midi (14h-21h)">Après-midi (14h-21h)</option>
                      <option value="Nuit (21h-07h)">Nuit (21h-07h)</option>
                      <option value="Garde 24h">Garde 24h</option>
                    </select>
                  </div>

                  {/* Statut */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Statut de la permanence
                    </label>
                    <select
                      value={newGardeStatut}
                      onChange={(e) => setNewGardeStatut(e.target.value)}
                      className="w-full border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 font-semibold focus:outline-none"
                    >
                      <option value="Confirmé">Confirmé</option>
                      <option value="En attente">En attente</option>
                      <option value="Remplacé">Remplacé</option>
                    </select>
                  </div>

                  {/* Optional notes */}
                  <div className="space-y-1">
                    <label className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 tracking-wider">
                      Consignes ou Notes (Optionnel)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Responsable du matériel d'urgence"
                      value={newGardeNotes}
                      onChange={(e) => setNewGardeNotes(e.target.value)}
                      className="w-full border border-stone-200 dark:border-stone-750 rounded-lg px-3 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg text-xs transition-all cursor-pointer text-center shadow-xs"
                  >
                    {editingGardeId ? "Enregistrer les modifications de garde" : "Enregistrer la Garde"}
                  </button>

                  {editingGardeId && (
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteGarde(editingGardeId);
                      }}
                      className="px-5 py-2.5 bg-danger-600 hover:bg-danger-700 text-white font-bold rounded-lg text-xs transition-all cursor-pointer shadow-xs"
                    >
                      Annuler la garde (Supprimer)
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Upper Grid for forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personnel Section */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-700" />
            Personnel du Service Clinique
          </h3>

          {/* Add Staff form */}
          {isResponsable ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-stone-50/50 p-4 rounded-xl border border-stone-150">
              <div className="md:col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom complet</label>
                <input
                  type="text"
                  placeholder="Ex: Sawadogo Ibrahim"
                  value={staffNom}
                  onChange={(e) => setStaffNom(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Poste / Fonction</label>
                <select
                  value={staffPoste}
                  onChange={(e) => setStaffPoste(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  <option value="Médecin">Médecin</option>
                  <option value="Sage-femme">Sage-femme</option>
                  <option value="Infirmier(e) diplômé(e)">Infirmier(e) diplômé(e)</option>
                  <option value="Infirmier(e) breveté(e)">Infirmier(e) breveté(e)</option>
                  <option value="Laborantin(e)">Laborantin(e)</option>
                  <option value="Agent d'accueil">Agent d'accueil</option>
                  <option value="Secrétaire (Secrétariat)">Secrétaire (Secrétariat)</option>
                  <option value="Aide-soignant(e)">Aide-soignant(e)</option>
                  <option value="Pharmacien">Pharmacien</option>
                  <option value="Responsable">Responsable du Service</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Contact</label>
                <input
                  type="tel"
                  placeholder="Ex: +226 70 00 00 00"
                  value={staffContact}
                  onChange={(e) => setStaffContact(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Horaires de Garde</label>
                <select
                  value={staffHoraire}
                  onChange={(e) => setStaffHoraire(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                >
                  <option value="7h – 14h">7h – 14h (Matin)</option>
                  <option value="14h – 21h">14h – 21h (Soir)</option>
                  <option value="21h – 7h (Garde)">21h – 7h (Nuit/Garde)</option>
                  <option value="7h – 16h">7h – 16h (Médecin)</option>
                  <option value="Flexible">Flexible</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Code d'entrée (PIN unique)</label>
                <input
                  type="text"
                  placeholder="Ex: 1234"
                  value={staffCodeEntree}
                  onChange={(e) => setStaffCodeEntree(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none font-mono font-bold"
                />
              </div>
              <div className="flex items-end md:col-span-2 mt-2">
                <button
                  type="button"
                  onClick={handleAddStaff}
                  className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Enregistrer l'agent
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-warning-200 bg-warning-50 text-warning-800 text-xs flex items-center gap-2">
              <span>⚠️ La modification du personnel et l'attribution des codes d'entrée sont réservées au Responsable du Service.</span>
            </div>
          )}

          {/* Search & Filter bar for staff */}
          {staff.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-3.5 pt-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Rechercher un soignant (nom, poste...)"
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg pl-8 pr-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="absolute left-2.5 top-2.5 text-stone-500 dark:text-stone-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
              </div>
              <div>
                <select
                  value={staffDepartmentFilter}
                  onChange={(e) => setStaffDepartmentFilter(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-medium"
                >
                  <option value="all">Tous les services / postes</option>
                  <option value="medical">Médecine Générale (Médecins)</option>
                  <option value="maternite">Maternité (Sages-femmes, Gynécos)</option>
                  <option value="infirmier">Soins Cliniques (Infirmiers)</option>
                  <option value="labo">Laboratoire (Laborantins)</option>
                  <option value="accueil">Secrétariat & Accueil</option>
                  <option value="pharma">Pharmacie</option>
                  <option value="Aide-soignant(e)">Aide-soignants</option>
                  <option value="Responsable">Responsables du Service</option>
                </select>
              </div>
            </div>
          )}

          {/* Staff table */}
          {filteredStaffList.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-6">
              {staff.length === 0 ? "Aucun personnel enregistré." : "Aucun membre du personnel ne correspond aux critères de recherche."}
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto border border-stone-100 rounded-xl divide-y divide-stone-100">
              {filteredStaffList.map((s) => (
                <div key={s.id} className="p-3 flex items-center justify-between text-xs hover:bg-stone-50/50 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-stone-800 truncate">{s.nom}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase mt-0.5 truncate">{s.poste} · {s.horaire}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isResponsable ? (
                      <div className="flex items-center gap-1 border border-stone-200 rounded-lg px-2 py-1 bg-white">
                        <span className="text-2xs text-stone-500 dark:text-stone-400 font-bold uppercase">PIN:</span>
                        <input
                          type="text"
                          placeholder="Aucun"
                          value={s.codeEntree || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = staff.map((member) => member.id === s.id ? { ...member, codeEntree: val } : member);
                            onUpdateStaff(updated);
                          }}
                          className="w-16 text-xs text-stone-800 font-mono font-bold bg-transparent border-none outline-none focus:ring-0 p-0"
                        />
                      </div>
                    ) : (
                      <span className="font-mono text-stone-500 dark:text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-lg text-xs">PIN masqué</span>
                    )}
                    <span className="font-mono text-stone-500 hidden sm:inline">{s.contact || "—"}</span>
                    {isResponsable && (
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(s.id)}
                        className="text-stone-300 hover:text-danger-600 p-1 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Task Creation Section */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-warning-600" />
              Créer une Tâche / Soin à Assigner
            </span>
            <button
              type="button"
              onClick={handleSeedDefaultTasks}
              className="px-2.5 py-1 text-xs font-bold bg-warning-50 hover:bg-warning-100 border border-warning-200 text-warning-800 rounded-lg flex items-center gap-1 transition-all"
            >
              <Sparkles className="w-3 h-3 text-warning-600" /> Tâches quotidiennes types
            </button>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Description du soin ou devoir</label>
              <input
                type="text"
                placeholder="Ex: Prise de tension patient Chambre 4"
                value={taskLabel}
                onChange={(e) => setTaskLabel(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Catégorie</label>
                <select
                  value={taskCat}
                  onChange={(e) => setTaskCat(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Soins infirmiers">Soins infirmiers</option>
                  <option value="Surveillance">Surveillance / Constantes</option>
                  <option value="Administration médicaments">Administration médicaments</option>
                  <option value="Consultation">Consultation</option>
                  <option value="Sage-femme / Gynéco">Sage-femme / Gynéco</option>
                  <option value="Prélèvement / Labo">Prélèvement / Labo</option>
                  <option value="Nettoyage / Hygiène">Nettoyage / Hygiène</option>
                  <option value="Accueil / Triage">Accueil / Triage</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Assigné à</label>
                {isResponsable ? (
                  <select
                    value={taskAssigne}
                    onChange={(e) => setTaskAssigne(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    <option value="">— Choisir l'agent —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom} ({s.poste})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    title="Seul le responsable du service peut attribuer une tâche à un autre agent."
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-100 text-stone-500 flex items-center gap-1.5"
                  >
                    <Lock className="w-3 h-3 flex-shrink-0" />
                    {currentUser ? `${currentUser.nom} (vous)` : "Vous-même"}
                  </div>
                )}
              </div>
            </div>
            {!isResponsable && (
              <p className="text-2xs text-stone-500 dark:text-stone-400 -mt-1">
                Vous ne pouvez créer une tâche que pour vous-même. Seul le responsable du service peut l'attribuer à un autre agent.
              </p>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Heure prévue</label>
                <input
                  type="time"
                  value={taskHeure}
                  onChange={(e) => setTaskHeure(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date d'exécution</label>
                <input
                  type="date"
                  value={taskDate}
                  onChange={(e) => setTaskDate(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Priorité</label>
                <select
                  value={taskPriorite}
                  onChange={(e) => setTaskPriorite(e.target.value as any)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="haute">🔴 Haute</option>
                  <option value="normale">🟡 Normale</option>
                  <option value="basse">🟢 Basse</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Notes / Patient concerné (Facultatif)</label>
              <input
                type="text"
                placeholder="Ex: Patient Koné Jean-Paul, chambre 3B"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAddTask}
              className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Assigner cette tâche
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-stone-200 p-4 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-stone-500" /> Voir le planning de :
          </span>
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            className="text-xs font-semibold bg-stone-50 border border-stone-200 text-stone-800 rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="all">Tout le personnel</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="text-xs font-semibold bg-stone-50 border border-stone-200 text-stone-800 rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            <option value="today">Aujourd'hui uniquement</option>
            <option value="all">Toutes les dates</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="font-semibold text-stone-700">
            Tâches accomplies : <span className="text-primary-700 font-semibold">{completedTasksCount}/{totalTasksCount}</span> ({globalProgress}%)
          </span>
          <button
            type="button"
            onClick={handleClearCompleted}
            className="px-3 py-1.5 text-xs text-stone-500 hover:text-danger-600 font-semibold bg-white border border-stone-200 rounded-lg transition-all"
          >
            Nettoyer le planning
          </button>
        </div>
      </div>

      {/* Grid of cards per staff */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.filter(s => filterStaff === "all" || s.id === filterStaff).map((s) => {
          const sTasks = filteredTasksList.filter((t) => t.assigne === s.id);
          const sCompleted = sTasks.filter((t) => t.done).length;
          const progress = sTasks.length > 0 ? Math.round((sCompleted / sTasks.length) * 100) : 0;

          return (
            <div key={s.id} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">👤 {s.nom}</h4>
                    <span className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider block mt-1">
                      {s.poste} · {s.horaire}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="text-xs font-semibold text-stone-500 mt-1 flex justify-between">
                    <span>{sCompleted} sur {sTasks.length} tâches</span>
                    <span>{progress}%</span>
                  </div>
                </div>

                {/* Tasks list checkbox */}
                <div className="mt-4 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {sTasks.length === 0 ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic py-4 text-center">Aucune tâche assignée pour ce créneau.</p>
                  ) : (
                    sTasks.map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border transition-all ${
                          t.done
                            ? "bg-stone-50 border-stone-100 opacity-60"
                            : "bg-stone-50/30 border-stone-150 hover:bg-stone-50/70"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => handleToggleTask(t.id)}
                          className="mt-1 w-4 h-4 rounded-lg border-stone-300 accent-primary-600 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className={`text-xs font-semibold ${t.done ? "line-through text-stone-500 dark:text-stone-400" : "text-stone-800"}`}>
                            {t.label}
                          </div>
                          <div className="flex items-center gap-2 text-2xs text-stone-500 dark:text-stone-400 mt-0.5">
                            <span className="font-bold uppercase text-warning-700">{t.heure}</span>
                            <span>•</span>
                            <span className="italic">{t.notes || t.cat}</span>
                          </div>
                        </div>
                        <span
                          className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            t.priorite === "haute" ? "bg-danger-500" : t.priorite === "normale" ? "bg-warning-400" : "bg-success-500"
                          }`}
                          title={`Priorité ${t.priorite}`}
                        ></span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main List view Table */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary-700" />
          Liste Détaillée des Devoirs et Tâches de Soins
        </h3>
        {filteredTasksList.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucune tâche enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3 w-12 text-center">✓</th>
                  <th className="p-3">Heure</th>
                  <th className="p-3">Tâche</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3">Assigné à</th>
                  <th className="p-3">Priorité</th>
                  <th className="p-3">Notes</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredTasksList.map((t) => {
                  const agent = staff.find((s) => s.id === t.assigne);
                  return (
                    <tr key={t.id} className={`hover:bg-stone-50/50 ${t.done ? "bg-stone-50/30 opacity-60" : ""}`}>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => handleToggleTask(t.id)}
                          className="w-4 h-4 rounded-lg border-stone-300 accent-primary-600 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-bold font-mono text-warning-800">{t.heure}</td>
                      <td className={`p-3 font-semibold ${t.done ? "line-through text-stone-500 dark:text-stone-400" : "text-stone-800"}`}>
                        <div>{t.label}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {t.agentCode && (
                            <span className="inline-block text-[8px] font-mono font-semibold uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-1.5 py-0.5 rounded-lg border border-stone-200/50">
                              Créé par : {t.agentCode}
                            </span>
                          )}
                          {t.completedByCode && (
                            <span className="inline-block text-[8px] font-mono font-semibold uppercase tracking-wider bg-success-50 dark:bg-success-950/20 text-success-700 dark:text-success-400 px-1.5 py-0.5 rounded-lg border border-success-200/30">
                              Fini par : {t.completedByCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-stone-500 font-medium">{t.cat}</td>
                      <td className="p-3 font-semibold text-stone-700">{agent ? agent.nom : "Inconnu"}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            t.priorite === "haute"
                              ? "bg-danger-100 text-danger-800"
                              : t.priorite === "normale"
                              ? "bg-warning-100 text-warning-800"
                              : "bg-success-100 text-success-800"
                          }`}
                        >
                          {t.priorite}
                        </span>
                      </td>
                      <td className="p-3 text-stone-500 dark:text-stone-400 italic">{t.notes || "—"}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(t.id)}
                          className="text-stone-500 dark:text-stone-400 hover:text-danger-600 p-1 rounded-lg transition-all inline-block"
                        >
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
        </>
      )}
    </div>
  );
}
