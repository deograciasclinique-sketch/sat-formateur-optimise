/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { ExamenLabo, Staff, Consultation, Medicament } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Printer, MessageCircle, Search, FlaskConical, CheckCircle, FileText, X, Beaker, AlertTriangle, Eye } from "lucide-react";

interface TabLaboProps {
  consultations?: Consultation[];
  examens: ExamenLabo[];
  staff: Staff[];
  onUpdateExamens: (examens: ExamenLabo[]) => void;
  // Cahier des charges point 6.2 : les réactifs/consommables de laboratoire
  // sont gérés dans le même stock que la pharmacie, mais listés ici pour le
  // labo (lecture seule — la gestion des entrées/seuils reste en Pharmacie).
  medicaments?: Medicament[];
  // Permet d'ajouter/retirer des réactifs et consommables directement depuis
  // le module Laboratoire, sans devoir passer par la Pharmacie.
  onUpdateMedicaments?: (meds: Medicament[]) => void;
}

export default function TabLabo({ examens, staff, onUpdateExamens, consultations = [], medicaments = [], onUpdateMedicaments }: TabLaboProps) {
  // Load dynamic clinic profile from LocalStorage safely
  
  const [showUrgentAlert, setShowUrgentAlert] = useState(false);
  const [urgentExamsCount, setUrgentExamsCount] = useState(0);
  const prevExamensRef = useRef<ExamenLabo[]>([]);

  useEffect(() => {
    // Check for newly added urgent exams in "En attente"
    const prevExamens = prevExamensRef.current;
    const currentUrgentPending = examens.filter(e => e.statut === "En attente" && e.priorite === "urgente");
    const prevUrgentPendingIds = prevExamens.filter(e => e.statut === "En attente" && e.priorite === "urgente").map(e => e.id);
    
    const newUrgentExams = currentUrgentPending.filter(e => !prevUrgentPendingIds.includes(e.id));
    
    if (newUrgentExams.length > 0) {
      setShowUrgentAlert(true);
      setUrgentExamsCount(currentUrgentPending.length);
      
      // Play a sound (using a reliable generic beep or hospital ping)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5);
      } catch (e) {
        console.warn("AudioContext non supporté ou bloqué");
      }
      
      // Auto-hide alert banner after 10 seconds (or user can close it)
      const timer = setTimeout(() => {
        setShowUrgentAlert(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
    
    // Update ref
    prevExamensRef.current = examens;
  }, [examens]);

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

  // Exam Request Form states
  const [examPatient, setExamPatient] = useState("");
  const [examContact, setExamContact] = useState("");
  const [examDateDemande, setExamDateDemande] = useState(getTodayStr());
  const [examPrescripteur, setExamPrescripteur] = useState("");
  const [examAnalyses, setExamAnalyses] = useState<string[]>([]);
  const [examUrgent, setExamUrgent] = useState(false);
  const [examAnalysesCustom, setExamAnalysesCustom] = useState("");

  // Exam result completion states
  const [selectedExamId, setSelectedExamId] = useState("");
  const [examTechnicien, setExamTechnicien] = useState("");
  const [examResultat, setExamResultat] = useState("");
  const [examInterpretation, setExamInterpretation] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"operations" | "historique" | "reactifs" | "procedures">("operations");

  // Liste des réactifs/consommables de laboratoire, triée par ordre alphabétique
  // (cahier des charges : les réactifs du labo doivent être listés au niveau du
  // laboratoire, séparément des médicaments/consommables prescrits en consultation).
  const reactifsLabo = React.useMemo(() => {
    return medicaments
      .filter((m) => m.typeArticle === "Réactif de laboratoire")
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [medicaments]);

  // Normalise un nom pour regrouper les examens par patient de façon fiable
  // (casse, accents, espaces) — même principe que le registre de consultation.
  const normalizePatientName = (name: string): string =>
    (name || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

  // Regroupement du registre d'examens par patient (cahier des charges) : le
  // nom d'un patient n'apparaît qu'une seule fois, avec la suite de tous ses
  // examens de laboratoire.
  const patientExamDossiers = React.useMemo(() => {
    const map = new Map<string, {
      key: string;
      patient: string;
      contact: string;
      lastDate: string;
      exams: ExamenLabo[];
    }>();

    [...examens]
      .sort((a, b) => a.dateDemande.localeCompare(b.dateDemande))
      .forEach((e) => {
        const key = normalizePatientName(e.patient);
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, { key, patient: e.patient, contact: e.contact || "", lastDate: e.dateDemande, exams: [] });
        }
        const entry = map.get(key)!;
        entry.exams.unshift(e);
        if (e.dateDemande >= entry.lastDate) {
          entry.lastDate = e.dateDemande;
          entry.patient = e.patient;
          entry.contact = e.contact || entry.contact;
        }
      });

    return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [examens]);

  const [viewingLaboPatientKey, setViewingLaboPatientKey] = useState<string | null>(null);
  const viewingLaboPatientDossier = patientExamDossiers.find((p) => p.key === viewingLaboPatientKey) || null;

  // Formulaire d'ajout de réactif/consommable directement depuis le Laboratoire
  const [reactifNom, setReactifNom] = useState("");
  const [reactifPresentation, setReactifPresentation] = useState("");
  const [reactifStock, setReactifStock] = useState("");
  const [reactifSeuil, setReactifSeuil] = useState("");
  const [reactifFournisseur, setReactifFournisseur] = useState("");

  const handleAddReactif = () => {
    if (!onUpdateMedicaments) return;
    if (!reactifNom.trim()) {
      alert("Veuillez renseigner le nom du réactif ou consommable.");
      return;
    }
    const stock = parseFloat(reactifStock) || 0;
    const seuil = parseFloat(reactifSeuil) || 5;

    const newReactif: Medicament = {
      id: generateUid(),
      nom: reactifNom.trim(),
      forme: reactifPresentation.trim() || "—",
      dosage: "",
      categorie: "Réactif de laboratoire",
      typeArticle: "Réactif de laboratoire",
      stock,
      seuil,
      prixAchat: 0,
      prixVente: 0,
      peremption: "",
      fournisseur: reactifFournisseur.trim(),
      createdAt: new Date().toISOString()
    };

    onUpdateMedicaments([newReactif, ...medicaments]);
    setReactifNom("");
    setReactifPresentation("");
    setReactifStock("");
    setReactifSeuil("");
    setReactifFournisseur("");
  };

  const handleDeleteReactif = (id: string) => {
    if (!onUpdateMedicaments) return;
    if (confirm("Supprimer ce réactif/consommable de laboratoire ?")) {
      onUpdateMedicaments(medicaments.filter((m) => m.id !== id));
    }
  };

  // Génération de procédure d'examen assistée par IA
  const [procedureExamen, setProcedureExamen] = useState("");
  const [procedureResult, setProcedureResult] = useState<string | null>(null);
  const [isGeneratingProcedure, setIsGeneratingProcedure] = useState(false);
  const [procedureError, setProcedureError] = useState<string | null>(null);

  const handleGenerateProcedure = async () => {
    if (!procedureExamen.trim()) {
      alert("Veuillez saisir le nom de l'examen.");
      return;
    }
    setIsGeneratingProcedure(true);
    setProcedureError(null);
    setProcedureResult(null);
    try {
      const response = await fetch("/api/gemini/lab-procedure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examen: procedureExamen.trim() })
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Impossible de lire la réponse du serveur.");
      }
      if (!response.ok || data.error) {
        throw new Error(data.error || "Erreur serveur : vérifiez que la clé API Gemini est bien configurée.");
      }
      setProcedureResult(data.procedure || "");
    } catch (error: any) {
      console.error(error);
      setProcedureError(error.message || "Erreur lors de la génération de la procédure.");
    } finally {
      setIsGeneratingProcedure(false);
    }
  };

  const handlePrintProcedure = () => {
    if (!procedureResult) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Procédure — ${procedureExamen}</title>
          <style>
            body { font-family: Helvetica, Arial, sans-serif; padding: 30px; color: #1c1917; line-height: 1.6; }
            h1 { color: #0d9488; font-size: 18px; }
            h2 { color: #0d9488; font-size: 14px; margin-top: 20px; }
            @media print { body { padding: 10px; } }
          </style>
        </head>
        <body>
          <h1>Procédure de laboratoire — ${procedureExamen}</h1>
          <div>${procedureResult
            .replace(/^## (.*)$/gm, "<h2>$1</h2>")
            .replace(/\n/g, "<br/>")}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const filteredPatientExamDossiers = patientExamDossiers.filter((p) => {
    const q = historySearchQuery.toLowerCase().trim();
    if (!q) return true;
    return p.patient.toLowerCase().includes(q) || (p.contact && p.contact.includes(q));
  });
  const [viewingConsultation, setViewingConsultation] = useState<Consultation | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<"contexte" | "historique">("contexte");
  const [viewingPatient, setViewingPatient] = useState<string>("");
  const [printingExam, setPrintingExam] = useState<ExamenLabo | null>(null);

  const handleCreateRequest = () => {
    const allAnalyses = [...examAnalyses];
    if (examAnalysesCustom.trim()) {
      allAnalyses.push(examAnalysesCustom.trim());
    }
    const finalAnalysesStr = allAnalyses.join(" + ");

    if (!examPatient.trim() || !finalAnalysesStr) {
      alert("Veuillez renseigner le patient et au moins une analyse demandée.");
      return;
    }

    const newExam: ExamenLabo = {
      id: generateUid(),
      patient: examPatient.trim(),
      contact: examContact.trim(),
      dateDemande: examDateDemande || getTodayStr(),
      prescripteur: examPrescripteur,
      analyses: finalAnalysesStr,
      priorite: examUrgent ? "urgente" : "normale",
      statut: "En attente",
      resultat: "",
      interpretation: "",
      technicien: "",
      dateResultat: "",
      createdAt: new Date().toISOString()
    };

    onUpdateExamens([newExam, ...examens]);
    setExamPatient("");
    setExamContact("");
    alert("Demande d'examen de laboratoire générée en attente de prélèvement.");
  };

  const handleCompleteResult = () => {
    if (!selectedExamId || !examResultat.trim()) {
      alert("Veuillez choisir un examen et renseigner les valeurs de résultats d'analyse.");
      return;
    }

    const updated = examens.map((e) => {
      if (e.id === selectedExamId) {
        return {
          ...e,
          statut: "Prêt" as const,
          resultat: examResultat.trim(),
          interpretation: examInterpretation.trim(),
          technicien: examTechnicien,
          dateResultat: getTodayStr()
        };
      }
      return e;
    });

    onUpdateExamens(updated);
    setSelectedExamId("");
    setExamResultat("");
    setExamInterpretation("");
    alert("Résultats de laboratoire consignés avec succès.");
  };

  const handleDeleteExam = (id: string) => {
    if (confirm("Supprimer définitivement cette fiche d'examen ?")) {
      onUpdateExamens(examens.filter((e) => e.id !== id));
    }
  };

  
  const handlePrintBonExamen = (examen: ExamenLabo) => {
    const prescriberName = staff.find((s) => s.id === examen.prescripteur)?.nom || "Médecin Prescripteur";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("La fenêtre de téléchargement est bloquée. Veuillez autoriser les pop-ups.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${profile.name} — Bon d'Examen Laboratoire</title>
          <style>
            body { font-family: 'Helvetica', sans-serif; color: #1c1917; padding: 40px; }
            .header { text-align: center; border-bottom: 3px double #0d9488; padding-bottom: 10px; margin-bottom: 30px; }
            .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; color: #0d9488; }
            .subtitle { font-size: 11px; color: #78716c; letter-spacing: 1px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; font-size: 13px; }
            .section-title { font-size: 14px; font-weight: bold; color: #0d9488; border-bottom: 1px solid #e7e5e4; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase; }
            .content-box { background: #f5f5f4; border: 1px dashed #0d9488; padding: 20px; border-radius: 8px; margin-bottom: 30px; font-family: monospace; font-size: 14px; white-space: pre-wrap; }
            .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; font-size: 13px; }
            .signature-box { text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${profile.name}</div>
            <div class="subtitle">${profile.address.toUpperCase()} — TEL: ${profile.phone}</div>
          </div>
          
          <h2 style="text-align: center; font-size: 18px; text-transform: uppercase; margin-bottom: 30px; letter-spacing: 2px;">Bon de Prélèvement Laboratoire</h2>
          
          <div class="meta-grid">
            <div>
              <strong>ID Demande :</strong> LAB-${examen.id.slice(0, 6).toUpperCase()}<br>
              <strong>Date Demande :</strong> ${new Date(examen.dateDemande).toLocaleDateString("fr-FR")}
            </div>
            <div style="text-align: right;">
              <strong>Patient :</strong> ${examen.patient}<br>
              <strong>Contact :</strong> ${examen.contact || "—"}
            </div>
          </div>

          <div class="section-title">Analyses / Examens Demandés</div>
          <div class="content-box">
${examen.analyses || "Aucune analyse spécifiée"}
          </div>

          <div class="signature-grid">
            <div class="signature-box">
              <strong>Le Prescripteur</strong><br>
              <br><br><br>
              ${prescriberName}
            </div>
            <div class="signature-box">
              <strong>Le Laborantin (Visa & Prélèvement)</strong><br>
              <br><br><br>
              ______________________
            </div>
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareWhatsAppLabo = (examen: ExamenLabo) => {
    const text = `Bonjour,\n\nVoici les résultats de votre examen de laboratoire (${examen.examen}) :\n\nConclusion / Résultat :\n${examen.resultat || "En attente"}\n\nDate : ${new Date(examen.dateDemande).toLocaleDateString("fr-FR")}\n\nClinique : ${profile.name}\n\n*Veuillez trouver le PDF du bulletin d'analyse en pièce jointe (si envoyé par la clinique).*`;
    const encoded = encodeURIComponent(text);
    
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handlePrintExam = (examen: ExamenLabo) => {
    const technicianName = staff.find((s) => s.id === examen.technicien)?.nom || "Technicien de Labo";
    const prescriberName = staff.find((s) => s.id === examen.prescripteur)?.nom || "Médecin Prescripteur";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("La fenêtre de téléchargement est bloquée. Veuillez autoriser les pop-ups.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${profile.name} — Bulletin d'Analyse Labo</title>
          <style>
            body { font-family: 'Helvetica', sans-serif; color: #1c1917; padding: 40px; }
            .header { text-align: center; border-bottom: 3px double #0d9488; padding-bottom: 10px; margin-bottom: 30px; }
            .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; color: #0d9488; }
            .subtitle { font-size: 11px; color: #78716c; letter-spacing: 1px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; font-size: 13px; }
            .section-title { font-size: 14px; font-weight: bold; color: #0d9488; border-bottom: 1px solid #e7e5e4; padding-bottom: 5px; margin-bottom: 15px; text-transform: uppercase; }
            .content-box { background: #f5f5f4; border: 1px solid #e7e5e4; padding: 20px; border-radius: 8px; margin-bottom: 30px; font-family: monospace; font-size: 14px; white-space: pre-wrap; }
            .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; font-size: 13px; }
            .signature-box { text-align: center; }
            .stamp { border: 2px dashed #0d9488; color: #0d9488; padding: 15px; border-radius: 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${profile.name}</div>
            <div class="subtitle">${profile.address.toUpperCase()} — TEL: ${profile.phone} — ${profile.slogan.toUpperCase()}</div>
          </div>
          
          <h2 style="text-align: center; font-size: 18px; text-transform: uppercase; margin-bottom: 30px;">Bulletin d'Examen et Résultats de Laboratoire</h2>
          
          <div class="meta-grid">
            <div>
              <strong>Patient :</strong> ${examen.patient}<br>
              <strong>Contact :</strong> ${examen.contact || "—"}<br>
              <strong>Date Demande :</strong> ${new Date(examen.dateDemande).toLocaleDateString("fr-FR")}
            </div>
            <div>
              <strong>Prescripteur :</strong> ${prescriberName}<br>
              <strong>Date de validation :</strong> ${examen.dateResultat ? new Date(examen.dateResultat).toLocaleDateString("fr-FR") : "En attente"}<br>
              <strong>Identifiant Examen :</strong> LAB-${examen.id.slice(0, 6).toUpperCase()}
            </div>
          </div>
          
          <div class="section-title">Analyse réalisée</div>
          <div style="font-size: 15px; font-weight: bold; margin-bottom: 25px;">${examen.analyses}</div>
          
          <div class="section-title">Résultats d'Analyses Biologiques</div>
          <div class="content-box">${examen.resultat || "Analyse en cours d'interprétation..."}</div>
          
          ${examen.interpretation ? `
            <div class="section-title">Interprétation clinique / Conclusions</div>
            <div style="font-size: 13px; font-style: italic; color: #444; margin-bottom: 40px; line-height: 1.5;">${examen.interpretation}</div>
          ` : ""}
          
          <div class="signature-grid">
            <div class="signature-box">
              <strong>Le Praticien Prescripteur</strong><br>
              <div style="font-size: 11px; color: #78716c; margin-top: 5px;">${prescriberName}</div>
            </div>
            <div class="signature-box">
              <strong>Le Technicien Biomédical / Biologiste</strong><br>
              <div style="font-size: 11px; color: #78716c; margin-top: 5px;">${technicianName}</div>
              <div class="stamp">${profile.stampText}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Calculations
  const totalInQueue = examens.filter((e) => e.statut !== "Prêt" && e.statut !== "Validé" && e.statut !== "Résultat disponible").length;
  const readyResultsCount = examens.filter((e) => e.statut === "Prêt").length;
  const currentMonth = getTodayStr().slice(0, 7);
  const examTodayCount = examens.filter((e) => e.dateDemande === getTodayStr()).length;
  const examMonthCount = examens.filter((e) => e.dateDemande.slice(0, 7) === currentMonth).length;

  const filteredExamList = examens
    .filter((e) => e.patient.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.dateDemande.localeCompare(a.dateDemande));

  return (
    <div className="space-y-6">

      {showUrgentAlert && (
        <div className="bg-danger-600 text-white p-4 rounded-xl shadow-lg mb-6 flex items-center justify-between border-2 border-danger-400 animate-pulse-fast">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚨</span>
            <div>
              <h4 className="font-bold text-lg uppercase tracking-wider">Urgence Laboratoire !</h4>
              <p className="text-sm font-semibold opacity-90">Nouvelle(s) demande(s) urgente(s) en attente : {urgentExamsCount}</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setShowUrgentAlert(false)}
            className="bg-danger-800 hover:bg-danger-900 text-white px-4 py-2 rounded-lg font-bold transition-all text-xs border border-danger-500 shadow-sm"
          >
            Fermer l'alerte
          </button>
        </div>
      )}

      <div className="flex bg-stone-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setViewMode("operations")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            viewMode === "operations" 
            ? "bg-white text-primary-800 shadow-xs" 
            : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Opérations & Saisie
        </button>
        <button
          onClick={() => setViewMode("historique")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            viewMode === "historique" 
            ? "bg-white text-primary-800 shadow-xs" 
            : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Historique des examens
        </button>
        <button
          onClick={() => setViewMode("reactifs")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            viewMode === "reactifs" 
            ? "bg-white text-primary-800 shadow-xs" 
            : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Réactifs & Consommables
        </button>
        <button
          onClick={() => setViewMode("procedures")}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            viewMode === "procedures" 
            ? "bg-white text-primary-800 shadow-xs" 
            : "text-stone-500 hover:text-stone-700"
          }`}
        >
          Procédures d'examens (IA)
        </button>
      </div>

      {viewMode === "operations" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{totalInQueue}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">En attente / File</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Prélèvements requis</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-success-600">
          <div className="text-3xl font-semibold text-success-700 font-serif">{readyResultsCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Résultats validés</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Prêts pour impression</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{examTodayCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Demandes Jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Aujourd'hui</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-purple-600">
          <div className="text-3xl font-semibold text-purple-700 font-serif">{examMonthCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Demandes Mois</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Mois en cours</div>
        </div>
      </div>

      {totalInQueue > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 flex items-center gap-3 text-warning-800 text-xs font-bold shadow-2xs">
          <FlaskConical className="w-5 h-5 text-warning-600 flex-shrink-0" />
          <div>
            Biologie Clinique : Il y a actuellement <strong>{totalInQueue} examen(s) en attente</strong> de saisie de résultats. Veuillez effectuer les prélèvements et renseigner les conclusions biologiques.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Request exam form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Demande d'Examen Biologique
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Patient *</label>
                <input
                  type="text"
                  placeholder="Prénom Nom"
                  value={examPatient}
                  onChange={(e) => setExamPatient(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Téléphone</label>
                <input
                  type="tel"
                  placeholder="+226..."
                  value={examContact}
                  onChange={(e) => setExamContact(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date Demande</label>
                <input
                  type="date"
                  value={examDateDemande}
                  onChange={(e) => setExamDateDemande(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Prescripteur / Demandeur</label>
                <select
                  value={examPrescripteur}
                  onChange={(e) => setExamPrescripteur(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">— Interne ou Externe —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom} ({s.poste})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Analyses demandées *</label>
              <div className="border border-stone-200 rounded-lg p-3 bg-stone-50 max-h-64 overflow-y-auto space-y-3">
                {[
                  { category: "Hématologie", options: ["NFS (Hémogramme complet)", "Goutte épaisse (GE / Recherche Palu)", "Groupe Sanguin - Rhésus", "Vitesse de Sédimentation (VS)"] },
                  { category: "Biochimie", options: ["Glycémie à jeun", "Urée / Créatinine (Bilan rénal)", "Bilan Lipidique (Cholestérol)", "Transaminases (Bilan hépatique)"] },
                  { category: "Parasitologie & Microbiologie", options: ["Test de Widal (Fièvre typhoïde)", "ECBU (Urine)", "EPS (Selles)", "Prélèvement génital (PV/PU)"] },
                  { category: "Sérologie", options: ["Sérologie VIH 1 & 2", "Sérologie Syphilis (VDRL/TPHA)", "Antigène HBs (Hépatite B)", "Test de grossesse HCG"] }
                ].map((cat, i) => (
                  <div key={i}>
                    <h4 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase mb-1">{cat.category}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {cat.options.map((opt, j) => (
                        <label key={j} className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer p-1 hover:bg-stone-100 rounded-lg">
                          <input
                            type="checkbox"
                            checked={examAnalyses.includes(opt)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExamAnalyses([...examAnalyses, opt]);
                              } else {
                                setExamAnalyses(examAnalyses.filter((a) => a !== opt));
                              }
                            }}
                            className="w-3.5 h-3.5 text-primary-600 rounded-lg border-stone-300 focus:ring-primary-500"
                          />
                          <span className="truncate" title={opt}>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                
                <div className="pt-2 border-t border-stone-200">
                  <h4 className="text-xs font-bold text-stone-500 dark:text-stone-400 uppercase mb-1">Autres analyses (séparez par des virgules)</h4>
                  <input
                    type="text"
                    placeholder="Ex: ASAT, ALAT, TSH..."
                    value={examAnalysesCustom}
                    onChange={(e) => setExamAnalysesCustom(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:bg-stone-50 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateRequest}
              className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2"
            >
              Émettre le bon d'analyse
            </button>
          </div>
        </div>

        {/* Enter results form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success-600" />
            Saisie de Résultat de Laboratoire
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sélectionner l'analyse *</label>
              <select
                value={selectedExamId}
                onChange={(e) => {
                  setSelectedExamId(e.target.value);
                  const selected = examens.find((item) => item.id === e.target.value);
                  if (selected) {
                    setExamResultat(selected.resultat || "");
                    setExamInterpretation(selected.interpretation || "");
                    setExamTechnicien(selected.technicien || "");
                  } else {
                    setExamResultat("");
                    setExamInterpretation("");
                    setExamTechnicien("");
                  }
                }}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              >
                <option value="">— Choisir —</option>
                {examens
                  .filter((e) => e.statut !== "Prêt" && e.statut !== "Validé" && e.statut !== "Résultat disponible")
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.patient} — {e.analyses}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Technicien biomédical validateur</label>
                <select
                  value={examTechnicien}
                  onChange={(e) => setExamTechnicien(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">— Choisir le biologiste —</option>
                  {staff
                    .filter((s) => s.poste === "Infirmier" || s.poste === "Médecin")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom} ({s.poste})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Valeurs numériques / Observations de laboratoire *</label>
              <textarea
                placeholder="Ex: Goutte Épaisse : POSITIVE. Densité parasitaire : 4500 trophozoïtes/µL."
                value={examResultat}
                onChange={(e) => setExamResultat(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-20 resize-none font-mono"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Interprétation médicale / Conclusions cliniques (Facultatif)</label>
              <textarea
                placeholder="Ex: Infestation palustre à Plasmodium falciparum confirmée. Bilan biologique compatible."
                value={examInterpretation}
                onChange={(e) => setExamInterpretation(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleCompleteResult}
              className="w-full text-xs font-bold py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-all mt-2"
            >
              Signer et valider les résultats de laboratoire
            </button>
          </div>
        </div>
      </div>

      {/* Main Register list */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="border-b border-stone-100 pb-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary-700" />
            Registre Général d'Examen et d'Analyses Biologiques
          </h3>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher un patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {filteredExamList.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucune fiche d'analyse enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Numéro</th>
                  <th className="p-3">Date Demande</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Analyse demandée</th>
                  <th className="p-3">Prescripteur</th>
                  <th className="p-3 text-center">Statut</th>
                  <th className="p-3">Résultats consignés</th>
                  <th className="p-3 text-center">Bilan final</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredExamList.map((e) => {
                  const pres = staff.find((s) => s.id === e.prescripteur);
                  const tech = staff.find((s) => s.id === e.technicien);
                  return (
                    <tr key={e.id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-mono font-semibold text-sm text-primary-700 uppercase">
                        LAB-{e.id.slice(0, 6)}
                      </td>
                      <td className="p-3 font-mono text-stone-500 dark:text-stone-400">{new Date(e.dateDemande).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3 font-bold text-stone-800">
                        <div>{e.patient}</div>
                        {e.contact && <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">📞 {e.contact}</div>}
                      </td>
                      <td className="p-3 font-semibold text-stone-700">{e.analyses}</td>
                      <td className="p-3 font-medium text-stone-600">{pres ? pres.nom : "—"}</td>
                                            <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide inline-block ${
                            (e.statut === "Prêt" || e.statut === "Validé")
                              ? "bg-success-100 text-success-800"
                              : e.statut === "En cours d'analyse"
                              ? "bg-info-100 text-info-800 animate-pulse"
                              : e.statut === "Prélevé"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-warning-100 text-warning-800 animate-pulse"
                          }`}
                        >
                          {e.statut}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-sm text-stone-600 max-w-[200px] truncate" title={e.resultat}>
                        {e.resultat || <span className="text-stone-500 dark:text-stone-400 italic">Analyse biologique en cours...</span>}
                      </td>
                                            <td className="p-3 text-center">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          {(() => {
                            const relatedCons = consultations.filter(c => c.patient === e.patient).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                            if (relatedCons) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setViewingConsultation(relatedCons)}
                                  className="bg-info-50 hover:bg-info-100 text-info-700 text-2xs font-bold px-2 py-1.5 rounded-lg border border-info-200 transition-all w-full flex items-center justify-center gap-1 mb-1"
                                  title="Voir le contexte clinique du patient"
                                >
                                  <FileText className="w-3 h-3" /> Contexte
                                </button>
                              );
                            }
                            return null;
                          })()}
                          {(e.statut === "En attente" || e.statut === "Demandé") && (
                            <button
                              type="button"
                              onClick={() => {
                                handlePrintBonExamen(e);
                                const updated = examens.map(ex => ex.id === e.id ? { ...ex, statut: "Prélevé" as const } : ex);
                                onUpdateExamens(updated);
                              }}
                              className="bg-stone-800 hover:bg-stone-900 text-white text-2xs font-bold px-2 py-1.5 rounded-lg border border-stone-700 transition-all w-full"
                            >
                              Émettre Bon & Prélever
                            </button>
                          )}
                          {e.statut === "Prélevé" && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = examens.map(ex => ex.id === e.id ? { ...ex, statut: "En cours d'analyse" as const } : ex);
                                onUpdateExamens(updated);
                              }}
                              className="bg-sky-50 hover:bg-sky-100 text-sky-700 text-2xs font-bold px-2 py-1.5 rounded-lg border border-sky-200 transition-all w-full"
                            >
                              Techniquer (Lancer)
                            </button>
                          )}
                          {e.statut === "En cours d'analyse" && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedExamId(e.id);
                                setExamResultat(e.resultat || "");
                                setExamInterpretation(e.interpretation || "");
                                setExamTechnicien(e.technicien || "");
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="bg-info-50 hover:bg-info-100 text-info-700 text-2xs font-bold px-2 py-1.5 rounded-lg border border-info-200 transition-all w-full"
                            >
                              Saisir Résultats
                            </button>
                          )}
                          {(e.statut === "Prêt" || e.statut === "Validé") && (
                            <div className="flex flex-col gap-1 w-full">
                              <button
                                type="button"
                                onClick={() => handlePrintExam(e)}
                                className="bg-success-50 hover:bg-success-100 text-success-700 text-2xs font-bold px-2 py-1.5 rounded-lg border border-success-200 transition-all flex items-center justify-center gap-1 w-full"
                              >
                                <Printer className="w-3 h-3" /> Imprimer
                              </button>
                              <button
                                type="button"
                                onClick={() => handleShareWhatsAppLabo(e)}
                                className="bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#075E54] text-2xs font-bold px-2 py-1.5 rounded-lg border border-[#25D366]/30 transition-all flex items-center justify-center gap-1 w-full"
                              >
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteExam(e.id)}
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
        )}
      </div>
        </>
      )}
      {viewMode === "historique" && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-700" />
              Historique Complet des Analyses
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher un patient..."
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Patient</th>
                  <th className="p-3">Dernière demande</th>
                  <th className="p-3 text-center">Nombre d'examens</th>
                  <th className="p-3 text-center">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPatientExamDossiers.map((p) => (
                  <tr key={p.key} className="hover:bg-stone-50/50">
                    <td className="p-3 font-bold text-stone-800">
                      {p.patient}
                      {p.contact && <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">📞 {p.contact}</div>}
                    </td>
                    <td className="p-3 font-mono text-stone-500">{new Date(p.lastDate).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3 text-center">
                      <span className="inline-block bg-info-50 text-info-700 border border-info-200 rounded-lg px-2 py-1 text-xs font-bold">
                        {p.exams.length}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setViewingLaboPatientKey(p.key)}
                        className="bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-lg border border-primary-200 transition-all inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Voir le dossier
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dossier d'examens du patient : suite chronologique de tous ses examens de laboratoire */}
      {viewingLaboPatientDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">{viewingLaboPatientDossier.patient}</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  {viewingLaboPatientDossier.contact ? `📞 ${viewingLaboPatientDossier.contact} — ` : ""}
                  {viewingLaboPatientDossier.exams.length} examen{viewingLaboPatientDossier.exams.length > 1 ? "s" : ""} enregistré{viewingLaboPatientDossier.exams.length > 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingLaboPatientKey(null)}
                className="p-2 hover:bg-stone-100 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {viewingLaboPatientDossier.exams.map((e) => (
                <div key={e.id} className="border border-stone-200 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-mono text-stone-500 dark:text-stone-400">{new Date(e.dateDemande).toLocaleDateString("fr-FR")}</div>
                    <div className="text-sm font-bold text-stone-800 truncate">
                      {e.analyses || e.examen}
                      {e.priorite === "urgente" && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-2xs font-bold bg-danger-100 text-danger-800 border border-danger-200 uppercase tracking-widest">Urgent</span>
                      )}
                    </div>
                    <div className="text-xs text-stone-500 mt-0.5">Prescripteur : {e.prescripteur}</div>
                    {e.interpretation && (
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-2xs font-bold ${
                        e.interpretation.toLowerCase().includes("normal") ? "bg-success-100 text-success-800" :
                        e.interpretation.toLowerCase().includes("anormal") || e.interpretation.toLowerCase().includes("critique") ? "bg-danger-100 text-danger-800" :
                        "bg-stone-100 text-stone-700"
                      }`}>
                        {e.interpretation}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handlePrintExam(e)}
                      disabled={!e.resultat}
                      className="bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold px-2 py-1 rounded-lg border border-stone-200 transition-all flex items-center justify-center gap-1 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" /> Imprimer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShareWhatsAppLabo(e)}
                      disabled={!e.resultat}
                      className="bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#075E54] text-xs font-bold px-2 py-1 rounded-lg border border-[#25D366]/30 transition-all flex items-center justify-center gap-1 disabled:opacity-50 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-stone-100 bg-stone-50/50 rounded-b-2xl shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingLaboPatientKey(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === "reactifs" && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <Beaker className="w-5 h-5 text-primary-700" />
              Réactifs & Consommables de Laboratoire
            </h3>
            <span className="text-xs text-stone-500">
              {reactifsLabo.length} référence{reactifsLabo.length > 1 ? "s" : ""}
            </span>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
            Cette liste est partagée avec la Pharmacie. Vous pouvez ajouter un réactif ou consommable directement ici, ou depuis l'onglet Pharmacie.
          </p>

          {onUpdateMedicaments && (
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-6">
              <h4 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-3">Ajouter un réactif ou consommable</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <input
                  type="text"
                  placeholder="Nom *"
                  value={reactifNom}
                  onChange={(e) => setReactifNom(e.target.value)}
                  className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Présentation (ex: flacon 500ml)"
                  value={reactifPresentation}
                  onChange={(e) => setReactifPresentation(e.target.value)}
                  className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Stock initial"
                  value={reactifStock}
                  onChange={(e) => setReactifStock(e.target.value)}
                  className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Seuil d'alerte"
                  value={reactifSeuil}
                  onChange={(e) => setReactifSeuil(e.target.value)}
                  className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Fournisseur"
                  value={reactifFournisseur}
                  onChange={(e) => setReactifFournisseur(e.target.value)}
                  className="text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleAddReactif}
                className="mt-3 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter à la liste
              </button>
            </div>
          )}

          {reactifsLabo.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">
              Aucun réactif ou consommable de laboratoire enregistré pour l'instant.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                    <th className="p-3">Désignation</th>
                    <th className="p-3">Présentation</th>
                    <th className="p-3 text-center">Stock disponible</th>
                    <th className="p-3 text-center">Seuil d'alerte</th>
                    <th className="p-3">Fournisseur</th>
                    <th className="p-3 text-center">Statut</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {reactifsLabo.map((m) => {
                    const isLow = m.stock <= m.seuil;
                    return (
                      <tr key={m.id} className={isLow ? "bg-danger-50/50" : ""}>
                        <td className="p-3 font-bold text-stone-800">{m.nom}</td>
                        <td className="p-3 text-stone-600">{[m.forme, m.dosage].filter(Boolean).join(" ") || "—"}</td>
                        <td className={`p-3 text-center font-bold ${isLow ? "text-danger-700" : "text-stone-700"}`}>{m.stock}</td>
                        <td className="p-3 text-center text-stone-500">{m.seuil}</td>
                        <td className="p-3 text-stone-500">{m.fournisseur || "—"}</td>
                        <td className="p-3 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 text-danger-700 font-bold text-2xs bg-danger-100 px-2 py-1 rounded-lg">
                              <AlertTriangle className="w-3 h-3" /> Stock bas
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-success-700 font-bold text-2xs bg-success-100 px-2 py-1 rounded-lg">
                              OK
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {onUpdateMedicaments && (
                            <button
                              type="button"
                              onClick={() => handleDeleteReactif(m.id)}
                              className="text-stone-300 hover:text-danger-600 transition-all p-1"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      )}

      {viewMode === "procedures" && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary-700" />
              Procédures d'examens (assistées par IA)
            </h3>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
            Saisissez le nom d'un examen pour obtenir une fiche de procédure standardisée : prélèvement, matériel/réactifs, étapes, valeurs de référence et précautions. Vérifiez toujours les valeurs de référence sur la notice du kit/réactif utilisé.
          </p>

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Ex: Goutte épaisse, NFS, Glycémie à jeun, Test de grossesse..."
              value={procedureExamen}
              onChange={(e) => setProcedureExamen(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerateProcedure()}
              className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2.5 bg-stone-50 focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={handleGenerateProcedure}
              disabled={isGeneratingProcedure}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              {isGeneratingProcedure ? "Génération en cours..." : "✨ Générer la procédure"}
            </button>
          </div>

          {procedureError && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 text-xs text-danger-800 font-semibold mb-4">
              {procedureError}
            </div>
          )}

          {procedureResult && (
            <div className="border border-stone-200 rounded-xl p-5 bg-stone-50/50">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-stone-800">Procédure — {procedureExamen}</h4>
                <button
                  type="button"
                  onClick={handlePrintProcedure}
                  className="bg-success-50 hover:bg-success-100 text-success-700 text-xs font-bold px-3 py-1.5 rounded-lg border border-success-200 transition-all inline-flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimer
                </button>
              </div>
              <div className="text-xs text-stone-700 whitespace-pre-wrap leading-relaxed font-sans">
                {procedureResult}
              </div>
            </div>
          )}
        </div>
      )}

      {viewingConsultation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50 rounded-t-2xl shrink-0">
              <h3 className="font-serif font-bold text-stone-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-info-700" />
                Dossier de Laboratoire : {viewingConsultation.patient}
              </h3>
              <button
                type="button"
                onClick={() => setViewingConsultation(null)}
                className="text-stone-500 dark:text-stone-400 hover:text-danger-600 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex border-b border-stone-200 shrink-0">
              <button 
                type="button"
                onClick={() => setModalActiveTab("contexte")}
                className={`flex-1 py-3 text-xs font-bold transition-all ${modalActiveTab === "contexte" ? "text-info-700 border-b-2 border-info-600 bg-info-50/30" : "text-stone-500 hover:text-stone-700 hover:bg-stone-50"}`}
              >
                Contexte Clinique
              </button>
              <button 
                type="button"
                onClick={() => setModalActiveTab("historique")}
                className={`flex-1 py-3 text-xs font-bold transition-all ${modalActiveTab === "historique" ? "text-primary-700 border-b-2 border-primary-600 bg-primary-50/30" : "text-stone-500 hover:text-stone-700 hover:bg-stone-50"}`}
              >
                Historique Patient
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {modalActiveTab === "contexte" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                      <h4 className="text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Plaintes / Symptômes</h4>
                      <p className="text-xs text-stone-800 whitespace-pre-wrap">{viewingConsultation.plainte || <span className="italic text-stone-500 dark:text-stone-400">Non renseigné</span>}</p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                      <h4 className="text-xs uppercase tracking-wider font-semibold text-stone-500 mb-2">Examen Clinique</h4>
                      <p className="text-xs text-stone-800 whitespace-pre-wrap">{viewingConsultation.examenPhysique || <span className="italic text-stone-500 dark:text-stone-400">Non renseigné</span>}</p>
                    </div>
                  </div>
                  
                  <div className="bg-info-50 p-4 rounded-xl border border-info-100">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-info-500 mb-2">Constantes Vitales (lors de la consultation)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-xs text-info-900"><span className="font-semibold opacity-75 block text-xs">Température:</span>{viewingConsultation.vitals?.temperature ? viewingConsultation.vitals.temperature + "°C" : "-"}</div>
                      <div className="text-xs text-info-900"><span className="font-semibold opacity-75 block text-xs">Tension:</span>{viewingConsultation.vitals?.tensionArterielle || "-"}</div>
                      <div className="text-xs text-info-900"><span className="font-semibold opacity-75 block text-xs">Poids:</span>{viewingConsultation.vitals?.poids ? viewingConsultation.vitals.poids + "kg" : "-"}</div>
                    </div>
                  </div>
                  
                  <div className="bg-danger-50 p-4 rounded-xl border border-danger-100">
                    <h4 className="text-xs uppercase tracking-wider font-semibold text-danger-500 mb-2">Hypothèse Diagnostique / Diagnostic</h4>
                    <p className="text-xs text-danger-900 font-bold whitespace-pre-wrap">{viewingConsultation.diagnostic || <span className="italic opacity-50">Non renseigné</span>}</p>
                  </div>
                </div>
              )}
              
              {modalActiveTab === "historique" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-stone-800 mb-2">Historique des examens de {viewingConsultation.patient}</h4>
                  {examens.filter(e => e.patient === viewingConsultation.patient).length === 0 ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic">Aucun examen de laboratoire pour ce patient.</p>
                  ) : (
                    <div className="space-y-3">
                      {examens
                        .filter(e => e.patient === viewingConsultation.patient)
                        .sort((a, b) => new Date(b.dateDemande).getTime() - new Date(a.dateDemande).getTime())
                        .map((e, idx) => (
                        <div key={idx} className="border border-stone-200 rounded-xl p-3 bg-white">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-bold text-xs text-stone-800">{e.analyses || e.examen}</div>
                              <div className="text-xs text-stone-500">{new Date(e.dateDemande).toLocaleDateString("fr-FR")} • Prescrit par {e.prescripteur}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                              e.statut === "Prêt" || e.statut === "Validé" || e.statut === "Résultat disponible"
                              ? "bg-success-100 text-success-800"
                              : "bg-warning-100 text-warning-800"
                            }`}>
                              {e.statut}
                            </span>
                          </div>
                          
                          {(e.resultat || e.interpretation) && (
                            <div className="bg-stone-50 p-2 rounded-lg border border-stone-100 mt-2">
                              {e.resultat && (
                                <div className="mb-1">
                                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Résultats</span>
                                  <p className="text-xs text-stone-800 font-mono whitespace-pre-wrap">{e.resultat}</p>
                                </div>
                              )}
                              {e.interpretation && (
                                <div>
                                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">Interprétation</span>
                                  <span className={`text-xs font-bold ${
                                    e.interpretation.toLowerCase().includes("normal") ? "text-success-700" :
                                    e.interpretation.toLowerCase().includes("anormal") || e.interpretation.toLowerCase().includes("critique") ? "text-danger-700" :
                                    "text-stone-700"
                                  }`}>{e.interpretation}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-stone-100 bg-stone-50/50 rounded-b-2xl shrink-0 flex justify-end">
              <button 
                type="button"
                onClick={() => setViewingConsultation(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

