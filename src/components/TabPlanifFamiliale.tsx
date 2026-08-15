/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { FichePlanifFamiliale, Staff, ExamenLabo } from "../types";
import { generateUid, getTodayStr, safeGet, safeSet } from "../data";
import {
  Plus,
  Trash2,
  Calendar,
  ClipboardList,
  Heart,
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Info,
  BookOpen,
  Printer,
  ChevronRight,
  FileText,
  UserCheck,
  Award,
  ListFilter,
  Search,
  FlaskConical
} from "lucide-react";

interface TabPlanifFamilialeProps {
  staff: Staff[];
  theme?: "light" | "dark";
  laboExamens?: ExamenLabo[];
  onUpdateLaboExamens?: (examens: ExamenLabo[]) => void;
  currentUser?: Staff | null;
}

// WHO MEC Criteria definition
interface MECCondition {
  id: string;
  label: string;
  category: "gyn" | "cardio" | "general" | "comportement";
}

const MEC_CONDITIONS: MECCondition[] = [
  { id: "allait_6s", label: "Allaitement maternel (< 6 semaines postpartum)", category: "gyn" },
  { id: "allait_6s_6m", label: "Allaitement maternel (6 semaines à 6 mois postpartum)", category: "gyn" },
  { id: "postpartum_non_allait", label: "Postpartum (< 21 jours, non-allaitement)", category: "gyn" },
  { id: "grosse_suspectee", label: "Grossesse suspectée ou confirmée", category: "gyn" },
  { id: "hta_legere", label: "Hypertension artérielle légère (140-159 / 90-99 mmHg)", category: "cardio" },
  { id: "hta_severe", label: "Hypertension artérielle sévère (>= 160 / 100 mmHg)", category: "cardio" },
  { id: "atcd_mte", label: "Antécédent de Thrombose Veineuse Profonde (TVP) ou d'Embolie Pulmonaire (EP)", category: "cardio" },
  { id: "tabac_35_plus", label: "Tabagisme (> 15 cigarettes/jour chez femme de >= 35 ans)", category: "comportement" },
  { id: "migraine_aura", label: "Migraine avec aura (tout âge)", category: "cardio" },
  { id: "diabete_vasc", label: "Diabète avec néphropathie ou autre maladie vasculaire", category: "general" },
  { id: "cancer_sein", label: "Cancer du sein actuel ou récent (< 5 ans)", category: "gyn" },
  { id: "infection_pelv", label: "Infection pelvienne (MIP, cervicite purulente actuelle)", category: "gyn" },
  { id: "tumeur_foie", label: "Tumeur hépatique bénigne ou maligne / Cirrhose sévère", category: "general" }
];

// Methods evaluation table based on conditions chosen
// 1 = Green (Sans restriction), 2 = Yellow (Avantages > Risques), 3 = Orange (Risques > Avantages), 4 = Red (Contre-indiqué)
const getMECRating = (conditionIds: string[], methodId: string): { rating: 1 | 2 | 3 | 4; reasons: string[] } => {
  let rating: 1 | 2 | 3 | 4 = 1;
  const reasons: string[] = [];

  conditionIds.forEach((id) => {
    if (methodId === "coc") { // Combined Oral Contraceptive
      if (id === "grosse_suspectee") { rating = Math.max(rating, 4) as any; reasons.push("Grossesse confirmée/suspectée : Contre-indication absolue"); }
      else if (id === "allait_6s") { rating = Math.max(rating, 4) as any; reasons.push("L'allaitement de < 6 semaines : Les œstrogènes diminuent la lactation"); }
      else if (id === "allait_6s_6m") { rating = Math.max(rating, 3) as any; reasons.push("L'allaitement de 6s à 6m : Risque d'impact sur la qualité du lait"); }
      else if (id === "hta_severe" || id === "atcd_mte" || id === "migraine_aura" || id === "cancer_sein") { rating = Math.max(rating, 4) as any; reasons.push("Risque thromboembolique et cardiovasculaire inacceptable"); }
      else if (id === "tabac_35_plus") { rating = Math.max(rating, 4) as any; reasons.push("Risque d'accident cardiovasculaire majeur (>35 ans et tabac)"); }
      else if (id === "hta_legere" || id === "diabete_vasc" || id === "tumeur_foie") { rating = Math.max(rating, 3) as any; reasons.push("Nécessite une surveillance médicale étroite"); }
    }
    else if (methodId === "pop") { // Progestogen-only Pill
      if (id === "grosse_suspectee") { rating = Math.max(rating, 4) as any; reasons.push("Grossesse confirmée/suspectée : Contre-indication absolue"); }
      else if (id === "cancer_sein") { rating = Math.max(rating, 4) as any; reasons.push("Cancer du sein sensible aux hormones"); }
      else if (id === "allait_6s") { rating = Math.max(rating, 2) as any; reasons.push("Utilisable dès 6 semaines postpartum"); }
      else if (id === "tumeur_foie") { rating = Math.max(rating, 3) as any; reasons.push("Métabolisme hépatique altéré"); }
    }
    else if (methodId === "injectable") { // DMPA Injectable
      if (id === "grosse_suspectee") { rating = Math.max(rating, 4) as any; reasons.push("Grossesse confirmée/suspectée : Contre-indication absolue"); }
      else if (id === "cancer_sein") { rating = Math.max(rating, 4) as any; reasons.push("Sensibilité hormonale tumorale"); }
      else if (id === "hta_severe") { rating = Math.max(rating, 3) as any; reasons.push("Risque d'aggravation de l'HTA"); }
      else if (id === "diabete_vasc") { rating = Math.max(rating, 3) as any; reasons.push("Risques vasculaires accrus"); }
      else if (id === "tumeur_foie") { rating = Math.max(rating, 3) as any; reasons.push("Métabolisme hépatique"); }
    }
    else if (methodId === "implants") { // Implants (Jadelle/Implanon)
      if (id === "grosse_suspectee") { rating = Math.max(rating, 4) as any; reasons.push("Grossesse confirmée/suspectée : Contre-indication absolue"); }
      else if (id === "cancer_sein") { rating = Math.max(rating, 4) as any; reasons.push("Sensibilité hormonale tumorale"); }
      else if (id === "tumeur_foie") { rating = Math.max(rating, 3) as any; reasons.push("Risque d'altération hépatique"); }
    }
    else if (methodId === "diu_cu") { // Copper IUD (DIU au Cuivre)
      if (id === "grosse_suspectee") { rating = Math.max(rating, 4) as any; reasons.push("Grossesse : Risque majeur d'avortement septique"); }
      else if (id === "infection_pelv") { rating = Math.max(rating, 4) as any; reasons.push("Infection génitale haute active : Risque infectieux grave"); }
      else if (id === "postpartum_non_allait" || id === "allait_6s") { rating = Math.max(rating, 2) as any; reasons.push("Insertion possible dans les 48h, sinon reporter à 4 semaines"); }
    }
  });

  return { rating, reasons };
};

