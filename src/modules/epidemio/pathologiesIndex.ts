import { Pathology } from './clinicalTypes';
import { INFECTIOUS_PATHOLOGIES } from './pathologiesInfectious';
import { EMERGENCY_PATHOLOGIES } from './pathologiesEmergencies';
import { METABOLIC_NEURO_PATHOLOGIES } from './pathologiesMetabolicAndNeuro';

export const ALL_PATHOLOGIES: Pathology[] = [
  ...INFECTIOUS_PATHOLOGIES,
  ...EMERGENCY_PATHOLOGIES,
  ...METABOLIC_NEURO_PATHOLOGIES
];

export function getPathologyById(id: string): Pathology | undefined {
  return ALL_PATHOLOGIES.find(p => p.id === id);
}

export function searchPathologies(query: string): Pathology[] {
  if (!query || query.trim() === '') return ALL_PATHOLOGIES;
  const q = query.toLowerCase().trim();

  return ALL_PATHOLOGIES.filter(p => {
    // Match name, synonyms, definition
    if (p.name.toLowerCase().includes(q)) return true;
    if (p.synonyms?.some(s => s.toLowerCase().includes(q))) return true;
    if (p.category.toLowerCase().includes(q)) return true;
    if (p.definition.toLowerCase().includes(q)) return true;

    // Match cardinal signs
    if (p.cardinalSigns.some(s => s.label.toLowerCase().includes(q))) return true;

    // Match secondary signs
    if (p.secondarySigns.some(s => s.label.toLowerCase().includes(q))) return true;

    // Match red flags
    if (p.emergencyRedFlags.some(f => f.label.toLowerCase().includes(q) || f.explanation.toLowerCase().includes(q))) return true;

    return false;
  });
}

export function calculateDiagnosticScore(
  pathology: Pathology,
  checkedSignIds: Record<string, boolean>
): {
  totalCardinalChecked: number;
  totalCardinalCount: number;
  totalSecondaryChecked: number;
  totalSecondaryCount: number;
  scorePercent: number;
  confidence: 'FAIBLE' | 'MODEREE' | 'FORTE' | 'CONFIRMEE';
  summaryMessage: string;
} {
  const cardinalSigns = pathology.cardinalSigns;
  const secondarySigns = pathology.secondarySigns;

  const totalCardinalChecked = cardinalSigns.filter(s => checkedSignIds[s.id]).length;
  const totalSecondaryChecked = secondarySigns.filter(s => checkedSignIds[s.id]).length;

  const maxWeight = (cardinalSigns.length * 3) + (secondarySigns.length * 1.5);
  const currentWeight = (totalCardinalChecked * 3) + (totalSecondaryChecked * 1.5);

  const scorePercent = maxWeight > 0 ? Math.round((currentWeight / maxWeight) * 100) : 0;

  let confidence: 'FAIBLE' | 'MODEREE' | 'FORTE' | 'CONFIRMEE' = 'FAIBLE';
  let summaryMessage = 'Peu d’éléments cliniques caractéristiques cochés.';

  if (totalCardinalChecked === cardinalSigns.length && scorePercent >= 80) {
    confidence = 'CONFIRMEE';
    summaryMessage = 'Tous les signes cardinaux sont présents. Concordance diagnostique très élevée.';
  } else if (totalCardinalChecked >= Math.ceil(cardinalSigns.length * 0.6) || scorePercent >= 60) {
    confidence = 'FORTE';
    summaryMessage = 'Forte présomption clinique: majorité des signes cardinaux validés.';
  } else if (totalCardinalChecked >= 1 || scorePercent >= 35) {
    confidence = 'MODEREE';
    summaryMessage = 'Suspicion modérée: certains signes cardinaux manquent ou doivent être confirmés par examens.';
  }

  return {
    totalCardinalChecked,
    totalCardinalCount: cardinalSigns.length,
    totalSecondaryChecked,
    totalSecondaryCount: secondarySigns.length,
    scorePercent,
    confidence,
    summaryMessage
  };
}
