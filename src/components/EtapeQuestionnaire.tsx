/**
 * Présentation « questionnaire pas à pas » de la consultation générale.
 *
 * Le contenu (les champs) reste exactement le même que le formulaire complet :
 * chaque bloc est simplement enveloppé dans une <Etape>. En mode questionnaire,
 * les étapes apparaissent l'une après l'autre au fur et à mesure que la
 * consultation avance ; les étapes déjà faites se replient (on peut les rouvrir).
 * En mode « formulaire complet », <Etape> n'ajoute rien : tout s'affiche comme avant.
 */
import React, { useEffect, useRef, useState } from "react";
import { CheckCircle, ChevronDown, ChevronUp, ArrowRight, ArrowLeft } from "lucide-react";

export type ModeConsultation = "complet" | "questionnaire";

interface EtapeProps {
  index: number;
  titre: string;
  mode: ModeConsultation;
  etape: number;
  total: number;
  setEtape: (n: number) => void;
  /** Texte d'aide affiché sous le titre de l'étape en cours. */
  aide?: string;
  children: React.ReactNode;
}

export function Etape({ index, titre, mode, etape, total, setEtape, aide, children }: EtapeProps) {
  const [rouverte, setRouverte] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const courante = index === etape;

  // L'étape qui vient d'apparaître est amenée à l'écran.
  useEffect(() => {
    if (mode === "questionnaire" && courante && index > 0) {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (!courante) setRouverte(false);
  }, [courante, mode, index]);

  if (mode !== "questionnaire") return <>{children}</>;
  if (index > etape) return null;

  // Étape déjà faite : repliée, on peut la rouvrir pour corriger.
  if (index < etape) {
    return (
      <div className="rounded-xl border border-success-200 bg-success-50/40">
        <button type="button" onClick={() => setRouverte(!rouverte)} className="w-full px-3 py-2 flex items-center justify-between text-left">
          <span className="text-xs font-bold text-success-800 flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> {index + 1}. {titre}
          </span>
          <span className="text-2xs font-semibold text-stone-500 flex items-center gap-1">
            {rouverte ? <>Refermer <ChevronUp className="w-3.5 h-3.5" /></> : <>Revoir / corriger <ChevronDown className="w-3.5 h-3.5" /></>}
          </span>
        </button>
        {rouverte && <div className="p-3 pt-0 space-y-3">{children}</div>}
      </div>
    );
  }

  // Étape en cours.
  const derniere = index === total - 1;
  return (
    <div ref={ref} className="rounded-2xl border-2 border-primary-300 bg-white p-4 space-y-3 shadow-sm scroll-mt-4">
      <div className="flex items-baseline justify-between gap-2 border-b border-stone-100 pb-2">
        <h4 className="text-sm font-bold text-primary-800">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs mr-2">{index + 1}</span>
          {titre}
        </h4>
        <span className="text-2xs font-semibold text-stone-500 whitespace-nowrap">Étape {index + 1} / {total}</span>
      </div>
      {aide && <p className="text-2xs text-stone-500 -mt-1">{aide}</p>}
      <div className="space-y-3">{children}</div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
        {index > 0 ? (
          <button type="button" onClick={() => setEtape(index - 1)} className="px-3 py-2 text-xs font-bold rounded-lg border border-stone-300 text-stone-600 flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Précédent
          </button>
        ) : <span />}
        {!derniere && (
          <button type="button" onClick={() => setEtape(index + 1)} className="px-4 py-2 text-xs font-bold rounded-lg bg-primary-600 hover:bg-primary-700 text-white flex items-center gap-1.5">
            Suivant <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Barre de progression + choix de la présentation. */
export function ChoixPresentation({ mode, setMode, etape, titres, setEtape }: {
  mode: ModeConsultation;
  setMode: (m: ModeConsultation) => void;
  etape: number;
  titres: string[];
  setEtape: (n: number) => void;
}) {
  const btn = (m: ModeConsultation, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${mode === m ? "bg-primary-600 text-white shadow-xs" : "text-stone-600 hover:bg-stone-100"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-2">
      <div className="inline-flex p-1 rounded-xl bg-stone-50 border border-stone-200 gap-1">
        {btn("questionnaire", "Questionnaire pas à pas")}
        {btn("complet", "Formulaire complet")}
      </div>
      {mode === "questionnaire" && (
        <div className="flex gap-1" aria-label="Avancement de la consultation">
          {titres.map((t, i) => (
            <button
              key={t}
              type="button"
              title={`${i + 1}. ${t}`}
              onClick={() => i <= etape && setEtape(i)}
              className={`h-2 flex-1 rounded-full transition-all ${i < etape ? "bg-success-500 cursor-pointer" : i === etape ? "bg-primary-600" : "bg-stone-200 cursor-default"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
