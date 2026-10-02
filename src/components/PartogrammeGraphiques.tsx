/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Graphiques et grille du Guide de soins du travail (LCG — OMS 2020) :
 *  - courbe de dilatation du col (phase active à partir de 5 cm) ;
 *  - courbe des bruits du cœur fœtal (BCF) avec la zone normale 110–159 ;
 *  - grille LCG (une colonne par heure d'observation, cases en rouge quand
 *    la valeur franchit le seuil d'alerte).
 */

import React from "react";
import type { ObservationLCG, Partogramme } from "../types";
import {
  alertesObservation,
  debutDeuxiemePhase,
  debutPhaseActive,
  heureCourte,
  SEUIL_COL_HEURES,
  trierObservations,
} from "../lib/lcg";

const H = 3600 * 1000;

// Couleurs (lisibles en clair et en sombre)
const C_COL = "#2563eb"; // dilatation
const C_ALERTE = "#dc2626"; // alerte
const C_BCF = "#db2777"; // BCF
const C_GRILLE = "#d6d3d1";
const C_TEXTE = "#78716c";

// ---------------------------------------------------------------------------
// Courbe de dilatation du col
// ---------------------------------------------------------------------------
export function CourbeCol({ p, maintenant }: { p: Partogramme; maintenant: Date }) {
  const debut = debutPhaseActive(p);
  const triees = trierObservations(p.observations);
  const pointsCol = triees.filter((o) => o.col !== undefined && (o.col ?? 0) >= 5);

  if (!debut) {
    const dernier = [...triees].reverse().find((o) => o.col !== undefined);
    return (
      <div className="text-xs text-stone-500 italic border border-dashed border-stone-200 rounded-xl p-6 text-center">
        Phase latente{dernier ? ` (col à ${dernier.col} cm à ${heureCourte(dernier.dateHeure)})` : ""}. Le LCG commence quand le col
        atteint <b>5 cm</b> : la courbe s'affichera à partir de là.
      </div>
    );
  }

  const t0 = new Date(debut).getTime();
  const enCours = p.statut === "En cours";
  const finX = Math.max(
    12,
    Math.ceil(((enCours ? maintenant.getTime() : new Date(triees[triees.length - 1].dateHeure).getTime()) - t0) / H)
  );

  const W = 640, HT = 240, ml = 36, mr = 12, mt = 12, mb = 28;
  const x = (h: number) => ml + (h / finX) * (W - ml - mr);
  const y = (cm: number) => mt + ((10 - cm) / 5) * (HT - mt - mb);

  const pts = pointsCol.map((o) => ({
    o,
    h: (new Date(o.dateHeure).getTime() - t0) / H,
    alerte: alertesObservation(o, p).some((a) => a.champ === "progressionCol"),
  }));

  // Seuil d'alerte pour la dilatation actuelle
  let seuil: { h: number; col: number } | null = null;
  const dernierPt = pts[pts.length - 1];
  if (enCours && dernierPt && dernierPt.o.col! <= 9) {
    let premier = dernierPt;
    for (let i = pts.length - 2; i >= 0 && pts[i].o.col === dernierPt.o.col; i--) premier = pts[i];
    seuil = { h: premier.h + SEUIL_COL_HEURES[Math.floor(dernierPt.o.col!)], col: dernierPt.o.col! };
  }
  const d2 = debutDeuxiemePhase(p);
  const hMaintenant = (maintenant.getTime() - t0) / H;

  return (
    <svg viewBox={`0 0 ${W} ${HT}`} className="w-full h-auto" role="img" aria-label="Courbe de dilatation du col">
      {[5, 6, 7, 8, 9, 10].map((cm) => (
        <g key={cm}>
          <line x1={ml} x2={W - mr} y1={y(cm)} y2={y(cm)} stroke={C_GRILLE} strokeWidth={1} />
          <text x={ml - 6} y={y(cm) + 4} fontSize={11} textAnchor="end" fill={C_TEXTE}>{cm}</text>
        </g>
      ))}
      {Array.from({ length: finX + 1 }, (_, h) => (
        <g key={h}>
          <line x1={x(h)} x2={x(h)} y1={mt} y2={HT - mb} stroke={C_GRILLE} strokeWidth={h % 4 === 0 ? 1 : 0.5} strokeDasharray={h % 4 === 0 ? undefined : "2 3"} />
          {(finX <= 16 || h % 2 === 0) && (
            <text x={x(h)} y={HT - mb + 14} fontSize={10} textAnchor="middle" fill={C_TEXTE}>{h}h</text>
          )}
        </g>
      ))}

      {d2 && (
        <g>
          <line x1={x((new Date(d2).getTime() - t0) / H)} x2={x((new Date(d2).getTime() - t0) / H)} y1={mt} y2={HT - mb} stroke="#7c3aed" strokeWidth={2} strokeDasharray="6 4" />
          <text x={x((new Date(d2).getTime() - t0) / H) + 4} y={mt + 22} fontSize={10} fill="#7c3aed" fontWeight={700}>2e phase</text>
        </g>
      )}

      {seuil && seuil.h <= finX && (
        <g>
          <line x1={x(seuil.h)} x2={x(seuil.h)} y1={y(seuil.col) - 18} y2={y(seuil.col) + 18} stroke={C_ALERTE} strokeWidth={2} strokeDasharray="4 3" />
          <text x={x(seuil.h)} y={y(seuil.col) - 22} fontSize={10} textAnchor="middle" fill={C_ALERTE} fontWeight={700}>seuil {seuil.col} cm</text>
        </g>
      )}

      {enCours && hMaintenant <= finX && (
        <g>
          <line x1={x(hMaintenant)} x2={x(hMaintenant)} y1={mt} y2={HT - mb} stroke="#16a34a" strokeWidth={1.5} />
          <text x={x(hMaintenant) + 3} y={mt + 10} fontSize={10} fill="#16a34a">maintenant</text>
        </g>
      )}

      {pts.length > 1 && (
        <polyline fill="none" stroke={C_COL} strokeWidth={2} points={pts.map((pt) => `${x(pt.h)},${y(pt.o.col!)}`).join(" ")} />
      )}
      {pts.map((pt) => (
        <g key={pt.o.id}>
          <title>{`${heureCourte(pt.o.dateHeure)} — col ${pt.o.col} cm${pt.alerte ? " ⚠ progression lente" : ""}`}</title>
          <circle cx={x(pt.h)} cy={y(pt.o.col!)} r={10} fill="transparent" />
          <text x={x(pt.h)} y={y(pt.o.col!) + 5} fontSize={15} fontWeight={800} textAnchor="middle" fill={pt.alerte ? C_ALERTE : C_COL}>×</text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Courbe des BCF
// ---------------------------------------------------------------------------
export function CourbeBCF({ p }: { p: Partogramme }) {
  const pts = trierObservations(p.observations).filter((o) => o.bcf !== undefined);
  if (pts.length === 0)
    return <div className="text-xs text-stone-500 italic border border-dashed border-stone-200 rounded-xl p-6 text-center">Aucun BCF enregistré.</div>;

  const t0 = new Date(pts[0].dateHeure).getTime();
  const tN = new Date(pts[pts.length - 1].dateHeure).getTime();
  const dureeH = Math.max(1, (tN - t0) / H);
  const W = 640, HT = 180, ml = 36, mr = 12, mt = 10, mb = 26;
  const yMin = 80, yMax = 200;
  const x = (t: number) => ml + ((t - t0) / H / dureeH) * (W - ml - mr);
  const y = (v: number) => mt + ((yMax - Math.max(yMin, Math.min(yMax, v))) / (yMax - yMin)) * (HT - mt - mb);
  const nbTicks = Math.min(12, Math.ceil(dureeH));

  return (
    <svg viewBox={`0 0 ${W} ${HT}`} className="w-full h-auto" role="img" aria-label="Courbe des bruits du cœur fœtal">
      <rect x={ml} width={W - ml - mr} y={y(160)} height={y(110) - y(160)} fill="#16a34a" opacity={0.1} />
      {[80, 110, 140, 160, 200].map((v) => (
        <g key={v}>
          <line x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} stroke={v === 110 || v === 160 ? "#16a34a" : C_GRILLE} strokeWidth={1} strokeDasharray={v === 110 || v === 160 ? "4 3" : undefined} />
          <text x={ml - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill={C_TEXTE}>{v}</text>
        </g>
      ))}
      {Array.from({ length: nbTicks + 1 }, (_, i) => {
        const t = t0 + (i * dureeH * H) / nbTicks;
        return (
          <text key={i} x={x(t)} y={HT - 8} fontSize={10} textAnchor="middle" fill={C_TEXTE}>{heureCourte(new Date(t).toISOString())}</text>
        );
      })}
      {pts.length > 1 && (
        <polyline fill="none" stroke={C_BCF} strokeWidth={2} points={pts.map((o) => `${x(new Date(o.dateHeure).getTime())},${y(o.bcf!)}`).join(" ")} />
      )}
      {pts.map((o) => {
        const anormal = o.bcf! < 110 || o.bcf! >= 160;
        const cx = x(new Date(o.dateHeure).getTime());
        return (
          <g key={o.id}>
            <title>{`${heureCourte(o.dateHeure)} — BCF ${o.bcf}/min${anormal ? " ⚠ hors 110–159" : ""}`}</title>
            <circle cx={cx} cy={y(o.bcf!)} r={10} fill="transparent" />
            <circle cx={cx} cy={y(o.bcf!)} r={4.5} fill={anormal ? C_ALERTE : C_BCF} stroke="#fff" strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Grille LCG
// ---------------------------------------------------------------------------
type Ligne = {
  section: string;
  label: string;
  champ: keyof ObservationLCG;
  valeur: (o: ObservationLCG) => string | undefined;
  alerteTexte: string;
};

const ouiNon = (v?: "O" | "N") => (v === "O" ? "Oui" : v === "N" ? "Non" : undefined);

const LIGNES: Ligne[] = [
  { section: "Soins de soutien", label: "Accompagnant", champ: "accompagnant", valeur: (o) => ouiNon(o.accompagnant), alerteTexte: "Non" },
  { section: "Soins de soutien", label: "Soulagement douleur", champ: "soulagementDouleur", valeur: (o) => ouiNon(o.soulagementDouleur), alerteTexte: "Non" },
  { section: "Soins de soutien", label: "Hydratation orale", champ: "hydratationOrale", valeur: (o) => ouiNon(o.hydratationOrale), alerteTexte: "Non" },
  { section: "Soins de soutien", label: "Position", champ: "positionMere", valeur: (o) => o.positionMere, alerteTexte: "SP" },
  { section: "Bébé", label: "BCF de base", champ: "bcf", valeur: (o) => o.bcf?.toString(), alerteTexte: "<110, ≥160" },
  { section: "Bébé", label: "Décélérations", champ: "decelerations", valeur: (o) => o.decelerations, alerteTexte: "T" },
  { section: "Bébé", label: "Liquide amniotique", champ: "liquideAmniotique", valeur: (o) => o.liquideAmniotique, alerteTexte: "M+++, S" },
  { section: "Bébé", label: "Position fœtale", champ: "positionFoetale", valeur: (o) => o.positionFoetale, alerteTexte: "OP, OT" },
  { section: "Bébé", label: "Bosse", champ: "bosse", valeur: (o) => o.bosse, alerteTexte: "+++" },
  { section: "Bébé", label: "Modelage", champ: "modelage", valeur: (o) => o.modelage, alerteTexte: "+++" },
  { section: "Femme", label: "Pouls", champ: "pouls", valeur: (o) => o.pouls?.toString(), alerteTexte: "<60, ≥120" },
  { section: "Femme", label: "TA systolique", champ: "taSys", valeur: (o) => o.taSys?.toString(), alerteTexte: "<80, ≥140" },
  { section: "Femme", label: "TA diastolique", champ: "taDia", valeur: (o) => o.taDia?.toString(), alerteTexte: "≥90" },
  { section: "Femme", label: "Température °C", champ: "temperature", valeur: (o) => o.temperature?.toString(), alerteTexte: "<35, ≥37,5" },
  { section: "Femme", label: "Urine : protéines", champ: "urineProteines", valeur: (o) => o.urineProteines, alerteTexte: "++, +++" },
  { section: "Femme", label: "Urine : acétone", champ: "urineAcetone", valeur: (o) => o.urineAcetone, alerteTexte: "++, +++" },
  { section: "Progression du travail", label: "Contractions /10 min", champ: "contractionsPar10min", valeur: (o) => o.contractionsPar10min?.toString(), alerteTexte: "≤2, >5" },
  { section: "Progression du travail", label: "Durée contractions (s)", champ: "dureeContractions", valeur: (o) => o.dureeContractions?.toString(), alerteTexte: "<20, >60" },
  { section: "Progression du travail", label: "Col (cm)", champ: "col", valeur: (o) => o.col?.toString(), alerteTexte: "voir seuils" },
  { section: "Progression du travail", label: "Descente (/5)", champ: "descente", valeur: (o) => o.descente?.toString(), alerteTexte: "" },
  { section: "Médicaments", label: "Ocytocine (UI/L, gttes/min)", champ: "ocytocine", valeur: (o) => o.ocytocine, alerteTexte: "" },
  { section: "Médicaments", label: "Médicaments", champ: "medicaments", valeur: (o) => o.medicaments, alerteTexte: "" },
  { section: "Médicaments", label: "Liquides IV", champ: "liquidesIV", valeur: (o) => o.liquidesIV, alerteTexte: "" },
  { section: "Prise de décision partagée", label: "Évaluation", champ: "evaluation", valeur: (o) => o.evaluation, alerteTexte: "" },
  { section: "Prise de décision partagée", label: "Plan", champ: "plan", valeur: (o) => o.plan, alerteTexte: "" },
  { section: "Prise de décision partagée", label: "Agent", champ: "agentNom", valeur: (o) => o.agentNom, alerteTexte: "" },
];

export function GrilleLCG({ p }: { p: Partogramme }) {
  const obs = trierObservations(p.observations);
  if (obs.length === 0)
    return <div className="text-xs text-stone-500 italic border border-dashed border-stone-200 rounded-xl p-6 text-center">Aucune observation pour l'instant.</div>;

  const alertesParObs = new Map(obs.map((o) => [o.id, alertesObservation(o, p)]));
  let derniereSection = "";

  return (
    <div className="overflow-x-auto border border-stone-200 rounded-xl">
      <table className="text-2xs border-collapse min-w-full">
        <thead>
          <tr className="bg-stone-50">
            <th className="sticky left-0 bg-stone-50 text-left p-1.5 font-bold text-stone-600 border-b border-r border-stone-200 min-w-[150px]">Paramètre</th>
            <th className="p-1.5 font-bold text-danger-700 border-b border-r border-stone-200 whitespace-nowrap">Seuil d'alerte</th>
            {obs.map((o) => (
              <th key={o.id} className="p-1.5 font-mono font-bold text-stone-700 border-b border-r border-stone-200 whitespace-nowrap">
                {new Date(o.dateHeure).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                <br />
                {heureCourte(o.dateHeure)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIGNES.map((l) => {
            const nouvelleSection = l.section !== derniereSection;
            derniereSection = l.section;
            return (
              <React.Fragment key={l.champ}>
                {nouvelleSection && (
                  <tr>
                    <td colSpan={obs.length + 2} className="sticky left-0 bg-primary-50 text-primary-800 font-bold uppercase tracking-wider p-1 border-b border-stone-200">
                      {l.section}
                    </td>
                  </tr>
                )}
                <tr>
                  <td className="sticky left-0 bg-white p-1.5 font-semibold text-stone-700 border-b border-r border-stone-100">{l.label}</td>
                  <td className="p-1.5 text-danger-700 font-semibold border-b border-r border-stone-100 whitespace-nowrap">{l.alerteTexte}</td>
                  {obs.map((o) => {
                    const v = l.valeur(o);
                    const al = alertesParObs.get(o.id) || [];
                    const enAlerte = al.some((a) => a.champ === l.champ || (l.champ === "col" && a.champ === "progressionCol"));
                    const long = l.section === "Médicaments" || l.section === "Prise de décision partagée";
                    return (
                      <td
                        key={o.id}
                        title={v || ""}
                        className={`p-1.5 border-b border-r border-stone-100 text-center ${long ? "max-w-[140px] truncate text-left" : "font-mono font-bold"} ${
                          enAlerte ? "bg-danger-100 text-danger-800" : "text-stone-700"
                        }`}
                      >
                        {v ? (enAlerte ? `⚠ ${v}` : v) : ""}
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
