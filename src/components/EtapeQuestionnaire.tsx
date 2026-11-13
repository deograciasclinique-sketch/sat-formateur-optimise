/**
 * Présentation « questionnaire pas à pas » de la consultation générale.
 *
 * Le contenu (les champs) reste exactement le même que le formulaire complet :
 * chaque bloc est enveloppé dans une <Etape>. En mode questionnaire, une seule
 * étape s'affiche à la fois dans un grand panneau ; la frise du parcours patient
 * (<RailEtapes>) montre les étapes faites, en cours et à venir, et permet de
 * revenir sur une étape déjà faite. En mode « formulaire complet », <Etape>
 * n'ajoute rien : tout s'affiche comme avant.
 *
 * L'habillage des champs (libellés, cases de saisie) est dans src/index.css (.qx).
 */
import React, { useEffect, useRef } from "react";
import {
  Check, ArrowLeft, ArrowRight, UserRound, HeartPulse, Stethoscope, Lightbulb,
  FlaskConical, ClipboardCheck, Signpost, Pill, type LucideIcon,
} from "lucide-react";

export type ModeConsultation = "complet" | "questionnaire";

/** Une icône par étape, dans l'ordre de TITRES_ETAPES. */
const ICONES: LucideIcon[] = [UserRound, HeartPulse, Stethoscope, Lightbulb, FlaskConical, ClipboardCheck, Signpost, Pill];
const icone = (i: number) => ICONES[i] || ClipboardCheck;

interface EtapeProps {
  index: number;
  titre: string;
  mode: ModeConsultation;
  etape: number;
  total: number;
  setEtape: (n: number) => void;
  /** Titre de l'étape suivante (bouton « Continuer »). */
  titres?: string[];
  aide?: string;
  /** Classes ajoutées au panneau (placement dans la grille). */
  className?: string;
  /** Le contenu est déjà une carte : on retire son cadre dans le panneau. */
  plat?: boolean;
  children: React.ReactNode;
}

