export interface DangerSignItem {
  id: string;
  category: 'PCIME_ENFANT' | 'SONU_MATERNITE' | 'VITAL_GENERAL' | 'CHOC_SEPSIS';
  title: string;
  description: string;
  immediateAction: string;
  iconName: string;
  criticalLevel: 'ABSOLUTE' | 'SEVERE';
}

export const DANGER_SIGNS_PCIME: DangerSignItem[] = [
  {
    id: 'pcime_drink',
    category: 'PCIME_ENFANT',
    title: 'Incapable de boire ou de téter',
    description: 'Enfant trop faible pour téter le sein ou boire à la cuillère/tasse. Signe d’épuisement vital ou collapsus.',
    immediateAction: 'Poser voie veineuse d’urgence. Hydratation prudente ou SNG avec surveillance. Référer d’urgence.',
    iconName: 'AlertTriangle',
    criticalLevel: 'ABSOLUTE'
  },
  {
    id: 'pcime_vomit',
    category: 'PCIME_ENFANT',
    title: 'Vomissements incoercibles (vomit tout)',
    description: 'Rejette immédiatement toute boisson, aliment ou médicament administré. Risque d’hypoglycémie et déshydratation aiguë.',
    immediateAction: 'Ne pas insister par voie orale. Traitement par voie parentérale (IV/IM). Vérifier glycémie capillaire.',
    iconName: 'AlertOctagon',
    criticalLevel: 'SEVERE'
  },
  {
    id: 'pcime_convulsions',
    category: 'PCIME_ENFANT',
    title: 'Convulsions récentes ou en cours',
    description: 'Secousses musculaires involontaires fébriles ou apyrétiques durant l’épisode actuel.',
    immediateAction: 'Diazépam intra-rectal 0.5 mg/kg si crise > 5 min. Position latérale de sécurité (PLS), libérer voies aériennes, O2, glycémie capillaire d’urgence.',
    iconName: 'Zap',
    criticalLevel: 'ABSOLUTE'
  },
  {
    id: 'pcime_lethargy',
    category: 'PCIME_ENFANT',
    title: 'Léthargie ou Inconscience (coma)',
    description: 'Enfant anormalement somnolent, ne réagit pas à la voix ou ne suit pas du regard, hypotonique ou comateux.',
    immediateAction: 'Recherche immédiate d’un coma palustre (TDR/Artésunate IV), méningite (PL) ou hypoglycémie (G10% IV direct 5 ml/kg). Référer d’urgence.',
    iconName: 'Moon',
    criticalLevel: 'ABSOLUTE'
  },
  {
    id: 'pcime_stridor',
    category: 'PCIME_ENFANT',
    title: 'Tirage sous-costal sévère / Stridor au repos',
    description: 'Dépression de la paroi thoracique inférieure à l’inspiration au repos. Bruit rauque inspiratoire.',
    immediateAction: 'Mettre sous Oxygène 1-2 L/min lunettes ou masque. Position demi-assise. Évaluer pneumonie sévère ou corps étranger.',
    iconName: 'Activity',
    criticalLevel: 'ABSOLUTE'
  },
  {
    id: 'pcime_edema',
    category: 'PCIME_ENFANT',
    title: 'Malnutrition Aiguë Sévère avec œdèmes bilatéraux',
    description: 'Œdèmes prenant le godet aux deux pieds/jambes (Kwashiorkor) ou périmètre brachial < 115 mm avec anorexie.',
    immediateAction: 'Hospitalisation en CRENI (CMA/CHR). Ne pas perfuser brutalement ! Lait F-75, antibiothérapie systématique, réchauffement.',
    iconName: 'ShieldAlert',
    criticalLevel: 'SEVERE'
  }
];

