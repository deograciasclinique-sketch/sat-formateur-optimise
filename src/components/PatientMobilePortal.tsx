/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Portail PUBLIC de prise de rendez-vous (lien ?mode=patient).
 *
 * Fonctionnement « simple demande » : le patient n'a pas à choisir une heure
 * précise. Il envoie une demande (date souhaitée + moment de la journée +
 * motif), le secrétariat la voit arriver en temps réel dans l'onglet
 * « Portail RDV en ligne », appelle le patient, puis confirme en fixant
 * l'heure. Le patient voit alors la confirmation (et l'heure) dans « Mes RDV ».
 */

import React, { useState, useEffect, useRef } from "react";
import { db, authReady, getCurrentUid } from "../lib/firebase";
import { getTodayStr } from "../data";
import {
  requestNotificationPermission,
  sendBrowserNotification,
  isNotificationsEnabled,
  getNotificationPermission
} from "../lib/browserNotifications";
import {
  Calendar, User, Phone, CheckCircle2, ChevronLeft, CalendarPlus,
  Bell, BellOff, WifiOff, AlertTriangle, XCircle, Loader2, X, Sun, Sunset, MapPin
} from "lucide-react";

// Coordonnées affichées aux patients
const CLINIC = {
  nom: "Cabinet Privé de Soins DEO-GRACIAS",
  devise: "Nous vous soignons, Dieu vous guérit",
  adresse: "Yéguéré, 363 Rue de l'Habitat",
  telephones: ["44 92 01 62", "76 40 43 27"]
};

export type MomentPrefere = "Matin" | "Après-midi" | "Peu importe";

interface OnlineDoctor {
  id: string;
  nom: string;
  specialite?: string;
  actif?: boolean;
}

// Document de la collection Firestore "rdv" (partagée avec TabOnlineRDV,
// côté secrétariat/médecin).
interface OnlineRdv {
  id: string;
  medecinId?: string | null;
  medecinNom?: string;
  date: string;
  heure?: string;          // vide tant que le secrétariat n'a pas fixé l'heure
  moment?: MomentPrefere;  // préférence exprimée par le patient
  patientNom: string;
  patientTel: string;
  motif?: string;
  statut: "Demandé" | "Confirmé" | "Annulé" | "Terminé";
  annulePar?: "patient" | "secretariat";
  createdAt?: number;
}

const IDENTITY_STORAGE_KEY = "dg_patient_portal_identity";

/** Ramène un numéro à ses 8 chiffres locaux (Burkina) pour pouvoir retrouver
 *  les RDV quelle que soit la façon dont il a été saisi (espaces, +226…). */
export function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("226")) d = d.slice(3);
  return d;
}

function formatPhone(d: string): string {
  return d.length === 8 ? d.replace(/(\d{2})(?=\d)/g, "$1 ").trim() : d;
}