export function Etape({ index, titre, mode, etape, total, setEtape, titres, aide, className = "", plat, children }: EtapeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const courante = index === etape;

  // À chaque changement d'étape, le haut du panneau revient à l'écran.
  useEffect(() => {
    if (mode === "questionnaire" && courante) {
      const r = ref.current?.getBoundingClientRect();
      if (r && r.top < 0) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [courante, mode]);

  if (mode !== "questionnaire") return <>{children}</>;
  if (!courante) return null;

  const Icone = icone(index);
  const derniere = index === total - 1;
  const suivante = titres?.[index + 1];

  return (
    <section
      ref={ref}
      key={index}
      aria-labelledby={`qx-titre-${index}`}
      className={`qx qx-panneau scroll-mt-24 rounded-[1.75rem] bg-white border border-stone-200/80 shadow-[0_1px_2px_rgba(15,23,42,.04),0_12px_32px_-16px_rgba(15,118,110,.25)] ${className}`}
    >
      <header className="px-5 sm:px-8 pt-6 sm:pt-7 pb-5 flex items-start gap-4">
        <span className="shrink-0 w-12 h-12 rounded-2xl bg-primary-50 text-primary-700 flex items-center justify-center ring-1 ring-primary-100">
          <Icone className="w-6 h-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-2xs font-semibold text-primary-700">Étape {index + 1} sur {total}</p>
          <h4 id={`qx-titre-${index}`} className="text-xl sm:text-2xl font-semibold text-stone-900 leading-tight tracking-tight">{titre}</h4>
          {aide && <p className="text-xs text-stone-500 mt-1 max-w-prose">{aide}</p>}
        </div>
      </header>

      <div className={`px-5 sm:px-8 pb-6 space-y-4 ${plat ? "qx-plat" : ""}`}>{children}</div>

      {(index > 0 || !derniere) && (
        <footer className="sticky bottom-0 z-10 px-5 sm:px-8 py-4 border-t border-stone-100 bg-white/90 backdrop-blur rounded-b-[1.75rem] flex items-center justify-between gap-3">
          {index > 0 ? (
            <button type="button" onClick={() => setEtape(index - 1)} className="qx-btn-retour">
              <ArrowLeft className="w-4 h-4" /> Retour
            </button>
          ) : <span />}
          {!derniere && (
            <button type="button" onClick={() => setEtape(index + 1)} className="qx-btn-suivant">
              <span className="flex flex-col items-start leading-tight">
                <span>Continuer</span>
                {suivante && <span className="text-2xs font-normal text-primary-100">{suivante}</span>}
              </span>
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </footer>
      )}
    </section>
  );
}

/**
 * Frise du parcours patient : verticale sur ordinateur (à gauche, reste visible),
 * horizontale et défilante sur téléphone. Les étapes faites sont cliquables.
 */
export function RailEtapes({ titres, etape, setEtape, patient, className = "" }: {
  titres: string[];
  etape: number;
  setEtape: (n: number) => void;
  patient?: string;
  className?: string;
}) {
  const pct = Math.round((etape / Math.max(1, titres.length - 1)) * 100);
  return (
    <nav aria-label="Étapes de la consultation" className={`lg:sticky lg:top-24 self-start ${className}`}>
      <div className="rounded-[1.75rem] bg-white/70 border border-stone-200/80 p-4 lg:p-5">
        <p className="text-2xs text-stone-500">Consultation de médecine générale</p>
        <p className="text-base font-semibold text-stone-900 truncate" title={patient || undefined}>{patient?.trim() || "Nouveau patient"}</p>
        <div className="mt-3 h-1.5 rounded-full bg-stone-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary-600 transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>

        <ol className="mt-4 flex lg:flex-col gap-2 lg:gap-0 overflow-x-auto lg:overflow-visible -mx-1 px-1 pb-1 lg:pb-0">
          {titres.map((t, i) => {
            const faite = i < etape, enCours = i === etape;
            const Icone = icone(i);
            return (
              <li key={t} className="relative shrink-0 lg:shrink">
                {/* trait reliant les étapes (ordinateur) */}
                {i < titres.length - 1 && (
                  <span aria-hidden className={`hidden lg:block absolute left-[19px] top-10 bottom-0 w-0.5 ${faite ? "bg-primary-500" : "bg-stone-200"}`} />
                )}
                <button
                  type="button"
                  disabled={i > etape}
                  onClick={() => setEtape(i)}
                  aria-current={enCours ? "step" : undefined}
                  className={`relative w-full flex items-center gap-3 rounded-2xl lg:py-2 pr-3 pl-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                    ${enCours ? "lg:bg-primary-50/70" : faite ? "hover:bg-stone-50" : "cursor-default"}`}
                >
                  <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                    ${faite ? "bg-primary-600 border-primary-600 text-white" : enCours ? "bg-white border-primary-600 text-primary-700" : "bg-white border-stone-200 text-stone-400"}`}>
                    {faite ? <Check className="w-5 h-5" strokeWidth={2.5} /> : <Icone className="w-[18px] h-[18px]" strokeWidth={1.75} />}
                  </span>
                  <span className={`hidden lg:block text-xs leading-snug ${enCours ? "font-semibold text-primary-800" : faite ? "text-stone-700" : "text-stone-400"}`}>{t}</span>
                  {enCours && <span className="lg:hidden text-xs font-semibold text-primary-800 whitespace-nowrap">{t}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

/** Choix de la présentation (questionnaire / formulaire complet). */
export function ChoixPresentation({ mode, setMode }: { mode: ModeConsultation; setMode: (m: ModeConsultation) => void }) {
  const btn = (m: ModeConsultation, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      aria-pressed={mode === m}
      className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors ${mode === m ? "bg-white text-primary-800 shadow-sm ring-1 ring-stone-200" : "text-stone-500 hover:text-stone-800"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="inline-flex p-1 rounded-full bg-stone-100 gap-0.5">
      {btn("questionnaire", "Pas à pas")}
      {btn("complet", "Formulaire complet")}
    </div>
  );
}
