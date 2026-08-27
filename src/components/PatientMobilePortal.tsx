/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { getTodayStr } from "../data";
import {
  requestNotificationPermission,
  sendBrowserNotification,
  isNotificationsEnabled,
  getNotificationPermission
} from "../lib/browserNotifications";
import {
  Calendar, Clock, User, Phone, CheckCircle2, ChevronLeft, CalendarPlus,
  Activity, Stethoscope, Bell, BellOff, WifiOff, AlertTriangle, XCircle,
  Loader2, X
} from "lucide-react";

// Must stay in sync with the slots offered in TabOnlineRDV.tsx (secretariat/médecin view)
const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"
];

interface OnlineDoctor {
  id: string;
  nom: string;
  specialite?: string;
  actif?: boolean;
}

// Shape of a document in the Firestore "rdv" collection (same collection used
// by the staff-facing TabOnlineRDV module — this is the single source of truth
// for online appointments, patient side and staff side alike).
interface OnlineRdv {
  id: string;
  medecinId?: string;
  medecinNom?: string;
  date: string;
  heure: string;
  patientNom: string;
  patientTel: string;
  motif?: string;
  statut: "Demandé" | "Confirmé" | "Annulé" | "Terminé";
  createdAt?: number;
}

const IDENTITY_STORAGE_KEY = "dg_patient_portal_identity";

