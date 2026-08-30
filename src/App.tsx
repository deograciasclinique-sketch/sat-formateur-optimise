/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SelfHealingErrorBoundary, useSystemWatchdog } from "./components/SelfHealingEngine";
import { subscribeToCloudKey, pushToCloudKey } from "./lib/liveSync";
import { useCloudSyncedState } from "./lib/useCloudSyncedState";
import PatientMobilePortal from "./components/PatientMobilePortal";
import {
  Audit,
  ActionCorrective,
  Incident,
  Staff,
  Task,
  Medicament,
  MouvementStock,
  ActeTarifaire,
  Facture,
  Depense,
  RendezVous,
  RhFiche,
  Conge,
  Absence,
  Hospitalisation,
  Evolution,
  FicheReference,
  Vaccination,
  ExamenLabo,
  PriseEnCharge,
  Accouchement,
  Consultation,
  PatientUrgence,
  FichePediatrique,
  ConsultationPrenatale,
  DocumentArchive
} from "./types";
import {
  seedLocalStorage,
  safeGet,
  safeSet,
  getTodayFr,
  migrateStaff,
  migrateConsultations,
  migrateMaterniteCpns,
  migrateUrgences,
  migratePediatrie,
  getClinicProfile
} from "./data";

import { addOfflineAction, getPendingActionsCount, processOfflineQueue } from "./lib/offlineQueue";
import { db } from "./lib/firebase";
import { sendBrowserNotification } from "./lib/browserNotifications";

// Import all 16 operational tab panels
import TabQualite from "./components/TabQualite";
import TabIndicateurs from "./components/TabIndicateurs";
import TabTaches from "./components/TabTaches";
import TabPharmacie from "./components/TabPharmacie";
import TabFacturation from "./components/TabFacturation";
import TabRDV from "./components/TabRDV";
import TabRH from "./components/TabRH";
import TabHospitalisation from "./components/TabHospitalisation";
import TabVaccination from "./components/TabVaccination";
import TabLabo from "./components/TabLabo";
import TabMaternite from "./components/TabMaternite";
import TabAssurance from "./components/TabAssurance";
import TabUrgences from "./components/TabUrgences";
import TabPediatrie from "./components/TabPediatrie";
import TabConsultation from "./components/TabConsultation";
import TabDocuments from "./components/TabDocuments";
import TabActesTarifs from "./components/TabActesTarifs";
import TabOnlineRDV from "./components/TabOnlineRDV";
import TabDashboardGlobal from "./components/TabDashboardGlobal";
import TabSettings from "./components/TabSettings";
import TabPlanifFamiliale from "./components/TabPlanifFamiliale";

import {
  ShieldAlert,
  Calendar,
  HeartPulse,
  Heart,
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  Receipt,
  Activity,
  ClipboardList,
  ShieldCheck,
  Stethoscope,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Settings,
  Archive,
  LogOut,
  Sliders,
  Sparkles,
  Menu,
  X,
  Smartphone,
  Check,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  AlertTriangle,
  Sun,
  Moon,
  Keyboard,
  Printer,
  Lock,
  Clock,
  Maximize,
  Minimize
} from "lucide-react";

// Move static tab lists, helper maps, and configuration constants outside App to avoid recreating them on every single render
const ALL_TABS = [
  "dashboard", "medecine", "urgences", "hospit", "pediatrie", "maternite", "vaccination", 
  "labo", "pharma", "taches", "rdv", "rdv_en_ligne", "factures", 
  "assurances", "rh", "indicateurs", "qualite", "documents", "settings"
];

