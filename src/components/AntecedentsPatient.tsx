/**
 * Antécédents du patient (interrogatoire) — consultation générale.
 * À recueillir AVANT de demander les examens biologiques, pour mieux orienter le diagnostic.
 */
import React from "react";
import { History } from "lucide-react";
import type { AntecedentsPatient } from "../types";

export const ANTECEDENTS_VIDES: AntecedentsPatient = {
  medicaux: [], medicauxAutres: "", chirurgicaux: "", gynecoObstetricaux: "",
  familiaux: [], familiauxAutres: "", allergies: "", traitements: "", modeDeVie: [], vaccination: "",
};

const MEDICAUX = [
  "HTA", "Diabète", "Drépanocytose", "Asthme", "Épilepsie", "Cardiopathie", "Ulcère / gastrite",
  "Insuffisance rénale", "Hépatite B / C", "Tuberculose", "VIH", "Paludisme à répétition",
  "Paludisme récent (< 1 mois)", "Hospitalisation récente", "Transfusion antérieure",
];
const FAMILIAUX = ["HTA", "Diabète", "Drépanocytose", "Asthme", "Cancer", "Cardiopathie", "Tuberculose dans l'entourage"];
const MODE_DE_VIE = ["Tabac", "Alcool", "Automédication", "Tradithérapie", "Sédentarité"];

/** Résumé texte (dossier, PDF, assistant IA). Vide si rien n'a été renseigné. */
export function resumeAntecedents(a?: AntecedentsPatient | null): string {
  if (!a) return "";
  const l: string[] = [];
  const med = [...(a.medicaux || []), a.medicauxAutres?.trim()].filter(Boolean);
  if (med.length) l.push(`Médicaux : ${med.join(", ")}`);
  if (a.chirurgicaux?.trim()) l.push(`Chirurgicaux : ${a.chirurgicaux.trim()}`);
  if (a.gynecoObstetricaux?.trim()) l.push(`Gynéco-obstétricaux : ${a.gynecoObstetricaux.trim()}`);
  const fam = [...(a.familiaux || []), a.familiauxAutres?.trim()].filter(Boolean);
  if (fam.length) l.push(`Familiaux : ${fam.join(", ")}`);
  if (a.allergies?.trim()) l.push(`Allergies : ${a.allergies.trim()}`);
  if (a.traitements?.trim()) l.push(`Traitements en cours : ${a.traitements.trim()}`);
  if (a.modeDeVie?.length) l.push(`Mode de vie : ${a.modeDeVie.join(", ")}`);
  if (a.vaccination?.trim()) l.push(`Vaccination : ${a.vaccination.trim()}`);
  return l.join("\n");
}

export function antecedentsRenseignes(a?: AntecedentsPatient | null): boolean {
  return resumeAntecedents(a).length > 0;
}

function Puces({ options, valeurs, onChange, couleur }: { options: string[]; valeurs: string[]; onChange: (v: string[]) => void; couleur: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => {
        const actif = valeurs.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(actif ? valeurs.filter((x) => x !== o) : [...valeurs, o])}
            className={`text-2xs font-bold px-2 py-1 rounded-full border transition-all cursor-pointer ${actif ? couleur : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"}`}
          >
            {actif ? "✓ " : ""}{o}
          </button>
        );
      })}
    </div>
  );
}

const champ = "w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500";
const etiquette = "text-2xs uppercase font-bold tracking-wider text-stone-500 block mb-1";

export default function AntecedentsEditeur({
  valeur, onChange, feminin, precedent, onReprendre,
}: {
  valeur: AntecedentsPatient;
  onChange: (a: AntecedentsPatient) => void;
  feminin: boolean;
  /** Antécédents de la dernière visite de ce patient, s'il en a. */
  precedent?: { date: string; antecedents: AntecedentsPatient } | null;
  onReprendre?: () => void;
}) {
  const maj = (champ: Partial<AntecedentsPatient>) => onChange({ ...valeur, ...champ });
  return (
    <div className="bg-violet-50/60 p-3 rounded-xl border border-violet-200 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs uppercase font-semibold tracking-wider text-violet-800 flex items-center gap-1">
          <History className="w-3.5 h-3.5" /> Antécédents du patient (interrogatoire)
        </span>
        {precedent && onReprendre && (
          <button type="button" onClick={onReprendre} className="text-2xs font-bold text-violet-700 border border-violet-300 bg-white rounded-lg px-2 py-1 cursor-pointer">
            ↺ Reprendre ceux du {new Date(precedent.date).toLocaleDateString("fr-FR")}
          </button>
        )}
      </div>
      <p className="text-2xs text-violet-700">À demander au patient avant de prescrire les examens biologiques.</p>

      <div>
        <label className={etiquette}>Antécédents médicaux personnels</label>
        <Puces options={MEDICAUX} valeurs={valeur.medicaux} onChange={(v) => maj({ medicaux: v })} couleur="bg-primary-700 border-primary-700 text-white" />
        <input className={`${champ} mt-1.5`} placeholder="Autres antécédents médicaux…" value={valeur.medicauxAutres} onChange={(e) => maj({ medicauxAutres: e.target.value })} />
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className={etiquette}>Antécédents chirurgicaux</label>
          <input className={champ} placeholder="Ex : appendicectomie 2019, césarienne…" value={valeur.chirurgicaux} onChange={(e) => maj({ chirurgicaux: e.target.value })} />
        </div>
        <div>
          <label className={etiquette}>Allergies connues</label>
          <input className={champ} placeholder="Ex : pénicilline, sulfamides… ou « aucune »" value={valeur.allergies} onChange={(e) => maj({ allergies: e.target.value })} />
        </div>
        <div>
          <label className={etiquette}>Traitements en cours / déjà pris pour cette maladie</label>
          <input className={champ} placeholder="Ex : paracétamol, artéméther depuis 2 jours…" value={valeur.traitements} onChange={(e) => maj({ traitements: e.target.value })} />
        </div>
        <div>
          <label className={etiquette}>Vaccination</label>
          <input className={champ} placeholder="Ex : à jour, carnet absent, VAT…" value={valeur.vaccination} onChange={(e) => maj({ vaccination: e.target.value })} />
        </div>
        {feminin && (
          <div className="sm:col-span-2">
            <label className={etiquette}>Gynéco-obstétricaux</label>
            <input className={champ} placeholder="Ex : G3P2, DDR 02/10, contraception, avortements…" value={valeur.gynecoObstetricaux} onChange={(e) => maj({ gynecoObstetricaux: e.target.value })} />
          </div>
        )}
      </div>

      <div>
        <label className={etiquette}>Antécédents familiaux</label>
        <Puces options={FAMILIAUX} valeurs={valeur.familiaux} onChange={(v) => maj({ familiaux: v })} couleur="bg-info-600 border-info-600 text-white" />
        <input className={`${champ} mt-1.5`} placeholder="Autres antécédents familiaux…" value={valeur.familiauxAutres} onChange={(e) => maj({ familiauxAutres: e.target.value })} />
      </div>

      <div>
        <label className={etiquette}>Mode de vie</label>
        <Puces options={MODE_DE_VIE} valeurs={valeur.modeDeVie} onChange={(v) => maj({ modeDeVie: v })} couleur="bg-warning-600 border-warning-600 text-white" />
      </div>
    </div>
  );
}
