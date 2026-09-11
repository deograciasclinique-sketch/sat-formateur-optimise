import { Pathology } from './clinicalTypes';

export const METABOLIC_NEURO_PATHOLOGIES: Pathology[] = [
  {
    id: 'tetanos-aigue',
    name: 'Tétanos (Néonatal & Adulte)',
    synonyms: ['Tétanos ombilical', 'Trismus tétanique'],
    category: 'Cardiovasculaire & Neurologique',
    definition: 'Toxi-infection aiguë aiguë non immunisante due à Clostridium tetani, caractérisée par des contractures musculaires toniques douloureuses et des spasmes paroxystiques.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: true,
      category: 'IMMEDIATE_24H',
      delayNotice: 'Déclaration IMMÉDIATE OBLIGATOIRE (< 24h) au Médecin Chef de District',
      simrCode: 'SIMR-TET-01',
      caseDefinitionSuspect: 'Trismus (mâchoire serrée impossible à ouvrir) ou nouveau-né qui tétait bien les 2 premiers jours puis cesse de téter et présente des spasmes.',
      caseDefinitionConfirmed: 'Diagnostic exclusivement clinique. Aucun examen de laboratoire n’est nécessaire pour confirmer le cas.',
      laboratorySample: {
        sampleType: 'Aucun prélèvement requis (diagnostic clinique strict)',
        condition: 'N/A',
        transport: 'N/A',
        targetLab: 'Formation sanitaire locale'
      },
      mandatoryNotificationActions: [
        'Alerte immédiate au District Sanitaire (enquête d’investigation cas de tétanos néonatal).',
        'Vérification du statut vaccinal antitétanique de la mère et des femmes de la zone.'
      ]
    },
    cardinalSigns: [
      { id: 'tet_trismus', label: 'Trismus: contracture douloureuse permanente et invincible des masséters (impossibilité d’ouvrir la bouche)', weight: 3, isCardinal: true },
      { id: 'tet_facies', label: 'Faciès sardonique (sourcils froncés, yeux mi-clos, commissures labiales tirées en rictus permanent)', weight: 3, isCardinal: true },
      { id: 'tet_spasmes', label: 'Spasmes et contractures paroxystiques déclenchés par le moindre stimulus lumineux, sonore ou tactile', weight: 3, isCardinal: true },
      { id: 'tet_opisthotonos', label: 'Opisthotonos: contracture en extension du tronc formant un arc de cercle dorsal rigide', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'tet_conscience', label: 'CONSERVATION PARFAITE DE LA CONSCIENCE (le patient ressent intensément chaque spasme douloureux)', weight: 2 },
      { id: 'tet_porte', label: 'Porte d’entrée cutanée (plaie souillée, injection non stérile, soins septiques du cordon ombilical)', weight: 2 },
      { id: 'tet_dysphagie', label: 'Dysphagie précoce douloureuse (difficulté d’avaler la salive)', weight: 2 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_tet_larynx',
        label: 'SPASME LARYNGÉ AIGU OU BLOCAGE THORACIQUE PROLONGÉ',
        explanation: 'Asphyxie brutale menant à l’arrêt cardiaque hypoxique en moins de 3 minutes.',
        immediateAction: 'Isolement absolu dans le noir et le calme total. Diazépam à fortes doses (0.5-1 mg/kg). Préparer intubation ou trachéotomie d’urgence.',
        vitalSystem: 'Neurologique'
      }
    ],
    paraclinicalExams: {
      essential: ['Signe de l’abaisse-langue captif (la tentative de toucher le pharynx entraîne la morsure involontaire de l’abaisse-langue)'],
      optional: ['Ionogramme et glycémie']
    },
    differentialDiagnoses: [
      { name: 'Rage humaine', distinguishingFeatures: 'Hydrophobie terrifiante (spasme à la vue de l’eau), morsure de chien/animal, agitation maniaque.' },
      { name: 'Intoxication à la Strychnine', distinguishingFeatures: 'Absence de trismus permanent entre les crises, survenue brutale après ingestion suspecte.' },
      { name: 'Accès dystonique aigu aux neuroleptiques', distinguishingFeatures: 'Crises oculogyres associées, cède spectaculairement aux anticholinergiques (Tropatépine).' }
    ],
    standardTreatment: {
      firstLineAdult: 'HOSPITALISATION EN CHAMBRE CALME ET OBSCURE. 1. SÉDATION: Diazépam 10 mg IV toutes les 2 à 4 heures selon la fréquence des spasmes. 2. SÉRUM ANTITÉTANIQUE (SAT) 10 000 à 20 000 UI en SC/IM ou Immunoglobulines humaines 3 000 à 6 000 UI. 3. ANTIBIOTHÉRAPIE: Métronidazole 500 mg IV toutes les 8h ou Pénicilline G 10 millions UI/j. 4. VACCINATION ANTITÉTANIQUE (VAT) sur un autre site anatomique (la maladie n’est pas immunisante !). 5. Parage chirurgical doux de la plaie sous anesthésie.',
      firstLineChild: 'Néonatal: Diazépam 0.5 mg/kg toutes les 4-6h en perfusion lente + SAT ou Immunoglobulines + Métronidazole + soins locaux du cordon.',
      contraindications: ['Ne pas manipuler ni stimuler le patient inutilement (tout bruit déclenche un spasme asphyxiant fatal)', 'Ne pas faire d’injection IM douloureuse sans sédation préalable'],
      importantNotes: 'Au Burkina Faso, le tétanos néonatal fait l’objet d’un plan d’élimination prioritaire. Tout cas doit être déclaré sous 24h.'
    },
    emergencyConduct: 'Maintenir la chambre dans l’obscurité et le silence. Assurer une sédation continue et référer immédiatement en réanimation si spasmes fréquents.',
    burkinaGuidelinesRef: 'Directives Nationales pour l’Élimination du Tétanos Maternel et Néonatal au Burkina Faso.'
  },
  {
    id: 'hypoglycemie-severe',
    name: 'Hypoglycémie Sévère (Adulte & Enfant)',
    synonyms: ['Choc hypoglycémique', 'Coma hypoglycémique'],
    category: 'Métabolique & Endocrinienne',
    definition: 'Chute critique de la glycémie sanguine en dessous de 0.50 g/L (2.8 mmol/L) entraînant une souffrance cérébrale aiguë et pouvant laisser des séquelles neurologiques irréversibles en quelques dizaines de minutes.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: false,
      category: 'NON_MDO',
      delayNotice: 'Urgence métabolique vitale immédiate au cabinet ou au lit du patient',
      caseDefinitionSuspect: 'Malaise avec sueurs, pâleur, tremblements ou coma soudain chez un diabétique ou un enfant fébrile/dénutri.',
      caseDefinitionConfirmed: 'Glycémie capillaire < 0.50 g/l (< 2.8 mmol/l) régressant spectaculairement après apport de sucre.',
      laboratorySample: {
        sampleType: 'Goutte de sang capillaire sur lecteur de glycémie (glucomètre)',
        condition: 'Résultat immédiat en 5 secondes',
        transport: 'N/A',
        targetLab: 'Cabinet de consultation / CSPS'
      },
      mandatoryNotificationActions: [
        'Enregistrement de la glycémie sur la fiche d’urgence.'
      ]
    },
    cardinalSigns: [
      { id: 'hypo_glycemie', label: 'Glycémie capillaire < 0.50 g/L (< 2.8 mmol/L) au glucomètre', weight: 3, isCardinal: true },
      { id: 'hypo_sueurs', label: 'Sueurs profuses froides, pâleur cutanée et sensation de faim douloureuse aiguë', weight: 3, isCardinal: true },
      { id: 'hypo_neuro', label: 'Troubles neuro-psychiatriques soudains: confusion, propos incohérents, agressivité ou agitation inhabituelle', weight: 3, isCardinal: true },
      { id: 'hypo_coma', label: 'Coma brutal agité avec hypertonie, sueurs profuses, réflexes ostéotendineux vifs et signe de Babinski bilatéral', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'hypo_tremblements', label: 'Tremblements des extrémités et palpitations', weight: 2 },
      { id: 'hypo_visuel', label: 'Troubles visuels (diplopie, flou) ou vertiges', weight: 2 },
      { id: 'hypo_convulsions', label: 'Convulsions comitiales ou myoclonies musculaires', weight: 2 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_hypo_coma_prolonge',
        label: 'COMA HYPOGLYCÉMIQUE OU CONVULSIONS EN COURS',
        explanation: 'Destruction neuronale rapide par privation de glucose. Urgence absolue: chaque minute compte.',
        immediateAction: 'ADMINISTRATION IMMÉDIATE DE SUCRE EN IVD: Adulte: 2 à 3 ampoules de Glucosé à 30% (G30%) en IV direct immédiat. Enfant: Sérum Glucosé 10% (5 ml/kg en IVD lente).',
        vitalSystem: 'Neurologique'
      }
    ],
    paraclinicalExams: {
      essential: ['Glycémie capillaire immédiate au glucomètre', 'Recontrôle de la glycémie 15 minutes après le resucrage'],
      optional: ['Bandelette urinaire (vérifier absence de cétonurie)', 'TDR Paludisme (l’hypoglycémie accompagne souvent le paludisme grave)']
    },
    differentialDiagnoses: [
      { name: 'Coma acidocétosique diabétique', distinguishingFeatures: 'Haleine de pomme pourrie, respiration de Kussmaul lente et ample, déshydratation globale, glycémie > 2.50 g/l, cétonurie +++.' },
      { name: 'Accident Vasculaire Cérébral (AVC)', distinguishingFeatures: 'Déficit focal unilatéral sans amélioration immédiate après apport glucosé.' },
      { name: 'Accès pernicieux palustre', distinguishingFeatures: 'TDR Paludisme positif, mais une hypoglycémie peut être associée et doit être corrigée en priorité !' }
    ],
    standardTreatment: {
      firstLineAdult: 'SI LE PATIENT EST INCONSCIENT (urgence vitale): 1. Injection IV directe de 20 à 40 ml de GLUCOSÉ À 30% (2 à 3 ampoules de 10 ml) ou 200 ml de Glucosé 10%. 2. Dès le réveil: resucrage oral avec sucres lents (pain, bouillie) et sucres rapides (eau sucrée: 3 à 4 morceaux de sucre). 3. Maintenir une perfusion de Glucosé 5% ou 10% si cause par sulfamides hypoglycémiants (Glibenclamide). SI CONSCIENT: donner 15g de sucre rapide (3 morceaux de sucre ou jus sucré), recontrôler après 15 minutes.',
      firstLineChild: 'Enfant inconscient: GLUCOSÉ 10% (G10%) à la dose de 5 ml/kg en IV lente sur 3-5 minutes, puis perfusion continue de G10%. Si abord veineux impossible: frotter du sucre humide ou miel sur la face interne des joues (voie transmuqueuse jugale) sans faire avaler de liquide.',
      contraindications: ['Ne JAMAIS faire avaler de liquide sucré à un patient comateux ou somnolent (risque majeur d’inhalation asphyxiante mortelle)', 'Ne pas injecter de G30% pur chez le jeune enfant (utiliser impérativement le G10%)'],
      importantNotes: 'Au Burkina Faso, devant tout enfant léthargique ou comateux (notamment avec paludisme grave ou dénutrition), le réflexe N°1 est la glycémie capillaire et le resucrage d’urgence.'
    },
    emergencyConduct: 'Resucrage immédiat sur place. Ne jamais référer un patient en coma hypoglycémique sans avoir injecté de glucose au préalable.',
    burkinaGuidelinesRef: 'Protocoles de Prise en Charge des Urgences Métaboliques (Ministère de la Santé du Burkina Faso).'
  }
];
