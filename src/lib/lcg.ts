/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Règles du Guide de soins du travail (Labour Care Guide, LCG) — OMS 2020.
 *
 * - La phase active commence à 5 cm.
 * - Il n'y a plus de "ligne d'alerte" ni de "ligne d'action" : chaque
 *   paramètre a son propre seuil, et toute valeur hors seuil doit déclencher
 *   une évaluation + un plan (prise de décision partagée).
 * - Progression du col : alerte si le col reste à la même dilatation au-delà
 *   d'une durée donnée (5 cm ≥ 6 h, 6 cm ≥ 5 h, 7 cm ≥ 3 h, 8 cm ≥ 2 h 30,
 *   9 cm ≥ 2 h).
 * - Deuxième phase (col à 10 cm) : alerte à ≥ 3 h chez la nullipare et
 *   ≥ 2 h chez la multipare.
 */

import type { ObservationLCG, Partogramme } from "../types";

export interface AlerteLCG {
  champ: keyof ObservationLCG | "progressionCol" | "deuxiemePhase";
  section: "Soutien" | "Bébé" | "Mère" | "Travail";
  message: string;
}

/** Durée maximale (en heures) à une même dilatation avant alerte. */
export const SEUIL_COL_HEURES: Record<number, number> = {
  5: 6,
  6: 5,
  7: 3,
  8: 2.5,
  9: 2,
};

const H = 3600 * 1000;

export const trierObservations = (obs: ObservationLCG[]): ObservationLCG[] =>
  [...obs].sort((a, b) => a.dateHeure.localeCompare(b.dateHeure));

export const estNullipare = (p: Partogramme): boolean => (p.parite ?? 0) === 0;

/** Heure à laquelle la phase active a commencé (premier col ≥ 5 cm). */
export function debutPhaseActive(p: Partogramme): string | undefined {
  const o = trierObservations(p.observations).find((x) => (x.col ?? 0) >= 5);
  return o?.dateHeure;
}

/** Heure à laquelle la 2e phase a commencé (premier col à 10 cm). */
export function debutDeuxiemePhase(p: Partogramme): string | undefined {
  const o = trierObservations(p.observations).find((x) => x.col === 10);
  return o?.dateHeure;
}

/** Dernière valeur connue de la dilatation du col. */
export function dernierCol(p: Partogramme): number | undefined {
  const avecCol = trierObservations(p.observations).filter((x) => x.col !== undefined);
  return avecCol.length ? avecCol[avecCol.length - 1].col : undefined;
}

/**
 * Pour une observation de col (5 à 9 cm), retourne depuis combien d'heures
 * le col est à cette même valeur, mesuré jusqu'à `jusqua` (date ISO).
 */
function heuresAuMemeCol(obsTriees: ObservationLCG[], index: number, jusqua: string): number {
  const col = obsTriees[index].col;
  let debut = obsTriees[index].dateHeure;
  for (let i = index - 1; i >= 0; i--) {
    const c = obsTriees[i].col;
    if (c === undefined) continue;
    if (c === col) debut = obsTriees[i].dateHeure;
    else break;
  }
  return (new Date(jusqua).getTime() - new Date(debut).getTime()) / H;
}