export default function PatientMobilePortal() {
  const [activeView, setActiveView] = useState<"home" | "booking" | "my_appointments">("home");

  // Identity is kept locally only as a convenience so the patient doesn't have
  // to retype it on every visit. It is NEVER the source of truth for
  // appointments — that is always Firestore, keyed by phone number.
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [isIdentified, setIsIdentified] = useState(false);

  const [medecins, setMedecins] = useState<OnlineDoctor[]>([]);
  const [myAppointments, setMyAppointments] = useState<OnlineRdv[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  // Booking form state
  const [selectedMedecin, setSelectedMedecin] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [motif, setMotif] = useState("");
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // In-app confirmation banner (the actual "notification" requested): a queue
  // of status changes the patient hasn't dismissed yet.
  const [confirmationAlerts, setConfirmationAlerts] = useState<{ id: string; text: string }[]>([]);
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());

  // Tracks the last known statut per appointment id, to detect changes when a
  // new Firestore snapshot comes in (e.g. Demandé -> Confirmé).
  const knownStatutsRef = useRef<Map<string, string>>(new Map());
  const isFirstSnapshotRef = useRef(true);

  const firebaseConnected = !!db;

  // Load saved identity on first mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(IDENTITY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name && parsed?.phone) {
          setPatientName(parsed.name);
          setPatientPhone(parsed.phone);
          setIsIdentified(true);
        }
      }
    } catch (e) {
      console.error("Error loading saved patient identity", e);
    }
  }, []);

  // Load active doctors from Firestore (same collection as the staff module)
  useEffect(() => {
    if (!db) return;
    (async () => {
      try {
        const snap = await db.collection("medecins").where("actif", "==", true).get();
        setMedecins(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OnlineDoctor)));
      } catch (err) {
        console.error("Error fetching doctors:", err);
      }
    })();
  }, []);

  // Real-time subscription to this patient's appointments, kept alive for the
  // whole session (not just while on "Mes RDV") so a confirmation notification
  // can fire even if the patient is browsing another screen.
  useEffect(() => {
    if (!db || !isIdentified || !patientPhone.trim()) return;

    setIsLoadingAppointments(true);
    const unsubscribe = db
      .collection("rdv")
      .where("patientTel", "==", patientPhone.trim())
      .onSnapshot(
        (snap) => {
          const list: OnlineRdv[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OnlineRdv));

          // Detect status changes since the last snapshot to raise a notification.
          if (!isFirstSnapshotRef.current) {
            list.forEach((appt) => {
              const previousStatut = knownStatutsRef.current.get(appt.id);
              if (previousStatut && previousStatut !== appt.statut) {
                if (appt.statut === "Confirmé") {
                  const text = `Votre rendez-vous du ${new Date(appt.date).toLocaleDateString("fr-FR")} à ${appt.heure} a été confirmé.`;
                  setConfirmationAlerts((prev) => [...prev, { id: appt.id + "_" + Date.now(), text }]);
                  if (isNotificationsEnabled()) {
                    sendBrowserNotification("Rendez-vous confirmé", text, "rdv-" + appt.id);
                  }
                } else if (appt.statut === "Annulé") {
                  const text = `Votre rendez-vous du ${new Date(appt.date).toLocaleDateString("fr-FR")} à ${appt.heure} a été annulé.`;
                  setConfirmationAlerts((prev) => [...prev, { id: appt.id + "_" + Date.now(), text }]);
                  if (isNotificationsEnabled()) {
                    sendBrowserNotification("Rendez-vous annulé", text, "rdv-" + appt.id);
                  }
                }
              }
            });
          }

          const newStatutMap = new Map<string, string>();
          list.forEach((appt) => newStatutMap.set(appt.id, appt.statut));
          knownStatutsRef.current = newStatutMap;
          isFirstSnapshotRef.current = false;

          list.sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));
          setMyAppointments(list);
          setIsLoadingAppointments(false);
        },
        (err) => {
          console.error("Error listening to appointments:", err);
          setIsLoadingAppointments(false);
        }
      );

    return () => unsubscribe();
  }, [isIdentified, patientPhone]);

  // Load busy slots for the selected doctor/date to avoid double-booking
  useEffect(() => {
    if (!db || !selectedMedecin || !selectedDate) {
      setBookedSlots(new Set());
      return;
    }
    (async () => {
      try {
        const snap = await db!
          .collection("rdv")
          .where("medecinId", "==", selectedMedecin)
          .where("date", "==", selectedDate)
          .where("statut", "in", ["Demandé", "Confirmé"])
          .get();
        const taken = new Set<string>();
        snap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.heure) taken.add(data.heure);
        });
        setBookedSlots(taken);
        setSelectedTime("");
      } catch (err) {
        console.error("Error loading busy slots:", err);
      }
    })();
  }, [selectedMedecin, selectedDate]);

  const handleIdentify = () => {
    if (!patientName.trim() || !patientPhone.trim()) {
      alert("Veuillez renseigner votre nom et votre numéro de téléphone.");
      return;
    }
    localStorage.setItem(
      IDENTITY_STORAGE_KEY,
      JSON.stringify({ name: patientName.trim(), phone: patientPhone.trim() })
    );
    isFirstSnapshotRef.current = true;
    knownStatutsRef.current = new Map();
    setIsIdentified(true);
  };

  const handleChangeIdentity = () => {
    setIsIdentified(false);
    setMyAppointments([]);
    knownStatutsRef.current = new Map();
    isFirstSnapshotRef.current = true;
  };

  const handleEnableNotifications = async () => {
    const permission = await requestNotificationPermission();
    setNotifPermission(permission);
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError(null);

    if (!db) {
      setBookingError("Connexion au service de rendez-vous indisponible. Réessayez plus tard.");
      return;
    }
    if (!selectedDate || !selectedTime) {
      setBookingError("Veuillez choisir une date et une heure.");
      return;
    }

    setIsSubmittingBooking(true);
    try {
      // Guard against a slot taken in the few seconds since it was loaded
      if (selectedMedecin) {
        const conflict = await db
          .collection("rdv")
          .where("medecinId", "==", selectedMedecin)
          .where("date", "==", selectedDate)
          .where("heure", "==", selectedTime)
          .where("statut", "in", ["Demandé", "Confirmé"])
          .get();
        if (!conflict.empty) {
          setBookingError("Ce créneau vient d'être réservé. Veuillez en choisir un autre.");
          setIsSubmittingBooking(false);
          return;
        }
      }

      const selectedMed = medecins.find((m) => m.id === selectedMedecin);
      const medecinNom = selectedMed ? `${selectedMed.nom} (${selectedMed.specialite || "Généraliste"})` : "";

      await db.collection("rdv").add({
        medecinId: selectedMedecin || null,
        medecinNom,
        date: selectedDate,
        heure: selectedTime,
        patientNom: patientName.trim(),
        patientTel: patientPhone.trim(),
        motif: motif.trim(),
        statut: "Demandé",
        createdAt: Date.now()
      });

      setBookingSuccess(true);
      setTimeout(() => {
        setBookingSuccess(false);
        setActiveView("my_appointments");
        setSelectedMedecin("");
        setSelectedDate("");
        setSelectedTime("");
        setMotif("");
      }, 2200);
    } catch (err: any) {
      console.error("Error booking appointment:", err);
      setBookingError("Erreur lors de l'enregistrement de la demande : " + (err.message || "veuillez réessayer."));
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const upcomingAppointments = myAppointments.filter((a) => a.date >= getTodayStr() && a.statut !== "Annulé");

  const statutStyle: Record<string, string> = {
    "Demandé": "bg-warning-100 text-warning-800",
    "Confirmé": "bg-success-100 text-success-800",
    "Annulé": "bg-danger-100 text-danger-800",
    "Terminé": "bg-stone-200 text-stone-700"
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans selection:bg-primary-500/30 sm:bg-stone-200 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-hidden flex flex-col">

        {/* In-app confirmation notifications */}
        {confirmationAlerts.length > 0 && (
          <div className="absolute top-16 left-0 right-0 z-20 p-3 space-y-2">
            {confirmationAlerts.map((alertItem) => (
              <div
                key={alertItem.id}
                className="bg-success-600 text-white rounded-xl shadow-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2"
              >
                <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-semibold flex-1">{alertItem.text}</p>
                <button
                  onClick={() =>
                    setConfirmationAlerts((prev) => prev.filter((a) => a.id !== alertItem.id))
                  }
                  className="p-0.5 hover:bg-white/20 rounded-full flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Header */}
        <header className="bg-primary-700 text-white p-4 sticky top-0 z-10 shadow-md">
          <div className="flex items-center justify-between">
            {activeView !== "home" ? (
              <button
                onClick={() => setActiveView("home")}
                className="p-2 -ml-2 rounded-full hover:bg-primary-600 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <div className="w-10"></div>
            )}
            <h1 className="text-lg font-serif font-bold tracking-wide flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-300" />
              Espace Patient
            </h1>
            <div className="w-10 flex justify-end">
              {isIdentified && myAppointments.some((a) => a.statut === "Confirmé") && (
                <Bell className="w-5 h-5 text-primary-200" />
              )}
            </div>
          </div>
        </header>

        {!firebaseConnected && (
          <div className="bg-danger-50 border-b border-danger-200 p-3 flex items-center gap-2 text-xs text-danger-800 font-semibold">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            Service de rendez-vous en ligne indisponible pour le moment.
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-stone-50">

          {/* IDENTIFICATION GATE */}
          {!isIdentified && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                <h2 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-600" />
                  Identification
                </h2>
                <p className="text-xs text-stone-500 mb-4">
                  Votre numéro de téléphone sert à retrouver vos rendez-vous et à vous notifier dès qu'ils sont confirmés.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">Nom et Prénom</label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Ex: Jean Dupont"
                      className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">Numéro de téléphone</label>
                    <input
                      type="tel"
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="Ex: 70 12 34 56"
                      className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleIdentify}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-bold shadow-md transition-transform active:scale-95"
                  >
                    Continuer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HOME VIEW */}
          {isIdentified && activeView === "home" && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500">Connecté(e) en tant que</p>
                  <p className="text-sm font-bold text-stone-800">{patientName}</p>
                  <p className="text-xs text-stone-500">{patientPhone}</p>
                </div>
                <button onClick={handleChangeIdentity} className="text-xs text-primary-600 font-bold hover:underline">
                  Changer
                </button>
              </div>

              {notifPermission !== "granted" && (
                <button
                  onClick={handleEnableNotifications}
                  className="w-full bg-info-50 border border-info-200 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-info-100 transition-colors"
                >
                  <BellOff className="w-5 h-5 text-info-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-info-900">Activer les notifications</p>
                    <p className="text-xs text-info-700 mt-0.5">Soyez alerté(e) dès que votre rendez-vous est confirmé.</p>
                  </div>
                </button>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveView("booking")}
                  className="bg-primary-600 hover:bg-primary-700 text-white p-5 rounded-2xl shadow-md transition-transform active:scale-95 flex flex-col items-center justify-center gap-3 text-center"
                >
                  <CalendarPlus className="w-8 h-8" />
                  <span className="text-sm font-bold">Prendre RDV</span>
                </button>
                <button
                  onClick={() => setActiveView("my_appointments")}
                  className="bg-white hover:bg-stone-50 text-stone-800 p-5 rounded-2xl shadow-sm border border-stone-200 transition-transform active:scale-95 flex flex-col items-center justify-center gap-3 text-center relative"
                >
                  <Calendar className="w-8 h-8 text-primary-600" />
                  <span className="text-sm font-bold">Mes RDV</span>
                  {upcomingAppointments.length > 0 && (
                    <span className="absolute top-2 right-2 bg-primary-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {upcomingAppointments.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="bg-info-50 p-5 rounded-2xl border border-info-100 flex items-start gap-4">
                <Stethoscope className="w-6 h-6 text-info-500 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-sm font-bold text-info-900 mb-1">Téléconsultation</h3>
                  <p className="text-xs text-info-700 mb-3">Consultez un médecin depuis chez vous. Service bientôt disponible.</p>
                  <button className="text-xs font-bold uppercase tracking-wider bg-info-200 text-info-800 px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed">À venir</button>
                </div>
              </div>
            </div>
          )}

          {/* BOOKING VIEW */}
          {isIdentified && activeView === "booking" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-800">Nouveau Rendez-vous</h2>

              {bookingSuccess ? (
                <div className="bg-success-50 p-8 rounded-2xl border border-success-200 flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <CheckCircle2 className="w-16 h-16 text-success-500" />
                  <div>
                    <h3 className="text-lg font-bold text-success-900">Demande envoyée !</h3>
                    <p className="text-sm text-success-700 mt-2">
                      Le secrétariat va valider votre demande. Vous serez notifié(e) dès sa confirmation.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">

                    {bookingError && (
                      <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 flex items-start gap-2 text-xs text-danger-800 font-semibold">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        {bookingError}
                      </div>
                    )}

                    {medecins.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">Médecin (Optionnel)</label>
                        <select
                          value={selectedMedecin}
                          onChange={(e) => setSelectedMedecin(e.target.value)}
                          className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-sm appearance-none"
                        >
                          <option value="">Peu importe le médecin</option>
                          {medecins.map((m) => (
                            <option key={m.id} value={m.id}>Dr. {m.nom} {m.specialite ? `(${m.specialite})` : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-2">Date du rendez-vous *</label>
                      <input
                        type="date"
                        min={getTodayStr()}
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        required
                        className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-2">Heure *</label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {TIME_SLOTS.map((time) => {
                          const isTaken = bookedSlots.has(time);
                          return (
                            <button
                              key={time}
                              type="button"
                              disabled={isTaken}
                              onClick={() => setSelectedTime(time)}
                              className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                                isTaken
                                  ? "bg-stone-100 text-stone-300 cursor-not-allowed line-through"
                                  : selectedTime === time
                                  ? "bg-primary-600 text-white"
                                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                              }`}
                            >
                              {time}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-2">Motif de consultation</label>
                      <textarea
                        value={motif}
                        onChange={(e) => setMotif(e.target.value)}
                        placeholder="Décrivez brièvement la raison de votre venue..."
                        className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-sm min-h-[80px] resize-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingBooking || !firebaseConnected}
                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white py-4 rounded-lg font-bold shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSubmittingBooking && <Loader2 className="w-4 h-4 animate-spin" />}
                    Envoyer la demande de Rendez-vous
                  </button>
                </form>
              )}
            </div>
          )}

          {/* MY APPOINTMENTS VIEW */}
          {isIdentified && activeView === "my_appointments" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-800">Vos Rendez-vous</h2>

              {isLoadingAppointments ? (
                <div className="flex items-center justify-center py-12 text-stone-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Chargement...</span>
                </div>
              ) : myAppointments.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-3">
                  <Calendar className="w-12 h-12 text-stone-300 mx-auto" />
                  <p className="text-sm font-semibold text-stone-500">Aucun rendez-vous.</p>
                  <button
                    onClick={() => setActiveView("booking")}
                    className="mt-4 text-primary-600 text-sm font-bold hover:underline"
                  >
                    Prendre un rendez-vous
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {myAppointments.map((appt) => (
                    <div key={appt.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex items-start gap-4">
                      <div className="bg-primary-50 text-primary-700 p-3 rounded-xl flex flex-col items-center justify-center min-w-[70px]">
                        <span className="text-xs font-bold uppercase">{new Date(appt.date).toLocaleDateString("fr-FR", { month: "short" })}</span>
                        <span className="text-xl font-black leading-none my-0.5">{new Date(appt.date).getDate()}</span>
                        <span className="text-xs font-bold">{appt.heure}</span>
                      </div>
                      <div className="flex-1 py-1">
                        <h4 className="text-sm font-bold text-stone-800">{appt.motif || "Consultation médicale"}</h4>
                        {appt.medecinNom && (
                          <p className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                            <User className="w-3 h-3" /> {appt.medecinNom}
                          </p>
                        )}
                        <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${statutStyle[appt.statut] || "bg-stone-100 text-stone-700"}`}>
                          {appt.statut === "Confirmé" && <CheckCircle2 className="w-3 h-3" />}
                          {appt.statut === "Annulé" && <XCircle className="w-3 h-3" />}
                          {appt.statut}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
