/**
 * Fin de prise en charge en salle infirmier, pour un patient envoyé par le
 * médecin (ou dont les actes ont été payés) :
 *  - Exéat : sortie du patient (date, heure, état / conseils, agent) ;
 *  - Orienter ailleurs : renvoi au médecin, observation, hospitalisation,
 *    urgences ou autre service.
 */

import React, { useState } from "react";
import { X, LogOut, ArrowRightLeft } from "lucide-react";
import { Consultation } from "../types";

const inputCls = "w-full mt-1 px-3 py-2 rounded border bg-transparent";
const pad = (n: number) => String(n).padStart(2, "0");
const aujourdHui = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const maintenant = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function Cadre({ isDark, titre, icone, onFermer, children }: {
  isDark: boolean; titre: string; icone: React.ReactNode; onFermer: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onFermer}>
      <div
        className={`w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 ${isDark ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold flex items-center gap-2">{icone} {titre}</h3>
          <button onClick={onFermer} className={`p-1.5 rounded ${isDark ? "text-gray-400" : "text-gray-500"}`} aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export interface DonneesExeat {
  date: string;
  heure: string;
  agentNom: string;
  observations?: string;
  programmerRdv: boolean;
}

export function ModalExeat({ consultation, nbSoins, agentNom, isDark, onAnnuler, onValider }: {
  consultation: Consultation;
  nbSoins: number;
  agentNom: string;
  isDark: boolean;
  onAnnuler: () => void;
  onValider: (d: DonneesExeat) => void;
}) {
  const [date, setDate] = useState(aujourdHui());
  const [heure, setHeure] = useState(maintenant());
  const [observations, setObservations] = useState("");
  const [agent, setAgent] = useState(agentNom);
  const [rdv, setRdv] = useState(false);
  const [erreur, setErreur] = useState("");
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const bord = isDark ? "border-gray-700" : "border-gray-200";

  const valider = () => {
    if (!agent.trim()) return setErreur("Indiquez le nom de l'agent qui prononce l'exéat.");
    if (nbSoins === 0 && !window.confirm("Aucun soin n'a été noté pour ce patient dans la Salle des soins.\nPrononcer quand même l'exéat ?")) return;
    onValider({ date, heure, agentNom: agent.trim(), observations: observations.trim() || undefined, programmerRdv: rdv });
  };

  return (
    <Cadre isDark={isDark} titre={`Exéat — ${consultation.patient}`} icone={<LogOut className="w-5 h-5 text-emerald-600" />} onFermer={onAnnuler}>
      <p className={`text-sm mb-3 ${muted}`}>
        Sortie du patient après les soins. {nbSoins > 0 ? `${nbSoins} soin(s) noté(s) pour ce dossier.` : "Aucun soin noté pour ce dossier."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm font-semibold">Date<input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="text-sm font-semibold">Heure<input type="time" className={inputCls} value={heure} onChange={(e) => setHeure(e.target.value)} /></label>
      </div>
      <label className="block text-sm font-semibold mt-3">
        État du patient à la sortie / conseils
        <textarea className={inputCls + " min-h-[90px]"} value={observations} onChange={(e) => setObservations(e.target.value)}
          placeholder="Ex. : apyrétique, état général conservé. Poursuivre le traitement oral à domicile, revenir si fièvre…" />
      </label>
      <label className="block text-sm font-semibold mt-3">
        Exéat prononcé par
        <input className={inputCls} value={agent} onChange={(e) => setAgent(e.target.value)} placeholder="Nom de l'agent" />
      </label>
      <label className={`mt-3 flex items-center gap-2 text-sm rounded-lg border p-2.5 ${bord}`}>
        <input type="checkbox" className="w-5 h-5" checked={rdv} onChange={(e) => setRdv(e.target.checked)} />
        Programmer un rendez-vous de contrôle
      </label>
      {erreur && <p className="text-sm text-red-600 font-semibold mt-3">{erreur}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={onAnnuler} className={`flex-1 rounded-lg border px-4 py-2.5 font-semibold ${bord}`}>Annuler</button>
        <button onClick={valider} className="flex-[2] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 font-semibold">Valider l'exéat</button>
      </div>
    </Cadre>
  );
}

export type ChoixOrientation = "medecin" | "Mise en observation" | "Hospitalisation" | "Admission aux urgences" | "autre";

export function ModalOrienter({ consultation, isDark, onAnnuler, onValider }: {
  consultation: Consultation;
  isDark: boolean;
  onAnnuler: () => void;
  onValider: (choix: ChoixOrientation, service: string, motif: string) => void;
}) {
  const [choix, setChoix] = useState<ChoixOrientation>("medecin");
  const [service, setService] = useState("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const bord = isDark ? "border-gray-700" : "border-gray-200";
  const options: [ChoixOrientation, string, string][] = [
    ["medecin", "↩️ Renvoyer au médecin", "Le dossier retourne en « Attente consultation médecin »."],
    ["Mise en observation", "🛏️ Mise en observation", "Un dossier est créé en Hospitalisation (Observation)."],
    ["Hospitalisation", "🏥 Hospitalisation", "Un dossier est créé en Hospitalisation."],
    ["Admission aux urgences", "🚨 Admettre aux urgences", "Un dossier est créé aux Urgences."],
    ["autre", "↗️ Autre service", "Maternité, laboratoire, CMA, chirurgie…"],
  ];

  const valider = () => {
    if (choix === "autre" && !service.trim()) return setErreur("Indiquez le service de destination.");
    onValider(choix, service.trim(), motif.trim());
  };

  return (
    <Cadre isDark={isDark} titre={`Orienter — ${consultation.patient}`} icone={<ArrowRightLeft className="w-5 h-5 text-sky-600" />} onFermer={onAnnuler}>
      <div className="space-y-2">
        {options.map(([v, label, aide]) => (
          <label key={v} className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer ${choix === v ? "border-emerald-500" : bord}`}>
            <input type="radio" name="orientation" className="mt-1 w-4 h-4" checked={choix === v} onChange={() => setChoix(v)} />
            <span className="text-sm"><b>{label}</b><span className={`block text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>{aide}</span></span>
          </label>
        ))}
      </div>
      {choix === "autre" && (
        <label className="block text-sm font-semibold mt-3">
          Service de destination
          <input className={inputCls} value={service} onChange={(e) => setService(e.target.value)} placeholder="Ex. : Maternité, CMA…" />
        </label>
      )}
      <label className="block text-sm font-semibold mt-3">
        Motif <span className="font-normal opacity-70">(facultatif)</span>
        <textarea className={inputCls + " min-h-[70px]"} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. : aggravation, réaction au produit, avis médical nécessaire…" />
      </label>
      {erreur && <p className="text-sm text-red-600 font-semibold mt-3">{erreur}</p>}
      <div className="flex gap-2 mt-4">
        <button onClick={onAnnuler} className={`flex-1 rounded-lg border px-4 py-2.5 font-semibold ${bord}`}>Annuler</button>
        <button onClick={valider} className="flex-[2] rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 font-semibold">Valider l'orientation</button>
      </div>
    </Cadre>
  );
}
