/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  DocumentArchive, 
  Consultation, 
  Hospitalisation, 
  PatientUrgence, 
  FichePediatrique, 
  ConsultationPrenatale, 
  Facture, 
  Depense, 
  Staff
} from "../types";
import { generateUid, getTodayStr } from "../data";
import { 
  Plus, 
  Trash2, 
  Search, 
  File,
  FileText, 
  UploadCloud, 
  Eye, 
  EyeOff, 
  ZoomIn, 
  Download, 
  FileSpreadsheet, 
  Database, 
  Activity, 
  TrendingUp, 
  HeartPulse, 
  ShieldAlert,
  Sparkles,
  DollarSign,
  Camera
} from "lucide-react";
import CameraCapture from "./CameraCapture";

interface TabDocumentsProps {
  documents: DocumentArchive[];
  onUpdateDocuments: (docs: DocumentArchive[]) => void;
  consultations?: Consultation[];
  hospitalisations?: Hospitalisation[];
  urgences?: PatientUrgence[];
  pediatrie?: FichePediatrique[];
  materniteCpns?: ConsultationPrenatale[];
  factures?: Facture[];
  depenses?: Depense[];
  currentUser?: Staff | null;
}

export default function TabDocuments({ 
  documents, 
  onUpdateDocuments,
  consultations = [],
  hospitalisations = [],
  urgences = [],
  pediatrie = [],
  materniteCpns = [],
  factures = [],
  depenses = [],
  currentUser = null
}: TabDocumentsProps) {
  const [activeTab, setActiveTab] = useState<"clinique" | "administratif" | "exports" | "logs">("clinique");

  // Document metadata Form states
  const [docTitre, setDocTitre] = useState("");
  const [docPatient, setDocPatient] = useState("");
  const [docCategorie, setDocCategorie] = useState("Scan Radio");
  const [docDescription, setDocDescription] = useState("");

  const [dragActive, setDragActive] = useState(false);
  const [base64Preview, setBase64Preview] = useState("");
  const [uploadFileType, setUploadFileType] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [isCompressing, setIsCompressing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [activePreviewDoc, setActivePreviewDoc] = useState<DocumentArchive | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string>("");

  useEffect(() => {
    if (activePreviewDoc?.base64Data) {
      if (activePreviewDoc.base64Data.length > 100000) { // Only for large files
        try {
          const base64Parts = activePreviewDoc.base64Data.split(',');
          if (base64Parts.length === 2) {
            const byteString = atob(base64Parts[1]);
            const mimeString = base64Parts[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });
            const url = URL.createObjectURL(blob);
            setPreviewObjectUrl(url);
            return () => URL.revokeObjectURL(url);
          }
        } catch (e) {
          console.error("Failed to create blob URL", e);
        }
      }
    }
    setPreviewObjectUrl("");
  }, [activePreviewDoc]);

  interface AuditLog {
    id: string;
    action: "AJOUT" | "CONSULTATION";
    docId: string;
    docTitre: string;
    user: string;
    timestamp: string;
  }

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    return documents
      .filter(d => isHR ? true : d.categorie !== "Dossier RH")
      .map(d => ({
        id: generateUid(),
        action: "AJOUT" as "AJOUT",
        docId: d.id,
        docTitre: d.titre,
        user: "Admin / Médecin",
        timestamp: d.createdAt
      }))
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
  });

  const handlePreviewDoc = (doc: DocumentArchive) => {
    setActivePreviewDoc(doc);
    setAuditLogs(prev => [{
      id: generateUid(),
      action: "CONSULTATION",
      docId: doc.id,
      docTitre: doc.titre,
      user: currentUser?.nom || "Admin / Médecin",
      timestamp: new Date().toISOString()
    }, ...prev]);
  };
  const [activeCategoryFilter, setActiveCategoryFilter] = useState("Tous");
  
  // Modal states for document deletion
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const isHR = currentUser?.id === "responsable" || 
    (currentUser?.poste?.toLowerCase() || "").includes("responsable") || 
    (currentUser?.poste?.toLowerCase() || "").includes("rh") || 
    (currentUser?.poste?.toLowerCase() || "").includes("ressources") || 
    (currentUser?.poste?.toLowerCase() || "").includes("directeur") ||
    (currentUser?.poste?.toLowerCase() || "").includes("admin");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // HTML5 Canvas client-side JPEG compression downscaler
  const processFile = (file: File) => {
    setUploadFileType(file.type || "application/octet-stream");
    setUploadFileName(file.name || "document_colle");

    if (!(file.type || "").startsWith("image/")) {
      // Pour les non-images (PDF, Word, etc.), on encode directement en Base64 sans compression
      setIsCompressing(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        setBase64Preview(e.target?.result as string);
        setIsCompressing(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    setIsCompressing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 800; // Augmenté pour une meilleure lisibilité
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
          setBase64Preview(compressedBase64);
        }
        setIsCompressing(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Gestion du Coller global
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Only ignore if there are no files. If there are files (like an image paste), we want to intercept it
        if (!e.clipboardData?.files || e.clipboardData.files.length === 0) {
            return;
        }
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        processFile(e.clipboardData.files[0]);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
    };
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const knownPatients = useMemo(() => {
    const names = new Set<string>();
    
    documents.forEach(d => { if (d.patient && d.patient.trim() !== "Admin") names.add(d.patient.trim()); });
    (consultations || []).forEach(c => { if (c.patient) names.add(c.patient.trim()); });
    (hospitalisations || []).forEach(h => { if (h.patient) names.add(h.patient.trim()); });
    (urgences || []).forEach(u => { if (u.patient) names.add(u.patient.trim()); });
    (pediatrie || []).forEach(p => { if (p.patient) names.add(p.patient.trim()); });
    (materniteCpns || []).forEach(m => { if (m.patient) names.add(m.patient.trim()); });
    
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [documents, consultations, hospitalisations, urgences, pediatrie, materniteCpns]);

  const handleSaveDocument = () => {
    if (!docTitre.trim() || !docPatient.trim() || !base64Preview) {
      alert("Veuillez renseigner le titre du document, le patient, et charger un fichier.");
      return;
    }

    const newDoc: DocumentArchive = {
      id: generateUid(),
      titre: docTitre.trim(),
      patient: docPatient.trim(),
      categorie: docCategorie,
      dateUpload: getTodayStr(),
      description: docDescription.trim(),
      base64Data: base64Preview,
      fileType: uploadFileType,
      fileName: uploadFileName,
      createdAt: new Date().toISOString()
    };

    onUpdateDocuments([newDoc, ...documents]);
    setAuditLogs(prev => [{
      id: generateUid(),
      action: "AJOUT",
      docId: newDoc.id,
      docTitre: newDoc.titre,
      user: currentUser?.nom || "Admin / Médecin",
      timestamp: newDoc.createdAt
    }, ...prev]);
    setDocTitre("");
    setDocPatient("");
    setDocDescription("");
    setBase64Preview("");
    setUploadFileType("");
    setUploadFileName("");
    alert("Document numérisé et archivé avec succès dans le coffre-fort médical.");
  };

  const handleDeleteDoc = (id: string) => {
    setDocToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteDoc = () => {
    if (docToDelete) {
      onUpdateDocuments(documents.filter((d) => d.id !== docToDelete));
      if (activePreviewDoc?.id === docToDelete) {
        setActivePreviewDoc(null);
      }
      setDocToDelete(null);
      setIsDeleteModalOpen(false);
    }
  };
  
  const cancelDeleteDoc = () => {
    setDocToDelete(null);
    setIsDeleteModalOpen(false);
  };

  const filteredDocsList = documents
    .filter((d) => d.patient.toLowerCase().includes(searchQuery.toLowerCase()) || d.titre.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => (b.createdAt || b.dateUpload || "").localeCompare(a.createdAt || a.dateUpload || ""));

  const baseCliniqueDocs = filteredDocsList.filter(d => !["Document Administratif", "Facture Fournisseur", "Contrat", "Mémo", "💼 Coffre-fort: Doc Admin. du Service", "Dossier RH"].includes(d.categorie));
  const cliniqueCategories = ["Tous", ...Array.from(new Set(baseCliniqueDocs.map(d => d.categorie)))];
  const finalCliniqueDocs = activeCategoryFilter === "Tous" ? baseCliniqueDocs : baseCliniqueDocs.filter(d => d.categorie === activeCategoryFilter);

  const baseAdminDocs = filteredDocsList.filter(d => ["Document Administratif", "Facture Fournisseur", "Contrat", "Mémo", "💼 Coffre-fort: Doc Admin. du Service", "Dossier RH"].includes(d.categorie));
  const allowedAdminDocs = isHR 
    ? baseAdminDocs 
    : baseAdminDocs.filter(d => d.categorie !== "Dossier RH");

  const adminCategories = ["Tous", ...Array.from(new Set(allowedAdminDocs.map(d => d.categorie)))];
  const finalAdminDocs = activeCategoryFilter === "Tous" ? allowedAdminDocs : allowedAdminDocs.filter(d => d.categorie === activeCategoryFilter);

  // Helper to trigger standard CSV download with accents support (UTF-8 BOM)
  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((val) => {
            const stringVal = val === undefined || val === null ? "" : String(val);
            const escaped = stringVal.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportConsultations = () => {
    if (!consultations || consultations.length === 0) {
      alert("Aucune donnée de consultation disponible pour l'exportation.");
      return;
    }
    const headers = [
      "ID", "Patient", "Date", "Age", "Sexe", "Contact", 
      "Température (°C)", "Poids (kg)", "Tension Artérielle", "Pouls (bpm)", "Glycémie", 
      "Plainte", "Examen Physique", "Diagnostic", "Prescription Ordonnance", "Créé le"
    ];
    const rows = consultations.map(c => [
      c.id || "",
      c.patient || "",
      c.date || "",
      String(c.age ?? ""),
      c.sexe || "",
      c.contact || "",
      String(c.vitals?.temperature ?? ""),
      String(c.vitals?.poids ?? ""),
      c.vitals?.tensionArterielle || "",
      String(c.vitals?.pouls ?? ""),
      String(c.vitals?.glycemie ?? ""),
      c.plainte || "",
      c.examenPhysique || "",
      c.diagnostic || "",
      c.ordonnance?.map(o => `${o.medicamentNom} [${o.posologie} - ${o.duree}]`).join(" | ") || "",
      c.createdAt || ""
    ]);
    downloadCSV(headers, rows, `cabinet-deogracias-consultations-${getTodayStr()}.csv`);
  };

  const exportHospitalisations = () => {
    if (!hospitalisations || hospitalisations.length === 0) {
      alert("Aucune donnée d'hospitalisation disponible pour l'exportation.");
      return;
    }
    const headers = [
      "ID", "Patient", "Contact", "Date Admission", "Heure Admission", 
      "Service", "Chambre", "Médecin", "Motif d'Admission", "Statut", 
      "Date de Sortie", "Statut de Sortie", "Diagnostic de Sortie", "Créé le"
    ];
    const rows = hospitalisations.map(h => [
      h.id || "",
      h.patient || "",
      h.contact || "",
      h.dateAdmission || "",
      h.heureAdmission || "",
      h.service || "",
      h.chambre || "",
      h.medecin || "",
      h.motif || "",
      h.statut || "",
      h.dateSortie || "",
      h.statutSortie || "",
      h.diagnosticSortie || "",
      h.createdAt || ""
    ]);
    downloadCSV(headers, rows, `cabinet-deogracias-hospitalisations-${getTodayStr()}.csv`);
  };

  const exportUrgences = () => {
    if (!urgences || urgences.length === 0) {
      alert("Aucune donnée d'urgence disponible pour l'exportation.");
      return;
    }
    const headers = [
      "ID", "Patient", "Contact", "Sévérité", "Plainte principale", 
      "Constantes", "Date Arrivée", "Heure Arrivée", "Statut actuel", "Créé le"
    ];
    const rows = urgences.map(u => [
      u.id || "",
      u.patient || "",
      u.contact || "",
      u.severite || "",
      u.plainte || "",
      u.constantes || "",
      u.dateArrivee || "",
      u.heureArrivee || "",
      u.statut || "",
      u.createdAt || ""
    ]);
    downloadCSV(headers, rows, `cabinet-deogracias-urgences-${getTodayStr()}.csv`);
  };

  const exportPediatrie = () => {
    if (!pediatrie || pediatrie.length === 0) {
      alert("Aucune donnée pédiatrique disponible pour l'exportation.");
      return;
    }
    const headers = [
      "ID", "Patient", "Age (Mois)", "Contact Parents", "Poids (kg)", 
      "Taille (cm)", "Périmètre Brachial (PB)", "Oedèmes", "Statut Nutritionnel", 
      "Vaccins à Jour", "Alimentation", "Diagnostic", "Date Fiche", "Créé le"
    ];
    const rows = pediatrie.map(p => [
      p.id || "",
      p.patient || "",
      String(p.ageMois ?? ""),
      p.contact || "",
      String(p.poids ?? ""),
      String(p.taille ?? ""),
      String(p.pb ?? ""),
      p.oedemes ? "Oui" : "Non",
      p.statutNutritionnel || "",
      p.vaccinsAJour ? "Oui" : "Non",
      p.alimentation || "",
      p.diagnostic || "",
      p.date || "",
      p.createdAt || ""
    ]);
    downloadCSV(headers, rows, `cabinet-deogracias-pediatrie-${getTodayStr()}.csv`);
  };

  const exportMaternite = () => {
    if (!materniteCpns || materniteCpns.length === 0) {
      alert("Aucune donnée de suivi prénatal disponible pour l'exportation.");
      return;
    }
    const headers = [
      "ID", "Patiente", "Contact", "DDR", "SA", "DPA", 
      "Date Visite", "Numéro de Visite", "Poids (kg)", "Tension (TA)", 
      "Albuminurie", "Fer/Acide Folique", "MILD", "Notes/Observations", "Créé le"
    ];
    const rows = materniteCpns.map(m => [
      m.id || "",
      m.patient || "",
      m.contact || "",
      m.ddr || "",
      String(m.sa ?? ""),
      m.dpa || "",
      m.dateVisite || "",
      m.numeroVisite || "",
      String(m.poids ?? ""),
      m.ta || "",
      m.albuminurie || "",
      m.ferAcideFolique ? "Oui" : "Non",
      m.mild ? "Oui" : "Non",
      m.notes || "",
      m.createdAt || ""
    ]);
    downloadCSV(headers, rows, `cabinet-deogracias-maternite-${getTodayStr()}.csv`);
  };

  const exportFactures = () => {
    if (!factures || factures.length === 0) {
      alert("Aucune donnée de facturation disponible pour l'exportation.");
      return;
    }
    const headers = [
      "ID", "Patient", "Date Facture", "Mode de Paiement", 
      "Total (FCFA)", "Montant Payé (FCFA)", "Statut de Paiement", "Désignations", "Créé le"
    ];
    const rows = factures.map(f => [
      f.id || "",
      f.patient || "",
      f.date || "",
      f.mode || "",
      String(f.total ?? ""),
      String(f.montantPaye ?? ""),
      f.statut || "",
      f.lignes?.map(l => `${l.designation} (${l.qte}x ${l.prix} FCFA)`).join(" | ") || "",
      f.createdAt || ""
    ]);
    downloadCSV(headers, rows, `cabinet-deogracias-factures-${getTodayStr()}.csv`);
  };

  const exportDepenses = () => {
    if (!depenses || depenses.length === 0) {
      alert("Aucune donnée de dépenses disponible pour l'exportation.");
      return;
    }
    const headers = [
      "ID", "Libellé", "Montant (FCFA)", "Date", "Catégorie", "Mode de Règlement", "Créé le"
    ];
    const rows = depenses.map(d => [
      d.id || "",
      d.libelle || "",
      String(d.montant ?? ""),
      d.date || "",
      d.categorie || "",
      d.mode || "",
      d.createdAt || ""
    ]);
    downloadCSV(headers, rows, `cabinet-deogracias-depenses-${getTodayStr()}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Top Tabs */}
      <div className="flex gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => {
            setActiveTab("clinique");
            setDocCategorie("Scan Radio");
            setActiveCategoryFilter("Tous");
          }}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "clinique"
              ? "bg-primary-600 text-white shadow-md"
              : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
          }`}
        >
          Archives Cliniques
        </button>
        <button
          onClick={() => {
            setActiveTab("administratif");
            setDocCategorie("Document Administratif");
            setActiveCategoryFilter("Tous");
          }}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "administratif"
              ? "bg-info-600 text-white shadow-md"
              : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
          }`}
        >
          Coffre-fort Administratif
        </button>
        <button
          onClick={() => {
            setActiveTab("exports");
            setActiveCategoryFilter("Tous");
          }}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "exports"
              ? "bg-stone-800 text-white shadow-md"
              : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
          }`}
        >
          Exports & Backups
        </button>
        <button
          onClick={() => {
            setActiveTab("logs");
          }}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "logs"
              ? "bg-orange-600 text-white shadow-md"
              : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200"
          }`}
        >
          Logs & Conformité
        </button>
      </div>

      {activeTab === "clinique" && (
        <>
          {/* Visual Header Note */}
          <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center gap-4 animate-fade-in">
            <File className="w-8 h-8 text-primary-700 flex-shrink-0" />
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">Archives Cliniques (Dossiers Patients)</h3>
              <p className="text-xs text-stone-500 font-medium mt-1">
                Numérisez les ordonnances externes, les lettres de recommandation, ou les scans radiologiques. 
                <strong> Traitement intelligent en local :</strong> les images sont compressées à la volée sur le navigateur.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Upload form */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4">
              <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Indexer un Document Clinique
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block">Dossier patient *</label>
                {docPatient.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery(docPatient.trim())}
                    className="text-xs text-primary-600 font-bold hover:text-primary-700 hover:underline flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    Afficher ses documents
                  </button>
                )}
              </div>
              <input
                type="text"
                list="patients-list"
                placeholder="Rechercher ou saisir un patient..."
                value={docPatient}
                onChange={(e) => {
                   setDocPatient(e.target.value);
                   // Optionally auto-filter list when picking a patient from datalist
                   if (knownPatients.includes(e.target.value)) {
                     setSearchQuery(e.target.value);
                   }
                }}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
              <datalist id="patients-list">
                {knownPatients.map((p, idx) => (
                  <option key={idx} value={p} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Intitulé / Nom du document *</label>
                <input
                  type="text"
                  placeholder="Ex: Bilan Sanguin NFS Laboratoire Bobo"
                  value={docTitre}
                  onChange={(e) => setDocTitre(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Catégorie du document</label>
                <select
                  value={docCategorie}
                  onChange={(e) => setDocCategorie(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Facture">💰 Facture</option>
                  <option value="Compte-rendu">📄 Compte-rendu</option>
                  <option value="Ordonnance">🧾 Ordonnance</option>
                  <option value="Scan Radio">📸 Scan / Radio</option>
                  <option value="Certificat">📜 Certificat Médical</option>
                  <option value="Document Administratif">💼 Document Administratif</option>
                  <option value="Autre">📁 Autre</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Description / Notes d'indexation</label>
              <textarea
                placeholder="Ex: Échographie de datation T1 de la clinique Suka..."
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-14 resize-none"
              />
            </div>

            {/* Drag and Drop with compression */}
            <div className="pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1.5">
                  Scanner d'image (Glisser / Choisir) *
                </label>
                <button
                  type="button"
                  onClick={() => setShowCamera(!showCamera)}
                  className="text-xs font-black text-primary-700 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <Camera className="w-3 h-3" />
                  {showCamera ? "Fermer la caméra" : "Ouvrir la caméra"}
                </button>
              </div>

              {showCamera && (
                <div className="mb-3">
                  <CameraCapture
                    onCapture={(photo) => {
                      setBase64Preview(photo);
                      setShowCamera(false);
                    }}
                    onClose={() => setShowCamera(false)}
                  />
                </div>
              )}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                  dragActive ? "border-primary-500 bg-primary-50" : "border-stone-300 bg-stone-50/50 hover:bg-stone-50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  className="hidden"
                />
                <UploadCloud className="w-7 h-7 text-stone-500 dark:text-stone-400" />
                {isCompressing ? (
                  <span className="text-xs text-primary-700 font-bold animate-pulse">Compression en cours...</span>
                ) : base64Preview ? (
                  <span className="text-sm text-success-700 font-semibold">🟢 Document chargé & compressé</span>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-stone-600">Sélectionnez, Glissez, ou Collez (Ctrl+V) le fichier</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">Tous types de fichiers (PDF, Images, Documents, Taille illimitée)</span>
                  </>
                )}
              </div>
            </div>

            {/* Base64 miniature preview thumbnail */}
            {base64Preview && (
              <div className="bg-stone-50 p-2 rounded-xl border border-stone-200 flex items-center justify-between gap-3 shadow-2xs">
                {uploadFileType && uploadFileType.startsWith("image/") ? (
                  <img
                    src={base64Preview}
                    alt="Miniature compressée"
                    className="w-12 h-12 object-cover rounded-lg border border-stone-300"
                  />
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-info-100 text-info-500 rounded-lg border border-info-200">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs text-stone-800 font-bold truncate max-w-[150px]">{uploadFileName || "Document"}</span>
                  <span className="text-2xs text-stone-500 dark:text-stone-400">{uploadFileType && uploadFileType.startsWith("image/") ? "Image compressée" : "Document"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBase64Preview("");
                    setUploadFileType("");
                    setUploadFileName("");
                  }}
                  className="text-stone-500 dark:text-stone-400 hover:text-danger-600 font-bold text-xs p-1"
                >
                  Supprimer
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveDocument}
              className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2"
            >
              Archiver numériquement le document
            </button>
          </div>
        </div>

        {/* List of documents and current active preview overlays */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
          <div className="border-b border-stone-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <File className="w-5 h-5 text-primary-700" />
              Registre des Archives Médicales Numérisées
            </h3>

            <div className="relative w-full md:w-48">
              <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Chercher patient/titre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {cliniqueCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                  activeCategoryFilter === cat
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {finalCliniqueDocs.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun document clinique trouvé.</p>
          ) : (
            <div className="w-full">
              {/* Document items list */}
              <div className="max-h-[480px] overflow-y-auto pr-1 border border-stone-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-stone-50 z-10 shadow-xs">
                    <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500 font-bold">
                      <th className="p-3">Doc.</th>
                      <th className="p-3">Titre & Patient</th>
                      <th className="p-3">Catégorie</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {finalCliniqueDocs.map((d) => (
                      <tr
                        key={d.id}
                        className={`cursor-pointer transition-all hover:bg-stone-50 ${
                          activePreviewDoc?.id === d.id ? "bg-primary-50/50" : ""
                        }`}
                        onClick={() => handlePreviewDoc(d)}
                      >
                        <td className="p-3">
                          {(d.fileType && !d.fileType.startsWith("image/")) ? (
                            <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-info-100 text-info-500 rounded-lg border border-info-200">
                              <FileText className="w-4 h-4" />
                            </div>
                          ) : (
                            <img
                              src={d.base64Data}
                              alt={d.titre}
                              className="w-8 h-8 object-cover rounded-lg border border-stone-200 flex-shrink-0"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-stone-900 truncate max-w-[120px]" title={d.titre}>
                            {d.titre}
                          </div>
                          <div className="text-xs text-stone-500 truncate max-w-[120px]" title={d.patient}>
                            {d.patient}
                          </div>
                        </td>
                        <td className="p-3 text-xs font-bold text-primary-700 uppercase">
                          {d.categorie}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteDoc(d.id);
                            }}
                            className="text-stone-500 dark:text-stone-400 hover:text-danger-600 p-1 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          )}
        </div>
      </div>
        </>
      )}

      {activeTab === "administratif" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-info-50 border border-info-200 p-5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center gap-4">
            <Database className="w-8 h-8 text-info-700 flex-shrink-0" />
            <div>
              <h3 className="text-base font-serif font-bold text-info-900">Coffre-fort d'Archivage Administratif</h3>
              <p className="text-xs text-info-700 font-medium mt-1">
                Protégez vos documents de service (Factures fournisseurs, contrats, mémos internes).
                Les documents sont chiffrés et sauvegardés numériquement en toute sécurité.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4">
              <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
                <Plus className="w-5 h-5 text-info-700" />
                Archiver un Document de Service
              </h3>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Intitulé / Nom du document *</label>
                    <input
                      type="text"
                      placeholder="Ex: Facture Pharmacie Centrale, Contrat..."
                      value={docTitre}
                      onChange={(e) => setDocTitre(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Catégorie du document</label>
                    <select
                      value={docCategorie}
                      onChange={(e) => setDocCategorie(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                    >
                      <option value="Document Administratif">💼 Document Administratif Interne</option>
                      <option value="Facture Fournisseur">🧾 Facture Fournisseur</option>
                      <option value="Contrat">🤝 Contrat / Convention</option>
                      <option value="Mémo">📝 Mémo / Note de Service</option>
                      {isHR && (
                        <option value="Dossier RH">👥 Dossier Ressources Humaines</option>
                      )}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Notes Additionnelles</label>
                  <textarea
                    placeholder="Mois de Mars, réglé par chèque..."
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-14 resize-none"
                  />
                </div>

                {/* Drag and Drop with compression */}
                <div className="pt-2 border-t border-stone-100">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1.5">
                      Scanner d'image (Glisser / Choisir) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCamera(!showCamera)}
                      className="text-xs font-black text-info-700 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3 h-3" />
                      {showCamera ? "Fermer la caméra" : "Ouvrir la caméra"}
                    </button>
                  </div>

                  {showCamera && (
                    <div className="mb-3">
                      <CameraCapture
                        onCapture={(photo) => {
                          setBase64Preview(photo);
                          setShowCamera(false);
                        }}
                        onClose={() => setShowCamera(false)}
                      />
                    </div>
                  )}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                      dragActive ? "border-info-500 bg-info-50" : "border-stone-300 bg-stone-50/50 hover:bg-stone-50"
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                      className="hidden"
                    />
                    <UploadCloud className="w-7 h-7 text-stone-500 dark:text-stone-400" />
                    {isCompressing ? (
                      <span className="text-xs text-info-700 font-bold animate-pulse">Compression en cours...</span>
                    ) : base64Preview ? (
                      <span className="text-sm text-success-700 font-semibold">🟢 Document chargé & compressé</span>
                    ) : (
                      <>
                        <span className="text-xs font-semibold text-stone-600">Sélectionnez, Glissez, ou Collez (Ctrl+V) le fichier</span>
                        <span className="text-xs text-stone-500 dark:text-stone-400">Tous types de fichiers (PDF, Images, Documents, Taille illimitée)</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Base64 miniature preview thumbnail */}
                {base64Preview && (
                  <div className="bg-stone-50 p-2 rounded-xl border border-stone-200 flex items-center justify-between gap-3 shadow-2xs">
                    {uploadFileType && uploadFileType.startsWith("image/") ? (
                      <img
                        src={base64Preview}
                        alt="Miniature compressée"
                        className="w-12 h-12 object-cover rounded-lg border border-stone-300"
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-info-100 text-info-500 rounded-lg border border-info-200">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs text-stone-800 font-bold truncate max-w-[150px]">{uploadFileName || "Document"}</span>
                      <span className="text-2xs text-stone-500 dark:text-stone-400">{uploadFileType && uploadFileType.startsWith("image/") ? "Image compressée" : "Document"}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBase64Preview("");
                        setUploadFileType("");
                        setUploadFileName("");
                      }}
                      className="text-stone-500 dark:text-stone-400 hover:text-danger-600 font-bold text-xs p-1"
                    >
                      Supprimer
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!docTitre.trim() || !base64Preview) {
                      alert("Veuillez renseigner le titre du document et charger un fichier image.");
                      return;
                    }
                    const newDoc = {
                      id: 'DOC-' + Math.random().toString(36).substr(2, 9),
                      titre: docTitre.trim(),
                      patient: "SERVICE",
                      categorie: docCategorie,
                      dateUpload: getTodayStr(),
                      description: docDescription.trim(),
                      base64Data: base64Preview,
                      fileType: uploadFileType,
                      fileName: uploadFileName,
                      createdAt: new Date().toISOString()
                    };
                    onUpdateDocuments([newDoc, ...documents]);
                    setAuditLogs(prev => [{
                      id: 'AUD-' + Math.random().toString(36).substr(2, 9),
                      action: "AJOUT",
                      docId: newDoc.id,
                      docTitre: newDoc.titre,
                      user: currentUser?.nom || "Admin",
                      timestamp: newDoc.createdAt
                    }, ...prev]);
                    setDocTitre("");
                    setDocDescription("");
                    setBase64Preview("");
                    alert("Document administratif sécurisé dans le coffre-fort avec succès.");
                  }}
                  className="w-full text-xs font-bold py-2 bg-info-600 hover:bg-info-700 text-white rounded-lg transition-all mt-2"
                >
                  Sécuriser dans le coffre
                </button>
              </div>
            </div>

            {/* List of admin documents */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
              <div className="border-b border-stone-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-info-700" />
                  Archives Internes Sécurisées
                </h3>

                <div className="relative w-full md:w-48">
                  <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Recherche interne..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-2">
                {adminCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                      activeCategoryFilter === cat
                        ? "bg-info-600 text-white shadow-sm"
                        : "bg-info-50 text-info-700 hover:bg-info-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {finalAdminDocs.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun document administratif sécurisé.</p>
              ) : (
                <div className="w-full">
              {/* Document items list */}
              <div className="max-h-[480px] overflow-y-auto pr-1 border border-stone-200 rounded-xl bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-stone-50 z-10 shadow-xs">
                        <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500 font-bold">
                          <th className="p-3">Doc.</th>
                          <th className="p-3">Titre</th>
                          <th className="p-3">Catégorie</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {finalAdminDocs.map((d) => (
                          <tr
                            key={d.id}
                            className={`cursor-pointer transition-all hover:bg-stone-50 ${
                              activePreviewDoc?.id === d.id ? "bg-info-50/50" : ""
                            }`}
                            onClick={() => handlePreviewDoc(d)}
                          >
                            <td className="p-3">
                              {(d.fileType && !d.fileType.startsWith("image/")) ? (
                                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-info-100 text-info-500 rounded-lg border border-info-200">
                                  <FileText className="w-4 h-4" />
                                </div>
                              ) : (
                                <img
                                  src={d.base64Data}
                                  alt={d.titre}
                                  className="w-8 h-8 object-cover rounded-lg border border-stone-200 flex-shrink-0"
                                />
                              )}
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-stone-900 truncate max-w-[120px]" title={d.titre}>
                                {d.titre}
                              </div>
                              <div className="text-xs text-stone-500 truncate max-w-[120px] italic">
                                {d.description || "..."}
                              </div>
                            </td>
                            <td className="p-3 text-xs font-bold text-info-700 uppercase">
                              {d.categorie}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDoc(d.id);
                                }}
                                className="text-stone-500 dark:text-stone-400 hover:text-danger-600 p-1 rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
            </div>

              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "exports" && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-5 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-stone-100 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-primary-50 p-2 rounded-xl text-primary-700 border border-primary-100">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-serif font-bold text-stone-900">Centre d'Exportation & Sauvegardes Cliniques (CSV)</h3>
              <p className="text-xs text-stone-500 font-medium">
                Téléchargez les registres de l'établissement sous format CSV encodé en UTF-8 pour tableurs (Excel, LibreOffice).
              </p>
            </div>
          </div>
          <span className="bg-stone-100 text-stone-600 font-mono text-xs uppercase font-bold px-3 py-1 rounded-full border border-stone-200 self-start md:self-auto">
            Générateur Local Sécurisé
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* consultations Card */}
          <div className="border border-stone-200 rounded-2xl p-4 hover:border-primary-500/40 bg-stone-50/30 transition-all flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="bg-primary-100/60 text-primary-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg">
                  Médical
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400 font-mono font-bold">
                  {consultations.length} {consultations.length > 1 ? "fiches" : "fiche"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary-600" />
                Registre des Consultations
              </h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Historique des visites cliniques, constantes vitales (poids, tension, pouls, glycémie, température), diagnostics et ordonnances prescrites.
              </p>
            </div>
            <button
              onClick={exportConsultations}
              className="w-full text-xs font-bold py-2 bg-white border border-stone-200 hover:border-primary-600 hover:bg-primary-50/20 text-stone-700 hover:text-primary-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (.csv)
            </button>
          </div>

          {/* Hospitalisations Card */}
          <div className="border border-stone-200 rounded-2xl p-4 hover:border-primary-500/40 bg-stone-50/30 transition-all flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="bg-success-100/60 text-success-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg">
                  Hospitalier
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400 font-mono font-bold">
                  {hospitalisations.length} {hospitalisations.length > 1 ? "fiches" : "fiche"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-success-600" />
                Registre des Hospitalisations
              </h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Liste des admissions, motifs d'admission, lits attribués, suivi clinique, médecins responsables et diagnostics de sortie officiels.
              </p>
            </div>
            <button
              onClick={exportHospitalisations}
              className="w-full text-xs font-bold py-2 bg-white border border-stone-200 hover:border-primary-600 hover:bg-primary-50/20 text-stone-700 hover:text-primary-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (.csv)
            </button>
          </div>

          {/* Urgences Card */}
          <div className="border border-stone-200 rounded-2xl p-4 hover:border-primary-500/40 bg-stone-50/30 transition-all flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="bg-warning-100/60 text-warning-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg">
                  Urgences
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400 font-mono font-bold">
                  {urgences.length} {urgences.length > 1 ? "fiches" : "fiche"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-warning-600" />
                Registre des Urgences (Triage)
              </h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Rapports de triage d'urgences, gravité (critique, vital, vert), symptômes initiaux constatés et parcours clinique du patient.
              </p>
            </div>
            <button
              onClick={exportUrgences}
              className="w-full text-xs font-bold py-2 bg-white border border-stone-200 hover:border-primary-600 hover:bg-primary-50/20 text-stone-700 hover:text-primary-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (.csv)
            </button>
          </div>

          {/* Pédiatrie Card */}
          <div className="border border-stone-200 rounded-2xl p-4 hover:border-primary-500/40 bg-stone-50/30 transition-all flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="bg-info-100/60 text-info-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg">
                  Pédiatrie
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400 font-mono font-bold">
                  {pediatrie.length} {pediatrie.length > 1 ? "fiches" : "fiche"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-info-600" />
                Fiches Pédiatriques
              </h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Surveillance de croissance, périmètre brachial, œdèmes bilatéraux, statuts nutritionnels infantiles et statuts de vaccination.
              </p>
            </div>
            <button
              onClick={exportPediatrie}
              className="w-full text-xs font-bold py-2 bg-white border border-stone-200 hover:border-primary-600 hover:bg-primary-50/20 text-stone-700 hover:text-primary-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (.csv)
            </button>
          </div>

          {/* Maternité CPN Card */}
          <div className="border border-stone-200 rounded-2xl p-4 hover:border-primary-500/40 bg-stone-50/30 transition-all flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="bg-danger-100/60 text-danger-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg">
                  Maternité
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400 font-mono font-bold">
                  {materniteCpns.length} {materniteCpns.length > 1 ? "fiches" : "fiche"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-danger-600" />
                Consultations Prénatales (CPN)
              </h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Suivi de grossesse, dates de dernières règles (DDR), âge gestationnel (SA), date d'accouchement prévue (DPA), poids et tensions de la patiente.
              </p>
            </div>
            <button
              onClick={exportMaternite}
              className="w-full text-xs font-bold py-2 bg-white border border-stone-200 hover:border-primary-600 hover:bg-primary-50/20 text-stone-700 hover:text-primary-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (.csv)
            </button>
          </div>

          {/* Financial: Factures Card */}
          <div className="border border-stone-200 rounded-2xl p-4 hover:border-primary-500/40 bg-stone-50/30 transition-all flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="bg-success-100/60 text-success-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg">
                  Finances
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400 font-mono font-bold">
                  {factures.length} {factures.length > 1 ? "factures" : "facture"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-success-600" />
                Journal des Factures Patients
              </h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Registre comptable des encaissements, modes de paiement (espèce, assurance, orange money), montants totaux, et statuts de règlement.
              </p>
            </div>
            <button
              onClick={exportFactures}
              className="w-full text-xs font-bold py-2 bg-white border border-stone-200 hover:border-primary-600 hover:bg-primary-50/20 text-stone-700 hover:text-primary-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (.csv)
            </button>
          </div>

          {/* Financial: Dépenses Card */}
          <div className="border border-stone-200 rounded-2xl p-4 hover:border-primary-500/40 bg-stone-50/30 transition-all flex flex-col justify-between space-y-3 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="bg-danger-100/60 text-danger-800 text-xs font-semibold uppercase px-2 py-0.5 rounded-lg">
                  Finances
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400 font-mono font-bold">
                  {depenses.length} {depenses.length > 1 ? "dépenses" : "dépense"}
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-danger-600" />
                Journal des Dépenses de Fonctionnement
              </h4>
              <p className="text-sm text-stone-500 leading-relaxed">
                Registre des décaissements et achats de l'établissement (fournisseurs, électricité, consommables) pour l'équilibre de la balance comptable.
              </p>
            </div>
            <button
              onClick={exportDepenses}
              className="w-full text-xs font-bold py-2 bg-white border border-stone-200 hover:border-primary-600 hover:bg-primary-50/20 text-stone-700 hover:text-primary-700 rounded-lg transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter (.csv)
            </button>
          </div>
        </div>

        <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 text-xs text-stone-600 flex flex-col sm:flex-row items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-primary-600 flex-shrink-0" />
          <p className="text-sm">
            <strong>Astuce de conformité :</strong> Lors de l'ouverture d'un fichier exporté dans <strong>Microsoft Excel</strong>, veillez à sélectionner le codage <strong>Unicode (UTF-8)</strong> et la virgule comme séparateur de champ afin que tous les caractères accentués s'affichent correctement.
          </p>
        </div>
      </div>
      )}

      {activeTab === "logs" && (
        <div className="animate-fade-in space-y-6">
          <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center gap-4">
            <ShieldAlert className="w-8 h-8 text-orange-700 flex-shrink-0" />
            <div>
              <h3 className="text-base font-serif font-bold text-orange-900">Journaux d'Audit & Conformité</h3>
              <p className="text-xs text-orange-700 font-medium mt-1">
                Trace d'activité inaltérable. Historique des consultations et ajouts de documents pour répondre aux exigences de traçabilité médicale.
              </p>
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500 font-bold">
                    <th className="p-3">Horodatage</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Utilisateur</th>
                    <th className="p-3">Document Cible</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-stone-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-stone-500 dark:text-stone-400 italic">
                        Aucun journal d'activité enregistré pour le moment.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                        <td className="p-3 whitespace-nowrap text-stone-500 font-mono">
                          {new Date(log.timestamp).toLocaleString("fr-FR")}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-bold uppercase ${
                            log.action === "AJOUT" ? "bg-primary-100 text-primary-800" : "bg-info-100 text-info-800"
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-stone-700">
                          {log.user}
                        </td>
                        <td className="p-3 font-semibold text-stone-900 truncate max-w-[200px]" title={log.docTitre}>
                          {log.docTitre}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-stone-900">Confirmer la suppression</h3>
            <p className="text-sm text-stone-600">
              Êtes-vous sûr de vouloir supprimer définitivement ce document archivé ? Cette action est irréversible.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={cancelDeleteDoc}
                className="px-4 py-2 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmDeleteDoc}
                className="px-4 py-2 text-sm font-bold text-white bg-danger-600 hover:bg-danger-700 rounded-lg transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}