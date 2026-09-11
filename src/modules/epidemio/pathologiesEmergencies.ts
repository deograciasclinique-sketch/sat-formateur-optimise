import { Pathology } from './clinicalTypes';

export const EMERGENCY_PATHOLOGIES: Pathology[] = [
  {
    id: 'eclampsie-preeclampsie-severe',
    name: 'Éclampsie & Pré-éclampsie Sévère',
    synonyms: ['Toxémie gravidique sévère', 'Crise d’éclampsie'],
    category: 'Obstétricale & Gynécologique',
    definition: 'Complication hypertensive majeure de la grossesse (> 20 SA) ou du post-partum, associant HTA sévère, protéinurie, signes de souffrance cérébrale ou crises convulsives.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: false,
      category: 'NON_MDO',
      delayNotice: 'Non MDO épidémique, mais notification obligatoire dans le registre de surveillance de la mortalité maternelle et néonatale (MDSR)',
      caseDefinitionSuspect: 'Femme enceinte ou accouchée avec TA ≥ 160/110 mmHg ou céphalées tenaces, troubles visuels ou convulsions.',
      caseDefinitionConfirmed: 'HTA sévère avec protéinurie ≥ ++ à la bandelette avec signes neurosensoriels ou convulsions tonicocloniques.',
      laboratorySample: {
        sampleType: 'Urines pour bandelette urinaire (protéinurie) et sang pour bilan HELLP',
        condition: 'Bandelette urinaire immédiate au lit de la patiente',
        transport: 'Laboratoire de référence si bilan complet',
        targetLab: 'CMA / CHR / CHU'
      },
      mandatoryNotificationActions: [
        'Enregistrement systématique sur le registre SONU (Soins Obstétricaux et Néonatals d’Urgence).',
        'Audit de décès maternel si évolution défavorable.'
      ]
    },
    cardinalSigns: [
      { id: 'ecl_ta', label: 'Hypertension artérielle sévère: TA systolique ≥ 160 mmHg et/ou diastolique ≥ 110 mmHg', weight: 3, isCardinal: true },
      { id: 'ecl_proteinurie', label: 'Protéinurie massive ≥ ++ à la bandelette urinaire (ou ≥ 2g/24h)', weight: 3, isCardinal: true },
      { id: 'ecl_neuro', label: 'Signes neurosensoriels de danger: céphalées pulsatiles rebelles, phosphènes (mouches volantes), flou visuel, acouphènes', weight: 3, isCardinal: true },
      { id: 'ecl_convulsions', label: 'Crise convulsive tonicoclonique généralisée (stade d’invasion, tonique, clonique puis coma post-critique)', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'ecl_chaussier', label: 'Barre épigastrique ou douleur vive de l’hypochondre droit (signe de Chaussier: distension capsule de Glisson)', weight: 2 },
      { id: 'ecl_rot', label: 'Hyperréflexie ostéotendineuse polycinétique avec clonus de la cheville', weight: 2 },
      { id: 'ecl_oedemes', label: 'Œdèmes massifs d’installation brutale (visage bouffi, mains, membres inférieurs)', weight: 2 },
      { id: 'ecl_oligurie', label: 'Oligurie (< 400 ml/24h ou < 30 ml/h)', weight: 1 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_ecl_arret',
        label: 'CONVULSION ACTIVE OU COMA ÉCLAMPTIQUE PERSISTANT',
        explanation: 'Risque imminent d’hémorragie cérébro-méningée, hématome sous-capsulaire du foie rompu ou décès materno-fœtal.',
        immediateAction: 'Administration IMMÉDIATE de Sulfate de Magnésium (schéma de Pritchard). Pose de sonde urinaire. Appel SAMU obstétrical pour extraction fœtale d’urgence.',
        vitalSystem: 'Obstétrical'
      },
      {
        id: 'flag_ecl_hrap',
        label: 'Hématome Rétro-Placentaire (HRP): Utérus de bois dur et douloureux en permanence',
        explanation: 'Décollement prématuré du placenta mettant en jeu le pronostic vital de la mère et du fœtus.',
        immediateAction: 'Évacuation chirurgicale immédiate (Césarienne de sauvetage). Deux voies veineuses, oxygène, commande de sang.',
        vitalSystem: 'Obstétrical'
      }
    ],
    paraclinicalExams: {
      essential: ['Bandelette urinaire immédiate (Protéinurie)', 'Tension artérielle aux deux bras répétée', 'Bilan HELLP (NFS plaquettes, Transaminases, Créatinine)'],
      optional: ['Uricémie', 'Échographie obstétricale avec Doppler']
    },
    differentialDiagnoses: [
      { name: 'Épilepsie préexistante', distinguishingFeatures: 'Antécédents connus de comitialité, absence d’HTA sévère et de protéinurie.' },
      { name: 'Méningite cérébrospinale', distinguishingFeatures: 'Fièvre au premier plan, raideur de nuque, pas d’HTA gravidique typique.' },
      { name: 'Accident Vasculaire Cérébral (AVC hémorragique ou thrombophlébite cérébrale)', distinguishingFeatures: 'Déficit focal moteur franc (hémiplégie, aphasie).' }
    ],
    standardTreatment: {
      firstLineAdult: 'SULFATE DE MAGNÉSIUM (Protocole de Pritchard): Dose de charge: 4 g IV lent à 20% en 10-15 minutes + 10 g IM à 50% (5 g dans chaque fesse profondément). Puis dose d’entretien: 5 g IM toutes les 4 heures en alternant les fesses jusqu’à 24h après l’accouchement. Antihypertenseur si PAD ≥ 110 mmHg: Nicardipine IV (1 à 2 mg/h) ou Hydralazine 5 mg IVD lente répétée ou Méthyldopa oral.',
      contraindications: ['Ne jamais renouveler l’injection de Sulfate de Magnésium si: ROT rotuliens abolis, FR < 16/min, ou diurèse < 30 ml/h (disposer de GLUCONATE DE CALCIUM 1g IV comme antidote)'],
      importantNotes: 'Le seul traitement curatif définitif de l’éclampsie est la délivrance fœto-placentaire (évacuation utérine).'
    },
    emergencyConduct: 'Voie veineuse 16G/18G, Sulfate de Magnésium sans retard, oxygénothérapie, canule buccale atraumatique, sonde urinaire à demeure avec sac collecteur gradué, transfert immédiat en salle de césarienne.',
    burkinaGuidelinesRef: 'Directives Nationales pour les Soins Obstétricaux et Néonatals d’Urgence (SONU) - Ministère de la Santé du Burkina Faso.'
  },
  {
    id: 'hemorragie-post-partum',
    name: 'Hémorragie du Post-Partum Immédiat (HPP)',
    synonyms: ['Hémorragie de la délivrance', 'Postpartum hemorrhage'],
    category: 'Obstétricale & Gynécologique',
    definition: 'Saignement génital anormal > 500 ml après accouchement par voie basse (ou > 1000 ml après césarienne) survenant dans les 24 heures suivant la délivrance.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: false,
      category: 'NON_MDO',
      delayNotice: 'Cause N°1 de mortalité maternelle au Burkina Faso - Fiche d’audit de décès maternel obligatoire (MDSR)',
      caseDefinitionSuspect: 'Perte de sang génital anormale continue ou en caillots après la naissance de l’enfant.',
      caseDefinitionConfirmed: 'Saignement > 500 ml avec utérus mal rétracté (atone) ou instabilité hémodynamique.',
      laboratorySample: {
        sampleType: 'Groupe sanguin / Rhésus et test de compatibilité immédiats',
        condition: 'Demande urgente de concentrés de globules rouges',
        transport: 'Au Centre Régional de Transfusion Sanguine (CRTS)',
        targetLab: 'Banque de sang du CMA / CHR / CHU'
      },
      mandatoryNotificationActions: [
        'Enregistrement sur le registre de la maternité.',
        'Notification de surveillance des complications obstétricales au district.'
      ]
    },
    cardinalSigns: [
      { id: 'hpp_saignement', label: 'Saignement vaginal abondant continu, rouge vif ou en caillots, imbibant le lit/les pagnes', weight: 3, isCardinal: true },
      { id: 'hpp_atone', label: 'Utérus mou, flasque, non rétracté, dépassant l’ombilic (atonie utérine: 80% des cas)', weight: 3, isCardinal: true },
      { id: 'hpp_choc', label: 'Signes de collapsus hypovolémique: TA systolique < 90 mmHg, tachycardie > 115 bpm, pâleur conjonctivale intense, soif d’air', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'hpp_placenta', label: 'Placenta incomplet à l’examen des membranes ou des cotylédons (rétention placentaire)', weight: 2 },
      { id: 'hpp_dechirure', label: 'Déchirure visible du col, du vagin ou du périnée avec saignement sous utérus bien rétracté', weight: 2 },
      { id: 'hpp_sueurs', label: 'Sueurs froides, agitation angoissée et vertiges', weight: 1 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_hpp_choc_incontrolable',
        label: 'CHOC HÉMORRAGIQUE MAJEUR AVEC COAGULOPATHIE DE CONSOMMATION',
        explanation: 'Perte sanguine massive non jugulée conduisant à l’arrêt cardiaque en quelques dizaines de minutes.',
        immediateAction: 'Appel d’aide immédiat ! Deux voies 16G, remplissage rapide Ringer Lactate, Ocytocine 20-40 UI, Acide Tranexamique 1g IV en 10 min, massage utérin bimanuel ou compression aortique externe.',
        vitalSystem: 'Obstétrical'
      }
    ],
    paraclinicalExams: {
      essential: ['Groupage Rhésus (2 déterminations)', 'Hémoglobine immédiate (Hémocue)', 'Test de coagulation au lit du malade (tube sec: absence de caillot après 7 min)'],
      optional: ['NFS, plaquettes, TP, TCA, Fibrinogène']
    },
    differentialDiagnoses: [
      { name: 'Rupture utérine', distinguishingFeatures: 'Survient avant ou pendant le travail, douleur syncopale foudroyante, disparition des bruits du cœur fœtal, fœtus palpé sous la peau.' },
      { name: 'Inversion utérine', distinguishingFeatures: 'Masse rouge piriforme visible à la vulve, douleur extrême avec choc neurogénique.' }
    ],
    standardTreatment: {
      firstLineAdult: '1. MASSAGE UTÉRIN immédiat. 2. OCYTOCINE: 20 à 40 UI dans 1 litre de Ringer Lactate à débit rapide + 10 UI IM. 3. Si atonie persistante: MISOPROSTOL 800 µg par voie sublinguale ou rectale. 4. ACIDE TRANEXAMIQUE: 1 g en IV lente (en 10 minutes) administré dans les 3 premières heures suivant le saignement. 5. Révision utérine aseptique sous antibiotiques pour vérifier la vacuité. 6. Examen minutieux sous valves du col et du vagin pour suturer toute déchirure.',
      contraindications: ['Ne jamais utiliser de dérivés de l’ergot de seigle (Méthergin) si patiente hypertendue ou pré-éclamptique'],
      importantNotes: 'En cas d’échec des utérotoniques: réaliser un TAMPONNEMENT PAR BALLONNET INTRA-UTÉRIN (Ballon de Bakri ou sonde de Foley avec préservatif rempli d’eau salée 300-500 ml) pour permettre le transport au bloc opératoire.'
    },
    emergencyConduct: 'Compression bimanuelle continue de l’utérus ou compression externe de l’aorte abdominale contre le rachis avec le poing pendant le transport d’urgence au bloc chirurgical du CMA/CHR.',
    burkinaGuidelinesRef: 'Protocole National SONU de Prise en Charge de l’Hémorragie du Post-Partum (Ministère de la Santé du Burkina Faso).'
  },
  {
    id: 'pneumonie-severe-enfant',
    name: 'Pneumonie Aiguë Sévère de l’Enfant (Classification PCIME)',
    synonyms: ['Infection Respiratoire Aiguë Basse Sévère', 'Pneumopathie bactérienne grave'],
    category: 'Pédiatrique & PCIME',
    definition: 'Infection aiguë du parenchyme pulmonaire chez l’enfant de 2 mois à 5 ans, caractérisée par une détresse respiratoire ou la présence de signes généraux de danger PCIME.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: false,
      category: 'NON_MDO',
      delayNotice: 'Suivi hebdomadaire des IRA basses dans les statistiques PCIME du district sanitaire',
      caseDefinitionSuspect: 'Enfant toussant ou ayant une respiration difficile avec polypnée selon la tranche d’âge.',
      caseDefinitionConfirmed: 'Toux ou respiration difficile AVEC tirage sous-costal ou signe général de danger PCIME ou saturation SpO2 < 90%.',
      laboratorySample: {
        sampleType: 'Prélèvement nasopharyngé ou hémoculture si disponible en milieu hospitalier',
        condition: 'Milieu stérile',
        transport: 'Laboratoire du CMA/CHR',
        targetLab: 'CMA / CHR'
      },
      mandatoryNotificationActions: [
        'Enregistrement sur le registre de consultation PCIME.',
        'Déclaration mensuelle dans le RMA des cas d’IRA graves.'
      ]
    },
    cardinalSigns: [
      { id: 'pneu_toux', label: 'Toux et/ou respiration difficile d’apparition récente', weight: 3, isCardinal: true },
      { id: 'pneu_polypnee', label: 'Respiration rapide (FR ≥ 50/min chez 2-11 mois; FR ≥ 40/min chez 1-5 ans)', weight: 3, isCardinal: true },
      { id: 'pneu_tirage', label: 'Tirage sous-costal marqué (la paroi thoracique inférieure s’enfonce à chaque inspiration)', weight: 3, isCardinal: true },
      { id: 'pneu_rales', label: 'Foyer de râles crépitants localisés ou souffle tubaire à l’auscultation pulmonaire', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'pneu_fievre', label: 'Fièvre élevée (> 38.5°C) ou parfois hypothermie chez le tout petit nourrisson', weight: 2 },
      { id: 'pneu_battement', label: 'Battement des ailes du nez à l’inspiration', weight: 2 },
      { id: 'pneu_geignement', label: 'Geignement expiratoire auditif (grunting sonore à chaque expiration)', weight: 2 },
      { id: 'pneu_abdo', label: 'Douleur abdominale réactionnelle (pneumonie de la base)', weight: 1 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_pneu_danger_pcime',
        label: 'PRÉSENCE D’UN SIGNE GÉNÉRAL DE DANGER PCIME (Incapable de boire/téter, vomit tout, léthargie, convulsions)',
        explanation: 'Défaillance globale menaçant la survie de l’enfant dans les heures à venir.',
        immediateAction: 'Oxygène par lunettes 1-2 L/min, 1ère dose d’antibiotique injectable (Ampicilline + Gentamicine ou Ceftriaxone), transfert d’urgence.',
        vitalSystem: 'Respiratoire'
      },
      {
        id: 'flag_pneu_cyanose',
        label: 'Cyanose centrale (lèvres/langue bleues) ou SpO2 < 90%',
        explanation: 'Hypoxémie critique aiguë par encombrement alvéolaire sévère.',
        immediateAction: 'Oxygénothérapie immédiate à haut débit, désobstruction rhinopharyngée, position proclive 30°.',
        vitalSystem: 'Respiratoire'
      }
    ],
    paraclinicalExams: {
      essential: ['Oxymétrie de pouls (SpO2)', 'TDR Paludisme systématique (fièvre + toux peut être un paludisme grave)'],
      optional: ['Radiographie pulmonaire de face', 'NFS', 'Hémoculture']
    },
    differentialDiagnoses: [
      { name: 'Paludisme grave avec détresse respiratoire (respiration acidosique)', distinguishingFeatures: 'Auscultation pulmonaire normale (poumons clairs), TDR Paludisme positif, anémie sévère fréquente.' },
      { name: 'Corps étranger inhalé', distinguishingFeatures: 'Début brutal par un syndrome de pénétration (quinte de toux asphyxiante aux repas/jeux), asymétrie auscultatoire brutale.' },
      { name: 'Bronchiolite aiguë du nourrisson', distinguishingFeatures: 'Âge < 12 mois, râles sibilants diffus expiratoires, frein expiratoire prédominant.' }
    ],
    standardTreatment: {
      firstLineAdult: 'Pneumopathie aiguë sévère adulte : Ceftriaxone injectable 1g à 2g/jour IV + Amoxicilline/Ac clavulanique. Oxygénothérapie adaptée si SpO2 < 92%. Transfert en milieu hospitalier.',
      firstLineChild: 'HOSPITALISATION OBLIGATOIRE. 1. OXYGÈNE si SpO2 < 90% ou tirage sévère. 2. AMPICILLINE injectable (50 mg/kg IV ou IM toutes les 6h) + GENTAMICINE injectable (7.5 mg/kg IV ou IM une fois par jour) pendant 5 jours. Alternative: CEFTRIAXONE injectable 80-100 mg/kg en une injection par jour. 3. Paracétamol 15 mg/kg si fièvre. 4. Poursuite de l’alimentation et hydratation au lait maternel ou SNG.',
      contraindications: ['Ne pas donner de sirops antitussifs ni de fluidifiants (inefficaces et dangereux chez le nourrisson)'],
      importantNotes: 'Enfant traité gratuitement au Burkina Faso dans le cadre de la gratuité des soins pour les moins de 5 ans.'
    },
    emergencyConduct: 'Si le CSPS ne dispose pas d’oxygène ou si l’enfant s’épuise: Administrer la 1ère dose de Ceftriaxone ou d’Ampicilline en IM avant le départ, assurer le transport en position demi-assise avec fiche de référence.',
    burkinaGuidelinesRef: 'Guide National PCIME Clinique (Prise en Charge Intégrée des Maladies de l’Enfant) - Ministère de la Santé du Burkina Faso.'
  },
  {
    id: 'deshydratation-severe-gea',
    name: 'Gastro-Entérite Aiguë avec Déshydratation Sévère (Plan C OMS)',
    synonyms: ['Diarrhée aiguë déshydratante', 'Severe dehydration'],
    category: 'Pédiatrique & PCIME',
    definition: 'Perte hydro-électrolytique aiguë supérieure à 10% du poids corporel consécutive à des diarrhées et/ou vomissements fréquents, entraînant une défaillance hémodynamique.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: false,
      category: 'NON_MDO',
      delayNotice: 'Surveiller si forme épidémique ou selles aqueuses profuses pouvant faire suspecter le CHOLÉRA (qui est MDO immédiate)',
      caseDefinitionSuspect: 'Émission de selles liquides fréquentes (> 3 fois/jour) avec signes d’altération de l’état général.',
      caseDefinitionConfirmed: 'Diarrhée avec au moins 2 signes parmi: léthargie/inconscience, yeux très enfoncés, incapable de boire ou boit difficilement, pli cutané s’effaçant très lentement (> 2 secondes).',
      laboratorySample: {
        sampleType: 'Selles fraîches pour TDR Choléra ou examen parasitologique si diarrhée sanglante',
        condition: 'Milieu propre',
        transport: 'Laboratoire du district',
        targetLab: 'Laboratoire CSPS / CMA'
      },
      mandatoryNotificationActions: [
        'Éliminer formellement le choléra si enfant > 5 ans ou adulte.',
        'Enregistrement sur le registre PCIME/Consultation.'
      ]
    },
    cardinalSigns: [
      { id: 'des_pli', label: 'Pli cutané abdominal très paresseux s’effaçant très lentement (> 2 secondes)', weight: 3, isCardinal: true },
      { id: 'des_boire', label: 'Incapable de boire ou boit très difficilement à la tasse/cuillère', weight: 3, isCardinal: true },
      { id: 'des_conscience', label: 'Léthargie, somnolence anormale ou perte de conscience', weight: 3, isCardinal: true },
      { id: 'des_yeux', label: 'Yeux très profondément enfoncés dans les orbites, absence totale de larmes', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'des_bouche', label: 'Muqueuse buccale et langue complètement sèches et râpeuses', weight: 2 },
      { id: 'des_pouls', label: 'Pouls radial très rapide et filant (faible) ou imprenable', weight: 2 },
      { id: 'des_trc', label: 'Temps de recoloration cutanée (TRC) allongé > 3 secondes, extrémités froides', weight: 2 },
      { id: 'des_diurese', label: 'Oligurie ou anurie (couches sèches depuis plus de 6-8 heures)', weight: 2 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_des_choc',
        label: 'COLLAPSUS HYPOVOLÉMIQUE AVEC POULS RADIAL IMPRENABLE ET TRC > 3 SECONDES',
        explanation: 'Hypovolémie critique avec risque d’insuffisance rénale anurique et d’arrêt cardiocirculatoire.',
        immediateAction: 'Poser IMMÉDIATEMENT une voie veineuse gros calibre (ou abord intra-osseux tibial si échec veineux après 2 essais). Démarrer le PLAN C OMS au Ringer Lactate.',
        vitalSystem: 'Circulatoire'
      }
    ],
    paraclinicalExams: {
      essential: ['Glycémie capillaire (l’hypoglycémie accompagne souvent la déshydratation du jeune enfant)', 'TDR Paludisme'],
      optional: ['Ionogramme sanguin (recherche hypokaliémie, hypernatrémie)', 'Urée et créatininémie']
    },
    differentialDiagnoses: [
      { name: 'Choléra', distinguishingFeatures: 'Selles abondantes "eau de riz", pas de fièvre au départ, épidémies collectives, déshydratation fulgurante en quelques heures.' },
      { name: 'Acidocétose diabétique', distinguishingFeatures: 'Respiration ample de Kussmaul, odeur acétonique de l’haleine, glycémie capillaire très élevée (> 2.50 g/l).' },
      { name: 'Invagination intestinale aiguë', distinguishingFeatures: 'Crises douloureuses paroxystiques chez le nourrisson, refus du biberon, émission de sang rouge glaireux par l’anus (« gelée de groseille »).' }
    ],
    standardTreatment: {
      firstLineChild: 'PLAN C DE L’OMS (Ringer Lactate IV 100 ml/kg au total): 1. Nourrisson < 1 an: donner 30 ml/kg en 1 heure, puis 70 ml/kg en 5 heures. 2. Enfant ≥ 1 an: donner 30 ml/kg en 30 minutes, puis 70 ml/kg en 2 heures et demie. Réévaluer le pouls radial et l’état d’hydratation toutes les 15-30 minutes. Dès que l’enfant peut boire: donner du SRO par petites gorgées (environ 5 ml/kg/h). À la fin de la perfusion: passer au SULFATE DE ZINC (20 mg/j pendant 10 jours; 10 mg/j si < 6 mois).',
      firstLineAdult: 'Plan C OMS: Ringer Lactate 100 ml/kg (30 ml/kg en 30 min puis 70 ml/kg en 2h30). Compléter par SRO dès reprise de la déglutition.',
      contraindications: ['Ne JAMAIS utiliser de solutés glucosés purs sans électrolytes en réhydratation de choc', 'Anti-diarrhéiques type Lopéramide rigoureusement contre-indiqués chez l’enfant'],
      importantNotes: 'Si impossible de perfuser en veine périphérique: poser une sonde nasogastrique avec SRO 20 ml/kg/h ou réaliser un abord intra-osseux en urgence.'
    },
    emergencyConduct: 'Ne pas déplacer un patient en état de choc sans perfusion en cours. Restaurer impérativement le pouls radial avant tout transfert éventuel.',
    burkinaGuidelinesRef: 'Directives Nationales de Prise en Charge des Maladies Diarrhéiques et de la Déshydratation (Ministère de la Santé du Burkina Faso).'
  },
  {
    id: 'peritonite-appendicite-aigue',
    name: 'Péritonite Aiguë & Appendicite Aiguë Compliquée',
    synonyms: ['Syndrome péritonéal', 'Abdomen aigu chirurgical'],
    category: 'Chirurgicale & Abdominale',
    definition: 'Inflammation aiguë septique du péritoine consécutive à la perforation d’un viscère creux (appendicite gangrenée, perforation d’ulcère, perforation iléale typhique).',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: false,
      category: 'NON_MDO',
      delayNotice: 'Urgence chirurgicale absolue - Référence immédiate au bloc opératoire',
      caseDefinitionSuspect: 'Douleur abdominale vive, continue, d’installation aiguë avec altération de l’état général et fièvre.',
      caseDefinitionConfirmed: 'Défense pariétale localisée ou contracture abdominale généralisée invincible (« ventre de bois ») douloureuse.',
      laboratorySample: {
        sampleType: 'Bilan pré-opératoire d’urgence (NFS, Groupage Rhésus, Créatinine, TP)',
        condition: 'Tube EDTA et tube citraté',
        transport: 'Laboratoire du CMA / CHR avec banque de sang',
        targetLab: 'CMA / CHR / CHU'
      },
      mandatoryNotificationActions: [
        'Conditionnement pour bloc opératoire d’urgence.',
        'Fiche de référence chirurgicale dûment renseignée.'
      ]
    },
    cardinalSigns: [
      { id: 'perit_contracture', label: 'Contracture abdominale involontaire, permanente et invincible (« ventre de bois ») ou défense vive localisée', weight: 3, isCardinal: true },
      { id: 'perit_douleur', label: 'Douleur abdominale brutale, violente, permanente, majorée au moindre mouvement ou à la toux', weight: 3, isCardinal: true },
      { id: 'perit_blumberg', label: 'Douleur vive à la décompression brusque de la fosse iliaque droite ou de l’abdomen (signe de Blumberg)', weight: 3, isCardinal: true },
      { id: 'perit_arret', label: 'Arrêt du transit pour les matières et les gaz avec météorisme ou silence auscultatoire', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'perit_vomit', label: 'Vomissements d’abord alimentaires puis bilieux fécaloïdes', weight: 2 },
      { id: 'perit_fievre', label: 'Fièvre élevée (38.5°C-39.5°C) avec faciès péritonéal terreux altéré', weight: 2 },
      { id: 'perit_tachy', label: 'Tachycardie disproportionnée > 110 bpm et hypotension progressive', weight: 2 },
      { id: 'perit_douglas', label: 'Douleur vive au toucher rectal dans le cul-de-sac de Douglas (« cri du Douglas »)', weight: 2 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_perit_choc_septique',
        label: 'CHOC SEPTIQUE PÉRITONÉAL (Hypotension TA < 85 mmHg, marbrures, anurie, polypnée)',
        explanation: 'Bactériémie massive et défaillance multiviscérale engageant le pronostic vital dans les 6 à 12 heures.',
        immediateAction: 'Remplissage vasculaire rapide Sérum Physiologique, antibiothérapie à large spectre injectable (Ceftriaxone + Métronidazole), évacuation chirurgicale SANS DÉLAI.',
        vitalSystem: 'Abdominal'
      }
    ],
    paraclinicalExams: {
      essential: ['Groupage Rhésus (pour commande de culots globulaires)', 'NFS (hyperleucocytose majeure > 15 000/mm³)', 'Abdomen sans préparation (ASP) debout ou décubitus: recherche de pneumopéritoine (croissant gazeux sous-diaphragmatique) ou niveaux hydro-aériques'],
      optional: ['Échographie abdominale', 'Créatinine et ionogramme']
    },
    differentialDiagnoses: [
      { name: 'Grossesse extra-utérine (GEU) rompue', distinguishingFeatures: 'Femme en âge de procréer, aménorrhée, métrorragies sépia, test de grossesse positif, cul-de-sac de Douglas bombant et douloureux.' },
      { name: 'Colique néphrétique aiguë', distinguishingFeatures: 'Douleur lombaire unilatérale irradiant vers les OGE sans contracture abdominale, hématurie microscopique.' },
      { name: 'Pneumonie de la base chez l’enfant', distinguishingFeatures: 'Douleur abdominale trompeuse mais abdomen souple à la palpation douce, râles auscultatoires pulmonaires.' }
    ],
    standardTreatment: {
      firstLineAdult: 'TRAITEMENT CHIRURGICAL D’URGENCE. Conditionnement immédiat: 1. Arrêt strict de toute alimentation orale (jeûne absolu). 2. Poser une sonde nasogastrique en déclive ou en aspiration douce. 3. Poser deux voies veineuses 16G avec réhydratation hydroélectrolytique (Ringer Lactate + Sérum Salé). 4. Antibiothérapie probabiliste pré-opératoire: Ceftriaxone 2 g IV + Métronidazole 500 mg en perfusion IV. 5. Antalgiques: Paracétamol IV ou Tramadol (JAMAIS d’AINS).',
      contraindications: ['NE JAMAIS PRESCRIRE DE LAXATIFS NI DE PURGATIFS (risque de perforation péritonéale foudroyante)', 'NE PAS PRESCRIRE D’AINS (masque les signes péritonéaux et aggrave l’infection)'],
      importantNotes: 'Au Burkina Faso, la perforation iléale typhique (complication de la fièvre typhoïde non traitée) reste une cause chirurgicale très fréquente de péritonite aiguë.'
    },
    emergencyConduct: 'Ne pas retarder l’évacuation vers le centre chirurgical (CMA avec bloc ou CHR). Laisser la sonde gastrique et la perfusion ouvertes pendant le transport.',
    burkinaGuidelinesRef: 'Protocoles de Chirurgie d’Urgence et de Prise en Charge des Urgences Abdominales au Burkina Faso.'
  },
  {
    id: 'asthme-aigu-grave',
    name: 'Asthme Aigu Grave (AAG) & Crise d’Asthme Sévère',
    synonyms: ['État de mal asthmatique', 'Severe acute asthma exacerbation'],
    category: 'Respiratoire',
    definition: 'Exacerbation aiguë d’asthme mettant en jeu le pronostic vital immédiat par obstruction bronchique majeure et épuisement musculaire respiratoire.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: false,
      category: 'NON_MDO',
      delayNotice: 'Urgence médicale aiguë vitale - Prise en charge immédiate en salle de déchocage',
      caseDefinitionSuspect: 'Dyspnée expiratoire sifflante chez un sujet asthmatique connu ou atopique.',
      caseDefinitionConfirmed: 'Crise avec au moins un signe de gravité: difficulté à parler (mots hachés), orthopnée, silence auscultatoire, FR > 30/min, FC > 120 bpm, SpO2 < 92%.',
      laboratorySample: {
        sampleType: 'Gazométrie artérielle si disponible ou oxymétrie de pouls continue',
        condition: 'Mesure SpO2 continue',
        transport: 'N/A',
        targetLab: 'Unité d’urgence du CMA / CHR'
      },
      mandatoryNotificationActions: [
        'Enregistrement sur le registre des urgences médicales.'
      ]
    },
    cardinalSigns: [
      { id: 'aag_parler', label: 'Impossibilité de formuler une phrase complète (mots hachés ou grognements par essoufflement)', weight: 3, isCardinal: true },
      { id: 'aag_position', label: 'Orthopnée stricte (patient assis penché en avant, refusant d’être allongé)', weight: 3, isCardinal: true },
      { id: 'aag_tirage', label: 'Tirage sus-sternal et intercostal intense avec mise en jeu des sterno-cléido-mastoïdiens', weight: 3, isCardinal: true },
      { id: 'aag_silence', label: 'SILENCE AUSCULTATOIRE ou diminution extrême des murmures vésiculaires (poumon silencieux = atélectasie et épuisement)', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'aag_polypnee', label: 'Polypnée superficielle > 30/min ou bradypnée pré-arrêt respiratoire', weight: 2 },
      { id: 'aag_tachy', label: 'Tachycardie > 120 bpm chez l’adulte (ou bradycardie annonçant l’arrêt cardiaque)', weight: 2 },
      { id: 'aag_sueurs', label: 'Sueurs profuses, agitation anxieuse, angoisse de mort imminente', weight: 2 },
      { id: 'aag_cyanose', label: 'Cyanose unguéale ou labiale, SpO2 < 90%', weight: 2 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_aag_arret_imminent',
        label: 'SIGNES D’ÉPUISEMENT RESPIRATOIRE MAJEUR (Respiration paradoxale thoraco-abdominale, somnolence, bradypnée, silence total)',
        explanation: 'Asphyxie aiguë et arrêt cardiocirculatoire imminent par hypoxie et acidose hypercapnique.',
        immediateAction: 'Oxygène au masque à fort débit (8-10 L/min), nébulisation continue de Salbutamol 5 mg sous O2, Corticoïdes IV (Méthylprednisolone 1-2 mg/kg ou Hydrocortisone 200 mg), Adrénaline 0.5 mg SC/IM si collapsus ou choc.',
        vitalSystem: 'Respiratoire'
      }
    ],
    paraclinicalExams: {
      essential: ['Oxymétrie de pouls (SpO2 continue)', 'Débit Expiratoire de Pointe (DEP / Peak Flow si réalisable: DEP < 50% de la valeur théorique)'],
      optional: ['Radiographie thoracique de face (éliminer pneumothorax suffocant)', 'ECG']
    },
    differentialDiagnoses: [
      { name: 'OAP cardiogénique (Œdème Aigu du Poumon)', distinguishingFeatures: 'Sujet plus âgé ou hypertendu/insuffisant cardiaque, râles crépitants montant en "marée montante", expectorations mousseuses rosées saumonées.' },
      { name: 'Pneumothorax spontané suffocant', distinguishingFeatures: 'Douleur thoracique brutale en coup de poignard unilatérale, tympanisme asymétrique et abolition unilatérale du murmure vésiculaire.' },
      { name: 'Corps étranger laryngo-trachéal', distinguishingFeatures: 'Syndrome de pénétration brutal, dyspnée inspiratoire avec stridor (et non expiratoire).' }
    ],
    standardTreatment: {
      firstLineAdult: '1. OXYGÉNOTHÉRAPIE à haut débit pour maintenir SpO2 entre 93% et 95%. 2. SALBUTAMOL EN NÉBULISATION: 5 mg dans 3-4 ml de sérum physiologique sous flux d’oxygène (6-8 L/min), à répéter toutes les 20 minutes pendant la 1ère heure (3 fois). Alternative si nébuliseur non disponible: Aérosol-doseur avec chambre d’inhalation (10 à 20 bouffées espacées). 3. CORTICOTHÉRAPIE SYSTÉMIQUE PRÉCOCE: Hémisuccinate d’hydrocortisone (HSHC) 200 mg IV ou Méthylprednisolone 80 mg IV. 4. En cas de crise réfractaire: SULFATE DE MAGNÉSIUM IV 2 g en perfusion lente sur 20 minutes.',
      firstLineChild: 'Salbutamol nébulisé 2.5 mg (< 5 ans) ou 5 mg (≥ 5 ans) répété toutes les 20 min x 3 fois. Prednisolone orale 2 mg/kg ou HSHC 5 mg/kg IV.',
      contraindications: ['Ne JAMAIS administrer de sédatifs, anxiolytiques ou somnifères (risque d’arrêt respiratoire fatal)', 'Ne pas donner de bêtabloquants'],
      importantNotes: 'Conserver le patient en position demi-assise stricte. Ne jamais le coucher à plat.'
    },
    emergencyConduct: 'Nébulisations continues sous O2 durant toute la phase de prise en charge et le transport en ambulance médicalisée.',
    burkinaGuidelinesRef: 'Protocoles de Médecine d’Urgence et Réanimation Médicale (Société Burkinabè de Pneumologie).'
  }
];