/** Alertes d'une observation, selon les seuils du LCG. */
export function alertesObservation(o: ObservationLCG, p?: Partogramme): AlerteLCG[] {
  const a: AlerteLCG[] = [];
  // Soins de soutien
  if (o.accompagnant === "N") a.push({ champ: "accompagnant", section: "Soutien", message: "Pas d'accompagnant" });
  if (o.soulagementDouleur === "N") a.push({ champ: "soulagementDouleur", section: "Soutien", message: "Douleur non soulagée" });
  if (o.hydratationOrale === "N") a.push({ champ: "hydratationOrale", section: "Soutien", message: "Pas d'hydratation orale" });
  if (o.positionMere === "SP") a.push({ champ: "positionMere", section: "Soutien", message: "Décubitus dorsal" });
  // Bébé
  if (o.bcf !== undefined && (o.bcf < 110 || o.bcf >= 160))
    a.push({ champ: "bcf", section: "Bébé", message: `BCF ${o.bcf}/min (normal 110–159)` });
  if (o.decelerations === "T") a.push({ champ: "decelerations", section: "Bébé", message: "Décélérations tardives" });
  if (o.liquideAmniotique === "M+++" || o.liquideAmniotique === "S")
    a.push({ champ: "liquideAmniotique", section: "Bébé", message: o.liquideAmniotique === "S" ? "Liquide sanglant" : "Méconium épais (M+++)" });
  if (o.positionFoetale === "OP" || o.positionFoetale === "OT")
    a.push({ champ: "positionFoetale", section: "Bébé", message: `Position ${o.positionFoetale}` });
  if (o.bosse === "+++") a.push({ champ: "bosse", section: "Bébé", message: "Bosse séro-sanguine +++" });
  if (o.modelage === "+++") a.push({ champ: "modelage", section: "Bébé", message: "Modelage +++" });
  // Mère
  if (o.pouls !== undefined && (o.pouls < 60 || o.pouls >= 120))
    a.push({ champ: "pouls", section: "Mère", message: `Pouls ${o.pouls}/min (normal 60–119)` });
  if (o.taSys !== undefined && (o.taSys < 80 || o.taSys >= 140))
    a.push({ champ: "taSys", section: "Mère", message: `TA systolique ${o.taSys} mmHg` });
  if (o.taDia !== undefined && o.taDia >= 90) a.push({ champ: "taDia", section: "Mère", message: `TA diastolique ${o.taDia} mmHg` });
  if (o.temperature !== undefined && (o.temperature < 35 || o.temperature >= 37.5))
    a.push({ champ: "temperature", section: "Mère", message: `Température ${o.temperature} °C` });
  if (o.urineProteines === "++" || o.urineProteines === "+++")
    a.push({ champ: "urineProteines", section: "Mère", message: `Protéinurie ${o.urineProteines}` });
  if (o.urineAcetone === "++" || o.urineAcetone === "+++")
    a.push({ champ: "urineAcetone", section: "Mère", message: `Acétonurie ${o.urineAcetone}` });
  // Travail
  if (o.contractionsPar10min !== undefined && (o.contractionsPar10min <= 2 || o.contractionsPar10min > 5))
    a.push({ champ: "contractionsPar10min", section: "Travail", message: `${o.contractionsPar10min} contraction(s)/10 min` });
  if (o.dureeContractions !== undefined && (o.dureeContractions < 20 || o.dureeContractions > 60))
    a.push({ champ: "dureeContractions", section: "Travail", message: `Contractions de ${o.dureeContractions} s` });

  // Progression du col (nécessite le contexte du partogramme)
  if (p && o.col !== undefined && o.col >= 5 && o.col <= 9) {
    const triees = trierObservations(p.observations);
    const idx = triees.findIndex((x) => x.id === o.id);
    if (idx >= 0) {
      const h = heuresAuMemeCol(triees, idx, o.dateHeure);
      if (h >= SEUIL_COL_HEURES[Math.floor(o.col)]) {
        a.push({ champ: "progressionCol", section: "Travail", message: `Col à ${o.col} cm depuis ${formatDuree(h)}` });
      }
    }
  }
  return a;
}

