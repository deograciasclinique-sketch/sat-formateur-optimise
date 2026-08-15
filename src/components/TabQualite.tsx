/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { logActivity } from "../lib/activityLogger";
import TabQualiteActivityLog from "./TabQualiteActivityLog";
import { Audit, ActionCorrective, Incident, Consultation } from "../types";
import { QUALITY_CRITERIA, QualityCriterion, generateUid, getTodayStr, getTodayFr } from "../data";
import { Award, CheckCircle, AlertOctagon, Plus, Trash2, Calendar, ClipboardCheck, Wrench, ShieldAlert, Database, Upload, Download, FileText, Sliders, RefreshCw, FileCheck, History } from "lucide-react";

interface TabQualiteProps {
  audits: Audit[];
  actions: ActionCorrective[];
  incidents: Incident[];
  consultations?: Consultation[];
  onUpdateAudits: (audits: Audit[]) => void;
  onUpdateActions: (actions: ActionCorrective[]) => void;
  onUpdateIncidents: (incidents: Incident[]) => void;
}

export default function TabQualite({
  audits,
  actions,
  incidents,
  consultations = [],
  onUpdateAudits,
  onUpdateActions,
  onUpdateIncidents
}: TabQualiteProps) {
  const [activeSubTab, setActiveSubTab] = useState<"audit" | "actions" | "incidents" | "journal" | "admin">("audit");
  const [auditScores, setAuditScores] = useState<Record<string, number>>({});
  const [saveMsg, setSaveMsg] = useState(false);

  // Corrective action form states
  const [acProbleme, setAcProbleme] = useState("");
  const [acAction, setAcAction] = useState("");
  const [acResponsable, setAcResponsable] = useState("");
  const [acEcheance, setAcEcheance] = useState("");
  const [acPriorite, setAcPriorite] = useState<"Haute" | "Normale" | "Basse">("Normale");
  const [acStatut, setAcStatut] = useState<"En cours" | "Réalisée" | "Annulée">("En cours");

  // Incident form states
  const [incDate, setIncDate] = useState(getTodayStr());
  const [incType, setIncType] = useState("");
  const [incGravite, setIncGravite] = useState<"faible" | "modere" | "grave" | "critique">("faible");
  const [incPersonnel, setIncPersonnel] = useState("");
  const [incDescription, setIncDescription] = useState("");
  const [incMesures, setIncMesures] = useState("");

  // Backup / Import States
  const [importType, setImportType] = useState<"medicament" | "patient" | "staff" | "rdv">("medicament");
  const [importMode, setImportMode] = useState<"append" | "overwrite">("append");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Compliance and Gemini report states
  const [reportText, setReportText] = useState<string | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Analyze consultations for patient dossier completeness
  const analyzeCompliance = () => {
    const total = consultations.length;
    let complete = 0;
    let incomplete = 0;

    const missingFieldsSummary = {
      patient: 0,
      age: 0,
      sexe: 0,
      contact: 0,
      temperature: 0,
      tensionArterielle: 0,
      poids: 0,
      pouls: 0,
      glycemie: 0,
      plainte: 0,
      diagnostic: 0,
    };

    consultations.forEach((c) => {
      let isComplete = true;

      if (!c.patient || c.patient.trim() === "") {
        missingFieldsSummary.patient++;
        isComplete = false;
      }
      if (!c.age || c.age <= 0) {
        missingFieldsSummary.age++;
        isComplete = false;
      }
      if (!c.sexe) {
        missingFieldsSummary.sexe++;
        isComplete = false;
      }
      if (!c.contact || c.contact.trim() === "") {
        missingFieldsSummary.contact++;
        isComplete = false;
      }

      // Vitals checking
      if (!c.vitals) {
        missingFieldsSummary.temperature++;
        missingFieldsSummary.tensionArterielle++;
        missingFieldsSummary.poids++;
        missingFieldsSummary.pouls++;
        missingFieldsSummary.glycemie++;
        isComplete = false;
      } else {
        if (!c.vitals.temperature || c.vitals.temperature === 0) {
          missingFieldsSummary.temperature++;
          isComplete = false;
        }
        if (!c.vitals.tensionArterielle || c.vitals.tensionArterielle.trim() === "" || c.vitals.tensionArterielle === "0" || c.vitals.tensionArterielle === "0/0") {
          missingFieldsSummary.tensionArterielle++;
          isComplete = false;
        }
        if (!c.vitals.poids || c.vitals.poids === 0) {
          missingFieldsSummary.poids++;
          isComplete = false;
        }
        if (!c.vitals.pouls || c.vitals.pouls === 0) {
          missingFieldsSummary.pouls++;
          isComplete = false;
        }
        if (!c.vitals.glycemie || c.vitals.glycemie === 0) {
          missingFieldsSummary.glycemie++;
          isComplete = false;
        }
      }

      // Clinical checking
      if (!c.plainte || c.plainte.trim() === "") {
        missingFieldsSummary.plainte++;
        isComplete = false;
      }
      if (!c.diagnostic || c.diagnostic.trim() === "") {
        missingFieldsSummary.diagnostic++;
        isComplete = false;
      }

      if (isComplete) {
        complete++;
      } else {
        incomplete++;
      }
    });

    const completenessRate = total > 0 ? Math.round((complete / total) * 100) : 0;

    return {
      totalConsultations: total,
      completeDossiers: complete,
      incompleteDossiers: incomplete,
      completenessRate,
      missingFieldsSummary,
      additionalMetrics: {
        recentAuditsCount: audits.length,
        lastAuditScore: audits.length > 0 ? audits[0].score : 0,
        incidentsCount: incidents.length,
        activeCorrectiveActions: actions.filter(a => a.statut === "En cours").length
      }
    };
  };

  const handleGenerateReport = async () => {
    setIsLoadingReport(true);
    setReportError(null);
    try {
      const stats = analyzeCompliance();
      const response = await fetch("/api/gemini/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stats),
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Impossible de lire la réponse du serveur.");
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erreur serveur lors de la génération du rapport.");
      }
      setReportText(data.report);
    } catch (err: any) {
      console.error(err);
      setReportError(err.message || "Impossible de générer le rapport. Veuillez vérifier que le serveur est bien démarré et que la clé API Gemini est configurée.");
    } finally {
      setIsLoadingReport(false);
    }
  };

  // Calculations
  const scoredCount = Object.keys(auditScores).length;
  const totalScore = (Object.values(auditScores) as number[]).reduce((a, b) => a + b, 0);
  const maxPossible = scoredCount * 2;
  const auditPercentage = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;
  const conformesCount = (Object.values(auditScores) as number[]).filter((s) => s === 2).length;

  const handleSetScore = (id: string, score: number) => {
    setAuditScores((prev) => ({ ...prev, [id]: score }));
  };

  const handleSaveAudit = () => {
    if (scoredCount < 5) {
      alert("Veuillez évaluer au moins 5 critères avant d'enregistrer.");
      return;
    }

    const newAudit: Audit = {
      id: generateUid(),
      date: getTodayStr(),
      dateFr: new Date().toLocaleDateString("fr-FR"),
      score: auditPercentage,
      realise: "Responsable Clinique",
      scores: { ...auditScores }
    };

    onUpdateAudits([newAudit, ...audits]);
    setSaveMsg(true);
    setTimeout(() => setSaveMsg(false), 3000);
    setAuditScores({});
  };

  const handleResetAudit = () => {
    if (confirm("Réinitialiser l'évaluation actuelle ?")) {
      setAuditScores({});
    }
  };

  const handleDeleteAudit = (id: string) => {
    const auditToDelete = audits.find((a) => a.id === id);
    if (confirm("Supprimer cet audit de l'historique ?")) {
      onUpdateAudits(audits.filter((a) => a.id !== id));
      if (auditToDelete) {
        logActivity(
          "Suppression de fiche (Audit)",
          "suppression",
          `Suppression de l'audit de conformité clinique réalisé le ${auditToDelete.dateFr || auditToDelete.date} (Score : ${auditToDelete.score}%).`
        );
      }
    }
  };

  const handleAddAction = () => {
    if (!acProbleme.trim() || !acAction.trim() || !acResponsable.trim()) {
      alert("Veuillez remplir tous les champs obligatoires (*)");
      return;
    }

    const newAction: ActionCorrective = {
      id: generateUid(),
      probleme: acProbleme,
      action: acAction,
      responsable: acResponsable,
      echeance: acEcheance || getTodayStr(),
      priorite: acPriorite,
      statut: acStatut,
      date: getTodayStr()
    };

    onUpdateActions([newAction, ...actions]);
    setAcProbleme("");
    setAcAction("");
    setAcResponsable("");
    setAcEcheance("");
  };

  const handleDeleteAction = (id: string) => {
    const actionToDelete = actions.find((a) => a.id === id);
    if (confirm("Supprimer cette action corrective de l'historique ?")) {
      onUpdateActions(actions.filter((a) => a.id !== id));
      if (actionToDelete) {
        logActivity(
          "Suppression de fiche (Qualité)",
          "suppression",
          `Suppression de l'action corrective : "${actionToDelete.action}" (Responsable : ${actionToDelete.responsable}).`
        );
      }
    }
  };

  const handleAddIncident = () => {
    if (!incType || !incDescription.trim()) {
      alert("Veuillez renseigner le type et la description de l'incident.");
      return;
    }

    const newIncident: Incident = {
      id: generateUid(),
      date: incDate,
      type: incType,
      gravite: incGravite,
      personnel: incPersonnel,
      description: incDescription,
      mesures: incMesures
    };

    onUpdateIncidents([newIncident, ...incidents]);
    setIncType("");
    setIncPersonnel("");
    setIncDescription("");
    setIncMesures("");
    setIncDate(getTodayStr());
  };

  const handleDeleteIncident = (id: string) => {
    const incidentToDelete = incidents.find((i) => i.id === id);
    if (confirm("Supprimer ce rapport d'incident ?")) {
      onUpdateIncidents(incidents.filter((i) => i.id !== id));
      if (incidentToDelete) {
        logActivity(
          "Suppression de fiche (Qualité)",
          "suppression",
          `Suppression du rapport d'incident : "${incidentToDelete.type}" du ${new Date(incidentToDelete.date).toLocaleDateString("fr-FR")} (${incidentToDelete.description.substring(0, 40)}...).`
        );
      }
    }
  };

  // Export database to JSON
  const handleExportJSON = () => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("dg_"));
      const backup: Record<string, any> = {};
      keys.forEach((k) => {
        try {
          backup[k] = JSON.parse(localStorage.getItem(k) || "null");
        } catch (e) {
          backup[k] = localStorage.getItem(k);
        }
      });

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deogracias_sauvegarde_globale_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Erreur lors de la génération de l'exportation JSON.");
    }
  };

  // Import database from JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (typeof data !== "object" || data === null) {
          alert("Fichier de sauvegarde JSON invalide.");
          return;
        }

        const keys = Object.keys(data);
        const hasAppKeys = keys.some((k) => k.startsWith("dg_"));
        if (!hasAppKeys) {
          if (!confirm("Attention : Aucun paramètre de clinique 'dg_' détecté dans ce fichier. Voulez-vous continuer quand même ?")) {
            return;
          }
        }

        if (confirm("Attention : Cette opération va écraser TOUTES vos données actuelles par les données de cette sauvegarde JSON. Continuer ?")) {
          keys.forEach((k) => {
            if (typeof data[k] === "string") {
              localStorage.setItem(k, data[k]);
            } else {
              localStorage.setItem(k, JSON.stringify(data[k]));
            }
          });
          alert("Restauration réussie ! L'application va se recharger.");
          window.location.reload();
        }
      } catch (err) {
        alert("Erreur lors de la lecture ou de l'analyse du fichier JSON.");
      }
    };
    reader.readAsText(file);
  };

  // Handle CSV file import logic
  const handleImportCSVClick = () => {
    if (!csvFile) {
      alert("Veuillez d'abord sélectionner un fichier CSV.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text || text.trim() === "") {
          alert("Le fichier CSV est vide.");
          return;
        }

        // Detect delimiter: semicolon is common in French Excel, comma is standard CSV
        const firstLine = text.split("\n")[0];
        const delimiter = firstLine.includes(";") ? ";" : ",";

        // Custom robust CSV parser that respects double-quoted strings containing delimiters
        const rows: string[][] = [];
        let row: string[] = [];
        let inQuotes = false;
        let currentValue = "";

        for (let i = 0; i < text.length; i++) {
          const char = text[i];
          const nextChar = text[i + 1];

          if (char === '"') {
            if (inQuotes && nextChar === '"') {
              currentValue += '"';
              i++; // skip next quote
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === delimiter) {
            if (inQuotes) {
              currentValue += char;
            } else {
              row.push(currentValue.trim());
              currentValue = "";
            }
          } else if (char === "\n" || char === "\r") {
            if (inQuotes) {
              currentValue += char;
            } else {
              if (char === "\r" && nextChar === "\n") {
                i++; // skip linefeed
              }
              row.push(currentValue.trim());
              rows.push(row);
              row = [];
              currentValue = "";
            }
          } else {
            currentValue += char;
          }
        }
        if (row.length > 0 || currentValue !== "") {
          row.push(currentValue.trim());
          rows.push(row);
        }

        const cleanRows = rows.filter((r) => r.length > 0 && r.some((cell) => cell !== ""));
        if (cleanRows.length < 2) {
          alert("Le fichier CSV doit contenir au moins une ligne d'en-tête (colonnes) et une ligne de données.");
          return;
        }

        const rawHeaders = cleanRows[0].map((h) => h.toLowerCase().trim().replace(/^["']|["']$/g, ""));
        const dataRows = cleanRows.slice(1);

        // Utility to find index of a column matching any of the possible names
        const getColIndex = (names: string[]): number => {
          return rawHeaders.findIndex((h) => names.some((n) => h === n || h.includes(n)));
        };

        const parsedItems: any[] = [];

        if (importType === "medicament") {
          const idxNom = getColIndex(["nom", "name", "medicament", "produit"]);
          const idxForme = getColIndex(["forme", "form", "presentation"]);
          const idxDosage = getColIndex(["dosage", "dose"]);
          const idxCat = getColIndex(["categorie", "category", "classe"]);
          const idxStock = getColIndex(["stock", "quantite", "qte", "qty"]);
          const idxSeuil = getColIndex(["seuil", "minimum", "limite"]);
          const idxPrixA = getColIndex(["prixachat", "prix_achat", "achat"]);
          const idxPrixV = getColIndex(["prixvente", "prix_vente", "vente", "prix"]);
          const idxPeremp = getColIndex(["peremption", "expiry", "expiration"]);
          const idxFourn = getColIndex(["fournisseur", "supplier", "provider"]);

          if (idxNom === -1) {
            alert("Erreur : La colonne obligatoire 'nom' du médicament est introuvable dans l'en-tête du CSV.");
            return;
          }

          dataRows.forEach((r) => {
            const nom = r[idxNom] || "";
            if (!nom.trim()) return;

            parsedItems.push({
              id: "med_" + Math.random().toString(36).substring(2, 11),
              nom: nom.replace(/^["']|["']$/g, "").trim(),
              forme: idxForme !== -1 && r[idxForme] ? r[idxForme].replace(/^["']|["']$/g, "").trim() : "Comprimé",
              dosage: idxDosage !== -1 && r[idxDosage] ? r[idxDosage].replace(/^["']|["']$/g, "").trim() : "—",
              categorie: idxCat !== -1 && r[idxCat] ? r[idxCat].replace(/^["']|["']$/g, "").trim() : "Général",
              stock: idxStock !== -1 ? parseInt(r[idxStock]) || 0 : 0,
              seuil: idxSeuil !== -1 ? parseInt(r[idxSeuil]) || 5 : 5,
              prixAchat: idxPrixA !== -1 ? parseFloat(r[idxPrixA]) || 0 : 0,
              prixVente: idxPrixV !== -1 ? parseFloat(r[idxPrixV]) || 0 : 0,
              peremption: idxPeremp !== -1 && r[idxPeremp] ? r[idxPeremp].replace(/^["']|["']$/g, "").trim() : "",
              fournisseur: idxFourn !== -1 && r[idxFourn] ? r[idxFourn].replace(/^["']|["']$/g, "").trim() : "—",
              createdAt: new Date().toISOString()
            });
          });

          const storageKey = "dg_pharma_stock";
          const existing = importMode === "append" ? JSON.parse(localStorage.getItem(storageKey) || "[]") : [];
          const merged = [...parsedItems, ...existing];
          localStorage.setItem(storageKey, JSON.stringify(merged));

        } else if (importType === "patient") {
          const idxPatient = getColIndex(["patient", "nom", "name", "malade", "patient_nom"]);
          const idxAge = getColIndex(["age", "annees"]);
          const idxSexe = getColIndex(["sexe", "gender", "genre"]);
          const idxContact = getColIndex(["contact", "telephone", "phone", "tel"]);
          const idxDate = getColIndex(["date", "visite"]);
          const idxPlainte = getColIndex(["plainte", "symptome", "motif"]);
          const idxDiag = getColIndex(["diagnostic", "diag"]);
          const idxTemp = getColIndex(["temperature", "temp"]);
          const idxPoids = getColIndex(["poids", "weight"]);
          const idxTension = getColIndex(["tension", "tension_arterielle", "ta", "bp"]);

          if (idxPatient === -1) {
            alert("Erreur : La colonne obligatoire 'patient' (nom complet) est introuvable dans l'en-tête du CSV.");
            return;
          }

          dataRows.forEach((r) => {
            const patient = r[idxPatient] || "";
            if (!patient.trim()) return;

            const rawSexe = idxSexe !== -1 && r[idxSexe] ? r[idxSexe].replace(/^["']|["']$/g, "").trim() : "Masculin";
            const sexe = rawSexe.toLowerCase().startsWith("f") ? "Féminin" : "Masculin";

            parsedItems.push({
              id: "consult_" + Math.random().toString(36).substring(2, 11),
              patient: patient.replace(/^["']|["']$/g, "").trim(),
              age: idxAge !== -1 ? parseInt(r[idxAge]) || 30 : 30,
              sexe,
              contact: idxContact !== -1 && r[idxContact] ? r[idxContact].replace(/^["']|["']$/g, "").trim() : "",
              date: idxDate !== -1 && r[idxDate] ? r[idxDate].replace(/^["']|["']$/g, "").trim() : new Date().toISOString().slice(0, 10),
              plainte: idxPlainte !== -1 && r[idxPlainte] ? r[idxPlainte].replace(/^["']|["']$/g, "").trim() : "Consultation générale",
              diagnostic: idxDiag !== -1 && r[idxDiag] ? r[idxDiag].replace(/^["']|["']$/g, "").trim() : "Symptômes généraux",
              vitals: {
                temperature: idxTemp !== -1 ? parseFloat(r[idxTemp]) || 37 : 37,
                poids: idxPoids !== -1 ? parseFloat(r[idxPoids]) || 70 : 70,
                tensionArterielle: idxTension !== -1 && r[idxTension] ? r[idxTension].replace(/^["']|["']$/g, "").trim() : "12/8",
                pouls: 72,
                glycemie: 1
              },
              ordonnance: [],
              createdAt: new Date().toISOString()
            });
          });

          const storageKey = "dg_consultations";
          const existing = importMode === "append" ? JSON.parse(localStorage.getItem(storageKey) || "[]") : [];
          const merged = [...parsedItems, ...existing];
          localStorage.setItem(storageKey, JSON.stringify(merged));

        } else if (importType === "staff") {
          const idxNom = getColIndex(["nom", "name", "fullname", "personnel"]);
          const idxPoste = getColIndex(["poste", "role", "fonction", "job"]);
          const idxContact = getColIndex(["contact", "telephone", "phone", "tel"]);
          const idxHoraire = getColIndex(["horaire", "shift", "planning"]);

          if (idxNom === -1) {
            alert("Erreur : La colonne obligatoire 'nom' du personnel est introuvable dans l'en-tête du CSV.");
            return;
          }

          dataRows.forEach((r) => {
            const nom = r[idxNom] || "";
            if (!nom.trim()) return;

            parsedItems.push({
              id: "staff_" + Math.random().toString(36).substring(2, 11),
              nom: nom.replace(/^["']|["']$/g, "").trim(),
              poste: idxPoste !== -1 && r[idxPoste] ? r[idxPoste].replace(/^["']|["']$/g, "").trim() : "Infirmier",
              contact: idxContact !== -1 && r[idxContact] ? r[idxContact].replace(/^["']|["']$/g, "").trim() : "—",
              horaire: idxHoraire !== -1 && r[idxHoraire] ? r[idxHoraire].replace(/^["']|["']$/g, "").trim() : "8h-16h",
              createdAt: new Date().toISOString()
            });
          });

          const storageKey = "dg_staff";
          const existing = importMode === "append" ? JSON.parse(localStorage.getItem(storageKey) || "[]") : [];
          const merged = [...parsedItems, ...existing];
          localStorage.setItem(storageKey, JSON.stringify(merged));

        } else if (importType === "rdv") {
          const idxPatient = getColIndex(["patient", "nom", "name"]);
          const idxDate = getColIndex(["date", "jour"]);
          const idxHeure = getColIndex(["heure", "time"]);
          const idxContact = getColIndex(["contact", "telephone", "phone", "tel"]);
          const idxType = getColIndex(["type", "categorie"]);
          const idxPraticien = getColIndex(["praticien", "medecin", "doctor"]);
          const idxMotif = getColIndex(["motif", "reason"]);
          const idxNotes = getColIndex(["notes", "observations"]);
          const idxStatut = getColIndex(["statut", "status"]);

          if (idxPatient === -1) {
            alert("Erreur : La colonne obligatoire 'patient' est introuvable dans l'en-tête du CSV.");
            return;
          }

          dataRows.forEach((r) => {
            const patient = r[idxPatient] || "";
            if (!patient.trim()) return;

            const rawStatut = idxStatut !== -1 && r[idxStatut] ? r[idxStatut].replace(/^["']|["']$/g, "").trim() : "Planifié";
            let statut: any = "Planifié";
            if (["Planifié", "Confirmé", "Terminé", "Annulé", "Absent"].includes(rawStatut)) {
              statut = rawStatut;
            }

            parsedItems.push({
              id: "rdv_" + Math.random().toString(36).substring(2, 11),
              patient: patient.replace(/^["']|["']$/g, "").trim(),
              date: idxDate !== -1 && r[idxDate] ? r[idxDate].replace(/^["']|["']$/g, "").trim() : new Date().toISOString().slice(0, 10),
              heure: idxHeure !== -1 && r[idxHeure] ? r[idxHeure].replace(/^["']|["']$/g, "").trim() : "09:00",
              contact: idxContact !== -1 && r[idxContact] ? r[idxContact].replace(/^["']|["']$/g, "").trim() : "",
              type: idxType !== -1 && r[idxType] ? r[idxType].replace(/^["']|["']$/g, "").trim() : "Consultation",
              praticien: idxPraticien !== -1 && r[idxPraticien] ? r[idxPraticien].replace(/^["']|["']$/g, "").trim() : "Dr. Jean",
              motif: idxMotif !== -1 && r[idxMotif] ? r[idxMotif].replace(/^["']|["']$/g, "").trim() : "Suivi",
              notes: idxNotes !== -1 && r[idxNotes] ? r[idxNotes].replace(/^["']|["']$/g, "").trim() : "",
              statut,
              createdAt: new Date().toISOString()
            });
          });

          const storageKey = "dg_rdv";
          const existing = importMode === "append" ? JSON.parse(localStorage.getItem(storageKey) || "[]") : [];
          const merged = [...parsedItems, ...existing];
          localStorage.setItem(storageKey, JSON.stringify(merged));
        }

        setCsvFeedback(`✅ Importation réussie ! ${parsedItems.length} éléments importés. Rechargement de l'application...`);
        setCsvFile(null);
        setTimeout(() => {
          window.location.reload();
        }, 2000);

      } catch (err) {
        console.error("CSV import error:", err);
        alert("Erreur technique lors de l'importation. Vérifiez la validité de l'encodage du fichier CSV.");
      }
    };
    reader.readAsText(csvFile, "UTF-8");
  };

  // Group quality criteria by category
  const categories = Array.from(new Set(QUALITY_CRITERIA.map((c) => c.cat)));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-success-600">
          <div className="text-3xl font-semibold text-success-700 font-serif">
            {audits.length > 0 ? `${audits[0].score}%` : "—"}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Dernier score</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Évaluation de conformité</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{audits.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Audits réalisés</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Total enregistré</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">
            {incidents.filter((i) => i.date.slice(0, 7) === getTodayStr().slice(0, 7)).length}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Incidents ce mois</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Événements indésirables</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">
            {incidents.filter((i) => i.gravite === "critique" || i.gravite === "grave").length}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Incidents graves</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Action requise d'urgence</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-cyan-600">
          <div className="text-3xl font-semibold text-cyan-700 font-serif">
            {actions.filter((a) => a.statut === "En cours").length}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Actions en cours</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Suivi du plan correctif</div>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-4">
        <button
          type="button"
          onClick={() => setActiveSubTab("audit")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "audit"
              ? "bg-primary-600 text-white shadow-xs"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Évaluation & Audit Clinique</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("actions")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "actions"
              ? "bg-primary-600 text-white shadow-xs"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Actions Correctives</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("incidents")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "incidents"
              ? "bg-primary-600 text-white shadow-xs"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Signalements d'Incidents</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("journal")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "journal"
              ? "bg-primary-600 text-white shadow-xs"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Journal d'Activité</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("admin")}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === "admin"
              ? "bg-primary-600 text-white shadow-xs"
              : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-50"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Administration & Sauvegardes</span>
        </button>
      </div>

      {/* 4. JOURNAL D'ACTIVITÉ */}
      {activeSubTab === "journal" && (
        <div className="animate-fade-in">
          <TabQualiteActivityLog />
        </div>
      )}

      {/* 1. ÉVALUATION & AUDIT CLINIQUE */}
      {activeSubTab === "audit" && (
        <div className="space-y-6 animate-fade-in">
          {/* Dossier patient completeness compliance block (Gemini AI analysis) */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs border-l-4 border-l-primary-600">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-100 pb-4 mb-4">
          <div>
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary-600" />
              Analyse de Conformité des Dossiers Cliniques (IA Gemini)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Analyse automatique en temps réel de la complétude des dossiers de consultation de la clinique.
            </p>
          </div>
          <button
            type="button"
            disabled={isLoadingReport}
            onClick={handleGenerateReport}
            className={`px-5 py-2.5 text-xs font-bold rounded-lg shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
              isLoadingReport
                ? "bg-stone-100 text-stone-500 dark:text-stone-400 border border-stone-200"
                : "bg-primary-600 hover:bg-primary-700 text-white"
            }`}
          >
            {isLoadingReport ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Générer rapport de conformité
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Circular completeness rate */}
          <div className="flex flex-col items-center justify-center p-4 bg-stone-50 rounded-xl border border-stone-150">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-24 h-24 rounded-full border-8 flex flex-col items-center justify-center font-bold font-mono transition-all ${
                  analyzeCompliance().completenessRate >= 80
                    ? "border-success-500 bg-success-50 text-success-700"
                    : analyzeCompliance().completenessRate >= 50
                    ? "border-warning-500 bg-warning-50 text-warning-700"
                    : "border-danger-500 bg-danger-50 text-danger-700"
                }`}
              >
                <span className="text-2xl font-black">{analyzeCompliance().completenessRate}%</span>
                <span className="text-2xs uppercase font-bold tracking-wider opacity-80">Complets</span>
              </div>
            </div>
            <div className="text-center mt-3">
              <span className="text-xs font-bold text-stone-700 block">Taux de complétude</span>
              <span className="text-xs text-stone-500 dark:text-stone-400">Objectif qualité : &gt;95%</span>
            </div>
          </div>

          {/* Core breakdown stats */}
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-stone-50 border border-stone-100 rounded-xl flex flex-col justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-stone-500 dark:text-stone-400">Consultations Analysées</span>
              <div className="text-2xl font-bold font-mono text-stone-800 mt-2">{analyzeCompliance().totalConsultations}</div>
              <span className="text-xs text-stone-500 dark:text-stone-400 mt-1">Registre total des dossiers</span>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-100 rounded-xl flex flex-col justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-stone-500 dark:text-stone-400 text-success-700">Dossiers Conformes</span>
              <div className="text-2xl font-bold font-mono text-success-700 mt-2">{analyzeCompliance().completeDossiers}</div>
              <span className="text-xs text-stone-500 dark:text-stone-400 mt-1">Tous les critères requis validés</span>
            </div>
            <div className="p-4 bg-stone-50 border border-stone-100 rounded-xl flex flex-col justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-stone-500 dark:text-stone-400 text-warning-700">Dossiers Incomplets</span>
              <div className="text-2xl font-bold font-mono text-warning-700 mt-2">{analyzeCompliance().incompleteDossiers}</div>
              <span className="text-xs text-stone-500 dark:text-stone-400 mt-1">Champs obligatoires manquants</span>
            </div>
          </div>
        </div>

        {/* Missing fields breakdown warning indicator if some exist */}
        {analyzeCompliance().incompleteDossiers > 0 && (
          <div className="mt-4 p-3.5 bg-warning-50/50 border border-warning-100 rounded-xl flex items-start gap-3">
            <AlertOctagon className="w-4.5 h-4.5 text-warning-600 shrink-0 mt-0.5" />
            <div className="text-xs text-warning-800 leading-normal">
              <strong>Manquements détectés :</strong> Certains dossiers ne contiennent pas toutes les constantes vitales ou informations obligatoires. Principaux champs omis :{" "}
              {Object.entries(analyzeCompliance().missingFieldsSummary)
                .filter(([_, count]) => count > 0)
                .map(([field, count]) => {
                  const labelMap: Record<string, string> = {
                    temperature: "température",
                    tensionArterielle: "tension",
                    poids: "poids",
                    pouls: "pouls",
                    glycemie: "glycémie",
                    ordonnance: "ordonnance",
                    diagnostic: "diagnostic",
                    plainte: "plainte",
                    contact: "contact",
                    age: "âge",
                  };
                  return `${labelMap[field] || field} (${count})`;
                })
                .join(", ")}
              . Utilisez le bouton ci-dessus pour générer une analyse constructive et un plan d'action d'amélioration par l'IA.
            </div>
          </div>
        )}

        {/* Display generated Gemini Report */}
        {isLoadingReport && (
          <div className="mt-6 p-8 border border-stone-150 rounded-xl bg-stone-50 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-primary-600 animate-spin" />
            <div className="text-center">
              <p className="text-xs font-bold text-stone-800">Analyse clinique des dossiers en cours par Gemini...</p>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">L'IA examine la conformité et dresse des recommandations.</p>
            </div>
          </div>
        )}

        {reportError && (
          <div className="mt-6 p-4 border border-danger-200 rounded-xl bg-danger-50 text-xs text-danger-700 font-medium">
            ⚠️ {reportError}
          </div>
        )}

        {reportText && !isLoadingReport && (
          <div className="mt-6 p-6 border border-stone-200 rounded-xl bg-stone-50/50 relative">
            <button
              type="button"
              onClick={() => setReportText(null)}
              className="absolute top-4 right-4 text-xs font-bold text-stone-500 dark:text-stone-400 hover:text-stone-600 cursor-pointer"
            >
              Fermer le rapport
            </button>
            <div className="prose max-w-none">
              <SimpleMarkdownRenderer text={reportText} />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Audit Grid Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-4">
            <h3 className="text-lg font-serif font-bold text-stone-900 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold">1</span>
              Grille d'Audit Clinique — Évaluation Continue
            </h3>
            <span className="text-xs font-mono text-stone-500 dark:text-stone-400">{getTodayFr()}</span>
          </div>

          <div className="space-y-6">
            {categories.map((cat, catIndex) => (
              <div key={cat} className="space-y-2">
                <h4 className="text-xs font-semibold text-warning-800 tracking-wider uppercase border-b border-warning-100 pb-1 mb-3">
                  {cat}
                </h4>
                <div className="divide-y divide-stone-100">
                  {QUALITY_CRITERIA.filter((c) => c.cat === cat).map((c) => {
                    const score = auditScores[c.id];
                    return (
                      <div key={c.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2 first:pt-0">
                        <div>
                          <div className="text-sm font-medium text-stone-800">{c.label}</div>
                          {c.note && <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{c.note}</div>}
                        </div>
                        <div className="flex gap-2 self-start md:self-auto mt-1 md:mt-0">
                          <button
                            type="button"
                            onClick={() => handleSetScore(c.id, 0)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border-2 transition-all ${
                              score === 0
                                ? "bg-danger-100 text-danger-700 border-danger-400 scale-105"
                                : "bg-white text-stone-500 dark:text-stone-400 border-stone-100 hover:border-stone-200"
                            }`}
                          >
                            Non conforme
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetScore(c.id, 1)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border-2 transition-all ${
                              score === 1
                                ? "bg-warning-100 text-warning-700 border-warning-400 scale-105"
                                : "bg-white text-stone-500 dark:text-stone-400 border-stone-100 hover:border-stone-200"
                            }`}
                          >
                            Partiel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetScore(c.id, 2)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border-2 transition-all ${
                              score === 2
                                ? "bg-success-100 text-success-700 border-success-400 scale-105"
                                : "bg-white text-stone-500 dark:text-stone-400 border-stone-100 hover:border-stone-200"
                            }`}
                          >
                            Conforme
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Audit Score Calculation Box */}
          <div className="mt-8 p-6 bg-stone-50 rounded-xl border border-stone-200 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center font-bold font-mono transition-all ${
                  auditPercentage >= 80
                    ? "border-success-500 bg-success-50 text-success-700"
                    : auditPercentage >= 60
                    ? "border-warning-500 bg-warning-50 text-warning-700"
                    : "border-danger-500 bg-danger-50 text-danger-700"
                }`}
              >
                <span className="text-xl">{scoredCount > 0 ? `${auditPercentage}%` : "—"}</span>
                <span className="text-xs uppercase font-bold tracking-wider opacity-85">Score</span>
              </div>
              <div>
                <div className="font-bold text-stone-800 text-sm">Progression de l'évaluation</div>
                <div className="text-xs text-stone-500 mt-1">
                  {scoredCount} sur {QUALITY_CRITERIA.length} critères évalués — {conformesCount} conformes.
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={handleResetAudit}
                className="px-4 py-2 text-xs font-semibold bg-white hover:bg-stone-100 border border-stone-200 text-stone-600 rounded-lg transition-all"
              >
                Réinitialiser
              </button>
              <button
                type="button"
                onClick={handleSaveAudit}
                className="px-5 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-xs transition-all flex items-center gap-2"
              >
                <ClipboardCheck className="w-4 h-4" /> Sauvegarder cet audit
              </button>
            </div>
          </div>
          {saveMsg && (
            <div className="mt-2 text-center text-xs font-bold text-success-600 bg-success-50 p-2 rounded-lg border border-success-100 animate-pulse">
              ✅ Audit sauvegardé avec succès et archivé dans l'historique !
            </div>
          )}
        </div>

        {/* Audit Sidebar / History & Actions */}
        <div className="space-y-6">
          {/* History */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-warning-600" />
              Historique des Audits
            </h3>
            {audits.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-6">Aucun audit enregistré pour le moment.</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {audits.map((a) => (
                  <div key={a.id} className="p-3 bg-stone-50 border border-stone-100 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-stone-700">{a.dateFr || a.date}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Par : {a.realise || "Responsable"}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-sm font-bold font-mono px-2 py-0.5 rounded-lg border ${
                          a.score >= 80
                            ? "bg-success-50 text-success-700 border-success-200"
                            : a.score >= 60
                            ? "bg-warning-50 text-warning-700 border-warning-200"
                            : "bg-danger-50 text-danger-700 border-danger-200"
                        }`}
                      >
                        {a.score}%
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAudit(a.id)}
                        className="text-stone-500 dark:text-stone-400 hover:text-danger-600 p-1 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )}

  {/* 2. ACTIONS CORRECTIVES */}
  {activeSubTab === "actions" && (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-1">
          {/* Action Correctives Form */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-3 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary-600" />
              Nouvelle Action Corrective
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Problème identifié <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Dossiers cliniques incomplets"
                  value={acProbleme}
                  onChange={(e) => setAcProbleme(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Action à mener <span className="text-danger-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Formation de sensibilisation"
                  value={acAction}
                  onChange={(e) => setAcAction(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                    Responsable <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Nom"
                    value={acResponsable}
                    onChange={(e) => setAcResponsable(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Échéance</label>
                  <input
                    type="date"
                    value={acEcheance}
                    onChange={(e) => setAcEcheance(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Priorité</label>
                  <select
                    value={acPriorite}
                    onChange={(e) => setAcPriorite(e.target.value as any)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    <option value="Haute">🔴 Haute</option>
                    <option value="Normale">🟡 Normale</option>
                    <option value="Basse">🟢 Basse</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Statut</label>
                  <select
                    value={acStatut}
                    onChange={(e) => setAcStatut(e.target.value as any)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    <option value="En cours">En cours</option>
                    <option value="Réalisée">Réalisée</option>
                    <option value="Annulée">Annulée</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddAction}
                className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2 flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter l'action
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: List of actions */}
        <div className="lg:col-span-2">
          {/* Plans d'actions list table */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" />
          Plan de Suivi des Actions Correctives
        </h3>
        {actions.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-4 text-center">Aucune action corrective enregistrée.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Problème</th>
                  <th className="p-3">Action Corrective</th>
                  <th className="p-3">Responsable</th>
                  <th className="p-3">Échéance</th>
                  <th className="p-3">Priorité</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {actions.map((a) => (
                  <tr key={a.id} className="hover:bg-stone-50/50">
                    <td className="p-3 font-semibold text-stone-800">{a.probleme}</td>
                    <td className="p-3 text-stone-600">{a.action}</td>
                    <td className="p-3 font-medium text-stone-700">{a.responsable}</td>
                    <td className="p-3 font-mono text-stone-500">{new Date(a.echeance).toLocaleDateString("fr-FR")}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          a.priorite === "Haute"
                            ? "bg-danger-100 text-danger-800"
                            : a.priorite === "Normale"
                            ? "bg-warning-100 text-warning-800"
                            : "bg-success-100 text-success-800"
                        }`}
                      >
                        {a.priorite}
                      </span>
                    </td>
                    <td className="p-3 font-medium">
                      <select
                        value={a.statut}
                        onChange={(e) => {
                          const updated = actions.map((act) => (act.id === a.id ? { ...act, statut: e.target.value as any } : act));
                          onUpdateActions(updated);
                        }}
                        className="border border-stone-200 rounded-lg p-1 bg-white text-stone-700 focus:outline-none"
                      >
                        <option value="En cours">En cours</option>
                        <option value="Réalisée">Réalisée</option>
                        <option value="Annulée">Annulée</option>
                      </select>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteAction(a.id)}
                        className="text-stone-500 dark:text-stone-400 hover:text-danger-600 p-1 rounded-lg transition-all inline-block"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </div>
      </div>
    </div>
  )}

  {/* 3. SIGNALEMENTS D'INCIDENTS */}
  {activeSubTab === "incidents" && (
    <div className="animate-fade-in">
      {/* Incidents / adverse events card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="border-b border-stone-100 pb-3 mb-5">
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-danger-600" />
            Registre de Déclaration des Événements Indésirables (Incidents)
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Déclarez de manière confidentielle et anonyme tout dysfonctionnement pour l'amélioration des pratiques.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incident form */}
          <div className="space-y-4 bg-stone-50 border border-stone-100 rounded-xl p-5 self-start">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-warning-900">Nouveau Signalement</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={incDate}
                  onChange={(e) => setIncDate(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Gravité</label>
                <select
                  value={incGravite}
                  onChange={(e) => setIncGravite(e.target.value as any)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                >
                  <option value="faible">🟢 Faible</option>
                  <option value="modere">🟡 Modérée</option>
                  <option value="grave">🟠 Grave</option>
                  <option value="critique">🔴 Critique</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Type d'incident</label>
              <select
                value={incType}
                onChange={(e) => setIncType(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
              >
                <option value="">— Choisir —</option>
                <option value="Erreur médicamenteuse">Erreur médicamenteuse</option>
                <option value="Chute du patient">Chute du patient</option>
                <option value="Infection nosocomiale">Infection nosocomiale</option>
                <option value="Erreur d'identification">Erreur d'identification</option>
                <option value="Matériel défectueux">Matériel défectueux</option>
                <option value="Retard de prise en charge">Retard de prise en charge</option>
                <option value="Problème de communication">Problème de communication</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Personnel / Service concerné</label>
              <input
                type="text"
                placeholder="Ex: Accueil, Cabinet de consultation, etc."
                value={incPersonnel}
                onChange={(e) => setIncPersonnel(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Description détaillée</label>
              <textarea
                placeholder="Précisez les circonstances de survenue..."
                value={incDescription}
                onChange={(e) => setIncDescription(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none h-20 resize-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Mesures prises immédiatement</label>
              <textarea
                placeholder="Ex: Évacuation, soins administrés, etc."
                value={incMesures}
                onChange={(e) => setIncMesures(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none h-16 resize-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAddIncident}
              className="w-full text-xs font-bold py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              <AlertOctagon className="w-4 h-4" /> Enregistrer le signalement
            </button>
          </div>

          {/* Incident list */}
          <div className="lg:col-span-2 overflow-x-auto">
            {incidents.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 py-10 text-center">Aucun incident declared.</p>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {incidents.map((i) => (
                  <div key={i.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-2xs space-y-3 relative">
                    <button
                      type="button"
                      onClick={() => handleDeleteIncident(i.id)}
                      className="absolute top-4 right-4 text-stone-500 dark:text-stone-400 hover:text-danger-600 p-1 rounded-lg transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-mono font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-lg">
                        {new Date(i.date).toLocaleDateString("fr-FR")}
                      </span>
                      <span className="text-xs font-bold text-stone-800">{i.type}</span>
                      <span
                        className={`text-2xs uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full ${
                          i.gravite === "critique"
                            ? "bg-danger-600 text-white"
                            : i.gravite === "grave"
                            ? "bg-danger-100 text-danger-800"
                            : i.gravite === "modere"
                            ? "bg-warning-100 text-warning-800"
                            : "bg-success-100 text-success-800"
                        }`}
                      >
                        {i.gravite}
                      </span>
                      {i.personnel && <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Service : {i.personnel}</span>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-stone-50/50 p-3 rounded-lg border border-stone-100">
                      <div>
                        <strong className="text-stone-700 block mb-1">Description</strong>
                        <p className="text-stone-600 italic leading-relaxed">"{i.description}"</p>
                      </div>
                      {i.mesures && (
                        <div>
                          <strong className="text-stone-700 block mb-1">Mesures immédiates prises</strong>
                          <p className="text-stone-600 italic leading-relaxed">"{i.mesures}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )}

  {/* 5. ADMINISTRATION & BASES */}
  {activeSubTab === "admin" && (
    <div className="animate-fade-in">
      {/* Admin, Backups and Imports Panel */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="border-b border-stone-100 pb-3 mb-6">
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary-600" />
            Espace d'Administration — Sauvegardes Globale & Importations CSV d'Urgence
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Gérez et sécurisez les données de votre clinique. Utilisez l'export/import JSON pour cloner ou sauvegarder toute la clinique, et l'import CSV pour charger vos fichiers de données externes (patients, stock, etc.).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Section JSON Backup */}
          <div className="space-y-4 border-r border-stone-100 pr-0 lg:pr-8">
            <div className="flex items-center gap-2 text-stone-800 font-bold text-sm">
              <Database className="w-4.5 h-4.5 text-warning-600" />
              <span>Sauvegardes Globales (Format JSON)</span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Téléchargez un fichier de sauvegarde crypté au format JSON contenant la totalité des 24 bases de données de l'application (patients, médicaments, consultations, factures, RH, etc.) ou restaurez une ancienne sauvegarde d'urgence.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleExportJSON}
                className="flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white rounded-lg shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" /> Exporter la clinique (JSON)
              </button>

              <label className="flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold bg-warning-50 hover:bg-warning-100 border border-warning-200 text-warning-800 rounded-xl shadow-3xs transition-all cursor-pointer text-center">
                <Upload className="w-4 h-4" /> Restaurer une sauvegarde (JSON)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>
            <div className="p-3 bg-warning-50/50 border border-warning-100 rounded-xl text-xs text-warning-700 leading-normal">
              ⚠️ <strong>Important :</strong> La restauration d'une sauvegarde JSON écrase définitivement l'ensemble de vos données de session actuelles. Pensez à faire un export préalable.
            </div>
          </div>

          {/* Section CSV Import */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-stone-800 font-bold text-sm">
              <FileText className="w-4.5 h-4.5 text-primary-600" />
              <span>Chargement de Fichiers CSV (Patients, Stock, Personnel, Agenda)</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Type de données à charger
                </label>
                <select
                  value={importType}
                  onChange={(e) => {
                    setImportType(e.target.value as any);
                    setCsvFile(null);
                    setCsvFeedback(null);
                  }}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="medicament">💊 Médicaments (Stock de la Pharmacie)</option>
                  <option value="patient">👥 Patients (Registre des Consultations)</option>
                  <option value="staff">🏥 Personnel Clinique (Ressources Humaines)</option>
                  <option value="rdv">📅 Rendez-vous (Agenda)</option>
                </select>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                  Méthode de fusion des données
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode("append")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      importMode === "append"
                        ? "bg-primary-50 border-primary-400 text-primary-700"
                        : "bg-white border-stone-200 text-stone-500 dark:text-stone-400 hover:bg-stone-50"
                    }`}
                  >
                    Ajouter (Fusion)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode("overwrite")}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      importMode === "overwrite"
                        ? "bg-danger-50 border-danger-300 text-danger-700"
                        : "bg-white border-stone-200 text-stone-500 dark:text-stone-400 hover:bg-stone-50"
                    }`}
                  >
                    Remplacer (Écraser)
                  </button>
                </div>
              </div>
            </div>

            {/* Visual Sample Header Box */}
            <div className="bg-stone-50 border border-stone-150 rounded-xl p-3 space-y-1.5">
              <span className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400 block">
                Format requis des colonnes (première ligne du fichier CSV) :
              </span>
              <div className="font-mono text-xs text-primary-800 bg-primary-50/50 p-2 rounded-lg border border-primary-100 select-all whitespace-pre-wrap break-all">
                {importType === "medicament" && (
                  <>nom;forme;dosage;categorie;stock;seuil;prixAchat;prixVente;peremption;fournisseur</>
                )}
                {importType === "patient" && (
                  <>patient;age;sexe;contact;date;plainte;diagnostic;temperature;poids;tension</>
                )}
                {importType === "staff" && (
                  <>nom;poste;contact;horaire</>
                )}
                {importType === "rdv" && (
                  <>patient;date;heure;contact;type;praticien;motif;notes;statut</>
                )}
              </div>
              <span className="text-2xs text-stone-500 dark:text-stone-400 block leading-normal">
                💡 <em>Note :</em> Le séparateur peut être un point-virgule (;) ou une virgule (,). La détection est automatique. Les colonnes manquantes seront remplies par des valeurs par défaut.
              </span>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
                  setCsvFile(file);
                  setCsvFeedback(null);
                } else {
                  alert("Veuillez déposer un fichier au format .csv valide.");
                }
              }}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                isDragging
                  ? "border-primary-500 bg-primary-50/50"
                  : csvFile
                  ? "border-success-400 bg-success-50/20"
                  : "border-stone-200 hover:border-stone-300 bg-stone-50/50"
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                <Upload className={`w-6 h-6 ${csvFile ? "text-success-500" : "text-stone-500 dark:text-stone-400"}`} />
                {csvFile ? (
                  <div>
                    <span className="text-xs font-bold text-success-800 block">Fichier sélectionné :</span>
                    <span className="text-xs text-stone-600 font-mono font-medium">{csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-semibold text-stone-700 block">
                      Faites glisser votre fichier CSV ici, ou{" "}
                      <label className="text-primary-600 font-bold hover:underline cursor-pointer">
                        parcourez vos fichiers
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCsvFile(file);
                              setCsvFeedback(null);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </span>
                    <span className="text-xs text-stone-500 dark:text-stone-400">Fichiers d'encodage CSV UTF-8 uniquement</span>
                  </div>
                )}
              </div>
            </div>

            {/* Launch Import Button */}
            {csvFile && (
              <button
                type="button"
                onClick={handleImportCSVClick}
                className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Valider et importer les données
              </button>
            )}

            {csvFeedback && (
              <div className="p-3 bg-success-50 border border-success-100 rounded-xl text-xs font-bold text-success-700 text-center animate-pulse">
                {csvFeedback}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}

function SimpleMarkdownRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith("### ")) {
      elements.push(<h4 key={index} className="text-sm font-bold text-stone-800 mt-4 mb-2 uppercase tracking-wider">{parseBold(trimmed.substring(4))}</h4>);
      return;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(<h3 key={index} className="text-base font-serif font-bold text-primary-800 mt-6 mb-3 border-b border-stone-100 pb-1">{parseBold(trimmed.substring(3))}</h3>);
      return;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(<h2 key={index} className="text-lg font-serif font-semibold text-stone-900 mt-6 mb-4">{parseBold(trimmed.substring(2))}</h2>);
      return;
    }

    // List items
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <li key={index} className="text-xs text-stone-600 ml-4 list-disc py-1">
          {parseBold(trimmed.substring(2))}
        </li>
      );
      return;
    }

    // Empty line
    if (trimmed === "") {
      return;
    }

    // Standard paragraph
    elements.push(<p key={index} className="text-xs text-stone-600 leading-relaxed mb-3">{parseBold(line)}</p>);
  });

  return <div className="space-y-1">{elements}</div>;
}

function parseBold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i} className="font-bold text-stone-950">{part}</strong> : part);
}
