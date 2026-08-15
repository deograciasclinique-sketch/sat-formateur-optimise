import React, { useState, useEffect } from "react";
import { generateUid, getTodayStr } from "../data";
import { RendezVous, Staff } from "../types";
import { db } from "../lib/firebase";
import { subscribeToCloudKey, pushToCloudKey } from "../lib/liveSync";
import { Calendar, Clock, User, Phone, CheckCircle2, ChevronLeft, CalendarPlus, FileText, ChevronRight, Activity, Stethoscope } from "lucide-react";

export default function PatientMobilePortal() {
  const [activeView, setActiveView] = useState<"home" | "booking" | "my_appointments">("home");
  const [appointments, setAppointments] = useState<RendezVous[]>([]);
  const [medecins, setMedecins] = useState<Staff[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);

  // Form state
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [selectedMedecin, setSelectedMedecin] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [motif, setMotif] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);

  useEffect(() => {
    // Charge d'abord ce qui est déjà en cache local sur ce téléphone (affichage instantané)
    const savedAppts = localStorage.getItem("dg_rdv");
    if (savedAppts) {
      try {
        setAppointments(JSON.parse(savedAppts));
      } catch (e) {
        console.error("Error loading appointments", e);
      }
    }
    const savedStaff = localStorage.getItem("dg_staff");
    if (savedStaff) {
      try {
        const staffList: Staff[] = JSON.parse(savedStaff);
        setMedecins(staffList.filter(s => (s.poste || "").toLowerCase().includes("médecin") || (s.poste || "").toLowerCase().includes("docteur") || (s.poste || "").toLowerCase().includes("spécialiste")));
      } catch (e) {
        console.error("Error loading staff", e);
      }
    }

    // Puis se connecte au cloud pour récupérer les données à jour de la clinique,
    // et rester à l'écoute des changements en temps réel (même clé "dg_rdv" et
    // "dg_staff" que l'app principale, pour que tout soit bien synchronisé).
    if (!db) {
      setIsSyncing(false);
      return;
    }

    const unsubRdv = subscribeToCloudKey("dg_rdv", (remoteData) => {
      if (Array.isArray(remoteData)) {
        setAppointments(remoteData);
        localStorage.setItem("dg_rdv", JSON.stringify(remoteData));
      }
      setIsSyncing(false);
    });

    // Le personnel utilise un circuit cloud dédié distinct (dg_staff_cloud/global_list),
    // on récupère donc la liste à jour directement depuis là.
    db.collection("dg_staff_cloud").doc("global_list").get()
      .then((docSnap: any) => {
        if (docSnap.exists) {
          const cloudData = docSnap.data();
          if (cloudData && Array.isArray(cloudData.staff)) {
            const staffList: Staff[] = cloudData.staff;
            localStorage.setItem("dg_staff", JSON.stringify(staffList));
            setMedecins(staffList.filter(s => (s.poste || "").toLowerCase().includes("médecin") || (s.poste || "").toLowerCase().includes("docteur") || (s.poste || "").toLowerCase().includes("spécialiste")));
          }
        }
      })
      .catch(() => {
        // Hors-ligne ou erreur : on garde la liste déjà chargée depuis le cache local.
      });

    return () => {
      unsubRdv();
    };
  }, []);

  const handleBookAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !patientPhone.trim() || !selectedDate || !selectedTime) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    const newAppt: RendezVous = {
      id: generateUid(),
      patient: patientName,
      contact: patientPhone,
      date: selectedDate,
      heure: selectedTime,
      praticien: selectedMedecin || "",
      notes: "",
      motif: motif,
      statut: "Planifié",
      type: "En ligne",
      createdAt: new Date().toISOString()
    };

    const updatedAppointments = [...appointments, newAppt];
    setAppointments(updatedAppointments);
    // Sauvegarde locale immédiate (pour un affichage instantané même hors-ligne)...
    localStorage.setItem("dg_rdv", JSON.stringify(updatedAppointments));
    // ...puis envoi vers le cloud pour que la clinique le voie en temps réel.
    pushToCloudKey("dg_rdv", updatedAppointments).catch(() => {
      // Hors-ligne : le RDV reste enregistré localement et sera synchronisé
      // dès que la connexion reviendra et que l'app sera rouverte.
    });

    setBookingSuccess(true);
    
    // Reset form after success
    setTimeout(() => {
      setBookingSuccess(false);
      setActiveView("my_appointments");
      setSelectedDate("");
      setSelectedTime("");
      setMotif("");
    }, 2000);
  };

  const getMyUpcomingAppointments = () => {
    // Simple filter based on exact name match (in a real app, this would use a user ID/Auth)
    if (!patientName.trim()) return [];
    const today = getTodayStr();
    return appointments
      .filter(a => a.patient.toLowerCase() === patientName.toLowerCase() && a.date >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const timeSlots = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans selection:bg-primary-500/30 sm:bg-stone-200 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative overflow-hidden flex flex-col">
        
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
              <div className="w-10"></div> // Spacer
            )}
            <h1 className="text-lg font-serif font-bold tracking-wide flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-300" />
              Espace Patient
            </h1>
            <div className="w-10 flex justify-end">
              <button 
                onClick={() => window.close()} 
                className="text-primary-200 hover:text-white text-xs font-bold uppercase"
              >
                Quitter
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 bg-stone-50">
          
          {/* HOME VIEW */}
          {activeView === "home" && (
            <div className="space-y-6">
              {/* Login / Profile block */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
                <h2 className="text-sm font-bold text-stone-800 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary-600" />
                  Identification Rapide
                </h2>
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
                      placeholder="Ex: 01 23 45 67 89"
                      className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Action Grid */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    if (!patientName || !patientPhone) {
                      alert("Veuillez d'abord renseigner votre nom et téléphone.");
                      return;
                    }
                    setActiveView("booking");
                  }}
                  className="bg-primary-600 hover:bg-primary-700 text-white p-5 rounded-2xl shadow-md transition-transform active:scale-95 flex flex-col items-center justify-center gap-3 text-center"
                >
                  <CalendarPlus className="w-8 h-8" />
                  <span className="text-sm font-bold">Prendre RDV</span>
                </button>
                <button 
                  onClick={() => {
                    if (!patientName) {
                      alert("Veuillez d'abord renseigner votre nom pour voir vos rendez-vous.");
                      return;
                    }
                    setActiveView("my_appointments");
                  }}
                  className="bg-white hover:bg-stone-50 text-stone-800 p-5 rounded-2xl shadow-sm border border-stone-200 transition-transform active:scale-95 flex flex-col items-center justify-center gap-3 text-center"
                >
                  <Calendar className="w-8 h-8 text-primary-600" />
                  <span className="text-sm font-bold">Mes RDV</span>
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
          {activeView === "booking" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-800">Nouveau Rendez-vous</h2>
              
              {bookingSuccess ? (
                <div className="bg-success-50 p-8 rounded-2xl border border-success-200 flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <CheckCircle2 className="w-16 h-16 text-success-500" />
                  <div>
                    <h3 className="text-lg font-bold text-success-900">Réservé avec succès !</h3>
                    <p className="text-sm text-success-700 mt-2">Votre rendez-vous a été confirmé.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBookAppointment} className="space-y-4">
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 space-y-4">
                    
                    {medecins.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-stone-600 mb-2">Médecin (Optionnel)</label>
                        <select 
                          value={selectedMedecin}
                          onChange={(e) => setSelectedMedecin(e.target.value)}
                          className="w-full p-3 bg-stone-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-sm appearance-none"
                        >
                          <option value="">Peu importe le médecin</option>
                          {medecins.map(m => (
                            <option key={m.id} value={m.id}>Dr. {m.nom} ({m.poste})</option>
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
                        {timeSlots.map(time => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => setSelectedTime(time)}
                            className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                              selectedTime === time 
                                ? "bg-primary-600 text-white" 
                                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                            }`}
                          >
                            {time}
                          </button>
                        ))}
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
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-4 rounded-lg font-bold shadow-md transition-transform active:scale-95"
                  >
                    Confirmer le Rendez-vous
                  </button>
                </form>
              )}
            </div>
          )}

          {/* MY APPOINTMENTS VIEW */}
          {activeView === "my_appointments" && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-stone-800">Vos Rendez-vous</h2>
              
              {getMyUpcomingAppointments().length === 0 ? (
                <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-3">
                  <Calendar className="w-12 h-12 text-stone-300 mx-auto" />
                  <p className="text-sm font-semibold text-stone-500">Aucun rendez-vous à venir.</p>
                  <button 
                    onClick={() => setActiveView("booking")}
                    className="mt-4 text-primary-600 text-sm font-bold hover:underline"
                  >
                    Prendre un rendez-vous
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {getMyUpcomingAppointments().map((appt, idx) => {
                    const medecin = medecins.find(m => m.id === appt.praticien);
                    return (
                      <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-stone-200 flex items-start gap-4">
                        <div className="bg-primary-50 text-primary-700 p-3 rounded-xl flex flex-col items-center justify-center min-w-[70px]">
                          <span className="text-xs font-bold uppercase">{new Date(appt.date).toLocaleDateString("fr-FR", { month: "short" })}</span>
                          <span className="text-xl font-black leading-none my-0.5">{new Date(appt.date).getDate()}</span>
                          <span className="text-xs font-bold">{appt.heure}</span>
                        </div>
                        <div className="flex-1 py-1">
                          <h4 className="text-sm font-bold text-stone-800">{appt.motif || "Consultation médicale"}</h4>
                          {medecin && (
                            <p className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                              <User className="w-3 h-3" /> Dr. {medecin.nom}
                            </p>
                          )}
                          <div className="mt-2 inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold bg-warning-100 text-warning-800">
                            {appt.statut}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
