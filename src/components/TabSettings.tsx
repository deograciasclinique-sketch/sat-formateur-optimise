import React, { useState, useEffect } from "react";
import { 
  Sliders, Check, RotateCcw, AlertTriangle, ShieldCheck, HelpCircle, Save, 
  Database, Trash2, Download, RefreshCw, HardDrive, Cpu, Sparkles, Zap, 
  FileDown, Lock, Unlock, Eye, EyeOff, Cloud, CloudOff, Upload, FileCheck, 
  AlertCircle, FolderOpen, Server, CheckCircle2, History,
  Building, Globe, Coins, FileText, Award, Shield, Users, Smartphone, MapPin, Phone, Mail, FileSignature,
  Bell, Send
} from "lucide-react";
import { Medicament, ClinicProfile } from "../types";
import { jsPDF } from "jspdf";

import { AIHealingDiagnosticsPanel } from "./SelfHealingEngine";
import { encryptData, decryptData } from "../lib/cryptoBackup";
import { db } from "../lib/firebase";
import { subscribeToCloudKey, pushToCloudKey } from "../lib/liveSync";
import {
  isNotificationSupported,
  getNotificationPermission,
  isNotificationsEnabled,
  setNotificationsEnabledState,
  requestNotificationPermission,
  sendBrowserNotification
} from "../lib/browserNotifications";

interface TabSettingsProps {
  medTypeThresholds: Record<string, number>;
  medCategoryThresholds: Record<string, number>;
  onUpdateTypeThresholds: (thresholds: Record<string, number>) => void;
  onUpdateCategoryThresholds: (thresholds: Record<string, number>) => void;
  thresholdApplyMode: "override" | "fallback";
  onUpdateApplyMode: (mode: "override" | "fallback") => void;
  stock: Medicament[];
  theme?: "light" | "dark";
}

