/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { 
  Smartphone, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Activity, 
  Plus, 
  Trash2, 
  Search, 
  Lock, 
  CheckCircle, 
  XCircle, 
  Stethoscope, 
  ShieldCheck, 
  Users, 
  RefreshCw 
} from "lucide-react";

// Pre-defined list of time slots
const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", 
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", 
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
];

export default function TabOnlineRDV() {
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

  const [activeSubRole, setActiveSubRole] = useState<"patient" | "secretariat" | "medecin">("patient");
  const [firebaseConnected, setFirebaseConnected] = useState(false);

  // Doctors list (from Firestore 'medecins')
  const [onlineMeds, setOnlineMeds] = useState<any[]>([]);

  // Form states for booking
  const [patientMedId, setPatientMedId] = useState("");
  const [patientDate, setPatientDate] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [selectedSlot, setSelectedSlot] = useState("");
  const [patientNom, setPatientNom] = useState("");
  const [patientTel, setPatientTel] = useState("");
  const [patientMotif, setPatientMotif] = useState("");
  const [bookingStatus, setBookingStatus] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Follow-up state
  const [suiviTel, setSuiviTel] = useState("");
  const [suiviResult, setSuiviResult] = useState<any[] | null>(null);

  // Secretariat states
  const [secPin, setSecPin] = useState("");
  const [isSecAuthorized, setIsSecAuthorized] = useState(false);
  const [secNewMedNom, setSecNewMedNom] = useState("");
  const [secNewMedSpec, setSecNewMedSpec] = useState("");
  const [secBulkMeds, setSecBulkMeds] = useState("");
  const [secFiltreDate, setSecFiltreDate] = useState("");
  const [secFiltreStatut, setSecFiltreStatut] = useState("");
  const [allRdvs, setAllRdvs] = useState<any[]>([]);
  const [secRdvManualMedId, setSecRdvManualMedId] = useState("");
  const [secRdvManualDate, setSecRdvManualDate] = useState("");
  const [secRdvManualHeure, setSecRdvManualHeure] = useState("");
  const [secRdvManualNom, setSecRdvManualNom] = useState("");
  const [secRdvManualTel, setSecRdvManualTel] = useState("");
  const [secRdvManualMotif, setSecRdvManualMotif] = useState("");

  // Doctor states
  const [medPin, setMedPin] = useState("");
  const [isMedAuthorized, setIsMedAuthorized] = useState(false);
  const [selectedMedId, setSelectedMedId] = useState("");
  const [medRdvs, setMedRdvs] = useState<any[]>([]);

  // Check Firebase connection
  useEffect(() => {
    if (db) {
      setFirebaseConnected(true);
      fetchDoctors();
    }
  }, []);

  // Fetch doctors
  const fetchDoctors = async () => {
    if (!db) return;
    try {
      const snap = await db.collection("medecins").where("actif", "==", true).get();
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setOnlineMeds(list);
    } catch (err) {
      console.error("Error fetching doctors:", err);
    }
  };

  // Fetch all doctors (including inactive for admin view)
  const [allMedsAdmin, setAllMedsAdmin] = useState<any[]>([]);
  const fetchDoctorsAdmin = async () => {
    if (!db) return;
    try {
      const snap = await db.collection("medecins").get();
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAllMedsAdmin(list);
    } catch (err) {
      console.error("Error fetching doctors for admin:", err);
    }
  };

  // Load busy slots when date or doctor is selected
  useEffect(() => {
    if (patientMedId && patientDate) {
      loadBusySlots();
    } else {
      setBookedSlots(new Set());
    }
  }, [patientMedId, patientDate]);

  const loadBusySlots = async () => {
    if (!db || !patientMedId || !patientDate) return;
    try {
      const snap = await db.collection("rdv")
        .where("medecinId", "==", patientMedId)
        .where("date", "==", patientDate)
        .where("statut", "in", ["Demandé", "Confirmé"])
        .get();
      
      const taken = new Set<string>();
      snap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.heure) {
          taken.add(data.heure);
        }
      });
      setBookedSlots(taken);
      setSelectedSlot(""); // reset selected slot
    } catch (err) {
      console.error("Error loading busy slots:", err);
    }
  };

  // Handle slot reservation
  const handleReserveRdv = async () => {
    if (!db) {
      setBookingStatus({ type: "err", text: "Firebase non configuré." });
      return;
    }

    if (!patientMedId || !patientDate || !selectedSlot || !patientNom.trim() || !patientTel.trim()) {
      setBookingStatus({ type: "err", text: "Veuillez remplir le médecin, la date, le créneau, votre nom et votre numéro de téléphone." });
      return;
    }

    try {
      // Avoid duplicate slot booking check
      const conflict = await db.collection("rdv")
        .where("medecinId", "==", patientMedId)
        .where("date", "==", patientDate)
        .where("heure", "==", selectedSlot)
        .where("statut", "in", ["Demandé", "Confirmé"])
        .get();

      if (!conflict.empty) {
        setBookingStatus({ type: "err", text: "Ce créneau vient d'être réservé. Veuillez en choisir un autre." });
        loadBusySlots();
        return;
      }

      const selectedMed = onlineMeds.find((m) => m.id === patientMedId);
      const medecinNom = selectedMed ? `${selectedMed.nom} (${selectedMed.specialite || 'Généraliste'})` : "Médecin";

      await db.collection("rdv").add({
        medecinId: patientMedId,
        medecinNom,
        date: patientDate,
        heure: selectedSlot,
        patientNom: patientNom.trim(),
        patientTel: patientTel.trim(),
        motif: patientMotif.trim(),
        statut: "Demandé",
        createdAt: Date.now()
      });

      setBookingStatus({
        type: "ok",
        text: `Demande de rendez-vous enregistrée avec succès pour le ${new Date(patientDate).toLocaleDateString("fr-FR")} à ${selectedSlot}. Le secrétariat validera votre demande sous peu.`
      });

      // Clear input fields
      setPatientNom("");
      setPatientTel("");
      setPatientMotif("");
      setSelectedSlot("");
      loadBusySlots();
    } catch (err: any) {
      setBookingStatus({ type: "err", text: "Erreur lors de la réservation : " + err.message });
    }
  };

  // Follow-up tracking
  const handleFollowUp = async () => {
    if (!db || !suiviTel.trim()) return;
    try {
      const snap = await db.collection("rdv").where("patientTel", "==", suiviTel.trim()).get();
      const list = snap.docs.map((doc) => doc.data()).sort((a: any, b: any) => (a.date + a.heure).localeCompare(b.date + b.heure));
      setSuiviResult(list);
    } catch (err) {
      console.error("Error searching follow-up:", err);
    }
  };

  // Secretariat authorizations
  const handleVerifySecPin = () => {
    if (secPin === "1234") {
      setIsSecAuthorized(true);
      fetchDoctorsAdmin();
      fetchSecretariatRdvs();
    } else {
      alert("Code PIN Secrétariat incorrect ! (Le code par défaut est 1234)");
    }
  };

  const fetchSecretariatRdvs = async () => {
    if (!db) return;
    try {
      let query = db.collection("rdv");
      const snap = await query.get();
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => (a.date + a.heure).localeCompare(b.date + b.heure));
      setAllRdvs(list);
    } catch (err) {
      console.error("Error loading secretariat rdvs:", err);
    }
  };

  const handleAddDoctor = async () => {
    if (!db || !secNewMedNom.trim()) return;
    try {
      await db.collection("medecins").add({
        nom: secNewMedNom.trim(),
        specialite: secNewMedSpec.trim(),
        actif: true,
        createdAt: Date.now()
      });
      setSecNewMedNom("");
      setSecNewMedSpec("");
      alert("Médecin ajouté avec succès !");
      fetchDoctors();
      fetchDoctorsAdmin();
    } catch (err) {
      console.error("Error adding doctor:", err);
    }
  };

  const handleAddBulkDoctors = async () => {
    if (!db || !secBulkMeds.trim()) return;
    try {
      const lines = secBulkMeds.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
      let count = 0;
      for (const line of lines) {
        let nom = line;
        let specialite = "";
        const sep = line.includes(" - ") ? " - " : (line.includes("-") ? "-" : null);
        if (sep) {
          const parts = line.split(sep);
          nom = parts[0].trim();
          specialite = parts.slice(1).join(sep).trim();
        }
        if (!nom) continue;
        await db.collection("medecins").add({
          nom,
          specialite,
          actif: true,
          createdAt: Date.now()
        });
        count++;
      }
      setSecBulkMeds("");
      alert(`${count} médecins ajoutés en masse !`);
      fetchDoctors();
      fetchDoctorsAdmin();
    } catch (err) {
      console.error("Error bulk adding doctors:", err);
    }
  };

  const handleToggleMedActif = async (id: string, currentStatus: boolean) => {
    if (!db) return;
    try {
      await db.collection("medecins").doc(id).update({ actif: !currentStatus });
      fetchDoctors();
      fetchDoctorsAdmin();
    } catch (err) {
      console.error("Error toggling doctor status:", err);
    }
  };

  const handleUpdateOnlineRdvStatus = async (id: string, statut: "Confirmé" | "Annulé" | "Terminé") => {
    if (!db) return;
    try {
      await db.collection("rdv").doc(id).update({ statut });
      alert(`Statut du rendez-vous mis à jour : ${statut}`);
      fetchSecretariatRdvs();
      if (selectedMedId) loadDoctorRdvs();
    } catch (err) {
      console.error("Error updating online rdv status:", err);
    }
  };

  const handleSecManualRdv = async () => {
    if (!db || !secRdvManualMedId || !secRdvManualDate || !secRdvManualHeure || !secRdvManualNom.trim()) {
      alert("Veuillez renseigner le médecin, la date, l'heure et le nom du patient.");
      return;
    }
    try {
      const selectedMed = allMedsAdmin.find((m) => m.id === secRdvManualMedId);
      const medecinNom = selectedMed ? `${selectedMed.nom} (${selectedMed.specialite || 'Généraliste'})` : "Médecin";

      await db.collection("rdv").add({
        medecinId: secRdvManualMedId,
        medecinNom,
        date: secRdvManualDate,
        heure: secRdvManualHeure,
        patientNom: secRdvManualNom.trim(),
        patientTel: secRdvManualTel.trim(),
        motif: secRdvManualMotif.trim(),
        statut: "Confirmé",
        createdAt: Date.now()
      });

      setSecRdvManualNom("");
      setSecRdvManualTel("");
      setSecRdvManualMotif("");
      setSecRdvManualHeure("");
      alert("Rendez-vous direct enregistré et confirmé !");
      fetchSecretariatRdvs();
    } catch (err) {
      console.error("Error booking manual rdv:", err);
    }
  };

  // Doctor authorizations
  const handleVerifyMedPin = () => {
    if (medPin === "1234") {
      setIsMedAuthorized(true);
      fetchDoctors();
    } else {
      alert("Code PIN Médecin incorrect ! (Le code par défaut est 1234)");
    }
  };

  const loadDoctorRdvs = async () => {
    if (!db || !selectedMedId) return;
    try {
      const snap = await db.collection("rdv").where("medecinId", "==", selectedMedId).get();
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((r: any) => r.statut !== "Annulé")
        .sort((a: any, b: any) => (a.date + a.heure).localeCompare(b.date + b.heure));
      setMedRdvs(list);
    } catch (err) {
      console.error("Error loading doctor rdvs:", err);
    }
  };

  useEffect(() => {
    if (selectedMedId) {
      loadDoctorRdvs();
    } else {
      setMedRdvs([]);
    }
  }, [selectedMedId]);

  // Filters for Secretariat list
  const getFilteredSecretariatRdvs = () => {
    return allRdvs.filter((r) => {
      if (secFiltreDate && r.date !== secFiltreDate) return false;
      if (secFiltreStatut && r.statut !== secFiltreStatut) return false;
      return true;
    });
  };

  const filteredSecRdvs = getFilteredSecretariatRdvs();

  return (
    <div className="space-y-6">
      {/* Alert Configuration check */}
      {!firebaseConnected && (
        <div className="bg-danger-50 border border-danger-200 text-danger-800 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold shadow-xs">
          <XCircle className="w-5 h-5 text-danger-600 flex-shrink-0" />
          <div>
            <strong>Configuration Firebase indisponible.</strong> Veuillez vérifier vos identifiants ou votre connexion internet.
          </div>
        </div>
      )}

      {/* Hero Banner with Brand Design */}
      <div className="bg-gradient-to-br from-primary-900 to-stone-900 rounded-2xl p-6 text-white border-b-4 border-warning-500 shadow-md flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-warning-400 bg-primary-950 flex items-center justify-center font-serif text-xl font-semibold text-warning-400">
            ✚
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-serif font-semibold text-white">Prise de RDV en Ligne & Espace Patient</h2>
            <p className="text-xs text-primary-300 font-semibold uppercase tracking-widest">
              {profile.name} — Portail Mobile & Web Synchronisé
            </p>
          </div>
        </div>
        <div className="flex bg-stone-950/40 border border-stone-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveSubRole("patient")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
              activeSubRole === "patient" ? "bg-primary-600 text-white shadow-xs" : "text-stone-500 dark:text-stone-400 hover:text-white"
            }`}
          >
            🧑 Patient
          </button>
          <button
            onClick={() => setActiveSubRole("secretariat")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
              activeSubRole === "secretariat" ? "bg-warning-600 text-stone-950 shadow-xs" : "text-stone-500 dark:text-stone-400 hover:text-white"
            }`}
          >
            🧾 Secrétariat
          </button>
          <button
            onClick={() => setActiveSubRole("medecin")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all ${
              activeSubRole === "medecin" ? "bg-danger-600 text-white shadow-xs" : "text-stone-500 dark:text-stone-400 hover:text-white"
            }`}
          >
            🩺 Médecin
          </button>
        </div>
      </div>

      {/* Main Roles Views */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ===================== PATIENT PORTAL ===================== */}
        {activeSubRole === "patient" && (
          <>
            <div className="lg:col-span-12 mb-2">
              <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-primary-900">Application Mobile Patient</h4>
                  <p className="text-xs text-primary-700 mt-1">Le portail est accessible par les patients depuis leur smartphone.</p>
                </div>
                <a
                  href="?mode=patient"
                  target="_blank"
                  className="bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm"
                >
                  <Smartphone className="w-4 h-4" />
                  Ouvrir la version Mobile
                </a>
              </div>
            </div>
            
            {/* Booking Column */}
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-7 space-y-5">
              <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary-700" />
                Prendre un rendez-vous en ligne (Vue Bureau)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500">
                    Médecin / Consultant souhaité
                  </label>
                  <select
                    value={patientMedId}
                    onChange={(e) => setPatientMedId(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    <option value="">— Sélectionner un praticien —</option>
                    {onlineMeds.map((med) => (
                      <option key={med.id} value={med.id}>
                        {med.nom} {med.specialite ? `— ${med.specialite}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500">
                    Date de rendez-vous
                  </label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={patientDate}
                    onChange={(e) => setPatientDate(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Slots pill selector */}
              {patientMedId && patientDate && (
                <div className="space-y-2 border-t border-stone-100 pt-4">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block">
                    Créneaux horaires disponibles
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {TIME_SLOTS.map((slot) => {
                      const isTaken = bookedSlots.has(slot);
                      const isSelected = selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={isTaken}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 text-center rounded-lg font-mono text-xs font-bold transition-all border ${
                            isTaken
                              ? "bg-danger-50 border-danger-100 text-danger-400 line-through cursor-not-allowed opacity-60"
                              : isSelected
                              ? "bg-primary-600 border-primary-600 text-white shadow-xs font-semibold"
                              : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                          }`}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Patient details fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-stone-100 pt-4">
                <div className="space-y-1">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500">
                    Nom et Prénom *
                  </label>
                  <input
                    type="text"
                    placeholder="Votre nom complet"
                    value={patientNom}
                    onChange={(e) => setPatientNom(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500">
                    Téléphone de contact *
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: +226 70 00 00 00"
                    value={patientTel}
                    onChange={(e) => setPatientTel(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500">
                  Motif de consultation (facultatif)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Consultation pédiatrique, suivi diabète, renouvellement d'ordonnance..."
                  value={patientMotif}
                  onChange={(e) => setPatientMotif(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleReserveRdv}
                className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs transition-all shadow-md uppercase tracking-wider"
              >
                ✓ Confirmer ma demande de rendez-vous
              </button>

              {bookingStatus && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold ${
                    bookingStatus.type === "ok"
                      ? "bg-primary-50 border-primary-200 text-primary-800"
                      : "bg-danger-50 border-danger-200 text-danger-800"
                  }`}
                >
                  {bookingStatus.text}
                </div>
              )}
            </div>

            {/* Tracking Column */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-200 pb-2 flex items-center gap-2">
                  <Search className="w-4 h-4 text-warning-700" />
                  Suivre mes rendez-vous
                </h3>
                <p className="text-sm text-stone-500 font-medium">
                  Saisissez le numéro de téléphone utilisé lors de votre réservation pour suivre l'état de validation en temps réel.
                </p>

                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="Votre numéro de téléphone"
                    value={suiviTel}
                    onChange={(e) => setSuiviTel(e.target.value)}
                    className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleFollowUp}
                    className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs transition-all"
                  >
                    Rechercher
                  </button>
                </div>

                {suiviResult && (
                  <div className="space-y-2 pt-2">
                    {suiviResult.length === 0 ? (
                      <p className="text-sm text-stone-500 dark:text-stone-400 italic text-center">Aucun rendez-vous enregistré pour ce numéro.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-[250px] overflow-y-auto border border-stone-200 rounded-xl bg-white">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200">
                              <th className="p-2.5">Date / Heure</th>
                              <th className="p-2.5">Médecin</th>
                              <th className="p-2.5 text-center">Statut</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {suiviResult.map((r, i) => (
                              <tr key={i}>
                                <td className="p-2.5 font-mono">
                                  <div className="font-bold text-stone-800">{new Date(r.date).toLocaleDateString("fr-FR")}</div>
                                  <div className="text-xs text-warning-800">{r.heure}</div>
                                </td>
                                <td className="p-2.5 font-semibold text-stone-600">{r.medecinNom.split("(")[0]}</td>
                                <td className="p-2.5 text-center">
                                  <span
                                    className={`inline-block text-2xs font-semibold px-2 py-0.5 rounded-full ${
                                      r.statut === "Confirmé"
                                        ? "bg-primary-50 text-primary-700 border border-primary-200"
                                        : r.statut === "Annulé"
                                        ? "bg-danger-50 text-danger-700 border border-danger-200"
                                        : r.statut === "Terminé"
                                        ? "bg-stone-100 text-stone-500 border border-stone-200"
                                        : "bg-warning-50 text-warning-700 border border-warning-200"
                                    }`}
                                  >
                                    {r.statut}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ===================== SECRETARIAT PORTAL ===================== */}
        {activeSubRole === "secretariat" && (
          <div className="lg:col-span-12 space-y-6">
            {!isSecAuthorized ? (
              <div className="max-w-md mx-auto bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-warning-50 text-warning-700 flex items-center justify-center mx-auto text-lg">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-semibold text-stone-900">Accès Sécurisé Secrétariat</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Saisissez le code d'accès de 4 chiffres requis pour administrer le planning.</p>
                </div>
                <input
                  type="password"
                  placeholder="Code secret"
                  maxLength={10}
                  value={secPin}
                  onChange={(e) => setSecPin(e.target.value)}
                  className="w-full text-center tracking-widest font-semibold text-lg border border-stone-200 rounded-lg py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleVerifySecPin}
                  className="w-full py-2 bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs rounded-lg transition-all"
                >
                  Valider l'Accès
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                
                {/* Admin doctors manager */}
                <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-4 space-y-5">
                  <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary-700" />
                    Médecins Disponibles en Ligne
                  </h3>

                  {/* Add doctor */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-2xs uppercase font-semibold text-stone-500">Nom du praticien</label>
                      <input
                        type="text"
                        placeholder="Dr. Nom"
                        value={secNewMedNom}
                        onChange={(e) => setSecNewMedNom(e.target.value)}
                        className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-2xs uppercase font-semibold text-stone-500">Spécialité</label>
                      <input
                        type="text"
                        placeholder="Ex: Gynécologie, Pédiatrie"
                        value={secNewMedSpec}
                        onChange={(e) => setSecNewMedSpec(e.target.value)}
                        className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddDoctor}
                      className="w-full py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-xs transition-all"
                    >
                      + Ajouter ce médecin
                    </button>
                  </div>

                  {/* Bulk import */}
                  <div className="space-y-1 border-t border-stone-100 pt-3">
                    <label className="text-2xs uppercase font-semibold text-stone-500">Importation Multiple (format: Nom - Spécialité)</label>
                    <textarea
                      rows={3}
                      placeholder="Dr. Kaboré - Médecine générale&#10;Dr. Sanou - Pédiatrie"
                      value={secBulkMeds}
                      onChange={(e) => setSecBulkMeds(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg p-2 bg-stone-50 focus:bg-white focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddBulkDoctors}
                      className="w-full py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-semibold text-xs transition-all border border-stone-200"
                    >
                      + Ajouter toute la liste
                    </button>
                  </div>

                  {/* List admin doctors */}
                  <div className="border-t border-stone-100 pt-3 space-y-2">
                    <label className="text-2xs uppercase font-semibold text-stone-500 block">Registre des médecins</label>
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {allMedsAdmin.map((m) => (
                        <div key={m.id} className="flex justify-between items-center text-xs p-2 rounded-lg bg-stone-50 border border-stone-200">
                          <div>
                            <span className="font-semibold text-stone-800">{m.nom}</span>
                            {m.specialite && <span className="text-xs text-stone-500 block">{m.specialite}</span>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleMedActif(m.id, m.actif)}
                            className={`text-2xs px-2 py-0.5 rounded-lg font-bold transition-all border ${
                              m.actif 
                                ? "bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100" 
                                : "bg-stone-100 text-stone-500 dark:text-stone-400 border-stone-200 hover:bg-stone-200"
                            }`}
                          >
                            {m.actif ? "Actif" : "Inactif"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Dashboard requests registrar */}
                <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-3">
                    <h3 className="text-sm font-serif font-bold text-stone-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary-700" />
                      Tous les Rendez-vous en Ligne
                    </h3>
                    
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={secFiltreDate}
                        onChange={(e) => setSecFiltreDate(e.target.value)}
                        className="text-xs font-bold bg-stone-50 border border-stone-200 rounded-lg p-1.5 focus:outline-none"
                      />
                      <select
                        value={secFiltreStatut}
                        onChange={(e) => setSecFiltreStatut(e.target.value)}
                        className="text-xs font-bold bg-stone-50 border border-stone-200 rounded-lg p-1.5 focus:outline-none"
                      >
                        <option value="">Tous les statuts</option>
                        <option value="Demandé">Demandé</option>
                        <option value="Confirmé">Confirmé</option>
                        <option value="Annulé">Annulé</option>
                        <option value="Terminé">Terminé</option>
                      </select>
                      <button
                        type="button"
                        onClick={fetchSecretariatRdvs}
                        className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-200"
                        title="Rafraîchir"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
                      </button>
                    </div>
                  </div>

                  {/* Table lists */}
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                          <th className="p-3">Date / Heure</th>
                          <th className="p-3">Patient</th>
                          <th className="p-3">Médecin</th>
                          <th className="p-3">Motif</th>
                          <th className="p-3 text-center">Statut</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredSecRdvs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center italic text-stone-500 dark:text-stone-400">Aucun rendez-vous ne correspond à vos filtres.</td>
                          </tr>
                        ) : (
                          filteredSecRdvs.map((r) => (
                            <tr key={r.id} className="hover:bg-stone-50/50">
                              <td className="p-3 font-mono">
                                <div className="font-bold text-stone-800">{new Date(r.date).toLocaleDateString("fr-FR")}</div>
                                <div className="text-xs text-warning-800">{r.heure}</div>
                              </td>
                              <td className="p-3 font-bold text-stone-800">
                                <div>{r.patientNom}</div>
                                {r.patientTel && <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{r.patientTel}</div>}
                              </td>
                              <td className="p-3 font-medium text-stone-600">{r.medecinNom.split("(")[0]}</td>
                              <td className="p-3 text-stone-500 italic max-w-[140px] truncate" title={r.motif}>{r.motif || "—"}</td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-block text-2xs font-semibold px-2 py-0.5 rounded-full ${
                                    r.statut === "Confirmé"
                                      ? "bg-primary-50 text-primary-700 border border-primary-200"
                                      : r.statut === "Annulé"
                                      ? "bg-danger-50 text-danger-700 border border-danger-200"
                                      : r.statut === "Terminé"
                                      ? "bg-stone-100 text-stone-500 border border-stone-200"
                                      : "bg-warning-50 text-warning-700 border border-warning-200"
                                  }`}
                                >
                                  {r.statut}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex justify-center gap-1.5">
                                  {r.statut === "Demandé" && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateOnlineRdvStatus(r.id, "Confirmé")}
                                      className="px-2 py-1 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-2xs tracking-wide"
                                    >
                                      Valider
                                    </button>
                                  )}
                                  {r.statut !== "Annulé" && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateOnlineRdvStatus(r.id, "Annulé")}
                                      className="px-2 py-1 rounded-lg bg-danger-50 hover:bg-danger-100 text-danger-700 border border-danger-200 font-semibold text-2xs tracking-wide"
                                    >
                                      Annuler
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Manual fast book */}
                  <div className="border-t border-stone-100 pt-4 space-y-3">
                    <h4 className="text-xs font-serif font-bold text-stone-900 flex items-center gap-1">
                      <Plus className="w-4 h-4 text-primary-700" />
                      Enregistrer un rendez-vous direct (Accueil / Téléphone)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                      <div className="space-y-1 col-span-2">
                        <label className="text-2xs font-semibold text-stone-500">Médecin</label>
                        <select
                          value={secRdvManualMedId}
                          onChange={(e) => setSecRdvManualMedId(e.target.value)}
                          className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50 focus:outline-none"
                        >
                          <option value="">— Choisir —</option>
                          {allMedsAdmin.filter(m => m.actif).map((m) => (
                            <option key={m.id} value={m.id}>{m.nom}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-2xs font-semibold text-stone-500">Date</label>
                        <input
                          type="date"
                          value={secRdvManualDate}
                          onChange={(e) => setSecRdvManualDate(e.target.value)}
                          className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-2xs font-semibold text-stone-500">Heure</label>
                        <input
                          type="time"
                          value={secRdvManualHeure}
                          onChange={(e) => setSecRdvManualHeure(e.target.value)}
                          className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-2xs font-semibold text-stone-500">Nom du patient</label>
                        <input
                          type="text"
                          placeholder="Nom complet"
                          value={secRdvManualNom}
                          onChange={(e) => setSecRdvManualNom(e.target.value)}
                          className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-2xs font-semibold text-stone-500">Téléphone</label>
                        <input
                          type="tel"
                          placeholder="+226 ..."
                          value={secRdvManualTel}
                          onChange={(e) => setSecRdvManualTel(e.target.value)}
                          className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1 col-span-3">
                        <label className="text-2xs font-semibold text-stone-500">Motif</label>
                        <input
                          type="text"
                          placeholder="Ex: Consultation"
                          value={secRdvManualMotif}
                          onChange={(e) => setSecRdvManualMotif(e.target.value)}
                          className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 focus:outline-none"
                        />
                      </div>
                      <div className="col-span-1 flex items-end">
                        <button
                          type="button"
                          onClick={handleSecManualRdv}
                          className="w-full py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-xs transition-all uppercase tracking-wider"
                        >
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* ===================== DOCTOR PORTAL ===================== */}
        {activeSubRole === "medecin" && (
          <div className="lg:col-span-12 space-y-6">
            {!isMedAuthorized ? (
              <div className="max-w-md mx-auto bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-danger-50 text-danger-700 flex items-center justify-center mx-auto text-lg">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-semibold text-stone-900">Accès Sécurisé Médecin</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">Saisissez le code d'accès de 4 chiffres requis pour consulter votre planning.</p>
                </div>
                <input
                  type="password"
                  placeholder="Code secret"
                  maxLength={10}
                  value={medPin}
                  onChange={(e) => setMedPin(e.target.value)}
                  className="w-full text-center tracking-widest font-semibold text-lg border border-stone-200 rounded-lg py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleVerifyMedPin}
                  className="w-full py-2 bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs rounded-lg transition-all"
                >
                  Valider l'Accès
                </button>
              </div>
            ) : (
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-5 animate-fade-in">
                <h3 className="text-sm font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary-700" />
                  Mon Planning de Consultations en Ligne
                </h3>

                <div className="flex items-center gap-4 max-w-sm">
                  <label className="text-xs uppercase font-semibold text-stone-500 whitespace-nowrap">Je suis :</label>
                  <select
                    value={selectedMedId}
                    onChange={(e) => setSelectedMedId(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:outline-none"
                  >
                    <option value="">— Choisir mon nom —</option>
                    {onlineMeds.map((m) => (
                      <option key={m.id} value={m.id}>{m.nom}</option>
                    ))}
                  </select>
                </div>

                {selectedMedId && (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                          <th className="p-3">Date / Heure</th>
                          <th className="p-3">Patient</th>
                          <th className="p-3">Téléphone</th>
                          <th className="p-3">Motif</th>
                          <th className="p-3 text-center">Statut</th>
                          <th className="p-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {medRdvs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-8 text-center italic text-stone-500 dark:text-stone-400">Aucun rendez-vous planifié pour l'instant.</td>
                          </tr>
                        ) : (
                          medRdvs.map((r) => (
                            <tr key={r.id} className="hover:bg-stone-50/50">
                              <td className="p-3 font-mono">
                                <div className="font-bold text-stone-800">{new Date(r.date).toLocaleDateString("fr-FR")}</div>
                                <div className="text-xs text-warning-800">{r.heure}</div>
                              </td>
                              <td className="p-3 font-bold text-stone-800">{r.patientNom}</td>
                              <td className="p-3 font-medium text-stone-600">{r.patientTel || "—"}</td>
                              <td className="p-3 text-stone-500 italic max-w-[180px] truncate" title={r.motif}>{r.motif || "—"}</td>
                              <td className="p-3 text-center">
                                <span
                                  className={`inline-block text-2xs font-semibold px-2 py-0.5 rounded-full ${
                                    r.statut === "Confirmé"
                                      ? "bg-primary-50 text-primary-700 border border-primary-200"
                                      : r.statut === "Annulé"
                                      ? "bg-danger-50 text-danger-700 border border-danger-200"
                                      : r.statut === "Terminé"
                                      ? "bg-stone-100 text-stone-500 border border-stone-200"
                                      : "bg-warning-50 text-warning-700 border border-warning-200"
                                  }`}
                                >
                                  {r.statut}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex justify-center gap-1.5">
                                  {r.statut === "Demandé" && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateOnlineRdvStatus(r.id, "Confirmé")}
                                        className="px-2 py-1 rounded-lg bg-primary-600 text-white font-semibold text-2xs"
                                      >
                                        ✓ Accepter
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateOnlineRdvStatus(r.id, "Annulé")}
                                        className="px-2 py-1 rounded-lg bg-danger-50 border border-danger-200 text-danger-700 font-semibold text-2xs"
                                      >
                                        ✗ Refuser
                                      </button>
                                    </>
                                  )}
                                  {r.statut === "Confirmé" && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateOnlineRdvStatus(r.id, "Terminé")}
                                      className="px-2 py-1 rounded-lg bg-stone-800 text-white font-semibold text-2xs"
                                    >
                                      Marquer Terminé
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