export const DANGER_SIGNS_MATERNITE: DangerSignItem[] = [
  {
    id: 'sonu_hemorrhage',
    category: 'SONU_MATERNITE',
    title: 'Saignement vaginal abondant (Hémorragie)',
    description: 'Perte de sang rouge vif imbibant les pagnes en quelques minutes, avant l’accouchement ou dans le post-partum.',
    immediateAction: 'Poser 2 voies veineuses gros calibre (16G/18G). Ringer Lactate rapide. Ocytocine 20-40 UI. Compression bimanuelle si utérus atone. Évacuation chirurgicale.',
    iconName: 'Droplet',
    criticalLevel: 'ABSOLUTE'
  },
  {
    id: 'sonu_eclampsia',
    category: 'SONU_MATERNITE',
    title: 'Convulsions ou Céphalées intenses + Troubles visuels',
    description: 'Signe d’éclampsie ou pré-éclampsie sévère imminente (mouches volantes, flou visuel, bourdonnements, barre épigastrique).',
    immediateAction: 'Sulfate de Magnésium protocole de Pritchard (4g IV lent + 10g IM). Nicardipine si TAS > 160. Sonde urinaire. Transfert SAMU obstétrical.',
    iconName: 'ZapOff',
    criticalLevel: 'ABSOLUTE'
  },
  {
    id: 'sonu_fever',
    category: 'SONU_MATERNITE',
    title: 'Fièvre élevée > 38.5°C avec écoulement fétide',
    description: 'Suspicion de chorioamniotite ou d’infection puerpérale sévère / septicémie du post-partum.',
    immediateAction: 'Triple antibiothérapie IV (Ampicilline + Gentamicine + Métronidazole). Hydratation IV. Référence urgente.',
    iconName: 'Flame',
    criticalLevel: 'SEVERE'
  },
  {
    id: 'sonu_labor_arrest',
    category: 'SONU_MATERNITE',
    title: 'Travail prolongé > 12h ou dystocie mécanique',
    description: 'Arrêt de progression du mobile fœtal, contractions tétaniques, anneau de Bandl (menace de rupture utérine).',
    immediateAction: 'Arrêt de tout utérotonique. Voie veineuse. Décubitus latéral gauche. Référence immédiate pour CÉSARIENNE d’urgence.',
    iconName: 'Clock',
    criticalLevel: 'ABSOLUTE'
  }
];

export const DANGER_SIGNS_VITALS_ABCDE: DangerSignItem[] = [
  {
    id: 'vital_shock',
    category: 'CHOC_SEPSIS',
    title: 'État de Choc & Collapsus Circulatoire',
    description: 'Tension artérielle systolique < 90 mmHg, pouls rapide et filant > 115/min, marbrures cutanées, extrémités froides, TRC > 3 secondes.',
    immediateAction: 'Voie veineuse 16/18G, bolus Sérum Physiologique ou Ringer Lactate 20 ml/kg chez l’enfant (500-1000 ml chez l’adulte en 15 min). Oxygène.',
    iconName: 'HeartCrack',
    criticalLevel: 'ABSOLUTE'
  },
  {
    id: 'vital_hypoxia',
    category: 'VITAL_GENERAL',
    title: 'Détresse Respiratoire Aiguë / Hypoxie',
    description: 'Fréquence respiratoire > 35/min ou < 10/min, saturation SpO2 < 90%, tirage intercostal et sus-sternal, battement des ailes du nez, cyanose des lèvres.',
    immediateAction: 'Oxygène au masque à haute concentration (6-10 L/min) ou lunettes nasales. Position demi-assise. Aspirer sécrétions.',
    iconName: 'Wind',
    criticalLevel: 'ABSOLUTE'
  },
  {
    id: 'vital_hypoglycemia',
    category: 'VITAL_GENERAL',
    title: 'Hypoglycémie Sévère (< 0.50 g/L ou < 2.8 mmol/L)',
    description: 'Sueurs profuses, pâleur, agitation, confusion, coma avec réflexes vifs, convulsions.',
    immediateAction: 'Enfant: Sérum glucosé 10% (G10%) 5 ml/kg en IV lente ou SNG. Adulte: 2 à 3 ampoules de Glucosé à 30% (G30%) en IV direct immédiat.',
    iconName: 'BatteryLow',
    criticalLevel: 'ABSOLUTE'
  }
];