export default function TabPlanifFamiliale({ staff, theme = "light", laboExamens = [], onUpdateLaboExamens, currentUser }: TabPlanifFamilialeProps) {
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

  // Registry states
  const [planifs, setPlanifs] = useState<FichePlanifFamiliale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("Tous");
  const [viewMode, setViewMode] = useState<"synthetic" | "detailed">("detailed");

  // Form states
  const [patient, setPatient] = useState("");
  const [nomPatiente, setNomPatiente] = useState("");
  const [prenomPatiente, setPrenomPatiente] = useState("");
  const [adresse, setAdresse] = useState("");
  const [nomEpoux, setNomEpoux] = useState("");
  const [nombreEnfants, setNombreEnfants] = useState("");
  const [programmeProchainEnfant, setProgrammeProchainEnfant] = useState("");
  const [ancienneMethode, setAnancienneMethode] = useState("");
  const [estNouvelleFois, setEstNouvelleFois] = useState(true);
  const [age, setAge] = useState("");
  const [contact, setContact] = useState("");
  const [methodeChoisie, setMethodeChoisie] = useState("DIU au Cuivre");
  const [dateDebut, setDateDebut] = useState(getTodayStr());
  const [dateSuiviPrevu, setDateSuiviPrevu] = useState("");
  const [counselingEffectue, setCounselingEffectue] = useState(true);
  const [consentementSigne, setConsentementSigne] = useState(false);
  const [ta, setTa] = useState("");
  const [poids, setPoids] = useState("");
  const [notesMedicales, setNotesMedicales] = useState("");
  const [agentId, setAgentId] = useState("");

  // WHO Disk UI state
  const [selectedMecConditions, setSelectedMecConditions] = useState<string[]>([]);
  const [viewProcedureTab, setViewProcedureTab] = useState<"diu" | "implant" | "injectable" | "pilule">("diu");

  // Counseling Interactive Checklists
  const [counselingSteps, setCounselingSteps] = useState({
    accueil: false,
    antencedents: false,
    optionsExplication: false,
    choixLibre: false,
    modeEmploi: false,
    rendezvousSuivi: false
  });

  // Printing and Modal previews
  const [activePreviewDoc, setActivePreviewDoc] = useState<{
    type: "counseling" | "consentement" | "all_data";
    patientData: Partial<FichePlanifFamiliale>;
  } | null>(null);

  // Load registry from LocalStorage
  useEffect(() => {
    const data = safeGet<FichePlanifFamiliale[]>("dg_planif_familiale", []);
    // Fallback seed
    if (data.length === 0) {
      const initial: FichePlanifFamiliale[] = [
        {
          id: "PF-2026-001",
          patient: "Fatoumata Barro",
          age: 28,
          contact: "+226 70 41 55 92",
          methodeChoisie: "Implants (Jadelle)",
          dateDebut: "2026-06-15",
          dateSuiviPrevu: "2026-09-15",
          counselingEffectue: true,
          consentementSigne: true,
          ta: "120/70",
          poids: 64,
          contraintesSelectionnees: [],
          notesMedicales: "Excellente tolérance clinique. Pas d'effets secondaires signalés.",
          agentId: staff[0]?.id || "sage_femme",
          statut: "En cours",
          createdAt: new Date().toISOString()
        },
        {
          id: "PF-2026-002",
          patient: "Mariam Ouédraogo",
          age: 32,
          contact: "+226 65 12 90 44",
          methodeChoisie: "DIU au Cuivre",
          dateDebut: "2026-07-02",
          dateSuiviPrevu: "2026-08-02",
          counselingEffectue: true,
          consentementSigne: true,
          ta: "115/80",
          poids: 58,
          contraintesSelectionnees: ["allait_6s_6m"],
          notesMedicales: "Insertion réussie sans douleur aiguë. Fil de contrôle vérifié à 1.5 cm.",
          agentId: staff[1]?.id || "sage_femme",
          statut: "En cours",
          createdAt: new Date().toISOString()
        }
      ];
      setPlanifs(initial);
      safeSet("dg_planif_familiale", initial);
    } else {
      setPlanifs(data);
    }
  }, [staff]);

  // Handle lab prescription
  const [pfPrescriptionAnalyse, setPfPrescriptionAnalyse] = useState("");

  const handlePrescrireExamenPf = () => {
    const fullName = `${prenomPatiente} ${nomPatiente}`.trim();
    if (!fullName) {
      alert("Veuillez d'abord renseigner le nom et prénom de la patiente avant de prescrire.");
      return;
    }
    if (!pfPrescriptionAnalyse.trim()) {
      alert("Veuillez préciser l'examen à prescrire.");
      return;
    }
    const newExam: ExamenLabo = {
      id: generateUid(),
      patient: fullName,
      contact: contact,
      dateDemande: getTodayStr(),
      analyses: pfPrescriptionAnalyse,
      prescripteur: currentUser?.nom || "Médecin / SF Planification",
      technicien: "",
      statut: "En attente",
      dateResultat: "",
      resultat: "",
      interpretation: "",
      createdAt: new Date().toISOString()
    };
    if (onUpdateLaboExamens) {
      onUpdateLaboExamens([newExam, ...laboExamens]);
      alert(`Examen prescrit (${pfPrescriptionAnalyse}) et envoyé directement au laboratoire !`);
      setPfPrescriptionAnalyse("");
    }
  };

  // Handle addition of new planning record
  const handleRegisterPlanif = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomPatiente.trim() || !prenomPatiente.trim()) {
      alert("Le nom et le prénom de la patiente sont requis.");
      return;
    }
    if (!consentementSigne) {
      alert("Le consentement éclairé de la patiente est obligatoire avant toute procédure contraceptive.");
      return;
    }

    const fullName = `${prenomPatiente.trim()} ${nomPatiente.trim()}`;

    const newRecord: FichePlanifFamiliale = {
      id: "PF-" + new Date().getFullYear() + "-" + Math.floor(100 + Math.random() * 900),
      patient: fullName,
      nomPatiente: nomPatiente.trim(),
      prenomPatiente: prenomPatiente.trim(),
      adresse: adresse.trim() || undefined,
      nomEpoux: nomEpoux.trim() || undefined,
      nombreEnfants: nombreEnfants !== "" ? parseInt(nombreEnfants) : undefined,
      programmeProchainEnfant: programmeProchainEnfant.trim() || undefined,
      ancienneMethode: !estNouvelleFois ? (ancienneMethode.trim() || undefined) : undefined,
      estNouvelleFois,
      age: parseInt(age) || 25,
      contact: contact.trim() || "—",
      methodeChoisie,
      dateDebut: dateDebut || getTodayStr(),
      dateSuiviPrevu: dateSuiviPrevu || getSuggestedFollowUpDate(methodeChoisie, dateDebut),
      counselingEffectue,
      consentementSigne,
      ta: ta.trim() || "120/80",
      poids: parseFloat(poids) || 0,
      contraintesSelectionnees: [...selectedMecConditions],
      notesMedicales: notesMedicales.trim(),
      agentId,
      statut: "En cours",
      createdAt: new Date().toISOString()
    };

    const updated = [newRecord, ...planifs];
    setPlanifs(updated);
    safeSet("dg_planif_familiale", updated);

    // Reset Form
    setPatient("");
    setNomPatiente("");
    setPrenomPatiente("");
    setAdresse("");
    setNomEpoux("");
    setNombreEnfants("");
    setProgrammeProchainEnfant("");
    setAnancienneMethode("");
    setEstNouvelleFois(true);
    setAge("");
    setContact("");
    setTa("");
    setPoids("");
    setNotesMedicales("");
    setSelectedMecConditions([]);
    setConsentementSigne(false);
    alert(`Fiche de planification familiale créée avec succès pour ${newRecord.patient}`);
  };

  // Delete planning record
  const handleDeletePlanif = (id: string) => {
    if (confirm("Voulez-vous vraiment archiver ou supprimer définitivement cette fiche de planification familiale ?")) {
      const updated = planifs.filter((p) => p.id !== id);
      setPlanifs(updated);
      safeSet("dg_planif_familiale", updated);
    }
  };

  // High-fidelity pre-filled consent form and document printing function
  const handlePrintDocument = () => {
    const printContent = document.getElementById("pf-printable-document");
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${activePreviewDoc?.type === "consentement" ? "Consentement Éclairé" : activePreviewDoc?.type === "counseling" ? "Fiche de Counseling" : "Registre PF"}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');
            body {
              font-family: "Inter", sans-serif;
              color: #1c1917;
              padding: 40px;
              line-height: 1.6;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .font-serif {
              font-family: "Playfair Display", Georgia, serif;
            }
            .text-center { text-align: center; }
            .border-b-2 { border-bottom: 2px solid #1c1917; }
            .pb-4 { padding-bottom: 16px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-2 > * + * { margin-top: 8px; }
            .space-y-3.5 > * + * { margin-top: 14px; }
            .space-y-4 > * + * { margin-top: 16px; }
            .space-y-6 > * + * { margin-top: 24px; }
            .space-y-12 > * + * { margin-top: 48px; }
            .text-lg { font-size: 1.125rem; }
            .text-xs { font-size: 0.75rem; }
            .text-sm { font-size: 0.875rem; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 800; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            .text-primary-700 { color: #0f766e; }
            .text-stone-500 { color: #78716c; }
            .font-mono { font-family: monospace; }
            .bg-stone-100 { background-color: #f5f5f4; }
            .bg-stone-50 { background-color: #fafaf9; }
            .py-3 { padding-top: 12px; padding-bottom: 12px; }
            .p-2 { padding: 8px; }
            .p-4 { padding: 16px; }
            .p-3.5 { padding: 14px; }
            .rounded-2xl { border-radius: 16px; }
            .border { border: 1px solid #e7e5e4; }
            .border-stone-150 { border-color: #f5f5f4; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-cols: repeat(2, minmax(0, 1fr)); }
            .gap-4 { gap: 16px; }
            .gap-8 { gap: 32px; }
            .leading-relaxed { line-height: 1.625; }
            .list-disc { list-style-type: disc; }
            .pl-4 { padding-left: 16px; }
            .pt-8 { padding-top: 32px; }
            .border-t { border-top: 1px solid #e7e5e4; }
            .border-stone-300 { border-color: #d6d3d1; }
            .w-44 { width: 176px; }
            .border-b { border-bottom: 1px solid #e7e5e4; }
            .border-stone-400 { border-color: #a8a29e; }
            .text-right { text-align: right; }
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .items-end { align-items: flex-end; }
            .italic { font-style: italic; }
            .font-semibold { font-weight: 600; }
            .text-stone-750 { color: #44403c; }
            .text-xs { font-size: 0.625rem; }
            .text-sm { font-size: 0.6875rem; }
            .bg-stone-50\\/50 { background-color: rgba(250, 250, 249, 0.5); }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #d6d3d1; padding: 8px; text-align: left; font-size: 11px; }
            th { background-color: #f5f5f4; font-weight: bold; text-transform: uppercase; font-size: 9px; }
            @media print {
              body { padding: 0; }
              @page {
                size: A4 portrait;
                margin: 20mm;
              }
            }
          </style>
        </head>
        <body>
          <div>
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper to pre-calculate default follow up
  const getSuggestedFollowUpDate = (methode: string, start: string): string => {
    const date = start ? new Date(start) : new Date();
    if (methode.includes("Injectable")) {
      // 3 months (12 weeks)
      date.setMonth(date.getMonth() + 3);
    } else if (methode.includes("DIU") || methode.includes("Implants")) {
      // 1 month control then yearly
      date.setMonth(date.getMonth() + 1);
    } else {
      // Pill or local barriers: 3 months control
      date.setMonth(date.getMonth() + 3);
    }
    return date.toISOString().slice(0, 10);
  };

  // Toggle checklist steps
  const toggleCounselingStep = (step: keyof typeof counselingSteps) => {
    setCounselingSteps((prev) => {
      const next = { ...prev, [step]: !prev[step] };
      // If all checked, automatically set counseling as done
      const allDone = Object.values(next).every(Boolean);
      setCounselingEffectue(allDone);
      return next;
    });
  };

  // Auto check counseling steps
  const applyCompletedCounselingChecklist = () => {
    setCounselingSteps({
      accueil: true,
      antencedents: true,
      optionsExplication: true,
      choixLibre: true,
      modeEmploi: true,
      rendezvousSuivi: true
    });
    setCounselingEffectue(true);
  };

  // Filter and search
  const filteredPlanifs = planifs.filter((p) => {
    const matchesSearch = p.patient.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatusFilter === "Tous" || p.statut === selectedStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 animate-fade-in text-stone-800 dark:text-stone-100">
      
      {/* SECTION HEADER */}
      <div className="bg-primary-700/10 dark:bg-primary-950/20 border border-primary-500/20 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-primary-600 rounded-2xl text-white shadow-md">
              <Heart className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-serif font-semibold text-stone-900 dark:text-white">
                Planification Familiale & Suivi
              </h1>
              <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                {profile.name} · Aide à la décision OMS & Fiche de consentement
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              // open general printing helper
              setActivePreviewDoc({
                type: "all_data",
                patientData: {}
              });
            }}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-bold transition-all border border-stone-200 dark:border-stone-700 flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer Registre</span>
          </button>
        </div>
      </div>

      {/* THREE MAIN AREAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: WHO MEC WHEEL & PROCEDURES (8 COLS) */}
        <div className="lg:col-span-8 space-y-8">

          {/* STEP 2: REGISTER RECORD & INFORMED CONSENT FORM */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs">
            <div className="border-b border-stone-150 dark:border-stone-800 pb-3 mb-4">
              <span className="text-xs font-black uppercase text-primary-600 dark:text-primary-400 tracking-wider flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Fiche de Consentement Éclairé
              </span>
              <h2 className="text-base font-semibold text-stone-900 dark:text-white">
                Nouvelle Procédure PF
              </h2>
            </div>

            <form onSubmit={handleRegisterPlanif} className="space-y-4 text-xs font-semibold">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-stone-500 block">Nom de famille :</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Sawadogo"
                    value={nomPatiente}
                    onChange={(e) => setNomPatiente(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-stone-500 block">Prénom :</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Assita"
                    value={prenomPatiente}
                    onChange={(e) => setPrenomPatiente(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-stone-500 block">Lieu d'habitation :</label>
                  <input
                    type="text"
                    placeholder="Ex: Secteur 15, Bobo"
                    value={adresse}
                    onChange={(e) => setAdresse(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-stone-500 block">Nom de l'époux :</label>
                  <input
                    type="text"
                    placeholder="Ex: Sawadogo Karim"
                    value={nomEpoux}
                    onChange={(e) => setNomEpoux(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-stone-500 block">Nombre d'enfants :</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Ex: 3"
                    value={nombreEnfants}
                    onChange={(e) => setNombreEnfants(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-stone-500 block">Désir prochain enfant :</label>
                  <input
                    type="text"
                    placeholder="Ex: Dans 3 ans / Aucun"
                    value={programmeProchainEnfant}
                    onChange={(e) => setProgrammeProchainEnfant(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-stone-500 block">Type d'utilisatrice :</label>
                  <select
                    value={estNouvelleFois ? "nouvelle" : "ancienne"}
                    onChange={(e) => {
                      const isNew = e.target.value === "nouvelle";
                      setEstNouvelleFois(isNew);
                      if (isNew) {
                        setAnancienneMethode("");
                      }
                    }}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-850 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  >
                    <option value="nouvelle">Première fois (Nouvelle)</option>
                    <option value="ancienne">Déjà pratiqué (Retour)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-stone-500 block">Ancienne méthode :</label>
                  <input
                    type="text"
                    placeholder="Ex: Pilule / Aucune"
                    disabled={estNouvelleFois}
                    value={estNouvelleFois ? "Aucune (Première fois)" : ancienneMethode}
                    onChange={(e) => setAnancienneMethode(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-stone-500 block">Âge (ans) :</label>
                  <input
                    type="number"
                    required
                    placeholder="26"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-stone-500 block">Contact :</label>
                  <input
                    type="text"
                    placeholder="Ex: 70 00 11 22"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-stone-500 block">Tension Artérielle :</label>
                  <input
                    type="text"
                    placeholder="Ex: 120/80"
                    value={ta}
                    onChange={(e) => setTa(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-stone-500 block">Poids (kg) :</label>
                  <input
                    type="number"
                    placeholder="Ex: 60"
                    value={poids}
                    onChange={(e) => setPoids(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-stone-500 block">Méthode Sélectionnée :</label>
                <select
                  value={methodeChoisie}
                  onChange={(e) => setMethodeChoisie(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-850 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                >
                  <option value="DIU au Cuivre">Dispositif Intra-Utérin (DIU) au Cuivre</option>
                  <option value="Implants (Jadelle)">Implants (Jadelle - 5 ans)</option>
                  <option value="Implants (Implanon)">Implants (Implanon - 3 ans)</option>
                  <option value="Injectable Trimestriel (DMPA)">Contraceptif Injectable (DMPA)</option>
                  <option value="Pilule combinée (COC)">Pilule orale combinée (COC)</option>
                  <option value="Pilule progestative seule (POP)">Pilule progestative seule (POP)</option>
                  <option value="Préservatifs & Méthodes Barrières">Préservatifs & Barrières</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-stone-500 block">Date d'Insertion/Prise :</label>
                  <input
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-stone-500 block">Date Prochain Suivi :</label>
                  <input
                    type="date"
                    placeholder="Optionnel"
                    value={dateSuiviPrevu}
                    onChange={(e) => setDateSuiviPrevu(e.target.value)}
                    className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-stone-500 block">Sage-femme / Praticien :</label>
                <select
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none"
                >
                  <option value="">Sélectionner un agent de garde</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom} ({s.poste})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-stone-500 block">Notes médicales ou antécédents :</label>
                <textarea
                  rows={2}
                  placeholder="Particularités cliniques, examens du col, tolérance..."
                  value={notesMedicales}
                  onChange={(e) => setNotesMedicales(e.target.value)}
                  className="w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              {/* Prescription Laboratory module */}
              <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2 col-span-1 lg:col-span-2">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 flex items-center gap-1.5">
                  <FlaskConical className="w-3.5 h-3.5 text-primary-600" />
                  Prescrire un examen au laboratoire
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Ex: Test de grossesse, Bilan sanguin, Sérologie..."
                    value={pfPrescriptionAnalyse}
                    onChange={(e) => setPfPrescriptionAnalyse(e.target.value)}
                    className="flex-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={handlePrescrireExamenPf}
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

              {/* Legal Consent Acknowledgement Box */}
              <div className="bg-warning-500/5 rounded-2xl p-4 border border-warning-500/20 space-y-3 col-span-1 lg:col-span-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="consentCheck"
                    required
                    checked={consentementSigne}
                    onChange={(e) => setConsentementSigne(e.target.checked)}
                    className="mt-1 accent-warning-600 scale-110 shrink-0"
                  />
                  <label htmlFor="consentCheck" className="text-sm leading-relaxed text-warning-900 dark:text-warning-400 select-none cursor-pointer">
                    <strong>Consentement Éclairé Obtenu :</strong> Je certifie avoir informé la patiente sur les bénéfices, les effets secondaires courants, la réversibilité de la méthode, et que son choix a été formulé librement sans contrainte.
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={!consentementSigne}
                className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-stone-200 disabled:text-stone-400 text-white rounded-2xl text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Enregistrer & Valider Procedure</span>
              </button>

            </form>
          </div>

          {/* OMS MEDICAL ELIGIBILITY WHEEL */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs relative overflow-hidden">
            <div className="absolute right-0 top-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl"></div>
            
            <div className="flex justify-between items-start border-b border-stone-150 dark:border-stone-800 pb-4 mb-4">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase text-primary-600 dark:text-primary-400 tracking-wider flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> Disque d'éligibilité médicale de l'OMS
                </span>
                <h2 className="text-base font-semibold text-stone-900 dark:text-white">
                  Critères d'Éligibilité (MEC OMS)
                </h2>
                <p className="text-sm text-stone-500">
                  Sélectionnez les facteurs de risque ou pathologies de la patiente pour voir l'adaptation des méthodes contraceptives.
                </p>
              </div>
            </div>

            {/* Pathologies Selection Checklist */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                Facteurs de risque / Profil de la patiente :
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-stone-50 dark:bg-stone-950/40 rounded-2xl border border-stone-150 dark:border-stone-850">
                {MEC_CONDITIONS.map((cond) => {
                  const isSelected = selectedMecConditions.includes(cond.id);
                  return (
                    <button
                      key={cond.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMecConditions(selectedMecConditions.filter(id => id !== cond.id));
                        } else {
                          setSelectedMecConditions([...selectedMecConditions, cond.id]);
                        }
                      }}
                      className={`text-left p-2.5 rounded-lg transition-all text-xs font-semibold flex items-start gap-2 border cursor-pointer ${
                        isSelected
                          ? "bg-primary-500/10 border-primary-500/30 text-primary-700 dark:text-primary-300"
                          : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="mt-0.5 accent-primary-600 shrink-0"
                      />
                      <span>{cond.label}</span>
                    </button>
                  );
                })}
              </div>

              {selectedMecConditions.length > 0 && (
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-stone-500">
                    {selectedMecConditions.length} critère(s) médical(aux) actif(s).
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedMecConditions([])}
                    className="text-danger-600 dark:text-danger-400 hover:underline"
                  >
                    Effacer tout
                  </button>
                </div>
              )}
            </div>

            {/* Dynamic MEC Wheel Classifications */}
            <div className="mt-6 space-y-4">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                Recommandations d'éligibilité de l'OMS :
              </span>
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {[
                  { id: "coc", name: "COCs (Combinée)", desc: "Pilules orales combinées", type: "Hormonale" },
                  { id: "pop", name: "POPs (Progestatif)", desc: "Micro-pilules progestatives", type: "Hormonale" },
                  { id: "injectable", name: "Injectable (DMPA)", desc: "Injection trimestrielle", type: "Hormonale" },
                  { id: "implants", name: "Implants", desc: "Jadelle / Nexplanon", type: "LARC" },
                  { id: "diu_cu", name: "DIU au Cuivre", desc: "Dispositif Intra-Utérin", type: "LARC" }
                ].map((meth) => {
                  const { rating, reasons } = getMECRating(selectedMecConditions, meth.id);
                  let colorClass = "";
                  let labelText = "";
                  let badgeText = "";

                  if (rating === 1) {
                    colorClass = "border-success-500/30 bg-success-500/5 text-success-800 dark:text-success-400";
                    labelText = "Sécurité maximale : Sans restriction d'utilisation.";
                    badgeText = "Cat. 1";
                  } else if (rating === 2) {
                    colorClass = "border-warning-400/30 bg-warning-400/5 text-warning-700 dark:text-warning-300";
                    labelText = "Généralement recommandé : Avantages l'emportent sur les risques.";
                    badgeText = "Cat. 2";
                  } else if (rating === 3) {
                    colorClass = "border-orange-500/30 bg-orange-500/5 text-orange-800 dark:text-orange-400";
                    labelText = "Non recommandé : Les risques l'emportent sur les avantages.";
                    badgeText = "Cat. 3";
                  } else {
                    colorClass = "border-danger-500/30 bg-danger-500/5 text-danger-800 dark:text-danger-400";
                    labelText = "Contre-indication absolue : Risque de santé inacceptable.";
                    badgeText = "Cat. 4";
                  }

                  return (
                    <div
                      key={meth.id}
                      className={`border rounded-2xl p-3.5 space-y-2 flex flex-col justify-between transition-all ${colorClass}`}
                    >
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black tracking-tight block">
                            {meth.name}
                          </span>
                          <span className="text-xs font-black px-1.5 py-0.5 rounded-full bg-stone-900/10 dark:bg-stone-100/10 uppercase">
                            {badgeText}
                          </span>
                        </div>
                        <p className="text-2xs opacity-80 leading-snug">{meth.desc}</p>
                      </div>

                      <div className="border-t border-stone-500/10 pt-2 space-y-1 text-left">
                        <p className="text-2xs font-bold leading-relaxed">{labelText}</p>
                        {reasons.length > 0 && (
                          <div className="text-[8px] opacity-90 font-mono space-y-0.5 pl-2 border-l border-current">
                            {reasons.slice(0, 2).map((r, ri) => (
                              <div key={ri}>• {r}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MEC categories legend */}
              <div className="bg-stone-50 dark:bg-stone-950/40 rounded-xl p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2 border border-stone-150 dark:border-stone-850 text-stone-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-success-500 shrink-0"></span>
                  <span><strong>Cat 1:</strong> Libre utilisation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-warning-400 shrink-0"></span>
                  <span><strong>Cat 2:</strong> Généralement conseillé</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0"></span>
                  <span><strong>Cat 3:</strong> Risques accrus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-danger-500 shrink-0"></span>
                  <span><strong>Cat 4:</strong> Interdiction stricte</span>
                </div>
              </div>
            </div>
          </div>

          {/* CLINICAL PROCEDURES HANDBOOK */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs">
            <div className="flex justify-between items-center border-b border-stone-150 dark:border-stone-800 pb-3 mb-4">
              <div className="space-y-0.5">
                <span className="text-xs font-black uppercase text-primary-600 dark:text-primary-400 tracking-wider flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" /> Guide des Pratiques Cliniques de l'OMS
                </span>
                <h2 className="text-base font-semibold text-stone-900 dark:text-white">
                  Procédures d'Insertion Détaillées
                </h2>
              </div>
            </div>

            {/* Quick tabs */}
            <div className="flex border-b border-stone-100 dark:border-stone-800 mb-4 overflow-x-auto gap-2">
              {[
                { id: "diu", label: "DIU au Cuivre" },
                { id: "implant", label: "Implants (Jadelle)" },
                { id: "injectable", label: "Injectable (DMPA)" },
                { id: "pilule", label: "Pillules Orales" }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setViewProcedureTab(tab.id as any)}
                  className={`px-3 py-2 text-xs font-black transition-all cursor-pointer border-b-2 -mb-[2px] whitespace-nowrap ${
                    viewProcedureTab === tab.id
                      ? "border-primary-600 text-primary-600 dark:text-primary-400 font-semibold"
                      : "border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content renders */}
            <div className="space-y-4 text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-medium">
              
              {viewProcedureTab === "diu" && (
                <div className="space-y-3">
                  <div className="bg-primary-500/5 rounded-2xl p-4 border border-primary-500/10">
                    <h3 className="font-semibold text-primary-800 dark:text-primary-400 text-xs mb-1">Indications & Matériel</h3>
                    <p className="text-sm">
                      Le DIU au Cuivre (Dispositif Intra-Utérin) assure une contraception très efficace pendant 10 ans. 
                      <strong> Matériel requis :</strong> Speculum stérile, pince de Pozzi, hystéromètre stérile, ciseaux longs, pince de Cheron, antiseptique vaginal.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-stone-800 dark:text-white text-xs">Procédure d'insertion étape par étape :</h4>
                    <ol className="list-decimal pl-4 space-y-1.5 text-sm">
                      <li><strong className="text-stone-800 dark:text-stone-200">Examen bimanuel :</strong> Toucher vaginal pour évaluer la taille, la position (antéversé ou rétroversé) et la mobilité utérine.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Asepsie et pose du speculum :</strong> Nettoyer soigneusement le col utérin avec de la bétadine gynécologique ou un antiseptique aqueux.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Hystérométrie :</strong> Introduire délicatement l'hystéromètre pour mesurer la profondeur utérine (généralement entre 6 et 9 cm).</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Préparation du DIU :</strong> Charger le DIU stérilement dans son tube applicateur en l'ajustant au repère de l'hystérométrie.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Insertion par technique de retrait :</strong> Introduire l'applicateur jusqu'au fond de l'utérus, retirer le tube applicateur tout en maintenant le poussoir pour libérer les bras en T. Retirer le poussoir.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Coupe des fils :</strong> Sectionner les fils du DIU à 2 cm à l'extérieur de l'orifice cervical externe du col.</li>
                    </ol>
                  </div>
                </div>
              )}

              {viewProcedureTab === "implant" && (
                <div className="space-y-3">
                  <div className="bg-primary-500/5 rounded-2xl p-4 border border-primary-500/10">
                    <h3 className="font-semibold text-primary-800 dark:text-primary-400 text-xs mb-1">Système Jadelle (2 bâtonnets, 5 ans) ou Implanon (1 bâtonnet, 3 ans)</h3>
                    <p className="text-sm">
                      Insertion sous-cutanée sur la face interne du bras non dominant, à environ 8-10 cm au-dessus de l'épicondyle médial.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-stone-800 dark:text-white text-xs">Procédure d'insertion :</h4>
                    <ol className="list-decimal pl-4 space-y-1.5 text-sm">
                      <li><strong className="text-stone-800 dark:text-stone-200">Position :</strong> Allonger la patiente sur le dos, bras fléchi, main sous la tête pour exposer la face interne.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Anesthésie :</strong> Désinfecter la zone. Pratiquer une anesthésie locale de 2 ml de lidocaïne à 1% le long du trajet d'insertion prévu.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Insertion du trocart :</strong> Introduire le trocart juste sous la peau (niveau subdermique) en maintenant un angle d'insertion de 10-15° au départ, puis à plat.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Pose des bâtonnets :</strong> Pousser le premier bâtonnet. Reculer le trocart d'un angle d'environ 15° si c'est un système à double bâtonnet (Jadelle) pour former un "V".</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Vérification & Pansement :</strong> Palper les implants sous la peau pour s'assurer de leur bonne présence. Poser un pansement compressif imperméable stérile à garder 48h.</li>
                    </ol>
                  </div>
                </div>
              )}

              {viewProcedureTab === "injectable" && (
                <div className="space-y-3">
                  <div className="bg-primary-500/5 rounded-2xl p-4 border border-primary-500/10">
                    <h3 className="font-semibold text-primary-800 dark:text-primary-400 text-xs mb-1">DMPA (Dépo-Provera) Intramusculaire - 150 mg</h3>
                    <p className="text-sm">
                      Action contraceptive de 12 à 13 semaines par inhibition robuste de l'ovulation et épaississement de la glaire cervicale.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-stone-800 dark:text-white text-xs">Protocole clinique :</h4>
                    <ul className="list-disc pl-4 space-y-1.5 text-sm">
                      <li><strong className="text-stone-800 dark:text-stone-200">Moment d'injection :</strong> Administrer de préférence pendant les 5 premiers jours du cycle menstruel.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Lieu d'injection :</strong> Injection intramusculaire profonde dans le muscle deltoïde ou fessier.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Pas de massage :</strong> Il est strictement interdit de masser la zone d'injection après l'administration pour éviter une libération trop rapide du progestatif.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Rappels :</strong> Demander à la patiente de revenir précisément tous les 90 jours (3 mois) pour son injection de rappel.</li>
                    </ul>
                  </div>
                </div>
              )}

              {viewProcedureTab === "pilule" && (
                <div className="space-y-3">
                  <div className="bg-primary-500/5 rounded-2xl p-4 border border-primary-500/10">
                    <h3 className="font-semibold text-primary-800 dark:text-primary-400 text-xs mb-1">Instruction Patient d'utilisation des contraceptifs oraux</h3>
                    <p className="text-sm">
                      Contraception hormonale quotidienne. Très dépendante de l'observance stricte de l'horaire de prise par la patiente.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-stone-800 dark:text-white text-xs">Règles d'utilisation & Cas d'oubli :</h4>
                    <ol className="list-decimal pl-4 space-y-1.5 text-sm">
                      <li><strong className="text-stone-800 dark:text-stone-200">Prise quotidienne :</strong> Prendre 1 comprimé chaque jour à la même heure sans interruption pour les plaquettes de 28 jours.</li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Oubli de Pilule Combinée (COC) :</strong>
                        <ul className="list-circle pl-4 mt-1 space-y-1">
                          <li><strong>&lt; 12 heures :</strong> Prendre immédiatement le comprimé oublié et continuer normalement.</li>
                          <li><strong>&gt; 12 heures :</strong> Prendre le comprimé, utiliser un préservatif de barrière pendant les 7 jours suivants.</li>
                        </ul>
                      </li>
                      <li><strong className="text-stone-800 dark:text-stone-200">Oubli de Micro-progestative (POP) :</strong> Délai d'oubli critique de seulement 3 heures. Si dépassé, protection barrière requise durant 48h.</li>
                    </ol>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* DYNAMIC REGISTRY LIST */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-150 dark:border-stone-800 pb-4 mb-4">
              <div>
                <h2 className="text-base font-semibold text-stone-900 dark:text-white">
                  Registre des Suivis de Planification Familiale
                </h2>
                <p className="text-sm text-stone-500">
                  Visualisez les patientes en cours de traitement contraceptif et gérez les visites de rappel.
                </p>
              </div>

              {/* Status selectors */}
              <div className="flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-stone-500 dark:text-stone-400" />
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 focus:outline-none"
                >
                  <option value="Tous">Tous les statuts</option>
                  <option value="En cours">En cours</option>
                  <option value="Effets indésirables">Effets indésirables</option>
                  <option value="Retrait effectué">Retrait effectué</option>
                  <option value="Terminé">Terminé</option>
                </select>
              </div>
            </div>

            {/* Search Filter input and View toggles */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Rechercher une patiente par nom ou code PF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg pl-10 pr-4 py-2.5 font-semibold text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* View Mode segmented control */}
              <div className="flex bg-stone-100 dark:bg-stone-950 p-1 rounded-2xl border border-stone-200/50 dark:border-stone-850 self-start xl:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("synthetic")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === "synthetic"
                      ? "bg-white dark:bg-stone-900 text-primary-600 dark:text-primary-400 shadow-xs"
                      : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
                  }`}
                >
                  Vue Synthétique
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("detailed")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    viewMode === "detailed"
                      ? "bg-white dark:bg-stone-900 text-primary-600 dark:text-primary-400 shadow-xs"
                      : "text-stone-500 hover:text-stone-800 dark:hover:text-stone-300"
                  }`}
                >
                  Tableau de Consultation Complet
                </button>
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto">
              {filteredPlanifs.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500 dark:text-stone-400 italic">
                  Aucune fiche active trouvée dans le registre.
                </div>
              ) : viewMode === "synthetic" ? (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-stone-850 text-stone-500 dark:text-stone-400 font-semibold uppercase text-xs">
                      <th className="py-2.5 px-3">Patiente</th>
                      <th className="py-2.5 px-3">Méthode</th>
                      <th className="py-2.5 px-3">Date Début</th>
                      <th className="py-2.5 px-3">Suivi Prévu</th>
                      <th className="py-2.5 px-3">Stats</th>
                      <th className="py-2.5 px-3 text-center">Fiches</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-850 font-semibold text-stone-700 dark:text-stone-300">
                    {filteredPlanifs.map((p) => {
                      const daysLeft = Math.ceil((new Date(p.dateSuiviPrevu).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      const isAlert = daysLeft < 7 && p.statut === "En cours";
                      
                      return (
                        <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-stone-850/40">
                          <td className="py-3 px-3">
                            <div>
                              <div className="font-semibold text-stone-900 dark:text-white flex items-center gap-1.5">
                                <span>{p.patient}</span>
                                {p.estNouvelleFois ? (
                                  <span className="text-2xs bg-primary-500/10 text-primary-700 dark:text-primary-400 font-bold px-1.5 py-0.2 rounded-lg" title="Nouvelle utilisatrice">1ère fois</span>
                                ) : (
                                  <span className="text-2xs bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 font-bold px-1.5 py-0.2 rounded-lg" title="Déjà utilisatrice (Retour)">Retour</span>
                                )}
                              </div>
                              <div className="text-xs text-stone-500 dark:text-stone-400 font-mono space-y-0.5">
                                <div>{p.id} • {p.age} ans • {p.contact}</div>
                                {(p.adresse || p.nomEpoux || p.nombreEnfants !== undefined) && (
                                  <div className="text-stone-500 dark:text-stone-400">
                                    {p.adresse && <span>🏠 {p.adresse}</span>}
                                    {p.nomEpoux && <span className="ml-2">💍 Époux: {p.nomEpoux}</span>}
                                    {p.nombreEnfants !== undefined && <span className="ml-2">👶 Enfants: {p.nombreEnfants}</span>}
                                  </div>
                                )}
                                {(p.programmeProchainEnfant || (!p.estNouvelleFois && p.ancienneMethode)) && (
                                  <div className="text-primary-600 dark:text-primary-500">
                                    {p.programmeProchainEnfant && <span>📅 Prochain enfant: {p.programmeProchainEnfant}</span>}
                                    {!p.estNouvelleFois && p.ancienneMethode && <span className="ml-2">🔄 Ancienne méthode: {p.ancienneMethode}</span>}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-lg bg-primary-500/10 text-primary-800 dark:text-primary-400 font-bold">
                              {p.methodeChoisie}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono text-sm">{p.dateDebut}</td>
                          <td className="py-3 px-3">
                            <div className="font-mono text-sm">
                              <span>{p.dateSuiviPrevu}</span>
                              {isAlert ? (
                                <span className="block text-2xs text-danger-500 font-sans font-semibold animate-pulse">Rappel imminent !</span>
                              ) : (
                                <span className="block text-2xs text-stone-500 dark:text-stone-400 font-sans">J-{daysLeft}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="space-y-0.5">
                              <span className={`inline-block text-2xs font-black px-1.5 py-0.2 rounded-lg ${
                                p.statut === "En cours"
                                  ? "bg-success-100 text-success-800 dark:bg-success-950/40 dark:text-success-400"
                                  : p.statut === "Effets indésirables"
                                  ? "bg-warning-100 text-warning-800 dark:bg-warning-950/40 dark:text-warning-400"
                                  : "bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-400"
                              }`}>
                                {p.statut}
                              </span>
                              <div className="flex gap-1 text-2xs">
                                {p.counselingEffectue && <span className="text-success-500" title="Counseling effectué">💬</span>}
                                {p.consentementSigne && <span className="text-success-500" title="Consentement signé">✍️</span>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex justify-center gap-1.5">
                              <button
                                onClick={() => setActivePreviewDoc({ type: "counseling", patientData: p })}
                                className="p-1 text-stone-500 hover:text-primary-600 bg-stone-100 dark:bg-stone-800 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg"
                                title="Voir Document de Counseling"
                              >
                                <ClipboardList className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setActivePreviewDoc({ type: "consentement", patientData: p })}
                                className="p-1 text-stone-500 hover:text-primary-600 bg-stone-100 dark:bg-stone-800 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg"
                                title="Voir Consentement Éclairé"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleDeletePlanif(p.id)}
                              className="p-1.5 text-stone-500 dark:text-stone-400 hover:text-danger-600 rounded-lg transition-colors"
                              title="Archiver"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse text-xs min-w-[1000px]">
                  <thead>
                    <tr className="border-b border-stone-150 dark:border-stone-800 text-stone-500 dark:text-stone-400 font-semibold uppercase text-xs bg-stone-50 dark:bg-stone-950/40">
                      <th className="py-3 px-3">Patiente & Coordonnées</th>
                      <th className="py-3 px-3">Lieu & Époux</th>
                      <th className="py-3 px-3">Enfants & Désir</th>
                      <th className="py-3 px-3">Historique Contraceptif</th>
                      <th className="py-3 px-3">Paramètres Cliniques</th>
                      <th className="py-3 px-3">Traitement Contraceptif</th>
                      <th className="py-3 px-3">Prochain Suivi</th>
                      <th className="py-3 px-3 text-center">Fiches</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-850 font-semibold text-stone-700 dark:text-stone-300">
                    {filteredPlanifs.map((p) => {
                      const daysLeft = Math.ceil((new Date(p.dateSuiviPrevu).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      const isAlert = daysLeft < 7 && p.statut === "En cours";
                      
                      return (
                        <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-stone-850/40">
                          {/* Patiente column */}
                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <div className="font-semibold text-stone-900 dark:text-white flex items-center gap-1.5">
                                <span>{p.patient}</span>
                              </div>
                              <div className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                                <span className="bg-stone-100 dark:bg-stone-800 px-1 py-0.2 rounded-lg text-2xs mr-1 font-bold">{p.id}</span>
                                <span>{p.age} ans • 📞 {p.contact}</span>
                              </div>
                            </div>
                          </td>

                          {/* Lieu & Epoux column */}
                          <td className="py-3 px-3 text-sm">
                            <div className="space-y-0.5">
                              <div className="text-stone-900 dark:text-stone-200">
                                <span className="text-stone-500 dark:text-stone-400 text-xs block">Lieu d'habitation:</span>
                                <strong>{p.adresse || "Non renseigné"}</strong>
                              </div>
                              <div className="text-stone-600 dark:text-stone-400">
                                <span className="text-stone-500 dark:text-stone-400 text-xs block">Conjoint:</span>
                                <strong>💍 {p.nomEpoux || "Célibataire / Non mentionné"}</strong>
                              </div>
                            </div>
                          </td>

                          {/* Enfants & Planification future column */}
                          <td className="py-3 px-3 text-sm">
                            <div className="space-y-0.5">
                              <div>
                                <span className="text-stone-500 dark:text-stone-400 text-xs block">Enfants vivants:</span>
                                <strong className="text-stone-900 dark:text-stone-200">👶 {p.nombreEnfants !== undefined ? `${p.nombreEnfants} enfant(s)` : "0"}</strong>
                              </div>
                              <div className="text-primary-600 dark:text-primary-400">
                                <span className="text-stone-500 dark:text-stone-400 text-xs block">Désir prochain enfant:</span>
                                <strong>📅 {p.programmeProchainEnfant || "Non planifié"}</strong>
                              </div>
                            </div>
                          </td>

                          {/* Type & Ancienne methode column */}
                          <td className="py-3 px-3 text-sm">
                            <div className="space-y-1">
                              <div>
                                {p.estNouvelleFois ? (
                                  <span className="bg-primary-500/10 text-primary-700 dark:text-primary-400 font-bold px-2 py-0.5 rounded-lg text-xs" title="Première fois de sa vie">
                                    Nouvelle Utilisatrice
                                  </span>
                                ) : (
                                  <span className="bg-warning-500/10 text-warning-700 dark:text-warning-400 font-bold px-2 py-0.5 rounded-lg text-xs" title="A déjà utilisé une méthode contraceptive">
                                    Retour (Ancienne)
                                  </span>
                                )}
                              </div>
                              {!p.estNouvelleFois && p.ancienneMethode && (
                                <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                                  Précédente : <strong className="font-semibold text-stone-700 dark:text-stone-300">{p.ancienneMethode}</strong>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Paramètres Cliniques column */}
                          <td className="py-3 px-3 text-sm">
                            <div className="space-y-0.5">
                              <div><span className="text-stone-500 dark:text-stone-400">Tension Artérielle:</span> <strong className="font-mono text-stone-900 dark:text-white">{p.ta || "120/80"} mmHg</strong></div>
                              <div><span className="text-stone-500 dark:text-stone-400">Poids:</span> <strong className="font-mono text-stone-900 dark:text-white">{p.poids || "—"} kg</strong></div>
                              {p.notesMedicales && (
                                <div className="text-xs italic text-stone-500 dark:text-stone-400 line-clamp-1" title={p.notesMedicales}>
                                  📝 {p.notesMedicales}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Méthode choisie column */}
                          <td className="py-3 px-3">
                            <div className="space-y-1">
                              <span className="px-2 py-0.5 rounded-lg bg-primary-500/10 text-primary-800 dark:text-primary-400 font-semibold text-xs">
                                {p.methodeChoisie}
                              </span>
                              <div className="text-xs text-stone-500 dark:text-stone-400">
                                Début : <span className="font-mono">{p.dateDebut}</span>
                              </div>
                            </div>
                          </td>

                          {/* Prochain Suivi column */}
                          <td className="py-3 px-3">
                            <div className="space-y-1 font-mono text-sm">
                              <div className="text-stone-900 dark:text-white font-bold">{p.dateSuiviPrevu}</div>
                              {isAlert ? (
                                <span className="inline-block text-2xs bg-danger-500/15 text-danger-500 font-sans font-semibold px-1.5 py-0.2 rounded-lg animate-pulse">Rappel immédiat !</span>
                              ) : (
                                <span className="inline-block text-2xs bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 font-sans px-1.5 py-0.2 rounded-lg">J-{daysLeft}</span>
                              )}
                            </div>
                          </td>

                          {/* Statut & Fiches column */}
                          <td className="py-3 px-3 text-center">
                            <div className="space-y-1.5">
                              <span className={`inline-block text-2xs font-black px-1.5 py-0.5 rounded-lg ${
                                p.statut === "En cours"
                                  ? "bg-success-100 text-success-800 dark:bg-success-950/40 dark:text-success-400"
                                  : p.statut === "Effets indésirables"
                                  ? "bg-warning-100 text-warning-800 dark:bg-warning-950/40 dark:text-warning-400"
                                  : "bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-400"
                              }`}>
                                {p.statut}
                              </span>
                              <div className="flex justify-center gap-1">
                                <button
                                  onClick={() => setActivePreviewDoc({ type: "counseling", patientData: p })}
                                  className="p-1 text-stone-500 hover:text-primary-600 bg-stone-100 dark:bg-stone-800 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg"
                                  title="Voir Fiche de Counseling"
                                >
                                  <ClipboardList className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setActivePreviewDoc({ type: "consentement", patientData: p })}
                                  className="p-1 text-stone-500 hover:text-primary-600 bg-stone-100 dark:bg-stone-800 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg"
                                  title="Voir Consentement"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Actions column */}
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleDeletePlanif(p.id)}
                              className="p-1.5 text-stone-500 dark:text-stone-400 hover:text-danger-600 rounded-lg transition-colors"
                              title="Archiver définitivement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: RECRUITMENT FORM, COUNSELING & CONSENT BUILDER (4 COLS) */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* STEP 1: COUNSELING WORKSTATION (GATHER METHOD) */}
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="border-b border-stone-150 dark:border-stone-800 pb-3">
              <span className="text-xs font-black uppercase text-primary-600 dark:text-primary-400 tracking-wider flex items-center gap-1">
                💬 Approche GATHER de l'OMS
              </span>
              <h2 className="text-base font-semibold text-stone-900 dark:text-white">
                Poste de Counseling
              </h2>
              <p className="text-sm text-stone-500 mt-0.5">
                Validez les étapes clés de l'entretien conseil structuré avec la patiente.
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-2.5">
              {[
                { key: "accueil", step: "G - Greet", label: "Accueillir la patiente chaleureusement et créer la confiance." },
                { key: "antencedents", step: "A - Ask", label: "S'enquérir des antécédents, besoins gynécos, désirs d'enfants." },
                { key: "optionsExplication", step: "T - Tell", label: "Informer sur les méthodes disponibles (effets, réversibilité)." },
                { key: "choixLibre", step: "H - Help", label: "Aider au choix éclairé de la méthode selon ses préférences." },
                { key: "modeEmploi", step: "E - Explain", label: "Expliquer l'utilisation, effets indésirables et signes d'alerte." },
                { key: "rendezvousSuivi", step: "R - Return", label: "Fixer le rendez-vous de retour (Suivi / Renouvellement)." }
              ].map((item) => {
                const checked = counselingSteps[item.key as keyof typeof counselingSteps];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleCounselingStep(item.key as any)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all text-sm flex items-start gap-2.5 cursor-pointer ${
                      checked
                        ? "bg-success-500/10 border-success-500/20 text-success-800 dark:text-success-400"
                        : "bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-850 hover:bg-stone-100"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-lg border flex items-center justify-center shrink-0 ${
                      checked ? "bg-success-500 border-success-600 text-white" : "border-stone-300 dark:border-stone-750"
                    }`}>
                      {checked && "✓"}
                    </span>
                    <div>
                      <div className="font-semibold text-xs uppercase tracking-wider">{item.step}</div>
                      <p className="opacity-95 leading-relaxed font-semibold">{item.label}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={applyCompletedCounselingChecklist}
                className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 font-bold rounded-lg text-xs uppercase tracking-wider transition-all"
              >
                Tout cocher
              </button>
              <button
                type="button"
                onClick={() => setCounselingSteps({
                  accueil: false,
                  antencedents: false,
                  optionsExplication: false,
                  choixLibre: false,
                  modeEmploi: false,
                  rendezvousSuivi: false
                })}
                className="py-2 px-3 text-stone-500 dark:text-stone-400 hover:text-stone-600 font-bold text-xs"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Note: Step 2 form moved to the left column above the OMS eligibility wheel */}

        </div>

      </div>

      {/* DOCUMENT PREVIEWS & PRINT MODALS */}
      {activePreviewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white text-stone-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl relative border border-stone-200 my-8">
            
            <button
              onClick={() => setActivePreviewDoc(null)}
              className="absolute right-4 top-4 text-stone-500 dark:text-stone-400 hover:text-stone-700 font-bold text-sm bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-lg"
            >
              Fermer ✕
            </button>

            {/* Content to Print / Preview */}
            <div id="pf-printable-document" className="space-y-6 font-sans p-2">
              
              {/* Header Gynaecology Section */}
              <div className="border-b-2 border-stone-800 pb-4 text-center space-y-1">
                <h1 className="text-lg font-black font-serif uppercase tracking-tight">MINISTÈRE DE LA SANTÉ ET DE L'HYGIÈNE PUBLIQUE</h1>
                <h2 className="text-xs font-bold uppercase tracking-wider">DIRECTION RÉGIONALE DE LA SANTÉ DES HAUTS-BASSINS</h2>
                <h3 className="text-xs font-semibold text-primary-700 uppercase">{profile.name.toUpperCase()} · BOBO-DIOULASSO</h3>
                <div className="text-xs text-stone-500 font-mono">{profile.address} • Tél: {profile.phone}</div>
              </div>

              {/* Doc Title */}
              <div className="text-center space-y-1 bg-stone-100 py-3 rounded-2xl border border-stone-200">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600">Document Clinique Officiel</span>
                <h2 className="text-base font-black uppercase text-stone-900">
                  {activePreviewDoc.type === "counseling" && "Fiche d'Entretien-Conseil & Counseling PF"}
                  {activePreviewDoc.type === "consentement" && "Formulaire de Consentement Libre et Éclairé"}
                  {activePreviewDoc.type === "all_data" && "Registre Général de Planification Familiale"}
                </h2>
              </div>

              {/* Patient and Method identification */}
              {activePreviewDoc.type !== "all_data" && (
                <div className="grid grid-cols-2 gap-4 bg-stone-50 p-4 rounded-2xl border border-stone-200 text-xs">
                  <div className="space-y-1">
                    <div><span className="text-stone-500">ID Unique PF:</span> <strong className="font-mono">{activePreviewDoc.patientData.id}</strong></div>
                    <div><span className="text-stone-500">Nom de la patiente:</span> <strong>{activePreviewDoc.patientData.patient}</strong></div>
                    <div><span className="text-stone-500">Âge de la patiente:</span> <strong>{activePreviewDoc.patientData.age} ans</strong></div>
                    <div><span className="text-stone-500">Lieu d'habitation:</span> <strong>{activePreviewDoc.patientData.adresse || "—"}</strong></div>
                    <div><span className="text-stone-500">Nom de l'époux:</span> <strong>{activePreviewDoc.patientData.nomEpoux || "—"}</strong></div>
                    <div><span className="text-stone-500">Nombre d'enfants:</span> <strong>{activePreviewDoc.patientData.nombreEnfants !== undefined ? activePreviewDoc.patientData.nombreEnfants : "—"}</strong></div>
                  </div>
                  <div className="space-y-1">
                    <div><span className="text-stone-500">Méthode contraceptive:</span> <strong className="text-primary-700">{activePreviewDoc.patientData.methodeChoisie}</strong></div>
                    <div><span className="text-stone-500">Désir prochain enfant:</span> <strong>{activePreviewDoc.patientData.programmeProchainEnfant || "—"}</strong></div>
                    <div><span className="text-stone-500">Type d'utilisatrice:</span> <strong>{activePreviewDoc.patientData.estNouvelleFois ? "Première fois" : `Déjà pratiqué (Ancienne: ${activePreviewDoc.patientData.ancienneMethode || "—"})`}</strong></div>
                    <div><span className="text-stone-500">Date de pose / début:</span> <strong className="font-mono">{activePreviewDoc.patientData.dateDebut}</strong></div>
                    <div><span className="text-stone-500">Prochain suivi prévu:</span> <strong className="font-mono">{activePreviewDoc.patientData.dateSuiviPrevu}</strong></div>
                    <div><span className="text-stone-500">Constantes de contrôle:</span> <strong>TA: {activePreviewDoc.patientData.ta || "120/80"} • Poids: {activePreviewDoc.patientData.poids || "—"} kg</strong></div>
                  </div>
                </div>
              )}

              {/* Main Content Areas */}
              {activePreviewDoc.type === "counseling" && (
                <div className="space-y-4 text-xs leading-relaxed text-stone-800">
                  <p>
                    Le counseling structuré selon l'approche <strong className="text-stone-900">GATHER / REDI</strong> recommandée par l'Organisation Mondiale de la Santé (OMS) a été mené auprès de la patiente susnommée afin de lui garantir une parfaite compréhension de la contraception choisie.
                  </p>
                  
                  <div className="space-y-2 border border-stone-150 p-3.5 rounded-2xl bg-stone-50/50">
                    <h4 className="font-semibold text-stone-900 uppercase text-xs tracking-wide">Validation des piliers du Counseling :</h4>
                    <ul className="space-y-1.5 list-disc pl-4">
                      <li><strong>G (Accueil) :</strong> Accueil confidentiel, respectueux, et établissement d'un climat d'écoute.</li>
                      <li><strong>A (Besoins) :</strong> Évaluation gynécologique, antécédents médicaux d'éligibilité, recherche d'absence de grossesse.</li>
                      <li><strong>T (Information) :</strong> Présentation neutre et complète des options contraceptives du cabinet.</li>
                      <li><strong>H (Choix) :</strong> Aide au choix sans influence extérieure. Respect du choix souverain de la patiente.</li>
                      <li><strong>E (Explications) :</strong> Consignes claires sur la prise, pose, effets indésirables attendus, conduite à tenir en cas d'oubli ou d'inquiétude.</li>
                      <li><strong>R (Rappel) :</strong> Planification précise du calendrier de contrôle et consignes d'alerte immédiate.</li>
                    </ul>
                  </div>

                  {activePreviewDoc.patientData.notesMedicales && (
                    <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                      <strong>Remarques spécifiques de l'entretien :</strong>
                      <p className="italic mt-1 text-stone-700">{activePreviewDoc.patientData.notesMedicales}</p>
                    </div>
                  )}
                </div>
              )}

              {activePreviewDoc.type === "consentement" && (
                <div className="space-y-4 text-xs leading-relaxed text-stone-800">
                  <p>
                    Je soussignée, <strong className="text-stone-900">{activePreviewDoc.patientData.patient}</strong>, déclare par le présent document donner mon consentement libre et éclairé pour la réalisation de la procédure contraceptive de : <strong className="text-primary-700">{activePreviewDoc.patientData.methodeChoisie}</strong>.
                  </p>

                  <div className="space-y-3.5">
                    <p>Je certifie que le personnel de santé de l'établissement {profile.name} m'a fourni des explications détaillées concernant :</p>
                    <ul className="list-disc pl-4 space-y-1 font-medium text-stone-700">
                      <li>L'efficacité théorique et pratique de la méthode contraceptive.</li>
                      <li>Les modalités de pose, d'injection ou de prise quotidienne.</li>
                      <li>Les effets secondaires bénins potentiels (changements du profil de saignement, tensions mammaires, acné, etc.).</li>
                      <li>Le fait que cette méthode est entièrement <strong className="text-stone-900">réversible</strong> et que les implants ou le DIU peuvent être retirés à ma simple demande clinique à tout moment.</li>
                      <li>La date planifiée de mes prochains rendez-vous de suivi et de renouvellement.</li>
                    </ul>
                  </div>

                  <p className="text-sm font-bold text-stone-900 bg-stone-100 p-3 rounded-xl border border-stone-200 leading-normal">
                    Je confirme avoir eu l'opportunité de poser toutes mes questions, d'avoir reçu des réponses claires et satisfaisantes, et de prendre cette décision en toute connaissance de cause.
                  </p>
                </div>
              )}

              {activePreviewDoc.type === "all_data" && (
                <div className="space-y-4 text-sm">
                  <p className="text-stone-500">Registre d'activité de planification familiale de {profile.name} arrêté au {getTodayStr()}.</p>
                  <table className="w-full text-left border-collapse border border-stone-300">
                    <thead>
                      <tr className="bg-stone-100 text-stone-700 font-bold uppercase text-2xs">
                        <th className="border border-stone-300 p-2">Code Unique</th>
                        <th className="border border-stone-300 p-2">Patiente</th>
                        <th className="border border-stone-300 p-2">Age</th>
                        <th className="border border-stone-300 p-2">Méthode</th>
                        <th className="border border-stone-300 p-2">Date début</th>
                        <th className="border border-stone-300 p-2">Prochain Suivi</th>
                        <th className="border border-stone-300 p-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {planifs.map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50">
                          <td className="border border-stone-300 p-2 font-mono">{item.id}</td>
                          <td className="border border-stone-300 p-2 font-bold">{item.patient}</td>
                          <td className="border border-stone-300 p-2">{item.age} ans</td>
                          <td className="border border-stone-300 p-2">{item.methodeChoisie}</td>
                          <td className="border border-stone-300 p-2 font-mono">{item.dateDebut}</td>
                          <td className="border border-stone-300 p-2 font-mono">{item.dateSuiviPrevu}</td>
                          <td className="border border-stone-300 p-2 font-bold">{item.statut}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signatures block */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-stone-300 text-xs">
                <div className="space-y-12">
                  <div className="text-stone-500 font-bold uppercase tracking-wider text-2xs">Signature de la Patiente :</div>
                  <div className="border-b border-stone-400 w-44"></div>
                  <div className="text-xs font-bold text-stone-500 dark:text-stone-400 italic">Mention "Lu et approuvé" manuscrit</div>
                </div>
                <div className="space-y-12 text-right flex flex-col items-end">
                  <div className="text-stone-500 font-bold uppercase tracking-wider text-2xs">Le Praticien traitant :</div>
                  <div className="border-b border-stone-400 w-44"></div>
                  <div className="text-xs font-bold text-stone-700">Cachet de l'établissement : {profile.name}</div>
                </div>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="mt-8 pt-4 border-t border-stone-150 flex justify-end gap-3">
              <button
                onClick={() => setActivePreviewDoc(null)}
                className="px-4 py-2 text-xs font-bold text-stone-500 hover:text-stone-800"
              >
                Fermer l'aperçu
              </button>
              <button
                onClick={handlePrintDocument}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Lancer l'impression</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