/** Alertes "en cours" du partogramme, calculées à l'instant présent. */
export function alertesEnCours(p: Partogramme, maintenant = new Date()): AlerteLCG[] {
  if (p.statut !== "En cours") return [];
  const triees = trierObservations(p.observations);
  const alertes: AlerteLCG[] = [];
  const derniere = triees[triees.length - 1];
  if (derniere) alertes.push(...alertesObservation(derniere, p).filter((a) => a.champ !== "progressionCol"));

  // Stagnation du col jusqu'à maintenant
  const idxCol = (() => {
    for (let i = triees.length - 1; i >= 0; i--) if (triees[i].col !== undefined) return i;
    return -1;
  })();
  if (idxCol >= 0) {
    const col = triees[idxCol].col!;
    if (col >= 5 && col <= 9) {
      const h = heuresAuMemeCol(triees, idxCol, maintenant.toISOString());
      if (h >= SEUIL_COL_HEURES[Math.floor(col)])
        alertes.push({ champ: "progressionCol", section: "Travail", message: `Col à ${col} cm depuis ${formatDuree(h)} (seuil ${formatDuree(SEUIL_COL_HEURES[Math.floor(col)])})` });
    }
  }
  // Deuxième phase prolongée
  const d2 = debutDeuxiemePhase(p);
  if (d2) {
    const h = (maintenant.getTime() - new Date(d2).getTime()) / H;
    const seuil = estNullipare(p) ? 3 : 2;
    if (h >= seuil)
      alertes.push({ champ: "deuxiemePhase", section: "Travail", message: `2e phase depuis ${formatDuree(h)} (seuil ${seuil} h ${estNullipare(p) ? "nullipare" : "multipare"})` });
  }
  return alertes;
}

export interface ControleDu {
  label: string;
  intervalleMin: number;
  dernier?: string;
  echeance: Date;
  enRetard: boolean;
}

/** Contrôles de surveillance à faire et leur échéance (fréquences du LCG). */
export function prochainsControles(p: Partogramme, maintenant = new Date()): ControleDu[] {
  if (p.statut !== "En cours") return [];
  const triees = trierObservations(p.observations);
  const deuxieme = !!debutDeuxiemePhase(p);
  const regles: { label: string; min: number; a: (o: ObservationLCG) => boolean }[] = [
    { label: "BCF", min: deuxieme ? 5 : 30, a: (o) => o.bcf !== undefined },
    { label: "Contractions", min: 30, a: (o) => o.contractionsPar10min !== undefined },
    { label: "Pouls", min: 30, a: (o) => o.pouls !== undefined },
    { label: "TA", min: 240, a: (o) => o.taSys !== undefined },
    { label: "Température", min: 240, a: (o) => o.temperature !== undefined },
    { label: "Toucher vaginal", min: deuxieme ? 60 : 240, a: (o) => o.col !== undefined },
  ];
  const ref = p.admission;
  return regles.map((r) => {
    let dernier: string | undefined;
    for (let i = triees.length - 1; i >= 0; i--) if (r.a(triees[i])) { dernier = triees[i].dateHeure; break; }
    const base = new Date(dernier || ref);
    const echeance = new Date(base.getTime() + r.min * 60000);
    return { label: r.label, intervalleMin: r.min, dernier, echeance, enRetard: echeance.getTime() <= maintenant.getTime() };
  });
}

export function formatDuree(heures: number): string {
  const totalMin = Math.max(0, Math.round(heures * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export const heureCourte = (iso?: string): string =>
  iso ? new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "—";

export const dateHeureCourte = (iso?: string): string =>
  iso
    ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "—";

/** Valeur pour un <input type="datetime-local"> à partir d'une date. */
export const versInputLocal = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * TA saisie en CPN sous forme "12/8" (cmHg) ou "120/80" (mmHg) :
 * vrai si systolique ≥ 140 mmHg ou diastolique ≥ 90 mmHg.
 */
export function taElevee(ta?: string): boolean {
  if (!ta) return false;
  const [s, d] = ta.split("/").map((x) => parseFloat(x.replace(",", ".")));
  const enMm = (v: number) => (isNaN(v) ? NaN : v < 30 ? v * 10 : v);
  const sys = enMm(s), dia = enMm(d);
  return (!isNaN(sys) && sys >= 140) || (!isNaN(dia) && dia >= 90);
}