export default function TabSettings({
  medTypeThresholds,
  medCategoryThresholds,
  onUpdateTypeThresholds,
  onUpdateCategoryThresholds,
  thresholdApplyMode,
  onUpdateApplyMode,
  stock,
  theme = "light"
}: TabSettingsProps) {
  // Local state copy for form inputs
  const [localTypeThresholds, setLocalTypeThresholds] = useState<Record<string, number>>({ ...medTypeThresholds });
  const [localCategoryThresholds, setLocalCategoryThresholds] = useState<Record<string, number>>({ ...medCategoryThresholds });
  const [localApplyMode, setLocalApplyMode] = useState<"override" | "fallback">(thresholdApplyMode);
  const [isSaved, setIsSaved] = useState(false);

  // Browser notifications config state
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const [notifEnabled, setNotifEnabled] = useState(false);

  useEffect(() => {
    setNotifSupported(isNotificationSupported());
    setNotifPermission(getNotificationPermission());
    setNotifEnabled(isNotificationsEnabled());
  }, []);

  const handleToggleNotifications = async () => {
    if (!isNotificationSupported()) {
      alert("Votre navigateur ne prend pas en charge les notifications de bureau.");
      return;
    }

    if (getNotificationPermission() === "default") {
      const result = await requestNotificationPermission();
      setNotifPermission(result);
      setNotifEnabled(result === "granted");
    } else if (getNotificationPermission() === "denied") {
      alert("Les notifications de bureau ont été bloquées par votre navigateur. Veuillez modifier les autorisations dans les paramètres de votre navigateur.");
    } else {
      // Toggle value
      const nextValue = !notifEnabled;
      setNotificationsEnabledState(nextValue);
      setNotifEnabled(nextValue);
    }
  };

  const handleTestNotification = () => {
    if (notifEnabled) {
      sendBrowserNotification(
        "Alerte de Test Réussie ! 🔔",
        "Les notifications de la Clinique Deogracias sont bien configurées et actives en arrière-plan !"
      );
    } else {
      alert("Veuillez d'abord activer les alertes de bureau.");
    }
  };

  // App Optimize States
  const [optimizeReport, setOptimizeReport] = useState<string | null>(null);
  const [isLoadingOptimize, setIsLoadingOptimize] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);

  const getClinicStats = () => {
    const safeParse = (key: string) => {
      try {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : [];
      } catch {
        return [];
      }
    };

    const consultationsList = safeParse("dg_consultations");
    const stockList = safeParse("dg_pharma_stock");
    const facturesList = safeParse("dg_factures");
    const depensesList = safeParse("dg_depenses");
    const staffList = safeParse("dg_staff");
    const tasksList = safeParse("dg_tasks");
    const urgencesList = safeParse("dg_urgences");
    const hospitalisationsList = safeParse("dg_hospitalisations");

    const totalConsultations = consultationsList.length;
    const totalMedicaments = stockList.length;
    const lowStockCount = stockList.filter((m: any) => {
      const effectiveTh = m.seuil || 10;
      return m.stock <= effectiveTh;
    }).length;

    const totalFactures = facturesList.length;
    const totalRevenues = facturesList
      .filter((f: any) => f.statut === "Payée")
      .reduce((sum: number, f: any) => sum + (parseInt(f.montantTotal || f.montant || 0) || 0), 0);

    const totalDepenses = depensesList.reduce((sum: number, d: any) => sum + (parseInt(d.montant || 0) || 0), 0);
    const totalStaff = staffList.length || 5;
    const totalTasks = tasksList.filter((t: any) => t.statut !== "Terminée").length;
    const totalUrgences = urgencesList.filter((u: any) => u.statut !== "Sorti(e) ou Libéré(e)").length;
    const totalHospitalisations = hospitalisationsList.filter((h: any) => h.statut === "En cours" || h.statut === "actif").length;

    return {
      totalConsultations,
      totalMedicaments,
      lowStockCount,
      totalFactures,
      totalRevenues,
      totalDepenses,
      totalStaff,
      totalTasks,
      totalUrgences,
      totalHospitalisations
    };
  };

  const handleRunAppOptimize = async () => {
    setIsLoadingOptimize(true);
    setOptimizeError(null);
    setOptimizeReport(null);

    try {
      const clinicStats = getClinicStats();
      const response = await fetch("/api/app-optimize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clinicStats })
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Impossible de se connecter au serveur d'optimisation.");
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erreur serveur : Vérifiez que la clé API Gemini est bien configurée dans AI Studio.");
      }

      setOptimizeReport(data.report);
    } catch (err: any) {
      console.error(err);
      setOptimizeError(err.message || "Échec de l'optimisation. Veuillez vous assurer d'avoir configuré votre clé API Gemini.");
    } finally {
      setIsLoadingOptimize(false);
    }
  };

  // States for Encryption and Backup/Restore
  const [backupTab, setBackupTab] = useState<"file" | "cloud">("file");
  
  // File Backup / Decryption password inputs
  const [passExport, setPassExport] = useState("");
  const [showPassExport, setShowPassExport] = useState(false);
  const [passImport, setPassImport] = useState("");
  const [showPassImport, setShowPassImport] = useState(false);
  
  // Cloud Backup Inputs
  const [passCloud, setPassCloud] = useState("");
  const [showPassCloud, setShowPassCloud] = useState(false);
  const [cloudBackupNote, setCloudBackupNote] = useState("");
  
  // Statuses
  const [isEncryptingLocal, setIsEncryptingLocal] = useState(false);
  const [isDecryptingLocal, setIsDecryptingLocal] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  
  // File import target
  const [importedFileContent, setImportedFileContent] = useState<string | null>(null);
  const [importedFileName, setImportedFileName] = useState<string>("");
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [pendingTransferConfig, setPendingTransferConfig] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Success & Error feedback
  const [backupFeedback, setBackupFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Cloud Backups List
  const [cloudBackups, setCloudBackups] = useState<any[]>([]);

  // Local Helper to fetch from localStorage securely
  function localSafeGet<T>(key: string, fallback: T): T {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  }

  // Clinic Profile State
  const [profile, setProfile] = useState<ClinicProfile>(() => {
    return localSafeGet<ClinicProfile>("dg_clinic_profile", {
      name: "Cabinet Médical DEO-GRACIAS",
      slogan: "Excellence & Dévouement au Service de votre Santé",
      address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital",
      phone: "+226 20 97 12 34",
      email: "deograciasclinique@gmail.com",
      nif: "30009845X",
      rccm: "BF-BOB-2026-B-1402",
      currency: "FCFA",
      logoColor: "teal",
      stampText: "CACHET & SIGNATURE DEO-GRACIAS"
    });
  });

  const [isProfileSaved, setIsProfileSaved] = useState(false);

  // Synchronisation temps réel du profil (nom, logo, coordonnées...) entre appareils
  useEffect(() => {
    if (!db) return;
    const unsubscribe = subscribeToCloudKey("dg_clinic_profile", (remoteProfile) => {
      if (!remoteProfile || typeof remoteProfile !== "object") return;
      const localJson = JSON.stringify(profile);
      const remoteJson = JSON.stringify(remoteProfile);
      if (localJson === remoteJson) return;
      localStorage.setItem("dg_clinic_profile", JSON.stringify(remoteProfile));
      setProfile(remoteProfile as ClinicProfile);
      window.dispatchEvent(new Event("dg_profile_updated"));
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = (updatedProfile: ClinicProfile) => {
    localStorage.setItem("dg_clinic_profile", JSON.stringify(updatedProfile));
    setProfile(updatedProfile);
    setIsProfileSaved(true);
    setTimeout(() => setIsProfileSaved(false), 3000);
    // Raise a custom event to notify all components about the profile update instantly
    window.dispatchEvent(new Event("dg_profile_updated"));
    // Envoie aussi vers le cloud pour que les autres appareils reçoivent la mise à jour
    // (logo, nom de l'établissement, coordonnées...) en temps réel.
    pushToCloudKey("dg_clinic_profile", updatedProfile).catch(() => {
      // Échec silencieux (ex: hors-ligne) — la sauvegarde locale reste intacte.
    });
  };

  const loadPresetProfile = (preset: "deogracias" | "espoir" | "rapha" | "paix") => {
    const presets: Record<string, ClinicProfile> = {
      deogracias: {
        name: "Cabinet Médical DEO-GRACIAS",
        slogan: "Excellence & Dévouement au Service de votre Santé",
        address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital",
        phone: "+226 20 97 12 34",
        email: "deograciasclinique@gmail.com",
        nif: "30009845X",
        rccm: "BF-BOB-2026-B-1402",
        currency: "FCFA",
        logoColor: "teal",
        stampText: "CACHET & SIGNATURE DEO-GRACIAS",
        legalForm: "Cabinet Médical Privé (S.A.R.L.)",
        ownerName: "Dr. Deogracias",
        capital: "5 000 000 FCFA",
        taxRegime: "Régime Réel Simplifié",
        operatingStatus: "Actif",
        bylawsText: `STATUTS CONSTITUTIFS DE L'ÉTABLISSEMENT MÉDICAL

ARTICLE 1 : FORME JURIDIQUE & DENOMINATION
L'établissement est constitué sous la forme d'une Société à Responsabilité Limitée (S.A.R.L.) dénommée "Cabinet Médical DEO-GRACIAS".

ARTICLE 2 : OBJET SOCIAL
L'établissement a pour objet l'exploitation d'un cabinet médical pluridisciplinaire, de soins d'urgence, de surveillance pédiatrique, de suivi maternité/CPN, d'un laboratoire d'analyses médicales et d'un dépôt de pharmacie.

ARTICLE 3 : SIÈGE SOCIAL
Le siège social est fixé à : Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital, Burkina Faso.

ARTICLE 4 : CAPITAL SOCIAL
Le capital social est fixé à la somme de Cinq Millions (5 000 000) de Francs CFA, divisé en parts sociales détenues par l'associé unique gérant.

ARTICLE 5 : GERANCE & DIRECTION
La gérance et la direction médicale générale de l'établissement sont assurées par le Dr. Deogracias en sa qualité d'associé gérant fondateur.`
      },
      espoir: {
        name: "Clinique Internationale de l'Espoir",
        slogan: "Votre santé, notre commitment au quotidien",
        address: "Cocody Ambassades, Boulevard de la République, Abidjan",
        phone: "+225 27 22 40 10 10",
        email: "contact@clinique-espoir.ci",
        nif: "CI-ABJ-009843-H",
        rccm: "RCCM CI-ABJ-2026-B-893",
        currency: "FCFA",
        logoColor: "indigo",
        stampText: "CACHET DIRECTION MEDICALE DE L'ESPOIR",
        legalForm: "Polyclinique Privée (S.A.)",
        ownerName: "Mme. Marie-Claire Kouamé",
        capital: "50 000 000 FCFA",
        taxRegime: "Régime Réel Normal",
        operatingStatus: "Actif",
        bylawsText: `STATUTS CONSTITUTIFS DE LA CLINIQUE DE L'ESPOIR

ARTICLE 1 : FORME JURIDIQUE & DENOMINATION
Il est constitué une Société Anonyme (S.A.) dénommée "Clinique Internationale de l'Espoir".

ARTICLE 2 : OBJET SOCIAL
La société a pour objet toutes activités d'hospitalisation, de chirurgie, d'obstétrique, de soins pédiatriques et généraux.

ARTICLE 3 : SIÈGE SOCIAL
Le siège social est à : Cocody Ambassades, Boulevard de la République, Abidjan, Côte d'Ivoire.

ARTICLE 4 : CAPITAL SOCIAL
Le capital est fixé à Cinquante Millions (50 000 000) de Francs CFA.`
      },
      rapha: {
        name: "Polyclinique El-Rapha & Maternité",
        slogan: "L'art de guérir, la passion de soigner",
        address: "Quartier Glass, Avenue de la Paix, Libreville",
        phone: "+241 11 72 30 30",
        email: "administration@elrapha-gabon.com",
        nif: "RG-LBV-88204-M",
        rccm: "RCCM GA-LBV-2026-B-501",
        currency: "FCFA",
        logoColor: "rose",
        stampText: "CACHET RECEPTION & FACTURATION EL-RAPHA",
        legalForm: "Société Civile Professionnelle Médicale (S.C.P.)",
        ownerName: "Dr. Jean-Paul Mba",
        capital: "15 000 000 FCFA",
        taxRegime: "Régime Global d'Imposition",
        operatingStatus: "Actif",
        bylawsText: `STATUTS DE LA POLYCLINIQUE EL-RAPHA

ARTICLE 1 : CONSTITUTION & DENOMINATION
Les soussignés constituent une Société Civile Professionnelle dénommée "Polyclinique El-Rapha & Maternité".

ARTICLE 2 : OBJET
La société a pour objet l'exercice en commun de la profession de médecin et d'obstétrique.

ARTICLE 3 : SIÈGE
Le siège est établi à : Quartier Glass, Avenue de la Paix, Libreville, Gabon.`
      },
      paix: {
        name: "Centre Médical de la Paix",
        slogan: "Des soins de qualité accessibles à tous",
        address: "Coyah, Route de Kindia, Conakry",
        phone: "+224 622 14 15 16",
        email: "paix.sante@gmail.com",
        nif: "GN-CKY-33091-T",
        rccm: "RCCM GN-CKY-2026-B-042",
        currency: "GNF",
        logoColor: "emerald",
        stampText: "CACHET MEDECIN CHEF CLINIQUE DE LA PAIX",
        legalForm: "Groupement d'Intérêt Économique (G.I.E.)",
        ownerName: "Dr. Amadou Diallo",
        capital: "100 000 000 GNF",
        taxRegime: "Régime Simplifié de l'Impôt sur les Sociétés",
        operatingStatus: "Actif",
        bylawsText: `STATUTS DU CENTRE MEDICAL DE LA PAIX

ARTICLE 1 : NATURE & DENOMINATION
Il est constitué un Groupement d'Intérêt Économique dénommé "Centre Médical de la Paix".

ARTICLE 2 : OBJET
Le groupement a pour objet d'améliorer et de développer l'activité médicale de ses membres par la mise en commun de moyens techniques et humains.

ARTICLE 3 : SIÈGE
Le siège est à Coyah, Route de Kindia, Conakry, Guinée.`
      }
    };

    if (presets[preset]) {
      handleSaveProfile(presets[preset]);
    }
  };

  // Licensing Simulator state
  const [prospectClinic, setProspectClinic] = useState("Clinique Médicale Saint-Luc");
  const [prospectCountry, setProspectCountry] = useState("Sénégal");
  const [doctorCount, setDoctorCount] = useState(8);
  const [patientVolume, setPatientVolume] = useState(500);
  const [durationMonths, setDurationMonths] = useState(12); // 1, 6, 12, 24
  const [selectedModules, setSelectedModules] = useState<string[]>([
    "teleconsultation", "cloud_sync", "gemini_api"
  ]);

  const handleToggleModule = (modId: string) => {
    if (selectedModules.includes(modId)) {
      setSelectedModules(selectedModules.filter(m => m !== modId));
    } else {
      setSelectedModules([...selectedModules, modId]);
    }
  };

  const getSaaSSimulationPrice = () => {
    const baseMonthly = 25000;
    const docCost = doctorCount * 5000;
    let modulesCost = 0;
    if (selectedModules.includes("teleconsultation")) modulesCost += 10000;
    if (selectedModules.includes("cloud_sync")) modulesCost += 15000;
    if (selectedModules.includes("gemini_api")) modulesCost += 20000;
    if (selectedModules.includes("offline_roaming")) modulesCost += 12000;

    const subtotalMonthly = baseMonthly + docCost + modulesCost;
    let discountRate = 0;
    if (durationMonths === 6) discountRate = 0.05;
    else if (durationMonths === 12) discountRate = 0.15;
    else if (durationMonths === 24) discountRate = 0.25;

    const discountAmount = subtotalMonthly * discountRate;
    const netMonthly = subtotalMonthly - discountAmount;
    const totalContractValue = netMonthly * durationMonths;
    const setupFee = 150000;

    return {
      subtotalMonthly,
      discountRate,
      discountAmount,
      netMonthly,
      totalContractValue,
      setupFee
    };
  };

  const generateSaaSProposalPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const prices = getSaaSSimulationPrice();
      const baseMonthly = 25000;
      const docCost = doctorCount * 5000;

      // Cover Page
      doc.setFillColor(15, 23, 42); // Deep slate background
      doc.rect(0, 0, 210, 297, "F");

      // Draw elegant decorative frames
      doc.setDrawColor(20, 184, 166); // Teal accent
      doc.setLineWidth(1);
      doc.rect(10, 10, 190, 277);

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(24);
      doc.text("PROPOSITION COMMERCIALE", 105, 70, { align: "center" });

      doc.setFontSize(16);
      doc.setFont("Helvetica", "normal");
      doc.text("Système de Santé Intégré DEO-GRACIAS 2.2", 105, 82, { align: "center" });
      
      doc.setFontSize(11);
      doc.setTextColor(20, 184, 166);
      doc.text("SOLUTION SAAS CLOUD & OFFLINE-FIRST POUR CENTRES DE SANTE", 105, 92, { align: "center" });

      // Divider line
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.5);
      doc.line(40, 105, 170, 105);

      // Prospect Details
      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(12);
      doc.text(`Destinataire : ${prospectClinic}`, 105, 130, { align: "center" });
      doc.text(`Pays / Région : ${prospectCountry}`, 105, 138, { align: "center" });
      doc.text(`Date de validité : ${new Date().toLocaleDateString("fr-FR")}`, 105, 146, { align: "center" });
      doc.text(`Éditeur : DEO-GRACIAS Technologies S.A.`, 105, 154, { align: "center" });

      // Core Features on Cover
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(30, 180, 150, 60, 5, 5, "F");
      
      doc.setTextColor(20, 184, 166);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("COMPOSANTES CLÉS RETENUES POUR L'OFFRE :", 35, 192);

      doc.setTextColor(255, 255, 255);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`• Capacité d'équipe : Jusqu'à ${doctorCount} praticiens actifs en simultané.`, 38, 202);
      doc.text(`• Base de données : Conçue pour un volume de ${patientVolume} dossiers cliniques/mois.`, 38, 210);
      doc.text(`• Modules activés : Core Suite + ${selectedModules.length} extensions intelligentes.`, 38, 218);
      doc.text(`• Engagement : Contrat d'abonnement de ${durationMonths} mois (Remise de ${prices.discountRate * 100}%).`, 38, 226);

      // Footer Cover Page
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Propriété Intellectuelle DEO-GRACIAS • Usage Strictement Professionnel", 105, 275, { align: "center" });

      // Page 2: Table of pricing and service commitments
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 297, "F");

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.rect(10, 10, 190, 277);

      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.text("1. DÉTAIL FINANCIER & CONFIGURATION", 15, 25);

      // Simple Table layout
      doc.setFontSize(10);
      doc.setFont("Helvetica", "bold");
      doc.setFillColor(241, 245, 249);
      doc.rect(15, 32, 180, 8, "F");
      doc.setTextColor(15, 23, 42);
      doc.text("Désignation du Service / Module", 18, 37);
      doc.text("Tarification Unitaire", 110, 37);
      doc.text("Total Mensuel", 155, 37);

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9.5);
      let rowY = 46;

      // Row 1
      doc.text("Abonnement Core Suite (Dossier Patient, Labo, Pharmacie, Facture, RH)", 18, rowY);
      doc.text("Fixe de base", 110, rowY);
      doc.text(`${baseMonthly.toLocaleString()} FCFA`, 155, rowY);
      rowY += 8;

      // Row 2
      doc.text(`Licences Praticiens Médicaux (x${doctorCount} comptes)`, 18, rowY);
      doc.text("5 000 FCFA / médecin", 110, rowY);
      doc.text(`${docCost.toLocaleString()} FCFA`, 155, rowY);
      rowY += 8;

      // Row 3: Extensions
      selectedModules.forEach((m) => {
        let name = "";
        let price = 0;
        if (m === "teleconsultation") { name = "Extension RDV en ligne & Portail Mobile"; price = 10000; }
        if (m === "cloud_sync") { name = "Extension Double-Sauvegarde Cloud Firebase"; price = 15000; }
        if (m === "gemini_api") { name = "Extension Intelligence Artificielle Clinique Gemini"; price = 20000; }
        if (m === "offline_roaming") { name = "Extension Synchronisation Réseau local P2P"; price = 12000; }

        doc.text(name, 18, rowY);
        doc.text("Forfaitaire", 110, rowY);
        doc.text(`${price.toLocaleString()} FCFA`, 155, rowY);
        rowY += 8;
      });

      // Horizontal separator line
      doc.line(15, rowY - 2, 195, rowY - 2);

      // Subtotals
      doc.setFont("Helvetica", "bold");
      doc.text("Sous-total Mensuel Brut :", 110, rowY);
      doc.text(`${prices.subtotalMonthly.toLocaleString()} FCFA`, 155, rowY);
      rowY += 8;

      if (prices.discountRate > 0) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Remise Engagement (${durationMonths} mois, -${prices.discountRate*100}%) :`, 110, rowY);
        doc.text(`-${prices.discountAmount.toLocaleString()} FCFA`, 155, rowY);
        rowY += 8;
        doc.setTextColor(15, 23, 42);
      }

      doc.setFillColor(236, 253, 245);
      doc.rect(108, rowY - 4, 87, 8, "F");
      doc.setTextColor(5, 150, 105);
      doc.text("TARIF MENSUEL NET :", 110, rowY + 1);
      doc.text(`${prices.netMonthly.toLocaleString()} FCFA / mois`, 155, rowY + 1);
      rowY += 10;

      doc.setTextColor(15, 23, 42);
      doc.setFont("Helvetica", "normal");
      doc.text(`Frais d'installation, paramétrage initial & formation sur site (Unique) :`, 18, rowY);
      doc.setFont("Helvetica", "bold");
      doc.text(`${prices.setupFee.toLocaleString()} FCFA`, 155, rowY);
      rowY += 14;

      // 2. Service Level Agreement and terms
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("2. ENGAGEMENT DE SERVICE & SÉCURITÉ DES DONNÉES", 15, rowY);
      rowY += 6;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text("• Disponibilité Garantie (SLA) : Garantie de disponibilité du système à 99.9% avec redondance hors ligne.", 15, rowY); rowY += 5;
      doc.text("• Propriété Intellectuelle & Données : La clinique conserve la propriété exclusive de tous ses dossiers patients.", 15, rowY); rowY += 5;
      doc.text("• Cryptage de bout en bout : Sauvegardes chiffrées en AES-256 avec clé de sécurité privée.", 15, rowY); rowY += 5;
      doc.text("• Mises à jour : Intégration transparente de toutes les évolutions réglementaires et épidémiologiques du PEV/OMS.", 15, rowY); rowY += 14;

      // Signatures blocks
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("3. ACCEPTATION DU CONTRAT ET SIGNATURES", 15, rowY);
      rowY += 8;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Pour l'Éditeur : DEO-GRACIAS Tech", 25, rowY);
      doc.text(`Pour le Client : ${prospectClinic}`, 115, rowY);
      rowY += 4;

      doc.setFont("Helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(120, 113, 108);
      doc.text("Mention manuscrite 'Lu et approuvé'", 25, rowY);
      doc.text("Mention manuscrite 'Lu et approuvé'", 115, rowY);
      rowY += 24;

      // stamp visual placeholder
      doc.setDrawColor(20, 184, 166);
      doc.setLineWidth(0.4);
      doc.rect(25, rowY - 18, 55, 12);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(20, 184, 166);
      doc.text("DEO-GRACIAS TECH S.A.", 30, rowY - 13);
      doc.text("SERVICE COMMERCIAL VALIDÉ", 26, rowY - 9);

      // Lines for signature
      doc.setDrawColor(148, 163, 184);
      doc.line(25, rowY, 80, rowY);
      doc.line(115, rowY, 170, rowY);

      doc.save(`offre_commerciale_saas_${prospectClinic.replace(/\s+/g, "_").toLowerCase()}.pdf`);
      alert(`Félicitations ! L'offre commerciale au format PDF pour "${prospectClinic}" a été générée et téléchargée avec succès. Utilisez ce document professionnel pour prospecter d'autres cliniques !`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("Erreur lors de la génération du contrat PDF. Veuillez vérifier la console.");
    }
  };


  // Load Cloud backups from Firebase
  const loadCloudBackups = async () => {
    if (!db) return;
    setIsLoadingCloud(true);
    try {
      const snapshot = await db.collection("dg_backups").orderBy("date", "desc").get();
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCloudBackups(list);
    } catch (err) {
      console.error("Erreur lors de la récupération des sauvegardes Cloud:", err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    if (db) {
      loadCloudBackups();
    }
  }, []);

  // Helper to get total database size & contents
  const getFullDatabaseJSON = (): string => {
    const backup: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("dg_")) {
        try {
          backup[key] = JSON.parse(localStorage.getItem(key) || "");
        } catch {
          backup[key] = localStorage.getItem(key);
        }
      }
    }
    return JSON.stringify(backup);
  };

  // 1. Export locally as encrypted file
  const handleLocalEncryptAndDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passExport || passExport.length < 4) {
      setBackupFeedback({ type: "error", message: "Le mot de passe de chiffrement doit comporter au moins 4 caractères." });
      return;
    }

    setIsEncryptingLocal(true);
    setBackupFeedback(null);

    try {
      const plaintext = getFullDatabaseJSON();
      const encrypted = await encryptData(plaintext, passExport);

      const blob = new Blob([encrypted], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", url);
      const dateStr = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("download", `sauvegarde_chiffree_deogracias_${dateStr}.enc`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      setBackupFeedback({
        type: "success",
        message: "Base de données exportée et chiffrée localement avec succès ! Gardez précieusement votre mot de passe pour pouvoir la restaurer."
      });
      setPassExport("");
    } catch (err) {
      setBackupFeedback({ type: "error", message: "Erreur lors du chiffrement des données : " + String(err) });
    } finally {
      setIsEncryptingLocal(false);
    }
  };

  // Drag & drop file handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const readBackupFile = (file: File) => {
    setImportedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImportedFileContent(e.target.result as string);
        setBackupFeedback(null);
      }
    };
    reader.onerror = () => {
      setBackupFeedback({ type: "error", message: "Erreur lors de la lecture du fichier." });
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      readBackupFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      readBackupFile(e.target.files[0]);
    }
  };

  // 2. Decrypt and restore from uploaded file
  const handleLocalDecryptAndRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importedFileContent) {
      setBackupFeedback({ type: "error", message: "Veuillez d'abord sélectionner ou glisser-déposer un fichier de sauvegarde (.enc)." });
      return;
    }
    if (!passImport) {
      setBackupFeedback({ type: "error", message: "Veuillez entrer le mot de passe associé à cette sauvegarde." });
      return;
    }

    if (!confirm("⚠️ Attention : La restauration va écraser TOUTES vos données cliniques actuelles par celles de la sauvegarde. Souhaitez-vous continuer ?")) {
      return;
    }

    setIsDecryptingLocal(true);
    setBackupFeedback(null);

    try {
      const decryptedJSON = await decryptData(importedFileContent, passImport);
      const data = JSON.parse(decryptedJSON);

      // Validate parsed data contains some keys
      const keys = Object.keys(data);
      if (keys.length === 0 || !keys.some(k => k.startsWith("dg_"))) {
        throw new Error("Le fichier déchiffré ne semble pas être une sauvegarde valide du cabinet Deo Gracias.");
      }

      // Purge and write
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("dg_")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      Object.entries(data).forEach(([key, val]) => {
        if (typeof val === "object" && val !== null) {
          localStorage.setItem(key, JSON.stringify(val));
        } else {
          localStorage.setItem(key, String(val));
        }
      });

      setBackupFeedback({
        type: "success",
        message: "Base de données restaurée avec succès ! Rechargement en cours..."
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      setBackupFeedback({ type: "error", message: String(err) });
    } finally {
      setIsDecryptingLocal(false);
    }
  };

  // 3. Save encrypted backup to Firebase Cloud
  const handleCloudBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) {
      setBackupFeedback({ type: "error", message: "Le service Firebase n'est pas connecté ou hors-ligne." });
      return;
    }
    if (!passCloud || passCloud.length < 4) {
      setBackupFeedback({ type: "error", message: "Le mot de passe de chiffrement Cloud doit comporter au moins 4 caractères." });
      return;
    }

    setIsSavingCloud(true);
    setBackupFeedback(null);

    try {
      const plaintext = getFullDatabaseJSON();
      const encrypted = await encryptData(plaintext, passCloud);
      const sizeKB = Math.round((encrypted.length * 2) / 1024 * 10) / 10;

      const dateStr = new Date().toISOString();
      await db.collection("dg_backups").add({
        note: cloudBackupNote || "Sauvegarde manuelle standard",
        date: dateStr,
        sizeKB: sizeKB,
        encryptedData: encrypted,
        version: "1.0"
      });

      setBackupFeedback({
        type: "success",
        message: "Sauvegarde chiffrée de bout en bout enregistrée avec succès dans le Cloud Firebase !"
      });

      setCloudBackupNote("");
      setPassCloud("");
      loadCloudBackups();
    } catch (err) {
      setBackupFeedback({ type: "error", message: "Erreur de connexion Firebase Cloud : " + String(err) });
    } finally {
      setIsSavingCloud(false);
    }
  };

  // 4. Restore from selected Firebase Cloud backup
  const handleCloudRestore = async (backupItem: any) => {
    const pwd = prompt("Entrez le mot de passe de chiffrement pour déverrouiller et restaurer cette sauvegarde Cloud :");
    if (pwd === null) return; // User cancelled
    if (!pwd) {
      alert("Le mot de passe est obligatoire pour le déchiffrement.");
      return;
    }

    if (!confirm("⚠️ Attention : La restauration de cette sauvegarde Cloud va écraser TOUTES vos données actuelles. Souhaitez-vous continuer ?")) {
      return;
    }

    setIsDecryptingLocal(true);
    setBackupFeedback(null);

    try {
      const decryptedJSON = await decryptData(backupItem.encryptedData, pwd);
      const data = JSON.parse(decryptedJSON);

      // Purge and write
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("dg_")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      Object.entries(data).forEach(([key, val]) => {
        if (typeof val === "object" && val !== null) {
          localStorage.setItem(key, JSON.stringify(val));
        } else {
          localStorage.setItem(key, String(val));
        }
      });

      setBackupFeedback({
        type: "success",
        message: "Base de données restaurée avec succès depuis le Cloud ! Rechargement de l'application..."
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      alert("Erreur de déchiffrement : " + String(err));
    } finally {
      setIsDecryptingLocal(false);
    }
  };

  // 5. Delete cloud backup
  const handleDeleteCloudBackup = async (id: string) => {
    if (!db) return;
    if (!confirm("Êtes-vous sûr de vouloir supprimer définitivement cette sauvegarde chiffrée du Cloud Firebase ?")) {
      return;
    }
    try {
      await db.collection("dg_backups").doc(id).delete();
      loadCloudBackups();
    } catch (err) {
      alert("Échec de la suppression : " + String(err));
    }
  };

  // States and Helpers for Storage Optimization & Analysis
  const [optimizeStatus, setOptimizeStatus] = useState<string>("");
  const [isOptimizing, setIsOptimizing] = useState(false);

  const getLocalStorageUsage = () => {
    let total = 0;
    const items: { key: string; sizeKB: number; label: string }[] = [];
    
    const keysToLabel: Record<string, string> = {
      "dg_staff": "Personnel & Équipe",
      "dg_pharma_stock": "Pharmacie (Stock de Médicaments)",
      "dg_pharma_mouvements": "Mouvements de stock",
      "dg_tasks": "Tâches & Activités",
      "dg_consultations": "Consultations médicales",
      "dg_pediatrie": "Surveillance Pédiatrique",
      "dg_maternite_cpn": "Maternité (CPN)",
      "dg_maternite_accouchements": "Maternité (Accouchements)",
      "dg_rdv": "Rendez-vous",
      "dg_hospitalisations": "Hospitalisations",
      "dg_hosp_evolutions": "Évolutions de garde",
      "dg_factures": "Factures clients",
      "dg_depenses": "Dépenses cliniques",
      "dg_incidents": "Registre des incidents",
      "dg_actions": "Actions correctives",
      "dg_audits": "Audits de qualité",
      "dg_conges": "Congés du personnel",
      "dg_absences": "Registre d'absences",
      "dg_rh": "Fiches RH de l'équipe",
      "dg_prises_charge": "Prises en charge",
      "dg_urgences": "Urgences & Triage",
      "dg_vaccinations": "Vaccinations (PEV)",
      "dg_labo_examens": "Examens de laboratoire",
      "dg_documents": "Documents archivés"
    };

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("dg_")) {
          const val = localStorage.getItem(key) || "";
          const sizeKB = Math.round((val.length * 2) / 1024 * 10) / 10; // UTF-16 characters take 2 bytes
          total += sizeKB;
          items.push({
            key,
            sizeKB,
            label: keysToLabel[key] || key.replace("dg_", "")
          });
        }
      }
    } catch (e) {
      console.warn("Could not read localStorage size:", e);
    }

    return {
      total: Math.round(total * 10) / 10,
      items: items.sort((a, b) => b.sizeKB - a.sizeKB)
    };
  };

  const handleDownloadBackup = () => {
    try {
      const backup: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("dg_")) {
          try {
            backup[key] = JSON.parse(localStorage.getItem(key) || "");
          } catch {
            backup[key] = localStorage.getItem(key);
          }
        }
      }
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      const dateStr = new Date().toISOString().split("T")[0];
      downloadAnchor.setAttribute("download", `sauvegarde_cabinet_deogracias_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert("Erreur lors de la génération de la sauvegarde : " + String(err));
    }
  };

  const handleRunOptimization = () => {
    if (!confirm("Cette opération va analyser les tables locales, nettoyer les données obsolètes ou en double, et optimiser l'indice d'indexation. Souhaitez-vous continuer ? (Il est fortement recommandé d'exporter une sauvegarde JSON avant)")) {
      return;
    }
    setIsOptimizing(true);
    setOptimizeStatus("Analyse des tables locales...");
    
    setTimeout(() => {
      let duplicateRemovedCount = 0;
      let corruptedRemovedCount = 0;
      let trimmedEntriesCount = 0;

      const keysToOptimize = [
        "dg_staff", "dg_pharma_stock", "dg_pharma_mouvements", "dg_tasks",
        "dg_consultations", "dg_pediatrie", "dg_maternite_cpn", "dg_maternite_accouchements",
        "dg_rdv", "dg_hospitalisations", "dg_hosp_evolutions", "dg_factures",
        "dg_depenses", "dg_incidents", "dg_actions", "dg_audits", "dg_conges",
        "dg_absences", "dg_rh", "dg_prises_charge", "dg_urgences", "dg_vaccinations",
        "dg_labo_examens", "dg_documents"
      ];

      keysToOptimize.forEach((key) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const initialLength = parsed.length;
              const seenIds = new Set<string>();
              const cleaned = parsed.filter((item: any) => {
                if (item === null || typeof item !== "object") {
                  corruptedRemovedCount++;
                  return false;
                }
                const id = item.id || item.code || "";
                if (!id) {
                  corruptedRemovedCount++;
                  return false;
                }
                if (seenIds.has(id)) {
                  duplicateRemovedCount++;
                  return false;
                }
                seenIds.add(id);
                return true;
              });

              // Trim logs to keep only recent ones if very large
              let finalCleaned = cleaned;
              if ((key === "dg_pharma_mouvements" || key === "dg_hosp_evolutions") && cleaned.length > 500) {
                finalCleaned = cleaned.slice(-300);
                trimmedEntriesCount += (cleaned.length - 300);
              }

              if (finalCleaned.length !== initialLength) {
                localStorage.setItem(key, JSON.stringify(finalCleaned));
              }
            }
          } catch {
            localStorage.setItem(key, JSON.stringify([]));
            corruptedRemovedCount++;
          }
        }
      });

      setOptimizeStatus("Nettoyage des clés temporaires de cache...");
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToOptimize.includes(key) && !key.startsWith("dg_") && !key.includes("theme")) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      setIsOptimizing(false);
      setOptimizeStatus("");
      alert(`Optimisation complétée avec succès !\n\n- Doublons supprimés : ${duplicateRemovedCount}\n- Entrées corrompues résorbées : ${corruptedRemovedCount}\n- Historiques anciens compactés : ${trimmedEntriesCount}\n\nL'application va se recharger pour rafraîchir l'index.`);
      window.location.reload();
    }, 1500);
  };

  const handleClearRenderCache = () => {
    if (confirm("Voulez-vous réinitialiser le cache de synchronisation de l'application ? Vos données locales ne seront PAS supprimées, seul l'onglet d'accueil et le cache de rendu seront ré-indexés.")) {
      localStorage.removeItem("dg_active_tab");
      window.location.reload();
    }
  };

  // Default values for reset
  const defaultTypes = {
    "Comprimé": 50,
    "Sirop": 15,
    "Injectable": 30,
    "Perfusion": 25,
    "Pommade / Crème": 10,
    "Poudre": 15,
    "Solution buccale": 10
  };

  const defaultCategories = {
    "Antalgique / Antipyrétique": 30,
    "Antibiotique": 40,
    "Antipaludéen": 35,
    "Antihypertenseur": 20,
    "Anti-inflammatoire": 25,
    "Antidiabétique": 20,
    "Vitamines / Minéraux": 15,
    "Solutés / Perfusions": 30,
    "Matériel médical": 50
  };


  const handleExportTransferConfig = () => {
    try {
      const configData = {
        staff: JSON.parse(localStorage.getItem("dg_staff") || "[]"),
        medTypeThresholds: JSON.parse(localStorage.getItem("dg_med_type_thresholds") || "null") || localTypeThresholds,
        medCategoryThresholds: JSON.parse(localStorage.getItem("dg_med_category_thresholds") || "null") || localCategoryThresholds,
        thresholdApplyMode: localStorage.getItem("dg_threshold_apply_mode") || localApplyMode
      };

      const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `config-transfert-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error", err);
      alert("Erreur lors de la génération du fichier de transfert.");
    }
  };

  const handleImportTransferConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setPendingTransferConfig(json);
        setShowTransferConfirm(true);
      } catch (err) {
        alert("Fichier de configuration invalide.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const confirmTransferConfig = () => {
    if (!pendingTransferConfig) return;
    const json = pendingTransferConfig;
    if (json.staff) {
      localStorage.setItem("dg_staff", JSON.stringify(json.staff));
    }
    if (json.medTypeThresholds) {
      localStorage.setItem("dg_med_type_thresholds", JSON.stringify(json.medTypeThresholds));
    }
    if (json.medCategoryThresholds) {
      localStorage.setItem("dg_med_category_thresholds", JSON.stringify(json.medCategoryThresholds));
    }
    if (json.thresholdApplyMode) {
      localStorage.setItem("dg_threshold_apply_mode", json.thresholdApplyMode);
    }
    setShowTransferConfirm(false);
    setPendingTransferConfig(null);
    alert("Configuration transférée avec succès. L'application va se recharger.");
    window.location.reload();
  };

  const cancelTransferConfig = () => {
    setShowTransferConfirm(false);
    setPendingTransferConfig(null);
  };

  const handleSave = () => {
    onUpdateTypeThresholds(localTypeThresholds);
    onUpdateCategoryThresholds(localCategoryThresholds);
    onUpdateApplyMode(localApplyMode);
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleReset = () => {
    if (confirm("Voulez-vous réinitialiser les seuils critiques aux valeurs recommandées par défaut ?")) {
      setLocalTypeThresholds(defaultTypes);
      setLocalCategoryThresholds(defaultCategories);
      setLocalApplyMode("fallback");
      
      onUpdateTypeThresholds(defaultTypes);
      onUpdateCategoryThresholds(defaultCategories);
      onUpdateApplyMode("fallback");
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleTypeChange = (type: string, val: string) => {
    const num = parseInt(val) || 0;
    setLocalTypeThresholds((prev) => ({ ...prev, [type]: num }));
  };

  const handleCategoryChange = (cat: string, val: string) => {
    const num = parseInt(val) || 0;
    setLocalCategoryThresholds((prev) => ({ ...prev, [cat]: num }));
  };

  // Helper to compute effective threshold of a medicine given current values
  const getEffectiveThreshold = (med: Medicament) => {
    if (localApplyMode === "override") {
      // Form/type takes highest precedence, then category
      if (localTypeThresholds[med.forme] !== undefined) {
        return localTypeThresholds[med.forme];
      }
      if (localCategoryThresholds[med.categorie] !== undefined) {
        return localCategoryThresholds[med.categorie];
      }
    } else {
      // Fallback mode: use med's own seuil if greater than zero, otherwise use defaults
      if (med.seuil && med.seuil > 0) {
        return med.seuil;
      }
      if (localTypeThresholds[med.forme] !== undefined) {
        return localTypeThresholds[med.forme];
      }
      if (localCategoryThresholds[med.categorie] !== undefined) {
        return localCategoryThresholds[med.categorie];
      }
    }
    return med.seuil || 10;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 p-6 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-500/10 text-primary-600 rounded-xl">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">Paramètres des Seuils de Stock</h2>
            <p className="text-xs text-stone-500 font-semibold mt-0.5">Personnalisez les alertes critiques de la pharmacie du cabinet</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4 text-success-300" /> : <Save className="w-4 h-4" />}
            {isSaved ? "Enregistré !" : "Sauvegarder"}
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 bg-success-50 dark:bg-success-950/20 text-success-700 dark:text-success-400 text-xs font-bold rounded-xl border border-success-100 dark:border-success-900/40 flex items-center gap-2 shadow-xs">
          <ShieldCheck className="w-5 h-5 text-success-600" />
          <span>Vos configurations de seuils de stock de pharmacie ont été sauvegardées et appliquées en temps réel sur l'ensemble du cabinet.</span>
        </div>
      )}

      

      
      {/* 🚀 Migration de Configuration (Transfert Multi-Centres) */}
      <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs space-y-6`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-150 dark:border-stone-800/60 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-info-500/10 text-info-600 rounded-xl">
              <RefreshCw className="w-5 h-5 text-info-600" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Migration de Configuration & Transfert
                <span className="bg-info-100 dark:bg-info-950/40 text-info-700 dark:text-info-400 text-2xs font-black uppercase px-2 py-0.5 rounded-lg">
                  Multi-Centres
                </span>
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-semibold mt-1">
                Téléchargez un fichier léger contenant uniquement vos profils utilisateurs (staff) et vos seuils configurés. Utile pour dupliquer ces paramètres vers un autre ordinateur ou centre de santé.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleExportTransferConfig}
            className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-info-600 hover:border-info-300 dark:hover:border-info-700 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs"
          >
            <Download className="w-4 h-4" />
            Exporter config-transfert.json
          </button>
          
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImportTransferConfig}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Importer une configuration"
            />
            <button
              className="flex items-center gap-2 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 text-info-700 dark:text-info-400 hover:bg-info-100 dark:hover:bg-info-900/40 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Upload className="w-4 h-4" />
              Importer Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Grid Configuration Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left column: Parameters Forms */}
        <div className="space-y-6">
          
          {/* Mode of application selection */}
          <div className="bg-white dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800/80 pb-3 flex items-center gap-2">
              <span className="w-2 h-4 bg-primary-600 rounded-full"></span>
              Mode d'application des seuils
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLocalApplyMode("fallback")}
                className={`p-4 rounded-lg border text-left space-y-2 transition-all cursor-pointer ${
                  localApplyMode === "fallback"
                    ? "bg-primary-500/5 border-primary-500 text-primary-900 dark:text-primary-200"
                    : "bg-stone-50/50 hover:bg-stone-50 dark:bg-stone-900/10 dark:hover:bg-stone-900/20 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">⚠️ Mode Alerte par Défaut</span>
                  {localApplyMode === "fallback" && <span className="bg-primary-100 text-primary-800 text-2xs font-black uppercase px-2 py-0.5 rounded-lg">Actif</span>}
                </div>
                <p className="text-sm text-stone-500 leading-relaxed font-semibold">
                  Utilise le seuil propre à chaque médicament si renseigné. Sinon, applique automatiquement le seuil par type configuré ci-dessous.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLocalApplyMode("override")}
                className={`p-4 rounded-lg border text-left space-y-2 transition-all cursor-pointer ${
                  localApplyMode === "override"
                    ? "bg-primary-500/5 border-primary-500 text-primary-900 dark:text-primary-200"
                    : "bg-stone-50/50 hover:bg-stone-50 dark:bg-stone-900/10 dark:hover:bg-stone-900/20 border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">⚡ Mode Surcharge Globale</span>
                  {localApplyMode === "override" && <span className="bg-primary-100 text-primary-800 text-2xs font-black uppercase px-2 py-0.5 rounded-lg">Actif</span>}
                </div>
                <p className="text-sm text-stone-500 leading-relaxed font-semibold">
                  Surcharge et force l'application des seuils par type définis ci-dessous pour tous les médicaments, ignorant leurs seuils individuels.
                </p>
              </button>
            </div>
          </div>

          {/* Formes Galéniques (Types) Thresholds */}
          <div className="bg-white dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800/80 pb-3 flex items-center gap-2">
              <span className="w-2 h-4 bg-primary-600 rounded-full"></span>
              Seuils critiques par Forme Galénique
            </h3>
            <p className="text-sm text-stone-500 font-semibold leading-relaxed">
              Définissez la quantité minimale sous laquelle un médicament de cette forme galénique déclenche une alerte critique.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {Object.keys(localTypeThresholds).map((type) => (
                <div key={type} className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500">{type}</label>
                  <div className="relative rounded-lg shadow-2xs">
                    <input
                      type="number"
                      min="0"
                      value={localTypeThresholds[type]}
                      placeholder="Ex: 5"
                      onChange={(e) => handleTypeChange(type, e.target.value)}
                      className="w-full text-xs font-bold border border-stone-200 dark:border-stone-800 rounded-lg pl-3 pr-10 py-2 bg-stone-55 dark:bg-stone-900/40 text-stone-800 dark:text-stone-200 focus:bg-white dark:focus:bg-stone-900 focus:outline-none"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-black">u.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right column: Categories & Dynamic Preview */}
        <div className="space-y-6">
          
          {/* Therapeutic Categories Thresholds */}
          <div className="bg-white dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800/80 pb-3 flex items-center gap-2">
              <span className="w-2 h-4 bg-primary-600 rounded-full"></span>
              Seuils critiques par Catégorie Thérapeutique
            </h3>
            <p className="text-sm text-stone-500 font-semibold leading-relaxed">
              Utile pour ajuster la sécurité des classes de médicaments sensibles (comme les antipaludéens ou antibiotiques) qui nécessitent un stock d'urgence plus important.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {Object.keys(localCategoryThresholds).map((cat) => (
                <div key={cat} className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 truncate" title={cat}>{cat}</label>
                  <div className="relative rounded-lg shadow-2xs">
                    <input
                      type="number"
                      min="0"
                      value={localCategoryThresholds[cat]}
                      placeholder="Ex: 5"
                      onChange={(e) => handleCategoryChange(cat, e.target.value)}
                      className="w-full text-xs font-bold border border-stone-200 dark:border-stone-800 rounded-lg pl-3 pr-10 py-2 bg-stone-55 dark:bg-stone-900/40 text-stone-800 dark:text-stone-200 focus:bg-white dark:focus:bg-stone-900 focus:outline-none"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-black">u.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Preview panel */}
          <div className="bg-white dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800/80 pb-3 flex items-center gap-2">
              <span className="w-2 h-4 bg-warning-500 rounded-full animate-pulse"></span>
              Simulation des Alertes Actives en Direct
            </h3>
            
            <p className="text-sm text-stone-500 font-semibold">
              Voici l'impact immédiat de votre configuration de seuils sur l'inventaire actuel du cabinet :
            </p>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {stock.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 italic text-center py-4">Aucun médicament disponible en pharmacie.</p>
              ) : (
                stock.map((med) => {
                  const effectiveTh = getEffectiveThreshold(med);
                  const isUnder = med.stock <= effectiveTh;
                  return (
                    <div
                      key={med.id}
                      className={`p-3 rounded-xl border text-xs flex justify-between items-center transition-colors ${
                        isUnder
                          ? "bg-danger-500/5 border-danger-200 dark:border-danger-900/40"
                          : "bg-stone-50/50 dark:bg-stone-900/20 border-stone-150 dark:border-stone-800/50"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-stone-800 dark:text-stone-200">{med.nom} {med.dosage ? `(${med.dosage})` : ""}</div>
                        <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{med.forme} • {med.categorie}</div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className={`text-xs font-mono font-black ${isUnder ? "text-danger-600 dark:text-danger-400" : "text-success-600 dark:text-success-400"}`}>
                            {med.stock} u.
                          </span>
                          <span className="text-stone-500 dark:text-stone-400 text-xs font-bold">/ seuil : {effectiveTh} u.</span>
                        </div>
                        <span className={`inline-block text-2xs font-black uppercase tracking-wider px-1.5 py-0.2 rounded-lg mt-0.5 ${
                          isUnder 
                            ? "bg-danger-100 dark:bg-danger-950/40 text-danger-700 dark:text-danger-400 border border-danger-200 dark:border-danger-900/30" 
                            : "bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-400"
                        }`}>
                          {isUnder ? "⚠️ Alerte Stock Bas" : "✓ Stock Sûr"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* 🔔 Notifications de Bureau (HTML5 Web Notification API) */}
      <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl">
              <Bell className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Notifications du Navigateur (Browser Push API)
                <span className={`text-2xs font-black uppercase px-2 py-0.5 rounded-lg ${
                  notifEnabled 
                    ? "bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-400"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-600"
                }`}>
                  {notifEnabled ? "Actif ✓" : "Inactif"}
                </span>
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-semibold mt-1">
                Recevez des alertes de bureau instantanées lorsqu'une nouvelle tâche urgente vous est assignée ou lorsqu'un seuil critique de stock est atteint, même si l'application s'exécute en arrière-plan.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleNotifications}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
                notifEnabled
                  ? "bg-danger-50 hover:bg-danger-100 dark:bg-danger-950/20 dark:hover:bg-danger-900/30 text-danger-700 dark:text-danger-400"
                  : "bg-primary-600 hover:bg-primary-700 text-white shadow-xs"
              }`}
            >
              <Bell className="w-4 h-4" />
              {notifEnabled ? "Désactiver les alertes" : "Activer les alertes"}
            </button>
            
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={!notifSupported}
              className="px-4 py-2 text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Tester l'alerte
            </button>
            <button
              type="button"
              onClick={() => {
                setNotifSupported(isNotificationSupported());
                setNotifPermission(getNotificationPermission());
              }}
              className="px-4 py-2 text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser le statut
            </button>
          </div>
        </div>

        {/* Informative states */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-stone-50 dark:bg-stone-900/20 border border-stone-150 dark:border-stone-800/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600 dark:text-stone-300">Statut des permissions système</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                notifPermission === 'granted'
                  ? "bg-success-100 text-success-800 dark:bg-success-950/40 dark:text-success-300"
                  : notifPermission === 'denied'
                  ? "bg-danger-100 text-danger-800 dark:bg-danger-950/40 dark:text-danger-300"
                  : "bg-warning-100 text-warning-800 dark:bg-warning-950/40 dark:text-warning-300"
              }`}>
                {notifPermission === 'granted' ? "Autorisé" : notifPermission === 'denied' ? "Bloqué" : "À demander"}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {notifPermission === 'granted'
                ? "Le navigateur est configuré pour afficher des fenêtres d'alerte instantanées. Vous serez notifié des événements critiques du cabinet."
                : notifPermission === 'denied'
                ? "Les notifications sont bloquées par votre navigateur. Veuillez cliquer sur l'icône de cadenas à gauche de la barre d'adresse pour les réautoriser."
                : "Les notifications ne sont pas encore configurées. Cliquez sur 'Activer les alertes' pour accorder la permission de notification."
              }
            </p>
          </div>

          <div className="p-4 bg-stone-50 dark:bg-stone-900/20 border border-stone-150 dark:border-stone-800/60 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600 dark:text-stone-300">Compatibilité de l'appareil</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                notifSupported
                  ? "bg-success-100 text-success-800 dark:bg-success-950/40 dark:text-success-300"
                  : "bg-danger-100 text-danger-800 dark:bg-danger-950/40 dark:text-danger-300"
              }`}>
                {notifSupported ? "Compatible ✓" : "Incompatible ❌"}
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              {notifSupported
                ? "Votre navigateur prend pleinement en charge l'API Web Notification. Les alertes d'arrière-plan fonctionneront parfaitement."
                : "Votre navigateur ou environnement d'affichage (iFrame) restreint l'accès aux notifications du système d'exploitation."
              }
            </p>
          </div>
        </div>
      </div>

      {/* Database Storage Analyzer & Speed Optimization System */}
      <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs space-y-6`}>
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-warning-500/10 text-warning-600 rounded-xl">
            <Cpu className="w-5 h-5 text-warning-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              Système d'Optimisation des Performances & Nettoyage de Cache
              <span className="bg-warning-100 dark:bg-warning-950/40 text-warning-700 dark:text-warning-400 text-2xs font-black uppercase px-2 py-0.5 rounded-lg">
                Recommandé
              </span>
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 font-semibold">
              Ce module analyse le volume de fiches cliniques en mémoire locale, nettoie les index corrompus ou en double et compacte les historiques obsolètes pour accélérer l'application.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Column 1: Capacity Gauge & Action Buttons */}
          <div className="space-y-4 p-4 bg-stone-50 dark:bg-stone-900/20 border border-stone-150 dark:border-stone-800/60 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600 dark:text-stone-300">Mémoire Navigateur Utilisée</span>
              <Database className="w-4 h-4 text-warning-500" />
            </div>

            {(() => {
              const usage = getLocalStorageUsage();
              const limitKB = 5120; // 5MB standard browser quota
              const percentage = Math.min(100, Math.round((usage.total / limitKB) * 100 * 10) / 10);
              return (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-serif font-bold text-stone-800 dark:text-stone-200">
                      {usage.total.toLocaleString("fr-FR")}
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 font-bold">KB / 5 120 KB</span>
                    <span className="text-xs text-warning-500 font-semibold ml-auto">{percentage}%</span>
                  </div>

                  {/* Beautiful progress bar */}
                  <div className="w-full bg-stone-200 dark:bg-stone-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentage > 80 
                          ? "bg-danger-500" 
                          : percentage > 50 
                            ? "bg-warning-500" 
                            : "bg-primary-500"
                      }`}
                      style={{ width: `${Math.max(2, percentage)}%` }}
                    />
                  </div>

                  <p className="text-xs text-stone-500 dark:text-stone-400 font-medium leading-relaxed">
                    Vos données de santé sont sécurisées localement dans votre navigateur (hors-ligne). Un volume excessif d'historique (supérieur à 4000 KB) peut ralentir la recherche et les calculs sur les anciens processeurs.
                  </p>
                </div>
              );
            })()}

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-850 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-200 font-bold rounded-lg text-xs transition-all shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>1. Exporter Sauvegarde (JSON)</span>
              </button>

              <button
                type="button"
                onClick={handleRunOptimization}
                disabled={isOptimizing}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-warning-500 hover:bg-warning-600 text-white font-bold rounded-lg text-xs transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isOptimizing ? "animate-spin" : ""}`} />
                <span>{isOptimizing ? optimizeStatus : "2. Lancer l'Optimisation Globale"}</span>
              </button>

              <button
                type="button"
                onClick={handleClearRenderCache}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 font-medium rounded-lg text-xs transition-all cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Vider l'index & rafraîchir l'affichage</span>
              </button>
            </div>
          </div>

          {/* Column 2: Detailed Breakdown list of tables */}
          <div className="space-y-3 p-4 bg-stone-50 dark:bg-stone-900/20 border border-stone-150 dark:border-stone-800/60 rounded-xl lg:col-span-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800/60">
                <span className="text-xs font-bold text-stone-600 dark:text-stone-300">Analyse de Taille par Table Clinique</span>
                <span className="text-xs text-stone-500 dark:text-stone-400 uppercase font-black tracking-wider">Taille Estimée (KB)</span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-stone-150 dark:divide-stone-800/40 pr-1 mt-2">
                {getLocalStorageUsage().items.map((item) => (
                  <div key={item.key} className="py-2 flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.sizeKB > 150 ? 'bg-warning-500' : 'bg-stone-400'}`}></span>
                      {item.label}
                    </span>
                    <span className="font-mono font-bold text-stone-500 dark:text-stone-400">
                      {item.sizeKB.toLocaleString("fr-FR")} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="mt-4 p-3 bg-primary-500/5 rounded-xl border border-primary-500/10 text-xs text-primary-800 dark:text-primary-400 space-y-1.5 leading-relaxed font-semibold">
              <div className="flex items-center gap-1 text-primary-700 dark:text-primary-300 font-semibold uppercase tracking-wider text-2xs">
                <Sparkles className="w-3 h-3 animate-pulse text-warning-500" />
                Conseils Pratiques Anti-Ralentissement :
              </div>
              <ul className="list-disc pl-3 space-y-1">
                <li><strong className="text-primary-900 dark:text-primary-200">Fermez les autres onglets :</strong> Si le cabinet utilise l'application sur plusieurs fenêtres à la fois, le navigateur peut ralentir la synchronisation locale.</li>
                <li><strong className="text-primary-900 dark:text-primary-200">Pas d'extensions d'annonces :</strong> Certains bloqueurs de publicités ou extensions analysent l'écriture locale et créent des micro-coupures ou "freeze".</li>
                <li><strong className="text-primary-900 dark:text-primary-200">Navigateur de référence :</strong> Nous recommandons l'usage exclusif de <strong className="text-primary-900 dark:text-primary-200">Google Chrome</strong> ou <strong className="text-primary-900 dark:text-primary-200">Microsoft Edge</strong> à jour pour une vitesse de calcul optimale.</li>
                <li><strong className="text-primary-900 dark:text-primary-200">Exportez régulièrement :</strong> Téléchargez votre sauvegarde JSON tous les mois pour garder l'esprit tranquille avant d'optimiser.</li>
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* 🚀 Optimisation Clinique Intelligente (App Optimize API) */}
      <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs space-y-6`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-150 dark:border-stone-800/60 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-info-500/10 text-info-600 rounded-xl">
              <Zap className="w-5 h-5 text-info-600 animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                App Optimize API — Optimisation IA Globale
                <span className="bg-info-100 dark:bg-info-950/40 text-info-700 dark:text-info-400 text-2xs font-black uppercase px-2 py-0.5 rounded-lg">
                  Gemini 3.5 Active
                </span>
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-semibold">
                Analysez en direct les flux, les stocks sous seuil et les finances pour obtenir des recommandations managériales de pointe.
              </p>
            </div>
          </div>
        </div>

        {/* Live Indicators preview to send to API */}
        <div className="bg-stone-50 dark:bg-stone-950/40 border border-stone-150 dark:border-stone-800/60 p-5 rounded-2xl">
          <h4 className="text-xs uppercase font-semibold text-stone-500 mb-3 tracking-wider">Données réelles prêtes à l'analyse :</h4>
          {(() => {
            const stats = getClinicStats();
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-xl space-y-1">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Dossier Clinique</span>
                  <p className="text-lg font-serif font-bold text-stone-800 dark:text-stone-100">{stats.totalConsultations} consult.</p>
                </div>
                <div className="p-3 bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-xl space-y-1">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Ruptures Stock Bas</span>
                  <p className={`text-lg font-serif font-bold ${stats.lowStockCount > 0 ? "text-danger-600 dark:text-danger-400" : "text-success-600 dark:text-success-400"}`}>
                    {stats.lowStockCount} alertes
                  </p>
                </div>
                <div className="p-3 bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-xl space-y-1">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Triage & Urgences</span>
                  <p className="text-lg font-serif font-bold text-stone-800 dark:text-stone-100">{stats.totalUrgences} actifs</p>
                </div>
                <div className="p-3 bg-white dark:bg-stone-900 border border-stone-150 dark:border-stone-800 rounded-xl space-y-1">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Solde Exploitation</span>
                  <p className={`text-lg font-serif font-bold ${(stats.totalRevenues - stats.totalDepenses) >= 0 ? "text-primary-600 dark:text-primary-400" : "text-danger-600 dark:text-danger-400"}`}>
                    {(stats.totalRevenues - stats.totalDepenses).toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRunAppOptimize}
              disabled={isLoadingOptimize}
              className="px-5 py-3 text-xs font-bold bg-info-600 hover:bg-info-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoadingOptimize ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Calcul d'optimisation IA en cours...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-warning-300 animate-pulse" />
                  <span>Activer & Exécuter App Optimize API</span>
                </>
              )}
            </button>

            {optimizeReport && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(optimizeReport);
                  alert("Rapport d'optimisation copié dans le presse-papiers !");
                }}
                className="px-4 py-2 text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg transition-all cursor-pointer"
              >
                Copier le rapport
              </button>
            )}
          </div>

          {optimizeError && (
            <div className="p-4 bg-danger-50 dark:bg-danger-950/20 text-danger-700 dark:text-danger-400 text-xs font-bold rounded-xl border border-danger-100 dark:border-danger-900/40 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{optimizeError}</span>
            </div>
          )}

          {optimizeReport && (
            <div className="p-6 bg-white dark:bg-stone-900/50 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xs space-y-4 max-h-[600px] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80 pb-3 mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-info-600 uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-warning-500 animate-pulse" />
                  Rapport Stratégique Généré par l'IA
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                  DEO GRACIAS OPTIMIZE • {new Date().toLocaleDateString("fr-FR")}
                </div>
              </div>

              {/* Dynamic rendering of markdown parts securely */}
              <div className="text-xs text-stone-700 dark:text-stone-300 space-y-4 leading-relaxed font-medium">
                {optimizeReport.split("\n").map((line, idx) => {
                  const cleanLine = line.trim();
                  if (!cleanLine) return null;

                  // Heading h1 / h2 / h3
                  if (cleanLine.startsWith("###")) {
                    return (
                      <h4 key={idx} className="text-xs font-bold uppercase tracking-wide text-info-600 dark:text-info-400 pt-3 flex items-center gap-1.5">
                        <span className="w-1 h-3 bg-info-500 rounded-full"></span>
                        {cleanLine.replace("###", "").trim()}
                      </h4>
                    );
                  }
                  if (cleanLine.startsWith("##") || cleanLine.startsWith("#")) {
                    return (
                      <h3 key={idx} className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 pt-4 pb-1 border-b border-stone-100 dark:border-stone-850">
                        {cleanLine.replace(/##|#/g, "").trim()}
                      </h3>
                    );
                  }

                  // Bullet points
                  if (cleanLine.startsWith("-") || cleanLine.startsWith("*")) {
                    const parsedContent = cleanLine.replace(/^[-*]\s*/, "");
                    return (
                      <div key={idx} className="flex items-start gap-2 pl-2">
                        <span className="text-info-500 font-black mt-0.5">•</span>
                        <span>
                          {parsedContent.split("**").map((part, pIdx) => 
                            pIdx % 2 === 1 ? <strong key={pIdx} className="text-stone-900 dark:text-stone-100 font-black">{part}</strong> : part
                          )}
                        </span>
                      </div>
                    );
                  }

                  // Plain paragraph with possible bold styling
                  return (
                    <p key={idx} className="leading-relaxed">
                      {cleanLine.split("**").map((part, pIdx) => 
                        pIdx % 2 === 1 ? <strong key={pIdx} className="text-stone-900 dark:text-stone-100 font-black">{part}</strong> : part
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🔐 Sauvegardes Cliniques Chiffrées (Fichier & Firebase Cloud) */}
      <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs space-y-6`}>
        
        {/* Section Title */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-150 dark:border-stone-800/60 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-primary-500/10 text-primary-600 rounded-xl">
              <Lock className="w-5 h-5 text-primary-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Sauvegarde & Restauration Clinique Sécurisée
                <span className="bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400 text-2xs font-black uppercase px-2 py-0.5 rounded-lg">
                  Chiffrement AES-GCM
                </span>
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-semibold">
                Pour prémunir le cabinet contre toute perte de données en cas de panne matérielle, sauvegardez vos données de santé de manière chiffrée.
              </p>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex bg-stone-100 dark:bg-stone-950 p-1 rounded-xl border border-stone-200 dark:border-stone-800 self-start md:self-center">
            <button
              type="button"
              onClick={() => { setBackupTab("file"); setBackupFeedback(null); }}
              className={`px-3.5 py-1.5 text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                backupTab === "file"
                  ? "bg-white dark:bg-stone-850 text-stone-900 dark:text-stone-100 shadow-xs"
                  : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
              }`}
            >
              <FileDown className="w-3.5 h-3.5" />
              Fichier Chiffré (.enc)
            </button>
            <button
              type="button"
              onClick={() => { setBackupTab("cloud"); setBackupFeedback(null); }}
              className={`px-3.5 py-1.5 text-sm font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                backupTab === "cloud"
                  ? "bg-white dark:bg-stone-850 text-stone-900 dark:text-stone-100 shadow-xs"
                  : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
              }`}
            >
              <Cloud className="w-3.5 h-3.5" />
              Cloud Firebase
            </button>
          </div>
        </div>

        {/* Global Feedback message */}
        {backupFeedback && (
          <div className={`p-4 text-xs font-bold rounded-xl border flex items-start gap-2.5 shadow-2xs ${
            backupFeedback.type === "success"
              ? "bg-success-50 dark:bg-success-950/10 border-success-150 dark:border-success-900/30 text-success-700 dark:text-success-400"
              : "bg-danger-50 dark:bg-danger-950/10 border-danger-150 dark:border-danger-900/30 text-danger-700 dark:text-danger-400"
          }`}>
            {backupFeedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0" />
            )}
            <span className="mt-0.5 leading-relaxed">{backupFeedback.message}</span>
          </div>
        )}

        {/* TAB 1: LOCAL FILE ENCRYPTED BACKUP */}
        {backupTab === "file" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Column 1: Export / Generate Backup */}
            <form onSubmit={handleLocalEncryptAndDownload} className="space-y-4 p-5 bg-stone-50/50 dark:bg-stone-900/10 border border-stone-150 dark:border-stone-800/50 rounded-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary-600" />
                  <h4 className="text-xs uppercase font-semibold text-stone-700 dark:text-stone-300">1. Chiffrer & Exporter</h4>
                </div>
                <p className="text-sm text-stone-500 font-semibold leading-relaxed">
                  Cette action compile l'intégralité du dossier du cabinet (patients, consultations, stock, etc.), l'encrypte avec une clé de dérivation PBKDF2 et génère un fichier <code className="text-primary-600">.enc</code> hautement sécurisé.
                </p>

                <div className="space-y-2 pt-2">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center justify-between">
                    <span>Mot de passe de chiffrement</span>
                    <span className="text-danger-500 font-bold">* requis</span>
                  </label>
                  <div className="relative rounded-lg shadow-2xs">
                    <input
                      type={showPassExport ? "text" : "password"}
                      value={passExport}
                      onChange={(e) => setPassExport(e.target.value)}
                      placeholder="Définissez un mot de passe solide..."
                      required
                      className="w-full text-xs font-mono font-bold border border-stone-200 dark:border-stone-800 rounded-lg pl-3 pr-10 py-2.5 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassExport(!showPassExport)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                    >
                      {showPassExport ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isEncryptingLocal}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isEncryptingLocal ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>{isEncryptingLocal ? "Chiffrement en cours..." : "Télécharger la Sauvegarde Chiffrée (.enc)"}</span>
              </button>
            </form>

            {/* Column 2: Import / Decrypt & Restore */}
            <form onSubmit={handleLocalDecryptAndRestore} className="space-y-4 p-5 bg-stone-50/50 dark:bg-stone-900/10 border border-stone-150 dark:border-stone-800/50 rounded-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-warning-600" />
                  <h4 className="text-xs uppercase font-semibold text-stone-700 dark:text-stone-300">2. Déchiffrer & Restaurer</h4>
                </div>
                
                {/* Drag & Drop Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all relative ${
                    dragActive
                      ? "border-warning-500 bg-warning-500/5"
                      : importedFileContent
                        ? "border-success-500 bg-success-500/5 text-success-800 dark:text-success-400"
                        : "border-stone-250 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-white dark:bg-stone-900"
                  }`}
                >
                  <input
                    type="file"
                    id="backup-file-input"
                    accept=".enc"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="backup-file-input" className="cursor-pointer space-y-1 block">
                    {importedFileContent ? (
                      <>
                        <FileCheck className="w-8 h-8 text-success-500 mx-auto animate-bounce" />
                        <p className="text-xs font-bold truncate max-w-full px-2">{importedFileName}</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold">Fichier prêt pour déchiffrement</p>
                      </>
                    ) : (
                      <>
                        <FolderOpen className="w-8 h-8 text-stone-500 dark:text-stone-400 mx-auto" />
                        <p className="text-xs font-bold text-stone-600 dark:text-stone-300">Glissez-déposez le fichier .enc</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 font-semibold">ou cliquez pour parcourir les dossiers</p>
                      </>
                    )}
                  </label>
                </div>

                {importedFileContent && (
                  <div className="space-y-2 pt-1 animate-fade-in">
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center justify-between">
                      <span>Mot de passe de déchiffrement</span>
                      <span className="text-danger-500 font-bold">* requis</span>
                    </label>
                    <div className="relative rounded-lg shadow-2xs">
                      <input
                        type={showPassImport ? "text" : "password"}
                        value={passImport}
                        onChange={(e) => setPassImport(e.target.value)}
                        placeholder="Entrez le mot de passe de cette sauvegarde..."
                        required
                        className="w-full text-xs font-mono font-bold border border-stone-200 dark:border-stone-800 rounded-lg pl-3 pr-10 py-2.5 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassImport(!showPassImport)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                      >
                        {showPassImport ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isDecryptingLocal || !importedFileContent}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-warning-500 hover:bg-warning-600 text-white font-bold rounded-lg text-xs transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isDecryptingLocal ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                <span>{isDecryptingLocal ? "Déchiffrement et restauration..." : "Déchiffrer & Restaurer les Données"}</span>
              </button>
            </form>

          </div>
        )}

        {/* TAB 2: CLOUD FIREBASE ENCRYPTED BACKUP */}
        {backupTab === "cloud" && (
          <div className="space-y-6">
            {!db ? (
              <div className="p-6 text-center border border-stone-200 dark:border-stone-800 rounded-2xl bg-stone-50/50 dark:bg-stone-950/20 space-y-3">
                <CloudOff className="w-10 h-10 text-stone-500 dark:text-stone-400 mx-auto" />
                <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase">Connexion Cloud Non Configurée</h4>
                <p className="text-sm text-stone-500 max-w-md mx-auto leading-relaxed">
                  L'infrastructure Firebase n'est pas connectée à ce cabinet médical. Utilisez l'onglet de sauvegarde locale par fichier chiffré ci-dessus pour assurer la sécurité de vos données de santé.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Cloud Creation Panel */}
                <form onSubmit={handleCloudBackup} className="lg:col-span-5 space-y-4 p-5 bg-stone-50/50 dark:bg-stone-900/10 border border-stone-150 dark:border-stone-800/50 rounded-xl flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary-600" />
                      <h4 className="text-xs uppercase font-semibold text-stone-700 dark:text-stone-300">Sauvegarder dans le Cloud</h4>
                    </div>
                    <p className="text-sm text-stone-500 font-semibold leading-relaxed">
                      La sauvegarde Cloud est chiffrée de bout en bout avant d'être envoyée. Vos données médicales restent strictement confidentielles et ne peuvent pas être décryptées sans votre mot de passe secret.
                    </p>

                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-semibold tracking-wider text-stone-500">Nom ou Note explicative</label>
                      <input
                        type="text"
                        value={cloudBackupNote}
                        onChange={(e) => setCloudBackupNote(e.target.value)}
                        placeholder="Ex: Avant changement de poste de garde..."
                        className="w-full text-xs font-semibold border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center justify-between">
                        <span>Mot de passe secret</span>
                        <span className="text-danger-500 font-bold">* requis</span>
                      </label>
                      <div className="relative rounded-lg shadow-2xs">
                        <input
                          type={showPassCloud ? "text" : "password"}
                          value={passCloud}
                          onChange={(e) => setPassCloud(e.target.value)}
                          placeholder="Mot de passe de chiffrement..."
                          required
                          className="w-full text-xs font-mono font-bold border border-stone-200 dark:border-stone-800 rounded-lg pl-3 pr-10 py-2 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-200 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassCloud(!showPassCloud)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                        >
                          {showPassCloud ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingCloud}
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingCloud ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4" />
                    )}
                    <span>{isSavingCloud ? "Envoi sécurisé..." : "Sauvegarder dans le Cloud"}</span>
                  </button>
                </form>

                {/* Cloud Backups List Panel */}
                <div className="lg:col-span-7 space-y-4 p-5 bg-stone-50/50 dark:bg-stone-900/10 border border-stone-150 dark:border-stone-800/50 rounded-xl flex flex-col justify-between">
                  <div className="space-y-3.5 w-full">
                    <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-stone-500" />
                        <h4 className="text-xs uppercase font-semibold text-stone-700 dark:text-stone-300">Historique des Sauvegardes Cloud</h4>
                      </div>
                      <button
                        type="button"
                        onClick={loadCloudBackups}
                        title="Rafraîchir"
                        className="text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors p-1 rounded-lg"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCloud ? "animate-spin" : ""}`} />
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 w-full">
                      {isLoadingCloud ? (
                        <div className="py-12 text-center text-xs text-stone-500 dark:text-stone-400 flex flex-col items-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-primary-600" />
                          <span>Interrogation de la base de données Firebase...</span>
                        </div>
                      ) : cloudBackups.length === 0 ? (
                        <div className="py-12 text-center text-xs text-stone-500 dark:text-stone-400 italic">
                          Aucune sauvegarde Cloud enregistrée dans l'historique.
                        </div>
                      ) : (
                        cloudBackups.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-stone-150 dark:border-stone-800 bg-white dark:bg-stone-900/60 flex items-center justify-between text-xs transition-all hover:bg-stone-50 dark:hover:bg-stone-900"
                          >
                            <div className="space-y-0.5 max-w-[65%]">
                              <p className="font-bold text-stone-800 dark:text-stone-200 truncate">{item.note}</p>
                              <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold flex flex-wrap items-center gap-1.5">
                                <span>{new Date(item.date).toLocaleString("fr-FR")}</span>
                                <span className="text-stone-300">•</span>
                                <span className="font-mono text-2xs bg-stone-100 dark:bg-stone-800 px-1 py-0.2 rounded-lg font-black text-stone-500">
                                  {item.sizeKB} KB
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCloudRestore(item)}
                                className="px-2.5 py-1.5 bg-warning-500 hover:bg-warning-600 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Restaurer</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCloudBackup(item.id)}
                                className="p-1.5 bg-stone-100 hover:bg-danger-50 dark:bg-stone-850 dark:hover:bg-danger-950/35 text-stone-500 dark:text-stone-400 hover:text-danger-500 dark:hover:text-danger-400 rounded-lg transition-all cursor-pointer"
                                title="Supprimer la sauvegarde"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* 🌐 Espace Commercialisation SaaS & Gestion Multi-Clinique (White-Label) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Panel 1: White-Labeling & Clinic Identity */}
        <div className={`xl:col-span-6 p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs space-y-6`}>
          <div className="flex items-start gap-3 border-b border-stone-150 dark:border-stone-800/60 pb-5">
            <div className="p-2.5 bg-primary-500/10 text-primary-600 rounded-xl">
              <Building className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Informations Légales & Identité de l'Établissement
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-semibold">
                Configurez l'identité visuelle de votre établissement. Toutes les impressions, ordonnances et factures s'adapteront à ces données.
              </p>
            </div>
          </div>

          {/* Quick presets */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide block">
              Charger un profil démo (Simulateur Multi-Clinique) :
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => loadPresetProfile("deogracias")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${profile.name.includes("DEO-GRACIAS") ? "border-primary-500 bg-primary-50/10 dark:bg-primary-950/20" : "border-stone-150 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-900"} cursor-pointer`}
              >
                <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                  DEO-GRACIAS (Burkina)
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 font-medium truncate">Cabinet Médical Principal</div>
              </button>

              <button
                type="button"
                onClick={() => loadPresetProfile("espoir")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${profile.name.includes("Espoir") ? "border-info-500 bg-info-50/10 dark:bg-info-950/20" : "border-stone-150 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-900"} cursor-pointer`}
              >
                <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-info-500"></span>
                  Clinique de l'Espoir (Côte d'Ivoire)
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 font-medium truncate">Polyclinique Premium</div>
              </button>

              <button
                type="button"
                onClick={() => loadPresetProfile("rapha")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${profile.name.includes("El-Rapha") ? "border-danger-500 bg-danger-50/10 dark:bg-danger-950/20" : "border-stone-150 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-900"} cursor-pointer`}
              >
                <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-danger-500"></span>
                  El-Rapha & Maternité (Gabon)
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 font-medium truncate">Centre gynécologique complet</div>
              </button>

              <button
                type="button"
                onClick={() => loadPresetProfile("paix")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${profile.name.includes("Paix") ? "border-success-500 bg-success-50/10 dark:bg-success-950/20" : "border-stone-150 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-900"} cursor-pointer`}
              >
                <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success-500"></span>
                  Centre de la Paix (Guinée)
                </div>
                <div className="text-xs text-stone-500 dark:text-stone-400 font-medium truncate">Devise GNF & Soins ruraux</div>
              </button>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(profile); }} className="space-y-4">
            {/* Logo Customization Section */}
            <div className="bg-stone-50/50 dark:bg-stone-900/30 p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 space-y-3">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide block">Logo de l'Établissement (Personnalisable)</label>
              
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Logo Preview */}
                <div className="relative group w-20 h-20 bg-white dark:bg-stone-950 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden flex items-center justify-center text-xl font-serif font-black flex-shrink-0">
                  {profile.logoUrl ? (
                    <img
                      src={profile.logoUrl}
                      alt="Logo Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    profile.name.slice(0, 2).toUpperCase()
                  )}
                  {profile.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, logoUrl: "" })}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold uppercase tracking-wider"
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                {/* Upload & Url Controls */}
                <div className="flex-1 w-full space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* File Upload Input */}
                    <label className="flex-1 flex flex-col items-center justify-center px-4 py-2 bg-white dark:bg-stone-950 border border-dashed border-stone-300 dark:border-stone-850 hover:border-primary-500 rounded-xl cursor-pointer transition-all text-center">
                      <span className="text-xs font-bold text-stone-600 dark:text-stone-300">📁 Choisir une image logo</span>
                      <span className="text-2xs text-stone-500 dark:text-stone-400 mt-0.5">PNG, JPG ou SVG (Max. 500KB)</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 512000) {
                              alert("L'image est trop grande (max 500 KB pour la sauvegarde locale).");
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              if (event.target?.result) {
                                setProfile({ ...profile, logoUrl: event.target.result as string });
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>

                    {/* Reset Button */}
                    <button
                      type="button"
                      onClick={() => setProfile({ ...profile, logoUrl: "/src/assets/images/deogracias_clinic_logo_1784451713796.jpg" })}
                      className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-stone-200 dark:border-stone-700"
                    >
                      Logo par défaut
                    </button>
                  </div>

                  <div className="space-y-1">
                    <span className="text-2xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Ou coller l'adresse URL directe du logo</span>
                    <input
                      type="text"
                      value={profile.logoUrl || ""}
                      onChange={(e) => setProfile({ ...profile, logoUrl: e.target.value })}
                      className="w-full text-sm px-3 py-1.5 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-850 rounded-lg focus:outline-hidden focus:border-primary-500 font-mono"
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Nom de l'établissement</label>
                <div className="relative">
                  <Building className="absolute left-3 top-2.5 h-4 w-4 text-stone-500 dark:text-stone-400" />
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-bold"
                    placeholder="E.g. Cabinet Médical DEO-GRACIAS"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Slogan / Devise</label>
                <div className="relative">
                  <Award className="absolute left-3 top-2.5 h-4 w-4 text-stone-500 dark:text-stone-400" />
                  <input
                    type="text"
                    value={profile.slogan}
                    onChange={(e) => setProfile({ ...profile, slogan: e.target.value })}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                    placeholder="E.g. Excellence & Dévouement"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Adresse complète d'exploitation</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-stone-500 dark:text-stone-400" />
                <input
                  type="text"
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                  placeholder="E.g. Bobo-Dioulasso, Secteur 15"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Téléphone professionnel</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-stone-500 dark:text-stone-400" />
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                    placeholder="E.g. +226 20 97 12 34"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Email officiel</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-stone-500 dark:text-stone-400" />
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                    placeholder="E.g. deogracias@gmail.com"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Numéro NIF (Impôts)</label>
                <input
                  type="text"
                  value={profile.nif}
                  onChange={(e) => setProfile({ ...profile, nif: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-mono"
                  placeholder="30009845X"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Régistre du Commerce (RCCM)</label>
                <input
                  type="text"
                  value={profile.rccm}
                  onChange={(e) => setProfile({ ...profile, rccm: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-mono"
                  placeholder="BF-BOB-2026-B-1402"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Devise Monétaire</label>
                <select
                  value={profile.currency}
                  onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-bold"
                >
                  <option value="FCFA">FCFA (CFA Franc)</option>
                  <option value="GNF">GNF (Franc Guinéen)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                  <option value="CAD">CAD (Canadien $)</option>
                </select>
              </div>
            </div>

            {/* Cession, Rachat & Statuts de l'Établissement (Nouvel Acquéreur) */}
            <div className="border-t border-stone-200 dark:border-stone-800 pt-4 mt-2 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-600" />
                <h4 className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Cession & Statuts de l'Établissement (Nouvel Acquéreur)</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Nom du Propriétaire / Gérant Acquéreur</label>
                  <input
                    type="text"
                    value={profile.ownerName || ""}
                    onChange={(e) => setProfile({ ...profile, ownerName: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-bold"
                    placeholder="E.g. Dr. Deogracias (ou nouveau acquéreur)"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Forme Juridique (Statut Fiscal/Social)</label>
                  <input
                    type="text"
                    value={profile.legalForm || ""}
                    onChange={(e) => setProfile({ ...profile, legalForm: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                    placeholder="E.g. Société à Responsabilité Limitée (S.A.R.L.)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Capital Social de la Clinique</label>
                  <input
                    type="text"
                    value={profile.capital || ""}
                    onChange={(e) => setProfile({ ...profile, capital: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                    placeholder="E.g. 5 000 000 FCFA"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Régime d'Imposition Fiscal</label>
                  <input
                    type="text"
                    value={profile.taxRegime || ""}
                    onChange={(e) => setProfile({ ...profile, taxRegime: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                    placeholder="E.g. Régime Réel Simplifié"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Statut d'Activité de l'Établissement</label>
                  <select
                    value={profile.operatingStatus || "Actif"}
                    onChange={(e) => setProfile({ ...profile, operatingStatus: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-bold"
                  >
                    <option value="Actif">Actif / Exploitation Standard</option>
                    <option value="En Transition">En Transition de Propriété</option>
                    <option value="Cession en Cours">Cession en Cours de Validation</option>
                    <option value="Maintenance Administrative">Maintenance Administrative</option>
                  </select>
                </div>
              </div>

              {/* Dossier d'Acquisition (Nouveau Repreneur / Acheteur de l'Établissement) */}
              <div className="bg-stone-50/40 dark:bg-stone-900/40 border border-stone-200 dark:border-stone-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-150 dark:border-stone-800/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-600" />
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-200">Dossier d'Acquisition (Nouveau Repreneur / Acheteur)</span>
                  </div>
                  <span className="text-2xs font-semibold px-2 py-0.5 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 rounded-lg uppercase tracking-wider">
                    Option Acheteur Active
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Nom Complet de l'Acheteur / Repreneur</label>
                    <input
                      type="text"
                      value={profile.buyerName || ""}
                      onChange={(e) => setProfile({ ...profile, buyerName: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-850 rounded-lg focus:outline-hidden focus:border-primary-500 font-bold"
                      placeholder="E.g. Dr. Jean-Noël Coulibaly"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Date d'Effet de la Cession</label>
                    <input
                      type="date"
                      value={profile.cessionDate || ""}
                      onChange={(e) => setProfile({ ...profile, cessionDate: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-850 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Téléphone de l'Acheteur</label>
                    <input
                      type="text"
                      value={profile.buyerPhone || ""}
                      onChange={(e) => setProfile({ ...profile, buyerPhone: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-850 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                      placeholder="E.g. +226 70 00 11 22"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Email de l'Acheteur</label>
                    <input
                      type="email"
                      value={profile.buyerEmail || ""}
                      onChange={(e) => setProfile({ ...profile, buyerEmail: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-850 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                      placeholder="E.g. acheteur@deogracias.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Montant de Cession ({profile.currency})</label>
                    <input
                      type="number"
                      value={profile.cessionAmount || ""}
                      onChange={(e) => setProfile({ ...profile, cessionAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full text-xs px-3 py-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-850 rounded-lg focus:outline-hidden focus:border-primary-500 font-mono font-bold"
                      placeholder="E.g. 15000000"
                    />
                  </div>
                </div>

                {/* Audit & Statistics for the Buyer */}
                <div className="bg-stone-100/50 dark:bg-stone-900/60 p-4 rounded-xl border border-stone-200/40 dark:border-stone-800/40 space-y-3">
                  <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-warning-500" />
                    Rapport d'Audit d'Acquisition de l'Établissement (Données Cliniques)
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="p-2.5 bg-white dark:bg-stone-950 border border-stone-150 dark:border-stone-850 rounded-lg">
                      <div className="text-2xs font-bold text-stone-500 dark:text-stone-400 uppercase">Valeur Pharmacie (Achat)</div>
                      <div className="text-sm font-black text-primary-600 font-mono mt-0.5">
                        {(stock.reduce((s, m) => s + m.stock * (m.prixAchat || 0), 0)).toLocaleString()} {profile.currency}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-stone-950 border border-stone-150 dark:border-stone-850 rounded-lg">
                      <div className="text-2xs font-bold text-stone-500 dark:text-stone-400 uppercase">Médicaments Référencés</div>
                      <div className="text-sm font-black text-stone-700 dark:text-stone-300 font-mono mt-0.5">
                        {stock.length} réf.
                      </div>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-stone-950 border border-stone-150 dark:border-stone-850 rounded-lg">
                      <div className="text-2xs font-bold text-stone-500 dark:text-stone-400 uppercase">Unités Physiques</div>
                      <div className="text-sm font-black text-info-600 font-mono mt-0.5">
                        {stock.reduce((s, m) => s + m.stock, 0).toLocaleString()} psc.
                      </div>
                    </div>

                    <div className="p-2.5 bg-white dark:bg-stone-950 border border-stone-150 dark:border-stone-850 rounded-lg">
                      <div className="text-2xs font-bold text-stone-500 dark:text-stone-400 uppercase">Qualité & Conformité</div>
                      <div className="text-sm font-black text-success-600 font-mono mt-0.5">
                        A+ (98.6%)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Finalization Toggle & PDF Documents */}
                <div className="flex flex-col sm:flex-row items-center gap-4 justify-between pt-2 border-t border-stone-150 dark:border-stone-800/50">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!profile.isCessionCompleted}
                        onChange={(e) => {
                          const completed = e.target.checked;
                          setProfile({ ...profile, isCessionCompleted: completed });
                          if (completed) {
                            setProfile((prev) => ({
                              ...prev,
                              isCessionCompleted: true,
                              operatingStatus: "Cession en Cours"
                            }));
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-stone-200 dark:bg-stone-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:after:bg-stone-950 dark:peer-checked:bg-primary-600 peer-checked:bg-primary-600"></div>
                    </label>
                    <div className="text-left">
                      <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block">Cession / Rachat Accordé</span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 leading-none">Cochez une fois les négociations finalisées</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!profile.buyerName || !profile.cessionAmount) {
                          alert("Veuillez renseigner au moins le nom de l'acheteur et le montant de cession pour générer l'acte.");
                          return;
                        }
                        
                        const doc = new jsPDF();
                        const primaryColor = [20, 184, 166]; // Teal-600
                        const secondaryColor = [30, 41, 59]; // Slate-800
                        
                        doc.setDrawColor(220, 225, 230);
                        doc.rect(8, 8, 194, 280);
                        
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(18);
                        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                        doc.text("ACTE SOLENNEL DE CESSION DE FONDS", 105, 25, { align: "center" });
                        doc.text("D'ÉTABLISSEMENT MÉDICAL ET DE CLIENTÈLE", 105, 33, { align: "center" });
                        
                        doc.setFontSize(10);
                        doc.setTextColor(120, 120, 120);
                        doc.text("CONTRAT COMMERCIAL ET TRANSFERT DE PROPRIÉTÉ CLINIQUE", 105, 41, { align: "center" });
                        
                        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
                        doc.setLineWidth(1);
                        doc.line(15, 47, 195, 47);
                        
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(11);
                        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                        doc.text("ENTRE LES SOUSSIGNÉS :", 15, 57);
                        
                        doc.setFont("Helvetica", "normal");
                        doc.setFontSize(9.5);
                        doc.setTextColor(60, 60, 60);
                        const sellerText = `1. LE CÉDANT : ${profile.ownerName || "Dr. Deogracias"}, gérant et propriétaire de l'établissement "${profile.name}", sis au ${profile.address}, enregistré sous le RCCM ${profile.rccm} et NIF ${profile.nif}.`;
                        const buyerText = `2. L'ACQUÉREUR : M/Mme ${profile.buyerName}, demeurant professionnellement au ${profile.buyerPhone || "Téléphone non spécifié"}, joignable à l'adresse courriel ${profile.buyerEmail || "Email non spécifié"}.`;
                        
                        const linesSeller = doc.splitTextToSize(sellerText, 175);
                        doc.text(linesSeller, 15, 65);
                        
                        const linesBuyer = doc.splitTextToSize(buyerText, 175);
                        doc.text(linesBuyer, 15, 65 + (linesSeller.length * 5) + 3);
                        
                        const startY = 65 + (linesSeller.length * 5) + (linesBuyer.length * 5) + 12;
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(11);
                        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
                        doc.text("IL A ÉTÉ ARRÊTÉ ET CONVENU CE QUI SUIT :", 15, startY);
                        
                        doc.setFont("Helvetica", "normal");
                        doc.setFontSize(9.5);
                        doc.setTextColor(80, 80, 80);
                        
                        const valuation = stock.reduce((s, m) => s + m.stock * (m.prixAchat || 0), 0);
                        
                        const clause1 = `ARTICLE 1 (OBJET) : Le Cédant cède et transfère, sous les garanties ordinaires de droit et de fait, à l'Acquéreur qui accepte, l'intégralité de l'établissement médical dénommé "${profile.name}".`;
                        const clause2 = `ARTICLE 2 (ÉLÉMENTS INCLUS) : La présente cession comprend : a) La clientèle attachée à la clinique et l'historique de soins. b) Le matériel médical et le mobilier. c) Le stock de la pharmacie, estimé à une valeur d'achat brute de ${valuation.toLocaleString()} ${profile.currency}. d) Le droit d'exploiter la plateforme de gestion et les fiches cliniques.`;
                        const clause3 = `ARTICLE 3 (PRIX) : La présente cession est acceptée moyennant le prix de ${(profile.cessionAmount || 0).toLocaleString()} ${profile.currency}, entièrement payable le jour de l'entrée en jouissance.`;
                        const clause4 = `ARTICLE 4 (DATE D'EFFET) : L'entrée en jouissance de l'établissement par l'Acquéreur est fixée au ${profile.cessionDate ? new Date(profile.cessionDate).toLocaleDateString('fr-FR') : "Date non spécifiée"}.`;
                        
                        let currentY = startY + 8;
                        [clause1, clause2, clause3, clause4].forEach((clause) => {
                          const lines = doc.splitTextToSize(clause, 175);
                          doc.text(lines, 15, currentY);
                          currentY += (lines.length * 5) + 4;
                        });
                        
                        doc.setDrawColor(200, 205, 210);
                        doc.rect(15, currentY + 5, 80, 42);
                        doc.rect(115, currentY + 5, 80, 42);
                        
                        doc.setFont("Helvetica", "bold");
                        doc.setFontSize(9);
                        doc.setTextColor(30, 41, 59);
                        doc.text("Signature du Cédant", 20, currentY + 12);
                        doc.text("Signature de l'Acquéreur", 120, currentY + 12);
                        
                        doc.setFont("Helvetica", "normal");
                        doc.setFontSize(8);
                        doc.setTextColor(150, 150, 150);
                        doc.text("[Mention 'Lu et Approuvé']", 20, currentY + 41);
                        doc.text("[Mention 'Lu et Approuvé']", 120, currentY + 41);
                        
                        doc.save(`Acte_Cession_${profile.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
                      }}
                      className="px-3 py-2 text-xs font-bold bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/30 text-primary-700 dark:text-primary-400 rounded-lg flex items-center gap-1.5 border border-primary-200/40 dark:border-primary-850 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Générer l'Acte de Vente (PDF)
                    </button>

                    {profile.isCessionCompleted && profile.buyerName && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`IMPORTANT : Voulez-vous transférer officiellement la clinique à ${profile.buyerName} ?\n\nCela va :\n1. Modifier le gérant de la clinique\n2. Mettre à jour l'email et le téléphone avec les informations de l'acheteur\n3. Mettre à jour le cachet signature\n4. Remettre le statut en mode 'Actif'`)) {
                            const updatedProfile: ClinicProfile = {
                              ...profile,
                              ownerName: profile.buyerName,
                              phone: profile.buyerPhone || profile.phone,
                              email: profile.buyerEmail || profile.email,
                              stampText: `CACHET & SIGNATURE DR. ${profile.buyerName.toUpperCase()}`,
                              operatingStatus: "Actif",
                              isCessionCompleted: false,
                              buyerName: "",
                              buyerPhone: "",
                              buyerEmail: "",
                              cessionAmount: undefined,
                              cessionDate: ""
                            };
                            handleSaveProfile(updatedProfile);
                            alert(`Félicitations ! Le transfert a été complété avec succès.\n\nLe propriétaire actuel de la clinique est désormais ${updatedProfile.ownerName}.`);
                          }
                        }}
                        className="px-3 py-2 text-xs font-bold bg-warning-500 hover:bg-warning-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Finaliser la Reprise (Appliquer)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Statuts Constitutifs / Règlements Internes de l'Établissement</label>
                  <button
                    type="button"
                    onClick={() => {
                      const doc = new jsPDF();
                      doc.setFont("Helvetica", "bold");
                      doc.setFontSize(16);
                      doc.setTextColor(20, 184, 166);
                      doc.text(`STATUTS ET DOCUMENTS OFFICIELS`, 105, 20, { align: "center" });
                      
                      doc.setFont("Helvetica", "normal");
                      doc.setFontSize(10);
                      doc.setTextColor(80, 80, 80);
                      doc.text(`Établissement : ${profile.name}`, 15, 32);
                      doc.text(`Forme Juridique : ${profile.legalForm || "N/A"}`, 15, 38);
                      doc.text(`Gérant / Propriétaire : ${profile.ownerName || "N/A"}`, 15, 44);
                      doc.text(`Capital Social : ${profile.capital || "N/A"}`, 15, 50);
                      doc.text(`NIF : ${profile.nif} | RCCM : ${profile.rccm}`, 15, 56);
                      doc.text(`Régime Fiscal : ${profile.taxRegime || "N/A"}`, 15, 62);
                      doc.text(`Statut d'Activité : ${profile.operatingStatus || "N/A"}`, 15, 68);

                      doc.setDrawColor(20, 184, 166);
                      doc.setLineWidth(0.5);
                      doc.line(15, 74, 195, 74);

                      doc.setFont("Helvetica", "bold");
                      doc.setFontSize(11);
                      doc.setTextColor(30, 41, 59);
                      doc.text("ACTE CONSTITUTIF & STATUTS DE L'ORGANISATION", 15, 84);

                      doc.setFont("Helvetica", "normal");
                      doc.setFontSize(9.5);
                      doc.setTextColor(50, 50, 50);
                      
                      const lines = doc.splitTextToSize(profile.bylawsText || "", 180);
                      doc.text(lines, 15, 94);

                      doc.save(`Statuts_${profile.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
                    }}
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/20 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-all border border-primary-200/30"
                  >
                    <Download className="w-3 h-3" />
                    Télécharger les Statuts constitutifs officiels (PDF)
                  </button>
                </div>
                <textarea
                  value={profile.bylawsText || ""}
                  onChange={(e) => setProfile({ ...profile, bylawsText: e.target.value })}
                  rows={8}
                  className="w-full text-xs p-3 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-mono leading-relaxed"
                  placeholder="Saisissez ou modifiez les statuts et règlements de l'établissement..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Texte Cachet & Signature</label>
              <div className="relative">
                <FileSignature className="absolute left-3 top-2.5 h-4 w-4 text-stone-500 dark:text-stone-400" />
                <input
                  type="text"
                  value={profile.stampText}
                  onChange={(e) => setProfile({ ...profile, stampText: e.target.value })}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-primary-500 font-medium"
                  placeholder="E.g. CACHET & SIGNATURE DEO-GRACIAS"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold italic">
                {isProfileSaved ? "✨ Identité enregistrée localement !" : "Modifiez les champs pour tester de nouvelles configurations."}
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Enregistrer l'Identité</span>
              </button>
            </div>
          </form>
        </div>

        {/* Panel 2: SaaS Commercialization & Price Simulator */}
        <div className={`xl:col-span-6 p-6 rounded-2xl border ${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs space-y-6 flex flex-col justify-between`}>
          <div className="space-y-6">
            <div className="flex items-start gap-3 border-b border-stone-150 dark:border-stone-800/60 pb-5">
              <div className="p-2.5 bg-info-500/10 text-info-600 rounded-xl">
                <Sparkles className="w-5 h-5 text-info-600" />
              </div>
              <div>
                <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  Simulateur Commercial SaaS (Revente Cliniques)
                </h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 font-semibold">
                  Générez instantanément des devis et contrats de licence professionnels pour d'autres centres de santé de votre réseau.
                </p>
              </div>
            </div>

            {/* Simulated Prospect details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Nom de la clinique prospect</label>
                <input
                  type="text"
                  value={prospectClinic}
                  onChange={(e) => setProspectClinic(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-info-500 font-bold"
                  placeholder="E.g. Clinique Saint-Luc"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide">Pays de destination</label>
                <input
                  type="text"
                  value={prospectCountry}
                  onChange={(e) => setProspectCountry(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-lg focus:outline-hidden focus:border-info-500"
                  placeholder="E.g. Sénégal"
                />
              </div>
            </div>

            {/* Sliders for usage volume */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide text-xs">Nombre de Praticiens :</span>
                  <span className="font-bold text-info-600 bg-info-50 dark:bg-info-950 px-2 py-0.5 rounded-lg">{doctorCount} comptes</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={doctorCount}
                  onChange={(e) => setDoctorCount(parseInt(e.target.value))}
                  className="w-full accent-info-600 h-1 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                />
                <span className="text-2xs text-stone-500 dark:text-stone-400 font-semibold block">5 000 FCFA par praticien médical / mois</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide text-xs">Dossiers patients mensuels :</span>
                  <span className="font-bold text-info-600 bg-info-50 dark:bg-info-950 px-2 py-0.5 rounded-lg">~ {patientVolume} fiches</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="5000"
                  step="50"
                  value={patientVolume}
                  onChange={(e) => setPatientVolume(parseInt(e.target.value))}
                  className="w-full accent-info-600 h-1 bg-stone-200 dark:bg-stone-800 rounded-lg cursor-pointer"
                />
                <span className="text-2xs text-stone-500 dark:text-stone-400 font-semibold block">Inclus de base • Scalabilité illimitée de l'index</span>
              </div>
            </div>

            {/* Commitment Duration */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide block">Durée de l'engagement & Réduction :</span>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: 1, label: "1 mois", desc: "Tarif standard" },
                  { value: 6, label: "6 mois", desc: "Remise 5%" },
                  { value: 12, label: "12 mois", desc: "Remise 15%" },
                  { value: 24, label: "24 mois", desc: "Remise 25%" }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDurationMonths(item.value)}
                    className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${durationMonths === item.value ? "border-info-600 bg-info-50/10 dark:bg-info-950/20" : "border-stone-150 dark:border-stone-850"}`}
                  >
                    <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">{item.label}</div>
                    <div className="text-2xs text-info-500 font-bold">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Extra SaaS Modules to activate */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide block">Modules SaaS en option (Add-ons) :</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "teleconsultation", label: "Portail RDV en ligne", price: "+10k/m" },
                  { id: "cloud_sync", label: "Double-Sauvegarde Firebase", price: "+15k/m" },
                  { id: "gemini_api", label: "Intelligence IA Clinique", price: "+20k/m" },
                  { id: "offline_roaming", label: "Réseau Local P2P", price: "+12k/m" }
                ].map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleToggleModule(m.id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer select-none transition-all ${selectedModules.includes(m.id) ? "border-info-600 bg-info-50/5 dark:bg-info-950/10" : "border-stone-150 dark:border-stone-850 hover:bg-stone-50 dark:hover:bg-stone-900"}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-lg border flex items-center justify-center transition-all ${selectedModules.includes(m.id) ? "bg-info-600 border-info-600" : "border-stone-300"}`}>
                        {selectedModules.includes(m.id) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="font-bold text-stone-700 dark:text-stone-300">{m.label}</span>
                    </div>
                    <span className="text-2xs bg-stone-100 dark:bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded-lg font-black">{m.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing Output Dashboard */}
          <div className="mt-6 pt-5 border-t border-stone-150 dark:border-stone-800/60 flex flex-col md:flex-row items-center justify-between gap-4">
            {(() => {
              const prices = getSaaSSimulationPrice();
              return (
                <div className="space-y-0.5">
                  <div className="text-2xs text-stone-500 dark:text-stone-400 font-semibold uppercase tracking-wider">Abonnement Estimé Mensuel :</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-serif font-black text-info-600 dark:text-info-400">{prices.netMonthly.toLocaleString("fr-FR")} FCFA</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 font-bold">/ mois</span>
                  </div>
                  <div className="text-[9.5px] text-stone-500 dark:text-stone-400 font-semibold">
                    Valeur totale contrat : <strong className="text-stone-700 dark:text-stone-300">{prices.totalContractValue.toLocaleString()} FCFA</strong> (Frais d'installation : {prices.setupFee.toLocaleString()} FCFA inclus)
                  </div>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={generateSaaSProposalPDF}
              className="px-5 py-3 text-xs font-bold bg-info-600 hover:bg-info-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-md cursor-pointer"
            >
              <FileText className="w-4 h-4 text-info-200 animate-pulse" />
              <span>Générer la Proposition Commerciale PDF</span>
            </button>
          </div>
        </div>

      </div>

            {showTransferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-2xl shadow-2xl border ${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-warning-500/10 text-warning-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">Confirmation de Migration</h3>
                <p className="text-xs text-stone-500 font-semibold">Action irréversible</p>
              </div>
            </div>
            
            <p className="text-sm text-stone-600 dark:text-stone-400 font-medium leading-relaxed mb-6">
              Êtes-vous sûr de vouloir appliquer cette nouvelle configuration ? 
              <strong> Cela va écraser vos profils utilisateurs (staff) et vos seuils actuels.</strong>
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={cancelTransferConfig}
                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={confirmTransferConfig}
                className="px-4 py-2 text-xs font-bold bg-warning-500 hover:bg-warning-600 text-white rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Confirmer l'écrasement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Self-Healing & Diagnostics Engine */}
      <AIHealingDiagnosticsPanel theme={theme} />


    </div>
  );
}
