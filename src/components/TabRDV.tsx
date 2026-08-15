/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { logActivity } from "../lib/activityLogger";
import { RendezVous, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Calendar, Clock, Plus, Trash2, Phone, AlertCircle, CheckCircle, HelpCircle, MessageSquare, Send, Smartphone, MessageCircle, Check, Trash, Bell } from "lucide-react";

interface TabRDVProps {
  rdvs: RendezVous[];
  staff: Staff[];
  onUpdateRdvs: (rdvs: RendezVous[]) => void;
  showToast?: (title: string, message: string, type?: "warning" | "error" | "success" | "info") => void;
}

export default function TabRDV({ rdvs, staff, onUpdateRdvs, showToast }: TabRDVProps) {
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

  // Appointment form states
  const [rdvPatient, setRdvPatient] = useState("");
  const [rdvContact, setRdvContact] = useState("");
  const [rdvDate, setRdvDate] = useState(getTodayStr());
  const [rdvHeure, setRdvHeure] = useState("");
  const [rdvType, setRdvType] = useState("Consultation");
  const [rdvPraticien, setRdvPraticien] = useState("");
  const [rdvMotif, setRdvMotif] = useState("");
  const [rdvNotes, setRdvNotes] = useState("");

  // Filters state
  const [filterRdvDate, setFilterDateFilter] = useState<"today" | "upcoming" | "all">("today");
  const [filterRdvPraticien, setPratFilter] = useState("all");
  const [filterRdvStatut, setStatutFilter] = useState("all");

  // Notification Simulation State
  interface NotificationLog {
    id: string;
    patient: string;
    contact: string;
    canal: "SMS" | "WhatsApp";
    message: string;
    timestamp: string;
    statut: "Envoyé" | "Échoué";
  }

  const [notifLogs, setNotifLogs] = useState<NotificationLog[]>(() => {
    const saved = localStorage.getItem("deogracias_notif_logs");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback
      }
    }
    return [
      {
        id: "demo-1",
        patient: "Ablavi Mensah",
        contact: "+229 97 12 34 56",
        canal: "WhatsApp",
        message: `🟢 *${profile.name}*\n\nBonjour *Ablavi Mensah*,\n\nVotre rendez-vous pour un(e) *Consultation générale* est *CONFIRMÉ* par notre équipe.\n\n📅 Date : *13/07/2026*\n🕒 Heure : *09:00*\n👨‍⚕️ Praticien : *Dr. Lawson*\n\nNous nous réjouissons de vous accueillir. Merci ! ✨`,
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        statut: "Envoyé"
      },
      {
        id: "demo-2",
        patient: "Kofi Soglo",
        contact: "+229 90 98 76 54",
        canal: "SMS",
        message: `${profile.name} : Votre RDV du 14/07/2026 à 14:30 (Suivi / Contrôle) est PLANIFIÉ. Contactez-nous en cas de modification.`,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        statut: "Envoyé"
      }
    ];
  });

  const triggerNotification = (patient: string, contact: string, canal: "SMS" | "WhatsApp", message: string) => {
    const newLog: NotificationLog = {
      id: "notif-" + Math.random().toString(36).substr(2, 9),
      patient,
      contact: contact || "Non spécifié",
      canal,
      message,
      timestamp: new Date().toISOString(),
      statut: "Envoyé"
    };
    setNotifLogs((prev) => {
      const updated = [newLog, ...prev];
      localStorage.setItem("deogracias_notif_logs", JSON.stringify(updated));
      return updated;
    });
  };

  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };
  const dTomorrow = getTomorrowStr();
  const rdvsTomorrow = rdvs.filter((r) => r.date === dTomorrow && r.statut !== "Annulé" && r.statut !== "Terminé");

  const handleSendSimulation = (rdv: RendezVous, canal: "SMS" | "WhatsApp") => {
    const drName = staff.find(s => s.id === rdv.praticien)?.nom || "Médecin de garde";
    const formattedDate = new Date(rdv.date).toLocaleDateString("fr-FR");
    let msg = "";
    if (canal === "SMS") {
      msg = `${profile.name} : Rappel pour ${rdv.patient}. Votre RDV (${rdv.type}) est planifié le ${formattedDate} à ${rdv.heure}. En cas de modification, contactez le ${profile.phone}.`;
    } else {
      msg = `🟢 *${profile.name}*\n\nBonjour *${rdv.patient}*,\n\nCeci est un rappel automatique pour votre rendez-vous de type *${rdv.type}*.\n\n📅 Date : *${formattedDate}*\n🕒 Heure : *${rdv.heure}*\n👨‍⚕️ Praticien : *${drName}*\n\nMerci de nous signaler toute indisponibilité au moins 24 heures à l'avance. Prenez soin de vous ! 🌟`;
    }
    triggerNotification(rdv.patient, rdv.contact, canal, msg);
    if (showToast) {
      showToast(
        "Rappel envoyé 📲",
        `Rappel ${canal} simulé avec succès pour ${rdv.patient}.`,
        "success"
      );
    } else {
      alert(`Simulation d'envoi ${canal} déclenchée pour ${rdv.patient} ! Consultez l'historique en bas du formulaire.`);
    }
  };

  const handleSendAllTomorrowReminders = () => {
    if (rdvsTomorrow.length === 0) {
      if (showToast) {
        showToast("Aucun rendez-vous", "Aucun rendez-vous n'est planifié pour demain.", "info");
      }
      return;
    }

    rdvsTomorrow.forEach((rdv) => {
      const drName = staff.find(s => s.id === rdv.praticien)?.nom || "Médecin de garde";
      const formattedDate = new Date(rdv.date).toLocaleDateString("fr-FR");
      const msg = `${profile.name} (Rappel SMS) : Bonjour ${rdv.patient}, votre rendez-vous (${rdv.type}) est demain (${formattedDate}) à ${rdv.heure} avec ${drName}.`;
      triggerNotification(rdv.patient, rdv.contact, "SMS", msg);
    });

    if (showToast) {
      showToast(
        "Rappels SMS Envoyés 📱",
        `Simulation réussie : ${rdvsTomorrow.length} SMS de rappel envoyés pour les rendez-vous de demain.`,
        "success"
      );
    } else {
      alert(`Simulation réussie : ${rdvsTomorrow.length} SMS de rappel envoyés pour les rendez-vous de demain !`);
    }
  };

  const handleAddRdv = () => {
    if (!rdvPatient.trim() || !rdvDate || !rdvHeure) {
      alert("Veuillez renseigner au moins le nom du patient, la date et l'heure.");
      return;
    }

    const newRdv: RendezVous = {
      id: generateUid(),
      patient: rdvPatient.trim(),
      contact: rdvContact.trim(),
      date: rdvDate,
      heure: rdvHeure,
      type: rdvType,
      praticien: rdvPraticien,
      motif: rdvMotif.trim(),
      notes: rdvNotes.trim(),
      statut: "Planifié",
      createdAt: new Date().toISOString()
    };

    onUpdateRdvs([newRdv, ...rdvs]);
    
    // Auto simulate SMS creation notification
    const formattedDate = new Date(rdvDate).toLocaleDateString("fr-FR");
    const drName = staff.find((s) => s.id === rdvPraticien)?.nom || "Médecin de garde";
    const rdvMsg = `${profile.name} : Votre RDV du ${formattedDate} à ${rdvHeure} (${rdvType}) est bien enregistré (Statut: PLANIFIÉ) avec ${drName}.`;
    triggerNotification(newRdv.patient, newRdv.contact, "SMS", rdvMsg);

    setRdvPatient("");
    setRdvContact("");
    setRdvHeure("");
    setRdvMotif("");
    setRdvNotes("");
    alert("Rendez-vous planifié pour : " + newRdv.patient + " (Notification de planification simulée et enregistrée !)");
  };

  const handleUpdateStatut = (id: string, statut: RendezVous["statut"]) => {
    const originalRdv = rdvs.find((r) => r.id === id);
    const updated = rdvs.map((r) => (r.id === id ? { ...r, statut } : r));
    onUpdateRdvs(updated);

    if (originalRdv) {
      const drName = staff.find((s) => s.id === originalRdv.praticien)?.nom || "Médecin de garde";
      const formattedDate = new Date(originalRdv.date).toLocaleDateString("fr-FR");
      let message = "";
      let canal: "SMS" | "WhatsApp" = originalRdv.contact ? "WhatsApp" : "SMS";

      if (statut === "Confirmé") {
        message = `🟢 *${profile.name}*\n\nBonjour *${originalRdv.patient}*,\n\nVotre rendez-vous pour un(e) *${originalRdv.type}* est *CONFIRMÉ* par notre équipe.\n\n📅 Date : *${formattedDate}*\n🕒 Heure : *${originalRdv.heure}*\n👨‍⚕️ Praticien : *${drName}*\n\nNous nous réjouissons de vous accueillir. Merci ! ✨`;
        canal = "WhatsApp";
      } else if (statut === "Annulé") {
        message = `${profile.name} : Bonjour ${originalRdv.patient}, votre RDV du ${formattedDate} à ${originalRdv.heure} a été ANNULÉ. Veuillez nous contacter pour planifier une autre date.`;
        canal = "SMS";
      } else if (statut === "Terminé") {
        message = `${profile.name} : Bonjour ${originalRdv.patient}, merci pour votre visite ce jour. Votre consultation est terminée. Prenez soin de vous !`;
        canal = "SMS";
      } else if (statut === "Absent") {
        message = `${profile.name} : Bonjour ${originalRdv.patient}, nous avons constaté votre absence au RDV du ${formattedDate} à ${originalRdv.heure}. Souhaitez-vous le replanifier ?`;
        canal = "SMS";
      }

      if (message) {
        triggerNotification(originalRdv.patient, originalRdv.contact, canal, message);
      }
    }
  };

  const handleDeleteRdv = (id: string) => {
    const rdvToDelete = rdvs.find((r) => r.id === id);
    if (confirm("Supprimer ce rendez-vous ?")) {
      onUpdateRdvs(rdvs.filter((r) => r.id !== id));
      if (rdvToDelete) {
        logActivity(
          "Suppression de fiche (Rendez-vous)",
          "suppression",
          `Suppression du rendez-vous du ${new Date(rdvToDelete.date).toLocaleDateString("fr-FR")} à ${rdvToDelete.heure} pour le patient : ${rdvToDelete.patient} (Praticien : ${rdvToDelete.praticien}).`
        );
      }
    }
  };

  // Calculations
  const dNow = getTodayStr();
  const dPlus7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const rdvsToday = rdvs.filter((r) => r.date === dNow);
  const rdvsWeek = rdvs.filter((r) => r.date >= dNow && r.date <= dPlus7);
  const termines = rdvs.filter((r) => r.statut === "Terminé").length;
  const absents = rdvs.filter((r) => r.statut === "Absent").length;
  const attendanceRate = termines + absents > 0 ? Math.round((termines / (termines + absents)) * 100) : null;
  const annulationsMonth = rdvs.filter((r) => r.statut === "Annulé" && r.date.slice(0, 7) === dNow.slice(0, 7)).length;

  const heureActuelle = new Date().toTimeString().slice(0, 5);
  const prochains = rdvs
    .filter((r) => (r.date > dNow || (r.date === dNow && r.heure >= heureActuelle)) && r.statut !== "Annulé" && r.statut !== "Terminé")
    .sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
  const prochain = prochains[0];

  // Filtering list
  const getFilteredRdvs = () => {
    return rdvs.filter((r) => {
      // 1. Date
      if (filterRdvDate === "today" && r.date !== dNow) return false;
      if (filterRdvDate === "upcoming" && r.date < dNow) return false;
      // 2. Praticien
      if (filterRdvPraticien !== "all" && r.praticien !== filterRdvPraticien) return false;
      // 3. Statut
      if (filterRdvStatut !== "all" && r.statut !== filterRdvStatut) return false;
      return true;
    });
  };

  const filteredRdvsList = getFilteredRdvs().sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-3xl font-semibold text-primary-700 font-serif">{rdvsToday.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">RDV Aujourd'hui</div>
          <div className="text-xs text-success-600 font-bold mt-1">
            {rdvsToday.filter((r) => r.statut === "Confirmé").length} confirmés
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-3xl font-semibold text-blue-700 font-serif">{rdvsWeek.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">RDV cette semaine</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">7 prochains jours</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600">
          <div className="text-3xl font-semibold text-warning-700 font-serif">{prochain ? prochain.heure : "—"}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Prochain RDV</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1 truncate" title={prochain ? prochain.patient : ""}>
            {prochain ? prochain.patient : "Aucun à venir"}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-success-600">
          <div className="text-3xl font-semibold text-success-700 font-serif">
            {attendanceRate !== null ? `${attendanceRate}%` : "—"}
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Taux de présence</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Terminés / Total présentés</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600">
          <div className="text-3xl font-semibold text-danger-700 font-serif">{annulationsMonth}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Annulations</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Mois en cours</div>
        </div>
      </div>

      {/* Reminder Notification Box & Tomorrow SMS Reminders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rdvsToday.filter((r) => r.statut !== "Terminé" && r.statut !== "Annulé" && r.statut !== "Absent").length > 0 ? (
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3 text-primary-850 text-xs font-bold shadow-2xs">
            <CheckCircle className="w-5 h-5 text-primary-600 flex-shrink-0" />
            <div>
              Consultations du jour : <strong>{rdvsToday.filter((r) => r.statut === "Confirmé" || r.statut === "Planifié").length} rdv actifs</strong> à honorer aujourd'hui dans l'Espace Consultation.
            </div>
          </div>
        ) : (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-center gap-3 text-stone-500 text-xs font-semibold shadow-2xs">
            <CheckCircle className="w-5 h-5 text-stone-500 dark:text-stone-400 flex-shrink-0" />
            <div>Aucun rendez-vous actif à honorer aujourd'hui.</div>
          </div>
        )}

        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 flex items-center justify-between gap-4 text-blue-900 text-xs shadow-2xs">
          <div className="flex items-start gap-3">
            <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-semibold text-[12px] block text-blue-950 mb-0.5">Rappels SMS - Rendez-vous de demain</span>
              <span>
                Il y a <strong>{rdvsTomorrow.length} rendez-vous</strong> prévus pour demain ({new Date(dTomorrow).toLocaleDateString("fr-FR")}).
              </span>
            </div>
          </div>
          {rdvsTomorrow.length > 0 && (
            <button
              type="button"
              onClick={handleSendAllTomorrowReminders}
              className="bg-blue-600 hover:bg-blue-750 text-white font-semibold text-xs uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-3xs flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Rappeler ({rdvsTomorrow.length})</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6 self-start">
          {/* Booking Form Card */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Planifier un Rendez-vous
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom complet du patient *</label>
              <input
                type="text"
                placeholder="Prénom Nom"
                value={rdvPatient}
                onChange={(e) => setRdvPatient(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Numéro de Contact</label>
              <input
                type="tel"
                placeholder="+226 70 00 00 00"
                value={rdvContact}
                onChange={(e) => setRdvContact(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date *</label>
                <input
                  type="date"
                  value={rdvDate}
                  onChange={(e) => setRdvDate(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Heure *</label>
                <input
                  type="time"
                  value={rdvHeure}
                  onChange={(e) => setRdvHeure(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Catégorie d'acte</label>
                <select
                  value={rdvType}
                  onChange={(e) => setRdvType(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Consultation">Consultation générale</option>
                  <option value="Suivi">Suivi / Contrôle</option>
                  <option value="Vaccination">Vaccination</option>
                  <option value="Analyse laboratoire">Analyse Labo</option>
                  <option value="Soins infirmiers">Soins infirmiers</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Médecin Praticien</label>
                <select
                  value={rdvPraticien}
                  onChange={(e) => setRdvPraticien(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">— Non assigné —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Motif principal</label>
              <input
                type="text"
                placeholder="Ex: Hypertension ou CPN..."
                value={rdvMotif}
                onChange={(e) => setRdvMotif(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Remarques complémentaires</label>
              <textarea
                placeholder="Détails importants..."
                value={rdvNotes}
                onChange={(e) => setRdvNotes(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleAddRdv}
              className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2"
            >
              Planifier le rendez-vous
            </button>
          </div>
        </div>

        {/* Collapsible/Interactive Notification Simulator Logs */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="border-b border-stone-100 pb-3 flex items-center justify-between">
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary-700" />
              Suivi des Notifications (Simulées)
            </h3>
            <button
              onClick={() => {
                if (confirm("Effacer tout l'historique des simulations ?")) {
                  setNotifLogs([]);
                  localStorage.removeItem("deogracias_notif_logs");
                }
              }}
              className="text-xs uppercase font-bold text-stone-500 dark:text-stone-400 hover:text-danger-600 transition-colors flex items-center gap-1 cursor-pointer"
              title="Effacer l'historique"
            >
              <Trash className="w-3.5 h-3.5" /> Effacer
            </button>
          </div>

          <p className="text-sm text-stone-500 font-medium leading-relaxed">
            Le système simule l'envoi de SMS ou de messages WhatsApp lors de la création, d'un changement de statut ou via les boutons d'envoi rapide du registre.
          </p>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {notifLogs.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-stone-150 rounded-xl">
                <Bell className="w-8 h-8 text-stone-300 mx-auto mb-1.5" />
                <p className="text-xs text-stone-500 dark:text-stone-400 italic">Aucune notification pour l'instant.</p>
              </div>
            ) : (
              notifLogs.map((log) => (
                <div key={log.id} className="border border-stone-100 bg-stone-50/50 rounded-xl p-3 space-y-1.5 text-xs relative hover:border-primary-500/20 transition-all shadow-3xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-stone-850 truncate max-w-[120px]" title={log.patient}>
                      {log.patient}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-2xs font-black uppercase px-2 py-0.5 rounded-lg border ${
                        log.canal === "WhatsApp"
                          ? "bg-success-50 text-success-700 border-success-250"
                          : "bg-blue-50 text-blue-700 border-blue-250"
                      }`}>
                        {log.canal}
                      </span>
                      <span className="flex items-center gap-0.5 text-xs font-bold text-success-600">
                        <Check className="w-3 h-3 text-success-600" /> {log.statut}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 font-mono">
                    Dest : {log.contact || "Non spécifié"}
                  </p>

                  <div className="bg-white border border-stone-100 rounded-lg p-2 text-[10.5px] leading-relaxed text-stone-700 font-medium whitespace-pre-wrap font-sans">
                    {log.message}
                  </div>

                  <div className="text-2xs text-stone-500 dark:text-stone-400 font-bold text-right">
                    {new Date(log.timestamp).toLocaleTimeString("fr-FR", { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Schedules Grid Card */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
          <div className="border-b border-stone-100 pb-3 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-700" />
              Registre Complet des Rendez-vous
            </h3>

            {/* Quick Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterRdvDate}
                onChange={(e) => setFilterDateFilter(e.target.value as any)}
                className="text-xs font-bold bg-stone-50 border border-stone-200 text-stone-800 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="today">Aujourd'hui</option>
                <option value="upcoming">À venir</option>
                <option value="all">Toutes dates</option>
              </select>
              <select
                value={filterRdvPraticien}
                onChange={(e) => setPratFilter(e.target.value)}
                className="text-xs font-bold bg-stone-50 border border-stone-200 text-stone-800 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all">Tous praticiens</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nom}
                  </option>
                ))}
              </select>
              <select
                value={filterRdvStatut}
                onChange={(e) => setStatutFilter(e.target.value)}
                className="text-xs font-bold bg-stone-50 border border-stone-200 text-stone-800 rounded-lg px-2.5 py-1.5 focus:outline-none"
              >
                <option value="all">Tous statuts</option>
                <option value="Planifié">Planifiés</option>
                <option value="Confirmé">Confirmés</option>
                <option value="Terminé">Terminés</option>
                <option value="Absent">Absents</option>
                <option value="Annulé">Annulés</option>
              </select>
            </div>
          </div>

          {filteredRdvsList.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun rendez-vous ne correspond à vos filtres.</p>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                    <th className="p-3">Date/Heure</th>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Praticien</th>
                    <th className="p-3">Motif</th>
                    <th className="p-3 text-center">Statut</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredRdvsList.map((r) => {
                    const agent = staff.find((s) => s.id === r.praticien);
                    return (
                      <tr key={r.id} className="hover:bg-stone-50/50">
                        <td className="p-3 font-mono">
                          <div className="font-bold text-warning-800">{r.heure}</div>
                          <div className="text-xs text-stone-500 dark:text-stone-400">{new Date(r.date).toLocaleDateString("fr-FR")}</div>
                          {r.date === dTomorrow && (
                            <span className="inline-block bg-blue-100 text-blue-800 text-[8px] font-black uppercase px-1 py-0.5 rounded-lg mt-1 tracking-wider">
                              Demain
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-stone-800">
                          <div>{r.patient}</div>
                          {r.contact && (
                            <div className="text-xs text-stone-500 dark:text-stone-400 flex flex-col gap-1 font-semibold mt-1">
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-stone-500 dark:text-stone-400" /> {r.contact}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleSendSimulation(r, "SMS")}
                                  className="text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-0.5 hover:underline cursor-pointer text-2xs font-black uppercase bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-1"
                                  title="Simuler un SMS de rappel"
                                >
                                  <MessageSquare className="w-2.5 h-2.5" /> SMS
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendSimulation(r, "WhatsApp")}
                                  className="text-success-600 hover:text-success-800 transition-colors flex items-center gap-0.5 hover:underline cursor-pointer text-2xs font-black uppercase bg-success-50 hover:bg-success-100 border border-success-250 rounded-lg px-1"
                                  title="Simuler un WhatsApp de rappel"
                                >
                                  <Send className="w-2.5 h-2.5" /> WA
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-stone-500 font-medium">{r.type}</td>
                        <td className="p-3 font-medium text-stone-700">{agent ? agent.nom : "—"}</td>
                        <td className="p-3 text-stone-500 italic max-w-[150px] truncate" title={r.motif}>
                          {r.motif || "—"}
                        </td>
                        <td className="p-3 text-center">
                          <select
                            value={r.statut}
                            onChange={(e) => handleUpdateStatut(r.id, e.target.value as any)}
                            className="border border-stone-200 rounded-lg p-1 bg-white text-stone-700 focus:outline-none text-sm"
                          >
                            <option value="Planifié">Planifié</option>
                            <option value="Confirmé">Confirmé</option>
                            <option value="Terminé">Terminé</option>
                            <option value="Absent">Absent</option>
                            <option value="Annulé">Annulé</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRdv(r.id)}
                            className="text-stone-300 hover:text-danger-600 transition-all"
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
    </div>
  );
}
