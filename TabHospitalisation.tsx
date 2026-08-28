/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { Hospitalisation, Evolution, Staff, FicheReference } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Home, Bed, History, FileText, ArrowRight, AlertCircle, Printer, X, Eye, Download, Send } from "lucide-react";

interface TabHospitalisationProps {
  hospitalisations: Hospitalisation[];
  evolutions: Evolution[];
  ficheReferences?: FicheReference[];
  staff: Staff[];
  onUpdateHospitalisations: (h: Hospitalisation[]) => void;
  onUpdateEvolutions: (e: Evolution[]) => void;
  onUpdateFicheReferences?: (r: FicheReference[]) => void;
  filterPatientQuery?: string;
  theme?: "light" | "dark";
}

export default function TabHospitalisation({
  hospitalisations,
  evolutions,
  ficheReferences = [],
  staff,
  onUpdateHospitalisations,
  onUpdateEvolutions,
  onUpdateFicheReferences,
  filterPatientQuery,
  theme = "light"
}: TabHospitalisationProps) {
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

  // Capacity total bed configuration
  const [hospCapacite, setHospCapacite] = useState(20);

  // New admission form states
  const [hospPatient, setHospPatient] = useState("");
  const [hospContact, setHospContact] = useState("");
  const [hospDateAdmission, setHospDateAdmission] = useState(getTodayStr());
  const [hospHeureAdmission, setHospHeureAdmission] = useState("");
  const [hospService, setHospService] = useState("Médecine générale");
  const [hospChambre, setHospChambre] = useState("");
  const [hospMedecin, setHospMedecin] = useState("");
  const [hospMotif, setHospMotif] = useState("");
  const [hospNotesInit, setHospNotesInit] = useState("");
  const [hospTypeAdmission, setHospTypeAdmission] = useState<"Hospitalisation" | "Mise en Observation (72h)">("Hospitalisation");

  // --- Fiche de référence vers un autre service/hôpital ---
  const [refHospId, setRefHospId] = useState("");
  const [refPatient, setRefPatient] = useState("");
  const [refAge, setRefAge] = useState("");
  const [refSexe, setRefSexe] = useState("");
  const [refContact, setRefContact] = useState("");
  const [refServiceActuel, setRefServiceActuel] = useState("");
  const [refStructureDestination, setRefStructureDestination] = useState("");
  const [refServiceDestination, setRefServiceDestination] = useState("");
  const [refMotifTransfert, setRefMotifTransfert] = useState("");
  const [refEtatClinique, setRefEtatClinique] = useState<"Stable" | "Sérieux" | "Critique" | "Urgence vitale">("Stable");
  const [refObservations, setRefObservations] = useState("");
  const [refMedecin, setRefMedecin] = useState("");
  const [selectedFicheReference, setSelectedFicheReference] = useState<FicheReference | null>(null);

  // Update / Discharge form states
  const [selectedHospId, setSelectedHospId] = useState("");
  const [selectedHospitalisation, setSelectedHospitalisation] = useState<Hospitalisation | null>(null);
  const [noteEvolution, setNoteEvolution] = useState("");
  const [hospDateSortie, setHospDateSortie] = useState(getTodayStr());
  const [hospStatutSortie, setHospStatutSortie] = useState("Sorti(e) guéri(e)");
  const [hospDiagnosticSortie, setHospDiagnosticSortie] = useState("");

  const handleAddHospitalisation = () => {
    if (!hospPatient.trim() || !hospMotif.trim()) {
      alert("Veuillez renseigner au moins le nom du patient et le motif d'admission.");
      return;
    }

    const newHosp: Hospitalisation = {
      id: generateUid(),
      patient: hospPatient.trim(),
      contact: hospContact.trim(),
      dateAdmission: hospDateAdmission || getTodayStr(),
      heureAdmission: hospHeureAdmission || "—",
      service: hospService,
      chambre: hospChambre.trim(),
      medecin: hospMedecin,
      motif: hospMotif.trim(),
      typeAdmission: hospTypeAdmission,
      statut: "En cours",
      dateSortie: "",
      statutSortie: "",
      diagnosticSortie: "",
      createdAt: new Date().toISOString()
    };

    onUpdateHospitalisations([newHosp, ...hospitalisations]);

    if (hospNotesInit.trim()) {
      const newEvolution: Evolution = {
        id: generateUid(),
        hospId: newHosp.id,
        date: newHosp.dateAdmission,
        note: hospNotesInit.trim(),
        createdAt: new Date().toISOString()
      };
      onUpdateEvolutions([newEvolution, ...evolutions]);
    }

    setHospPatient("");
    setHospContact("");
    setHospHeureAdmission("");
    setHospChambre("");
    setHospMotif("");
    setHospNotesInit("");
    setHospTypeAdmission("Hospitalisation");
    alert("Patient admis dans le registre d'hospitalisation.");
  };

  const handleAddEvolution = () => {
    if (!selectedHospId || !noteEvolution.trim()) {
      alert("Veuillez sélectionner un patient hospitalisé et rédiger une note d'évolution.");
      return;
    }

    const newEvolution: Evolution = {
      id: generateUid(),
      hospId: selectedHospId,
      date: getTodayStr(),
      note: noteEvolution.trim(),
      createdAt: new Date().toISOString()
    };

    onUpdateEvolutions([newEvolution, ...evolutions]);
    setNoteEvolution("");
    alert("Note d'évolution ajoutée au dossier clinique.");
  };

  const handleDischargePatient = () => {
    if (!selectedHospId) {
      alert("Veuillez choisir le dossier de patient à clore.");
      return;
    }

    const updated = hospitalisations.map((h) => {
      if (h.id === selectedHospId) {
        return {
          ...h,
          statut: hospStatutSortie as any,
          dateSortie: hospDateSortie || getTodayStr(),
          statutSortie: hospStatutSortie,
          diagnosticSortie: hospDiagnosticSortie.trim()
        };
      }
      return h;
    });

    onUpdateHospitalisations(updated);
    setSelectedHospId("");
    setHospDiagnosticSortie("");
    alert("Disculpation et sortie de patient enregistrées.");
  };

  const handleDeleteHosp = (id: string) => {
    if (confirm("Supprimer ce dossier d'hospitalisation ? Toutes les évolutions liées resteront conservées.")) {
      onUpdateHospitalisations(hospitalisations.filter((h) => h.id !== id));
    }
  };

  const handleDeleteEvolution = (id: string) => {
    onUpdateEvolutions(evolutions.filter((e) => e.id !== id));
  };

  // --- Mise en observation 72h : calcul du temps restant ---
  const getObservationStatus = (hosp: Hospitalisation) => {
    if (hosp.typeAdmission !== "Mise en Observation (72h)" || hosp.statut !== "En cours") return null;
    const heure = hosp.heureAdmission && hosp.heureAdmission !== "—" ? hosp.heureAdmission : "00:00";
    const admissionDate = new Date(`${hosp.dateAdmission}T${heure}`);
    if (isNaN(admissionDate.getTime())) return null;
    const deadline = new Date(admissionDate.getTime() + 72 * 60 * 60 * 1000);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffMs <= 0) {
      return { overdue: true, label: `⏰ Délai de 72h dépassé (depuis ${Math.abs(diffHours).toFixed(1)}h) — décision requise`, deadline };
    }
    return { overdue: false, label: `⏳ ${diffHours.toFixed(1)}h restantes avant la limite de 72h`, deadline };
  };

  // --- Fiche de référence vers un autre service/hôpital ---
  const patientsHospitalisesEnCours = hospitalisations.filter((h) => h.statut === "En cours");

  const handleSelectHospForReference = (hospId: string) => {
    setRefHospId(hospId);
    const hosp = hospitalisations.find((h) => h.id === hospId);
    if (hosp) {
      setRefPatient(hosp.patient);
      setRefContact(hosp.contact || "");
      setRefServiceActuel(hosp.service || "");
    }
  };

  const handleCreateFicheReference = () => {
    if (!refPatient.trim() || !refStructureDestination.trim() || !refMotifTransfert.trim()) {
      alert("Veuillez renseigner au moins le nom du patient, la structure de destination, et le motif du transfert.");
      return;
    }
    if (!onUpdateFicheReferences) return;

    const newRef: FicheReference = {
      id: generateUid(),
      hospId: refHospId || undefined,
      patient: refPatient.trim(),
      age: refAge ? parseFloat(refAge) : undefined,
      sexe: refSexe || undefined,
      contact: refContact.trim(),
      serviceActuel: refServiceActuel.trim(),
      structureDestination: refStructureDestination.trim(),
      serviceDestination: refServiceDestination.trim(),
      motifTransfert: refMotifTransfert.trim(),
      etatClinique: refEtatClinique,
      observationsCliniques: refObservations.trim(),
      medecinReferent: refMedecin,
      dateReference: getTodayStr(),
      heureReference: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      createdAt: new Date().toISOString()
    };

    onUpdateFicheReferences([newRef, ...ficheReferences]);

    // Si liée à une hospitalisation en cours, on marque le patient comme "Transféré(e)"
    if (refHospId) {
      const updatedHosps = hospitalisations.map((h) =>
        h.id === refHospId
          ? { ...h, statut: "Transféré(e)" as const, dateSortie: newRef.dateReference, statutSortie: "Transféré(e)", diagnosticSortie: h.diagnosticSortie || refMotifTransfert.trim() }
          : h
      );
      onUpdateHospitalisations(updatedHosps);
    }

    setRefHospId("");
    setRefPatient("");
    setRefAge("");
    setRefSexe("");
    setRefContact("");
    setRefServiceActuel("");
    setRefStructureDestination("");
    setRefServiceDestination("");
    setRefMotifTransfert("");
    setRefEtatClinique("Stable");
    setRefObservations("");
    alert("Fiche de référence créée avec succès.");
  };

  const handleDeleteFicheReference = (id: string) => {
    if (!onUpdateFicheReferences) return;
    if (confirm("Supprimer cette fiche de référence ?")) {
      onUpdateFicheReferences(ficheReferences.filter((r) => r.id !== id));
    }
  };

  const handleDownloadReferencePDF = (ref: FicheReference) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(13, 148, 136);
    doc.text(profile.name, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${profile.address} — Tél: ${profile.phone}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFillColor(240, 253, 250);
    doc.rect(margin, y, contentWidth, 9, "F");
    doc.setDrawColor(13, 148, 136);
    doc.rect(margin, y, contentWidth, 9, "S");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(13, 148, 136);
    doc.text("FICHE DE RÉFÉRENCE / ÉVACUATION VERS UNE AUTRE STRUCTURE", pageWidth / 2, y + 6, { align: "center" });
    y += 16;

    const drawRow = (label: string, value: string) => {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      doc.text(label, margin, y);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      const lines = doc.splitTextToSize(value || "—", contentWidth - 55);
      doc.text(lines, margin + 55, y);
      y += 6 * lines.length;
    };

    drawRow("Nom et prénom(s) du patient :", ref.patient);
    drawRow("Âge / Sexe :", `${ref.age ?? "—"} ans / ${ref.sexe || "—"}`);
    drawRow("Contact :", ref.contact || "—");
    drawRow("Date / Heure de référence :", `${new Date(ref.dateReference).toLocaleDateString("fr-FR")} à ${ref.heureReference || "—"}`);
    y += 2;
    drawRow("Service référent (origine) :", ref.serviceActuel || profile.name);
    drawRow("Structure de destination :", ref.structureDestination);
    drawRow("Service de destination :", ref.serviceDestination || "—");
    y += 2;

    doc.setFillColor(
      ref.etatClinique === "Urgence vitale" ? 254 : ref.etatClinique === "Critique" ? 255 : ref.etatClinique === "Sérieux" ? 255 : 240,
      ref.etatClinique === "Urgence vitale" ? 226 : ref.etatClinique === "Critique" ? 237 : ref.etatClinique === "Sérieux" ? 247 : 253,
      ref.etatClinique === "Urgence vitale" ? 226 : ref.etatClinique === "Critique" ? 213 : ref.etatClinique === "Sérieux" ? 205 : 250
    );
    doc.rect(margin, y, contentWidth, 9, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(180, 30, 30);
    doc.text(`ÉTAT CLINIQUE JUGÉ PAR LE CONSULTANT : ${ref.etatClinique.toUpperCase()}`, margin + 3, y + 6);
    y += 15;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    doc.text("Motif du transfert :", margin, y);
    y += 5;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    const motifLines = doc.splitTextToSize(ref.motifTransfert, contentWidth);
    doc.text(motifLines, margin, y);
    y += 6 * motifLines.length + 4;

    if (ref.observationsCliniques) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(70, 70, 70);
      doc.text("Observations cliniques complémentaires :", margin, y);
      y += 5;
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      const obsLines = doc.splitTextToSize(ref.observationsCliniques, contentWidth);
      doc.text(obsLines, margin, y);
      y += 6 * obsLines.length + 4;
    }

    y += 10;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(70, 70, 70);
    doc.text("Médecin / Prestataire référent :", margin, y);
    doc.setFont("Helvetica", "normal");
    doc.text(ref.medecinReferent || "—", margin + 60, y);
    y += 14;
    doc.text("Signature et cachet :", margin, y);

    doc.save(`fiche_reference_${ref.patient.replace(/\s+/g, "_")}_${ref.dateReference}.pdf`);
  };

  const handleDownloadPDF = (hosp: Hospitalisation) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const doctorName = staff.find((s) => s.id === hosp.medecin)?.nom || "Médecin Traitant";

    const margin = 15;
    const pageHeight = 297;
    const pageWidth = 210;
    const contentWidth = pageWidth - (margin * 2);

    const primaryColor = [13, 148, 136]; 
    const secondaryColor = [30, 41, 59]; 
    const lightBgColor = [245, 245, 244]; 
    const borderGray = [224, 224, 224];
    const darkGray = [100, 116, 139]; 

    let y = 20;

    const drawSectionHeader = (title: string) => {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(title.toUpperCase(), margin, y);
      y += 1.5;
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + contentWidth, y);
      y += 5;
    };

    // Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CABINET MÉDICAL DEO-GRACIAS", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("BOBO-DIOULASSO, BURKINA FASO — TÉL: +226 44 92 01 62 — SERVICE D'HOSPITALISATION INTERNE", pageWidth / 2, y, { align: "center" });
    y += 4;

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + contentWidth, y);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 1, margin + contentWidth, y + 1);
    y += 8;

    // Document Title Banner
    doc.setFillColor(236, 253, 245); 
    doc.rect(margin, y, contentWidth, 10, "F");
    doc.setDrawColor(209, 250, 229);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 10, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DOSSIER CLINIQUE & SYNTHESE D'HOSPITALISATION", pageWidth / 2, y + 6.5, { align: "center" });
    y += 16;

    // 1. Informations Générales
    drawSectionHeader("1. Informations Générales & Localisation");

    const infoGrid = [
      { k: "Patient admis :", v: hosp.patient, k2: "Service d'affectation :", v2: hosp.service },
      { k: "Chambre / Lit :", v: hosp.chambre || "—", k2: "Date d'Entrée :", v2: `${new Date(hosp.dateAdmission).toLocaleDateString("fr-FR")} ${hosp.heureAdmission}` },
      { k: "Médecin Responsable :", v: doctorName, k2: "Durée de Séjour :", v2: `${durationDays(hosp.dateAdmission, hosp.dateSortie)} Jour(s)` }
    ];

    doc.setFontSize(9);
    infoGrid.forEach((row) => {
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(row.k, margin, y);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(row.v, margin + 42, y);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(row.k2, margin + 105, y);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(row.v2, margin + 140, y);

      y += 6;
    });
    y += 4;

    // 2. Motif d'admission & Notes cliniques initiales
    drawSectionHeader("2. Diagnostic d'Entrée & Observations Cliniques");
    
    // Motif
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("MOTIF PRINCIPAL D'HOSPITALISATION :", margin, y);
    y += 4.5;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const wrappedMotif = doc.splitTextToSize(hosp.motif || "—", contentWidth - 4);
    wrappedMotif.forEach((line: string) => {
      doc.text(line, margin + 2, y);
      y += 4.5;
    });
    y += 3;

    // Notes initiales
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("NOTES CLINIQUES INITIALES À L'ENTRÉE :", margin, y);
    y += 4.5;
    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    const wrappedNotesInit = doc.splitTextToSize(`"${hosp.notesInitiales || "—"}"`, contentWidth - 4);
    wrappedNotesInit.forEach((line: string) => {
      doc.text(line, margin + 2, y);
      y += 4.5;
    });
    y += 8;

    // 3. Journal Chronologique d'Evolution
    drawSectionHeader("3. Journal Chronologique d'Évolution Clinique");
    const notesEv = evolutions.filter((e) => e.hospId === hosp.id);
    if (notesEv.length === 0) {
      doc.setFont("Helvetica", "oblique");
      doc.setFontSize(9);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("Aucune note d'évolution clinique rédigée au journal.", margin, y);
      y += 10;
    } else {
      notesEv.forEach((e) => {
        if (y > pageHeight - 35) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(new Date(e.date).toLocaleDateString("fr-FR"), margin + 2, y);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        const wrappedEvNote = doc.splitTextToSize(e.note, contentWidth - 30);
        wrappedEvNote.forEach((line: string, idx: number) => {
          doc.text(line, margin + 25, y + (idx * 4.5));
        });
        y += Math.max(6, wrappedEvNote.length * 4.5) + 2;
      });
      y += 4;
    }

    // 4. Exit discharge if any
    if (hosp.statutSortie) {
      if (y > pageHeight - 50) {
        doc.addPage();
        y = 20;
      }
      drawSectionHeader("4. Rapport Final et Résumé de Sortie");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("ISSUE MÉDICALE FINALE :", margin, y);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(hosp.statutSortie, margin + 45, y);
      y += 6;

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("DATE DE SORTIE DÉFINITIVE :", margin, y);
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(new Date(hosp.dateSortie!).toLocaleDateString("fr-FR"), margin + 45, y);
      y += 6;

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("COMPTE-RENDU DIAGNOSTIQUE DE SORTIE :", margin, y);
      y += 4.5;

      doc.setFont("Helvetica", "oblique");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      const wrappedDiagSortie = doc.splitTextToSize(`"${hosp.diagnosticSortie || "Aucun résumé de sortie saisi"}"`, contentWidth - 4);
      wrappedDiagSortie.forEach((line: string) => {
        doc.text(line, margin + 2, y);
        y += 4.5;
      });
      y += 8;
    }

    // Footer
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 25;
    }

    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.35);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text("RAPPORT GÉNÉRÉ LE :", margin, y);
    doc.setFont("Helvetica", "normal");
    doc.text(new Date().toLocaleString("fr-FR"), margin + 45, y);

    const sigX = margin + 115;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("Le Praticien Chef de Service", sigX, y);
    
    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(8.5);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(doctorName, sigX, y + 4.5);

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(240, 253, 250);
    doc.rect(sigX, y + 7.5, contentWidth - 115, 12, "F");
    doc.rect(sigX, y + 7.5, contentWidth - 115, 12, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("CACHET & SIGNATURE INTERNAT", sigX + 2, y + 15.5);

    doc.save(`dossier_hospitalisation_${hosp.patient.toLowerCase().replace(/\s+/g, "_")}.pdf`);
  };

  // Certificat d'hospitalisation ou de mise en observation, à délivrer au
  // patient ou à sa famille (ex : justificatif pour l'employeur, l'école, etc.)
  const handleDownloadCertificat = (hosp: Hospitalisation) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = 210;
    const contentWidth = pageWidth - margin * 2;

    const primaryColor = [13, 148, 136];
    const darkGray = [100, 116, 139];
    const secondaryColor = [30, 41, 59];

    const doctorName = staff.find((s) => s.id === hosp.medecin)?.nom || "Médecin Traitant";
    const isObservation = hosp.typeAdmission === "Mise en Observation (72h)";
    const titre = isObservation ? "CERTIFICAT DE MISE EN OBSERVATION" : "CERTIFICAT D'HOSPITALISATION";
    const estToujoursPresent = hosp.statut === "En cours";

    let y = 20;

    // En-tête établissement
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(profile.name || "CABINET MÉDICAL DEO-GRACIAS", pageWidth / 2, y, { align: "center" });
    y += 5;

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(`${profile.address || ""} — Tél: ${profile.phone || ""}`, pageWidth / 2, y, { align: "center" });
    y += 4;

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.8);
    doc.line(margin, y, margin + contentWidth, y);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 1, margin + contentWidth, y + 1);
    y += 14;

    // Titre du certificat
    doc.setFillColor(236, 253, 245);
    doc.rect(margin, y, contentWidth, 12, "F");
    doc.setDrawColor(209, 250, 229);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 12, "S");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(titre, pageWidth / 2, y + 8, { align: "center" });
    y += 24;

    // Corps du texte
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);

    const dateAdmissionFr = new Date(hosp.dateAdmission).toLocaleDateString("fr-FR");
    const dateSortieFr = hosp.dateSortie ? new Date(hosp.dateSortie).toLocaleDateString("fr-FR") : "";
    const dateAujourdhui = new Date().toLocaleDateString("fr-FR");

    let corps: string;
    if (isObservation) {
      corps = estToujoursPresent
        ? `Je soussigné(e), Docteur ${doctorName}, certifie que le patient ${hosp.patient} a été admis(e) en mise en observation dans notre établissement le ${dateAdmissionFr} à ${hosp.heureAdmission}, pour le motif suivant : ${hosp.motif}.\n\nÀ ce jour, le patient demeure sous surveillance médicale au sein de notre service.`
        : `Je soussigné(e), Docteur ${doctorName}, certifie que le patient ${hosp.patient} a été admis(e) en mise en observation dans notre établissement du ${dateAdmissionFr} à ${hosp.heureAdmission} au ${dateSortieFr}, pour le motif suivant : ${hosp.motif}.`;
    } else {
      corps = estToujoursPresent
        ? `Je soussigné(e), Docteur ${doctorName}, certifie que le patient ${hosp.patient} est actuellement hospitalisé(e) dans notre établissement depuis le ${dateAdmissionFr} à ${hosp.heureAdmission}, pour le motif suivant : ${hosp.motif}.\n\nÀ ce jour, le patient demeure hospitalisé(e) au sein de notre service.`
        : `Je soussigné(e), Docteur ${doctorName}, certifie que le patient ${hosp.patient} a été hospitalisé(e) dans notre établissement du ${dateAdmissionFr} à ${hosp.heureAdmission} au ${dateSortieFr}, pour le motif suivant : ${hosp.motif}.`;
    }

    const corpsLines = doc.splitTextToSize(corps, contentWidth);
    doc.text(corpsLines, margin, y, { lineHeightFactor: 1.6 });
    y += corpsLines.length * 6.5 + 10;

    doc.setFont("Helvetica", "italic");
    doc.setFontSize(10);
    const mentionLines = doc.splitTextToSize(
      "Le présent certificat est délivré à l'intéressé(e) pour servir et valoir ce que de droit.",
      contentWidth
    );
    doc.text(mentionLines, margin, y);
    y += mentionLines.length * 6 + 16;

    // Date et lieu de délivrance
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text(`Fait à Bobo-Dioulasso, le ${dateAujourdhui}`, margin, y);
    y += 20;

    // Signature
    const sigX = margin + contentWidth - 75;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("Le Médecin", sigX, y);

    doc.setFont("Helvetica", "oblique");
    doc.setFontSize(8.5);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text(doctorName, sigX, y + 4.5);

    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.3);
    doc.setFillColor(240, 253, 250);
    doc.rect(sigX, y + 7.5, 60, 14, "F");
    doc.rect(sigX, y + 7.5, 60, 14, "S");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(profile.stampText || "CACHET & SIGNATURE", sigX + 2, y + 16);

    const typeFichier = isObservation ? "certificat_observation" : "certificat_hospitalisation";
    doc.save(`${typeFichier}_${hosp.patient.toLowerCase().replace(/\s+/g, "_")}.pdf`);
  };

  // Calculations
  const enCours = hospitalisations.filter((h) => h.statut === "En cours");
  const sorties = hospitalisations.filter((h) => h.statut !== "En cours");
  const occupationRate = Math.round((enCours.length / hospCapacite) * 100);

  const admissionToday = hospitalisations.filter((h) => h.dateAdmission === getTodayStr()).length;
  const sortiesToday = sorties.filter((h) => h.dateSortie === getTodayStr()).length;

  const durationDays = (d1: string, d2: string): number => {
    const start = new Date(d1);
    const end = new Date(d2 || getTodayStr());
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  };

  const totalSortiesDays = sorties.map((h) => durationDays(h.dateAdmission, h.dateSortie));
  const avgStayDays = totalSortiesDays.length > 0 ? Math.round((totalSortiesDays.reduce((a, b) => a + b, 0) / totalSortiesDays.length) * 10) / 10 : null;

  const prolongedStays = enCours.filter((h) => durationDays(h.dateAdmission, "") > 10).length;

  // Search/Filter for hospitalisations list
  const filteredEnCours = enCours.filter((h) => {
    if (!filterPatientQuery) return true;
    const q = filterPatientQuery.toLowerCase().trim();
    return h.patient.toLowerCase().includes(q) || h.id.toLowerCase().includes(q) || (h.contact && h.contact.includes(q));
  });

  const filteredSorties = sorties.filter((h) => {
    if (!filterPatientQuery) return true;
    const q = filterPatientQuery.toLowerCase().trim();
    return h.patient.toLowerCase().includes(q) || h.id.toLowerCase().includes(q) || (h.contact && h.contact.includes(q));
  });

  // Bed Distribution per service
  const serviceDistribution: Record<string, number> = {};
  enCours.forEach((h) => {
    serviceDistribution[h.service] = (serviceDistribution[h.service] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{enCours.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Hospitalisés</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Actuellement présents</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-success-600">
          <div className="text-3xl font-semibold text-success-700 font-serif">{occupationRate}%</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Occupation</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {enCours.length} / {hospCapacite} lits configurés
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{admissionToday}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Admissions Jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Aujourd'hui</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-purple-600">
          <div className="text-3xl font-semibold text-purple-700 font-serif">{sortiesToday}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Sorties Jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Sortis aujourd'hui</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{avgStayDays !== null ? `${avgStayDays} j` : "—"}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Durée de séjour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Moyenne sorties clos</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{prolongedStays}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Séjours longs</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">&gt; 10 jours d'admiss.</div>
        </div>
      </div>

      {filterPatientQuery && (
        <div className="bg-primary-50 border border-primary-200 text-primary-800 p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-3xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse"></span>
            <span>Filtre de recherche global actif en hospitalisation : <strong>"{filterPatientQuery}"</strong></span>
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400 font-normal italic">Saisie dans le moteur global</span>
        </div>
      )}

      {/* Bed occupancy config slider */}
      <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Bed className="w-5 h-5 text-primary-700" />
          <span className="text-sm font-bold text-stone-800">Configurer la capacité totale de lits :</span>
          <input
            type="number"
            min="1"
            max="100"
            value={hospCapacite}
            placeholder="Ex: 20"
            onChange={(e) => setHospCapacite(parseInt(e.target.value) || 20)}
            className="w-20 text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 focus:bg-white text-center font-bold"
          />
        </div>
        <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold uppercase">
          Taux critique d'alerte lits saturés : ≥ 90%
        </div>
      </div>

      {occupationRate >= 90 && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0" />
          <span>
            <strong>ALERTE SATURATION :</strong> La capacité de l'Espace Hospitalisation est presque atteinte ({occupationRate}%).
          </span>
        </div>
      )}

      {/* Service Allocation Chart */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          Répartition des lits occupés par Service Clinique
        </h3>
        {enCours.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-4 text-center italic">Aucun lit occupé actuellement.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(serviceDistribution).map(([serv, count]) => {
              const maxServCount = Math.max(...Object.values(serviceDistribution), 1);
              const w = Math.round((count / maxServCount) * 100);
              return (
                <div key={serv}>
                  <div className="flex justify-between text-xs font-semibold text-stone-600 mb-1">
                    <span>{serv}</span>
                    <span className="font-bold text-primary-700">{count} patient(s)</span>
                  </div>
                  <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-600 rounded-full" style={{ width: `${w}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admission Form */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Nouvelle Hospitalisation / Admission
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom du patient *</label>
                <input
                  type="text"
                  placeholder="Nom complet"
                  value={hospPatient}
                  onChange={(e) => setHospPatient(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Téléphone</label>
                <input
                  type="tel"
                  placeholder="+226..."
                  value={hospContact}
                  onChange={(e) => setHospContact(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date d'admission</label>
                <input
                  type="date"
                  value={hospDateAdmission}
                  onChange={(e) => setHospDateAdmission(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Heure d'admission</label>
                <input
                  type="time"
                  value={hospHeureAdmission}
                  onChange={(e) => setHospHeureAdmission(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Type d'admission</label>
              <select
                value={hospTypeAdmission}
                onChange={(e) => setHospTypeAdmission(e.target.value as "Hospitalisation" | "Mise en Observation (72h)")}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-semibold"
              >
                <option value="Hospitalisation">Hospitalisation classique</option>
                <option value="Mise en Observation (72h)">Mise en Observation (72 heures)</option>
              </select>
              {hospTypeAdmission === "Mise en Observation (72h)" && (
                <p className="text-xs text-warning-700 italic mt-1">
                  ⏳ Un compte à rebours de 72h démarrera à l'admission. Une alerte apparaîtra dans la liste une fois le délai écoulé, pour décider d'une sortie ou d'une hospitalisation complète.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Service d'affectation</label>
                <select
                  value={hospService}
                  onChange={(e) => setHospService(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Médecine générale">Médecine générale</option>
                  <option value="Chirurgie">Chirurgie</option>
                  <option value="Maternité / Gynécologie">Maternité / Gynécologie</option>
                  <option value="Pédiatrie">Pédiatrie</option>
                  <option value="Réanimation / Soins intensifs">Réanimation</option>
                  <option value="Observation / Urgences">Urgences / Observation</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Chambre / Lit</label>
                <input
                  type="text"
                  placeholder="Ex: Chambre 3 / Lit B"
                  value={hospChambre}
                  onChange={(e) => setHospChambre(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Médecin Référent</label>
              <select
                value={hospMedecin}
                onChange={(e) => setHospMedecin(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              >
                <option value="">— Non assigné —</option>
                {staff
                  .filter((s) => s.poste === "Médecin")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Motif principal d'hospitalisation *</label>
              <input
                type="text"
                placeholder="Ex: Paludisme grave à forme anémique"
                value={hospMotif}
                onChange={(e) => setHospMotif(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Observations initiales à l'admission (Symptômes...)</label>
              <textarea
                placeholder="Saisir la note d'admission..."
                value={hospNotesInit}
                onChange={(e) => setHospNotesInit(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAddHospitalisation}
              className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2"
            >
              Admettre le patient
            </button>
          </div>
        </div>

        {/* Note evolution & Discharge Block */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-warning-600" />
            Évolution Journalière & Rapport de Sortie
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sélectionner le patient hospitalisé *</label>
              <select
                value={selectedHospId}
                onChange={(e) => setSelectedHospId(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              >
                <option value="">— Choisir —</option>
                {enCours.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.patient} — {h.chambre || "Sans lit spécifié"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Ajouter une note d'évolution clinique</label>
              <textarea
                placeholder="Ex: Fièvre en baisse (37.2°C). Sommeil réparateur. Tolère l'alimentation solide."
                value={noteEvolution}
                onChange={(e) => setNoteEvolution(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-20 resize-none"
              />
              <button
                type="button"
                onClick={handleAddEvolution}
                className="w-full text-xs font-bold py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg transition-all mt-2"
              >
                📝 Consigner cette observation
              </button>
            </div>

            <div className="border-t border-stone-100 pt-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-danger-800">Enregistrer la Sortie Définitive</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date de sortie</label>
                  <input
                    type="date"
                    value={hospDateSortie}
                    onChange={(e) => setHospDateSortie(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Condition de sortie</label>
                  <select
                    value={hospStatutSortie}
                    onChange={(e) => setHospStatutSortie(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    <option value="Sorti(e) guéri(e)">🟢 Sorti(e) guéri(e)</option>
                    <option value="Transféré(e)">🟡 Référencé / Transféré</option>
                    <option value="Sortie contre avis médical">🟠 Sortie contre avis</option>
                    <option value="Décès">⚫ Décès clinique</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Résumé diagnostique final de sortie</label>
                <textarea
                  placeholder="Ex: Évolution clinique favorable sous quinine IV puis ACT PO. Guérison clinique."
                  value={hospDiagnosticSortie}
                  onChange={(e) => setHospDiagnosticSortie(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleDischargePatient}
                className="w-full text-xs font-bold py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5"
              >
                <ArrowRight className="w-4 h-4 text-danger-300" /> Clore le séjour et libérer le lit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hospitalized Patients List Table */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <Bed className="w-5 h-5 text-primary-700" />
          Patients Actuellement Alités (En cours de séjour)
        </h3>
        {filteredEnCours.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun patient hospitalisé correspondant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Patient</th>
                  <th className="p-3">Service</th>
                  <th className="p-3">Chambre / Lit</th>
                  <th className="p-3 text-center">Admission</th>
                  <th className="p-3 text-center">Durée active</th>
                  <th className="p-3 text-center">Type / Alerte</th>
                  <th className="p-3">Médecin référent</th>
                  <th className="p-3">Diagnostic initial</th>
                  <th className="p-3 text-center">Fiche / Dossier</th>
                  <th className="p-3 text-center">Clôture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredEnCours.map((h) => {
                  const doc = staff.find((s) => s.id === h.medecin);
                  const days = durationDays(h.dateAdmission, "");
                  return (
                    <tr key={h.id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-bold text-stone-800">{h.patient}</td>
                      <td className="p-3 text-stone-600 font-semibold">{h.service}</td>
                      <td className="p-3 font-mono text-stone-500">{h.chambre || "—"}</td>
                      <td className="p-3 text-center font-mono">
                        {new Date(h.dateAdmission).toLocaleDateString("fr-FR")} {h.heureAdmission}
                      </td>
                      <td className={`p-3 text-center font-bold font-mono ${days > 10 ? "text-danger-600" : "text-stone-700"}`}>{days} j</td>
                      <td className="p-3 text-center">
                        {h.typeAdmission === "Mise en Observation (72h)" ? (
                          (() => {
                            const obs = getObservationStatus(h);
                            return (
                              <span
                                className={`inline-block text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap ${
                                  obs?.overdue
                                    ? "bg-danger-100 text-danger-700 border border-danger-300 animate-pulse"
                                    : "bg-warning-50 text-warning-700 border border-warning-200"
                                }`}
                                title={obs?.label}
                              >
                                {obs?.overdue ? "⏰ 72h dépassées" : obs?.label.split("—")[0]}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-stone-400 italic">Hospitalisation</span>
                        )}
                      </td>
                      <td className="p-3 text-stone-600 font-medium">{doc ? doc.nom : "—"}</td>
                      <td className="p-3 text-stone-500 italic truncate max-w-[200px]" title={h.motif}>
                        {h.motif}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          <button
                            type="button"
                            onClick={() => setSelectedHospitalisation(h)}
                            className="bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-lg border border-primary-200 transition-all inline-flex items-center gap-1 w-full justify-center"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Dossier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadCertificat(h)}
                            title={h.typeAdmission === "Mise en Observation (72h)" ? "Certificat de mise en observation" : "Certificat d'hospitalisation"}
                            className="bg-success-50 hover:bg-success-100 text-success-700 text-xs font-bold px-2 py-1 rounded-lg border border-success-200 transition-all inline-flex items-center gap-1 w-full justify-center"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Certificat
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedHospId(h.id);
                            document.getElementById("ancreSortie")?.scrollIntoView({ behavior: "smooth" });
                          }}
                          className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold px-2 py-1 rounded-lg border border-stone-200 transition-all inline-block"
                        >
                          Disculper Sortie
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

      {/* Fiche de Référence / Évacuation vers un autre service ou hôpital */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-primary-700" />
          Fiche de Référence vers un Autre Service / Hôpital
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulaire de création */}
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Patient hospitalisé (optionnel)</label>
              <select
                value={refHospId}
                onChange={(e) => handleSelectHospForReference(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              >
                <option value="">— Saisie manuelle (patient non listé ici) —</option>
                {patientsHospitalisesEnCours.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.patient} — {h.service}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom du patient *</label>
                <input
                  type="text"
                  value={refPatient}
                  onChange={(e) => setRefPatient(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Âge</label>
                <input
                  type="number"
                  value={refAge}
                  onChange={(e) => setRefAge(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sexe</label>
                <select
                  value={refSexe}
                  onChange={(e) => setRefSexe(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="Masculin">M</option>
                  <option value="Féminin">F</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Structure de destination *</label>
              <input
                type="text"
                placeholder="Ex: CHU Sourô Sanou, CMA de..."
                value={refStructureDestination}
                onChange={(e) => setRefStructureDestination(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Service de destination</label>
              <input
                type="text"
                placeholder="Ex: Réanimation, Chirurgie..."
                value={refServiceDestination}
                onChange={(e) => setRefServiceDestination(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">
                État clinique jugé par le consultant *
              </label>
              <select
                value={refEtatClinique}
                onChange={(e) => setRefEtatClinique(e.target.value as "Stable" | "Sérieux" | "Critique" | "Urgence vitale")}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
              >
                <option value="Stable">🟢 Stable</option>
                <option value="Sérieux">🟡 Sérieux</option>
                <option value="Critique">🟠 Critique</option>
                <option value="Urgence vitale">🔴 Urgence vitale</option>
              </select>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Motif du transfert *</label>
              <textarea
                placeholder="Ex: Plateau technique insuffisant, nécessite réanimation et bloc opératoire d'urgence"
                value={refMotifTransfert}
                onChange={(e) => setRefMotifTransfert(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Observations cliniques complémentaires</label>
              <textarea
                placeholder="Constantes, traitement déjà administré, éléments utiles à l'équipe receveuse..."
                value={refObservations}
                onChange={(e) => setRefObservations(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Médecin / Prestataire référent</label>
              <select
                value={refMedecin}
                onChange={(e) => setRefMedecin(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              >
                <option value="">— Non assigné —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.nom}>
                    {s.nom} ({s.poste})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleCreateFicheReference}
              className="w-full text-xs font-bold py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              Créer la Fiche de Référence
            </button>
            {refHospId && (
              <p className="text-xs text-stone-500 dark:text-stone-400 italic">
                Ce patient sera automatiquement marqué "Transféré(e)" dans le registre d'hospitalisation.
              </p>
            )}
          </div>

          {/* Liste des fiches déjà émises */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">Fiches déjà émises ({ficheReferences.length})</h4>
            {ficheReferences.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic border border-dashed border-stone-200 rounded-xl">
                Aucune fiche de référence émise pour le moment.
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {ficheReferences.map((ref) => (
                  <div key={ref.id} className="border border-stone-200 rounded-xl p-3 hover:border-primary-300 transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-stone-800">{ref.patient}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                          ref.etatClinique === "Urgence vitale"
                            ? "bg-danger-100 text-danger-700"
                            : ref.etatClinique === "Critique"
                            ? "bg-orange-100 text-orange-700"
                            : ref.etatClinique === "Sérieux"
                            ? "bg-warning-100 text-warning-700"
                            : "bg-success-100 text-success-700"
                        }`}
                      >
                        {ref.etatClinique}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      Vers : <span className="font-semibold">{ref.structureDestination}</span> {ref.serviceDestination ? `(${ref.serviceDestination})` : ""}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic truncate" title={ref.motifTransfert}>
                      {ref.motifTransfert}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-mono text-stone-400">
                        {new Date(ref.dateReference).toLocaleDateString("fr-FR")} {ref.heureReference}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadReferencePDF(ref)}
                          className="text-primary-600 hover:text-primary-800 transition-all"
                          title="Télécharger le PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFicheReference(ref.id)}
                          className="text-danger-500 hover:text-danger-700 transition-all"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clinical Progression diary journal */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-700" />
          Journal d'Évolution Clinique et d'Observations Quotidiennes
        </h3>
        {evolutions.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucune note d'évolution clinique consignée.</p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto pr-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                  <th className="p-2 w-28">Date d'observation</th>
                  <th className="p-2">Patient hospitalisé</th>
                  <th className="p-2">Observation / Note d'Évolution</th>
                  <th className="p-2 text-center">Retirer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {evolutions.map((e) => {
                  const h = hospitalisations.find((item) => item.id === e.hospId);
                  return (
                    <tr key={e.id} className="hover:bg-stone-50/50">
                      <td className="p-2 font-mono text-stone-500 dark:text-stone-400">{new Date(e.date).toLocaleDateString("fr-FR")}</td>
                      <td className="p-2 font-bold text-stone-800">{h ? h.patient : "—"}</td>
                      <td className="p-2 text-stone-600 font-semibold italic">"{e.note}"</td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteEvolution(e.id)}
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

      {/* Discharge / History Table Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-stone-600" />
          Registre Historique des Hospitalisations Consommées (Patients Sortis)
        </h3>
        {filteredSorties.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun historique correspondant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Patient</th>
                  <th className="p-3">Service</th>
                  <th className="p-3 text-center">Admission</th>
                  <th className="p-3 text-center">Date Sortie</th>
                  <th className="p-3 text-center">Séjour effectif</th>
                  <th className="p-3 text-center">Issue médicale</th>
                  <th className="p-3">Compte-rendu final de sortie</th>
                  <th className="p-3 text-center">Fiche / Dossier</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSorties.map((h) => {
                  const dur = durationDays(h.dateAdmission, h.dateSortie);
                  return (
                    <tr key={h.id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-semibold text-stone-700">{h.patient}</td>
                      <td className="p-3 text-stone-500">{h.service}</td>
                      <td className="p-3 text-center font-mono text-stone-500 dark:text-stone-400">{new Date(h.dateAdmission).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3 text-center font-mono text-stone-500 dark:text-stone-400">{new Date(h.dateSortie).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3 text-center font-bold font-mono">{dur} j</td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${
                            h.statutSortie === "Sorti(e) guéri(e)"
                              ? "bg-success-100 text-success-800"
                              : h.statutSortie === "Transféré(e)"
                              ? "bg-blue-100 text-blue-800"
                              : h.statutSortie === "Sortie contre avis médical"
                              ? "bg-warning-100 text-warning-800"
                              : "bg-danger-100 text-danger-800"
                          }`}
                        >
                          {h.statutSortie}
                        </span>
                      </td>
                      <td className="p-3 text-stone-600 font-medium italic truncate max-w-[200px]" title={h.diagnosticSortie}>
                        {h.diagnosticSortie || "—"}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedHospitalisation(h)}
                          className="bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-lg border border-primary-200 transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Dossier
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteHosp(h.id)}
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

      {/* Hospitalisation Detail Modal (Printable) */}
      {selectedHospitalisation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print">
          <div className={`w-full max-w-4xl rounded-2xl shadow-xl border overflow-hidden max-h-[90vh] flex flex-col ${
            theme === "dark" ? "bg-stone-900 border-stone-800 text-stone-100" : "bg-white border-stone-200 text-stone-800"
          }`}>
            {/* Modal Header */}
            <div className={`p-4 border-b flex justify-between items-center no-print ${
              theme === "dark" ? "border-stone-800" : "border-stone-100"
            }`}>
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary-600" />
                <h3 className="font-serif font-bold text-base">Fiche Clinique & Synthèse d'Hospitalisation</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadPDF(selectedHospitalisation)}
                  className="bg-success-600 hover:bg-success-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Télécharger le PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCertificat(selectedHospitalisation)}
                  className="bg-info-600 hover:bg-info-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  {selectedHospitalisation.typeAdmission === "Mise en Observation (72h)" ? "Certificat d'observation" : "Certificat d'hospitalisation"}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  Imprimer la fiche
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedHospitalisation(null)}
                  className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
            </div>

            {/* Modal Content / Printable Document */}
            <div className="flex-1 overflow-y-auto p-8 print-full-width print:p-0 print:overflow-visible">
              <div className="print-card space-y-8">
                {/* Header for print */}
                <div className="border-b-4 border-double border-primary-600 pb-4 text-center">
                  <h1 className="text-2xl font-serif font-semibold text-primary-700 uppercase tracking-wide">{profile.name}</h1>
                  <p className="text-xs font-mono uppercase tracking-widest text-stone-500 mt-1">{profile.address} — Tél/WhatsApp: {profile.phone} — {profile.slogan}</p>
                  <div className="mt-4 bg-primary-50 text-primary-800 py-1.5 px-4 rounded-full font-serif font-bold text-sm tracking-wide inline-block border border-primary-100">
                    DOSSIER CLINIQUE ET SYNTHESE D'HOSPITALISATION
                  </div>
                </div>

                {/* Patient Information Section */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-3">1. Informations Générales & Localisation</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Patient admis :</span>
                      <p className={`font-semibold text-sm mt-0.5 ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedHospitalisation.patient}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Service d'Affectation :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedHospitalisation.service}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Chambre / Numéro Lit :</span>
                      <p className={`font-mono font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedHospitalisation.chambre || "Non spécifié"}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Date d'Entrée :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>
                        {new Date(selectedHospitalisation.dateAdmission).toLocaleDateString("fr-FR")} {selectedHospitalisation.heureAdmission}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Médecin responsable :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>
                        {staff.find((s) => s.id === selectedHospitalisation.medecin)?.nom || "Médecin Traitant"}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Durée de Séjour :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>
                        {durationDays(selectedHospitalisation.dateAdmission, selectedHospitalisation.dateSortie)} Jour(s)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Context of admission */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-3">2. Diagnostic d'Entrée & Observations Cliniques Initiales</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-4 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-xs font-bold text-stone-450 uppercase block mb-1">Motif principal d'hospitalisation</span>
                      <p className={`text-xs font-bold ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedHospitalisation.motif}</p>
                    </div>
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-4 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-xs font-bold text-stone-450 uppercase block mb-1">Notes cliniques initiales</span>
                      <p className="text-xs italic text-stone-600 font-semibold">"{selectedHospitalisation.notesInitiales || "—"}"</p>
                    </div>
                  </div>
                </div>

                {/* Progression Diary Section */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-3">3. Journal Chronologique d'Évolution Clinique</h3>
                  {evolutions.filter((e) => e.hospId === selectedHospitalisation.id).length === 0 ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic py-3">Aucune note d'évolution enregistrée au journal.</p>
                  ) : (
                    <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 text-xs">
                      {evolutions
                        .filter((e) => e.hospId === selectedHospitalisation.id)
                        .map((e) => (
                          <div key={e.id} className={`p-3 flex items-start gap-4 ${theme === "dark" ? "bg-stone-850" : "bg-white"}`}>
                            <span className="font-mono font-semibold text-stone-500 dark:text-stone-400 shrink-0 w-24">
                              {new Date(e.date).toLocaleDateString("fr-FR")}
                            </span>
                            <div className="flex-1">
                              <p className={`font-semibold ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{e.note}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Exit discharge summary section if discharged */}
                {selectedHospitalisation.statutSortie && (
                  <div className={`p-4 rounded-xl border ${
                    theme === "dark" ? "bg-stone-800 border-stone-700 text-stone-100" : "bg-primary-50/50 border-primary-150 text-primary-950"
                  }`}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 mb-2">4. Rapport Final et Résumé de Sortie</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-stone-450 font-bold uppercase text-2xs block">Issue Médicale Finale :</span>
                        <span className="font-semibold text-sm block mt-0.5 text-primary-700">{selectedHospitalisation.statutSortie}</span>
                      </div>
                      <div>
                        <span className="text-stone-450 font-bold uppercase text-2xs block">Date de Sortie Définitive :</span>
                        <span className="font-bold block mt-0.5">{new Date(selectedHospitalisation.dateSortie!).toLocaleDateString("fr-FR")}</span>
                      </div>
                      <div className="md:col-span-2 mt-2">
                        <span className="text-stone-450 font-bold uppercase text-2xs block">Compte-rendu Diagnostique Final :</span>
                        <p className="font-semibold italic text-stone-700 dark:text-stone-300 mt-1">
                          "{selectedHospitalisation.diagnosticSortie || "Aucun résumé de sortie saisi"}"
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Signatures */}
                <div className="pt-8 border-t border-dashed border-stone-200 flex justify-between text-xs">
                  <div>
                    <p className="font-bold text-stone-450 uppercase text-2xs">Généré le :</p>
                    <p className="font-mono text-stone-500">{new Date().toLocaleString("fr-FR")}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${theme === "dark" ? "text-white" : "text-stone-800"}`}>Le Praticien Chef de Service</p>
                    <p className="text-stone-500 italic mt-0.5">
                      {staff.find((s) => s.id === selectedHospitalisation.medecin)?.nom || "Médecin Traitant Référent"}
                    </p>
                    <div className="mt-4 border border-dashed border-primary-500 text-primary-600 inline-block px-4 py-2 rounded-lg font-bold uppercase text-2xs">
                      Cachet & Signature Service Internat
                    </div>
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
