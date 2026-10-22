/**
 * Sélection des bilans biologiques (consultation) et affichage de leur détail (laboratoire).
 */
import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import type { ActeTarifaire } from "../types";
import { BILANS, lignesBilan, normaliser, type LigneBilan } from "../lib/bilans";

/** bilanId → clés des examens cochés */
export type ChoixBilans = Record<string, string[]>;

const F = (n: number) => `${n.toLocaleString("fr-FR")} F`;

export function totalBilans(choix: ChoixBilans, catalogue: ActeTarifaire[]): number {
  return Object.entries(choix).reduce((s, [id, cles]) => {
    const b = BILANS.find((x) => x.id === id);
    if (!b) return s;
    return s + lignesBilan(b, catalogue).filter((l) => cles.includes(l.cle)).reduce((t, l) => t + l.prix, 0);
  }, 0);
}

/** Les bilans choisis, prêts à être envoyés au laboratoire. */
export function bilansAPrescrire(choix: ChoixBilans, catalogue: ActeTarifaire[]) {
  return Object.entries(choix).flatMap(([id, cles]) => {
    const b = BILANS.find((x) => x.id === id);
    if (!b || cles.length === 0) return [];
    const lignes = lignesBilan(b, catalogue).filter((l) => cles.includes(l.cle));
    return [{ bilan: b.nom, lignes, total: lignes.reduce((t, l) => t + l.prix, 0) }];
  });
}

export function SelecteurBilans({ choix, onChange, catalogue }: { choix: ChoixBilans; onChange: (c: ChoixBilans) => void; catalogue: ActeTarifaire[] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const groupes = useMemo(() => {
    const n = normaliser(q);
    const liste = BILANS.filter((b) => !n || normaliser(b.nom).includes(n) || b.examens.some((c) => normaliser(c).includes(n)));
    return [...new Set(liste.map((b) => b.groupe))].map((g) => ({ g, bilans: liste.filter((b) => b.groupe === g) }));
  }, [q]);

  const basculer = (id: string) => {
    const b = BILANS.find((x) => x.id === id)!;
    const c = { ...choix };
    if (c[id]) { delete c[id]; if (ouvert === id) setOuvert(null); }
    else { c[id] = [...b.examens]; setOuvert(id); }
    onChange(c);
  };
  const basculerExamen = (id: string, cle: string) => {
    const actuels = choix[id] || [];
    onChange({ ...choix, [id]: actuels.includes(cle) ? actuels.filter((k) => k !== cle) : [...actuels, cle] });
  };

  return (
    <div className="border border-primary-200 rounded-lg bg-primary-50/40 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs uppercase font-bold tracking-wider text-primary-800 flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Bilans (un clic = tous les examens)</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un bilan…" className="text-2xs border border-stone-200 rounded-lg px-2 py-1 bg-white w-36 focus:outline-none" />
      </div>
      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
        {groupes.map(({ g, bilans }) => (
          <div key={g}>
            <div className="text-2xs font-bold uppercase text-stone-500 mb-1">{g}</div>
            <div className="flex flex-wrap gap-1">
              {bilans.map((b) => {
                const actif = !!choix[b.id];
                return (
                  <button key={b.id} type="button" onClick={() => basculer(b.id)}
                    className={`text-2xs font-bold px-2 py-1 rounded-full border cursor-pointer ${actif ? "bg-primary-700 border-primary-700 text-white" : "bg-white border-stone-200 text-stone-700 hover:border-primary-400"}`}>
                    {actif ? "✓ " : ""}{b.nom}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(choix).length > 0 && (
        <div className="space-y-1.5">
          {Object.keys(choix).map((id) => {
            const b = BILANS.find((x) => x.id === id);
            if (!b) return null;
            const lignes = lignesBilan(b, catalogue);
            const coches = choix[id];
            const total = lignes.filter((l) => coches.includes(l.cle)).reduce((t, l) => t + l.prix, 0);
            const deplie = ouvert === id;
            return (
              <div key={id} className="bg-white border border-stone-200 rounded-lg">
                <button type="button" onClick={() => setOuvert(deplie ? null : id)} className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs cursor-pointer">
                  <span className="font-bold text-stone-800">{b.nom} <span className="font-normal text-stone-500">· {coches.length}/{lignes.length} examens</span></span>
                  <span className="flex items-center gap-1 font-mono font-bold text-primary-800">{F(total)} {deplie ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
                </button>
                {deplie && (
                  <div className="border-t border-stone-100 divide-y divide-stone-50">
                    {lignes.map((l) => (
                      <label key={l.cle} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-primary-50/50">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" checked={coches.includes(l.cle)} onChange={() => basculerExamen(id, l.cle)} className="accent-primary-600 w-3.5 h-3.5" />
                          <span className="text-stone-700">{l.nom}</span>
                        </span>
                        <span className="font-mono text-stone-600 shrink-0">{F(l.prix)}{l.indicatif && <span className="text-2xs text-warning-600" title="Tarif indicatif : examen absent de la grille Actes & Tarifs"> *</span>}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(choix).some((id) => { const b = BILANS.find((x) => x.id === id); return b && lignesBilan(b, catalogue).some((l) => l.indicatif); }) && (
            <p className="text-2xs text-warning-700">* Tarif indicatif : examen absent de la grille « Actes & Tarifs » (le responsable peut l'y ajouter et fixer son prix).</p>
          )}
        </div>
      )}
    </div>
  );
}

/** Détail d'un bilan reçu au laboratoire : examens qui le composent et prix. */
export function DetailBilan({ composants, compact }: { composants?: { nom: string; prix: number }[]; compact?: boolean }) {
  if (!composants || composants.length === 0) return null;
  const total = composants.reduce((t, c) => t + (c.prix || 0), 0);
  return (
    <div className={`mt-1.5 border border-primary-100 rounded-lg bg-primary-50/40 ${compact ? "text-2xs min-w-[230px]" : "text-xs"}`}>
      <ul className="divide-y divide-primary-100/70">
        {composants.map((c, i) => (
          <li key={i} className="flex items-center justify-between gap-3 px-2.5 py-1">
            <span className="text-stone-700">• {c.nom}</span>
            <span className="font-mono text-stone-600 shrink-0">{F(c.prix || 0)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between px-2.5 py-1 border-t border-primary-200 font-bold text-primary-900">
        <span>Total ({composants.length} examens)</span><span className="font-mono">{F(total)}</span>
      </div>
    </div>
  );
}

export type { LigneBilan };
