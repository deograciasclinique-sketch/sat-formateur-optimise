/**
 * Horaires de garde / rotation du personnel.
 *
 * • Cabinet DEO GRACIAS : deux postes de rotation — Jour 07h-17h et Nuit 17h-07h (+ garde 24h).
 * • Édition commerciale / démo : horaires d'origine inchangés (Matin, Après-midi, Nuit, 24h).
 */
import { COMMERCIAL } from "./edition";

const CABINET = !COMMERCIAL;

/** Shifts proposés dans les plannings de garde. */
export const SHIFTS_GARDE: string[] = CABINET
  ? ["Jour (07h-17h)", "Nuit (17h-07h)", "Garde 24h"]
  : ["Matin (07h-14h)", "Après-midi (14h-21h)", "Nuit (21h-07h)", "Garde 24h"];

/** Shift présélectionné à l'ajout d'une garde. */
export const SHIFT_GARDE_DEFAUT = CABINET ? "Jour (07h-17h)" : "Nuit (21h-07h)";

/** Horaires de travail proposés sur la fiche d'un agent : [valeur, libellé]. */
export const HORAIRES_AGENT: [string, string][] = CABINET
  ? [["7h – 17h", "7h – 17h (Jour)"], ["17h – 7h (Garde)", "17h – 7h (Nuit/Garde)"], ["Flexible", "Flexible"]]
  : [["7h – 14h", "7h – 14h (Matin)"], ["14h – 21h", "14h – 21h (Soir)"], ["21h – 7h (Garde)", "21h – 7h (Nuit/Garde)"], ["7h – 16h", "7h – 16h (Médecin)"], ["Flexible", "Flexible"]];

export const HORAIRE_AGENT_DEFAUT = HORAIRES_AGENT[0][0];

/** Shift de journée (pour les règles de repos et les couleurs) : Matin, Après-midi ou Jour. */
export function estShiftDeJour(shift: string): boolean {
  return /Matin|Après-midi|Jour/.test(shift) && !/Nuit/.test(shift);
}
