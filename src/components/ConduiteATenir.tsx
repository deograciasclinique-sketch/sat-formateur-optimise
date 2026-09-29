/**
 * Conduite à tenir (CAT) décidée après le diagnostic de certitude, avant la
 * rédaction de l'ordonnance : traitement par voie orale, soins infirmiers à
 * réaliser, surveillance, examens, conseils…
 */

import React, { useState } from "react";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { ConduiteItem } from "../types";
import { generateUid } from "../data";

export const TYPES_CAT: { value: string; label: string; emoji: string; placeholder: string; suggestions: string[] }[] = [
  {
    value: "Voie orale", label: "Voie orale", emoji: "💊",
    placeholder: "Ex. Artéméther-luméfantrine 80/480 mg : 1 cp matin et soir pendant 3 jours, au cours du repas",
    suggestions: ["Prendre les comprimés au cours du repas", "Traitement de 3 jours à terminer même si la fièvre disparaît", "Paracétamol 1 g si fièvre, 3 fois par jour au maximum"],
  },
  {
    value: "Soins infirmiers", label: "Soins infirmiers", emoji: "💉",
    placeholder: "Ex. Artésunate 2,4 mg/kg IV à H0, H12, H24 puis relais oral / Pansement simple tous les 2 jours",
    suggestions: ["Pose d'une voie veineuse", "Perfusion de sérum glucosé 5 %", "Injection IM", "Pansement simple", "Nébulisation", "Prise des constantes toutes les 4 h"],
  },
  {
    value: "Surveillance", label: "Surveillance", emoji: "👁️",
    placeholder: "Ex. Surveiller la température, la conscience et la diurèse toutes les 4 h",
    suggestions: ["Température toutes les 4 h", "Tension artérielle matin et soir", "Surveiller l'état de conscience", "Surveiller la diurèse"],
  },
  {
    value: "Examens", label: "Examens complémentaires", emoji: "🧪",
    placeholder: "Ex. NFS, glycémie de contrôle à J3",
    suggestions: ["GE / TDR de contrôle", "NFS", "Glycémie de contrôle"],
  },
  {
    value: "Conseils", label: "Conseils / éducation", emoji: "🗣️",
    placeholder: "Ex. Dormir sous moustiquaire imprégnée, bien s'hydrater, revenir si vomissements",
    suggestions: ["Dormir sous moustiquaire imprégnée", "Bien s'hydrater", "Revenir immédiatement en cas de signes de danger", "Repos"],
  },
  {
    value: "Autre", label: "Autre", emoji: "📝",
    placeholder: "Toute autre consigne",
    suggestions: [],
  },
];

export const typeCat = (v: string) => TYPES_CAT.find((t) => t.value === v) || TYPES_CAT[TYPES_CAT.length - 1];

export const catASoinsInfirmiers = (items?: ConduiteItem[]) => (items || []).some((i) => i.type === "Soins infirmiers");

export function conduiteEnLignes(items?: ConduiteItem[]): string[] {
  return (items || []).map((i) => `${typeCat(i.type).label} : ${i.description}`);
}

/** Éditeur de la conduite à tenir (formulaire de consultation). */
export function ConduiteATenirEditor({ items, onChange }: { items: ConduiteItem[]; onChange: (items: ConduiteItem[]) => void }) {
  const [type, setType] = useState(TYPES_CAT[0].value);
  const [texte, setTexte] = useState("");
  const t = typeCat(type);

  const ajouter = (desc = texte) => {
    const d = desc.trim();
    if (!d) return;
    onChange([...items, { id: generateUid(), type, description: d }]);
    setTexte("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TYPES_CAT.map((x) => (
          <button
            key={x.value}
            type="button"
            onClick={() => setType(x.value)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
              type === x.value ? "bg-primary-600 text-white border-primary-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
            }`}
          >
            {x.emoji} {x.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-start">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ajouter(); } }}
          placeholder={t.placeholder}
          className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none min-h-[52px]"
        />
        <button
          type="button"
          onClick={() => ajouter()}
          disabled={!texte.trim()}
          className="shrink-0 px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 hover:bg-primary-700"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      {t.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {t.suggestions.map((s) => (
            <button key={s} type="button" onClick={() => setTexte(texte ? `${texte.trim()} ; ${s}` : s)}
              className="text-2xs px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-500 hover:bg-stone-50">
              + {s}
            </button>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <ol className="space-y-1.5 mt-1">
          {items.map((i, idx) => (
            <li key={i.id} className="flex items-start gap-2 text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2">
              <span className="font-bold text-stone-400">{idx + 1}.</span>
              <div className="flex-1">
                <span className="font-bold text-primary-700">{typeCat(i.type).emoji} {typeCat(i.type).label} : </span>
                <span className="whitespace-pre-wrap">{i.description}</span>
              </div>
              <button type="button" onClick={() => onChange(items.filter((x) => x.id !== i.id))} title="Retirer" className="text-danger-600 hover:bg-danger-50 rounded p-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Affichage en lecture seule (dossier, salle infirmier). */
export function ConduiteATenirListe({ items, seulementType, compact }: { items?: ConduiteItem[]; seulementType?: string; compact?: boolean }) {
  const liste = (items || []).filter((i) => !seulementType || i.type === seulementType);
  if (!liste.length) return null;
  return (
    <ol className={compact ? "space-y-0.5" : "space-y-1.5"}>
      {liste.map((i, idx) => (
        <li key={i.id} className={`flex gap-2 ${compact ? "text-xs" : "text-sm"}`}>
          <span className="font-bold opacity-50">{idx + 1}.</span>
          <span>
            {!seulementType && <b>{typeCat(i.type).emoji} {typeCat(i.type).label} : </b>}
            <span className="whitespace-pre-wrap">{i.description}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export const IconeCAT = ClipboardList;