const getTabLabel = (id: string): string => {
  const mapping: Record<string, string> = {
    dashboard: "Dashboard Global",
    medecine: "Consultation Générale",
    urgences: "Triage & Urgences",
    hospit: "Hospitalisations",
    pediatrie: "Surveillance Pédiatrique",
    maternite: "Suivi Maternité & CPN",
    vaccination: "Vaccination & PEV",
    labo: "Laboratoire d'analyses",
    pharma: "Pharmacie & Stocks",
    taches: "Tâches & Coordination",
    rdv: "Planification & RDV",
    rdv_en_ligne: "Portail RDV en ligne (Mobile)",
    factures: "Factures & Journal",
    assurances: "Assurances & Tiers-Payant",
    rh: "Ressources Humaines",
    indicateurs: "Indicateurs Épidémio",
    qualite: "Démarche Qualité",
    documents: "Coffre-fort Documents",
    settings: "Paramètres des Seuils"
  };
  return mapping[id] || id;
};

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in ms

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // Système (sync/connectivité/thème) replié par défaut pour désencombrer la sidebar
  const [isSystemPanelOpen, setIsSystemPanelOpen] = useState(false);

  // Ensure sidebar is always visible on desktop and reset state when resizing up
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    // Initial check
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isPatientMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "patient";

  if (isPatientMode) {
    return <PatientMobilePortal />;
  }
  const [clinicProfile, setClinicProfile] = useState(() => getClinicProfile());

  useEffect(() => {
    const handleProfileUpdate = () => {
      setClinicProfile(getClinicProfile());
    };
    window.addEventListener("dg_profile_updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("dg_profile_updated", handleProfileUpdate);
    };
  }, []);

  // Activate global self-healing diagnostics watchdog
  useSystemWatchdog();

  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (typeof window !== "undefined" && localStorage.getItem("dg_theme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("dg_theme", theme);
  }, [theme]);

  // Connectivity states
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [isForceOffline, setIsForceOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date>(new Date());

  // Auto-save states
  const [isSaving, setIsSaving] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Monitor full screen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        showToast("Plein écran 🖥️", "Mode plein écran activé avec succès.", "success");
      }).catch((err) => {
        console.warn("Fullscreen request failed:", err);
        showToast(
          "Plein écran limité 🖥️",
          "Le mode plein écran est restreint par l'aperçu ou le navigateur. Ouvrez l'application dans un nouvel onglet pour l'activer.",
          "warning"
        );
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          showToast("Plein écran désactivé", "Retour au mode normal.", "info");
        }).catch((err) => {
          console.warn("Exit fullscreen failed:", err);
        });
      }
    }
  };

  // Floating Toast alerts system
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: "warning" | "error" | "success" | "info";
    title: string;
    message: string;
  }>>([]);

  const showToast = (title: string, message: string, type: "warning" | "error" | "success" | "info" = "warning") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const updatePendingCount = async () => {
    const count = await getPendingActionsCount();
    setPendingSyncCount(count);
  };

  useEffect(() => {
    updatePendingCount();
    const handleSyncCompleted = () => updatePendingCount();
    window.addEventListener('offline-sync-completed', handleSyncCompleted);
    window.addEventListener('offline-action-added', handleSyncCompleted);
    
    return () => {
      window.removeEventListener('offline-sync-completed', handleSyncCompleted);
      window.removeEventListener('offline-action-added', handleSyncCompleted);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!isForceOffline) {
        processOfflineQueue();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [isForceOffline]);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSync(new Date());
    }, 1200);
  };

  const effectiveOnline = isOnline && !isForceOffline;

  // Database / LocalStorage State variables
  const [staff, setStaff] = useState<Staff[]>([]);
  const [medicaments, setMedicaments] = useState<Medicament[]>([]);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [assureurs, setAssureurs] = useState<any[]>([]);
  const [assures, setAssures] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [pediatrie, setPediatrie] = useState<FichePediatrique[]>([]);
  const [materniteCpns, setMaterniteCpns] = useState<ConsultationPrenatale[]>([]);
  const [materniteAccouchements, setMaterniteAccouchements] = useState<Accouchement[]>([]);
  const [rdv, setRdv] = useState<RendezVous[]>([]);
  const [hospCapacite, setHospCapacite] = useState(20);
  const [hospitalisations, setHospitalisations] = useState<Hospitalisation[]>([]);
  const [hospEvolutions, setHospEvolutions] = useState<Evolution[]>([]);
  const [ficheReferences, setFicheReferences] = useState<FicheReference[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [actions, setActions] = useState<ActionCorrective[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [conges, setConges] = useState<Conge[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [rhFiches, setRhFiches] = useState<RhFiche[]>([]);
  const [prisesEnCharge, setPrisesEnCharge] = useState<PriseEnCharge[]>([]);
  const [urgences, setUrgences] = useState<PatientUrgence[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [laboExamens, setLaboExamens] = useState<ExamenLabo[]>([]);
  const [documents, setDocuments] = useState<DocumentArchive[]>([]);
  const [actesTarifaires, setActesTarifaires] = useState<ActeTarifaire[]>([]);

  // --- Synchronisation temps réel multi-appareils (Firestore) ---
  // Associe chaque clé de données à sa fonction de mise à jour locale.
  // "dg_staff" n'est pas ici : il a déjà son propre mécanisme de synchronisation cloud.
  const liveSyncSetters = React.useRef<Record<string, (data: any) => void>>({
    dg_pharma_stock: setMedicaments,
    dg_pharma_mouvements: setMouvements,
    dg_tasks: setTasks,
    dg_consultations: setConsultations,
    dg_pediatrie: setPediatrie,
    dg_maternite_cpn: setMaterniteCpns,
    dg_maternite_accouchements: setMaterniteAccouchements,
    dg_rdv: setRdv,
    dg_hospitalisations: setHospitalisations,
    dg_fiches_reference: setFicheReferences,
    dg_hosp_evolutions: setHospEvolutions,
    dg_factures: setFactures,
    dg_depenses: setDepenses,
    dg_incidents: setIncidents,
    dg_actions: setActions,
    dg_audits: setAudits,
    dg_conges: setConges,
    dg_absences: setAbsences,
    dg_rh: setRhFiches,
    dg_prises_charge: setPrisesEnCharge,
    dg_urgences: setUrgences,
    dg_vaccinations: setVaccinations,
    dg_labo_examens: setLaboExamens,
    dg_documents: setDocuments,
    dg_actes_tarifaires: setActesTarifaires,
  });
  // Garde en mémoire la dernière valeur confirmée comme envoyée au cloud pour chaque clé,
  // afin de ne renvoyer que ce qui a réellement changé (et d'éviter les boucles avec les
  // mises à jour reçues depuis un autre appareil).
  const lastCloudSyncedRef = React.useRef<Record<string, any>>({});

  // Threshold settings state — synchronisé cloud en temps réel
  const [medTypeThresholds, setMedTypeThresholds] = useCloudSyncedState<Record<string, number>>("dg_med_type_thresholds", {
    "Comprimé": 50,
    "Sirop": 15,
    "Injectable": 30,
    "Perfusion": 25,
    "Pommade / Crème": 10,
    "Poudre": 15,
    "Solution buccale": 10
  });

  const [medCategoryThresholds, setMedCategoryThresholds] = useCloudSyncedState<Record<string, number>>("dg_med_category_thresholds", {
    "Antalgique / Antipyrétique": 30,
    "Antibiotique": 40,
    "Antipaludéen": 35,
    "Antihypertenseur": 20,
    "Anti-inflammatoire": 25,
    "Antidiabétique": 20,
    "Vitamines / Minéraux": 15,
    "Solutés / Perfusions": 30,
    "Matériel médical": 50
  });

  const [thresholdApplyMode, setThresholdApplyMode] = useCloudSyncedState<"override" | "fallback">("dg_threshold_apply_mode", "fallback");

  const getMedEffectiveThreshold = (med: Medicament) => {
    if (thresholdApplyMode === "override") {
      if (medTypeThresholds[med.forme] !== undefined) {
        return medTypeThresholds[med.forme];
      }
      if (medCategoryThresholds[med.categorie] !== undefined) {
        return medCategoryThresholds[med.categorie];
      }
    } else {
      if (med.seuil && med.seuil > 0) {
        return med.seuil;
      }
      if (medTypeThresholds[med.forme] !== undefined) {
        return medTypeThresholds[med.forme];
      }
      if (medCategoryThresholds[med.categorie] !== undefined) {
        return medCategoryThresholds[med.categorie];
      }
    }
    return med.seuil || 10;
  };

  const handleUpdateTypeThresholds = (newThresholds: Record<string, number>) => {
    setMedTypeThresholds(newThresholds);
  };

  const handleUpdateCategoryThresholds = (newThresholds: Record<string, number>) => {
    setMedCategoryThresholds(newThresholds);
  };

  const handleUpdateApplyMode = (newMode: "override" | "fallback") => {
    setThresholdApplyMode(newMode);
  };

  // PIN access control systems
  const [currentUserPin, setCurrentUserPin] = useState<string>(() => {
    return (typeof window !== "undefined" && localStorage.getItem("dg_current_user_pin")) || "";
  });

  // Secure logout states
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutPinInput, setLogoutPinInput] = useState("");
  const [logoutError, setLogoutError] = useState("");

  const handleConfirmLogout = () => {
    const pin = logoutPinInput.trim();
    if (pin === currentUserPin) {
      setCurrentUserPin("");
      localStorage.removeItem("dg_current_user_pin");
      setShowLogoutConfirm(false);
      setLogoutPinInput("");
      setLogoutError("");
      showToast("Fermeture de poste", "Votre poste de travail a été fermé avec succès.", "success");
    } else {
      setLogoutError("Code incorrect. Fermeture refusée.");
    }
  };

  const currentUser = React.useMemo(() => {
    if (!currentUserPin) return null;
    if (currentUserPin === "0000") {
      return {
        id: "responsable",
        nom: "Responsable du Service",
        poste: "Responsable",
        contact: "",
        horaire: "Toutes heures",
        codeEntree: "0000"
      };
    }
    return staff.find((s) => s.codeEntree === currentUserPin) || null;
  }, [currentUserPin, staff]);

  // If PIN exists but user doesn't exist anymore, reset it
  useEffect(() => {
    if (currentUserPin && currentUserPin !== "0000" && !currentUser) {
      setCurrentUserPin("");
      localStorage.removeItem("dg_current_user_pin");
    }
  }, [currentUserPin, currentUser]);

  // Session Auto-Lock system (5 minutes of inactivity)
  const [timeLeft, setTimeLeft] = useState<number>(300); // 300 seconds (5 minutes)
  const lastActivityRef = React.useRef<number>(Date.now());

  useEffect(() => {
    if (!currentUserPin) return;

    // Reset last activity and initial time left on mount or when user changes
    lastActivityRef.current = Date.now();
    setTimeLeft(300);

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Listeners for user actions to detect activity
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("keypress", handleActivity);
    window.addEventListener("scroll", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    // Dynamic countdown timer check
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remainingMs = Math.max(0, INACTIVITY_TIMEOUT - elapsed);
      const remainingSecs = Math.ceil(remainingMs / 1000);
      
      setTimeLeft(remainingSecs);

      if (remainingSecs <= 0) {
        setCurrentUserPin("");
        localStorage.removeItem("dg_current_user_pin");
        showToast(
          "Session verrouillée",
          "Votre session a été verrouillée automatiquement après 5 minutes d'inactivité.",
          "info"
        );
      }
    }, 1000);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("keypress", handleActivity);
      window.removeEventListener("scroll", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      clearInterval(interval);
    };
  }, [currentUserPin]);

  const formatTimeLeft = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const allowedTabs = React.useMemo(() => {
    if (!currentUser) return [];
    const p = currentUser.poste.toLowerCase();
    
    // Responsable has full control of all stations
    if (p.includes("responsable") || p.includes("directeur") || p.includes("admin") || p.includes("chef") || currentUserPin === "0000") {
      return [
        "dashboard", "medecine", "urgences", "hospit", "pediatrie", "maternite", "vaccination", "planif_familiale",
        "labo", "pharma", "taches", "rdv", "rdv_en_ligne", "factures", "actes_tarifs",
        "assurances", "rh", "indicateurs", "qualite", "documents", "settings"
      ];
    }
    
    const tabs = ["taches"]; // everyone can see tasks
    if (p.includes("médecin") || p.includes("medecin") || p.includes("pédiatre") || p.includes("pediatre") || p.includes("praticien")) {
      tabs.push("dashboard", "medecine", "urgences", "hospit", "pediatrie", "rdv", "documents", "planif_familiale", "actes_tarifs");
    } else if (p.includes("sage-femme") || p.includes("maternité") || p.includes("maternite")) {
      tabs.push("maternite", "vaccination", "rdv", "documents", "planif_familiale");
    } else if (p.includes("infirmier") || p.includes("aide-soignant") || p.includes("triage")) {
      tabs.push("urgences", "hospit", "vaccination", "rdv");
    } else if (p.includes("labo") || p.includes("laborantin")) {
      tabs.push("labo");
    } else if (p.includes("pharma") || p.includes("pharmacien") || p.includes("stock")) {
      tabs.push("pharma", "actes_tarifs");
    } else if (p.includes("accueil") || p.includes("secrétaire") || p.includes("secretaire") || p.includes("réception") || p.includes("reception")) {
      tabs.push("rdv", "rdv_en_ligne", "factures", "actes_tarifs");
    } else if (p.includes("comptable") || p.includes("finance") || p.includes("caissier")) {
      tabs.push("factures", "assurances", "actes_tarifs");
    } else {
      tabs.push("dashboard", "rdv");
    }
    return tabs;
  }, [currentUser, currentUserPin]);

  // Active Panel Route
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Keep activeTab within allowed tabs
  useEffect(() => {
    if (currentUser && allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [currentUser, allowedTabs, activeTab]);

  // PIN Login States
  const [pinInput, setPinInput] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loginError, setLoginError] = useState("");

  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pin = pinInput.trim();
    if (!pin) {
      setLoginError("Veuillez saisir un code d'accès.");
      return;
    }

    if (pin === "0000") {
      setCurrentUserPin("0000");
      localStorage.setItem("dg_current_user_pin", "0000");
      setPinInput("");
      setLoginError("");
      showToast("Bienvenue", "Connexion réussie en tant que Responsable du Service.", "success");
      return;
    }

    const found = staff.find((s) => s.codeEntree === pin);
    if (found) {
      setCurrentUserPin(pin);
      localStorage.setItem("dg_current_user_pin", pin);
      setPinInput("");
      setLoginError("");
      showToast("Bienvenue", `Connexion réussie : ${found.nom} (${found.poste}).`, "success");
    } else {
      setLoginError("Code d'accès incorrect. Veuillez réessayer.");
    }
  };

  const handleKeypadPress = (val: string) => {
    setLoginError("");
    if (pinInput.length < 10) {
      setPinInput((prev) => prev + val);
    }
  };

  const handleKeypadClear = () => {
    setLoginError("");
    setPinInput("");
  };

  // Keyboard Shortcuts Help Modal State
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);

  // Keyboard Shortcut Event Listener Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting shortcuts when user is actively typing in form inputs, textareas, or select dropdowns
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

      // Escape key closes open custom modals
      if (e.key === "Escape") {
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
      }

      const hasCtrlOrCmd = e.ctrlKey || e.metaKey;
      const hasAlt = e.altKey;

      // 1. HELP MODAL: Ctrl + / or Alt + / or Shift + ?
      if ((hasCtrlOrCmd && e.key === "/") || (hasAlt && e.key === "/") || (e.shiftKey && e.key === "?")) {
        if (!isInput) {
          e.preventDefault();
          setIsShortcutsModalOpen((prev) => !prev);
          return;
        }
      }

      // 2. PATIENT SEARCH: Ctrl + F or Alt + S
      if ((hasCtrlOrCmd && e.key.toLowerCase() === "f") || (hasAlt && e.key.toLowerCase() === "s")) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Rechercher un patient"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          showToast("Recherche Rapide", "Saisissez le nom ou l'identifiant du patient", "info");
        }
        return;
      }

      // 3. STORAGE SYNC: Ctrl + S (or Alt + S when not input, but let's use Ctrl + S)
      if (hasCtrlOrCmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSync();
        showToast("Synchronisation forcée", "Mise à jour des données locales complétée !", "success");
        return;
      }

      // 4. GENERAL CABINET PRINT: Ctrl + P or Alt + P
      if ((hasCtrlOrCmd && e.key.toLowerCase() === "p") || (hasAlt && e.key.toLowerCase() === "p")) {
        if (!isInput) {
          e.preventDefault();
          showToast("Impression Cabinet", "Génération de la vue et préparation d'impression...", "info");
          setTimeout(() => {
            window.print();
          }, 400);
          return;
        }
      }

      // 5. TOGGLE SIDEBAR NAVIGATION: Ctrl + B or Alt + B
      if ((hasCtrlOrCmd && e.key.toLowerCase() === "b") || (hasAlt && e.key.toLowerCase() === "b")) {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
        return;
      }

      // 6. TOGGLE THEME MODE: Alt + K
      if (hasAlt && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTheme((prev) => {
          const next = prev === "dark" ? "light" : "dark";
          showToast("Changement de Thème", `Thème basculé en mode ${next === "dark" ? "Sombre" : "Clair"}`, "info");
          return next;
        });
        return;
      }

      // 6.5. TOGGLE FULLSCREEN: Alt + F or F11
      if ((hasAlt && e.key.toLowerCase() === "f") || e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // 7. PREVIOUS / NEXT TAB TRANSITIONS: Alt + [ or Alt + ArrowLeft / Alt + ] or Alt + ArrowRight
      if (hasAlt) {
        if (e.key === "[" || e.key === "ArrowLeft") {
          e.preventDefault();
          setActiveTab((prev) => {
            const idx = ALL_TABS.indexOf(prev);
            const newIdx = (idx - 1 + ALL_TABS.length) % ALL_TABS.length;
            const nextTab = ALL_TABS[newIdx];
            showToast("Navigation Raccourcie", `Onglet : ${getTabLabel(nextTab)}`, "info");
            return nextTab;
          });
          return;
        }
        if (e.key === "]" || e.key === "ArrowRight") {
          e.preventDefault();
          setActiveTab((prev) => {
            const idx = ALL_TABS.indexOf(prev);
            const newIdx = (idx + 1) % ALL_TABS.length;
            const nextTab = ALL_TABS[newIdx];
            showToast("Navigation Raccourcie", `Onglet : ${getTabLabel(nextTab)}`, "info");
            return nextTab;
          });
          return;
        }

        // 8. MNEMONIC ONE-KEY ACCESS (Alt + <key>)
        if (!isInput) {
          const key = e.key.toLowerCase();
          let target: string | null = null;
          switch (key) {
            case "o": target = "dashboard"; break;    // Overview / Dashboard Global
            case "c": target = "medecine"; break;     // Consultation
            case "u": target = "urgences"; break;     // Urgences
            case "h": target = "hospit"; break;       // Hospitalisation
            case "e": target = "pediatrie"; break;    // Enfant / pédiatrie
            case "m": target = "maternite"; break;    // Maternité
            case "v": target = "vaccination"; break;   // Vaccination
            case "l": target = "labo"; break;          // Laboratoire
            case "p": target = "pharma"; break;        // Pharmacie
            case "t": target = "taches"; break;        // Tâches
            case "r": target = "rdv"; break;           // Rendez-vous
            case "y": target = "rdv_en_ligne"; break;  // phYsical or online RDV / portal
            case "j": target = "factures"; break;      // Journal de factures / finances
            case "a": target = "assurances"; break;    // Assurances
            case "g": target = "rh"; break;            // Gestion RH
            case "i": target = "indicateurs"; break;   // Indicateurs épidémio
            case "q": target = "qualite"; break;       // Qualité
            case "d": target = "documents"; break;     // Documents
          }

          if (target) {
            e.preventDefault();
            setActiveTab(target);
            showToast("Navigation Directe", `Ouverture de : ${getTabLabel(target)}`, "success");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isShortcutsModalOpen, theme]);

  // Monitor critical stock level thresholds
  const prevMedsRef = React.useRef<Medicament[]>([]);
  useEffect(() => {
    if (!isLoaded) return;
    const prevMeds = prevMedsRef.current;
    if (prevMeds && prevMeds.length > 0) {
      medicaments.forEach((med) => {
        const prevMed = prevMeds.find((p) => p.id === med.id);
        if (prevMed) {
          const stockDecreased = med.stock < prevMed.stock;
          const currentSeuil = getMedEffectiveThreshold(med);
          const prevSeuil = getMedEffectiveThreshold(prevMed);
          const nowCritical = med.stock <= currentSeuil;
          const prevWasCritical = prevMed.stock <= prevSeuil;
 
          if (stockDecreased && nowCritical) {
            if (!prevWasCritical) {
              showToast(
                "Stock Critique Atteint ⚠️",
                `Le médicament "${med.nom} (${med.dosage} ${med.forme})" a atteint son seuil critique de stock ! Stock actuel : ${med.stock} (Seuil de sécurité : ${currentSeuil})`,
                "error"
              );
              sendBrowserNotification(
                "Seuil de Stock Critique ! 📦",
                `Alerte : Le médicament "${med.nom} (${med.dosage})" a atteint son seuil critique de stock ! Unités restantes : ${med.stock}.`,
                `stock-${med.id}`
              );
            } else {
              showToast(
                "Stock Critique Épuisé ⚠️",
                `Le stock de "${med.nom}" continue de baisser ! Reste : ${med.stock} unités (Seuil : ${currentSeuil})`,
                "warning"
              );
              sendBrowserNotification(
                "Stock Critique Épuisé ! ⚠️",
                `Le stock de "${med.nom} (${med.dosage})" continue de s'épuiser. Reste : ${med.stock} unités (Seuil : ${currentSeuil}).`,
                `stock-${med.id}`
              );
            }
          }
        }
      });
    }
    prevMedsRef.current = medicaments;
  }, [medicaments, isLoaded, medTypeThresholds, medCategoryThresholds, thresholdApplyMode]);

  // Monitor newly assigned or created urgent tasks for the logged-in user
  const prevTasksRef = React.useRef<Task[]>([]);
  useEffect(() => {
    if (!isLoaded) return;
    const prevTasks = prevTasksRef.current;
    
    if (prevTasks && prevTasks.length > 0) {
      tasks.forEach((task) => {
        const prevTask = prevTasks.find((pt) => pt.id === task.id);
        const isNew = !prevTask;
        const isUrgent = task.priorite === "haute";
        const isNotDone = !task.done;
        
        if (isUrgent && isNotDone) {
          const isAssignedToMe = currentUser && task.assigne === currentUser.id;
          const isManager = currentUserPin === "0000";
          
          const becameAssignedToMe = isAssignedToMe && (!prevTask || prevTask.assigne !== currentUser.id);
          const newlyCreatedManagerAlert = isManager && isNew;
          
          if (becameAssignedToMe) {
            sendBrowserNotification(
              "Nouvelle Tâche Urgente 🚨",
              `Une tâche urgente vous a été assignée : "${task.label}" (Heure : ${task.heure || '—'})`,
              `task-${task.id}`
            );
          } else if (newlyCreatedManagerAlert) {
            const staffMember = staff.find((s) => s.id === task.assigne);
            const staffName = staffMember ? staffMember.nom : "un agent";
            sendBrowserNotification(
              "Nouvelle Tâche Clinique Urgente 🚨",
              `Tâche urgente assignée à ${staffName} : "${task.label}"`,
              `task-mgmt-${task.id}`
            );
          }
        }
      });
    }
    prevTasksRef.current = tasks;
  }, [tasks, currentUser, currentUserPin, isLoaded, staff]);

  // Load and seed DB on initial mount
  useEffect(() => {
    seedLocalStorage();

    const rawStaff = safeGet<Staff[]>("dg_staff", []);
    const migratedStaff = migrateStaff(rawStaff);
    setStaff(migratedStaff);
    safeSet("dg_staff", migratedStaff);
    setMedicaments(safeGet<Medicament[]>("dg_pharma_stock", []));
    setMouvements(safeGet<MouvementStock[]>("dg_pharma_mouvements", []));
    setAssureurs(safeGet<any[]>("dg_assureurs", []));
    setAssures(safeGet<any[]>("dg_assures", []));
    setTasks(safeGet<Task[]>("dg_tasks", []));
    const rawConsultations = safeGet<any[]>("dg_consultations", []);
    const migratedConsultations = migrateConsultations(rawConsultations);
    setConsultations(migratedConsultations);
    safeSet("dg_consultations", migratedConsultations);

    const rawPediatrie = safeGet<any[]>("dg_pediatrie", []);
    const migratedPediatrie = migratePediatrie(rawPediatrie);
    setPediatrie(migratedPediatrie);
    safeSet("dg_pediatrie", migratedPediatrie);

    const rawMaterniteCpns = safeGet<any[]>("dg_maternite_cpn", []);
    const migratedMaterniteCpns = migrateMaterniteCpns(rawMaterniteCpns);
    setMaterniteCpns(migratedMaterniteCpns);
    safeSet("dg_maternite_cpn", migratedMaterniteCpns);

    setMaterniteAccouchements(safeGet<Accouchement[]>("dg_maternite_accouchements", []));
    setRdv(safeGet<RendezVous[]>("dg_rdv", []));
    setHospCapacite(safeGet<number>("dg_hosp_capacite", 20));
    setHospitalisations(safeGet<Hospitalisation[]>("dg_hospitalisations", []));
    setHospEvolutions(safeGet<Evolution[]>("dg_hosp_evolutions", []));
    setFicheReferences(safeGet<FicheReference[]>("dg_fiches_reference", []));
    setFactures(safeGet<Facture[]>("dg_factures", []));
    setDepenses(safeGet<Depense[]>("dg_depenses", []));
    setIncidents(safeGet<Incident[]>("dg_incidents", []));
    setActions(safeGet<ActionCorrective[]>("dg_actions", []));
    setAudits(safeGet<Audit[]>("dg_audits", []));
    setConges(safeGet<Conge[]>("dg_conges", []));
    setAbsences(safeGet<Absence[]>("dg_absences", []));
    setRhFiches(safeGet<RhFiche[]>("dg_rh", []));
    setPrisesEnCharge(safeGet<PriseEnCharge[]>("dg_prises_charge", []));

    const rawUrgences = safeGet<any[]>("dg_urgences", []);
    const migratedUrgences = migrateUrgences(rawUrgences);
    setUrgences(migratedUrgences);
    safeSet("dg_urgences", migratedUrgences);
    setVaccinations(safeGet<Vaccination[]>("dg_vaccinations", []));
    setLaboExamens(safeGet<ExamenLabo[]>("dg_labo_examens", []));
    setDocuments(safeGet<DocumentArchive[]>("dg_documents", []));
    setActesTarifaires(safeGet<ActeTarifaire[]>("dg_actes_tarifaires", []));
    setIsLoaded(true);
  }, []);

  // Écoute en temps réel des changements faits depuis d'autres appareils.
  // Dès qu'un autre appareil enregistre une consultation, un rendez-vous, etc.,
  // la mise à jour arrive automatiquement ici, sans avoir besoin de recharger la page.
  useEffect(() => {
    if (!isLoaded || !db) return;

    const unsubscribers: Array<() => void> = [];

    Object.entries(liveSyncSetters.current).forEach(([key, setter]: [string, (data: any) => void]) => {
      const unsubscribe = subscribeToCloudKey(key, (remoteData) => {
        if (!Array.isArray(remoteData) && typeof remoteData !== "number") return;

        const remoteJson = JSON.stringify(remoteData);
        const localValue = lastSavedRef.current[key];
        if (localValue !== undefined && JSON.stringify(localValue) === remoteJson) {
          return; // Aucune vraie différence, on ignore.
        }

        setter(remoteData);
        safeSet(key, remoteData);
        lastSavedRef.current[key] = remoteData;
        lastCloudSyncedRef.current[key] = remoteData;
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isLoaded]);

  // Load and restore staff from Firestore if available
  useEffect(() => {
    if (!isLoaded) return;
    
    const fetchCloudStaff = async () => {
      if (!db) return;
      
      // If client is offline, skip trying to reach the server, but allow reading from cache if available
      const isBrowserOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      
      try {
        // Try getting document. If offline, prioritize cache or handle gracefully.
        const options = isBrowserOnline ? {} : { source: "cache" as const };
        const docRef = await db.collection("dg_staff_cloud").doc("global_list").get(options);
        
        if (docRef.exists) {
          const cloudData = docRef.data();
          if (cloudData && Array.isArray(cloudData.staff) && cloudData.staff.length > 0) {
            const cloudStaff = migrateStaff(cloudData.staff);
            
            // Check if cloud staff differs from local staff (by length, IDs, or codes)
            const localIds = new Set(staff.map(s => s.id));
            const cloudIds = new Set(cloudStaff.map(s => s.id));
            const hasDifference = cloudStaff.length !== staff.length || 
                                  cloudStaff.some(s => !localIds.has(s.id)) ||
                                  staff.some(s => !cloudIds.has(s.id)) ||
                                  cloudStaff.some(cs => {
                                    const ls = staff.find(s => s.id === cs.id);
                                    return ls && ls.codeEntree !== cs.codeEntree;
                                  });
                                  
            if (hasDifference) {
              setStaff(cloudStaff);
              safeSet("dg_staff", cloudStaff);
              showToast(
                "Personnel rétabli du Cloud ☁️",
                `Le personnel enregistré hier (${cloudStaff.length} agents) a été synchronisé avec leurs codes d'accès.`,
                "success"
              );
            }
          }
        }
      } catch (err: any) {
        // Log silently or handle offline error gracefully
        if (err?.message?.includes("offline") || err?.code === "unavailable") {
          console.log("Firestore is offline or unavailable. Staff will be synchronized once online.");
        } else {
          console.error("Failed to restore staff from Firestore on startup:", err);
        }
      }
    };

    fetchCloudStaff();

    // Listen to online events to trigger recovery automatically when network is back
    const handleSyncOnOnline = () => {
      fetchCloudStaff();
    };

    window.addEventListener("online", handleSyncOnOnline);
    return () => {
      window.removeEventListener("online", handleSyncOnOnline);
    };
  }, [isLoaded]);

  // Keep latest data in ref to avoid resetting the auto-save timer on every keypress
  const latestDataRef = React.useRef<any>({});
  // Track previously saved references to only write dirty slices
  const lastSavedRef = React.useRef<any>({});

  useEffect(() => {
    latestDataRef.current = {
      dg_staff: staff,
      dg_pharma_stock: medicaments,
      dg_pharma_mouvements: mouvements,
      dg_tasks: tasks,
      dg_consultations: consultations,
      dg_pediatrie: pediatrie,
      dg_maternite_cpn: materniteCpns,
      dg_maternite_accouchements: materniteAccouchements,
      dg_rdv: rdv,
      dg_hospitalisations: hospitalisations,
      dg_fiches_reference: ficheReferences,
      dg_hosp_evolutions: hospEvolutions,
      dg_factures: factures,
      dg_depenses: depenses,
      dg_incidents: incidents,
      dg_actions: actions,
      dg_audits: audits,
      dg_conges: conges,
      dg_absences: absences,
      dg_rh: rhFiches,
      dg_prises_charge: prisesEnCharge,
      dg_urgences: urgences,
      dg_vaccinations: vaccinations,
      dg_labo_examens: laboExamens,
      dg_documents: documents,
      dg_actes_tarifaires: actesTarifaires
    };
  }, [
    staff, medicaments, mouvements, tasks, consultations, pediatrie,
    materniteCpns, materniteAccouchements, rdv, hospitalisations, ficheReferences,
    hospEvolutions, factures, depenses, incidents, actions, audits,
    conges, absences, rhFiches, prisesEnCharge, urgences, vaccinations,
    laboExamens, documents, actesTarifaires
  ]);

  // Periodic auto-save effect
  useEffect(() => {
    if (!isLoaded) return;

    if (!lastAutoSave) {
      setLastAutoSave(new Date().toLocaleTimeString("fr-FR"));
    }

    // Populate initial saved references on load so first tick is not falsely flagged as completely dirty
    const initialData = latestDataRef.current;
    Object.entries(initialData).forEach(([key, val]) => {
      lastSavedRef.current[key] = val;
      lastCloudSyncedRef.current[key] = val;
    });

    const interval = setInterval(() => {
      const data = latestDataRef.current;
      let hasChanges = false;
      
      // Perform fast reference checks to determine if anything is dirty
      Object.entries(data).forEach(([key, state]) => {
        if (state !== lastSavedRef.current[key]) {
          hasChanges = true;
        }
      });

      if (!hasChanges) {
        // Nothing changed, skip expensive serialization and storage writes entirely
        return;
      }

      setIsSaving(true);
      try {
        Object.entries(data).forEach(([key, state]) => {
          if (state !== undefined && state !== lastSavedRef.current[key]) {
            localStorage.setItem(key, JSON.stringify(state));
            lastSavedRef.current[key] = state; // update saved ref

            // Envoie aussi vers le cloud (sauf le personnel, qui a son propre circuit),
            // pour que les autres appareils reçoivent la mise à jour en temps réel.
            if (key !== "dg_staff" && liveSyncSetters.current[key] && db) {
              pushToCloudKey(key, state)
                .then(() => {
                  lastCloudSyncedRef.current[key] = state;
                })
                .catch(() => {
                  // Échec (ex: hors-ligne) : on retentera au prochain cycle
                  // puisque lastCloudSyncedRef n'a pas été mis à jour.
                });
            }
          }
        });
        setLastAutoSave(new Date().toLocaleTimeString("fr-FR"));
      } catch (err) {
        console.error("Auto-save failed:", err);
      } finally {
        setTimeout(() => setIsSaving(false), 800);
      }
    }, 15000); // Sauvegarde locale + synchro cloud toutes les 15 secondes

    return () => clearInterval(interval);
  }, [isLoaded]);

  // Sync methods
  const handleUpdateStaff = (newStaff: Staff[]) => {
    setStaff(newStaff);
    safeSet("dg_staff", newStaff);
    
    // Asynchronously back up to cloud Firestore
    if (db) {
      db.collection("dg_staff_cloud").doc("global_list").set({
        staff: newStaff,
        updatedAt: new Date().toISOString()
      }).then(() => {
        console.log("Cloud backup updated successfully.");
      }).catch((err) => {
        console.error("Cloud backup auto-update failed:", err);
      });
    }
  };

  const handleUpdateMedicaments = (newMeds: Medicament[]) => {
    setMedicaments(newMeds);
    safeSet("dg_pharma_stock", newMeds);
  };

  const handleUpdateMouvements = (newMovs: MouvementStock[]) => {
    setMouvements(newMovs);
    safeSet("dg_pharma_mouvements", newMovs);
  };

  const handleUpdateTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    safeSet("dg_tasks", newTasks);
  };

  const handleUpdateConsultations = (newConsults: Consultation[]) => {
    setConsultations(newConsults);
    safeSet("dg_consultations", newConsults);
  };

  const handleUpdatePediatrie = (newPed: FichePediatrique[]) => {
    setPediatrie(newPed);
    safeSet("dg_pediatrie", newPed);
  };

  const handleUpdateMaterniteCpns = (newCpns: ConsultationPrenatale[]) => {
    setMaterniteCpns(newCpns);
    safeSet("dg_maternite_cpn", newCpns);
  };

  const handleUpdateMaterniteAccouchements = (newAccs: Accouchement[]) => {
    setMaterniteAccouchements(newAccs);
    safeSet("dg_maternite_accouchements", newAccs);
  };

  const handleUpdateRdv = (newRdv: RendezVous[]) => {
    setRdv(newRdv);
    safeSet("dg_rdv", newRdv);
  };

  const handleUpdateHospitalisations = (newHosps: Hospitalisation[]) => {
    setHospitalisations(newHosps);
    safeSet("dg_hospitalisations", newHosps);
  };

  const handleUpdateHospEvolutions = (newEvs: Evolution[]) => {
    setHospEvolutions(newEvs);
    safeSet("dg_hosp_evolutions", newEvs);
  };

  const handleUpdateFicheReferences = (newRefs: FicheReference[]) => {
    setFicheReferences(newRefs);
    safeSet("dg_fiches_reference", newRefs);
  };

  const handleUpdateFactures = (newInvoices: Facture[]) => {
    setFactures(newInvoices);
    safeSet("dg_factures", newInvoices);
  };

  const handleUpdateDepenses = (newDepenses: Depense[]) => {
    setDepenses(newDepenses);
    safeSet("dg_depenses", newDepenses);
  };

  const handleUpdateIncidents = (newIncidents: Incident[]) => {
    setIncidents(newIncidents);
    safeSet("dg_incidents", newIncidents);
  };

  const handleUpdateActions = (newActions: ActionCorrective[]) => {
    setActions(newActions);
    safeSet("dg_actions", newActions);
  };

  const handleUpdateAudits = (newAudits: Audit[]) => {
    setAudits(newAudits);
    safeSet("dg_audits", newAudits);
  };

  const handleUpdateConges = (newConges: Conge[]) => {
    setConges(newConges);
    safeSet("dg_conges", newConges);
  };

  const handleUpdateAbsences = (newAbsences: Absence[]) => {
    setAbsences(newAbsences);
    safeSet("dg_absences", newAbsences);
  };

  const handleUpdateRhFiches = (newRh: RhFiche[]) => {
    setRhFiches(newRh);
    safeSet("dg_rh", newRh);
  };

  const handleUpdatePrisesEnCharge = (newPec: PriseEnCharge[]) => {
    setPrisesEnCharge(newPec);
    safeSet("dg_prises_charge", newPec);
  };

  const handleUpdateAssureurs = (newAssureurs: any[]) => {
    setAssureurs(newAssureurs);
    safeSet("dg_assureurs", newAssureurs);
  };

  const handleUpdateAssures = (newAssures: any[]) => {
    setAssures(newAssures);
    safeSet("dg_assures", newAssures);
  };

  const handleUpdateUrgences = (newUrgences: PatientUrgence[]) => {
    setUrgences(newUrgences);
    safeSet("dg_urgences", newUrgences);
  };

  const handleUpdateVaccinations = (newVacc: Vaccination[]) => {
    setVaccinations(newVacc);
    safeSet("dg_vaccinations", newVacc);
  };

  const handleUpdateLaboExamens = (newExamens: ExamenLabo[]) => {
    setLaboExamens(newExamens);
    safeSet("dg_labo_examens", newExamens);
  };

  const handleUpdateDocuments = (newDocs: DocumentArchive[]) => {
    setDocuments(newDocs);
    safeSet("dg_documents", newDocs);
  };

  const handleUpdateActesTarifaires = (newActes: ActeTarifaire[]) => {
    setActesTarifaires(newActes);
    safeSet("dg_actes_tarifaires", newActes);
  };

  // Memoized sidebar category definitions - compiled once or when key data updates
  const filteredMenuCategories = React.useMemo(() => {
    const pharmaAlertCount = medicaments.filter((m) => m.stock <= getMedEffectiveThreshold(m)).length;
    const categories = [
      {
        title: "🏠 Vue d'ensemble",
        items: [
          { id: "dashboard", label: "Dashboard Global", icon: LayoutDashboard }
        ]
      },
      {
        title: "🏥 Soins & Clinique",
        items: [
          { id: "medecine", label: "Consultation Générale", icon: Stethoscope },
          { id: "urgences", label: "Triage & Urgences", icon: ShieldAlert, alertCount: urgences.filter((u) => u.statut !== "Sorti(e) ou Libéré(e)").length },
          { id: "hospit", label: "Hospitalisations", icon: HeartPulse, alertCount: hospitalisations.filter((h) => h.statut === "En cours").length },
          { id: "pediatrie", label: "Surveillance Pédiatrique", icon: Activity },
          { id: "maternite", label: "Suivi Maternité & CPN", icon: Sparkles },
          { id: "vaccination", label: "Vaccination & PEV", icon: ShieldCheck },
          { id: "planif_familiale", label: "Planification Familiale", icon: Heart }
        ]
      },
      {
        title: "🧪 Services Médicaux",
        items: [
          { id: "labo", label: "Laboratoire d'analyses", icon: ClipboardList, alertCount: laboExamens.filter((l) => l.statut === "Demandé" || l.statut === "Prélevé").length },
          { id: "pharma", label: "Pharmacie & Stocks", icon: Archive, alertCount: pharmaAlertCount },
          { id: "taches", label: "Tâches & Coordination", icon: Sliders }
        ]
      },
      {
        title: "💼 Gestion & Finance",
        items: [
          { id: "rdv", label: "Planification & RDV", icon: Calendar, alertCount: rdv.filter((r) => r.date === new Date().toISOString().slice(0, 10)).length },
          { id: "rdv_en_ligne", label: "Portail RDV en ligne (Mobile)", icon: Smartphone },
          { id: "factures", label: "Factures & Journal", icon: TrendingUp },
          { id: "actes_tarifs", label: "Actes & Tarifs", icon: Receipt },
          { id: "assurances", label: "Assurances & Tiers-Payant", icon: Briefcase },
          { id: "rh", label: "Ressources Humaines", icon: Users }
        ]
      },
      {
        title: "📊 Qualité & Configuration",
        items: [
          { id: "indicateurs", label: "Indicateurs Épidémio", icon: TrendingUp },
          { id: "qualite", label: "Démarche Qualité", icon: ShieldCheck },
          { id: "documents", label: "Coffre-fort Documents", icon: FileText },
          { id: "settings", label: "Paramètres des Seuils", icon: Settings }
        ]
      }
    ];

    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => allowedTabs.includes(item.id))
      }))
      .filter((cat) => cat.items.length > 0);
  }, [
    allowedTabs,
    urgences,
    hospitalisations,
    laboExamens,
    medicaments,
    rdv,
    medTypeThresholds,
    medCategoryThresholds,
    thresholdApplyMode
  ]);

  // Quick header calculations
  const activeUrgencesCount = urgences.filter((u) => u.statut !== "Sorti(e) ou Libéré(e)").length;
  const patientsActifsCount =
    hospitalisations.filter((h) => h.statut === "En cours").length +
    activeUrgencesCount;

  if (!currentUser) {
    return (
      <SelfHealingErrorBoundary>
        <div className={`min-h-screen flex items-center justify-center font-sans selection:bg-primary-500/20 antialiased p-4 transition-colors duration-200 ${
        theme === "dark" ? "bg-stone-950 text-stone-100" : "bg-stone-100 text-stone-900"
      }`}>
        <div className="w-full max-w-md bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-8 shadow-xl space-y-6">
          {/* Logo & Branding */}
<div className="text-center space-y-2">
<img src="/icon-512.png" alt="DEO GRACIAS" className="mx-auto w-16 h-16 object-contain mb-1" />

            <div className="space-y-1">
              <h1 className="text-xl font-semibold font-serif text-stone-900 dark:text-white tracking-tight">{clinicProfile.name}</h1>
              <p className="text-xs uppercase tracking-widest font-semibold text-primary-600 dark:text-primary-500">{clinicProfile.slogan || "Excellence & Dévouement"}</p>
              <p className="text-2xs text-stone-500 dark:text-stone-400 font-semibold">{clinicProfile.address}</p>
            </div>
          </div>

          <div className="border-t border-stone-100 dark:border-stone-850 pt-5 space-y-4">
            <div className="text-center">
              <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Contrôle d'Accès Sécurisé</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Saisissez votre code d'accès personnel pour déverrouiller vos postes de travail.</p>
            </div>

            {/* PIN Entry Input */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  maxLength={10}
                  placeholder="• • • •"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-full text-center text-2xl font-mono tracking-widest font-semibold border border-stone-200 dark:border-stone-800 rounded-lg py-3 bg-stone-50 dark:bg-stone-950 focus:bg-white dark:focus:bg-stone-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-stone-900 dark:text-white"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-xs font-bold font-sans cursor-pointer bg-transparent border-0"
                >
                  {showPin ? "Masquer" : "Afficher"}
                </button>
              </div>

              {loginError && (
                <div className="bg-danger-50 dark:bg-danger-950/20 border border-danger-200 dark:border-danger-900 text-danger-600 dark:text-danger-400 rounded-xl p-3 text-xs text-center font-semibold flex items-center justify-center gap-1.5 animate-shake">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 active:bg-primary-850 text-white rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>S'authentifier</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>

            {/* Digital PIN Keypad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto pt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num.toString())}
                  className="py-3 bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-lg text-sm transition-all focus:outline-none focus:ring-1 focus:ring-primary-500/50 cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleKeypadClear}
                className="py-3 bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 font-bold rounded-lg text-xs transition-all cursor-pointer"
              >
                Effacer
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress("0")}
                className="py-3 bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-bold rounded-lg text-sm transition-all cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleLoginSubmit()}
                className="py-3 bg-primary-50 dark:bg-primary-950/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-semibold rounded-lg text-xs transition-all cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>

          {/* Quick Help Tip */}
          <div className="bg-stone-50 dark:bg-stone-950/40 border border-stone-200 dark:border-stone-850 rounded-2xl p-4 text-sm text-stone-500 dark:text-stone-400 space-y-2 leading-relaxed">
            <p className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
              💡 Aide à la connexion :
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Chaque praticien doit utiliser son code d'entrée personnel, attribué par le responsable du service dans <strong>Ressources Humaines</strong>.</li>
              <li>Code oublié ou perdu ? Contactez le responsable du service pour le récupérer ou en obtenir un nouveau.</li>
            </ul>
          </div>
        </div>
      </div>
      </SelfHealingErrorBoundary>
    );
  }

  return (
    <SelfHealingErrorBoundary>
      <div className={`min-h-screen flex font-sans selection:bg-primary-500/20 antialiased transition-colors duration-200 ${
      theme === "dark" ? "bg-stone-950 text-stone-100" : "bg-stone-100 text-stone-900"
    }`}>
      {/* Dynamic Left Sidebar Navigation */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        <motion.aside
          initial={false}
          animate={{ 
            x: isSidebarOpen ? 0 : "-100%"
          }}
          transition={{ type: "spring", bounce: 0, duration: 0.4 }}
          className="fixed inset-y-0 left-0 z-50 w-72 bg-stone-900 text-stone-300 border-r border-stone-800 flex flex-col justify-between lg:static lg:flex-shrink-0 shadow-lg lg:transform-none"
        >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header branding */}
          <div className="p-6 border-b border-stone-800 bg-stone-950 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-stone-800 flex-shrink-0 text-md font-serif font-black ${clinicProfile.logoColor === "teal" ? "text-primary-600" : clinicProfile.logoColor === "indigo" ? "text-info-600" : clinicProfile.logoColor === "rose" ? "text-danger-600" : "text-success-600"}`}>
                {clinicProfile.logoUrl ? (
                  <img
                    src={clinicProfile.logoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  clinicProfile.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-white tracking-wider font-serif truncate max-w-[140px]">{clinicProfile.name}</div>
                <div className="text-xs uppercase tracking-widest font-semibold text-primary-500 leading-none truncate max-w-[140px]">{clinicProfile.address.split(",")[0]}</div>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden text-stone-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrolling Categories List */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            {filteredMenuCategories.map((cat, i) => (
              <div key={i} className="space-y-1.5">
                <div className="text-xs font-semibold tracking-widest text-stone-400 uppercase px-3 mb-1">
                  {cat.title}
                </div>
                {cat.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (window.innerWidth < 1024) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={`w-full text-left text-xs font-bold px-3 py-2.5 rounded-lg transition-all flex items-center justify-between group ${
                        isActive
                          ? "bg-primary-600 text-white shadow-md font-semibold"
                          : "hover:bg-stone-800 text-stone-400 hover:text-stone-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-stone-400 group-hover:text-stone-300"}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.alertCount ? (
                        <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded-full ${isActive ? "bg-white text-primary-800" : "bg-danger-600/25 text-danger-500"}`}>
                          {item.alertCount}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Panneau Système — compact, replié par défaut */}
          <div className="border-t border-stone-850 bg-stone-900/40 text-xs">
            {/* Ligne toujours visible : statut de connexion + accès rapide au thème */}
            <div className="flex items-center gap-1 px-2 py-1">
              <button
                onClick={() => setIsSystemPanelOpen((prev) => !prev)}
                className="flex-1 flex items-center gap-2 min-w-0 px-2 py-2 rounded-lg hover:bg-stone-800/60 transition-all cursor-pointer"
                title={isSystemPanelOpen ? "Réduire le panneau système" : "Voir le détail synchronisation, connectivité et thème"}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  {effectiveOnline ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-warning-500"></span>
                  )}
                </span>
                <span className={`text-xs font-semibold uppercase tracking-wide truncate ${effectiveOnline ? "text-success-500" : "text-warning-500"}`}>
                  {effectiveOnline ? "En Ligne" : "Hors-Ligne"}
                </span>
                {pendingSyncCount > 0 && (
                  <span className="text-2xs font-semibold bg-warning-100 text-warning-800 px-1.5 py-0.5 rounded-lg border border-warning-200 shrink-0">
                    {pendingSyncCount}
                  </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 shrink-0 ml-auto transition-transform duration-200 ${isSystemPanelOpen ? "rotate-180" : ""}`} />
              </button>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="shrink-0 p-2 rounded-lg hover:bg-stone-800/60 text-stone-400 hover:text-white transition-all cursor-pointer"
                title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4 text-warning-400" />
                ) : (
                  <Moon className="w-4 h-4 text-primary-400" />
                )}
              </button>
            </div>

            {/* Détail : replié par défaut, sur simple clic */}
            {isSystemPanelOpen && (
              <div className="px-4 pb-4 pt-1 space-y-3">
                <div className="bg-stone-950/40 rounded-xl p-3 border border-stone-800/80 space-y-2">
                  <div className="flex items-center gap-1.5 text-stone-300">
                    {isSyncing ? (
                      <RefreshCw className="w-3.5 h-3.5 text-primary-400 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-success-400" />
                    )}
                    <span className="font-semibold text-stone-300 text-sm">
                      {isSyncing ? "Sync en cours..." : "Local synchronisé"}
                    </span>
                  </div>

                  <div className="text-xs text-stone-400 flex justify-between items-center bg-stone-900/40 px-2 py-1 rounded-lg border border-stone-800/50">
                    <span className="font-medium text-stone-400">Dernière sync :</span>
                    <span className="font-mono font-bold text-stone-300">
                      {lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>

                  <div className="text-xs text-stone-400 flex justify-between items-center bg-stone-900/40 px-2 py-1 rounded-lg border border-stone-800/50">
                    <span className="font-medium text-stone-400 flex items-center gap-1.5">
                      <span className={`relative flex h-1.5 w-1.5`}>
                        {isSaving ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning-500"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success-500"></span>
                        )}
                      </span>
                      Sauvegarde Auto :
                    </span>
                    <span className="font-mono font-bold text-stone-300">
                      {isSaving ? "En cours..." : lastAutoSave || "Prête"}
                    </span>
                  </div>

                  <div className="text-xs text-stone-400 flex justify-between items-center bg-stone-900/40 px-2 py-1 rounded-lg border border-stone-800/50" title="Verrouillage automatique après 5 minutes d'inactivité">
                    <span className="font-medium text-stone-400 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-primary-400 shrink-0" />
                      Auto-verrouillage :
                    </span>
                    <span className="font-mono font-bold text-primary-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400 animate-pulse shrink-0" />
                      {formatTimeLeft(timeLeft)}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="flex-1 bg-stone-800 hover:bg-stone-750 disabled:opacity-50 text-stone-300 disabled:hover:bg-stone-800 hover:text-white px-2 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Synchroniser les données locales"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                      <span>Sync</span>
                    </button>
                    <button
                      onClick={() => setIsForceOffline(!isForceOffline)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
                        isForceOffline
                          ? "bg-warning-500/10 border-warning-500/30 text-warning-400 hover:bg-warning-500/20"
                          : "bg-stone-800 border-transparent hover:bg-stone-750 text-stone-300 hover:text-white"
                      }`}
                      title={isForceOffline ? "Simuler le mode en ligne" : "Simuler le mode hors-ligne"}
                    >
                      {isForceOffline ? <Wifi className="w-3 h-3 text-success-400" /> : <WifiOff className="w-3 h-3 text-stone-400" />}
                      <span>{isForceOffline ? "Rétablir" : "Offline"}</span>
                    </button>
                  </div>
                </div>

                <a
                  href="https://wa.me/22644920162"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-success-600 hover:bg-success-500 text-white font-semibold px-3 py-2 rounded-xl transition-all cursor-pointer text-xs shadow-xs group"
                  title="Contacter le personnel de garde et l'administration via WhatsApp"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 fill-current shrink-0 text-white" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.703 1.456h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/>
                    </svg>
                    <span>WhatsApp Service</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-2xs font-black">
                    <span>44 92 01 62</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </a>
              </div>
            )}
          </div>

          {/* Footer utilisateur */}
          <div className="p-3 border-t border-stone-800 bg-stone-950/40 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-600/20 border border-primary-500/30 flex items-center justify-center text-primary-400 font-semibold uppercase shrink-0 text-2xs">
                {currentUser?.nom ? currentUser.nom.substring(0, 2) : "RS"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm truncate">{currentUser?.nom || "Responsable"}</div>
                <div className="text-2xs text-stone-400 font-semibold uppercase truncate">{currentUser?.poste || "Responsable du Service"}</div>
              </div>
              <button
                onClick={() => {
                  setLogoutPinInput("");
                  setLogoutError("");
                  setShowLogoutConfirm(true);
                }}
                className="shrink-0 p-2 rounded-lg text-stone-400 hover:bg-danger-950/40 hover:text-danger-400 transition-all cursor-pointer"
                title="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        </motion.aside>
      </AnimatePresence>

      {/* Main Workspace content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-colors duration-200 ${
        theme === "dark" ? "bg-stone-900 text-stone-100" : "bg-white text-stone-900"
      }`}>
        {/* Universal Top Dashboard Header */}
        <header className={`border-b h-16 px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs transition-colors duration-200 ${
          theme === "dark" ? "bg-stone-900 border-stone-800 text-white" : "bg-white border-stone-200 text-stone-900"
        }`}>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden text-stone-600 hover:text-stone-900"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden sm:block text-xs font-bold text-stone-500 flex items-center gap-2">
              {effectiveOnline ? (
                <span className={`px-2.5 py-1 rounded-lg border uppercase tracking-wide text-xs flex items-center gap-1.5 ${
                  theme === "dark" ? "bg-success-950/40 text-success-400 border-success-800/50" : "bg-success-50 text-success-700 border-success-200"
                }`}>
                  🟢 Mode Cabinet Actif
                  {pendingSyncCount > 0 && (
                    <span className="bg-warning-100 text-warning-800 px-1.5 py-0.5 rounded-lg border border-warning-200">
                      {pendingSyncCount} attente(s)
                    </span>
                  )}
                </span>
              ) : (
                <span className={`px-2.5 py-1 rounded-lg border uppercase tracking-wide text-xs animate-pulse flex items-center gap-1.5 ${
                  theme === "dark" ? "bg-warning-950/40 text-warning-400 border-warning-800/50" : "bg-warning-50 text-warning-700 border-warning-200"
                }`}>
                  ⚠️ Mode Hors-ligne Actif
                  {pendingSyncCount > 0 && (
                    <span className="bg-warning-100 text-warning-800 px-1.5 py-0.5 rounded-lg border border-warning-200">
                      {pendingSyncCount} attente(s)
                    </span>
                  )}
                </span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
              <span className={`font-mono ${theme === 'dark' ? 'text-stone-500 dark:text-stone-400' : 'text-stone-600'}`}>{getTodayFr()}</span>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative flex-1 max-w-sm mx-4">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un patient (nom, identifiant)..."
                value={headerSearchQuery}
                onChange={(e) => setHeaderSearchQuery(e.target.value)}
                className={`w-full text-xs border rounded-lg pl-9 pr-8 py-2 transition-all font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                  theme === "dark"
                    ? "bg-stone-800 border-stone-700 text-white placeholder-stone-400"
                    : "bg-stone-50 border-stone-200 text-stone-900 focus:bg-white"
                }`}
              />
              {headerSearchQuery && (
                <button
                  onClick={() => setHeaderSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 dark:text-stone-400 hover:text-stone-600 font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Float Dropdown results panel */}
            {headerSearchQuery && (
              <div className={`absolute top-full left-0 right-0 mt-1.5 border rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto p-2 space-y-2 text-left ${
                theme === "dark" ? "bg-stone-800 border-stone-700 text-white" : "bg-white border-stone-200 text-stone-900"
              }`}>
                {(() => {
                  const q = headerSearchQuery.toLowerCase().trim();
                  const matchedUrg = q ? urgences.filter(u => u.patient.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)) : [];
                  const matchedCons = q ? consultations.filter(c => c.patient.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : [];
                  const matchedHosp = q ? hospitalisations.filter(h => h.patient.toLowerCase().includes(q) || h.id.toLowerCase().includes(q)) : [];
                  const tot = matchedUrg.length + matchedCons.length + matchedHosp.length;

                  if (tot === 0) {
                    return (
                      <div className="p-4 text-center text-xs text-stone-500 dark:text-stone-400 italic">
                        Aucun patient trouvé pour "{headerSearchQuery}"
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <div className="text-xs uppercase font-semibold text-stone-500 dark:text-stone-400 px-2 pb-1 border-b border-stone-100 flex justify-between items-center">
                        <span>Résultats ({tot})</span>
                        <button 
                          onClick={() => setHeaderSearchQuery("")}
                          className="text-stone-500 hover:text-stone-700 underline text-2xs uppercase font-bold"
                        >
                          Fermer
                        </button>
                      </div>
                      
                      {matchedUrg.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-2xs uppercase font-bold text-danger-600 px-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-danger-600"></span> Urgences ({matchedUrg.length})
                          </div>
                          {matchedUrg.slice(0, 3).map((u) => (
                            <button
                              key={u.id}
                              onClick={() => {
                                setActiveTab("urgences");
                                setHeaderSearchQuery(u.patient);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-stone-50 rounded-lg flex justify-between items-center transition-all"
                            >
                              <div>
                                <div className="text-xs font-bold text-stone-800">{u.patient}</div>
                                <div className="text-2xs text-stone-500 dark:text-stone-400 font-mono">ID: {u.id} • {u.severite}</div>
                              </div>
                              <span className="text-2xs font-bold text-danger-600 bg-danger-50 px-1.5 py-0.5 rounded-lg border border-danger-200">Voir</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {matchedCons.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-2xs uppercase font-bold text-primary-700 px-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-700"></span> Consultations ({matchedCons.length})
                          </div>
                          {matchedCons.slice(0, 3).map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setActiveTab("medecine");
                                setHeaderSearchQuery(c.patient);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-stone-50 rounded-lg flex justify-between items-center transition-all"
                            >
                              <div>
                                <div className="text-xs font-bold text-stone-800">{c.patient}</div>
                                <div className="text-2xs text-stone-500 dark:text-stone-400 font-mono">ID: {c.id} • Diag: {c.diagnostic}</div>
                              </div>
                              <span className="text-2xs font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded-lg border border-primary-200">Voir</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {matchedHosp.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-2xs uppercase font-bold text-blue-700 px-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-700"></span> Hospitalisations ({matchedHosp.length})
                          </div>
                          {matchedHosp.slice(0, 3).map((h) => (
                            <button
                              key={h.id}
                              onClick={() => {
                                setActiveTab("hospit");
                                setHeaderSearchQuery(h.patient);
                              }}
                              className="w-full text-left px-3 py-1.5 hover:bg-stone-50 rounded-lg flex justify-between items-center transition-all"
                            >
                              <div>
                                <div className="text-xs font-bold text-stone-800">{h.patient}</div>
                                <div className="text-2xs text-stone-500 dark:text-stone-400 font-mono">ID: {h.id} • {h.service} ({h.statut})</div>
                              </div>
                              <span className="text-2xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-lg border border-blue-200">Voir</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            {/* Dedicated High-visibility Urgences Badge */}
            <div
              onClick={() => setActiveTab("urgences")}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-3xs ${
                activeUrgencesCount > 0
                  ? "bg-danger-50 border-danger-200 text-danger-700 hover:bg-danger-100/70 hover:border-danger-300 animate-pulse"
                  : "bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100"
              }`}
              title="Voir le registre de Triage & Urgences"
            >
              <ShieldAlert className={`w-4 h-4 ${activeUrgencesCount > 0 ? "text-danger-600 animate-bounce" : "text-stone-500 dark:text-stone-400"}`} />
              <div className="flex items-center gap-1 text-xs sm:text-xs font-black">
                <span className={`font-mono text-xs sm:text-sm px-1.5 py-0.5 rounded-lg border ${
                  activeUrgencesCount > 0 ? "bg-danger-600 text-white border-danger-700" : "bg-stone-200 text-stone-600 border-stone-300"
                }`}>
                  {activeUrgencesCount}
                </span>
                <span className="hidden sm:inline uppercase tracking-wide text-xs">
                  {activeUrgencesCount > 1 ? "Urgences Actives" : "Urgence Active"}
                </span>
                <span className="sm:hidden font-bold">Urg.</span>
              </div>
            </div>

            <div className="text-right hidden md:block">
              <div className="text-xs font-semibold text-stone-800">{patientsActifsCount} malades</div>
              <div className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider">Urgences & Obs en cours</div>
            </div>
            
            <button
              onClick={toggleFullscreen}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-stone-800 border-stone-700 hover:bg-stone-700 text-stone-300 hover:text-white"
                  : "bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-stone-900"
              }`}
              title={isFullscreen ? "Quitter le plein écran (Alt + F / F11)" : "Plein écran (Alt + F / F11)"}
            >
              {isFullscreen ? (
                <Minimize className="w-4.5 h-4.5 text-primary-500" />
              ) : (
                <Maximize className="w-4.5 h-4.5" />
              )}
            </button>

            <button
              onClick={() => setIsShortcutsModalOpen(true)}
              className={`p-2 rounded-lg border transition-all cursor-pointer ${
                theme === "dark"
                  ? "bg-stone-800 border-stone-700 hover:bg-stone-700 text-stone-300 hover:text-white"
                  : "bg-stone-50 border-stone-200 hover:bg-stone-100 text-stone-600 hover:text-stone-900"
              }`}
              title="Aide des raccourcis clavier (Ctrl + /)"
            >
              <Keyboard className="w-4.5 h-4.5" />
            </button>

            <div className="flex items-center gap-2 ml-2 pl-4 border-l border-stone-200 dark:border-stone-800">
              <div className="text-right hidden lg:block">
                <div className={`text-xs font-black ${theme === 'dark' ? 'text-stone-200' : 'text-stone-800'}`}>
                  {clinicProfile.name}
                </div>
                <div className="text-2xs text-stone-500 dark:text-stone-400 font-bold tracking-wider uppercase">
                  {clinicProfile.address} • NIF: {clinicProfile.nif} • {clinicProfile.phone}
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-white dark:bg-stone-850 border border-primary-200 text-primary-800 overflow-hidden font-semibold text-xs flex items-center justify-center shadow-2xs font-serif shrink-0">
                {clinicProfile.logoUrl ? (
                  <img
                    src={clinicProfile.logoUrl}
                    alt="Logo"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  clinicProfile.name.slice(0, 2).toUpperCase()
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Panel render staging viewarea */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
          {activeTab === "qualite" && (
            <TabQualite
              audits={audits}
              incidents={incidents}
              actions={actions}
              consultations={consultations}
              onUpdateAudits={handleUpdateAudits}
              onUpdateIncidents={handleUpdateIncidents}
              onUpdateActions={handleUpdateActions}
            />
          )}

          {activeTab === "indicateurs" && (
            <TabIndicateurs
              consultations={consultations}
              staff={staff}
            />
          )}

          {activeTab === "taches" && (
            <TabTaches
              tasks={tasks}
              staff={staff}
              onUpdateStaff={handleUpdateStaff}
              onUpdateTasks={handleUpdateTasks}
              isResponsable={currentUserPin === "0000" || (currentUser?.poste?.toLowerCase() || "").includes("responsable")}
              currentUser={currentUser}
            />
          )}

          {activeTab === "pharma" && (
            <TabPharmacie
              stock={medicaments}
              mouvements={mouvements}
              onUpdateStock={handleUpdateMedicaments}
              onUpdateMouvements={handleUpdateMouvements}
              theme={theme}
              medTypeThresholds={medTypeThresholds}
              medCategoryThresholds={medCategoryThresholds}
              thresholdApplyMode={thresholdApplyMode}
            />
          )}

          {activeTab === "factures" && (
            <TabFacturation
              factures={factures}
              depenses={depenses}
              onUpdateFactures={handleUpdateFactures}
              onUpdateDepenses={handleUpdateDepenses}
            />
          )}

          {activeTab === "rdv" && (
            <TabRDV
              rdvs={rdv}
              staff={staff}
              onUpdateRdvs={handleUpdateRdv}
              showToast={showToast}
            />
          )}

          {activeTab === "rdv_en_ligne" && (
            <TabOnlineRDV />
          )}

          {activeTab === "rh" && (
            <TabRH
              staff={staff}
              fichesRh={rhFiches}
              conges={conges}
              absences={absences}
              onUpdateFichesRh={handleUpdateRhFiches}
              onUpdateConges={handleUpdateConges}
              onUpdateAbsences={handleUpdateAbsences}
              isResponsable={currentUserPin === "0000" || (currentUser?.poste?.toLowerCase() || "").includes("responsable")}
              onUpdateStaff={handleUpdateStaff}
              currentUser={currentUser}
            />
          )}

          {activeTab === "hospit" && (
            <TabHospitalisation
              hospitalisations={hospitalisations}
              evolutions={hospEvolutions}
              ficheReferences={ficheReferences}
              staff={staff}
              onUpdateHospitalisations={handleUpdateHospitalisations}
              onUpdateEvolutions={handleUpdateHospEvolutions}
              onUpdateFicheReferences={handleUpdateFicheReferences}
              filterPatientQuery={headerSearchQuery}
              theme={theme}
            />
          )}

          {activeTab === "vaccination" && (
            <TabVaccination
              vaccinations={vaccinations}
              staff={staff}
              onUpdateVaccinations={handleUpdateVaccinations}
              theme={theme}
            />
          )}

          {activeTab === "labo" && (
            <TabLabo
              examens={laboExamens}
              staff={staff}
              onUpdateExamens={handleUpdateLaboExamens}
              consultations={consultations}
              medicaments={medicaments}
              onUpdateMedicaments={handleUpdateMedicaments}
              mouvements={mouvements}
              onUpdateMouvements={handleUpdateMouvements}
            />
          )}

          {activeTab === "maternite" && (
            <TabMaternite
              cpns={materniteCpns}
              accouchements={materniteAccouchements}
              staff={staff}
              onUpdateCpns={handleUpdateMaterniteCpns}
              onUpdateAccouchements={handleUpdateMaterniteAccouchements}
              laboExamens={laboExamens}
              onUpdateLaboExamens={handleUpdateLaboExamens}
              rdvs={rdv}
              currentUser={currentUser}
            />
          )}

          {activeTab === "assurances" && (
            <TabAssurance
              prisesEnCharge={prisesEnCharge}
              factures={factures}
              staff={staff}
              assureurs={assureurs}
              assures={assures}
              onUpdatePrisesEnCharge={handleUpdatePrisesEnCharge}
              onUpdateFactures={handleUpdateFactures}
              onUpdateAssureurs={handleUpdateAssureurs}
              onUpdateAssures={handleUpdateAssures}
            />
          )}

          {activeTab === "urgences" && (
            <TabUrgences
              urgences={urgences}
              staff={staff}
              onUpdateUrgences={handleUpdateUrgences}
              filterPatientQuery={headerSearchQuery}
              theme={theme}
              isLoading={!isLoaded}
            />
          )}

          {activeTab === "pediatrie" && (
            <TabPediatrie
              pediatrie={pediatrie}
              staff={staff}
              onUpdatePediatrie={handleUpdatePediatrie}
              theme={theme}
            />
          )}

          {activeTab === "dashboard" && (
            <TabDashboardGlobal
              hospitalisations={hospitalisations}
              hospCapacite={hospCapacite}
              medicaments={medicaments}
              rdvs={rdv}
              urgences={urgences}
              consultations={consultations}
              staff={staff}
              setActiveTab={setActiveTab}
              setHeaderSearchQuery={setHeaderSearchQuery}
              filterPatientQuery={headerSearchQuery}
              theme={theme}
              medTypeThresholds={medTypeThresholds}
              medCategoryThresholds={medCategoryThresholds}
              thresholdApplyMode={thresholdApplyMode as any}
              laboExamens={laboExamens}
            />
          )}

          {activeTab === "medecine" && (
            <TabConsultation
              consultations={consultations}
              medicaments={medicaments}
              staff={staff}
              onUpdateConsultations={handleUpdateConsultations}
              filterPatientQuery={headerSearchQuery}
              theme={theme}
              currentUser={currentUser}
              laboExamens={laboExamens}
              onUpdateLaboExamens={handleUpdateLaboExamens}
              isLoading={!isLoaded}
              hospitalisations={hospitalisations}
              onUpdateHospitalisations={handleUpdateHospitalisations}
              urgences={urgences}
              onUpdateUrgences={handleUpdateUrgences}
              onUpdateMedicaments={handleUpdateMedicaments}
              mouvements={mouvements}
              onUpdateMouvements={handleUpdateMouvements}
              documents={documents}
            />
          )}

          {activeTab === "planif_familiale" && (
            <TabPlanifFamiliale
              staff={staff}
              theme={theme}
              laboExamens={laboExamens}
              onUpdateLaboExamens={handleUpdateLaboExamens}
              currentUser={currentUser}
            />
          )}

          {activeTab === "actes_tarifs" && (
            <TabActesTarifs
              actes={actesTarifaires}
              onUpdateActes={handleUpdateActesTarifaires}
              isResponsable={currentUserPin === "0000" || (currentUser?.poste?.toLowerCase() || "").includes("responsable")}
              currentUser={currentUser}
            />
          )}

          {activeTab === "documents" && (
            <TabDocuments
              documents={documents}
              onUpdateDocuments={handleUpdateDocuments}
              consultations={consultations}
              hospitalisations={hospitalisations}
              urgences={urgences}
              pediatrie={pediatrie}
              materniteCpns={materniteCpns}
              factures={factures}
              depenses={depenses}
              currentUser={currentUser}
            />
          )}

          {activeTab === "settings" && (
            <TabSettings
              medTypeThresholds={medTypeThresholds}
              medCategoryThresholds={medCategoryThresholds}
              onUpdateTypeThresholds={handleUpdateTypeThresholds}
              onUpdateCategoryThresholds={handleUpdateCategoryThresholds}
              thresholdApplyMode={thresholdApplyMode}
              onUpdateApplyMode={handleUpdateApplyMode}
              stock={medicaments}
              theme={theme}
            />
          )}
        </main>
      </div>

      {/* Floating Toast Notification Area */}
      <div id="toast-container" className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-stone-900/95 backdrop-blur-md text-white border border-danger-500/30 shadow-2xl rounded-2xl p-4 flex gap-3.5 relative overflow-hidden group select-none"
              id={`toast-${toast.id}`}
            >
              {/* Highlight edge bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-danger-500" />
              
              <div className="flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-danger-400 animate-pulse" />
              </div>
              
              <div className="flex-1 space-y-1 pr-6">
                <h4 className="text-xs font-bold tracking-tight text-stone-100 flex items-center gap-1.5">
                  {toast.title}
                </h4>
                <p className="text-sm text-stone-300 leading-relaxed font-medium">
                  {toast.message}
                </p>
              </div>

              <button
                id={`toast-close-${toast.id}`}
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="absolute top-3 right-3 text-stone-500 dark:text-stone-400 hover:text-white transition-colors p-1 hover:bg-stone-800/80 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Progress bar timeline animation */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-stone-800">
                <motion.div 
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 6, ease: "linear" }}
                  className="h-full bg-danger-500"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Global Keyboard Shortcuts Help Modal */}
      <AnimatePresence>
        {isShortcutsModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShortcutsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className={`relative w-full max-w-2xl rounded-2xl shadow-2xl border overflow-hidden max-h-[85vh] flex flex-col ${
                theme === "dark" ? "bg-stone-900 border-stone-800 text-stone-100" : "bg-white border-stone-200 text-stone-900"
              }`}
            >
              {/* Header */}
              <div className={`p-5 border-b flex items-center justify-between ${
                theme === "dark" ? "border-stone-800 bg-stone-950/40" : "border-stone-100 bg-stone-50"
              }`}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-500/10 text-primary-500 rounded-xl">
                    <Keyboard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-sm tracking-tight">Raccourcis Clavier du Cabinet</h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">Pilotez le Cabinet Médical Deo-Gracias à toute vitesse</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShortcutsModalOpen(false)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    theme === "dark" ? "hover:bg-stone-800 text-stone-500 dark:text-stone-400 hover:text-white" : "hover:bg-stone-100 text-stone-500 hover:text-stone-900"
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-6 overflow-y-auto space-y-6">
                
                {/* 1. Quick Navigation Shortcuts */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-semibold tracking-widest text-primary-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                    Accès Direct aux Onglets (Alt + Touche)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { key: "C", desc: "Consultation Générale" },
                      { key: "U", desc: "Triage & Urgences" },
                      { key: "H", desc: "Hospitalisations" },
                      { key: "E", desc: "Surveillance Pédiatrique" },
                      { key: "M", desc: "Suivi Maternité & CPN" },
                      { key: "V", desc: "Vaccination & PEV" },
                      { key: "L", desc: "Laboratoire d'analyses" },
                      { key: "P", desc: "Pharmacie & Stocks" },
                      { key: "T", desc: "Tâches & Coordination" },
                      { key: "R", desc: "Planification & RDV" },
                      { key: "Y", desc: "Portail RDV en ligne (Mobile)" },
                      { key: "J", desc: "Factures & Comptes" },
                      { key: "A", desc: "Assurances & Tiers-Payant" },
                      { key: "G", desc: "Ressources Humaines" },
                      { key: "I", desc: "Indicateurs Épidémio" },
                      { key: "Q", desc: "Démarche Qualité" },
                      { key: "D", desc: "Coffre-fort Documents" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-2 rounded-xl border ${
                          theme === "dark" ? "bg-stone-950/45 border-stone-800/80" : "bg-stone-50/50 border-stone-100"
                        }`}
                      >
                        <span className="text-stone-600 dark:text-stone-350 font-semibold">{item.desc}</span>
                        <div className="flex items-center gap-1">
                          <kbd className={`px-1.5 py-0.5 rounded-lg text-xs font-mono font-bold border ${
                            theme === "dark" ? "bg-stone-850 border-stone-700 text-stone-300" : "bg-white border-stone-200 text-stone-600"
                          }`}>Alt</kbd>
                          <span className="text-xs text-stone-500 dark:text-stone-400 font-bold">+</span>
                          <kbd className={`px-1.5 py-0.5 rounded-lg text-xs font-mono font-black border ${
                            theme === "dark" ? "bg-stone-800 border-stone-600 text-primary-400" : "bg-stone-100 border-stone-300 text-primary-700"
                          }`}>{item.key}</kbd>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Controls & Actions Shortcuts */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-semibold tracking-widest text-primary-600 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-500"></span>
                    Actions de Navigation & Commandes
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { keys: ["Alt", "[ / ←"], desc: "Onglet précédent" },
                      { keys: ["Alt", "] / →"], desc: "Onglet suivant" },
                      { keys: ["Ctrl / Alt", "F"], desc: "Rechercher un patient (Focus)" },
                      { keys: ["Ctrl / Alt", "P"], desc: "Imprimer la vue active" },
                      { keys: ["Ctrl", "S"], desc: "Synchroniser les données" },
                      { keys: ["Ctrl / Alt", "B"], desc: "Masquer/Afficher le menu de gauche" },
                      { keys: ["Alt", "K"], desc: "Changer de thème (Clair / Sombre)" },
                      { keys: ["Alt", "F / F11"], desc: "Mode Plein Écran (Activer/Quitter)" },
                      { keys: ["Ctrl", "/"], desc: "Afficher cette boîte d'aide" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-2 rounded-xl border ${
                          theme === "dark" ? "bg-stone-950/45 border-stone-800/80" : "bg-stone-50/50 border-stone-100"
                        }`}
                      >
                        <span className="text-stone-600 dark:text-stone-350 font-semibold">{item.desc}</span>
                        <div className="flex items-center gap-1">
                          {item.keys.map((k, idx) => (
                            <React.Fragment key={idx}>
                              {idx > 0 && <span className="text-xs text-stone-500 dark:text-stone-400 font-bold">+</span>}
                              <kbd className={`px-1.5 py-0.5 rounded-lg text-xs font-mono font-black border ${
                                theme === "dark" ? "bg-stone-800 border-stone-600 text-stone-300" : "bg-white border-stone-300 text-stone-700"
                              }`}>{k}</kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className={`p-4 border-t text-center text-xs text-stone-500 font-semibold ${
                theme === "dark" ? "border-stone-800 bg-stone-950/20" : "border-stone-100 bg-stone-50"
              }`}>
                Appuyez sur <kbd className="px-1 bg-stone-200 dark:bg-stone-800 rounded-lg">Échap</kbd> ou cliquez à l'extérieur pour fermer cette fenêtre.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Secure Workstation Logout PIN Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowLogoutConfirm(false);
                setLogoutPinInput("");
                setLogoutError("");
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className={`relative w-full max-w-sm rounded-2xl shadow-2xl border p-6 space-y-4 ${
                theme === "dark" ? "bg-stone-900 border-stone-800 text-stone-100" : "bg-white border-stone-200 text-stone-900"
              }`}
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 bg-danger-50 dark:bg-danger-950/30 text-danger-600 dark:text-danger-400 rounded-full flex items-center justify-center border border-danger-100 dark:border-danger-900/30">
                  <Lock className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-serif font-bold text-base">Fermeture de Poste</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Saisissez votre code d'accès pour valider la fermeture de votre session.
                </p>
              </div>

              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="Code d'accès"
                  maxLength={10}
                  value={logoutPinInput}
                  onChange={(e) => {
                    setLogoutError("");
                    setLogoutPinInput(e.target.value);
                  }}
                  className="w-full text-center text-xl font-mono tracking-widest font-semibold border border-stone-200 dark:border-stone-800 rounded-lg py-2 bg-stone-50 dark:bg-stone-950 focus:outline-none focus:ring-2 focus:ring-danger-500 text-stone-900 dark:text-white"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmLogout();
                    }
                  }}
                />

                {logoutError && (
                  <p className="text-xs text-danger-600 font-bold text-center flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{logoutError}</span>
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowLogoutConfirm(false);
                      setLogoutPinInput("");
                      setLogoutError("");
                    }}
                    className="flex-1 py-2 rounded-lg text-xs font-bold border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-all cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmLogout}
                    className="flex-1 py-2 bg-danger-600 hover:bg-danger-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all cursor-pointer"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </SelfHealingErrorBoundary>
  );
}
