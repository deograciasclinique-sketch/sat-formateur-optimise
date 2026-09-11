import { PatientVitals } from '../modules/epidemio/clinicalTypes';

export interface VitalAlert {
  parameter: string;
  value: string;
  severity: 'DANGER' | 'WARNING' | 'NORMAL';
  message: string;
  immediateRecommendation: string;
}

export function evaluateVitals(
  vitals: PatientVitals,
  ageCategory: 'Nourrisson' | 'Enfant' | 'Adulte' | 'FemmeEnceinte' | 'PostPartum' = 'Adulte'
): {
  overallStatus: 'DANGER' | 'WARNING' | 'NORMAL';
  alerts: VitalAlert[];
  dangerCount: number;
} {
  const alerts: VitalAlert[] = [];

  // 1. Température
  if (vitals.temperature !== undefined) {
    if (vitals.temperature < 35.5) {
      alerts.push({
        parameter: 'Température',
        value: `${vitals.temperature} °C`,
        severity: 'DANGER',
        message: 'Hypothermie sévère: risque vital chez le nourrisson ou malnutri.',
        immediateRecommendation: 'Réchauffer immédiatement peau à peau (Kangaroo) ou couvertures chaudes. Rechercher un choc septique.'
      });
    } else if (vitals.temperature >= 39.5) {
      alerts.push({
        parameter: 'Température',
        value: `${vitals.temperature} °C`,
        severity: 'WARNING',
        message: 'Hyperthermie majeure (> 39.5°C): risque de convulsions fébriles.',
        immediateRecommendation: 'Déshabiller, Paracétamol 15 mg/kg ou 1g adulte, TDR Paludisme immédiat.'
      });
    } else {
      alerts.push({
        parameter: 'Température',
        value: `${vitals.temperature} °C`,
        severity: 'NORMAL',
        message: vitals.temperature >= 37.5 ? 'Fébricule ou fièvre modérée' : 'Apyrétique',
        immediateRecommendation: vitals.temperature >= 37.5 ? 'Surveillance et TDR si fièvre' : 'Normale'
      });
    }
  }

  // 2. Tension Artérielle
  if (vitals.systolicBP !== undefined) {
    const sys = vitals.systolicBP;
    const dia = vitals.diastolicBP ?? 0;

    if (sys < 90) {
      alerts.push({
        parameter: 'Tension Artérielle',
        value: `${sys}/${dia} mmHg`,
        severity: 'DANGER',
        message: 'Hypotension critique: suspicion d’état de choc ou collapsus hypovolémique/septique.',
        immediateRecommendation: 'Voie veineuse de gros calibre, surélévation des jambes, remplissage Ringer Lactate ou Sérum Phy.'
      });
    } else if (sys >= 160 || dia >= 110) {
      alerts.push({
        parameter: 'Tension Artérielle',
        value: `${sys}/${dia} mmHg`,
        severity: 'DANGER',
        message: ageCategory === 'FemmeEnceinte' || ageCategory === 'PostPartum'
          ? 'URGENCE OBSTÉTRICALE: Risque imminent d’éclampsie ou d’AVC gravidique.'
          : 'Crise hypertensive sévère avec risque d’atteinte viscérale.',
        immediateRecommendation: ageCategory === 'FemmeEnceinte' || ageCategory === 'PostPartum'
          ? 'Sulfate de magnésium protocole de Pritchard + Nicardipine/Hydralazine. Sonde vésicale.'
          : 'Mise au repos strict, traitement antihypertenseur d’urgence.'
      });
    } else if (sys >= 140 || dia >= 90) {
      alerts.push({
        parameter: 'Tension Artérielle',
        value: `${sys}/${dia} mmHg`,
        severity: 'WARNING',
        message: 'Hypertension artérielle modérée (Grade 1/2).',
        immediateRecommendation: 'Contrôler après 15 min de repos. Bandelette urinaire si femme enceinte.'
      });
    } else {
      alerts.push({
        parameter: 'Tension Artérielle',
        value: `${sys}/${dia} mmHg`,
        severity: 'NORMAL',
        message: 'Normotension artérielle.',
        immediateRecommendation: 'Paramètre stable'
      });
    }
  }

  // 3. Fréquence Cardiaque (Pouls)
  if (vitals.pulse !== undefined) {
    const hr = vitals.pulse;
    if (hr > 125) {
      alerts.push({
        parameter: 'Pouls / FC',
        value: `${hr} bpm`,
        severity: 'DANGER',
        message: 'Tachycardie extrême: signe précoce de choc, déshydratation aiguë ou détresse respiratoire.',
        immediateRecommendation: 'Rechercher état de choc, anémie sévère ou hypovolémie.'
      });
    } else if (hr < 50 && (ageCategory === 'Adulte' || ageCategory === 'FemmeEnceinte')) {
      alerts.push({
        parameter: 'Pouls / FC',
        value: `${hr} bpm`,
        severity: 'DANGER',
        message: 'Bradycardie sévère: risque de syncope ou d’arrêt cardiocirculatoire.',
        immediateRecommendation: 'Surveillance ECG immédiate, préparer Atropine si collapsus.'
      });
    } else {
      alerts.push({
        parameter: 'Pouls / FC',
        value: `${hr} bpm`,
        severity: 'NORMAL',
        message: 'Rythme cardiaque dans les normes acceptables.',
        immediateRecommendation: 'Stable'
      });
    }
  }

  // 4. Fréquence Respiratoire
  if (vitals.respiratoryRate !== undefined) {
    const rr = vitals.respiratoryRate;
    const isBaby = ageCategory === 'Nourrisson';
    const isChild = ageCategory === 'Enfant';

    const thresholdDanger = isBaby ? 60 : isChild ? 50 : 32;

    if (rr >= thresholdDanger) {
      alerts.push({
        parameter: 'Fréquence Respiratoire',
        value: `${rr} /min`,
        severity: 'DANGER',
        message: 'Polypnée de détresse respiratoire ou acidose métabolique sévère.',
        immediateRecommendation: 'Mettre sous Oxygène immédiat. Évaluer tirage sous-costal et ausculter poumons.'
      });
    } else if (rr < 10) {
      alerts.push({
        parameter: 'Fréquence Respiratoire',
        value: `${rr} /min`,
        severity: 'DANGER',
        message: 'Bradypnée critique: épuisement respiratoire et arrêt imminent.',
        immediateRecommendation: 'Ventilation au ballon masque auto-remplisseur (Ambu) avec O2 100%.'
      });
    } else {
      alerts.push({
        parameter: 'Fréquence Respiratoire',
        value: `${rr} /min`,
        severity: 'NORMAL',
        message: 'Fréquence respiratoire normale.',
        immediateRecommendation: 'Stable'
      });
    }
  }

  // 5. SpO2
  if (vitals.spo2 !== undefined) {
    if (vitals.spo2 < 90) {
      alerts.push({
        parameter: 'Saturation SpO2',
        value: `${vitals.spo2} %`,
        severity: 'DANGER',
        message: 'Hypoxémie sévère mettant en jeu le pronostic vital immédiat.',
        immediateRecommendation: 'Oxygène au masque à haute concentration ou lunettes nasales sans délai.'
      });
    } else if (vitals.spo2 < 94) {
      alerts.push({
        parameter: 'Saturation SpO2',
        value: `${vitals.spo2} %`,
        severity: 'WARNING',
        message: 'Désaturation modérée: surveillance rapprochée.',
        immediateRecommendation: 'Position demi-assise, oxygène disponible.'
      });
    } else {
      alerts.push({
        parameter: 'Saturation SpO2',
        value: `${vitals.spo2} %`,
        severity: 'NORMAL',
        message: 'Oxygénation adéquate en air ambiant.',
        immediateRecommendation: 'Normale'
      });
    }
  }

  // 6. Glycémie
  if (vitals.glycemia !== undefined) {
    if (vitals.glycemia < 0.50) {
      alerts.push({
        parameter: 'Glycémie Capillaire',
        value: `${vitals.glycemia} g/L`,
        severity: 'DANGER',
        message: 'HYPOGLYCÉMIE SÉVÈRE: Risque de destruction neuronale irréversible ou coma.',
        immediateRecommendation: 'Adulte: Glucosé 30% IV direct (20-30 ml). Enfant: Glucosé 10% 5 ml/kg IV lente.'
      });
    } else if (vitals.glycemia > 2.50) {
      alerts.push({
        parameter: 'Glycémie Capillaire',
        value: `${vitals.glycemia} g/L`,
        severity: 'WARNING',
        message: 'Hyperglycémie majeure: risque d’acidocétose diabétique.',
        immediateRecommendation: 'Bandelette urinaire pour cétonurie, hydratation Sérum Salé 0.9%.'
      });
    } else {
      alerts.push({
        parameter: 'Glycémie Capillaire',
        value: `${vitals.glycemia} g/L`,
        severity: 'NORMAL',
        message: 'Normoglycémie.',
        immediateRecommendation: 'Normale'
      });
    }
  }

  // 7. TRC (Temps de recoloration cutanée)
  if (vitals.capillaryRefillTime !== undefined && vitals.capillaryRefillTime > 2.5) {
    alerts.push({
      parameter: 'TRC (Recoloration)',
      value: `${vitals.capillaryRefillTime} sec`,
      severity: 'DANGER',
      message: 'Hypoperfusion tissulaire périphérique: signe d’état de choc circulatoire.',
      immediateRecommendation: 'Remplissage vasculaire immédiat au Ringer Lactate ou Sérum Salé.'
    });
  }

  // 8. Périmètre brachial (MUAC)
  if (vitals.muac !== undefined && vitals.muac < 115) {
    alerts.push({
      parameter: 'Périmètre Brachial (MUAC)',
      value: `${vitals.muac} mm`,
      severity: 'DANGER',
      message: 'MALNUTRITION AIGUË SÉVÈRE (Bandelette rouge de Shakir < 115 mm).',
      immediateRecommendation: 'Test d’appétit aux ATPE. Si échec ou complication: hospitalisation immédiate en CRENI.'
    });
  }

  const dangerCount = alerts.filter(a => a.severity === 'DANGER').length;
  const warningCount = alerts.filter(a => a.severity === 'WARNING').length;

  let overallStatus: 'DANGER' | 'WARNING' | 'NORMAL' = 'NORMAL';
  if (dangerCount > 0) overallStatus = 'DANGER';
  else if (warningCount > 0) overallStatus = 'WARNING';

  return {
    overallStatus,
    alerts,
    dangerCount
  };
}
