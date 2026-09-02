/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Consultation, Facture, FactureLigne } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, UserPlus, Wallet, ArrowRight, Clock, CheckCircle2 } from "lucide-react";

interface TabAccueilCaisseProps {
  consultations: Consultation[];
  onUpdateConsultations: (consults: Consultation[]) => void;
  factures: Facture[];
  onUpdateFactures: (factures: Facture[]) => void;
  theme?: "light" | "dark";
}

// Écran secrétariat, étape 1 : le patient arrive, on l'enregistre (identité de
// base) et on encaisse le prix de la consultation. Une fois payé, le dossier
// est envoyé à l'infirmier (statut "Attente prise en charge infirmier").
// Le reste du dossier (constantes, diagnostic, prescription) est complété
// plus loin dans le circuit par l'infirmier puis le médecin.
export default function TabAccueilCaisse({
  consultations,
  onUpdateConsultations,
  factures,
  onUpdateFactures,
  theme = "light",
}: TabAccueilCaisseProps) {
  const [patient, setPatient] = useState("");
  const [age, setAge] = useState("");
  const [sexe, setSexe] = useState<"Masculin" | "Féminin">("Masculin");
  const [contact, setContact] = useState("");
  const [commune, setCommune] = useState("");
  const [montant, setMontant] = useState("2000");
  const [modePaiement, setModePaiement] = useState("Espèces");

  const isDark = theme === "dark";

  const enAttentePaiementConsult = useMemo(
    () => consultations.filter((c) => c.statut === "Attente paiement consultation"),
    [consultations]
  );

  const dejaEnvoyesAujourdhui = useMemo(
    () =>
      consultations.filter(
        (c) => c.date === getTodayStr() && c.statut && c.statut !== "Attente paiement consultation"
      ),
    [consultations]
  );

  const resetForm = () => {
    setPatient("");
    setAge("");
    setSexe("Masculin");
    setContact("");
    setCommune("");
    setMontant("2000");
  };

  // Enregistrement + paiement en une seule action : le patient quitte le
  // secrétariat directement vers la salle des infirmiers une fois payé.
  const handleEnregistrerEtEncaisser = () => {
    if (!patient.trim()) {
      alert("Veuillez renseigner le nom du patient.");
      return;
    }
    const montantNum = parseFloat(montant) || 0;
    if (montantNum <= 0) {
      alert("Veuillez renseigner un montant de consultation valide.");
      return;
    }

    const newCons: Consultation = {
      id: generateUid(),
      patient: patient.trim(),
      age: parseFloat(age) || 0,
      sexe,
      contact: contact.trim(),
      commune: commune.trim(),
      date: getTodayStr(),
      statut: "Attente prise en charge infirmier",
      montantConsultation: montantNum,
      vitals: {
        temperature: 0,
        poids: 0,
        tensionArterielle: "",
        pouls: 0,
        glycemie: 0,
      },
      plainte: "",
      diagnostic: "",
      ordonnance: [],
      createdAt: new Date().toISOString(),
    };

    const ligne: FactureLigne = {
      id: generateUid(),
      designation: `Consultation - ${newCons.patient}`,
      qte: 1,
      prix: montantNum,
      montant: montantNum,
    };
    const newFacture: Facture = {
      id: generateUid(),
      patient: newCons.patient,
      date: getTodayStr(),
      mode: modePaiement,
      lignes: [ligne],
      total: montantNum,
      montantPaye: montantNum,
      statut: "Payée",
      createdAt: new Date().toISOString(),
      consultationId: newCons.id,
      typePaiement: "Consultation",
    };

    onUpdateConsultations([newCons, ...consultations]);
    onUpdateFactures([newFacture, ...factures]);
    resetForm();
  };

  return (
    <div className={`p-4 space-y-6 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Accueil & Caisse — Nouveau patient
        </h2>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Enregistrement du patient et paiement de la consultation. Le dossier est envoyé à
          l'infirmier une fois le paiement encaissé.
        </p>
      </div>

      <div
        className={`rounded-lg border p-4 space-y-3 ${
          isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Nom du patient *</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={patient}
              onChange={(e) => setPatient(e.target.value)}
              placeholder="Nom et prénoms"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Contact</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Téléphone"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Âge</label>
            <input
              type="number"
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Sexe</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={sexe}
              onChange={(e) => setSexe(e.target.value as "Masculin" | "Féminin")}
            >
              <option value="Masculin">Masculin</option>
              <option value="Féminin">Féminin</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Commune / Village</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Mode de paiement</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={modePaiement}
              onChange={(e) => setModePaiement(e.target.value)}
            >
              <option value="Espèces">Espèces</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Assurance">Assurance</option>
            </select>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium">Montant consultation (FCFA) *</label>
            <input
              type="number"
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
            />
          </div>
          <button
            onClick={handleEnregistrerEtEncaisser}
            className="px-4 py-2 rounded bg-emerald-600 text-white font-medium flex items-center gap-2 hover:bg-emerald-700"
          >
            <Wallet className="w-4 h-4" /> Encaisser & envoyer à l'infirmier
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4" /> En attente (aujourd'hui)
        </h3>
        {dejaEnvoyesAujourdhui.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Aucun patient envoyé pour l'instant aujourd'hui.
          </p>
        ) : (
          <div className="space-y-2">
            {dejaEnvoyesAujourdhui.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-3 py-2 rounded border ${
                  isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
                }`}
              >
                <span className="font-medium">{c.patient}</span>
                <span className="text-xs flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {c.statut}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
