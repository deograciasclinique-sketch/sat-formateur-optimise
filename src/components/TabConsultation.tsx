/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { jsPDF } from "jspdf";
import { logActivity } from "../lib/activityLogger";
import { Consultation, LigneOrdonnance, Medicament, Staff, ExamenLabo, Hospitalisation, PatientUrgence, MouvementStock, DocumentArchive } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Search, FileText, Activity, Clock, MessageCircle, Heart, Eye, CheckCircle, Printer, X, Download, Camera, Upload, FlaskConical, ArrowRight , Mic, MicOff} from "lucide-react";
import CameraCapture from "./CameraCapture";

interface TabConsultationProps {
  isLoading?: boolean;
  consultations: Consultation[];
  medicaments: Medicament[];
  staff: Staff[];
  onUpdateConsultations: (consults: Consultation[]) => void;
  filterPatientQuery?: string;
  theme?: "light" | "dark";
  currentUser?: Staff | null;
  laboExamens?: ExamenLabo[];
  rdvs?: any[];
  onUpdateLaboExamens?: (examens: ExamenLabo[]) => void;
  // Cahier des charges points 1-3 : la décision d'hospitalisation/mise en
  // observation/admission aux urgences se prend en Consultation Générale, et
  // doit créer automatiquement le dossier correspondant dans le bon module.
  hospitalisations?: Hospitalisation[];
  onUpdateHospitalisations?: (hosps: Hospitalisation[]) => void;
  urgences?: PatientUrgence[];
  onUpdateUrgences?: (urgences: PatientUrgence[]) => void;
  // Cahier des charges point 6.3 : déduction automatique du stock pour chaque
  // médicament prescrit en consultation.
  onUpdateMedicaments?: (meds: Medicament[]) => void;
  mouvements?: MouvementStock[];
  onUpdateMouvements?: (movs: MouvementStock[]) => void;
  // Registre par patient (regroupement du dossier) : documents scannés et
  // examens de laboratoire liés à chaque patient, affichés dans son dossier.
  documents?: DocumentArchive[];
}

