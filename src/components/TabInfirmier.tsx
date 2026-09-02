/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Consultation } from "../types";
import { Activity, ArrowRight, Stethoscope, Syringe, CheckCircle2 } from "lucide-react";

interface TabInfirmierProps {
  consultations: Consultation[];
  onUpdateConsultations: (consults: Consultation[]) => void;
  theme?: "light" | "dark";
}

// Écran infirmier : liste des patients dont la consultation a été payée au
// secrétariat et qui attendent la prise des constantes / complément d'état
// civil. Une fois enregistré, le dossier passe au médecin.
export default function TabInfirmier({ consultations, onUpdateConsultations, theme = "light" }: TabInfirmierProps) {
  const isDark = theme === "dark";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [profession, setProfession] = useState("");
  const [villageSecteur, setVillageSecteur] = useState("");
  const [temperature, setTemperature] = useState("");
  const [poids, setPoids] = useState("");
  const [taille, setTaille] = useState("");
  const [ta, setTa] = useState("");
  const [pouls, setPouls] = useState("");
  const [glycemie, setGlycemie] = useState("");
  const [plainte, setPlainte] = useState("");

  const enAttente = useMemo(
    () => consultations.filter((c) => c.statut === "Attente prise en charge infirmier"),
    [consultations]
  );

  // Dossiers dont les actes prescrits ont été payés au secrétariat : les
  // soins à faire dans la salle infirmier (hors examens labo, gérés dans
  // l'onglet Laboratoire) sont exécutés ici.
  const actesAExecuter = useMemo(
    () => consultations.filter((c) => c.statut === "Attente exécution actes"),
    [consultations]
  );

  const handleMarquerSoinsExecutes = (c: Consultation) => {
    onUpdateConsultations(
      consultations.map((cons) => (cons.id === c.id ? { ...cons, statut: "Terminée" } : cons))
    );
  };

  const selected = consultations.find((c) => c.id === selectedId) || null;

  const openPatient = (c: Consultation) => {
    setSelectedId(c.id);
    setProfession(c.profession || "");
    setVillageSecteur(c.villageSecteur || "");
    setTemperature(c.vitals?.temperature ? String(c.vitals.temperature) : "");
    setPoids(c.vitals?.poids ? String(c.vitals.poids) : "");
    setTaille(c.vitals?.taille ? String(c.vitals.taille) : "");
    setTa(c.vitals?.tensionArterielle || "");
    setPouls(c.vitals?.pouls ? String(c.vitals.pouls) : "");
    setGlycemie(c.vitals?.glycemie ? String(c.vitals.glycemie) : "");
    setPlainte(c.plainte || "");
  };

  const handleEnvoyerAuMedecin = () => {
    if (!selected) return;
    if (!plainte.trim()) {
      alert("Veuillez renseigner le motif de consultation.");
      return;
    }
    const weightNum = parseFloat(poids) || 0;
    const heightNum = parseFloat(taille) || 0;
    let imc: number | undefined = undefined;
    if (weightNum > 0 && heightNum > 0) {
      const heightM = heightNum / 100;
      imc = parseFloat((weightNum / (heightM * heightM)).toFixed(2));
    }

    const updated: Consultation = {
      ...selected,
      profession: profession.trim(),
      villageSecteur: villageSecteur.trim(),
      plainte: plainte.trim(),
      vitals: {
        temperature: parseFloat(temperature) || 0,
        poids: weightNum,
        tensionArterielle: ta.trim(),
        pouls: parseFloat(pouls) || 0,
        glycemie: parseFloat(glycemie) || 0,
        taille: heightNum || undefined,
        imc,
      },
      statut: "Attente consultation médecin",
    };

    onUpdateConsultations(consultations.map((c) => (c.id === selected.id ? updated : c)));
    setSelectedId(null);
  };

  return (
    <div className={`p-4 grid grid-cols-1 md:grid-cols-3 gap-4 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
      <div className="md:col-span-1 space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5" /> Patients à prendre en charge
        </h2>
        {enAttente.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Aucun patient en attente pour le moment.
          </p>
        ) : (
          enAttente.map((c) => (
            <button
              key={c.id}
              onClick={() => openPatient(c)}
              className={`w-full text-left px-3 py-2 rounded border transition ${
                selectedId === c.id
                  ? "border-emerald-500 bg-emerald-500/10"
                  : isDark
                  ? "border-gray-700 bg-gray-800 hover:bg-gray-700"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="font-medium">{c.patient}</div>
              <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                {c.age ? `${c.age} ans` : ""} {c.contact ? `· ${c.contact}` : ""}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="md:col-span-2">
        {!selected ? (
          <div className={`h-full flex items-center justify-center text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Sélectionnez un patient pour saisir ses constantes.
          </div>
        ) : (
          <div className={`rounded-lg border p-4 space-y-4 ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
            <h3 className="font-semibold text-lg">{selected.patient}</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Profession</label>
                <input className="w-full mt-1 px-3 py-2 rounded border bg-transparent" value={profession} onChange={(e) => setProfession(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Village / Secteur</label>
                <input className="w-full mt-1 px-3 py-2 rounded border bg-transparent" value={villageSecteur} onChange={(e) => setVillageSecteur(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Motif de consultation *</label>
              <textarea className="w-full mt-1 px-3 py-2 rounded border bg-transparent" rows={2} value={plainte} onChange={(e) => setPlainte(e.target.value)} />
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Constantes</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs">Température (°C)</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Poids (kg)</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={poids} onChange={(e) => setPoids(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Taille (cm)</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={taille} onChange={(e) => setTaille(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Tension artérielle</label>
                  <input className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={ta} onChange={(e) => setTa(e.target.value)} placeholder="12/8" />
                </div>
                <div>
                  <label className="text-xs">Pouls (bpm)</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={pouls} onChange={(e) => setPouls(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Glycémie</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={glycemie} onChange={(e) => setGlycemie(e.target.value)} />
                </div>
              </div>
            </div>

            <button
              onClick={handleEnvoyerAuMedecin}
              className="px-4 py-2 rounded bg-blue-600 text-white font-medium flex items-center gap-2 hover:bg-blue-700"
            >
              <Stethoscope className="w-4 h-4" /> Envoyer au médecin <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Actes payés en attente d'exécution (soins prescrits par le médecin,
          hors examens labo qui se gèrent dans l'onglet Laboratoire). */}
      {actesAExecuter.length > 0 && (
        <div className="md:col-span-3 space-y-2 pt-4 border-t border-dashed">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Syringe className="w-5 h-5" /> Soins à exécuter (actes payés)
          </h2>
          <div className="space-y-2">
            {actesAExecuter.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-3 py-2 rounded border ${
                  isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
                }`}
              >
                <div>
                  <div className="font-medium">{c.patient}</div>
                  <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {(c.ordonnance || []).length > 0
                      ? `${c.ordonnance.length} ligne(s) d'ordonnance à exécuter`
                      : "Aucun soin à exécuter (voir Laboratoire pour les examens)"}
                  </div>
                </div>
                <button
                  onClick={() => handleMarquerSoinsExecutes(c)}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" /> Soins exécutés
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
