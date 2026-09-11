export type EmergencyLevel = 'CRITICAL' | 'HIGH' | 'MODERATE' | 'NONE';

export type MDOCategory = 'IMMEDIATE_24H' | 'HEBDO_TLM' | 'MENSUEL' | 'NON_MDO';

export type PathologyCategory =
  | 'Infectieuse & Parasitaire'
  | 'Pédiatrique & PCIME'
  | 'Obstétricale & Gynécologique'
  | 'Chirurgicale & Abdominale'
  | 'Respiratoire'
  | 'Cardiovasculaire & Neurologique'
  | 'Métabolique & Endocrinienne';

export interface ClinicalSign {
  id: string;
  label: string;
  explanation?: string;
  weight: number; // 3 = cardinal/majeur, 2 = important, 1 = mineur
  isCardinal?: boolean;
}

export interface EmergencyRedFlag {
  id: string;
  label: string;
  explanation: string;
  immediateAction: string;
  vitalSystem: 'Neurologique' | 'Respiratoire' | 'Circulatoire' | 'Obstétrical' | 'Abdominal' | 'Sepsis';
}

export interface MDODefinition {
  isMDO: boolean;
  category: MDOCategory;
  delayNotice: string; // e.g. "Immédiate (< 24 heures) au MCD/CISSE"
  simrCode?: string;
  caseDefinitionSuspect: string;
  caseDefinitionProbable?: string;
  caseDefinitionConfirmed: string;
  laboratorySample: {
    sampleType: string;
    condition: string;
    transport: string;
    targetLab: string;
  };
  epidemicThreshold?: string;
  mandatoryNotificationActions: string[];
}

export interface Pathology {
  id: string;
  name: string;
  synonyms?: string[];
  category: PathologyCategory;
  definition: string;
  isEmergency: boolean;
  emergencyLevel: EmergencyLevel;
  mdoInfo: MDODefinition;
  cardinalSigns: ClinicalSign[];
  secondarySigns: ClinicalSign[];
  emergencyRedFlags: EmergencyRedFlag[];
  paraclinicalExams: {
    essential: string[];
    optional: string[];
  };
  differentialDiagnoses: {
    pathologyId?: string;
    name: string;
    distinguishingFeatures: string;
  }[];
  standardTreatment: {
    firstLineAdult: string;
    firstLineChild?: string;
    contraindications?: string[];
    importantNotes?: string;
  };
  emergencyConduct?: string;
  burkinaGuidelinesRef: string;
}

export interface PatientVitals {
  temperature?: number; // °C
  systolicBP?: number; // mmHg
  diastolicBP?: number; // mmHg
  pulse?: number; // bpm
  respiratoryRate?: number; // /min
  spo2?: number; // %
  glycemia?: number; // g/L ou mmol/L
  capillaryRefillTime?: number; // secondes
  muac?: number; // mm (Périmètre brachial chez enfant)
  weight?: number; // kg
  height?: number; // cm
  edemaFeet?: boolean;
}

export interface PatientProfile {
  id: string;
  referenceNumber?: string;
  nameOrInitials: string;
  ageYears?: number;
  ageMonths?: number;
  ageDays?: number;
  ageCategory: 'Nourrisson' | 'Enfant' | 'Adulte' | 'FemmeEnceinte' | 'PostPartum';
  gender: 'M' | 'F';
  isPregnant?: boolean;
  gestationalWeeks?: number;
  consultationReason: string;
  vitals: PatientVitals;
  healthFacilityName: string; // Nom du CSPS / CMA / CHU
  healthDistrict: string; // District Sanitaire (ex: Bogodogo, Baskuy, Sig-Noghin, etc.)
  examinerName: string; // Nom et qualification du consultant
}

export interface ConsultationSession {
  patient: PatientProfile;
  selectedPathologyId: string | null;
  checkedSigns: Record<string, boolean>; // signId -> boolean
  checkedRedFlags: Record<string, boolean>; // redFlagId -> boolean
  additionalObservations: string;
  diagnosticConfidence: 'NON_EVALUE' | 'FAIBLE' | 'MODEREE' | 'FORTE' | 'CONFIRME_LABO';
  consultationDecision: 'AMBULATOIRE' | 'OBSERVATION_CABINET' | 'OBSERVATION_CSPS' | 'HOSPITALISATION' | 'EVACUATION_URGENCE';
  referralFacility?: string;
  actionsPerformed: string[];
  createdAt: string;
}