export default function TabConsultation({
  consultations,
  medicaments,
  staff,
  onUpdateConsultations,
  filterPatientQuery,
  theme = "light",
  currentUser,
  laboExamens = [],
  onUpdateLaboExamens,
  isLoading,
  rdvs = [],
  hospitalisations = [],
  onUpdateHospitalisations,
  urgences = [],
  onUpdateUrgences,
  onUpdateMedicaments,
  mouvements = [],
  onUpdateMouvements,
  documents = [],
}: TabConsultationProps) {
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

  // General Consultation Form states
  const [consPatient, setConsPatient] = useState("");
  const [consAge, setConsAge] = useState("");
  const [consSexe, setConsSexe] = useState("Masculin");
    const [consContact, setConsContact] = useState("");
  const [consProfession, setConsProfession] = useState("");
  const [consFemmeEnceinte, setConsFemmeEnceinte] = useState(false);
  const [consCommune, setConsCommune] = useState("");
  const [consVillageSecteur, setConsVillageSecteur] = useState("");
  const [consZoneResidence, setConsZoneResidence] = useState("");
  const [consModeEntree, setConsModeEntree] = useState("");
  const [consAncienConsultant, setConsAncienConsultant] = useState(false);
  const [consObservations, setConsObservations] = useState("");
  const [consDate, setConsDate] = useState(getTodayStr());
  const [consMedecin, setConsMedecin] = useState(currentUser?.id || "");
  // Décision de Consultation Générale (cahier des charges, points 1-3)
  const [consDecision, setConsDecision] = useState<NonNullable<Consultation["decision"]>>("Retour à domicile");
  const [consReferenceService, setConsReferenceService] = useState("");

  useEffect(() => {
    if (currentUser?.id && !consMedecin) {
      setConsMedecin(currentUser.id);
    }
  }, [currentUser, consMedecin]);

  // Vitals states
  const [vTemp, setVTemp] = useState("");
  const [vPoids, setVPoids] = useState("");
  const [vTaille, setVTaille] = useState("");
  const [vTa, setVTa] = useState("");
  const [vPouls, setVPouls] = useState("");
  const [vGlycemie, setVGlycemie] = useState("");

  // Live BMI / IMC calculation
  const weightVal = parseFloat(vPoids) || 0;
  const heightVal = parseFloat(vTaille) || 0;
  let computedImc: number | null = null;
  let imcStatus = "";
  let imcColor = "text-stone-500 bg-stone-100 border-stone-200";
  if (weightVal > 0 && heightVal > 0) {
    const heightM = heightVal / 100;
    computedImc = weightVal / (heightM * heightM);
    if (computedImc < 18.5) {
      imcStatus = "Insuffisance pondérale (Maigreur)";
      imcColor = "text-warning-600 bg-warning-50 dark:bg-warning-950/20 border-warning-200/50";
    } else if (computedImc < 25) {
      imcStatus = "Corpulence normale";
      imcColor = "text-success-600 bg-success-50 dark:bg-success-950/20 border-success-200/50";
    } else if (computedImc < 30) {
      imcStatus = "Surpoids";
      imcColor = "text-orange-600 bg-orange-50 dark:bg-orange-950/20 border-orange-200/50";
    } else {
      imcStatus = "Obésité";
      imcColor = "text-danger-600 bg-danger-50 dark:bg-danger-950/20 border-danger-200/50";
    }
  }

  // Clinical states
  const [consPlainte, setConsPlainte] = useState("");
  const [consExamen, setConsExamen] = useState("");
  const [consDiagnostic, setConsDiagnostic] = useState("");
  const [consDiagnosticFinal, setConsDiagnosticFinal] = useState("");

  // AI Assistant states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);

  // Prescription builder states
  const [presLines, setPresLines] = useState<LigneOrdonnance[]>([]);
  const [presMedName, setPresMedName] = useState("");
  const [presMedId, setPresMedId] = useState<string | undefined>(undefined);
  const [presCustomMode, setPresCustomMode] = useState(false);
  const [presPosologie, setPresPosologie] = useState("");
  const [presDuree, setPresDuree] = useState("");
  const [presQuantite, setPresQuantite] = useState("1");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null);

  // --- Mode édition d'un dossier déjà enregistré ---
  const [isEditingDetail, setIsEditingDetail] = useState(false);
  const [editPlainte, setEditPlainte] = useState("");
  const [editExamenPhysique, setEditExamenPhysique] = useState("");
  const [editDiagnostic, setEditDiagnostic] = useState("");
  const [editDiagnosticFinal, setEditDiagnosticFinal] = useState("");
  const [editObservations, setEditObservations] = useState("");

  const startEditingDetail = () => {
    if (!selectedConsultation) return;
    setEditPlainte(selectedConsultation.plainte || "");
    setEditExamenPhysique(selectedConsultation.examenPhysique || "");
    setEditDiagnostic(selectedConsultation.diagnostic || "");
    setEditDiagnosticFinal(selectedConsultation.diagnosticFinal || "");
    setEditObservations(selectedConsultation.observations || "");
    setIsEditingDetail(true);
  };

  const cancelEditingDetail = () => {
    setIsEditingDetail(false);
  };

  const handleSaveEditedConsultation = () => {
    if (!selectedConsultation) return;

    if (!editDiagnostic.trim()) {
      alert("Le diagnostic de présomption ne peut pas être vide.");
      return;
    }

    const hasLaboPrescrit = !!(selectedConsultation.labResults && selectedConsultation.labResults.length > 0);
    if (hasLaboPrescrit && !editDiagnosticFinal.trim()) {
      alert("Un examen de laboratoire a été prescrit pour ce dossier : le diagnostic final / de sortie est obligatoire avant de valider.");
      return;
    }

    const updatedCons: Consultation = {
      ...selectedConsultation,
      plainte: editPlainte.trim(),
      examenPhysique: editExamenPhysique.trim(),
      diagnostic: editDiagnostic.trim(),
      diagnosticFinal: editDiagnosticFinal.trim() || undefined,
      observations: editObservations.trim()
    };

    const updatedList = consultations.map((c) => c.id === selectedConsultation.id ? updatedCons : c);
    onUpdateConsultations(updatedList);
    setSelectedConsultation(updatedCons);
    setIsEditingDetail(false);
    logActivity(
      "Modification de fiche (Consultation)",
      "modification",
      `Modification du dossier de consultation du patient ${updatedCons.patient}.`
    );
    alert("Dossier mis à jour avec succès.");
  };

  // Practitioner search states
  const [praticienSearchQuery, setPraticienSearchQuery] = useState("");

  const filteredPraticiens = React.useMemo(() => {
    return staff.filter((s) => {
      const q = praticienSearchQuery.toLowerCase().trim();
      return !q || s.nom.toLowerCase().includes(q) || s.poste.toLowerCase().includes(q);
    });
  }, [staff, praticienSearchQuery]);

  // Camera specific states
  const [tempPhotos, setTempPhotos] = useState<string[]>([]);
  const [showFormCamera, setShowFormCamera] = useState(false);
  const [showDetailCamera, setShowDetailCamera] = useState(false);

  // Lab results integration states & helpers
  const [tempLabResults, setTempLabResults] = useState<ExamenLabo[]>([]);
  const [consPrescriptionAnalyse, setConsPrescriptionAnalyse] = useState("NFS");
  const [consPrescriptionUrgent, setConsPrescriptionUrgent] = useState(false);

  const handlePrescrireExamen = () => {
    if (!consPatient) {
      alert("Veuillez d'abord renseigner le nom du patient avant de prescrire un examen.");
      return;
    }
    if (!consPrescriptionAnalyse.trim()) {
      alert("Veuillez préciser l'examen à prescrire.");
      return;
    }
    const newExam: ExamenLabo = {
      id: generateUid(),
      patient: consPatient,
      contact: consContact,
      dateDemande: getTodayStr(),
      analyses: consPrescriptionAnalyse,
      priorite: consPrescriptionUrgent ? "urgente" : "normale",
      prescripteur: currentUser?.nom || "Médecin",
      technicien: "",
      statut: "En attente",
      dateResultat: "",
      resultat: "",
      interpretation: "",
      createdAt: new Date().toISOString()
    };
    if (onUpdateLaboExamens) {
      onUpdateLaboExamens([newExam, ...laboExamens]);
      alert(`Examen prescrit (${consPrescriptionAnalyse}) et envoyé directement au laboratoire !`);
      setConsPrescriptionAnalyse(""); // reset after prescription
      setConsPrescriptionUrgent(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setTempPhotos(prev => [...prev, base64String]);
      alert("Fichier d'examen de laboratoire importé avec succès : " + file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleLinkLabExamenToTemp = (exam: ExamenLabo) => {
    if (tempLabResults.some((e) => e.id === exam.id)) {
      alert("Cet examen de laboratoire est déjà transféré à cette consultation.");
      return;
    }
    setTempLabResults([...tempLabResults, exam]);

    // Automatically append summary of lab results in clinical exam physical area
    const dateStr = exam.dateResultat ? new Date(exam.dateResultat).toLocaleDateString("fr-FR") : new Date(exam.dateDemande).toLocaleDateString("fr-FR");
    const appendText = `\n[Examen Labo Transféré le ${dateStr}] ${exam.analyses || exam.examen || "Analyse"} -> Résultats: ${exam.resultat || "En attente"} (Interprétation: ${exam.interpretation || "Normal"}).`;
    if (!consExamen.includes(exam.analyses || exam.examen || "")) {
      setConsExamen((prev) => (prev ? prev + appendText : appendText.trim()));
    }
    alert(`Examen de laboratoire (${exam.analyses || exam.examen}) transféré avec succès à la consultation !`);
  };

  const handleLinkLabExamenToSelected = (exam: ExamenLabo) => {
    if (!selectedConsultation) return;
    const currentResults = selectedConsultation.labResults || [];
    if (currentResults.some((e) => e.id === exam.id)) {
      alert("Cet examen de laboratoire est déjà transféré à ce dossier.");
      return;
    }
    const updatedLabResults = [...currentResults, exam];
    const updatedCons: Consultation = {
      ...selectedConsultation,
      labResults: updatedLabResults
    };

    setSelectedConsultation(updatedCons);

    const updatedList = consultations.map((c) => c.id === selectedConsultation.id ? updatedCons : c);
    onUpdateConsultations(updatedList);
    alert(`Examen de laboratoire (${exam.analyses || exam.examen}) transféré directement au dossier de consultation.`);
  };

  // Add a line to current prescription
  const handleAddPrescriptionLine = () => {
    if (!presMedName.trim() || !presPosologie.trim()) {
      alert("Veuillez renseigner le nom du médicament et sa posologie.");
      return;
    }

    const qte = parseFloat(presQuantite) || 0;

    const newLine: LigneOrdonnance = {
      id: generateUid(),
      medicamentNom: presMedName.trim(),
      posologie: presPosologie.trim(),
      duree: presDuree.trim() || "5 jours",
      // Rattaché à un article de la pharmacie uniquement si sélectionné dans la
      // liste (pas en saisie libre) : c'est ce qui permet la déduction
      // automatique du stock à la sauvegarde de la consultation.
      medicamentId: presMedId,
      quantitePrescrite: presMedId ? qte : undefined
    };

    setPresLines([...presLines, newLine]);
    setPresMedName("");
    setPresMedId(undefined);
    setPresCustomMode(false);
    setPresQuantite("1");
    setPresPosologie("");
    setPresDuree("");
  };

  const handleRemovePrescriptionLine = (id: string) => {
    setPresLines(presLines.filter((line) => line.id !== id));
  };

  const handleAskAIAssistant = async () => {
    if (!consPlainte.trim() && !consExamen.trim()) {
      alert("Veuillez d'abord renseigner la plainte du patient et/ou les notes d'examen clinique.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/gemini/consultation-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plainte: consPlainte,
          constantes: {
            temperature: vTemp,
            poids: vPoids,
            taille: vTaille,
            tension: vTa,
            pouls: vPouls,
            glycemie: vGlycemie
          },
          notes: consExamen,
          age: consAge,
          sexe: consSexe
        }),
      });

      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Impossible de lire la réponse du serveur.");
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erreur serveur : Vérifiez que la clé API Gemini est bien configurée.");
      }
      setAiAnalysisResult(data);
    } catch (error) {
      console.error(error);
      alert("Erreur de l'assistant IA : " + (error.message || "Veuillez vérifier votre connexion."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Normalise un nom pour la comparaison (casse, accents, espaces multiples) :
  // évite qu'une simple variation de saisie ("Jean Dupont" vs "jean  dupont")
  // crée ce qui ressemble à un doublon de dossier (cahier des charges, point 5).
  const normalizePatientName = (name: string): string =>
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");

  const normalizePhone = (phone: string): string => phone.replace(/\D/g, "");

  // Distance de Levenshtein simple, utilisée uniquement pour détecter des noms
  // "presque identiques" (faute de frappe) et suggérer de continuer le dossier
  // existant plutôt que d'en ouvrir un nouveau.
  const levenshteinDistance = (a: string, b: string): number => {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[a.length][b.length];
  };

  const knownPatientProfiles = useMemo(() => {
    const map = new Map<string, Consultation>();
    // Sort consultations to have the most recent ones first
    const sortedCons = [...consultations].sort((a, b) => b.id.localeCompare(a.id));
    sortedCons.forEach(c => {
      const name = c.patient.trim();
      const key = normalizePatientName(name);
      if (key && !map.has(key)) {
        map.set(key, c);
      }
    });
    return Array.from(map.values());
  }, [consultations]);

  // Doublon quasi-certain : même nom normalisé OU même numéro de téléphone.
  const findExactPatientMatch = (name: string, phone?: string): Consultation | undefined => {
    const normName = normalizePatientName(name);
    const normPhone = phone ? normalizePhone(phone) : "";
    return knownPatientProfiles.find((p) => {
      if (normName && normalizePatientName(p.patient) === normName) return true;
      if (normPhone && normPhone.length >= 8 && normalizePhone(p.contact || "") === normPhone) return true;
      return false;
    });
  };

  // Doublon probable : nom très proche (faute de frappe) mais pas identique.
  const findSimilarPatientMatch = (name: string): Consultation | undefined => {
    const normName = normalizePatientName(name);
    if (normName.length < 4) return undefined;
    return knownPatientProfiles.find((p) => {
      const otherNorm = normalizePatientName(p.patient);
      if (otherNorm === normName) return false; // déjà un match exact, pas "similaire"
      return levenshteinDistance(normName, otherNorm) <= 2;
    });
  };

  const [similarPatientSuggestion, setSimilarPatientSuggestion] = useState<Consultation | null>(null);

  // Regroupement du registre par patient (cahier des charges) : le nom d'un
  // patient n'apparaît qu'une seule fois dans le registre, avec la suite
  // chronologique de son dossier (consultations, examens labo, documents scannés).
  const patientDossiers = useMemo(() => {
    const map = new Map<string, {
      key: string;
      patient: string;
      contact: string;
      age: number;
      sexe: string;
      lastDate: string;
      consultations: Consultation[];
      labExams: ExamenLabo[];
      scannedDocs: DocumentArchive[];
    }>();

    [...consultations]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((c) => {
        const key = normalizePatientName(c.patient);
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, {
            key,
            patient: c.patient,
            contact: c.contact || "",
            age: c.age,
            sexe: c.sexe,
            lastDate: c.date,
            consultations: [],
            labExams: [],
            scannedDocs: []
          });
        }
        const entry = map.get(key)!;
        entry.consultations.unshift(c); // le plus récent en premier au final (car on itère du plus ancien au plus récent)
        // Toujours garder l'identité la plus récente affichée
        if (c.date >= entry.lastDate) {
          entry.lastDate = c.date;
          entry.patient = c.patient;
          entry.contact = c.contact || entry.contact;
          entry.age = c.age;
          entry.sexe = c.sexe;
        }
      });

    // Rattacher les examens de laboratoire et documents scannés au bon patient
    map.forEach((entry) => {
      entry.labExams = laboExamens
        ? laboExamens.filter((e) => normalizePatientName(e.patient) === entry.key)
        : [];
      entry.scannedDocs = documents.filter((d) => normalizePatientName(d.patient) === entry.key);
    });

    return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [consultations, laboExamens, documents]);

  const [viewingPatientKey, setViewingPatientKey] = useState<string | null>(null);
  const viewingPatientDossier = patientDossiers.find((p) => p.key === viewingPatientKey) || null;

  const handleContinuerDossier = (c: Consultation) => {
    setConsPatient(c.patient);
    setConsAge(c.age ? c.age.toString() : "");
    setConsSexe(c.sexe);
    setConsContact(c.contact || "");
    setConsProfession(c.profession || "");
    setConsFemmeEnceinte(c.femmeEnceinte || false);
    setSimilarPatientSuggestion(null);
    // Focus the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  // Dictation State
  const [isDictating, setIsDictating] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startDictation = (field: "plainte" | "examen" | "diagnostic") => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La saisie vocale n'est pas supportée par votre navigateur (essayez Chrome ou Edge).");
      return;
    }

    if (isDictating === field) {
      recognitionRef.current?.stop();
      setIsDictating(null);
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "fr-FR";
    
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
        const textToAppend = finalTranscript.trim();
        if (field === "plainte") {
          setConsPlainte((prev) => {
             const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
             return prev + sep + textToAppend;
          });
        } else if (field === "examen") {
          setConsExamen((prev) => {
             const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
             return prev + sep + textToAppend;
          });
        } else if (field === "diagnostic") {
          setConsDiagnostic((prev) => {
             const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
             return prev + sep + textToAppend;
          });
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsDictating(null);
    };

    recognition.onend = () => {
      setIsDictating((prev) => prev === field ? null : prev);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsDictating(field);
  };

  const handleSaveConsultation = () => {
    if (!consPatient.trim() || !consPlainte.trim() || !consDiagnostic.trim()) {
      alert("Veuillez renseigner le nom du patient, le motif de consultation, et le diagnostic de présomption.");
      return;
    }

    if (tempLabResults.length > 0 && !consDiagnosticFinal.trim()) {
      alert("Des résultats de laboratoire sont liés à cette consultation : veuillez renseigner le diagnostic de certitude / final avant d'enregistrer.");
      return;
    }

    const weightNum = parseFloat(vPoids) || 0;
    const heightNum = parseFloat(vTaille) || 0;
    let savedImc: number | undefined = undefined;
    if (weightNum > 0 && heightNum > 0) {
      const heightM = heightNum / 100;
      savedImc = parseFloat((weightNum / (heightM * heightM)).toFixed(2));
    }

        const newCons: Consultation = {
      id: generateUid(),
      patient: consPatient.trim(),
      age: parseFloat(consAge) || 0,
      sexe: consSexe as any,
      profession: consProfession.trim(),
      femmeEnceinte: consSexe === "Féminin" ? consFemmeEnceinte : false,
      contact: consContact.trim(),
      commune: consCommune.trim(),
      villageSecteur: consVillageSecteur.trim(),
      zoneResidence: consZoneResidence,
      modeEntree: consModeEntree,
      ancienConsultant: consAncienConsultant,
      observations: consObservations.trim(),
      date: consDate || getTodayStr(),
      medecinId: consMedecin,
      vitals: {
        temperature: parseFloat(vTemp) || 0,
        poids: weightNum,
        tensionArterielle: vTa.trim(),
        pouls: parseFloat(vPouls) || 0,
        glycemie: parseFloat(vGlycemie) || 0,
        taille: heightNum || undefined,
        imc: savedImc
      },
      plainte: consPlainte.trim(),
      examenPhysique: consExamen.trim(),
      diagnostic: consDiagnostic.trim(),
      diagnosticFinal: consDiagnosticFinal.trim() || undefined,
      ordonnance: [...presLines],
      photos: [...tempPhotos],
      labResults: [...tempLabResults],
      createdAt: new Date().toISOString(),
      agentCode: currentUser?.codeEntree || "0000",
      decision: consDecision,
      referenceService: consDecision === "Référer vers un autre service" ? consReferenceService.trim() : undefined
    };

    const medecinNomForDecision = staff.find((s) => s.id === consMedecin)?.nom || currentUser?.nom || "";
    const nowTime = new Date().toTimeString().slice(0, 5);

    // Cahier des charges points 1-3 : la décision prise ici en Consultation
    // Générale crée automatiquement le dossier correspondant, sans ressaisie.
    if ((newCons.decision === "Hospitalisation" || newCons.decision === "Mise en observation") && onUpdateHospitalisations) {
      const newHosp: Hospitalisation = {
        id: generateUid(),
        patient: newCons.patient,
        contact: newCons.contact,
        dateAdmission: newCons.date || getTodayStr(),
        heureAdmission: nowTime,
        service: newCons.decision === "Mise en observation" ? "Observation" : "Hospitalisation",
        chambre: "",
        medecin: medecinNomForDecision,
        motif: newCons.plainte,
        notesInitiales: `Diagnostic (Consultation Générale) : ${newCons.diagnostic}${newCons.examenPhysique ? "\nExamen clinique : " + newCons.examenPhysique : ""}`,
        typeAdmission: newCons.decision === "Mise en observation" ? "Mise en Observation (72h)" : "Hospitalisation",
        statut: "En cours",
        dateSortie: "",
        statutSortie: "",
        diagnosticSortie: "",
        createdAt: new Date().toISOString()
      };
      newCons.linkedHospitalisationId = newHosp.id;
      onUpdateHospitalisations([newHosp, ...hospitalisations]);
    } else if (newCons.decision === "Admission aux urgences" && onUpdateUrgences) {
      const newUrg: PatientUrgence = {
        id: generateUid(),
        patient: newCons.patient,
        contact: newCons.contact,
        severite: "Urgent (Jaune)",
        plainte: newCons.plainte,
        constantes: `T°: ${newCons.vitals.temperature}°C | TA: ${newCons.vitals.tensionArterielle} | Pouls: ${newCons.vitals.pouls} | Glycémie: ${newCons.vitals.glycemie}`,
        medecinId: consMedecin,
        dateArrivee: newCons.date || getTodayStr(),
        heureArrivee: nowTime,
        statut: "En attente de médecin",
        createdAt: new Date().toISOString()
      };
      newCons.linkedUrgenceId = newUrg.id;
      onUpdateUrgences([newUrg, ...urgences]);
    }

    // Cahier des charges point 6.3 : déduction automatique du stock pharmacie
    // pour chaque ligne d'ordonnance rattachée à un article de la pharmacie.
    let stockShortfallWarnings: string[] = [];
    if (onUpdateMedicaments && onUpdateMouvements) {
      const workingStock = [...medicaments];
      const newStockMovements: MouvementStock[] = [];

      newCons.ordonnance.forEach((line) => {
        if (!line.medicamentId || !line.quantitePrescrite || line.quantitePrescrite <= 0) return;
        const idx = workingStock.findIndex((m) => m.id === line.medicamentId);
        if (idx === -1) return;

        const med = workingStock[idx];
        const deduction = Math.min(line.quantitePrescrite, med.stock);
        if (deduction < line.quantitePrescrite) {
          stockShortfallWarnings.push(
            `${med.nom} : ${line.quantitePrescrite} demandé(s), seulement ${med.stock} disponible(s) en stock.`
          );
        }
        if (deduction <= 0) return;

        workingStock[idx] = { ...med, stock: med.stock - deduction };

        newStockMovements.push({
          id: generateUid(),
          medId: med.id,
          type: "sortie",
          qte: deduction,
          motif: `Prescription en consultation — Patient : ${newCons.patient}`,
          prixUnitaire: med.prixVente || 0,
          montant: (med.prixVente || 0) * deduction,
          date: newCons.date || getTodayStr(),
          createdAt: new Date().toISOString()
        });
      });

      if (newStockMovements.length > 0) {
        onUpdateMedicaments(workingStock);
        onUpdateMouvements([...newStockMovements, ...mouvements]);
      }
    }

    onUpdateConsultations([newCons, ...consultations]);

    // Clear form
        setConsPatient("");
    setConsAge("");
    setConsContact("");
    setConsProfession("");
    setConsFemmeEnceinte(false);
    setConsCommune("");
    setConsVillageSecteur("");
    setConsZoneResidence("");
    setConsModeEntree("");
    setConsAncienConsultant(false);
    setConsObservations("");
    setVTemp("");
    setVPoids("");
    setVTaille("");
    setVTa("");
    setVPouls("");
    setVGlycemie("");
    setConsPlainte("");
    setConsExamen("");
    setConsDiagnostic("");
    setConsDiagnosticFinal("");
    setPresLines([]);
    setTempPhotos([]);
    setTempLabResults([]);
    setShowFormCamera(false);
    setConsDecision("Retour à domicile");
    setConsReferenceService("");

    let decisionSuffix = "";
    if (newCons.decision === "Hospitalisation" || newCons.decision === "Mise en observation") {
      decisionSuffix = `\nUn dossier a été créé automatiquement dans le module ${newCons.decision === "Mise en observation" ? "Hospitalisation (Observation)" : "Hospitalisation"}.`;
    } else if (newCons.decision === "Admission aux urgences") {
      decisionSuffix = "\nUn dossier a été créé automatiquement dans le module Urgences.";
    } else if (newCons.decision === "Référer vers un autre service" && newCons.referenceService) {
      decisionSuffix = `\nPatient référé vers : ${newCons.referenceService}.`;
    }

    const shortfallSuffix = stockShortfallWarnings.length > 0
      ? "\n⚠️ Stock insuffisant pour : " + stockShortfallWarnings.join(" ")
      : "";

    alert("Consultation enregistrée avec succès pour : " + newCons.patient + decisionSuffix + shortfallSuffix);
  };

  const handleAddPhotoToActiveConsultation = (photoBase64: string) => {
    if (!selectedConsultation) return;
    const updatedPhotos = [...(selectedConsultation.photos || []), photoBase64];
    const updatedCons: Consultation = {
      ...selectedConsultation,
      photos: updatedPhotos
    };
    
    setSelectedConsultation(updatedCons);

    const updatedList = consultations.map((c) => c.id === selectedConsultation.id ? updatedCons : c);
    onUpdateConsultations(updatedList);
  };

  const handleDeleteConsult = (id: string) => {
    const consultToDelete = consultations.find((c) => c.id === id);
    if (confirm("Supprimer ce dossier de consultation définitivement ?")) {
      onUpdateConsultations(consultations.filter((c) => c.id !== id));
      if (consultToDelete) {
        logActivity(
          "Suppression de fiche (Consultation)",
          "suppression",
          `Suppression définitive de la consultation du patient ${consultToDelete.patient} (Âge: ${consultToDelete.age || "—"}, Diagnostic: ${consultToDelete.diagnostic || "—"}).`
        );
      }
    }
  };

  const handleShareWhatsAppOrdonnance = (cons: Consultation) => {
    const doctorName = staff.find((s) => s.id === cons.medecinId)?.nom || "Médecin Traitant";
    const ordonnanceText = cons.ordonnance.map(line => `- ${line.medicamentNom} : ${line.posologie} (${line.duree})`).join("\n");
    const text = `Bonjour,\n\nVoici les éléments de votre consultation du ${new Date(cons.date).toLocaleDateString("fr-FR")} avec le Dr. ${doctorName} :\n\nDiagnostic :\n${cons.diagnostic || "Non spécifié"}\n\nOrdonnance :\n${ordonnanceText}\n\nConseils Hygiéno-Diététiques :\n${cons.observations || "Aucun"}\n\nClinique : ${profile.name}\n\n*Veuillez trouver le fichier PDF de l'ordonnance en pièce jointe (si envoyé par la clinique).*`;
    const encoded = encodeURIComponent(text);
    
    let phone = cons.contact || "";
    phone = phone.replace(/\D/g, "");
    if (phone && phone.length >= 8) {
       window.open(`https://wa.me/${phone}?text=${encoded}`, "_blank");
    } else {
       window.open(`https://wa.me/?text=${encoded}`, "_blank");
    }
  };

  const handlePrintPrescriptionOnly = (cons: Consultation) => {
    const doctorName = staff.find((s) => s.id === cons.medecinId)?.nom || "Médecin Traitant";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("La fenêtre de téléchargement est bloquée. Veuillez autoriser les pop-ups.");
      return;
    }

    const linesHtml = cons.ordonnance
      .map(
        (l, i) => `
      <tr style="border-bottom: 1px solid #e7e5e4;">
        <td style="padding: 10px 0; font-weight: bold; font-size: 14px;">${i + 1}. ${l.medicamentNom}</td>
        <td style="padding: 10px 0; font-size: 13px; font-style: italic;">${l.posologie}</td>
        <td style="padding: 10px 0; text-align: right; font-size: 13px; font-weight: bold; color: #0d9488;">Pendant : ${l.duree}</td>
      </tr>
    `
      )
      .join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${profile.name} — Ordonnance Médicale</title>
          <style>
            body { font-family: 'Helvetica', sans-serif; color: #1c1917; padding: 40px; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px double #0d9488; padding-bottom: 15px; margin-bottom: 40px; }
            .title { font-size: 24px; font-weight: bold; text-transform: uppercase; color: #0d9488; }
            .subtitle { font-size: 11px; color: #78716c; letter-spacing: 1px; }
            .meta-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 40px; font-size: 14px; }
            .prescription-title { font-size: 18px; font-weight: bold; text-transform: uppercase; color: #0d9488; border-bottom: 2px solid #0d9488; padding-bottom: 5px; margin-bottom: 25px; text-align: center; }
            .med-table { width: 100%; border-collapse: collapse; margin-bottom: 60px; }
            .signature { text-align: right; font-size: 14px; margin-top: 50px; }
            .stamp { border: 2px dashed #0d9488; color: #0d9488; padding: 15px; border-radius: 8px; font-size: 11px; font-weight: bold; text-transform: uppercase; display: inline-block; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${profile.name}</div>
            <div class="subtitle">${profile.address.toUpperCase()} — TEL: ${profile.phone}</div>
          </div>
          
          <div class="meta-grid">
            <div>
              <strong>Patient :</strong> ${cons.patient}<br>
              <strong>Âge / Sexe :</strong> ${cons.age} ans / ${cons.sexe}<br>
              <strong>Contact :</strong> ${cons.contact || "—"}
            </div>
            <div style="text-align: right;">
              <strong>Date :</strong> ${new Date(cons.date).toLocaleDateString("fr-FR")}<br>
              <strong>Ordonnance N° :</strong> ORD-${cons.id.slice(0, 6).toUpperCase()}
            </div>
          </div>
          
          <div class="prescription-title">Ordonnance Médicale</div>
          
          <table class="med-table">
            <tbody>
              ${linesHtml || "<tr><td colspan='3' style='text-align: center; color: #78716c;'>Aucune médication prescrite.</td></tr>"}
            </tbody>
          </table>
          
          <div class="signature">
            <strong>Le Médecin Traitant</strong><br>
            <span style="font-size: 12px; color: #78716c;">${doctorName}</span><br>
            <div class="stamp">${profile.stampText}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadPDF = (cons: Consultation) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const doctorName = staff.find((s) => s.id === cons.medecinId)?.nom || "Médecin Traitant";

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

    const drawTextBlock = (label: string, value: string) => {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(label, margin, y);
      y += 4;

      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      
      const wrapped = doc.splitTextToSize(value || "—", contentWidth - 4);
      wrapped.forEach((line: string) => {
        if (y > pageHeight - 30) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin + 2, y);
        y += 4.5;
      });
      y += 3;
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
    doc.text("BOBO-DIOULASSO, BURKINA FASO — TÉL: +226 44 92 01 62 — SOINS ET RÉSULTATS DE HAUTE QUALITÉ", pageWidth / 2, y, { align: "center" });
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
    doc.text("DOSSIER MEDICAL DE CONSULTATION", pageWidth / 2, y + 6.5, { align: "center" });
    y += 16;

    // Informations Générales
    drawSectionHeader("1. Informations Générales");

    const infoGrid = [
      { k: "Nom complet :", v: cons.patient, k2: "Date d'Examen :", v2: new Date(cons.date).toLocaleDateString("fr-FR") },
      { k: "Âge / Sexe :", v: `${cons.age} Ans / ${cons.sexe}`, k2: "Téléphone :", v2: cons.contact || "—" },
      { k: "Médecin Référent :", v: doctorName, k2: "Dossier N° :", v2: `CONS-${cons.id.slice(0, 8).toUpperCase()}` }
    ];

    doc.setFontSize(9);
    infoGrid.forEach((row) => {
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(row.k, margin, y);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(row.v, margin + 35, y);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text(row.k2, margin + 105, y);
      doc.setFont("Helvetica", "bold");
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(row.v2, margin + 135, y);

      y += 6;
    });
    y += 4;

    // Constantes Vitales
    drawSectionHeader("2. Constantes Physiologiques à l'admission");
    
    const vitalsList = [
      { l: "TEMPÉRATURE", v: cons.vitals.temperature ? `${cons.vitals.temperature} °C` : "—", color: [225, 29, 72] },
      { l: "POIDS", v: cons.vitals.poids ? `${cons.vitals.poids} kg` : "—", color: [30, 41, 59] },
      { l: "TAILLE", v: cons.vitals.taille ? `${cons.vitals.taille} cm` : "—", color: [30, 41, 59] },
      { l: "IMC", v: cons.vitals.imc ? `${cons.vitals.imc}` : "—", color: cons.vitals.imc ? (cons.vitals.imc < 18.5 ? [217, 119, 6] : cons.vitals.imc < 25 ? [5, 150, 105] : cons.vitals.imc < 30 ? [249, 115, 22] : [225, 29, 72]) : [30, 41, 59] },
      { l: "TENSION (TA)", v: cons.vitals.tensionArterielle || "—", color: [30, 41, 59] },
      { l: "POULS", v: cons.vitals.pouls ? `${cons.vitals.pouls} bpm` : "—", color: [30, 41, 59] },
      { l: "GLYCÉMIE", v: cons.vitals.glycemie ? `${cons.vitals.glycemie} g/L` : "—", color: [30, 41, 59] }
    ];

    const boxWidth = contentWidth / 7;
    vitalsList.forEach((vit, idx) => {
      const boxX = margin + (idx * boxWidth);
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.rect(boxX, y, boxWidth - 2, 12, "F");
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.2);
      doc.rect(boxX, y, boxWidth - 2, 12, "S");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      doc.text(vit.l, boxX + (boxWidth - 2) / 2, y + 3.5, { align: "center" });

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(vit.color[0], vit.color[1], vit.color[2]);
      doc.text(vit.v, boxX + (boxWidth - 2) / 2, y + 8.5, { align: "center" });
    });
    y += 18;

    // Clinical Details
    drawSectionHeader("3. Description Clinique & Examen");
    drawTextBlock("MOTIF DE CONSULTATION / PLAINTES :", cons.plainte);
    drawTextBlock("EXAMEN PHYSIQUE CLINIQUE :", cons.examenPhysique || "Non spécifié");

    // Conclusions
    drawSectionHeader("4. Conclusion & Diagnostic");
    doc.setFillColor(240, 253, 250); 
    doc.rect(margin, y, contentWidth, 11, "F");
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 11, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(13, 148, 136);
    doc.text("DIAGNOSTIC DE PRÉSOMPTION :", margin + 3, y + 4.5);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(cons.diagnostic, margin + 3, y + 9);
    y += 14;

    doc.setFillColor(240, 253, 250);
    doc.rect(margin, y, contentWidth, 11, "F");
    doc.setDrawColor(13, 148, 136);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentWidth, 11, "S");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(13, 148, 136);
    doc.text("DIAGNOSTIC FINAL / DE SORTIE :", margin + 3, y + 4.5);

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(cons.diagnosticFinal || "Non renseigné", margin + 3, y + 9);
    y += 17;

    // Prescription Section
    drawSectionHeader("5. Prescription / Traitement Ordonné");
    
    if (!cons.ordonnance || cons.ordonnance.length === 0) {
      doc.setFont("Helvetica", "oblique");
      doc.setFontSize(9);
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      doc.text("Aucune ordonnance rédigée au dossier.", margin, y);
      y += 10;
    } else {
      doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
      doc.rect(margin, y, contentWidth, 7, "F");
      doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
      doc.setLineWidth(0.2);
      doc.line(margin, y, margin + contentWidth, y);
      doc.line(margin, y + 7, margin + contentWidth, y + 7);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("MÉDICAMENT", margin + 3, y + 4.5);
      doc.text("POSOLOGIE", margin + 80, y + 4.5);
      doc.text("DURÉE", margin + 150, y + 4.5);
      y += 7;

      cons.ordonnance.forEach((o) => {
        if (y > pageHeight - 40) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(o.medicamentNom, margin + 3, y + 5);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(70, 70, 70);
        doc.text(o.posologie, margin + 80, y + 5);

        doc.setFont("Helvetica", "bold");
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(o.duree, margin + 150, y + 5);

        doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
        doc.setLineWidth(0.15);
        doc.line(margin, y + 7, margin + contentWidth, y + 7);
        y += 7;
      });
      y += 5;
    }

    // Transferred Lab Results Section in PDF
    if (cons.labResults && cons.labResults.length > 0) {
      if (y > pageHeight - 35) {
        doc.addPage();
        y = 20;
      }
      drawSectionHeader("6. Examens de Laboratoire Transférés");
      cons.labResults.forEach((lr) => {
        if (y > pageHeight - 35) {
          doc.addPage();
          y = 20;
        }
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
        doc.text(`ANALYSE : ${lr.analyses?.toUpperCase() || lr.examen?.toUpperCase() || "ANALYSE GENERALE"}`, margin, y);
        y += 4;

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.text(`Demandé le : ${new Date(lr.dateDemande).toLocaleDateString("fr-FR")} | Validé le : ${lr.dateResultat ? new Date(lr.dateResultat).toLocaleDateString("fr-FR") : "En cours"}`, margin + 2, y);
        y += 4;

        doc.setFillColor(lightBgColor[0], lightBgColor[1], lightBgColor[2]);
        const resText = `Résultat : ${lr.resultat || "En attente"}\nInterprétation : ${lr.interpretation || "N/A"}`;
        const wrappedRes = doc.splitTextToSize(resText, contentWidth - 4);
        const boxHeight = (wrappedRes.length * 4.5) + 4;
        doc.rect(margin, y, contentWidth, boxHeight, "F");
        
        doc.setFont("Courier", "normal");
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 50);
        let textY = y + 3.5;
        wrappedRes.forEach((line: string) => {
          doc.text(line, margin + 3, textY);
          textY += 4.5;
        });
        y += boxHeight + 4;
      });
      y += 2;
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
    doc.text("RAPPORT ARCHIVÉ LE :", margin, y);
    doc.setFont("Helvetica", "normal");
    doc.text(new Date().toLocaleString("fr-FR"), margin + 45, y);

    const sigX = margin + 115;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text("Le Médecin Praticien Référent", sigX, y);
    
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
    doc.text("CACHET & SIGNATURE DEO-GRACIAS", sigX + 2, y + 15.5);

    doc.save(`dossier_consultation_${cons.patient.toLowerCase().replace(/\s+/g, "_")}.pdf`);
  };

  // Calculations
  const totalConsultsToday = consultations.filter((c) => c.date === getTodayStr()).length;
  const uniquePatientsThisMonth = new Set(
    consultations.filter((c) => c.date.slice(0, 7) === getTodayStr().slice(0, 7)).map((c) => c.patient.toLowerCase().trim())
  ).size;

  const effectiveQuery = filterPatientQuery || searchQuery;
  const filteredPatientDossiers = patientDossiers.filter((p) => {
    const eq = effectiveQuery.toLowerCase().trim();
    if (!eq) return true;
    if (p.patient.toLowerCase().includes(eq)) return true;
    if (p.contact && p.contact.includes(eq)) return true;
    return p.consultations.some((c) =>
      c.diagnostic.toLowerCase().includes(eq) || c.id.toLowerCase().includes(eq)
    );
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{totalConsultsToday}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Consultations Jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Aujourd'hui</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-success-600">
          <div className="text-3xl font-semibold text-success-700 font-serif">{uniquePatientsThisMonth}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Patients Distincts</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Mois en cours</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{consultations.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Dossiers Cliniques</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Historique total conservé</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-purple-600">
          <div className="text-3xl font-semibold text-purple-700 font-serif">
            {consultations.filter((c) => (c.ordonnance || []).length > 0).length}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Ordonnances émises</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Avec dispensation</div>
        </div>
      </div>

      {filterPatientQuery && (
        <div className="bg-primary-50 border border-primary-200 text-primary-800 p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-3xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-600 animate-pulse"></span>
            <span>Filtre de recherche global actif en consultation : <strong>"{filterPatientQuery}"</strong></span>
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400 font-normal italic">Saisie dans le moteur global</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Consultation form wizard */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Nouvelle Consultation de Médecine Générale
          </h3>

          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2">
                <div className="flex justify-between items-end mb-1">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block">Nom et prénom(s) (2) *</label>
                  {consPatient.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery(consPatient.trim())}
                      className="text-xs text-primary-600 font-bold hover:text-primary-700 hover:underline flex items-center gap-1"
                      title="Chercher dans l'historique"
                    >
                      <Search className="w-3 h-3" />
                      Historique
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="consult-patients-list"
                  placeholder="Rechercher ou saisir un patient..."
                  value={consPatient}
                  onChange={(e) => {
                     const typedName = e.target.value;
                     setConsPatient(typedName);
                     // Correspondance normalisée (casse/accents/espaces) : évite qu'une
                     // simple variation de saisie soit traitée comme un nouveau patient.
                     const match = findExactPatientMatch(typedName, consContact);
                     if (match) {
                        setConsAge(match.age ? match.age.toString() : "");
                        setConsSexe(match.sexe);
                        if (match.contact) setConsContact(match.contact);
                        if (match.profession) setConsProfession(match.profession);
                        if (match.femmeEnceinte !== undefined) setConsFemmeEnceinte(match.femmeEnceinte);
                        setSimilarPatientSuggestion(null);
                     } else {
                        setSimilarPatientSuggestion(findSimilarPatientMatch(typedName) || null);
                     }
                  }}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
                <datalist id="consult-patients-list">
                  {knownPatientProfiles.map((p, idx) => (
                    <option key={idx} value={p.patient} />
                  ))}
                </datalist>
                {similarPatientSuggestion && (
                  <div className="mt-1.5 text-2xs bg-warning-50 border border-warning-200 text-warning-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span>
                      ⚠️ Patient similaire déjà enregistré : <strong>{similarPatientSuggestion.patient}</strong>
                      {similarPatientSuggestion.contact ? ` (${similarPatientSuggestion.contact})` : ""}. Est-ce la même personne ?
                    </span>
                    <button
                      type="button"
                      onClick={() => handleContinuerDossier(similarPatientSuggestion)}
                      className="flex-shrink-0 font-bold underline hover:text-warning-900"
                    >
                      Continuer son dossier
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Age (6)</label>
                <input
                  type="number"
                  placeholder="Ex: 34"
                  value={consAge}
                  onChange={(e) => setConsAge(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sexe (4)</label>
                <select
                  value={consSexe}
                  onChange={(e) => setConsSexe(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Masculin">M</option>
                  <option value="Féminin">F</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Profession (3)</label>
                <input
                  type="text"
                  placeholder="Ex: Enseignant"
                  value={consProfession}
                  onChange={(e) => setConsProfession(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="col-span-2 flex items-center justify-center pt-4">
                {consSexe === "Féminin" ? (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="femmeEnceinte"
                      checked={consFemmeEnceinte}
                      onChange={(e) => setConsFemmeEnceinte(e.target.checked)}
                      className="w-4 h-4 text-primary-600 border-stone-300 rounded-lg focus:ring-primary-500"
                    />
                    <label htmlFor="femmeEnceinte" className="ml-2 text-xs font-bold text-stone-700">Femme enceinte (5)</label>
                  </div>
                ) : (
                  <div className="text-xs text-stone-500 dark:text-stone-400 italic">N/A</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Adresse (7) - Commune/Arrond.</label>
                <input
                  type="text"
                  placeholder="Ex: Bobo-Dioulasso, Secteur 15"
                  value={consCommune}
                  onChange={(e) => setConsCommune(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Adresse (7) - Village/Secteur</label>
                <input
                  type="text"
                  placeholder="Ex: Belle-ville"
                  value={consVillageSecteur}
                  onChange={(e) => setConsVillageSecteur(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Zone de résidence du Consultant (8)</label>
                <select
                  value={consZoneResidence}
                  onChange={(e) => setConsZoneResidence(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  <option value="0-4 km">0-4 km</option>
                  <option value="5-9 km">5-9 km</option>
                  <option value="10 km et plus">10 km et plus</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Mode d'entrée (9)</label>
                <select
                  value={consModeEntree}
                  onChange={(e) => setConsModeEntree(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">— Choisir —</option>
                  <option value="Auto orienté">Auto orienté</option>
                  <option value="Référé">Référé</option>
                  <option value="Evacué">Evacué</option>
                  <option value="Transféré (CMA)">Transféré (CMA)</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center mt-2 mb-4">
              <input
                type="checkbox"
                id="ancienConsultant"
                checked={consAncienConsultant}
                onChange={(e) => setConsAncienConsultant(e.target.checked)}
                className="w-4 h-4 text-primary-600 border-stone-300 rounded-lg focus:ring-primary-500"
              />
              <label htmlFor="ancienConsultant" className="ml-2 text-xs font-bold text-stone-700">Ancien consultant (15) (Déjà venu)</label>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500">Nom, prénom, qualification et signature du prestataire (17)</label>
                  {staff.length > 3 && (
                    <div className="relative w-44">
                      <input
                        type="text"
                        placeholder="Filtrer praticiens..."
                        value={praticienSearchQuery}
                        onChange={(e) => setPraticienSearchQuery(e.target.value)}
                        className="w-full text-xs border border-stone-200 rounded-lg pl-5 pr-2 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <span className="absolute left-1.5 top-1 text-stone-500 dark:text-stone-400 text-xs">🔍</span>
                    </div>
                  )}
                </div>
                <select
                  value={consMedecin}
                  onChange={(e) => setConsMedecin(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-semibold"
                >
                  <option value="">— Choisir le praticien —</option>
                  {!praticienSearchQuery ? (
                    <>
                      <optgroup label="Médecins (Généralistes / Spécialistes)">
                        {staff.filter(s => s.poste.toLowerCase().includes("médecin") || s.poste.toLowerCase() === "responsable").map(s => (
                          <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Sages-femmes & Gynécologie">
                        {staff.filter(s => s.poste.toLowerCase().includes("sage-femme") || s.poste.toLowerCase().includes("gynéco")).map(s => (
                          <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Infirmiers & Soins Cliniques">
                        {staff.filter(s => s.poste.toLowerCase().includes("infirmier") || s.poste.toLowerCase().includes("soignant")).map(s => (
                          <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Laboratoire & Pharmacie">
                        {staff.filter(s => s.poste.toLowerCase().includes("labo") || s.poste.toLowerCase().includes("pharma") || s.poste.toLowerCase().includes("laborantin")).map(s => (
                          <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Secrétariat, Accueil & Administration">
                        {staff.filter(s => !s.poste.toLowerCase().includes("médecin") && !s.poste.toLowerCase().includes("sage-femme") && !s.poste.toLowerCase().includes("infirmier") && !s.poste.toLowerCase().includes("soignant") && !s.poste.toLowerCase().includes("labo") && !s.poste.toLowerCase().includes("pharma") && !s.poste.toLowerCase().includes("laborantin") && s.poste.toLowerCase() !== "responsable").map(s => (
                          <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    filteredPraticiens.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nom} ({s.poste})
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Téléphone</label>
                <input
                  type="tel"
                  placeholder="+226..."
                  value={consContact}
                  onChange={(e) => setConsContact(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Vitals sub-panel */}
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-150 space-y-2">
              <span className="text-xs uppercase font-semibold tracking-wider text-primary-800 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-primary-600" /> Constantes physiologiques à l'admission
              </span>
              <div className="grid grid-cols-6 gap-2">
                <div>
                  <label className="text-2xs uppercase font-bold text-stone-500">T°C (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="37.5"
                    value={vTemp}
                    onChange={(e) => setVTemp(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase font-bold text-stone-500">Poids (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="70"
                    value={vPoids}
                    onChange={(e) => setVPoids(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase font-bold text-stone-500">Taille (cm)</label>
                  <input
                    type="number"
                    placeholder="175"
                    value={vTaille}
                    onChange={(e) => setVTaille(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase font-bold text-stone-500">Tension (TA)</label>
                  <input
                    type="text"
                    placeholder="12/8"
                    value={vTa}
                    onChange={(e) => setVTa(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white text-center font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase font-bold text-stone-500">Pouls (bpm)</label>
                  <input
                    type="number"
                    placeholder="80"
                    value={vPouls}
                    onChange={(e) => setVPouls(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white text-center font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="text-2xs uppercase font-bold text-stone-500">Glyc. (g/L)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.95"
                    value={vGlycemie}
                    onChange={(e) => setVGlycemie(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white text-center font-bold font-mono"
                  />
                </div>
              </div>

              {/* Dynamic IMC live evaluation widget */}
              {computedImc !== null && (
                <div className={`mt-2 p-2 rounded-lg border flex items-center justify-between text-sm transition-all font-sans ${imcColor}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-xs">⚖️ IMC : {computedImc.toFixed(1)} kg/m²</span>
                    <span className="opacity-85 font-medium">({imcStatus})</span>
                  </div>
                  <div className="text-2xs font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                    <span>Évaluation Nutritionnelle Active</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block">Signes/symptômes dominants (10) *</label>
                <button
                  type="button"
                  onClick={() => startDictation("plainte")}
                  className={`text-xs font-bold flex items-center gap-1 transition-all ${isDictating === "plainte" ? "text-danger-600 animate-pulse" : "text-stone-500 dark:text-stone-400 hover:text-info-600"}`}
                  title={isDictating === "plainte" ? "Arrêter la dictée" : "Dicter la plainte"}
                >
                  {isDictating === "plainte" ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isDictating === "plainte" ? "Arrêter" : "Dicter"}
                </button>
              </div>
              <textarea
                placeholder="Ex: Céphalées persistantes, courbatures, frissons depuis 3 jours..."
                value={consPlainte}
                onChange={(e) => setConsPlainte(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block">Examen clinique physique (Signes, auscultation...)</label>
                <button
                  type="button"
                  onClick={() => startDictation("examen")}
                  className={`text-xs font-bold flex items-center gap-1 transition-all ${isDictating === "examen" ? "text-danger-600 animate-pulse" : "text-stone-500 dark:text-stone-400 hover:text-info-600"}`}
                  title={isDictating === "examen" ? "Arrêter la dictée" : "Dicter l'examen"}
                >
                  {isDictating === "examen" ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isDictating === "examen" ? "Arrêter" : "Dicter"}
                </button>
              </div>
              <textarea
                placeholder="Ex: Conjonctives sub-ictériques, gorge propre, abdomen souple, poumons libres..."
                value={consExamen}
                onChange={(e) => setConsExamen(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>

            {/* AI Smart Assistant Trigger */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAskAIAssistant}
                disabled={isAnalyzing}
                className="text-xs bg-info-600 hover:bg-info-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Analyse clinique en cours...
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5" />
                    Assistant Diagnostic IA
                  </>
                )}
              </button>
            </div>

            {/* AI Assistant Results */}
            {aiAnalysisResult && (
              <div className="bg-info-50 border border-info-100 rounded-xl p-4 text-xs font-sans space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-info-900 flex items-center gap-1.5 uppercase tracking-wider text-xs">
                    <Activity className="w-3.5 h-3.5 text-info-600" /> Analyse IA & Aide à la décision
                  </h4>
                  <button onClick={() => setAiAnalysisResult(null)} className="text-info-400 hover:text-info-700">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {aiAnalysisResult.redFlags && aiAnalysisResult.redFlags.length > 0 && aiAnalysisResult.redFlags[0] !== "" && (
                  <div className="bg-danger-100 border border-danger-200 rounded-lg p-2 text-danger-800">
                    <span className="font-semibold uppercase text-xs mb-1 block flex items-center gap-1">⚠️ Alertes Rouges (Urgence / Référer)</span>
                    <ul className="list-disc list-inside ml-1">
                      {aiAnalysisResult.redFlags.map((rf: string, idx: number) => (
                        <li key={idx} className="font-medium">{rf}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-2">
                  <span className="font-semibold uppercase text-info-800 text-xs block">Diagnostics Différentiels Suggérés</span>
                  <div className="grid gap-2">
                    {aiAnalysisResult.differentialDiagnoses?.map((diag: any, idx: number) => (
                      <div key={idx} className="bg-white p-2 rounded-lg border border-info-100 flex justify-between items-start cursor-pointer hover:border-info-300" onClick={() => setConsDiagnostic(diag.name)}>
                        <div>
                          <div className="font-bold text-info-900">{diag.name}</div>
                          <div className="text-xs text-stone-500 mt-0.5">{diag.justification}</div>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded-lg text-2xs font-bold uppercase ${
                          diag.probability?.toLowerCase() === 'haute' ? 'bg-success-100 text-success-800' :
                          diag.probability?.toLowerCase() === 'moyenne' ? 'bg-warning-100 text-warning-800' :
                          'bg-stone-100 text-stone-600'
                        }`}>
                          {diag.probability}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {aiAnalysisResult.recommendedTreatments && aiAnalysisResult.recommendedTreatments.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-info-200">
                    <span className="font-semibold uppercase text-info-800 text-xs block">Orientations Thérapeutiques</span>
                    {aiAnalysisResult.recommendedTreatments.map((rt: any, idx: number) => (
                      <div key={idx} className="bg-white p-2 rounded-lg border border-info-100 text-xs">
                        <div className="font-bold text-stone-800 mb-1">{rt.diagnosis} :</div>
                        <ul className="list-disc list-inside text-stone-600 mb-1">
                          {rt.medications?.map((med: string, i: number) => (
                            <li key={i} className="cursor-pointer hover:text-info-600 hover:underline" onClick={() => {
                              setPresMedName(med);
                            }}>
                              {med} (cliquer pour prescrire)
                            </li>
                          ))}
                        </ul>
                        <div className="italic text-primary-700 bg-primary-50 p-1 rounded-lg">💡 {rt.advice}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block">Diagnostic de Présomption (11) *</label>
                <button
                  type="button"
                  onClick={() => startDictation("diagnostic")}
                  className={`text-xs font-bold flex items-center gap-1 transition-all ${isDictating === "diagnostic" ? "text-danger-600 animate-pulse" : "text-stone-500 dark:text-stone-400 hover:text-info-600"}`}
                  title={isDictating === "diagnostic" ? "Arrêter la dictée" : "Dicter le diagnostic"}
                >
                  {isDictating === "diagnostic" ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isDictating === "diagnostic" ? "Arrêter" : "Dicter"}
                </button>
              </div>
              <input
                type="text"
                placeholder="Ex: Paludisme d'allure simple à Plasmodium"
                value={consDiagnostic}
                onChange={(e) => setConsDiagnostic(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
              />
              <p className="text-xs text-stone-500 dark:text-stone-400 italic mt-1">
                Le diagnostic final / de sortie pourra être ajouté plus tard depuis le dossier (bouton "Modifier"), une fois les résultats du laboratoire disponibles.
              </p>
            </div>

            {/* Direct Camera module during consultation creation */}
            <div className="pt-3 border-t border-stone-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1.5">
                  📷 Captures d'images en direct / Caméra
                </label>
                <button
                  type="button"
                  onClick={() => setShowFormCamera(!showFormCamera)}
                  className="text-xs font-black text-primary-700 hover:underline cursor-pointer"
                >
                  {showFormCamera ? "Fermer l'appareil photo" : "Ouvrir l'appareil photo"}
                </button>
              </div>

              {showFormCamera && (
                <div className="mb-3">
                  <CameraCapture
                    theme={theme}
                    onCapture={(photo) => {
                      setTempPhotos([...tempPhotos, photo]);
                    }}
                    onClose={() => setShowFormCamera(false)}
                  />
                </div>
              )}
            </div>

            {/* Direct Computer File Upload module */}
            <div className="pt-3 border-t border-stone-100">
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-2">
                📁 Importer un examen de labo (Photo depuis l'ordinateur)
              </label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  id="form-computer-file-upload"
                  className="hidden"
                />
                <label
                  htmlFor="form-computer-file-upload"
                  className="bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-stone-200 transition-all flex items-center gap-2 cursor-pointer shadow-3xs inline-block"
                >
                  <Upload className="w-3.5 h-3.5 text-primary-600" />
                  Sélectionner un fichier
                </label>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  Formats supportés : Images (PNG, JPG, JPEG)
                </span>
              </div>
            </div>

            {/* Prescription Laboratory module */}
            <div className="pt-3 border-t border-stone-100 space-y-2">
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-primary-600" />
                Prescrire un examen au laboratoire
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Ex: NFS, Goutte épaisse, Glycémie..."
                  value={consPrescriptionAnalyse}
                  onChange={(e) => setConsPrescriptionAnalyse(e.target.value)}
                  className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2.5 bg-stone-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <label className="flex items-center gap-1.5 cursor-pointer text-xs text-danger-600 font-bold bg-danger-50 px-3 py-2.5 rounded-lg border border-danger-200 whitespace-nowrap">
                  <input 
                    type="checkbox" 
                    checked={consPrescriptionUrgent} 
                    onChange={(e) => setConsPrescriptionUrgent(e.target.checked)} 
                    className="accent-danger-600 w-3.5 h-3.5"
                  />
                  URGENT
                </label>
                <button
                  type="button"
                  onClick={handlePrescrireExamen}
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-xs shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Prescrire
                </button>
              </div>
              <p className="text-2xs text-stone-500 dark:text-stone-400">
                Le bulletin d'examen apparaîtra directement dans l'onglet Laboratoire pour prélèvement et saisie.
              </p>
            </div>

            {/* Direct Laboratory Result Transfer module */}
            <div className="pt-3 border-t border-stone-100 space-y-2">
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5 text-primary-600" />
                🔬 Transférer depuis le laboratoire vers cette consultation
              </label>

              {consPatient.trim() ? (
                (() => {
                  const matchingExams = (laboExamens || []).filter(
                    (e) =>
                      e.patient &&
                      e.patient.toLowerCase().trim().includes(consPatient.toLowerCase().trim())
                  );

                  if (matchingExams.length === 0) {
                    return (
                      <p className="text-xs text-stone-500 dark:text-stone-400 italic">
                        Aucun examen trouvé au laboratoire pour "{consPatient}".
                      </p>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-stone-200/60 rounded-xl p-2.5 bg-stone-50/50">
                      <p className="text-xs font-bold text-stone-600 mb-1">
                        Examens de laboratoire trouvés pour "{consPatient}" :
                      </p>
                      {matchingExams.map((exam) => {
                        const isTransferred = tempLabResults.some((le) => le.id === exam.id);
                        return (
                          <div
                            key={exam.id}
                            className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-200 text-xs shadow-3xs"
                          >
                            <div className="space-y-0.5">
                              <div className="font-semibold text-sm text-stone-800">
                                {exam.analyses || exam.examen || "Analyse Biologique"}
                              </div>
                              <div className="text-2xs text-stone-500 dark:text-stone-400 flex items-center gap-2">
                                <span>Demandé: {new Date(exam.dateDemande).toLocaleDateString("fr-FR")}</span>
                                <span>•</span>
                                <span className={`font-black ${exam.statut === "Prêt" || exam.statut === "Résultat disponible" || exam.statut === "Validé" ? "text-primary-600" : "text-warning-500"}`}>
                                  {exam.statut}
                                </span>
                              </div>
                            </div>
                                                        <button
                              type="button"
                              onClick={() => {
                                if (exam.statut !== "Prêt" && exam.statut !== "Validé" && exam.statut !== "Résultat disponible") {
                                  alert("Le laboratoire n'a pas encore validé les résultats pour cet examen. Veuillez patienter.");
                                  return;
                                }
                                handleLinkLabExamenToTemp(exam);
                              }}
                              disabled={isTransferred || (exam.statut !== "Prêt" && exam.statut !== "Validé" && exam.statut !== "Résultat disponible")}
                              className={`text-xs font-black px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                                isTransferred
                                  ? "bg-primary-50 text-primary-700 border-primary-200 cursor-default"
                                  : (exam.statut !== "Prêt" && exam.statut !== "Validé" && exam.statut !== "Résultat disponible")
                                  ? "bg-stone-100 text-stone-500 dark:text-stone-400 border-stone-200 cursor-not-allowed"
                                  : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                              }`}
                            >
                              {isTransferred ? "Transféré ✓" : (exam.statut !== "Prêt" && exam.statut !== "Validé" && exam.statut !== "Résultat disponible") ? "En attente labo" : "Transférer"}
                              {!isTransferred && (exam.statut === "Prêt" || exam.statut === "Validé" || exam.statut === "Résultat disponible") && <ArrowRight className="w-3 h-3 text-stone-500 dark:text-stone-400" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <p className="text-xs text-stone-500 dark:text-stone-400 italic">
                  Saisissez le nom du patient ci-dessus pour rechercher et transférer ses examens de laboratoire en cours.
                </p>
              )}

              {tempLabResults.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-1.5">
                  <span className="text-xs font-bold text-stone-500 self-center">Transférés :</span>
                  {tempLabResults.map((exam) => (
                    <span
                      key={exam.id}
                      className="inline-flex items-center gap-1 text-xs font-semibold bg-primary-50 text-primary-800 border border-primary-200 rounded-lg px-2 py-0.5"
                    >
                      🔬 {exam.analyses || exam.examen}
                      <button
                        type="button"
                        onClick={() => setTempLabResults(tempLabResults.filter((r) => r.id !== exam.id))}
                        className="hover:text-danger-600 font-semibold ml-1 cursor-pointer font-sans"
                        title="Annuler le transfert"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {tempPhotos.length > 0 && (
              <div className="pt-3 border-t border-stone-100">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">
                  🖼️ Annexes cliniques & photos importées ({tempPhotos.length})
                </label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {tempPhotos.map((photo, idx) => (
                    <div key={idx} className="relative group rounded-lg overflow-hidden border border-stone-200 bg-stone-50 aspect-video">
                      <img
                        src={photo}
                        alt={`Capture ${idx + 1}`}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setTempPhotos(tempPhotos.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 bg-danger-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-danger-700 shadow-xs cursor-pointer"
                        title="Retirer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Diagnostic de certitude / final, après examens du labo */}
            <div className="pt-3 border-t border-stone-100">
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">
                Diagnostic de Certitude / Final
                {tempLabResults.length > 0 && (
                  <span className="text-danger-600 ml-1">* (obligatoire : examen labo lié à cette consultation)</span>
                )}
              </label>
              <input
                type="text"
                placeholder="Ex: Paludisme simple confirmé (GE positive) — à remplir une fois le diagnostic confirmé"
                value={consDiagnosticFinal}
                onChange={(e) => setConsDiagnosticFinal(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
              />
              <p className="text-xs text-stone-500 dark:text-stone-400 italic mt-1">
                Si les résultats du labo ne sont pas encore disponibles, laisse ce champ vide : tu pourras le compléter plus tard depuis le dossier (bouton "Modifier").
              </p>
            </div>

            {/* Décision de Consultation Générale (cahier des charges, points 1-3) */}
            <div className="pt-3 border-t border-stone-100">
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-2">
                ⚕️ Décision de la Consultation Générale
              </label>
              <select
                value={consDecision}
                onChange={(e) => setConsDecision(e.target.value as NonNullable<Consultation["decision"]>)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
              >
                <option value="Retour à domicile">🏠 Retour à domicile</option>
                <option value="Mise en observation">🛏️ Mise en observation</option>
                <option value="Hospitalisation">🏥 Hospitalisation</option>
                <option value="Référer vers un autre service">↗️ Référer vers un autre service</option>
                <option value="Admission aux urgences">🚨 Admettre aux urgences</option>
              </select>
              {consDecision === "Référer vers un autre service" && (
                <input
                  type="text"
                  placeholder="Ex: Maternité, CMA, Chirurgie..."
                  value={consReferenceService}
                  onChange={(e) => setConsReferenceService(e.target.value)}
                  className="w-full mt-2 text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              )}
              {(consDecision === "Hospitalisation" || consDecision === "Mise en observation") && (
                <p className="text-2xs text-info-700 bg-info-50 border border-info-100 rounded-lg px-2.5 py-1.5 mt-2">
                  Un dossier sera automatiquement créé dans le module Hospitalisation avec les données de ce patient.
                </p>
              )}
              {consDecision === "Admission aux urgences" && (
                <p className="text-2xs text-info-700 bg-info-50 border border-info-100 rounded-lg px-2.5 py-1.5 mt-2">
                  Un dossier sera automatiquement créé dans le module Urgences avec les données de ce patient.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Prescription details builder */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4 self-start">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-700" />
            Rédiger l'Ordonnance Médicale
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 bg-stone-50/50 p-3 rounded-xl border border-stone-100">
              <div className="col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Article à prescrire (Médicament, Consommable, Matériel, Réactif) *</label>
                <select
                  value={presMedId ? `id:${presMedId}` : (presCustomMode ? "custom" : "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith("id:")) {
                      const medId = val.slice(3);
                      const med = medicaments.find((m) => m.id === medId);
                      setPresMedId(medId);
                      setPresCustomMode(false);
                      setPresMedName(med ? `${med.nom} ${med.dosage}`.trim() : "");
                    } else if (val === "custom") {
                      setPresMedId(undefined);
                      setPresCustomMode(true);
                      setPresMedName("");
                    } else {
                      setPresMedId(undefined);
                      setPresCustomMode(false);
                      setPresMedName("");
                    }
                  }}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                >
                  <option value="">— Choisir de la pharmacie —</option>
                  <optgroup label="💊 Médicaments (A → Z)">
                    {medicaments
                      .filter((m) => m.stock > 0 && (m.typeArticle || "Médicament") === "Médicament")
                      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
                      .map((m) => (
                        <option key={m.id} value={`id:${m.id}`}>
                          {m.nom} {m.dosage} (Reste : {m.stock})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="📦 Consommables médicaux (A → Z)">
                    {medicaments
                      .filter((m) => m.stock > 0 && m.typeArticle === "Consommable")
                      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
                      .map((m) => (
                        <option key={m.id} value={`id:${m.id}`}>
                          {m.nom} {m.dosage} (Reste : {m.stock})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="🩺 Matériels médicaux techniques (A → Z)">
                    {medicaments
                      .filter((m) => m.stock > 0 && m.typeArticle === "Matériel médical technique")
                      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
                      .map((m) => (
                        <option key={m.id} value={`id:${m.id}`}>
                          {m.nom} {m.dosage} (Reste : {m.stock})
                        </option>
                      ))}
                  </optgroup>
                  <optgroup label="🧪 Réactifs de laboratoire (A → Z)">
                    {medicaments
                      .filter((m) => m.stock > 0 && m.typeArticle === "Réactif de laboratoire")
                      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
                      .map((m) => (
                        <option key={m.id} value={`id:${m.id}`}>
                          {m.nom} {m.dosage} (Reste : {m.stock})
                        </option>
                      ))}
                  </optgroup>
                  <option value="custom">— Autre médicament (Saisie libre) —</option>
                </select>
                {presCustomMode && (
                  <input
                    type="text"
                    placeholder="Saisir nom médicament"
                    value={presMedName}
                    onChange={(e) => setPresMedName(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 mt-1.5 bg-white focus:outline-none"
                  />
                )}
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Posologie *</label>
                <input
                  type="text"
                  placeholder="Ex: 1 comp 3x/jour"
                  value={presPosologie}
                  onChange={(e) => setPresPosologie(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                />
              </div>
              <div className="flex flex-col justify-between">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Durée</label>
                  <input
                    type="text"
                    placeholder="Ex: 5j"
                    value={presDuree}
                    onChange={(e) => setPresDuree(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddPrescriptionLine}
                  className="w-full text-xs font-bold py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-lg mt-1.5 transition-all text-center block"
                >
                  + Ajouter
                </button>
              </div>
              {presMedId && (
                <div className="col-span-4">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">
                    Quantité à déduire du stock pharmacie *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={presQuantite}
                    onChange={(e) => setPresQuantite(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                  />
                  <p className="text-2xs text-info-700 mt-1">
                    Cette quantité sera automatiquement retirée du stock de la pharmacie à l'enregistrement de la consultation.
                  </p>
                </div>
              )}
            </div>

            {/* List of lines added to current prescription */}
            <div className="max-h-52 overflow-y-auto border border-stone-100 rounded-xl">
              {presLines.length === 0 ? (
                <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun médicament prescrit à l'ordonnance.</p>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                      <th className="p-2">Médicament</th>
                      <th className="p-2">Posologie prescrite</th>
                      <th className="p-2">Durée</th>
                      <th className="p-2 text-center">Retirer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    {presLines.map((l) => (
                      <tr key={l.id} className="hover:bg-stone-50/50">
                        <td className="p-2 text-stone-800 font-bold">{l.medicamentNom}</td>
                        <td className="p-2 text-stone-600 font-semibold">{l.posologie}</td>
                        <td className="p-2 text-primary-700 font-semibold font-mono">{l.duree}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePrescriptionLine(l.id)}
                            className="text-stone-300 hover:text-danger-600 transition-all p-0.5"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <button
              type="button"
              onClick={handleSaveConsultation}
              className="w-full text-xs font-bold py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs"
            >
              <CheckCircle className="w-4 h-4 text-success-300" /> Valider l'Examen & Sauvegarder la Fiche
            </button>
          </div>
        </div>
      </div>

      {/* Consultations medical ledger */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="border-b border-stone-100 pb-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-700" />
            Registre Général des Consultation Médicales Archivées
          </h3>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher patient ou diagnostic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse bg-stone-100 dark:bg-stone-800 rounded-xl p-4 h-16 border border-stone-200 dark:border-stone-700"></div>
            ))}
          </div>
        ) : filteredPatientDossiers.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun dossier clinique enregistré.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Patient</th>
                  <th className="p-3 text-center">Âge / Sexe</th>
                  <th className="p-3">Dernière visite</th>
                  <th className="p-3 text-center">Consultations</th>
                  <th className="p-3 text-center">Examens labo</th>
                  <th className="p-3 text-center">Documents scannés</th>
                  <th className="p-3 text-center">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPatientDossiers.map((p) => (
                  <tr key={p.key} className="hover:bg-stone-50/50">
                    <td className="p-3 font-bold text-stone-800">
                      <div>{p.patient}</div>
                      {p.contact && <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">📞 {p.contact}</div>}
                    </td>
                    <td className="p-3 text-center font-semibold text-stone-600">
                      {p.age} ans / {p.sexe}
                    </td>
                    <td className="p-3 font-mono text-stone-500 dark:text-stone-400">
                      {new Date(p.lastDate).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block bg-primary-50 text-primary-700 border border-primary-200 rounded-lg px-2 py-1 text-xs font-bold">
                        {p.consultations.length}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block bg-info-50 text-info-700 border border-info-200 rounded-lg px-2 py-1 text-xs font-bold">
                        {p.labExams.length}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-block bg-stone-100 text-stone-700 border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold">
                        {p.scannedDocs.length}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col gap-1 items-center">
                        <button
                          type="button"
                          onClick={() => setViewingPatientKey(p.key)}
                          className="bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-lg border border-primary-200 transition-all inline-flex items-center gap-1 w-full justify-center"
                        >
                          <Eye className="w-3 h-3" /> Voir le dossier
                        </button>
                        <button
                          type="button"
                          onClick={() => handleContinuerDossier(p.consultations[0])}
                          className="bg-info-50 hover:bg-info-100 text-info-700 text-xs font-bold px-2 py-1 rounded-lg border border-info-200 transition-all inline-flex items-center gap-1 w-full justify-center"
                          title="Nouvelle consultation pour ce patient"
                        >
                          <Plus className="w-3 h-3" /> Nouvelle visite
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dossier Patient Modal : suite chronologique des consultations, examens labo et documents scannés */}
      {viewingPatientDossier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-stone-100 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-serif font-bold text-stone-900">{viewingPatientDossier.patient}</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  {viewingPatientDossier.age} ans / {viewingPatientDossier.sexe}
                  {viewingPatientDossier.contact ? ` — 📞 ${viewingPatientDossier.contact}` : ""}
                  {" — "}{viewingPatientDossier.consultations.length} consultation{viewingPatientDossier.consultations.length > 1 ? "s" : ""} enregistrée{viewingPatientDossier.consultations.length > 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPatientKey(null)}
                className="p-2 hover:bg-stone-100 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-6">
              {/* Historique des consultations */}
              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Historique des consultations
                </h4>
                <div className="space-y-2">
                  {viewingPatientDossier.consultations.map((c) => (
                    <div key={c.id} className="border border-stone-200 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-stone-500 dark:text-stone-400">{new Date(c.date).toLocaleDateString("fr-FR")}</div>
                        <div className="text-sm font-bold text-primary-800 truncate">{c.diagnostic}</div>
                        <div className="text-xs text-stone-500 truncate">{c.plainte}</div>
                        {c.decision && c.decision !== "Retour à domicile" && (
                          <span className="inline-block mt-1 text-2xs font-bold px-2 py-0.5 rounded-lg bg-warning-50 text-warning-700 border border-warning-200">
                            {c.decision}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => { setSelectedConsultation(c); setIsEditingDetail(false); }}
                          className="bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-bold px-2 py-1 rounded-lg border border-primary-200 transition-all inline-flex items-center gap-1 justify-center whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3" /> Fiche
                        </button>
                        {c.ordonnance && c.ordonnance.length > 0 && (
                          <button
                            type="button"
                            onClick={() => handlePrintPrescriptionOnly(c)}
                            className="bg-success-50 hover:bg-success-100 text-success-700 text-xs font-bold px-2 py-1 rounded-lg border border-success-200 transition-all inline-flex items-center gap-1 justify-center whitespace-nowrap"
                          >
                            <Printer className="w-3 h-3" /> Ordonnance
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteConsult(c.id)}
                          className="text-stone-300 hover:text-danger-600 transition-all p-1 self-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Examens de laboratoire */}
              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4" /> Examens de laboratoire
                </h4>
                {viewingPatientDossier.labExams.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400 italic">Aucun examen de laboratoire enregistré pour ce patient.</p>
                ) : (
                  <div className="space-y-2">
                    {viewingPatientDossier.labExams.map((e) => (
                      <div key={e.id} className="border border-stone-200 rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-stone-500 dark:text-stone-400">{new Date(e.dateDemande).toLocaleDateString("fr-FR")}</div>
                          <div className="text-sm font-bold text-stone-800 truncate">{e.analyses || e.examen}</div>
                        </div>
                        <span className="text-2xs font-bold px-2 py-1 rounded-lg bg-stone-100 text-stone-700 border border-stone-200 shrink-0 whitespace-nowrap">
                          {e.statut}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents scannés */}
              <div>
                <h4 className="text-xs uppercase font-bold tracking-wider text-stone-500 mb-2 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Documents scannés
                </h4>
                {viewingPatientDossier.scannedDocs.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-stone-400 italic">Aucun document scanné pour ce patient. Ajoutez-en depuis le Coffre-fort Documents.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {viewingPatientDossier.scannedDocs.map((d) => (
                      <a
                        key={d.id}
                        href={`data:${d.fileType || "application/octet-stream"};base64,${d.base64Data}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border border-stone-200 rounded-xl p-3 hover:bg-stone-50 transition-all flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-primary-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-800 truncate">{d.titre}</div>
                          <div className="text-2xs text-stone-500 dark:text-stone-400">{d.categorie} — {new Date(d.dateUpload).toLocaleDateString("fr-FR")}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-stone-100 bg-stone-50/50 rounded-b-2xl shrink-0 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingPatientKey(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-bold transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consultation Detail Modal (Printable) */}
      {selectedConsultation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto print:static print:bg-white print:p-0">
          <div className={`w-full max-w-4xl rounded-2xl shadow-xl border overflow-hidden max-h-[90vh] flex flex-col print:border-none print:shadow-none print:max-w-full print:max-h-full print:w-full print:h-auto ${
            theme === "dark" ? "bg-stone-900 border-stone-800 text-stone-100" : "bg-white border-stone-200 text-stone-800"
          }`}>
            {/* Modal Header */}
            <div className={`p-4 border-b flex justify-between items-center no-print ${
              theme === "dark" ? "border-stone-800" : "border-stone-100"
            }`}>
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary-600" />
                <h3 className="font-serif font-bold text-base">Rapport Clinique & Dossier Patient</h3>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingDetail ? (
                  <>
                    <button
                      type="button"
                      onClick={startEditingDetail}
                      className="bg-warning-600 hover:bg-warning-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      ✏️ Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadPDF(selectedConsultation)}
                      className="bg-success-600 hover:bg-success-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger le PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <Printer className="w-4 h-4" />
                      Imprimer le dossier
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveEditedConsultation}
                      className="bg-success-600 hover:bg-success-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      ✅ Enregistrer les modifications
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingDetail}
                      className="bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      Annuler
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => { setSelectedConsultation(null); setIsEditingDetail(false); }}
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
                    DOSSIER MEDICAL DE CONSULTATION
                  </div>
                </div>

                {/* Patient Information Section */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-3">1. Informations Générales</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-6 text-xs">
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">N° (1) / Ordre :</span>
                      <p className={`font-mono font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-stone-450 font-semibold uppercase text-xs">Nom et prénom(s) (2) :</span>
                      <p className={`font-semibold text-sm mt-0.5 ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedConsultation.patient}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Age (6) :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.age} Ans</p>
                    </div>
                    
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Sexe (4) :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.sexe}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Profession (3) :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.profession || "—"}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Femme enceinte (5) :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.sexe === "Féminin" ? (selectedConsultation.femmeEnceinte ? "Oui" : "Non") : "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Date d'Examen :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{new Date(selectedConsultation.date).toLocaleDateString("fr-FR")}</p>
                    </div>

                    <div className="col-span-2">
                      <span className="text-stone-450 font-semibold uppercase text-xs">Adresse (7) - Commune/Village :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>
                        {selectedConsultation.commune ? selectedConsultation.commune : ""}
                        {selectedConsultation.commune && selectedConsultation.villageSecteur ? " / " : ""}
                        {selectedConsultation.villageSecteur ? selectedConsultation.villageSecteur : ""}
                        {!selectedConsultation.commune && !selectedConsultation.villageSecteur ? "—" : ""}
                      </p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Téléphone (7) :</span>
                      <p className={`font-mono font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.contact || "—"}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Zone résidence (8) :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.zoneResidence || "—"}</p>
                    </div>

                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Mode d'entrée (9) :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.modeEntree || "—"}</p>
                    </div>
                    <div>
                      <span className="text-stone-450 font-semibold uppercase text-xs">Ancien consultant (15) :</span>
                      <p className={`font-bold mt-0.5 ${theme === "dark" ? "text-stone-300" : "text-stone-700"}`}>{selectedConsultation.ancienConsultant ? "Oui (Déjà venu)" : "Non (Nouveau)"}</p>
                    </div>
                  </div>
                </div>

                {/* Vitals Section */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-3">2. Constantes Physiologiques à l'admission</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-center">
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-2.5 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-2xs font-bold text-stone-450 uppercase">Température</span>
                      <p className="text-xs sm:text-sm font-semibold text-danger-600 mt-0.5 font-mono">{selectedConsultation.vitals.temperature ? `${selectedConsultation.vitals.temperature} °C` : "—"}</p>
                    </div>
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-2.5 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-2xs font-bold text-stone-450 uppercase">Poids</span>
                      <p className={`text-xs sm:text-sm font-semibold mt-0.5 font-mono ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedConsultation.vitals.poids ? `${selectedConsultation.vitals.poids} kg` : "—"}</p>
                    </div>
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-2.5 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-2xs font-bold text-stone-450 uppercase">Taille</span>
                      <p className={`text-xs sm:text-sm font-semibold mt-0.5 font-mono ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedConsultation.vitals.taille ? `${selectedConsultation.vitals.taille} cm` : "—"}</p>
                    </div>
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-2.5 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-2xs font-bold text-stone-450 uppercase">IMC</span>
                      <p className={`text-xs sm:text-sm font-semibold mt-0.5 font-mono ${
                        selectedConsultation.vitals.imc 
                          ? selectedConsultation.vitals.imc < 18.5 ? "text-warning-600" : selectedConsultation.vitals.imc < 25 ? "text-success-600" : selectedConsultation.vitals.imc < 30 ? "text-orange-500" : "text-danger-600"
                          : "text-stone-450"
                      }`}>{selectedConsultation.vitals.imc ? `${selectedConsultation.vitals.imc} kg/m²` : "—"}</p>
                    </div>
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-2.5 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-2xs font-bold text-stone-450 uppercase">Tension (TA)</span>
                      <p className={`text-xs sm:text-sm font-semibold mt-0.5 font-mono ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedConsultation.vitals.tensionArterielle || "—"}</p>
                    </div>
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-2.5 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-2xs font-bold text-stone-450 uppercase">Pouls</span>
                      <p className={`text-xs sm:text-sm font-semibold mt-0.5 font-mono ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedConsultation.vitals.pouls ? `${selectedConsultation.vitals.pouls} bpm` : "—"}</p>
                    </div>
                    <div className={`${theme === "dark" ? "bg-stone-800" : "bg-stone-50"} p-2.5 rounded-xl border ${theme === "dark" ? "border-stone-700" : "border-stone-100"}`}>
                      <span className="text-2xs font-bold text-stone-450 uppercase font-sans">Glycémie</span>
                      <p className={`text-xs sm:text-sm font-semibold mt-0.5 font-mono ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{selectedConsultation.vitals.glycemie ? `${selectedConsultation.vitals.glycemie} g/L` : "—"}</p>
                    </div>
                  </div>

                  {/* Nutritional assessment banner */}
                  {selectedConsultation.vitals.imc && (
                    <div className={`mt-3 px-3 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 ${
                      selectedConsultation.vitals.imc < 18.5 
                        ? "bg-warning-500/10 text-warning-600 border-warning-500/20" 
                        : selectedConsultation.vitals.imc < 25 
                          ? "bg-success-500/10 text-success-600 border-success-500/20" 
                          : selectedConsultation.vitals.imc < 30 
                            ? "bg-orange-500/10 text-orange-500 border-orange-500/20" 
                            : "bg-danger-500/10 text-danger-600 border-danger-500/20"
                    }`}>
                      <span>⚖️ Évaluation nutritionnelle :</span>
                      <span>
                        IMC de {selectedConsultation.vitals.imc} kg/m² — {" "}
                        {selectedConsultation.vitals.imc < 18.5 
                          ? "Insuffisance pondérale (Maigreur)" 
                          : selectedConsultation.vitals.imc < 25 
                            ? "Corpulence normale" 
                            : selectedConsultation.vitals.imc < 30 
                              ? "Surpoids" 
                              : "Obésité"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Clinical Notes Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-2">3. Motif de Consultation / Plaintes</h3>
                    {isEditingDetail ? (
                      <textarea
                        value={editPlainte}
                        onChange={(e) => setEditPlainte(e.target.value)}
                        className={`w-full text-xs p-3 rounded-xl border min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                          theme === "dark" ? "bg-stone-800 border-stone-700 text-stone-200" : "bg-stone-50 border-stone-200 text-stone-700"
                        }`}
                      />
                    ) : (
                      <p className={`text-xs p-3 rounded-xl border italic min-h-[80px] ${
                        theme === "dark" ? "bg-stone-800 border-stone-700 text-stone-200" : "bg-stone-50 border-stone-100 text-stone-700"
                      }`}>
                        "{selectedConsultation.plainte}"
                      </p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-2">4. Examen Clinique Physique</h3>
                    {isEditingDetail ? (
                      <textarea
                        value={editExamenPhysique}
                        onChange={(e) => setEditExamenPhysique(e.target.value)}
                        className={`w-full text-xs p-3 rounded-xl border min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                          theme === "dark" ? "bg-stone-800 border-stone-700 text-stone-200" : "bg-stone-50 border-stone-200 text-stone-700"
                        }`}
                      />
                    ) : (
                      <p className={`text-xs p-3 rounded-xl border min-h-[80px] ${
                        theme === "dark" ? "bg-stone-800 border-stone-700 text-stone-200" : "bg-stone-50 border-stone-100 text-stone-700"
                      }`}>
                        {selectedConsultation.examenPhysique || "—"}
                      </p>
                    )}
                  </div>
                </div>

                {/* Diagnosis Section */}
                <div className={`p-4 rounded-xl border ${
                  theme === "dark" ? "bg-primary-950/20 border-primary-900 text-primary-200" : "bg-primary-50/50 border-primary-150 text-primary-900"
                }`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 mb-1">5. Conclusion Clinique & Diagnostic</h3>
                  {isEditingDetail ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Diagnostic de Présomption *</label>
                        <input
                          type="text"
                          value={editDiagnostic}
                          onChange={(e) => setEditDiagnostic(e.target.value)}
                          className="w-full text-sm font-semibold border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">
                          Diagnostic Final / de Sortie
                          {selectedConsultation.labResults && selectedConsultation.labResults.length > 0 && (
                            <span className="text-danger-600 ml-1">* (obligatoire : examen labo prescrit)</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={editDiagnosticFinal}
                          onChange={(e) => setEditDiagnosticFinal(e.target.value)}
                          placeholder="Ex: Paludisme simple confirmé (GE positive)"
                          className="w-full text-sm font-semibold border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Observations / Conseils</label>
                        <textarea
                          value={editObservations}
                          onChange={(e) => setEditObservations(e.target.value)}
                          className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 min-h-[60px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <span className="text-xs uppercase font-semibold tracking-wider text-primary-700/70">Diagnostic de Présomption :</span>
                        <p className="text-sm font-semibold">{selectedConsultation.diagnostic}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase font-semibold tracking-wider text-primary-700/70">Diagnostic Final / de Sortie :</span>
                        <p className="text-sm font-semibold">
                          {selectedConsultation.diagnosticFinal || (
                            <span className="italic font-normal text-stone-500">
                              Non renseigné {selectedConsultation.labResults && selectedConsultation.labResults.length > 0 ? "— examen labo en attente" : ""}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prescription Section */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-3">6. Prescription / Traitement Ordonné</h3>
                  {(!selectedConsultation.ordonnance || selectedConsultation.ordonnance.length === 0) ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic py-4">Aucune ordonnance émise au dossier.</p>
                  ) : (
                    <table className="w-full text-left text-xs border border-stone-200 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold text-xs uppercase">
                          <th className="p-2.5">Médicament</th>
                          <th className="p-2.5">Posologie</th>
                          <th className="p-2.5">Durée</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-medium">
                        {selectedConsultation.ordonnance.map((o) => (
                          <tr key={o.id}>
                            <td className={`p-2.5 font-bold ${theme === "dark" ? "text-white" : "text-stone-800"}`}>{o.medicamentNom}</td>
                            <td className={`${theme === "dark" ? "text-stone-300" : "text-stone-600"} p-2.5`}>{o.posologie}</td>
                            <td className="p-2.5 text-primary-700 font-semibold">{o.duree}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Section Examens de Laboratoire Transférés */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-1">
                    🔬 Résultats d'Examens Biologiques du Laboratoire
                  </h3>

                  {/* Direct Laboratory Exams Transfer List for active patient in Detailed View */}
                  <div className="no-print border border-stone-200/60 rounded-xl p-3 bg-stone-50/50 space-y-2">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1">
                      <FlaskConical className="w-3.5 h-3.5 text-primary-600" />
                      Associer/Transférer un examen du Laboratoire directement à ce dossier
                    </p>
                    {(() => {
                      const patientName = selectedConsultation.patient;
                      const matchingExams = (laboExamens || []).filter(
                        (e) =>
                          e.patient &&
                          e.patient.toLowerCase().trim().includes(patientName.toLowerCase().trim())
                      );

                      if (matchingExams.length === 0) {
                        return (
                          <p className="text-xs text-stone-500 dark:text-stone-400 italic">
                            Aucun examen trouvé au laboratoire pour "{patientName}".
                          </p>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pt-1">
                          {matchingExams.map((exam) => {
                            const isLinked = (selectedConsultation.labResults || []).some(
                              (le) => le.id === exam.id
                            );
                            return (
                              <div
                                key={exam.id}
                                className="flex items-center justify-between p-2 bg-white rounded-lg border border-stone-200 text-xs shadow-3xs"
                              >
                                <div className="space-y-0.5 max-w-[70%]">
                                  <div className="font-semibold text-xs text-stone-800 truncate">
                                    {exam.analyses || exam.examen || "Analyse Biologique"}
                                  </div>
                                  <div className="text-2xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                                    <span>{new Date(exam.dateDemande).toLocaleDateString("fr-FR")}</span>
                                    <span>•</span>
                                    <span className={`font-black ${exam.statut === "Prêt" || exam.statut === "Résultat disponible" || exam.statut === "Validé" ? "text-primary-600" : "text-warning-500"}`}>
                                      {exam.statut}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleLinkLabExamenToSelected(exam)}
                                  disabled={isLinked}
                                  className={`text-xs font-black px-2 py-1 rounded-lg border transition-all flex items-center gap-0.5 cursor-pointer ${
                                    isLinked
                                      ? "bg-primary-50 text-primary-700 border-primary-200 cursor-default"
                                      : "bg-white text-stone-700 border-stone-200 hover:bg-stone-50"
                                  }`}
                                >
                                  {isLinked ? "Transféré ✓" : "Transférer"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Display list of already linked/transferred lab exams */}
                  {(!selectedConsultation.labResults || selectedConsultation.labResults.length === 0) ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic py-2">
                      Aucun transfert de résultat de laboratoire structuré n'a encore été associé à ce dossier.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedConsultation.labResults.map((exam) => (
                        <div
                          key={exam.id}
                          className={`p-3.5 rounded-xl border flex flex-col justify-between shadow-3xs relative overflow-hidden group ${
                            theme === "dark" ? "bg-stone-850 border-stone-800" : "bg-white border-stone-200"
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-2xs font-semibold uppercase bg-primary-100 text-primary-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <FlaskConical className="w-3.5 h-3.5 text-primary-600" />
                                Résultat de Laboratoire
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm("Délier cet examen de laboratoire ?")) {
                                    const updatedLabResults = selectedConsultation.labResults!.filter(
                                      (r) => r.id !== exam.id
                                    );
                                    const updatedCons: Consultation = {
                                      ...selectedConsultation,
                                      labResults: updatedLabResults
                                    };
                                    setSelectedConsultation(updatedCons);
                                    const updatedList = consultations.map((c) =>
                                      c.id === selectedConsultation.id ? updatedCons : c
                                    );
                                    onUpdateConsultations(updatedList);
                                  }
                                }}
                                className="text-stone-500 dark:text-stone-400 hover:text-danger-600 font-semibold text-xs cursor-pointer no-print opacity-0 group-hover:opacity-100 transition-all"
                                title="Délier l'examen"
                              >
                                Déconnecter
                              </button>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-stone-800 dark:text-white">
                                {exam.analyses || exam.examen}
                              </h4>
                              <p className="text-xs text-stone-500 dark:text-stone-400">
                                Demandé le: {new Date(exam.dateDemande).toLocaleDateString("fr-FR")} | Validé le: {exam.dateResultat ? new Date(exam.dateResultat).toLocaleDateString("fr-FR") : "En attente"}
                              </p>
                            </div>

                            <div className="bg-stone-50 dark:bg-stone-900/40 p-2.5 rounded-lg border border-stone-100 dark:border-stone-800 font-mono text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                              {exam.resultat || "En attente de rédaction des résultats..."}
                            </div>
                          </div>

                          <div className="mt-2.5 flex items-center justify-between text-xs">
                            <span className="font-semibold text-stone-500">
                              Technicien: {exam.technicien || "Non assigné"}
                            </span>
                            <span className={`font-semibold px-1.5 py-0.5 rounded-lg uppercase text-2xs ${
                              exam.interpretation?.toLowerCase() === "normal"
                                ? "bg-success-50 text-success-700"
                                : "bg-danger-50 text-danger-700"
                            }`}>
                              {exam.interpretation || "Normal"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section Photos Médicales (Plaies, Radios, Documents) */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-1">
                    7. Annexes Cliniques & Imagerie (Plaies, Radios, Documents)
                  </h3>

                  {/* Photo & File Upload Launcher inside detailed patient file */}
                  <div className="no-print mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Camera Button */}
                    <button
                      type="button"
                      onClick={() => setShowDetailCamera(!showDetailCamera)}
                      className="bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-primary-200 transition-all flex items-center gap-2 cursor-pointer shadow-3xs"
                    >
                      <Camera className="w-4 h-4 text-primary-600" />
                      {showDetailCamera ? "Fermer l'appareil photo" : "📷 Capturer une image en direct (Caméra)"}
                    </button>

                    {/* Computer Upload Button */}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              handleAddPhotoToActiveConsultation(reader.result as string);
                              alert("Examen de laboratoire téléversé avec succès !");
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        id="pf-detail-file-upload"
                        className="hidden"
                      />
                      <label
                        htmlFor="pf-detail-file-upload"
                        className="bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold px-4 py-2.5 rounded-xl border border-stone-200 transition-all flex items-center gap-2 cursor-pointer shadow-3xs inline-block"
                      >
                        <Upload className="w-4 h-4 text-stone-500" />
                        📁 Importer un examen (Photo de l'ordinateur)
                      </label>
                    </div>
                  </div>

                  {showDetailCamera && (
                    <div className="no-print mb-4">
                      <CameraCapture
                        theme={theme}
                        onCapture={handleAddPhotoToActiveConsultation}
                        onClose={() => setShowDetailCamera(false)}
                      />
                    </div>
                  )}

                  {(!selectedConsultation.photos || selectedConsultation.photos.length === 0) ? (
                    <p className="text-xs text-stone-500 dark:text-stone-400 italic py-3 bg-stone-50/50 dark:bg-stone-850/20 text-center rounded-xl border border-dashed border-stone-200 dark:border-stone-800">
                      Aucune capture d'image ni document d'imagerie associé à cette consultation.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {selectedConsultation.photos.map((photo, idx) => (
                        <div key={idx} className="relative group rounded-xl overflow-hidden border border-stone-200 bg-stone-100 dark:bg-stone-900 aspect-video flex items-center justify-center">
                          <img
                            src={photo}
                            alt={`Imagerie ${idx + 1}`}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-all"
                            onClick={() => {
                              const w = window.open();
                              if (w) w.document.write(`<img src="${photo}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                            }}
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Supprimer cette image médicale définitivement ?")) {
                                const updatedPhotos = selectedConsultation.photos!.filter((_, i) => i !== idx);
                                const updatedCons: Consultation = {
                                  ...selectedConsultation,
                                  photos: updatedPhotos
                                };
                                setSelectedConsultation(updatedCons);
                                const updatedList = consultations.map((c) => c.id === selectedConsultation.id ? updatedCons : c);
                                onUpdateConsultations(updatedList);
                              }
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-danger-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-danger-700 shadow-sm cursor-pointer no-print"
                            title="Supprimer cette image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                                {/* Observations Section */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-primary-800 border-b pb-1 mb-3">6. Observations (16)</h3>
                  <div className={`p-3 rounded-lg border text-sm ${theme === "dark" ? "bg-stone-850/50 border-stone-800 text-stone-300" : "bg-stone-50 border-stone-100 text-stone-700"}`}>
                    {selectedConsultation.observations || <span className="italic opacity-50">Aucune observation particulière...</span>}
                  </div>
                </div>

                {/* Footer Signatures */}
                <div className="pt-8 border-t border-dashed border-stone-200 flex justify-between text-xs">
                  <div>
                    <p className="font-bold text-stone-450 uppercase text-2xs">Généré le :</p>
                    <p className="font-mono text-stone-500">{new Date().toLocaleString("fr-FR")}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${theme === "dark" ? "text-white" : "text-stone-800"}`}>Le Médecin Praticien Référent</p>
                    <p className="text-stone-500 italic mt-0.5">
                      {staff.find((s) => s.id === selectedConsultation.medecinId)?.nom || "Généraliste Traitant"}
                    </p>
                    <div className="mt-4 border border-dashed border-primary-500 text-primary-600 inline-block px-4 py-2 rounded-lg font-bold uppercase text-2xs">
                      Cachet & Signature
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
