/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Vaccination, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Calendar, ShieldAlert, CheckCircle, Search, Clipboard, Baby, ArrowRight, Clock } from "lucide-react";

interface TabVaccinationProps {
  vaccinations: Vaccination[];
  staff: Staff[];
  onUpdateVaccinations: (v: Vaccination[]) => void;
  theme?: "light" | "dark";
}

export default function TabVaccination({ vaccinations, staff, onUpdateVaccinations, theme = "light" }: TabVaccinationProps) {
  // Form states
  const [vacPatient, setVacPatient] = useState("");
  const [vacDateNaissance, setVacDateNaissance] = useState("");
  const [vacContact, setVacContact] = useState("");
  const [vacVaccin, setVacVaccin] = useState("BCG");
  const [vacDose, setVacDose] = useState("Dose unique");
  const [vacDateAdmin, setVacDateAdmin] = useState(getTodayStr());
  const [vacLot, setVacLot] = useState("");
  const [vacSite, setVacSite] = useState("Bras gauche");
  const [vacAgent, setVacAgent] = useState("");
  const [vacProchainRappel, setVacProchainRappel] = useState("");
  const [vacEffets, setVacEffets] = useState("");

  // --- Consultation vaccinale (contrôle avant injection) ---
  const [vacPoidsActuel, setVacPoidsActuel] = useState("");
  const [vacTemperature, setVacTemperature] = useState("");
  const [vacEtatGeneral, setVacEtatGeneral] = useState<"Bien portant" | "Malade / Fébrile" | "">("Bien portant");
  const [vacContreIndication, setVacContreIndication] = useState(false);
  const [vacContreIndicationDetail, setVacContreIndicationDetail] = useState("");
  const [vacConsentementParent, setVacConsentementParent] = useState(true);
  const [vacSurveillance30min, setVacSurveillance30min] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  // Automated Vaccine Calendar states
  const [calPatientName, setCalPatientName] = useState("");
  const [calBirthDate, setCalBirthDate] = useState("");
  const [calContact, setCalContact] = useState("");

  const handleAddVaccination = () => {
    if (!vacPatient.trim()) {
      alert("Veuillez saisir le nom de l'enfant ou du patient.");
      return;
    }

    if (vacContreIndication && !vacContreIndicationDetail.trim()) {
      alert("Une contre-indication a été cochée : veuillez préciser laquelle avant d'enregistrer.");
      return;
    }

    if (!vacConsentementParent) {
      alert("Le consentement du parent/tuteur est requis avant l'administration du vaccin.");
      return;
    }

    const newVac: Vaccination = {
      id: generateUid(),
      patient: vacPatient.trim(),
      dateNaissance: vacDateNaissance,
      contact: vacContact.trim(),
      vaccin: vacVaccin,
      dose: vacDose,
      dateAdmin: vacDateAdmin || getTodayStr(),
      lot: vacLot.trim(),
      site: vacSite,
      agent: vacAgent,
      prochainRappel: vacProchainRappel,
      effets: vacEffets.trim(),
      poidsActuel: vacPoidsActuel ? parseFloat(vacPoidsActuel) : undefined,
      temperature: vacTemperature ? parseFloat(vacTemperature) : undefined,
      etatGeneral: vacEtatGeneral || undefined,
      contreIndication: vacContreIndication,
      contreIndicationDetail: vacContreIndicationDetail.trim(),
      consentementParent: vacConsentementParent,
      surveillance30min: vacSurveillance30min,
      createdAt: new Date().toISOString()
    };

    onUpdateVaccinations([newVac, ...vaccinations]);
    setVacPatient("");
    setVacContact("");
    setVacLot("");
    setVacProchainRappel("");
    setVacEffets("");
    setVacPoidsActuel("");
    setVacTemperature("");
    setVacEtatGeneral("Bien portant");
    setVacContreIndication(false);
    setVacContreIndicationDetail("");
    setVacConsentementParent(true);
    setVacSurveillance30min(false);
    alert("Vaccination enregistrée pour : " + newVac.patient);
  };

  const handleDeleteVac = (id: string) => {
    if (confirm("Supprimer ce dossier de vaccination ?")) {
      onUpdateVaccinations(vaccinations.filter((v) => v.id !== id));
    }
  };

  // PEV - National Triage of Immunisation Protocol (Burkina Faso / WHO standard)
  interface PEVStep {
    id: string;
    ageLabel: string;
    ageWeeks: number;
    vaccines: {
      name: string;
      description: string;
      dose: string;
    }[];
  }

  const PEV_PROTOCOL: PEVStep[] = [
    {
      id: "naissance",
      ageLabel: "À la Naissance",
      ageWeeks: 0,
      vaccines: [
        { name: "BCG", description: "Tuberculose", dose: "Dose unique" },
        { name: "VPO (Polio oral)", description: "Poliomyélite orale (Dose 0)", dose: "1ère dose" }
      ]
    },
    {
      id: "6semaines",
      ageLabel: "6 Semaines (1,5 mois)",
      ageWeeks: 6,
      vaccines: [
        { name: "Penta (DTC-HepB-Hib)", description: "Diph, Tét, Coq, HepB, Hib (Dose 1)", dose: "1ère dose" },
        { name: "VPO (Polio oral)", description: "Poliomyélite orale (Dose 1)", dose: "2ème dose" },
        { name: "Pneumocoque (PCV13)", description: "Pneumocoque (Dose 1)", dose: "1ère dose" },
        { name: "Rotavirus", description: "Gastro-entérites à Rotavirus (Dose 1)", dose: "1ère dose" }
      ]
    },
    {
      id: "10semaines",
      ageLabel: "10 Semaines (2,5 mois)",
      ageWeeks: 10,
      vaccines: [
        { name: "Penta (DTC-HepB-Hib)", description: "Diph, Tét, Coq, HepB, Hib (Dose 2)", dose: "2ème dose" },
        { name: "VPO (Polio oral)", description: "Poliomyélite orale (Dose 2)", dose: "3ème dose" },
        { name: "Pneumocoque (PCV13)", description: "Pneumocoque (Dose 2)", dose: "2ème dose" },
        { name: "Rotavirus", description: "Gastro-entérites à Rotavirus (Dose 2)", dose: "2ème dose" }
      ]
    },
    {
      id: "14semaines",
      ageLabel: "14 Semaines (3,5 mois)",
      ageWeeks: 14,
      vaccines: [
        { name: "Penta (DTC-HepB-Hib)", description: "Diph, Tét, Coq, HepB, Hib (Dose 3)", dose: "3ème dose" },
        { name: "VPO (Polio oral)", description: "Poliomyélite orale (Dose 3)", dose: "Rappel" },
        { name: "Pneumocoque (PCV13)", description: "Pneumocoque (Dose 3)", dose: "3ème dose" },
        { name: "VPI (Polio injectable)", description: "Poliomyélite injectable (Dose unique)", dose: "Dose unique" }
      ]
    },
    {
      id: "5mois",
      ageLabel: "5 Mois",
      ageWeeks: 22,
      vaccines: [
        { name: "VAP (Antipaludique RTS,S)", description: "Vaccin antipaludique RTS,S (Dose 1)", dose: "1ère dose" }
      ]
    },
    {
      id: "6mois",
      ageLabel: "6 Mois",
      ageWeeks: 26,
      vaccines: [
        { name: "VAP (Antipaludique RTS,S)", description: "Vaccin antipaludique RTS,S (Dose 2)", dose: "2ème dose" }
      ]
    },
    {
      id: "7mois",
      ageLabel: "7 Mois",
      ageWeeks: 30,
      vaccines: [
        { name: "VAP (Antipaludique RTS,S)", description: "Vaccin antipaludique RTS,S (Dose 3)", dose: "3ème dose" }
      ]
    },
    {
      id: "9mois",
      ageLabel: "9 Mois",
      ageWeeks: 39,
      vaccines: [
        { name: "VAR (Rougeole-Rubéole)", description: "Rougeole & Rubéole (Dose 1)", dose: "1ère dose" },
        { name: "VAA (Fièvre jaune)", description: "Fièvre jaune (Dose unique)", dose: "Dose unique" },
        { name: "Vitamine A", description: "Supplémentation Vitamine A", dose: "1ère dose" }
      ]
    },
    {
      id: "15mois",
      ageLabel: "15 Mois",
      ageWeeks: 65,
      vaccines: [
        { name: "VAR (Rougeole-Rubéole)", description: "Rougeole & Rubéole (Dose 2)", dose: "2ème dose" },
        { name: "Méningocoque A", description: "Méningite A (Dose unique)", dose: "Dose unique" },
        { name: "VAP (Antipaludique RTS,S)", description: "Vaccin antipaludique RTS,S (Dose 4 - rappel)", dose: "Rappel" }
      ]
    }
  ];

  interface PatientRecord {
    name: string;
    birthDate: string;
    contact: string;
  }

  // Generate distinct patient registry
  const uniquePatients: PatientRecord[] = [];
  const seenPatients = new Set<string>();
  vaccinations.forEach((v) => {
    const norm = v.patient.toLowerCase().trim();
    if (v.patient && !seenPatients.has(norm)) {
      seenPatients.add(norm);
      uniquePatients.push({
        name: v.patient,
        birthDate: v.dateNaissance || "",
        contact: v.contact || ""
      });
    }
  });

  const calculateDueDate = (birthDateStr: string, weeks: number): string => {
    if (!birthDateStr) return "";
    const b = new Date(birthDateStr);
    b.setDate(b.getDate() + (weeks * 7));
    return b.toISOString().slice(0, 10);
  };

  const isVaccineAdministered = (patientName: string, vaccineName: string, dose: string): { done: boolean; date?: string } => {
    const pNameLower = patientName.toLowerCase().trim();
    const match = vaccinations.find(
      (v) =>
        v.patient.toLowerCase().trim() === pNameLower &&
        (v.vaccin.toLowerCase().includes(vaccineName.toLowerCase()) ||
          vaccineName.toLowerCase().includes(v.vaccin.toLowerCase())) &&
        (v.dose.toLowerCase() === dose.toLowerCase() || dose === "Dose unique" || v.dose === "Dose unique")
    );
    return match ? { done: true, date: match.dateAdmin } : { done: false };
  };

  const calculateNextRappelDate = (vaccine: string, adminDateStr: string): string => {
    if (!adminDateStr) return "";
    const d = new Date(adminDateStr);
    if (vaccine.includes("Penta") || vaccine.includes("PCV") || vaccine.includes("VPO") || vaccine.includes("Rotavirus")) {
      d.setDate(d.getDate() + 28); // 4 weeks
      return d.toISOString().slice(0, 10);
    }
    return "";
  };

  const handlePreFillForm = (vaccineName: string, doseName: string) => {
    setVacPatient(calPatientName);
    setVacDateNaissance(calBirthDate);
    setVacContact(calContact);
    setVacVaccin(vaccineName);
    setVacDose(doseName);
    setVacDateAdmin(getTodayStr());
    const defaultRappel = calculateNextRappelDate(vaccineName, getTodayStr());
    setVacProchainRappel(defaultRappel);

    // Smooth scroll to vaccination form
    const formElement = document.getElementById("form-enregistrement-vaccination");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Helper age calculator in months or years
  const getAgeDisplay = (birthDateStr: string): string => {
    if (!birthDateStr) return "—";
    const birth = new Date(birthDateStr);
    const now = new Date();
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months--;
    if (months < 0) return "—";
    if (months < 24) return `${months} mois`;
    return `${Math.floor(months / 12)} ans ${months % 12} mois`;
  };

  // Calculations
  const dNow = getTodayStr();
  const dPlus7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const currentMonth = dNow.slice(0, 7);

  const monthCount = vaccinations.filter((v) => v.dateAdmin.slice(0, 7) === currentMonth).length;
  const todayCount = vaccinations.filter((v) => v.dateAdmin === dNow).length;
  const uniquePatientsCount = new Set(vaccinations.map((v) => v.patient.toLowerCase().trim())).size;

  const rappels = vaccinations.filter((v) => v.prochainRappel);
  const rappelsSoon = rappels.filter((v) => v.prochainRappel >= dNow && v.prochainRappel <= dPlus7);
  const rappelsLate = rappels.filter((v) => v.prochainRappel < dNow);
  const sideEffectsCount = vaccinations.filter((v) => v.effets).length;

  // Filtered Vaccine list
  const filteredVaccinationsList = vaccinations
    .filter((v) => v.patient.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.dateAdmin.localeCompare(a.dateAdmin));

  // Antigen distribution
  const antigenDistribution: Record<string, number> = {};
  vaccinations.forEach((v) => {
    antigenDistribution[v.vaccin] = (antigenDistribution[v.vaccin] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{monthCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Doses ce mois</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Doses administrées</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-success-600">
          <div className="text-3xl font-semibold text-success-700 font-serif">{todayCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Doses Jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Aujourd'hui</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{uniquePatientsCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Patients suivis</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Nouveaux-nés / Adultes</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{rappelsSoon.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Rappels sous 7j</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Prochains RDV PEV</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{rappelsLate.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Rappels en retard</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Relances requises</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-purple-600">
          <div className="text-3xl font-semibold text-purple-700 font-serif">{sideEffectsCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">MAPI signalés</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Effets indésirables</div>
        </div>
      </div>

      {/* Recalls Warning Alert */}
      {(rappelsLate.length > 0 || rappelsSoon.length > 0) && (
        <div className="space-y-2">
          {rappelsLate.map((v) => (
            <div key={v.id} className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
              <ShieldAlert className="w-5 h-5 text-danger-600 flex-shrink-0" />
              <span>
                <strong>RAPPEL EN RETARD :</strong> L'enfant/patient <strong>{v.patient}</strong> a manqué son rendez-vous de rappel prévu le <strong>{new Date(v.prochainRappel).toLocaleDateString("fr-FR")}</strong>. Veuillez contacter son tuteur au <strong>{v.contact || "—"}</strong>.
              </span>
            </div>
          ))}
          {rappelsSoon.map((v) => (
            <div key={v.id} className="bg-warning-50 border border-warning-200 text-warning-700 p-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs">
              <ShieldAlert className="w-5 h-5 text-warning-600 flex-shrink-0" />
              <span>
                <strong>RAPPEL IMMINENT :</strong> Rappel de vaccination prévu sous 7 jours (le {new Date(v.prochainRappel).toLocaleDateString("fr-FR")}) pour <strong>{v.patient}</strong> (Vaccin : {v.vaccin}).
              </span>
            </div>
          ))}
        </div>
      )}

      {/* SECTION: Calendrier de Vaccination Automatique (PEV National) */}
      <div className={`border rounded-2xl p-6 shadow-xs ${
        theme === "dark" ? "bg-stone-900 border-stone-800 text-white" : "bg-white border-stone-200 text-stone-900"
      }`}>
        <div className="border-b border-stone-100 dark:border-stone-800 pb-4 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className={`text-base font-serif font-bold flex items-center gap-2 ${
              theme === "dark" ? "text-white" : "text-stone-900"
            }`}>
              <Baby className="w-5.5 h-5.5 text-primary-600" />
              Calculateur de Calendrier de Vaccination (PEV National Burkina Faso)
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Générez et suivez automatiquement le protocole complet d'immunisation d'un enfant selon le calendrier national (PEV).
            </p>
          </div>
          
          {/* Quick patient selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase font-semibold tracking-wider text-stone-500 dark:text-stone-400">Sélectionner un enfant :</span>
            {uniquePatients.length === 0 ? (
              <span className="text-xs text-stone-500 dark:text-stone-400 italic">Aucun profil enregistré</span>
            ) : (
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const found = uniquePatients.find((p) => p.name === val);
                    if (found) {
                      setCalPatientName(found.name);
                      setCalBirthDate(found.birthDate);
                      setCalContact(found.contact);
                    }
                  } else {
                    setCalPatientName("");
                    setCalBirthDate("");
                    setCalContact("");
                  }
                }}
                className={`text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none ${
                  theme === "dark" ? "bg-stone-800 border-stone-700 text-stone-200" : "bg-stone-50 border-stone-200 text-stone-700"
                }`}
              >
                <option value="">-- Choisir un enfant --</option>
                {uniquePatients.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({getAgeDisplay(p.birthDate)})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Dynamic Entry for Baby's info */}
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 rounded-xl border ${
          theme === "dark" ? "bg-stone-850/50 border-stone-800" : "bg-stone-50 border-stone-100"
        }`}>
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom de l'enfant / Patient</label>
            <input
              type="text"
              placeholder="Ex: Enfant Konaté"
              value={calPatientName}
              onChange={(e) => setCalPatientName(e.target.value)}
              className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none ${
                theme === "dark" ? "bg-stone-900 border-stone-700 text-white" : "bg-white border-stone-200 text-stone-800"
              }`}
            />
          </div>
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date de naissance exacte</label>
            <input
              type="date"
              value={calBirthDate}
              onChange={(e) => setCalBirthDate(e.target.value)}
              className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none ${
                theme === "dark" ? "bg-stone-900 border-stone-700 text-white" : "bg-white border-stone-200 text-stone-800"
              }`}
            />
          </div>
          <div>
            <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Téléphone Tuteur / Parent</label>
            <input
              type="tel"
              placeholder="Ex: +226 70 23 45 67"
              value={calContact}
              onChange={(e) => setCalContact(e.target.value)}
              className={`w-full text-xs border rounded-lg px-3 py-2 focus:outline-none ${
                theme === "dark" ? "bg-stone-900 border-stone-700 text-white" : "bg-white border-stone-200 text-stone-800"
              }`}
            />
          </div>
        </div>

        {/* Calendar Output / Interactive Timeline */}
        {!calBirthDate ? (
          <div className={`text-center py-10 border border-dashed rounded-xl ${
            theme === "dark" ? "border-stone-800" : "border-stone-200"
          }`}>
            <Calendar className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              Saisissez la date de naissance de l'enfant ou choisissez un profil pour calculer son calendrier vaccinal.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border p-3 rounded-xl text-xs ${
              theme === "dark" ? "bg-primary-950/10 border-primary-900/30 text-primary-400" : "bg-primary-50/50 border-primary-100 text-primary-950"
            }`}>
              <div>
                <span className="font-semibold uppercase tracking-wide">Fiche de Suivi :</span>
                <strong className={`ml-1 ${theme === "dark" ? "text-stone-100" : "text-stone-800"}`}>
                  {calPatientName || "Enfant non nommé"}
                </strong>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-stone-600 dark:text-stone-350">
                <span>Âge calculé : <strong className="text-primary-700 dark:text-primary-400">{getAgeDisplay(calBirthDate)}</strong></span>
                <span>Né(e) le : <strong className={theme === "dark" ? "text-stone-100" : "text-stone-800"}>{new Date(calBirthDate).toLocaleDateString("fr-FR")}</strong></span>
              </div>
            </div>

            {/* Timeline steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PEV_PROTOCOL.map((step) => {
                const stepDueDate = calculateDueDate(calBirthDate, step.ageWeeks);
                const isStepOverdue = stepDueDate < dNow;
                
                // Check if all vaccines of this step are administered
                const stepVaccineDetails = step.vaccines.map((v) => {
                  const check = isVaccineAdministered(calPatientName || "---", v.name, v.dose);
                  return {
                    ...v,
                    administered: check.done,
                    adminDate: check.date
                  };
                });
                
                const allDone = stepVaccineDetails.every((v) => v.administered);

                return (
                  <div
                    key={step.id}
                    className={`border rounded-xl p-4 transition-all flex flex-col justify-between ${
                      allDone
                        ? "bg-success-50/20 border-success-200/50 dark:bg-success-950/5 dark:border-success-900/30"
                        : isStepOverdue
                        ? "bg-danger-50/10 border-danger-150 dark:bg-danger-950/5 dark:border-danger-900/30"
                        : theme === "dark" ? "bg-stone-850/50 border-stone-800" : "bg-stone-50/50 border-stone-200"
                    }`}
                  >
                    <div>
                      {/* Step Title & Due Date */}
                      <div className="flex justify-between items-start border-b pb-2 mb-3 border-stone-100 dark:border-stone-850">
                        <div>
                          <h4 className={`font-serif font-bold text-xs ${theme === "dark" ? "text-white" : "text-stone-900"}`}>
                            {step.ageLabel}
                          </h4>
                          <span className="text-xs text-stone-500 dark:text-stone-400 font-mono font-bold block mt-0.5">
                            Date : {new Date(stepDueDate).toLocaleDateString("fr-FR")}
                          </span>
                        </div>
                        {allDone ? (
                          <span className="bg-success-100 dark:bg-success-950 text-success-800 dark:text-success-400 text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                            <CheckCircle className="w-3 h-3 text-success-600 dark:text-success-400" /> Fait
                          </span>
                        ) : isStepOverdue ? (
                          <span className="bg-danger-150 dark:bg-danger-950 text-danger-800 dark:text-danger-400 text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 animate-pulse">
                            <ShieldAlert className="w-3 h-3 text-danger-600" /> En retard
                          </span>
                        ) : (
                          <span className="bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-400 text-2xs font-semibold uppercase px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                            <Clock className="w-3 h-3 text-blue-600" /> Prévu
                          </span>
                        )}
                      </div>

                      {/* Vaccines in this step */}
                      <div className="space-y-2">
                        {stepVaccineDetails.map((v, i) => (
                          <div
                            key={i}
                            className={`text-xs p-2.5 rounded-lg border flex flex-col gap-1 shadow-2xs ${
                              theme === "dark" ? "bg-stone-900 border-stone-800 text-stone-200" : "bg-white border-stone-100 text-stone-850"
                            }`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <div>
                                <span className="font-semibold text-primary-800 dark:text-primary-400 block">{v.name}</span>
                                <span className="text-xs text-stone-500 dark:text-stone-400 block leading-tight">{v.description}</span>
                              </div>
                              {v.administered ? (
                                <span className="text-success-600 dark:text-success-400 font-bold text-xs flex items-center gap-1 shrink-0">
                                  <CheckCircle className="w-3.5 h-3.5" /> {new Date(v.adminDate!).toLocaleDateString("fr-FR")}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handlePreFillForm(v.name, v.dose)}
                                  className="bg-primary-50 dark:bg-primary-950/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-semibold text-2xs px-1.5 py-1 rounded-lg border border-primary-200/50 transition-all flex items-center gap-0.5 shrink-0"
                                >
                                  Vacciner
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                            <span className="text-2xs text-stone-450 uppercase font-bold">Dose: {v.dose}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Distribution visual progress tracks */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 mb-4 flex items-center gap-2">
          Statistiques de Dispensation par Antigène de Vaccination
        </h3>
        {vaccinations.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-4 text-center italic">Aucune donnée disponible.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(antigenDistribution).map(([ant, count]) => {
              const maxAntCount = Math.max(...Object.values(antigenDistribution), 1);
              const w = Math.round((count / maxAntCount) * 100);
              return (
                <div key={ant}>
                  <div className="flex justify-between text-xs font-semibold text-stone-600 mb-1">
                    <span>{ant}</span>
                    <span className="font-bold text-primary-700">{count} dose(s) administrée(s)</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entry Vaccine form */}
        <div id="form-enregistrement-vaccination" className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Enregistrer une Vaccination (PEV)
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom du Patient / de l'Enfant *</label>
              <input
                type="text"
                placeholder="Prénom Nom"
                value={vacPatient}
                onChange={(e) => setVacPatient(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date Naissance Enfant</label>
                <input
                  type="date"
                  value={vacDateNaissance}
                  onChange={(e) => setVacDateNaissance(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Téléphone Parent</label>
                <input
                  type="tel"
                  placeholder="+226..."
                  value={vacContact}
                  onChange={(e) => setVacContact(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Consultation vaccinale : contrôle avant injection */}
            <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">Consultation Vaccinale (contrôle avant injection)</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Poids actuel (kg)</label>
                  <input type="number" step="0.1" value={vacPoidsActuel} onChange={(e) => setVacPoidsActuel(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Température (°C)</label>
                  <input type="number" step="0.1" value={vacTemperature} onChange={(e) => setVacTemperature(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">État général</label>
                  <select value={vacEtatGeneral} onChange={(e) => setVacEtatGeneral(e.target.value as any)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
                    <option value="Bien portant">Bien portant</option>
                    <option value="Malade / Fébrile">Malade / Fébrile</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer pt-1">
                <input type="checkbox" checked={vacContreIndication} onChange={(e) => setVacContreIndication(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                Contre-indication identifiée (maladie fébrile aiguë, allergie connue, immunodépression...)
              </label>
              {vacContreIndication && (
                <input
                  type="text"
                  placeholder="Préciser la contre-indication..."
                  value={vacContreIndicationDetail}
                  onChange={(e) => setVacContreIndicationDetail(e.target.value)}
                  className="w-full text-xs border border-danger-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
                />
              )}

              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={vacConsentementParent} onChange={(e) => setVacConsentementParent(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Consentement du parent / tuteur obtenu
              </label>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={vacSurveillance30min} onChange={(e) => setVacSurveillance30min(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Surveillance de 30 min post-injection effectuée (réaction allergique)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Antigène / Vaccin</label>
                <select
                  value={vacVaccin}
                  onChange={(e) => setVacVaccin(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="BCG">BCG (Tuberculose)</option>
                  <option value="VPO (Polio oral)">VPO (Polio oral)</option>
                  <option value="VPI (Polio injectable)">VPI (Polio injectable)</option>
                  <option value="Penta (DTC-HepB-Hib)">Penta (DTC-HepB-Hib)</option>
                  <option value="Pneumocoque (PCV13)">Pneumocoque (PCV13)</option>
                  <option value="Rotavirus">Rotavirus</option>
                  <option value="VAP (Antipaludique RTS,S)">VAP (Antipaludique RTS,S)</option>
                  <option value="VAR (Rougeole-Rubéole)">VAR (Rougeole-Rubéole)</option>
                  <option value="VAA (Fièvre jaune)">VAA (Fièvre jaune)</option>
                  <option value="Méningocoque A">Méningocoque A</option>
                  <option value="Vitamine A">Vitamine A (Supplément)</option>
                  <option value="Td (Tétanos-Diphtérie)">Td (Tétanos-Diphtérie)</option>
                  <option value="COVID-19">COVID-19</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Dose</label>
                <select
                  value={vacDose}
                  onChange={(e) => setVacDose(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Dose unique">Dose unique</option>
                  <option value="1ère dose">1ère dose</option>
                  <option value="2ème dose">2ème dose</option>
                  <option value="3ème dose">3ème dose</option>
                  <option value="Rappel">Rappel</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date administration</label>
                <input
                  type="date"
                  value={vacDateAdmin}
                  onChange={(e) => setVacDateAdmin(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Numéro de lot</label>
                <input
                  type="text"
                  placeholder="Ex: LOT-2026-V88"
                  value={vacLot}
                  onChange={(e) => setVacLot(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Site d'injection</label>
                <select
                  value={vacSite}
                  onChange={(e) => setVacSite(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Bras gauche">Bras gauche</option>
                  <option value="Bras droit">Bras droit</option>
                  <option value="Cuisse gauche">Cuisse gauche</option>
                  <option value="Cuisse droite">Cuisse droite</option>
                  <option value="Oral">Oral (Voie buccale)</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Agent Vaccinateur</label>
                <select
                  value={vacAgent}
                  onChange={(e) => setVacAgent(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">— Non assigné —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom} ({s.poste})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date du prochain rappel (Facultatif)</label>
              <input
                type="date"
                value={vacProchainRappel}
                onChange={(e) => setVacProchainRappel(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Effets indésirables constatés (MAPI)</label>
              <input
                type="text"
                placeholder="Ex: Fièvre modérée passagère..."
                value={vacEffets}
                onChange={(e) => setVacEffets(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAddVaccination}
              className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2"
            >
              Enregistrer la vaccination
            </button>
          </div>
        </div>

        {/* Recalls Grid list */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-700" />
            Calendrier des Rappels Programmés
          </h3>
          {rappels.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun rappel programmé dans le carnet PEV.</p>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                    <th className="p-3">Date Prévue</th>
                    <th className="p-3">Patient / Enfant</th>
                    <th className="p-3">Vaccin à administrer</th>
                    <th className="p-3 text-center">Statut d'alerte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rappels
                    .sort((a, b) => a.prochainRappel.localeCompare(b.prochainRappel))
                    .map((v) => {
                      const isOverdue = v.prochainRappel < dNow;
                      return (
                        <tr key={v.id} className="hover:bg-stone-50/50">
                          <td className="p-3 font-mono font-bold text-warning-800">
                            {new Date(v.prochainRappel).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="p-3 font-bold text-stone-800">
                            <div>{v.patient}</div>
                            {v.contact && <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">📞 {v.contact}</div>}
                          </td>
                          <td className="p-3 text-stone-600 font-medium">{v.vaccin}</td>
                          <td className="p-3 text-center">
                            {isOverdue ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-danger-100 text-danger-800 animate-pulse">
                                Retard
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-blue-100 text-blue-800">
                                Programmé
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
      </div>

      {/* Main List Archive */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs">
        <div className="border-b border-stone-100 pb-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
            <Clipboard className="w-5 h-5 text-primary-700" />
            Registre d'Immunisation (Carnet Sanitaire PEV)
          </h3>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher un enfant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {filteredVaccinationsList.length === 0 ? (
          <p className="text-xs text-stone-500 dark:text-stone-400 py-6 text-center italic">Aucun enregistrement de vaccination trouvé.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs">
                  <th className="p-3">Date admin.</th>
                  <th className="p-3">Enfant / Patient</th>
                  <th className="p-3 text-center">Âge</th>
                  <th className="p-3">Antigène</th>
                  <th className="p-3">Dose</th>
                  <th className="p-3 text-center">Numéro Lot</th>
                  <th className="p-3">Site injection</th>
                  <th className="p-3">Agent vaccinateur</th>
                  <th className="p-3">Effets / Complications (MAPI)</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredVaccinationsList.map((v) => {
                  const agent = staff.find((s) => s.id === v.agent);
                  return (
                    <tr key={v.id} className="hover:bg-stone-50/50">
                      <td className="p-3 font-mono text-stone-500 dark:text-stone-400">{new Date(v.dateAdmin).toLocaleDateString("fr-FR")}</td>
                      <td className="p-3 font-bold text-stone-800">
                        <div>{v.patient}</div>
                        {v.contact && <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">📞 {v.contact}</div>}
                      </td>
                      <td className="p-3 text-center text-stone-600 font-semibold">{getAgeDisplay(v.dateNaissance)}</td>
                      <td className="p-3 font-semibold text-primary-800">{v.vaccin}</td>
                      <td className="p-3 text-stone-600 font-semibold">{v.dose}</td>
                      <td className="p-3 text-center font-mono text-stone-500">{v.lot || "—"}</td>
                      <td className="p-3 text-stone-500">{v.site}</td>
                      <td className="p-3 font-semibold text-stone-700">{agent ? agent.nom : "—"}</td>
                      <td className={`p-3 text-stone-600 font-medium italic ${v.effets ? "text-danger-600 font-bold" : "text-stone-500 dark:text-stone-400"}`}>
                        {v.effets || "Aucun"}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteVac(v.id)}
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
    </div>
  );
}
