/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import { Staff, RhFiche, Conge, Absence, PinAuditLog } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Calendar, UserCheck, ShieldAlert, Plus, Trash2, Check, X, FileText, DollarSign, Lock, Key, RefreshCw, Eye, EyeOff, Ban, History, Search, Download, Cloud, CloudDownload, CloudUpload, CheckCircle2 } from "lucide-react";
import { db } from "../lib/firebase";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface TabRHProps {
  staff: Staff[];
  fichesRh: RhFiche[];
  conges: Conge[];
  absences: Absence[];
  onUpdateFichesRh: (fiches: RhFiche[]) => void;
  onUpdateConges: (conges: Conge[]) => void;
  onUpdateAbsences: (absences: Absence[]) => void;
  isResponsable?: boolean;
  onUpdateStaff?: (staff: Staff[]) => void;
  currentUser?: any;
}

export default function TabRH({
  staff,
  fichesRh,
  conges,
  absences,
  onUpdateFichesRh,
  onUpdateConges,
  onUpdateAbsences,
  isResponsable = false,
  onUpdateStaff,
  currentUser
}: TabRHProps) {
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

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const filteredStaff = staff.filter((s) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (s.nom || "").toLowerCase().includes(query) ||
      (s.poste || "").toLowerCase().includes(query)
    );
  });

  const filteredConges = conges.filter((c) => {
    const s = staff.find((item) => item.id === c.staffId);
    if (!s) return false;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (s.nom || "").toLowerCase().includes(query) ||
      (s.poste || "").toLowerCase().includes(query)
    );
  });

  const filteredAbsences = absences.filter((a) => {
    const s = staff.find((item) => item.id === a.staffId);
    if (!s) return false;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (s.nom || "").toLowerCase().includes(query) ||
      (s.poste || "").toLowerCase().includes(query)
    );
  });

  // Fiche form states
  const [rhStaffId, setRhStaffId] = useState("");
  const [rhDateEmbauche, setRhDateEmbauche] = useState("");
  const [rhContrat, setRhContrat] = useState<RhFiche["contrat"]>("CDI");
  const [rhDateFinContrat, setRhDateFinContrat] = useState("");
  const [rhSalaire, setRhSalaire] = useState("");
  const [rhMatricule, setRhMatricule] = useState("");
  const [rhCongesAnnuels, setRhCongesAnnuels] = useState("30");

  // Leave Form states
  const [congeStaffId, setCongeStaffId] = useState("");
  const [congeType, setCongeType] = useState<Conge["type"]>("Congé annuel");
  const [congeDebut, setCongeDebut] = useState(getTodayStr());
  const [congeFin, setCongeFin] = useState(getTodayStr());
  const [congeMotif, setCongeMotif] = useState("");

  // Absence Form states
  const [absStaffId, setAbsStaffId] = useState("");
  const [absDate, setAbsDate] = useState(getTodayStr());
  const [absType, setAbsType] = useState<Absence["type"]>("Absence non justifiée");
  const [absNotes, setAbsNotes] = useState("");

  // PIN code management states
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState<string>("");
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});

  // PIN code audit logs state — synchronisé cloud en temps réel
  const [pinAuditLogs, setPinAuditLogs] = useCloudSyncedState<PinAuditLog[]>("dg_pin_audit_logs", []);

  const logSecurityAction = (
    action: "Création" | "Modification" | "Révocation",
    agentId: string,
    details: string
  ) => {
    const targetAgent = staff.find((s) => s.id === agentId);
    const agentNom = targetAgent ? targetAgent.nom : "Agent inconnu";
    
    // Get the author ID / Name
    let authorId = "0000";
    let authorNom = "Responsable";
    if (currentUser) {
      authorId = currentUser.id || "0000";
      authorNom = currentUser.nom || "Responsable";
    }

    const newLog: PinAuditLog = {
      id: generateUid(),
      date: new Date().toISOString(),
      action,
      responsableId: `${authorNom} (ID: ${authorId})`,
      agentId,
      agentNom,
      details
    };

    setPinAuditLogs((prev) => [newLog, ...prev]);
  };

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

  const handleExportStaffCSV = () => {
    const headers = [
      "ID",
      "Nom",
      "Poste",
      "Contact",
      "Horaires",
      "Date d'Embauche",
      "Type de Contrat",
      "Date de Fin de Contrat",
      "Salaire Mensuel",
      "Matricule",
      "Conges Annuels",
      "Code d'Accès Défini"
    ];

    const rows = staff.map((s) => {
      const fiche = fichesRh.find((f) => f.staffId === s.id);
      return [
        s.id,
        s.nom || "",
        s.poste || "",
        s.contact || "",
        s.horaire || "",
        fiche ? fiche.dateEmbauche : "",
        fiche ? fiche.contrat : "",
        fiche ? fiche.dateFinContrat : "",
        fiche ? fiche.salaire : "",
        fiche ? fiche.matricule : "",
        fiche ? fiche.congesAnnuels : "",
        s.codeEntree ? "Oui" : "Non"
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
    downloadCSV(csvContent, `clinique_liste_personnel_rh_${dateStr}.csv`);
  };

  const handleExportStaffPDF = () => {
    const doc = new jsPDF("landscape");
    
    // Add header
    doc.setFontSize(16);
    doc.setTextColor(20, 184, 166); // Teal 600
    doc.text(`Liste du Personnel - ${profile.name}`, 14, 15);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString("fr-FR");
    doc.text(`Généré le ${dateStr}`, 14, 22);

    const headers = [
      "Nom",
      "Poste",
      "Contact",
      "Horaires",
      "Embauche",
      "Contrat",
      "Fin Contrat",
      "Salaire",
      "Code"
    ];

    const rows = staff.map((s) => {
      const fiche = fichesRh.find((f) => f.staffId === s.id);
      return [
        s.nom || "-",
        s.poste || "-",
        s.contact || "-",
        s.horaire || "-",
        fiche ? fiche.dateEmbauche : "-",
        fiche ? fiche.contrat : "-",
        fiche ? fiche.dateFinContrat : "-",
        fiche ? fiche.salaire : "-",
        s.codeEntree ? "Oui" : "Non"
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [20, 184, 166] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });

    doc.save(`clinique_liste_personnel_rh_${dateStr.replace(/\//g, "-")}.pdf`);
  };

  const handleExportAuditCSV = () => {
    const headers = [
      "ID Log",
      "Date",
      "Action",
      "Auteur (Responsable)",
      "ID Agent Cible",
      "Nom Agent Cible",
      "Détails de l'Opération"
    ];

    const rows = pinAuditLogs.map((log) => {
      let formattedDate = log.date;
      try {
        const d = new Date(log.date);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR");
        }
      } catch (e) {}

      return [
        log.id,
        formattedDate,
        log.action,
        log.responsableId,
        log.agentId,
        log.agentNom,
        log.details
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
    downloadCSV(csvContent, `clinique_logs_securite_rh_${dateStr}.csv`);
  };

  // Security validation with administrator password
  const [securityConfirmModal, setSecurityConfirmModal] = useState<{
    isOpen: boolean;
    staffId: string;
    actionType: 'generate' | 'modify' | 'revoke';
    customValue?: string;
  } | null>(null);
  const [adminPinInput, setAdminPinInput] = useState<string>("");
  const [securityError, setSecurityError] = useState<string>("");

  const requestSecurityConfirmation = (
    staffId: string,
    actionType: 'generate' | 'modify' | 'revoke',
    customValue?: string
  ) => {
    if (actionType === 'modify' && customValue !== undefined) {
      const cleanCode = customValue.trim();
      if (!cleanCode || cleanCode.length < 4) {
        alert("Le code d'accès doit contenir au moins 4 caractères.");
        return;
      }
      if (staff.some((s) => s.id !== staffId && s.codeEntree === cleanCode)) {
        alert("Ce code d'accès est déjà attribué à un autre membre du personnel.");
        return;
      }
    }

    setSecurityConfirmModal({
      isOpen: true,
      staffId,
      actionType,
      customValue
    });
    setAdminPinInput("");
    setSecurityError("");
  };

  const handleConfirmSecurityAction = () => {
    if (!securityConfirmModal) return;
    if (adminPinInput !== "0000") {
      setSecurityError("Code administrateur incorrect.");
      return;
    }

    const { staffId, actionType, customValue } = securityConfirmModal;

    if (actionType === 'generate') {
      executeGenerateCode(staffId);
    } else if (actionType === 'modify') {
      executeModifyCode(staffId, customValue || "");
    } else if (actionType === 'revoke') {
      executeRevokeCode(staffId);
    }

    setSecurityConfirmModal(null);
    setAdminPinInput("");
    setSecurityError("");
  };

  const handleManualBackup = async () => {
    if (!db) {
      alert("La base de données Cloud (Firebase) n'est pas disponible ou connectée.");
      return;
    }
    setIsSyncing(true);
    setSyncStatus("Sauvegarde en cours...");
    try {
      await db.collection("dg_staff_cloud").doc("global_list").set({
        staff: staff,
        updatedAt: new Date().toISOString()
      });
      setSyncStatus("✅ Sauvegarde cloud complétée avec succès !");
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      console.error("Manual backup failed:", err);
      setSyncStatus(`❌ Échec de la sauvegarde : ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualRestore = async () => {
    if (!db) {
      alert("La base de données Cloud (Firebase) n'est pas disponible ou connectée.");
      return;
    }
    const confirmRestore = confirm("Voulez-vous restaurer la liste du personnel depuis le Cloud ? Les modifications locales non sauvegardées seront écrasées.");
    if (!confirmRestore) return;

    setIsSyncing(true);
    setSyncStatus("Restauration depuis le Cloud...");
    try {
      const docRef = await db.collection("dg_staff_cloud").doc("global_list").get();
      if (docRef.exists) {
        const cloudData = docRef.data();
        if (cloudData && Array.isArray(cloudData.staff) && cloudData.staff.length > 0) {
          if (onUpdateStaff) {
            onUpdateStaff(cloudData.staff);
            setSyncStatus(`✅ Restauration réussie ! ${cloudData.staff.length} agents réinstallés.`);
            setTimeout(() => setSyncStatus(null), 5000);
          } else {
            setSyncStatus("❌ Échec : Prop de mise à jour non disponible.");
          }
        } else {
          setSyncStatus("⚠️ Aucun personnel trouvé dans le Cloud.");
        }
      } else {
        setSyncStatus("⚠️ Aucun fichier de sauvegarde trouvé sur le serveur Cloud.");
      }
    } catch (err: any) {
      console.error("Manual restore failed:", err);
      setSyncStatus(`❌ Échec de la restauration : ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportDoctorsAsStaff = async () => {
    if (!db) {
      alert("La base de données Cloud (Firebase) n'est pas disponible ou connectée.");
      return;
    }
    const confirmImport = confirm("Voulez-vous importer et fusionner la liste des médecins du portail de RDV en ligne avec la liste du personnel clinique ? Un code d'accès par défaut (7777) leur sera attribué.");
    if (!confirmImport) return;

    setIsSyncing(true);
    setSyncStatus("Importation des médecins...");
    try {
      const snap = await db.collection("medecins").get();
      if (!snap.empty) {
        const doctors = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        
        let addedCount = 0;
        const updatedStaff = [...staff];
        
        doctors.forEach((doc) => {
          // Check if already in staff by name (case insensitive)
          const exists = updatedStaff.some(s => s.nom.toLowerCase().trim() === doc.nom.toLowerCase().trim());
          if (!exists && doc.nom) {
            updatedStaff.push({
              id: `st-med-${doc.id}`,
              nom: doc.nom,
              poste: doc.specialite || "Médecin (Portail)",
              contact: doc.contact || "+226 70 00 00 00",
              horaire: "7h – 16h",
              codeEntree: "7777" // default PIN for imported doctors
            });
            addedCount++;
          }
        });

        if (addedCount > 0) {
          if (onUpdateStaff) {
            onUpdateStaff(updatedStaff);
            setSyncStatus(`✅ Succès ! ${addedCount} nouveaux médecins importés du portail et ajoutés.`);
            setTimeout(() => setSyncStatus(null), 5000);
          }
        } else {
          setSyncStatus("ℹ️ Tous les médecins du portail existent déjà dans le personnel.");
          setTimeout(() => setSyncStatus(null), 4000);
        }
      } else {
        setSyncStatus("⚠️ Aucun médecin enregistré sur le portail de RDV.");
      }
    } catch (err: any) {
      console.error("Doctor import failed:", err);
      setSyncStatus(`❌ Échec de l'importation : ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const executeGenerateCode = (staffId: string) => {
    if (!onUpdateStaff) return;
    let code = "";
    let attempts = 0;
    while (attempts < 100) {
      const num = Math.floor(1000 + Math.random() * 9000).toString();
      if (!staff.some((s) => s.codeEntree === num)) {
        code = num;
        break;
      }
      attempts++;
    }
    if (!code) code = "1234";

    const target = staff.find((s) => s.id === staffId);
    const hadCode = !!(target && target.codeEntree);

    const updatedStaff = staff.map((s) => s.id === staffId ? { ...s, codeEntree: code } : s);
    onUpdateStaff(updatedStaff);
    
    logSecurityAction(
      hadCode ? "Modification" : "Création",
      staffId,
      hadCode
        ? "Génération automatique d'un nouveau code d'accès en remplacement de l'ancien"
        : "Génération automatique d'un premier code d'accès individuel"
    );
  };

  const executeModifyCode = (staffId: string, customCode: string) => {
    if (!onUpdateStaff) return;
    const cleanCode = customCode.trim();
    const target = staff.find((s) => s.id === staffId);
    const hadCode = !!(target && target.codeEntree);

    const updatedStaff = staff.map((s) => s.id === staffId ? { ...s, codeEntree: cleanCode } : s);
    onUpdateStaff(updatedStaff);
    setEditingStaffId(null);
    setEditingCodeValue("");

    logSecurityAction(
      hadCode ? "Modification" : "Création",
      staffId,
      hadCode
        ? "Modification manuelle du code d'accès personnalisé"
        : "Définition manuelle du premier code d'accès individuel"
    );
  };

  const executeRevokeCode = (staffId: string) => {
    if (!onUpdateStaff) return;
    const updatedStaff = staff.map((s) => s.id === staffId ? { ...s, codeEntree: "" } : s);
    onUpdateStaff(updatedStaff);

    logSecurityAction(
      "Révocation",
      staffId,
      "Révocation complète et désactivation définitive du code d'accès de l'agent"
    );
  };

  const toggleShowCode = (staffId: string) => {
    setShowCodes((prev) => ({ ...prev, [staffId]: !prev[staffId] }));
  };

  const handleSaveFiche = () => {
    if (!rhStaffId) {
      alert("Veuillez sélectionner un employé.");
      return;
    }

    const sVal = parseFloat(rhSalaire) || 0;
    const cAnnuels = parseFloat(rhCongesAnnuels) || 30;

    const existantIndex = fichesRh.findIndex((f) => f.staffId === rhStaffId);

    const data: Omit<RhFiche, "id" | "createdAt"> = {
      staffId: rhStaffId,
      dateEmbauche: rhDateEmbauche || getTodayStr(),
      contrat: rhContrat,
      dateFinContrat: rhDateFinContrat,
      salaire: sVal,
      matricule: rhMatricule.trim(),
      congesAnnuels: cAnnuels
    };

    if (existantIndex !== -1) {
      const updated = [...fichesRh];
      updated[existantIndex] = {
        ...updated[existantIndex],
        ...data
      };
      onUpdateFichesRh(updated);
      alert("Fiche RH mise à jour.");
    } else {
      const newFiche: RhFiche = {
        id: generateUid(),
        ...data,
        createdAt: new Date().toISOString()
      };
      onUpdateFichesRh([...fichesRh, newFiche]);
      alert("Fiche RH créée.");
    }

    setRhStaffId("");
    setRhDateEmbauche("");
    setRhDateFinContrat("");
    setRhSalaire("");
    setRhMatricule("");
    setRhCongesAnnuels("30");
  };

  const handleAddConge = () => {
    if (!congeStaffId || !congeDebut || !congeFin) {
      alert("Veuillez renseigner l'employé ainsi que les dates de début et de fin.");
      return;
    }

    const start = new Date(congeDebut);
    const end = new Date(congeFin);
    if (end < start) {
      alert("La date de fin doit être postérieure à la date de début.");
      return;
    }

    const jours = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

    const newConge: Conge = {
      id: generateUid(),
      staffId: congeStaffId,
      dateDebut: congeDebut,
      dateFin: congeFin,
      jours,
      type: congeType,
      motif: congeMotif.trim(),
      statut: "En attente",
      createdAt: new Date().toISOString()
    };

    onUpdateConges([newConge, ...conges]);
    setCongeStaffId("");
    setCongeMotif("");
    alert("Demande de congé enregistrée en attente d'approbation.");
  };

  const handleApproveConge = (id: string, statut: "Approuvé" | "Refusé") => {
    const updated = conges.map((c) => (c.id === id ? { ...c, statut } : c));
    onUpdateConges(updated);
  };

  const handleDeleteConge = (id: string) => {
    if (confirm("Supprimer cette demande de congé ?")) {
      onUpdateConges(conges.filter((c) => c.id !== id));
    }
  };

  const handleAddAbsence = () => {
    if (!absStaffId || !absDate) {
      alert("Veuillez sélectionner un employé et spécifier la date d'absence.");
      return;
    }

    const newAbsence: Absence = {
      id: generateUid(),
      staffId: absStaffId,
      date: absDate,
      type: absType,
      notes: absNotes.trim(),
      createdAt: new Date().toISOString()
    };

    onUpdateAbsences([newAbsence, ...absences]);
    setAbsStaffId("");
    setAbsNotes("");
    alert("Absence enregistrée dans le registre disciplinaire.");
  };

  const handleDeleteAbsence = (id: string) => {
    if (confirm("Retirer cet enregistrement d'absence ?")) {
      onUpdateAbsences(absences.filter((a) => a.id !== id));
    }
  };

  // Calculations
  const curMonth = getTodayStr().slice(0, 7);
  const totalSalariesSum = fichesRh.reduce((s, f) => s + f.salaire, 0);
  const pendingLeaves = conges.filter((c) => c.statut === "En attente");
  const onLeaveToday = conges.filter((c) => c.statut === "Approuvé" && c.dateDebut <= getTodayStr() && c.dateFin >= getTodayStr());
  const monthAbsencesCount = absences.filter((a) => a.date.slice(0, 7) === curMonth).length;

  return (
    <div className="space-y-6">
      {/* Modal de Confirmation de Sécurité Administrateur */}
      {securityConfirmModal && securityConfirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-stone-50 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-warning-600" />
                <span className="font-serif font-bold text-stone-900 text-sm">Validation de Sécurité Requise</span>
              </div>
              <button
                type="button"
                onClick={() => setSecurityConfirmModal(null)}
                className="text-stone-500 dark:text-stone-400 hover:text-stone-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="text-xs text-stone-600 space-y-2">
                <p>
                  Vous vous apprêtez à {
                    securityConfirmModal.actionType === 'generate' ? "générer automatiquement un nouveau code" :
                    securityConfirmModal.actionType === 'modify' ? `définir le code d'accès "${securityConfirmModal.customValue}"` :
                    "révoquer définitivement l'accès"
                  } pour l'agent <strong className="text-stone-900">{staff.find(s => s.id === securityConfirmModal.staffId)?.nom}</strong>.
                </p>
                <p className="bg-warning-50 text-warning-800 border border-warning-200/50 p-2.5 rounded-lg font-medium">
                  Cette action sensible nécessite l'authentification du <strong>Responsable du Service</strong>. Veuillez saisir le code d'accès administrateur (<strong>0000</strong>) pour confirmer.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
                  Code Administrateur (0000)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={adminPinInput}
                  onChange={(e) => {
                    setAdminPinInput(e.target.value);
                    if (securityError) setSecurityError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmSecurityAction();
                  }}
                  className="w-full text-center font-mono font-semibold tracking-widest bg-stone-50 border border-stone-300 rounded-lg py-2.5 text-lg text-stone-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:outline-none"
                  autoFocus
                />
                {securityError && (
                  <p className="text-danger-600 text-sm font-bold text-center mt-1 animate-pulse">
                    {securityError}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-stone-50 px-6 py-3 border-t border-stone-100 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSecurityConfirmModal(null)}
                className="px-4 py-2 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 font-bold rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmSecurityAction}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-lg transition-colors"
              >
                Confirmer l'Action
              </button>
            </div>
          </div>
        </div>
      )}
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{staff.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Effectif total</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Contrats actifs</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-success-600">
          <div className="text-2xl font-semibold text-success-700 font-serif">{totalSalariesSum.toLocaleString("fr-FR")} F</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Masse salariale</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Charges de personnel/mois</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{pendingLeaves.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Congés en attente</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Demandes à valider</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{onLeaveToday.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">En congé ce jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Absences autorisées</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{monthAbsencesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Absences ce mois</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Incidents et retards</div>
        </div>
      </div>

      {/* Leave Approval Warning Alerts */}
      {pendingLeaves.length > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 flex items-center gap-3 text-warning-800 text-xs font-bold shadow-2xs">
          <ShieldAlert className="w-5 h-5 text-warning-600 flex-shrink-0" />
          <div>
            Validation RH : Vous avez actuellement <strong>{pendingLeaves.length} demande(s) de congé</strong> en attente d'approbation. Veuillez arbitrer le calendrier des départs ci-dessous.
          </div>
        </div>
      )}

      {/* Barre d'administration et d'export CSV pour le Responsable */}
      {isResponsable && (
        <div id="rh-admin-actions-bar" className="bg-gradient-to-r from-stone-50 to-stone-100/50 border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide bg-primary-50 text-primary-700 border border-primary-200/50">
              Espace Responsable RH
            </span>
            <p className="text-xs text-stone-500 font-medium">
              Exportez en toute sécurité la liste complète des contrats du personnel ou le journal d'activité de sécurité sous format universel CSV ou document PDF.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="export-staff-csv-btn"
              type="button"
              onClick={handleExportStaffCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 hover:text-stone-900 font-bold rounded-lg text-xs shadow-2xs transition-all active:scale-[0.98]"
              title="Exporter la liste du personnel au format CSV"
            >
              <Download className="w-4 h-4 text-primary-600" />
              <span>Exporter Personnel (CSV)</span>
            </button>
            <button
              id="export-staff-pdf-btn"
              type="button"
              onClick={handleExportStaffPDF}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-50 hover:bg-primary-100 border border-primary-200 text-primary-800 font-bold rounded-lg text-xs shadow-2xs transition-all active:scale-[0.98]"
              title="Exporter la liste du personnel au format PDF"
            >
              <FileText className="w-4 h-4 text-primary-600" />
              <span>Exporter Personnel (PDF)</span>
            </button>
            <button
              id="export-audit-csv-btn"
              type="button"
              onClick={handleExportAuditCSV}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 hover:text-stone-900 font-bold rounded-lg text-xs shadow-2xs transition-all active:scale-[0.98]"
              title="Exporter le journal d'audit de sécurité au format CSV"
            >
              <History className="w-4 h-4 text-warning-600" />
              <span>Exporter Logs d'Activité (CSV)</span>
            </button>
          </div>
        </div>
      )}

      {/* Module de Sauvegarde et Restauration Cloud (Firebase) */}
      {isResponsable && (
        <div id="rh-cloud-sync-panel" className="bg-gradient-to-br from-primary-500/5 via-success-500/5 to-primary-500/10 border border-primary-200/60 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-primary-600 animate-pulse" />
                Rétablissement &amp; Synchronisation Cloud Sécurisée (Firebase)
              </h4>
              <p className="text-sm text-stone-600 leading-relaxed max-w-2xl">
                Ce module permet de sauvegarder et de restaurer l'intégralité de la liste de vos agents enregistrés ainsi que leurs <strong>codes d'accès (PIN) personnels</strong>. En cas de réinitialisation de votre navigateur ou d'utilisation d'un autre terminal, cliquez sur <strong>Restaurer</strong> pour tout récupérer instantanément depuis la base cloud Firebase de l'établissement {profile.name}.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/80 border border-stone-200/80 rounded-xl px-3 py-1.5 text-sm font-semibold text-stone-700">
              <span className={`w-2 h-2 rounded-full ${db ? 'bg-success-500 animate-pulse' : 'bg-danger-400'}`}></span>
              <span>Statut Cloud : {db ? 'Connecté (Firebase)' : 'Hors ligne'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleManualBackup}
              disabled={isSyncing || !db}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold shadow-2xs transition-all active:scale-[0.98] border ${
                db 
                  ? 'bg-primary-600 hover:bg-primary-700 text-white border-primary-700 cursor-pointer' 
                  : 'bg-stone-100 text-stone-500 dark:text-stone-400 border-stone-200 cursor-not-allowed'
              }`}
            >
              <CloudUpload className="w-4 h-4" />
              <span>Sauvegarder vers le Cloud</span>
            </button>

            <button
              type="button"
              onClick={handleManualRestore}
              disabled={isSyncing || !db}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold shadow-2xs transition-all active:scale-[0.98] border ${
                db 
                  ? 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200 cursor-pointer' 
                  : 'bg-stone-100 text-stone-500 dark:text-stone-400 border-stone-200 cursor-not-allowed'
              }`}
            >
              <CloudDownload className="w-4 h-4 text-primary-600" />
              <span>Restaurer depuis le Cloud</span>
            </button>

            <button
              type="button"
              onClick={handleImportDoctorsAsStaff}
              disabled={isSyncing || !db}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold shadow-2xs transition-all active:scale-[0.98] border ${
                db 
                  ? 'bg-success-50 hover:bg-success-100 text-success-800 border-success-200 cursor-pointer' 
                  : 'bg-stone-100 text-stone-500 dark:text-stone-400 border-stone-200 cursor-not-allowed'
              }`}
              title="Importer les médecins déjà présents dans l'annuaire des rendez-vous en ligne"
            >
              <UserCheck className="w-4 h-4 text-success-600" />
              <span>Importer Médecins du Portail</span>
            </button>
          </div>

          {syncStatus && (
            <div className="bg-white border border-stone-200 rounded-xl p-3 text-xs font-bold text-stone-700 flex items-center gap-2 animate-fade-in shadow-3xs">
              <CheckCircle2 className="w-4 h-4 text-success-500" />
              <span>{syncStatus}</span>
            </div>
          )}
        </div>
      )}

      {/* Barre de recherche du personnel */}
      <div id="rh-staff-search-section" className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-serif font-bold text-stone-900 flex items-center gap-2">
            <Search className="w-4 h-4 text-primary-700" />
            Filtrage dynamique du personnel
          </h4>
          <p className="text-sm text-stone-500">
            Saisissez un nom ou un intitulé de poste pour filtrer instantanément toutes les tables et les formulaires ci-dessous.
          </p>
        </div>
        <div className="relative w-full md:w-96">
          <input
            id="rh-staff-search-input"
            type="text"
            placeholder="Rechercher par nom ou par poste (ex: Infirmier, Secrétaire)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-8 py-2.5 border border-stone-200 rounded-lg bg-stone-50/50 text-stone-800 placeholder-stone-400 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:outline-none transition-all"
          />
          <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-3" />
          {searchQuery && (
            <button
              id="clear-rh-search-btn"
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2.5 text-stone-500 dark:text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 p-1 transition-colors"
              title="Effacer la recherche"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fiche Administrative Contrat Form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary-700" />
            Fiche Administrative d'Employé — Dossier RH
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sélectionner l'employé *</label>
              <select
                value={rhStaffId}
                onChange={(e) => {
                  setRhStaffId(e.target.value);
                  const existant = fichesRh.find((f) => f.staffId === e.target.value);
                  if (existant) {
                    setRhDateEmbauche(existant.dateEmbauche);
                    setRhContrat(existant.contrat);
                    setRhDateFinContrat(existant.dateFinContrat || "");
                    setRhSalaire(existant.salaire.toString());
                    setRhMatricule(existant.matricule || "");
                    setRhCongesAnnuels(existant.congesAnnuels.toString());
                  } else {
                    setRhDateEmbauche("");
                    setRhContrat("CDI");
                    setRhDateFinContrat("");
                    setRhSalaire("");
                    setRhMatricule("");
                    setRhCongesAnnuels("30");
                  }
                }}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              >
                <option value="">— Choisir —</option>
                {filteredStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.poste})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date d'embauche</label>
                <input
                  type="date"
                  value={rhDateEmbauche}
                  onChange={(e) => setRhDateEmbauche(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Type de Contrat</label>
                <select
                  value={rhContrat}
                  onChange={(e) => setRhContrat(e.target.value as any)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="CDI">CDI (Indéterminé)</option>
                  <option value="CDD">CDD (Déterminé)</option>
                  <option value="Stage">Stage</option>
                  <option value="Vacataire">Vacataire</option>
                  <option value="Bénévole">Bénévole</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date fin (CDD/Stage)</label>
                <input
                  type="date"
                  value={rhDateFinContrat}
                  onChange={(e) => setRhDateFinContrat(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Salaire Mensuel net (FCFA)</label>
                <input
                  type="number"
                  placeholder="Ex: 150000"
                  value={rhSalaire}
                  onChange={(e) => setRhSalaire(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Matricule CNSS</label>
                <input
                  type="text"
                  placeholder="Ex: BF-00124-CNSS"
                  value={rhMatricule}
                  onChange={(e) => setRhMatricule(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Droit Congés annuels (jours)</label>
                <input
                  type="number"
                  value={rhCongesAnnuels}
                  placeholder="Ex: 30"
                  onChange={(e) => setRhCongesAnnuels(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveFiche}
              className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2 flex items-center justify-center gap-1.5"
            >
              <DollarSign className="w-4 h-4 text-success-300" /> Enregistrer les termes du contrat
            </button>
          </div>
        </div>

        {/* Leave application form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-warning-600" />
            Demande de Congé / Absence Autorisée
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Employé demandeur *</label>
              <select
                value={congeStaffId}
                onChange={(e) => setCongeStaffId(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              >
                <option value="">— Choisir —</option>
                {filteredStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom} ({s.poste})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Motif absence</label>
                <select
                  value={congeType}
                  onChange={(e) => setCongeType(e.target.value as any)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Congé annuel">Congé annuel</option>
                  <option value="Congé maladie">Congé maladie</option>
                  <option value="Sans solde">Sans solde</option>
                  <option value="Congé maternité / paternité">Maternité / Paternité</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date début *</label>
                <input
                  type="date"
                  value={congeDebut}
                  onChange={(e) => setCongeDebut(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date fin *</label>
                <input
                  type="date"
                  value={congeFin}
                  onChange={(e) => setCongeFin(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Notes explicatives</label>
              <input
                type="text"
                placeholder="Préciser l'état ou le besoin..."
                value={congeMotif}
                onChange={(e) => setCongeMotif(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAddConge}
              className="w-full text-xs font-bold py-2 bg-warning-600 hover:bg-warning-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-warning-200" /> Soumettre le calendrier de départ
            </button>
          </div>
        </div>
      </div>

      {/* Security and Access Codes Management Section */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary-700" />
          Sécurité — Administration des Codes d'Accès Individuels (PIN)
        </h3>

        {!isResponsable ? (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 text-center space-y-2">
            <Lock className="w-8 h-8 text-stone-500 dark:text-stone-400 mx-auto" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-700">Accès Administrateur Restreint</h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              L'attribution, la modification et la révocation des codes d'accès individuels (PIN) sont strictement réservées au <strong>Responsable du Service</strong> (Code d'entrée par défaut : <code className="font-mono bg-stone-100 px-1 rounded-lg text-primary-600">0000</code>).
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-stone-500 leading-relaxed">
              En tant que responsable, vous avez l'autorité pour attribuer, mettre à jour ou révoquer les codes d'accès personnels à l'application pour chaque membre du personnel ci-dessous.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                    <th className="p-3">Employé</th>
                    <th className="p-3">Fonction / Poste</th>
                    <th className="p-3 text-center">Code d'accès actuel</th>
                    <th className="p-3 text-center">Actions de Sécurité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-stone-500 dark:text-stone-400 italic font-medium">
                        Aucun membre du personnel trouvé pour la recherche en cours.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((s) => {
                      const isEditing = editingStaffId === s.id;
                      const codeVisible = showCodes[s.id];
                      const hasActiveCode = !!s.codeEntree;

                      return (
                        <tr key={s.id} className="hover:bg-stone-50/30">
                        <td className="p-3 font-bold text-stone-800">{s.nom}</td>
                        <td className="p-3 text-stone-600 font-medium">{s.poste}</td>
                        <td className="p-3 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="text"
                                maxLength={10}
                                placeholder="Code PIN"
                                value={editingCodeValue}
                                onChange={(e) => setEditingCodeValue(e.target.value)}
                                className="w-24 text-center font-mono font-semibold bg-stone-50 border border-stone-300 rounded-lg px-2 py-1 text-xs focus:ring-1 focus:ring-primary-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => requestSecurityConfirmation(s.id, 'modify', editingCodeValue)}
                                className="bg-success-50 hover:bg-success-100 text-success-700 px-1.5 py-1 rounded-lg border border-success-200 text-xs font-bold"
                              >
                                Valider
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStaffId(null);
                                  setEditingCodeValue("");
                                }}
                                className="bg-stone-100 hover:bg-stone-200 text-stone-600 px-1.5 py-1 rounded-lg text-xs font-semibold"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              {hasActiveCode ? (
                                <>
                                  <span className="font-mono font-semibold text-stone-800 tracking-widest text-sm">
                                    {codeVisible ? s.codeEntree : "••••"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleShowCode(s.id)}
                                    className="text-stone-500 dark:text-stone-400 hover:text-stone-600 p-1 rounded-lg transition-colors"
                                    title={codeVisible ? "Masquer le code" : "Afficher le code"}
                                  >
                                    {codeVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs uppercase font-semibold text-danger-500 bg-danger-50 px-2 py-0.5 rounded-lg border border-danger-100">
                                  Accès Révoqué / Aucun
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => requestSecurityConfirmation(s.id, 'generate')}
                              className="bg-primary-50 hover:bg-primary-100 text-primary-700 px-2.5 py-1 rounded-lg border border-primary-200 text-xs font-bold flex items-center gap-1 transition-all"
                              title="Générer un code à 4 chiffres aléatoirement"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Générer</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaffId(s.id);
                                setEditingCodeValue(s.codeEntree || "");
                              }}
                              className="bg-stone-50 hover:bg-stone-100 text-stone-700 px-2.5 py-1 rounded-lg border border-stone-200 text-xs font-bold flex items-center gap-1 transition-all"
                              title="Définir manuellement le code d'accès"
                            >
                              <Key className="w-3 h-3 text-stone-500" />
                              <span>Modifier</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => requestSecurityConfirmation(s.id, 'revoke')}
                              disabled={!hasActiveCode}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all border ${
                                hasActiveCode
                                  ? "bg-danger-50 hover:bg-danger-100 text-danger-700 border-danger-200 cursor-pointer"
                                  : "bg-stone-50 text-stone-300 border-stone-100 cursor-not-allowed"
                              }`}
                              title="Révoquer / Désactiver l'accès"
                            >
                              <Ban className="w-3 h-3" />
                              <span>Révoquer</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Journal d'Audit de Sécurité */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
            <History className="w-5 h-5 text-warning-600" />
            Journal d'Activité de Sécurité (Pistes d'Audit)
          </h3>
          {isResponsable && pinAuditLogs.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const confirmClear = confirm("Voulez-vous réinitialiser le journal d'activité de sécurité ? Cette action nécessite le mot de passe administrateur.");
                if (confirmClear) {
                  const pass = prompt("Saisissez le code d'accès responsable (0000) pour valider :");
                  if (pass === "0000") {
                    setPinAuditLogs([]);
                  } else {
                    alert("Code incorrect. Réinitialisation annulée.");
                  }
                }
              }}
              className="text-stone-500 dark:text-stone-400 hover:text-stone-600 text-xs flex items-center gap-1 font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Réinitialiser le journal</span>
            </button>
          )}
        </div>

        {pinAuditLogs.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">
            Aucun événement de sécurité n'a été enregistré pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Date & Heure</th>
                  <th className="p-3">Auteur (Responsable)</th>
                  <th className="p-3 text-center">Action</th>
                  <th className="p-3">Agent cible</th>
                  <th className="p-3">Description / Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-sans">
                {pinAuditLogs.map((log) => {
                  let badgeColor = "bg-stone-100 text-stone-700 border-stone-200";
                  if (log.action === "Création") {
                    badgeColor = "bg-success-50 text-success-700 border-success-200/50";
                  } else if (log.action === "Modification") {
                    badgeColor = "bg-warning-50 text-warning-700 border-warning-200/50";
                  } else if (log.action === "Révocation") {
                    badgeColor = "bg-danger-50 text-danger-700 border-danger-200/50";
                  }

                  let dateStr = log.date;
                  try {
                    const d = new Date(log.date);
                    if (!isNaN(d.getTime())) {
                      dateStr = d.toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric"
                      }) + " à " + d.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      });
                    }
                  } catch (err) {}

                  return (
                    <tr key={log.id} className="hover:bg-stone-50/40 transition-colors">
                      <td className="p-3 font-mono text-sm text-stone-500 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="p-3 font-medium text-stone-700">
                        {log.responsableId}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide border ${badgeColor}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-stone-800">
                        {log.agentNom}
                      </td>
                      <td className="p-3 text-stone-600 font-medium">
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Staff Admin Dossiers table */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-primary-700" />
          Fiches Administratives d'Embauche Clinique
        </h3>
        {filteredStaff.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">
            {searchQuery ? "Aucun agent clinique ne correspond à votre recherche." : "Aucun agent clinique enregistré."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Employé</th>
                  <th className="p-3">Fonction</th>
                  <th className="p-3 text-center">Date Embauche</th>
                  <th className="p-3 text-center">Type Contrat</th>
                  <th className="p-3 text-right">Salaire Mensuel</th>
                  <th className="p-3 text-center">Matricule CNSS</th>
                  <th className="p-3 text-center">Solde Congés Restants</th>
                  <th className="p-3 text-center">Statut Actuel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredStaff.map((s) => {
                  const f = fichesRh.find((fiche) => fiche.staffId === s.id);
                  const approvedCongesDays = conges
                    .filter((c) => c.staffId === s.id && c.statut === "Approuvé" && c.type === "Congé annuel")
                    .reduce((sum, c) => sum + c.jours, 0);
                  const solde = f ? f.congesAnnuels - approvedCongesDays : "—";

                  const enConge = conges.some(
                    (c) => c.staffId === s.id && c.statut === "Approuvé" && c.dateDebut <= getTodayStr() && c.dateFin >= getTodayStr()
                  );

                  return (
                    <tr key={s.id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-bold text-stone-800">{s.nom}</td>
                      <td className="p-3 text-stone-600 font-medium">{s.poste}</td>
                      <td className="p-3 text-center font-mono text-stone-500">
                        {f && f.dateEmbauche ? new Date(f.dateEmbauche).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="p-3 text-center font-bold text-stone-700">{f ? f.contrat : "—"}</td>
                      <td className="p-3 text-right font-mono font-bold text-stone-900">
                        {f ? `${f.salaire.toLocaleString("fr-FR")} F` : "—"}
                      </td>
                      <td className="p-3 text-center font-mono text-stone-500 dark:text-stone-400">{f ? f.matricule || "—" : "—"}</td>
                      <td className="p-3 text-center font-bold text-primary-700 font-mono">{solde !== "—" ? `${solde} jours` : "—"}</td>
                      <td className="p-3 text-center">
                        {enConge ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-warning-100 text-warning-800">
                            En congé
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-success-100 text-success-800">
                            Présent
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leave Workflow requests table */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-700" />
          Workflow d'Approbation de Congés et Absences Planifiées
        </h3>
        {filteredConges.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">
            {searchQuery ? "Aucune demande de congé ne correspond à votre recherche." : "Aucune demande enregistrée."}
          </p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Employé</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Période de départ</th>
                  <th className="p-3 text-center">Nombre jours</th>
                  <th className="p-3 text-center">Statut d'approbation</th>
                  <th className="p-3 text-center">Actions Décisionnelles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredConges.map((c) => {
                  const s = staff.find((item) => item.id === c.staffId);
                  return (
                    <tr key={c.id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-bold text-stone-800">{s ? s.nom : "Inconnu"}</td>
                      <td className="p-3 text-stone-600 font-medium">{c.type}</td>
                      <td className="p-3 font-mono text-stone-500">
                        {new Date(c.dateDebut).toLocaleDateString("fr-FR")} → {new Date(c.dateFin).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="p-3 text-center font-bold font-mono">{c.jours} j</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide inline-block ${
                            c.statut === "Approuvé"
                              ? "bg-success-100 text-success-800"
                              : c.statut === "Refusé"
                              ? "bg-danger-100 text-danger-800"
                              : "bg-warning-100 text-warning-800 animate-pulse"
                          }`}
                        >
                          {c.statut}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-1.5">
                        {c.statut === "En attente" && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApproveConge(c.id, "Approuvé")}
                              className="bg-success-50 hover:bg-success-100 text-success-700 text-xs font-bold px-2 py-1 rounded-lg border border-success-200 transition-all inline-block"
                            >
                              <Check className="w-3.5 h-3.5 inline" /> Accorder
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveConge(c.id, "Refusé")}
                              className="bg-danger-50 hover:bg-danger-100 text-danger-700 text-xs font-bold px-2 py-1 rounded-lg border border-danger-200 transition-all inline-block"
                            >
                              <X className="w-3.5 h-3.5 inline" /> Refuser
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteConge(c.id)}
                          className="text-stone-300 hover:text-danger-600 p-1 rounded-lg transition-all inline-block align-middle"
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

      {/* Absences Register */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-danger-600" />
          Registre des Infractions d'Absences Non Justifiées / Retards
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-stone-50 p-4 rounded-xl border border-stone-100">
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Employé concerné *</label>
            <select
              value={absStaffId}
              onChange={(e) => setAbsStaffId(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
            >
              <option value="">— Choisir —</option>
              {filteredStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom} ({s.poste})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date du manquement *</label>
            <input
              type="date"
              value={absDate}
              onChange={(e) => setAbsDate(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Type de manquement</label>
            <select
              value={absType}
              onChange={(e) => setAbsType(e.target.value as any)}
              className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none"
            >
              <option value="Absence non justifiée">Absence non justifiée</option>
              <option value="Retard">Retard injustifié</option>
              <option value="Maladie sans certificat">Maladie sans certificat médical</option>
              <option value="Autre">Autre avertissement</option>
            </select>
          </div>
          <div>
            <input
              type="text"
              placeholder="Notes, sanctions éventuelles..."
              value={absNotes}
              onChange={(e) => setAbsNotes(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none mb-4 md:mb-0"
            />
          </div>
          <div className="md:col-span-4 flex justify-end">
            <button
              type="button"
              onClick={handleAddAbsence}
              className="px-5 py-2 text-xs font-bold bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-all"
            >
              Enregistrer l'infraction de présence
            </button>
          </div>
        </div>

        {searchQuery && filteredAbsences.length === 0 && absences.length > 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-4 text-center italic">
            Aucun manquement ne correspond à votre recherche.
          </p>
        ) : filteredAbsences.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                  <th className="p-2">Date d'absence</th>
                  <th className="p-2">Employé concerné</th>
                  <th className="p-2">Nature du manquement</th>
                  <th className="p-2">Notes explicatives</th>
                  <th className="p-2 text-center">Retirer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredAbsences.map((a) => {
                  const s = staff.find((item) => item.id === a.staffId);
                  return (
                    <tr key={a.id} className="hover:bg-stone-50/50">
                      <td className="p-2 font-mono text-stone-500">{new Date(a.date).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2 font-bold text-stone-800">{s ? s.nom : "—"}</td>
                      <td className="p-2 text-danger-700 font-semibold">{a.type}</td>
                      <td className="p-2 text-stone-500 italic">{a.notes || "—"}</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteAbsence(a.id)}
                          className="text-stone-300 hover:text-danger-600 transition-all p-1"
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
        ) : null}
      </div>
    </div>
  );
}