/** "2026-10-08" -> Date locale (évite le décalage UTC de new Date("2026-10-08")). */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatDateLong(s: string): string {
  return parseLocalDate(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export default function PatientMobilePortal() {
  const [activeView, setActiveView] = useState<"home" | "booking" | "my_appointments">("home");

  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [isIdentified, setIsIdentified] = useState(false);
  const [identError, setIdentError] = useState<string | null>(null);

  // Firestore n'accepte les lectures/écritures qu'une fois la connexion
  // anonyme établie : on attend authReady avant toute requête.
  const [isReady, setIsReady] = useState(false);

  const [medecins, setMedecins] = useState<OnlineDoctor[]>([]);
  const [myAppointments, setMyAppointments] = useState<OnlineRdv[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  // Formulaire de demande
  const [selectedMedecin, setSelectedMedecin] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [moment, setMoment] = useState<MomentPrefere>("Peu importe");
  const [motif, setMotif] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [confirmationAlerts, setConfirmationAlerts] = useState<{ id: string; text: string }[]>([]);
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission());

  const knownStatutsRef = useRef<Map<string, string>>(new Map());
  const isFirstSnapshotRef = useRef(true);

  const firebaseConnected = !!db;
  const phoneKey = normalizePhone(patientPhone);

  useEffect(() => {
    authReady.then(() => setIsReady(true));
  }, []);

  // Identité mémorisée sur ce téléphone (simple confort de saisie)
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

  // Médecins actifs (optionnel pour le patient)
  useEffect(() => {
    if (!db || !isReady) return;
    db.collection("medecins").where("actif", "==", true).get()
      .then((snap) => setMedecins(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OnlineDoctor))))
      .catch((err) => console.error("Error fetching doctors:", err));
  }, [isReady]);

  // Suivi en temps réel des demandes de ce patient
  useEffect(() => {
    if (!db || !isReady || !isIdentified || !phoneKey) return;

    // Par sécurité, un patient ne peut lire QUE les demandes faites depuis ce
    // téléphone (identifiant anonyme patientUid), jamais celles des autres.
    const uid = getCurrentUid();
    if (!uid) return;

    setIsLoadingAppointments(true);
    const unsubscribe = db
      .collection("rdv")
      .where("patientUid", "==", uid)
      .onSnapshot(
        (snap) => {
          const list: OnlineRdv[] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OnlineRdv));

          if (!isFirstSnapshotRef.current) {
            list.forEach((appt) => {
              const previous = knownStatutsRef.current.get(appt.id);
              if (!previous || previous === appt.statut) return;
              const quand = `du ${formatDateLong(appt.date)}${appt.heure ? " à " + appt.heure : ""}`;
              let titre = "", text = "";
              if (appt.statut === "Confirmé") {
                titre = "Rendez-vous confirmé";
                text = `Votre rendez-vous ${quand} est confirmé.`;
              } else if (appt.statut === "Annulé" && appt.annulePar !== "patient") {
                titre = "Rendez-vous annulé";
                text = `Votre demande ${quand} a été annulée par le cabinet. Appelez-nous pour reprogrammer.`;
              }
              if (text) {
                setConfirmationAlerts((prev) => [...prev, { id: appt.id + "_" + Date.now(), text }]);
                if (isNotificationsEnabled()) sendBrowserNotification(titre, text, "rdv-" + appt.id);
              }
            });
          }

          knownStatutsRef.current = new Map(list.map((a) => [a.id, a.statut]));
          isFirstSnapshotRef.current = false;

          list.sort((a, b) => (b.date + (b.heure || "")).localeCompare(a.date + (a.heure || "")));
          setMyAppointments(list);
          setIsLoadingAppointments(false);
        },
        (err) => {
          console.error("Error listening to appointments:", err);
          setIsLoadingAppointments(false);
        }
      );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isIdentified, phoneKey]);

  const handleIdentify = () => {
    setIdentError(null);
    if (!patientName.trim()) {
      setIdentError("Veuillez indiquer votre nom et prénom.");
      return;
    }
    if (phoneKey.length !== 8) {
      setIdentError("Numéro invalide : saisissez les 8 chiffres de votre numéro (ex : 70 12 34 56).");
      return;
    }
    const phone = formatPhone(phoneKey);
    setPatientPhone(phone);
    try {
      localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify({ name: patientName.trim(), phone }));
    } catch { /* stockage indisponible : on continue sans mémoriser */ }
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

    if (!db || !isReady) {
      setBookingError("Connexion au service de rendez-vous indisponible. Vérifiez votre connexion internet puis réessayez.");
      return;
    }
    if (!selectedDate) {
      setBookingError("Veuillez choisir la date souhaitée.");
      return;
    }
    if (selectedDate < getTodayStr()) {
      setBookingError("La date choisie est déjà passée.");
      return;
    }
    if (parseLocalDate(selectedDate).getDay() === 0) {
      // Pas de blocage : simple avertissement, le secrétariat tranchera.
      if (!window.confirm("Vous avez choisi un dimanche. Envoyer quand même la demande ?")) return;
    }

    // Une seule demande en attente par jour et par patient
    const doublon = myAppointments.find((a) => a.date === selectedDate && a.statut === "Demandé");
    if (doublon) {
      setBookingError("Vous avez déjà une demande en attente pour cette date. Le secrétariat va vous rappeler.");
      return;
    }

    setIsSubmittingBooking(true);
    try {
      const uid = getCurrentUid();
      if (!uid) {
        setBookingError("Connexion au service impossible. Vérifiez votre connexion internet puis réessayez.");
        return;
      }
      const med = medecins.find((m) => m.id === selectedMedecin);
      await db.collection("rdv").add({
        type: "demande",
        source: "portail_patient",
        medecinId: selectedMedecin || null,
        medecinNom: med ? `${med.nom} (${med.specialite || "Généraliste"})` : "",
        date: selectedDate,
        heure: "",
        moment,
        patientNom: patientName.trim(),
        patientTel: phoneKey,
        motif: motif.trim(),
        statut: "Demandé",
        createdAt: Date.now(),
        patientUid: uid
      });

      setBookingSuccess(true);
      setSelectedMedecin("");
      setSelectedDate("");
      setMoment("Peu importe");
      setMotif("");
    } catch (err: any) {
      console.error("Error booking appointment:", err);
      setBookingError("La demande n'a pas pu être envoyée. Vérifiez votre connexion ou appelez le cabinet.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleCancel = async (appt: OnlineRdv) => {
    if (!db) return;
    if (!window.confirm("Annuler cette demande de rendez-vous ?")) return;
    setCancellingId(appt.id);
    try {
      await db.collection("rdv").doc(appt.id).update({ statut: "Annulé", annulePar: "patient", annuleLe: Date.now() });
    } catch (err) {
      console.error("Error cancelling appointment:", err);
      alert("Annulation impossible pour le moment. Appelez le cabinet.");
    } finally {
      setCancellingId(null);
    }
  };

  const today = getTodayStr();
  const upcoming = myAppointments.filter((a) => a.date >= today && (a.statut === "Demandé" || a.statut === "Confirmé"));
  const past = myAppointments.filter((a) => !upcoming.includes(a));

  const statutStyle: Record<string, string> = {
    "Demandé": "bg-warning-100 text-warning-800",
    "Confirmé": "bg-success-100 text-success-800",
    "Annulé": "bg-danger-100 text-danger-800",
    "Terminé": "bg-stone-200 text-stone-700"
  };
  const statutLabel: Record<string, string> = {
    "Demandé": "En attente de rappel",
    "Confirmé": "Confirmé",
    "Annulé": "Annulé",
    "Terminé": "Terminé"
  };

  const renderAppointment = (appt: OnlineRdv, actionable: boolean) => (
    <div key={appt.id} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex items-start gap-4">
      <div className="bg-primary-50 text-primary-700 p-3 rounded-xl flex flex-col items-center justify-center min-w-[70px]">
        <span className="text-xs font-bold uppercase">{parseLocalDate(appt.date).toLocaleDateString("fr-FR", { month: "short" })}</span>
        <span className="text-xl font-black leading-none my-0.5">{parseLocalDate(appt.date).getDate()}</span>
        <span className="text-[11px] font-bold">{appt.heure || appt.moment || "—"}</span>
      </div>
      <div className="flex-1 py-1 min-w-0">
        <h4 className="text-sm font-bold text-stone-800">{appt.motif || "Consultation"}</h4>
        <p className="text-xs text-stone-500 mt-0.5 capitalize">{formatDateLong(appt.date)}</p>
        {appt.medecinNom && (
          <p className="text-xs text-stone-500 flex items-center gap-1 mt-1">
            <User className="w-3 h-3" /> {appt.medecinNom}
          </p>
        )}
        <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${statutStyle[appt.statut] || "bg-stone-100 text-stone-700"}`}>
          {appt.statut === "Confirmé" && <CheckCircle2 className="w-3 h-3" />}
          {appt.statut === "Annulé" && <XCircle className="w-3 h-3" />}
          {statutLabel[appt.statut] || appt.statut}
          {appt.statut === "Confirmé" && appt.heure ? ` — ${appt.heure}` : ""}
        </div>
        {actionable && appt.statut === "Demandé" && (
          <button
            onClick={() => handleCancel(appt)}
            disabled={cancellingId === appt.id}
            className="block mt-2 text-xs font-bold text-danger-700 hover:underline disabled:opacity-50"
          >
            {cancellingId === appt.id ? "Annulation…" : "Annuler ma demande"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans sm:bg-stone-200 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-hidden flex flex-col">

        {confirmationAlerts.length > 0 && (
          <div className="absolute top-20 left-0 right-0 z-20 p-3 space-y-2">
            {confirmationAlerts.map((a) => (
              <div key={a.id} className="bg-success-600 text-white rounded-xl shadow-lg p-3 flex items-start gap-3">
                <Bell className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-semibold flex-1">{a.text}</p>
                <button onClick={() => setConfirmationAlerts((prev) => prev.filter((x) => x.id !== a.id))} className="p-0.5 hover:bg-white/20 rounded-full flex-shrink-0" aria-label="Fermer">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* En-tête */}
        <header className="bg-primary-700 text-white px-4 pt-3 pb-4 sticky top-0 z-10 shadow-md">
          <div className="flex items-center gap-3">
            {activeView !== "home" && isIdentified ? (
              <button onClick={() => { setActiveView("home"); setBookingSuccess(false); }} className="p-2 -ml-2 rounded-full hover:bg-primary-600 transition-colors" aria-label="Retour">
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <img src="/icon-patient-192.png" alt="" className="w-10 h-10 rounded-lg bg-white object-contain" />
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-serif font-bold leading-tight truncate">{CLINIC.nom}</h1>
              <p className="text-[11px] text-primary-200 italic truncate">{CLINIC.devise}</p>
            </div>
          </div>
        </header>

        {!firebaseConnected && (
          <div className="bg-danger-50 border-b border-danger-200 p-3 flex items-center gap-2 text-xs text-danger-800 font-semibold">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            Service de rendez-vous en ligne indisponible pour le moment. Appelez-nous.
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 bg-stone-50">

          {/* IDENTIFICATION */}
          {!isIdentified && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                <h2 className="text-base font-bold text-stone-800 mb-1">Demander un rendez-vous</h2>
                <p className="text-xs text-stone-500 mb-4">
                  Indiquez votre nom et votre numéro. Le secrétariat vous rappellera pour fixer l'heure de votre rendez-vous.
                </p>
                <div className="space-y-3">
                  {identError && (
                    <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 text-xs text-danger-800 font-semibold">{identError}</div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">Nom et prénom</label>
                    <input type="text" autoComplete="name" value={patientName} onChange={(e) => setPatientName(e.target.value)}
                      placeholder="Ex : OUÉDRAOGO Awa"
                      className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-base" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-600 mb-1">Numéro de téléphone</label>
                    <input type="tel" inputMode="numeric" autoComplete="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="Ex : 70 12 34 56"
                      className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-base" />
                  </div>
                  <button onClick={handleIdentify} className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-bold shadow-md active:scale-95 transition-transform">
                    Continuer
                  </button>
                </div>
              </div>
              <ClinicContact />
            </div>
          )}

          {/* ACCUEIL */}
          {isIdentified && activeView === "home" && (
            <div className="space-y-5">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex items-center justify-between">
                <div>
                  <p className="text-xs text-stone-500">Bonjour</p>
                  <p className="text-sm font-bold text-stone-800">{patientName}</p>
                  <p className="text-xs text-stone-500">{patientPhone}</p>
                </div>
                <button onClick={handleChangeIdentity} className="text-xs text-primary-600 font-bold hover:underline">Changer</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setBookingSuccess(false); setActiveView("booking"); }}
                  className="bg-primary-600 hover:bg-primary-700 text-white p-5 rounded-2xl shadow-md active:scale-95 transition-transform flex flex-col items-center justify-center gap-3 text-center">
                  <CalendarPlus className="w-8 h-8" />
                  <span className="text-sm font-bold">Demander un RDV</span>
                </button>
                <button onClick={() => setActiveView("my_appointments")}
                  className="bg-white hover:bg-stone-50 text-stone-800 p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-95 transition-transform flex flex-col items-center justify-center gap-3 text-center relative">
                  <Calendar className="w-8 h-8 text-primary-600" />
                  <span className="text-sm font-bold">Mes RDV</span>
                  {upcoming.length > 0 && (
                    <span className="absolute top-2 right-2 bg-primary-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{upcoming.length}</span>
                  )}
                </button>
              </div>

              {upcoming.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Prochain rendez-vous</h3>
                  {renderAppointment(upcoming[upcoming.length - 1], true)}
                </div>
              )}

              {notifPermission === "default" && (
                <button onClick={handleEnableNotifications}
                  className="w-full bg-info-50 border border-info-200 rounded-2xl p-4 flex items-center gap-3 text-left hover:bg-info-100 transition-colors">
                  <BellOff className="w-5 h-5 text-info-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-info-900">Activer les notifications</p>
                    <p className="text-xs text-info-700 mt-0.5">Soyez prévenu(e) quand votre rendez-vous est confirmé.</p>
                  </div>
                </button>
              )}

              <ClinicContact />
            </div>
          )}

          {/* DEMANDE DE RDV */}
          {isIdentified && activeView === "booking" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-800">Nouvelle demande</h2>

              {bookingSuccess ? (
                <div className="bg-success-50 p-6 rounded-2xl border border-success-200 flex flex-col items-center text-center space-y-4">
                  <CheckCircle2 className="w-16 h-16 text-success-500" />
                  <div>
                    <h3 className="text-lg font-bold text-success-900">Demande envoyée !</h3>
                    <p className="text-sm text-success-800 mt-2">
                      Le secrétariat va vous appeler au <strong>{patientPhone}</strong> pour fixer l'heure de votre rendez-vous.
                    </p>
                    <p className="text-xs text-success-700 mt-2">Gardez votre téléphone allumé. Vous pouvez suivre votre demande dans « Mes RDV ».</p>
                  </div>
                  <button onClick={() => { setBookingSuccess(false); setActiveView("my_appointments"); }}
                    className="w-full bg-success-600 hover:bg-success-700 text-white py-3 rounded-lg font-bold">
                    Voir mes rendez-vous
                  </button>
                </div>
              ) : (
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-5">
                    {bookingError && (
                      <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 flex items-start gap-2 text-xs text-danger-800 font-semibold">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        {bookingError}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-2">Date souhaitée *</label>
                      <input type="date" min={today} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} required
                        className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-base" />
                      {selectedDate && <p className="text-xs text-stone-500 mt-1 capitalize">{formatDateLong(selectedDate)}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-2">Moment préféré</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { v: "Matin", icon: Sun },
                          { v: "Après-midi", icon: Sunset },
                          { v: "Peu importe", icon: Calendar }
                        ] as { v: MomentPrefere; icon: any }[]).map(({ v, icon: Icon }) => (
                          <button key={v} type="button" onClick={() => setMoment(v)}
                            className={`py-3 rounded-lg text-xs font-bold flex flex-col items-center gap-1 transition-colors ${moment === v ? "bg-primary-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}`}>
                            <Icon className="w-4 h-4" />
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {medecins.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">Médecin (facultatif)</label>
                        <select value={selectedMedecin} onChange={(e) => setSelectedMedecin(e.target.value)}
                          className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-base">
                          <option value="">Peu importe</option>
                          {medecins.map((m) => (
                            <option key={m.id} value={m.id}>{m.nom}{m.specialite ? ` (${m.specialite})` : ""}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-stone-600 mb-2">Motif</label>
                      <textarea value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300}
                        placeholder="Ex : fièvre depuis 3 jours, consultation prénatale, contrôle…"
                        className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-base min-h-[80px] resize-none" />
                    </div>
                  </div>

                  <div className="bg-warning-50 border border-warning-200 rounded-xl p-3 text-xs text-warning-900 flex gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>En cas d'urgence, ne prenez pas rendez-vous : venez directement au cabinet ou appelez-nous.</span>
                  </div>

                  <button type="submit" disabled={isSubmittingBooking || !firebaseConnected}
                    className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white py-4 rounded-lg font-bold shadow-md active:scale-95 transition-transform flex items-center justify-center gap-2">
                    {isSubmittingBooking && <Loader2 className="w-4 h-4 animate-spin" />}
                    Envoyer ma demande
                  </button>
                </form>
              )}
            </div>
          )}

          {/* MES RDV */}
          {isIdentified && activeView === "my_appointments" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-800">Mes rendez-vous</h2>

              {isLoadingAppointments ? (
                <div className="flex items-center justify-center py-12 text-stone-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Chargement…</span>
                </div>
              ) : myAppointments.length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-3">
                  <Calendar className="w-12 h-12 text-stone-300 mx-auto" />
                  <p className="text-sm font-semibold text-stone-500">Aucune demande pour le moment.</p>
                  <button onClick={() => setActiveView("booking")} className="mt-2 text-primary-600 text-sm font-bold hover:underline">
                    Demander un rendez-vous
                  </button>
                </div>
              ) : (
                <>
                  {upcoming.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">À venir</h3>
                      {[...upcoming].reverse().map((a) => renderAppointment(a, true))}
                    </div>
                  )}
                  {past.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-stone-500">Historique</h3>
                      {past.map((a) => renderAppointment(a, false))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ClinicContact() {
  return (
    <div className="bg-white p-4 rounded-2xl border border-stone-200 space-y-3">
      <p className="text-xs text-stone-600 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-primary-600 flex-shrink-0" />
        {CLINIC.adresse}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CLINIC.telephones.map((t) => (
          <a key={t} href={`tel:+226${t.replace(/\s/g, "")}`}
            className="flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 rounded-lg py-2.5 text-xs font-bold text-stone-800">
            <Phone className="w-4 h-4 text-primary-600" />
            {t}
          </a>
        ))}
      </div>
    </div>
  );
}
