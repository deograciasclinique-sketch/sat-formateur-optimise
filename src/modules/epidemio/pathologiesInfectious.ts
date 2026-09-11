import { Pathology } from './clinicalTypes';

export const INFECTIOUS_PATHOLOGIES: Pathology[] = [
  {
    id: 'paludisme-simple',
    name: 'Paludisme Simple à Plasmodium falciparum',
    synonyms: ['Accès palustre simple', 'Malaria non compliquée'],
    category: 'Infectieuse & Parasitaire',
    definition: 'Infection parasitaire érythrocytaire à Plasmodium falciparum sans signe de défaillance vitale, confirmée biologiquement.',
    isEmergency: false,
    emergencyLevel: 'NONE',
    mdoInfo: {
      isMDO: true,
      category: 'HEBDO_TLM',
      delayNotice: 'Notification hebdomadaire (TLM) et mensuelle (RMA)',
      simrCode: 'SIMR-PALU-01',
      caseDefinitionSuspect: 'Fièvre (T° ≥ 37.5°C) ou antécédent de fièvre récente dans les 48h sans cause évidente.',
      caseDefinitionConfirmed: 'Test de Diagnostic Rapide (TDR) ou goutte épaisse positif pour Plasmodium.',
      laboratorySample: {
        sampleType: 'Sang capillaire (pulpe du doigt)',
        condition: 'Kit TDR validé PNLP',
        transport: 'Température ambiante à l’abri de l’humidité',
        targetLab: 'Laboratoire du CSPS / CMA'
      },
      mandatoryNotificationActions: [
        'Enregistrer dans le registre de consultation et de laboratoire.',
        'Comptabiliser dans le rapport hebdomadaire épidémiologique (TLM).'
      ]
    },
    cardinalSigns: [
      { id: 'pal_fievre', label: 'Fièvre aiguë (T° ≥ 37.5°C ou sensation de chaleur)', weight: 3, isCardinal: true },
      { id: 'pal_tdr_pos', label: 'TDR paludisme positif ou Goutte Épaisse positive', weight: 3, isCardinal: true },
      { id: 'pal_frissons', label: 'Frissons et sueurs profuses en accès', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'pal_cephalees', label: 'Céphalées diffuses et courbatures', weight: 2 },
      { id: 'pal_anorexie', label: 'Anorexie, nausées ou vomissements isolés', weight: 2 },
      { id: 'pal_fatigue', label: 'Asthénie et myalgies généralisées', weight: 1 },
      { id: 'pal_arthralgies', label: 'Douleurs articulaires', weight: 1 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_pal_prostration',
        label: 'Prostration / Incapacité de s’asseoir ou de boire',
        explanation: 'Indique une transition vers un paludisme grave.',
        immediateAction: 'Passer immédiatement au protocole Paludisme Grave: Artésunate injectable IV/IM.',
        vitalSystem: 'Neurologique'
      },
      {
        id: 'flag_pal_convulsions',
        label: 'Convulsions répétées ou coma',
        explanation: 'Accès pernicieux / Neuro-paludisme.',
        immediateAction: 'Diazépam 0.5 mg/kg intra-rectal + Artésunate IV 2.4 mg/kg. Oxygène.',
        vitalSystem: 'Neurologique'
      },
      {
        id: 'flag_pal_resp',
        label: 'Respiration rapide et profonde (dyspnée acidosique)',
        explanation: 'Acidose métabolique sévère liée au paludisme.',
        immediateAction: 'Oxygénothérapie, voie veineuse, transfert médicalisé urgent.',
        vitalSystem: 'Respiratoire'
      }
    ],
    paraclinicalExams: {
      essential: ['TDR Paludisme (Ag HRP2/pLDH) ou Goutte épaisse / Frottis sanguin', 'Hémoglobine capillaire (Hémocue)'],
      optional: ['Glycémie capillaire', 'Bandelette urinaire (recherche protéinurie, hémoglobinurie)']
    },
    differentialDiagnoses: [
      { name: 'Dengue classique', distinguishingFeatures: 'Céphalées rétro-orbitaires très vives, rash cutané, TDR Paludisme négatif, TDR Dengue NS1 positif.' },
      { name: 'Fièvre typhoïde', distinguishingFeatures: 'Fièvre continue en plateau, tuphos, dissociation pouls-température, troubles digestifs prolongés.' },
      { name: 'Grippe saisonnière / Infection virale aiguë', distinguishingFeatures: 'Symptômes ORL marqués (rhinite, toux sèche), TDR Paludisme négatif.' }
    ],
    standardTreatment: {
      firstLineAdult: 'Artéméther-Luméfantrine (AL) ou Artésunate-Amodiaquine (ASAQ) par voie orale pendant 3 jours selon le poids.',
      firstLineChild: 'AL comprimés dispersibles ou ASAQ pédiatrique selon la tranche de poids pendant 3 jours. Paracétamol 15 mg/kg toutes les 6h si fièvre > 38.5°C.',
      contraindications: ['Ne pas utiliser de monothérapies orales (ex: Artésunate seul ou Quinine orale seule)', 'Ne pas donner d’AINS si doute avec la dengue'],
      importantNotes: 'Au Burkina Faso, la prise en charge du paludisme est gratuite pour les enfants de moins de 5 ans et les femmes enceintes.'
    },
    burkinaGuidelinesRef: 'Directives Nationales de Prise en Charge du Paludisme au Burkina Faso (PNLP, 2023).'
  },
  {
    id: 'paludisme-grave',
    name: 'Paludisme Grave (Accès Pernicieux)',
    synonyms: ['Neuropaludisme', 'Severe Malaria'],
    category: 'Infectieuse & Parasitaire',
    definition: 'Infection à Plasmodium falciparum compliquée d’au moins un signe clinique ou biologique de défaillance vitale (critères OMS).',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: true,
      category: 'IMMEDIATE_24H',
      delayNotice: 'Alerte immédiate au District Sanitaire et fiche SIMR de cas grave',
      simrCode: 'SIMR-PALU-GRAVE',
      caseDefinitionSuspect: 'Fièvre avec au moins un signe de gravité: coma, convulsions, détresse respiratoire, anémie sévère ou choc.',
      caseDefinitionConfirmed: 'Confirmation parasitologique (TDR ou GE+) avec signe(s) de gravité OMS.',
      laboratorySample: {
        sampleType: 'Sang veineux et capillaire',
        condition: 'TDR immédiat + goutte épaisse d’urgence',
        transport: 'Au laboratoire du centre de référence',
        targetLab: 'CMA / CHR / CHU'
      },
      mandatoryNotificationActions: [
        'Enregistrement immédiat dans le registre des urgences/hospitalisations.',
        'Notification hebdomadaire spécifique cas graves et décès palustres au CISSE.'
      ]
    },
    cardinalSigns: [
      { id: 'palg_tdr', label: 'TDR Paludisme ou Goutte Épaisse positif', weight: 3, isCardinal: true },
      { id: 'palg_coma', label: 'Altération de conscience / Score Blantyre < 3 ou Glasgow < 9', weight: 3, isCardinal: true },
      { id: 'palg_convulsions', label: 'Convulsions répétées (> 2 épisodes en 24 heures)', weight: 3, isCardinal: true },
      { id: 'palg_resp', label: 'Détresse respiratoire (respiration acidosique ample)', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'palg_paleur', label: 'Pâleur cutanéo-muqueuse intense (anémie grave Hb < 5 g/dl)', weight: 2 },
      { id: 'palg_ictere', label: 'Ictère franc (yeux jaunes) avec fièvre', weight: 2 },
      { id: 'palg_urines', label: 'Hémoglobinurie (urines rouge sombre / coca-cola)', weight: 2 },
      { id: 'palg_choc', label: 'Signes de collapsus ou choc (pouls faible, extrémités froides)', weight: 2 },
      { id: 'palg_vomit', label: 'Vomissements incoercibles empêchant tout traitement oral', weight: 1 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_palg_hypo',
        label: 'Hypoglycémie (< 0.50 g/l ou < 2.8 mmol/l)',
        explanation: 'Complication métabolique mortelle très fréquente chez l’enfant et la femme enceinte.',
        immediateAction: 'Injecter immédiatement Sérum Glucosé 10% (5 ml/kg en IVD lente) ou G30% chez l’adulte.',
        vitalSystem: 'Neurologique'
      },
      {
        id: 'flag_palg_anemia',
        label: 'Anémie sévère décompensée avec détresse respiratoire',
        explanation: 'Anoxie tissulaire aiguë menaçant le pronostic vital.',
        immediateAction: 'Oxygène + Poser voie veineuse sans soluté hypotonique + Transfusion de culot globulaire urgente (20 ml/kg sang total ou 10 ml/kg culot).',
        vitalSystem: 'Circulatoire'
      },
      {
        id: 'flag_palg_coma',
        label: 'Coma profond avec convulsions subintrantes',
        explanation: 'Œdème cérébral et souffrance du tronc cérébral.',
        immediateAction: 'Position latérale de sécurité, canule de Guedel, aspiration, Diazépam, Artésunate IV.',
        vitalSystem: 'Neurologique'
      }
    ],
    paraclinicalExams: {
      essential: ['TDR / Goutte épaisse urgente', 'Hémoglobine immédiate', 'Glycémie capillaire immédiate'],
      optional: ['Créatininémie', 'Ionogramme sanguin', 'Ponction lombaire si raideur méningée']
    },
    differentialDiagnoses: [
      { name: 'Méningite bactérienne aiguë', distinguishingFeatures: 'Raideur de nuque prédominante, purpura pétéchial, LCR trouble à la ponction lombaire.' },
      { name: 'Dengue sévère avec choc', distinguishingFeatures: 'Hémorragies muqueuses, hématocrite élevé, thrombopénie sévère, TDR Paludisme négatif.' },
      { name: 'Encéphalite virale ou convulsion fébrile simple', distinguishingFeatures: 'Pas de défaillance multiviscérale, durée brève de la crise.' }
    ],
    standardTreatment: {
      firstLineAdult: 'Artésunate injectable IV: 2.4 mg/kg à H0, H12, H24 puis une fois par jour jusqu’à reprise de la voie orale (minimum 3 doses), puis relais oral complet 3 jours par CTA.',
      firstLineChild: 'Enfant < 20 kg: Artésunate IV 3.0 mg/kg à H0, H12, H24 puis quotidiennement. Si Artésunate non disponible: Artéméther IM 3.2 mg/kg à J1 puis 1.6 mg/kg/j.',
      contraindications: ['Ne pas surcharger en solutés (risque d’OAP)', 'Pas de corticoïdes (inefficaces et délétères)'],
      importantNotes: 'Si transfert nécessaire depuis un CSPS: Administrer une dose de charge d’Artésunate IM ou une capsule rectale d’Artésunate (10 mg/kg) avant l’évacuation d’urgence.'
    },
    emergencyConduct: 'Voie veineuse de gros calibre, liberté des voies aériennes, oxygène, correction immédiate de l’hypoglycémie, 1ère dose d’Artésunate IV/IM, évacuation urgente médicalisée avec fiche de référence.',
    burkinaGuidelinesRef: 'Directives Nationales Paludisme Grave du Ministère de la Santé du Burkina Faso.'
  },
  {
    id: 'dengue-signes-alarme',
    name: 'Dengue avec Signes d’Alarme & Dengue Sévère',
    synonyms: ['Dengue hémorragique', 'Syndrome de choc denguéen', 'Dengue fever with warning signs'],
    category: 'Infectieuse & Parasitaire',
    definition: 'Infection par le virus de la dengue (Arbovirus transmis par Aedes aegypti) compliquée d’extravasation plasmatique, de saignements ou d’atteinte d’organe.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: true,
      category: 'IMMEDIATE_24H',
      delayNotice: 'Déclaration OBLIGATOIRE IMMÉDIATE (< 24h) au MCD et au CISSE',
      simrCode: 'SIMR-DENGUE-SEV',
      caseDefinitionSuspect: 'Fièvre aiguë 2 à 7 jours avec au moins 2 signes parmi: céphalées intenses rétro-orbitaires, myalgies intenses, arthralgies, rash cutané, TDR Dengue NS1 ou IgM positif.',
      caseDefinitionConfirmed: 'Cas avec signes d’alarme (douleur abdominale vive, vomissements persistants, hépatomégalie, saignement muqueux, hémoconcentration) ou dengue sévère (choc, détresse respiratoire, hémorragie massive).',
      laboratorySample: {
        sampleType: 'Sang veineux sur tube sec (sérologie) ou EDTA (RT-PCR)',
        condition: 'Prélèvement précoce (< 5 jours de fièvre)',
        transport: 'Sérum décanté à +4°C au LNR-FHV ou Centre Muraz',
        targetLab: 'Laboratoire de Référence des Fièvres Hémorragiques Virales (Bobo/Ouaga)'
      },
      mandatoryNotificationActions: [
        'Alerte téléphonique immédiate au Médecin Chef de District (MCD).',
        'Fiche d’investigation épidémiologique SIMR pour tout cas avec signes d’alarme ou hospitalisé.',
        'Signalement des foyers de cas dans le quartier ou le village.'
      ]
    },
    cardinalSigns: [
      { id: 'deng_fievre', label: 'Fièvre brutale élevée (39-40°C) évoluant depuis 2 à 7 jours', weight: 3, isCardinal: true },
      { id: 'deng_abdo', label: 'Douleur abdominale vive et persistante ou sensibilité de l’abdomen', weight: 3, isCardinal: true },
      { id: 'deng_vomit', label: 'Vomissements persistants (> 3 épisodes en 24h ou intolérance alimentaire)', weight: 3, isCardinal: true },
      { id: 'deng_saignement', label: 'Saignements muqueux spontanés (épistaxis, gingivorragie, hématémèse, méléna, métrorragies)', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'deng_retro', label: 'Céphalées rétro-orbitaires intenses (douleur derrière les yeux)', weight: 2 },
      { id: 'deng_courbatures', label: 'Douleurs musculaires et articulaires intenses (« briseuse d’os »)', weight: 2 },
      { id: 'deng_hepato', label: 'Hépatomégalie douloureuse (> 2 cm sous le rebord costal)', weight: 2 },
      { id: 'deng_fluid', label: 'Accumulation liquidienne clinique (ascite, épanchement pleural, œdèmes)', weight: 2 },
      { id: 'deng_lethargie', label: 'Léthargie, grande fatigue ou agitation soudaine', weight: 2 },
      { id: 'deng_rash', label: 'Éruption maculo-papuleuse érythémateuse avec zones de peau saine (« îlots blancs dans une mer rouge »)', weight: 1 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_deng_choc',
        label: 'État de Choc Denguéen (pression pincée < 20 mmHg ou hypotension)',
        explanation: 'Extravasation plasmatique massive menaçant le pronostic vital dans les 12-24h (survient souvent au moment de la défervescence thermique !).',
        immediateAction: 'Remplissage vasculaire immédiat au Ringer Lactate ou Sérum Physiologique 10-20 ml/kg en 1h. Surveillance horaire de la TA et du pouls. Évacuation urgente médicalisée.',
        vitalSystem: 'Circulatoire'
      },
      {
        id: 'flag_deng_hemorragie',
        label: 'Hémorragie digestive haute ou basse massive',
        explanation: 'Consommation des facteurs de coagulation et thrombopénie sévère.',
        immediateAction: 'Pose de 2 voies veineuses 16G/18G. Remplissage, commande urgente de sang total ou concentrés plaquettaires, appel réanimation.',
        vitalSystem: 'Circulatoire'
      },
      {
        id: 'flag_deng_contraindication',
        label: 'ATTENTION: Prescription d’AINS, Aspirine ou Ibuprofène',
        explanation: 'CONTRE-INDICATION ABSOLUE. Ces médicaments aggravent l’inhibition plaquettaire et provoquent des hémorragies mortelles.',
        immediateAction: 'Arrêter immédiatement tout AINS ou aspirine ! Utiliser UNIQUEMENT le Paracétamol (max 3g/j adulte, 60 mg/kg/j enfant).',
        vitalSystem: 'Sepsis'
      }
    ],
    paraclinicalExams: {
      essential: ['TDR combiné Dengue (Ag NS1 + Ac IgM/IgG)', 'NFS / Hématocrite et Numération plaquettaire (baisse rapide des plaquettes + élévation hématocrite = fuite plasmatique)'],
      optional: ['TDR Paludisme systématique (co-infections fréquentes au Burkina)', 'Bilan hépatique (ALAT/ASAT) et créatinine']
    },
    differentialDiagnoses: [
      { name: 'Paludisme grave / accès pernicieux', distinguishingFeatures: 'Goutte épaisse/TDR Paludisme positif, absence de céphalées rétro-orbitaires spécifiques, splénomégalie plus fréquente.' },
      { name: 'Fièvre typhoïde', distinguishingFeatures: 'Fièvre en plateau progressive, tuphos, dissociation pouls-T°, coproculture/hémoculture.' },
      { name: 'Fièvre Jaune / Fièvres hémorragiques virales (Lassa, Ebola)', distinguishingFeatures: 'Ictère précoce, contexte épidémique particulier, notification immédiate également requise.' }
    ],
    standardTreatment: {
      firstLineAdult: 'Repos strict au lit sous moustiquaire imprégnée. Réhydratation orale abondante au SRO. Paracétamol 1g toutes les 6h (maximum 3g/jour). Remplissage contrôlé au Ringer Lactate si signes d’alarme.',
      firstLineChild: 'Paracétamol 15 mg/kg toutes les 6h (max 60 mg/kg/jour). SRO à volonté. Surveillance rapprochée au moment de la chute thermique (J3-J6).',
      contraindications: ['ASPIRINE ET TOUS LES AINS (Ibuprofène, Diclofénac, Kétoprofène) STRICTEMENT INTERDITS', 'Injections intramusculaires proscrites (risque d’hématome géant)'],
      importantNotes: 'Au Burkina Faso, lors des épidémies saisonnières (septembre-décembre), tout cas de fièvre avec céphalées vives doit être testé simultanément pour le Paludisme et la Dengue.'
    },
    emergencyConduct: 'En cas de signes d’alarme: Hospitaliser immédiatement, perfuser Ringer Lactate 5 à 7 ml/kg/h pendant 1-2h, réévaluer. Si choc: bolus 10-20 ml/kg en 30-60 min. Déclarer immédiatement au MCD.',
    burkinaGuidelinesRef: 'Protocole National de Prise en Charge Clinique de la Dengue au Burkina Faso (Ministère de la Santé, 2023).'
  },
  {
    id: 'meningite-cerebrospinale',
    name: 'Méningite Cérébrospinale Épidémique (Bactérienne Aiguë)',
    synonyms: ['Méningite à Méningocoque', 'Epidemic cerebrospinal meningitis'],
    category: 'Infectieuse & Parasitaire',
    definition: 'Infection purulente aiguë des méninges bactérienne (Neisseria meningitidis, Streptococcus pneumoniae, Haemophilus influenzae b) à potentiel épidémique majeur au Burkina Faso.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: true,
      category: 'IMMEDIATE_24H',
      delayNotice: 'DÉCLARATION IMMÉDIATE OBLIGATOIRE (< 24h) par téléphone/radio au MCD et CISSE',
      simrCode: 'SIMR-MENING-01',
      caseDefinitionSuspect: 'Début brutal de fièvre (> 38.5°C) avec raideur de nuque ou bombement de la fontanelle chez le nourrisson de moins de 1 an.',
      caseDefinitionProbable: 'Cas suspect avec LCR trouble, purulent ou leucocytes élevés (> 10 éléments/mm³).',
      caseDefinitionConfirmed: 'Confirmation bactériologique par agglutination au latex (Pastorex), PCR ou culture positive.',
      laboratorySample: {
        sampleType: 'Liquide Céphalo-Rachidien (LCR) stérile par ponction lombaire',
        condition: 'À réaliser AVANT la 1ère dose d’antibiotique si possible sans retarder le traitement',
        transport: 'Milieu Trans-Isolate (TI) conservé à TEMPÉRATURE AMBIANTE (NE JAMAIS RÉFRIGÉRER !)',
        targetLab: 'Laboratoire du District Sanitaire / LNSP Ouagadougou'
      },
      epidemicThreshold: 'Seuil d’alerte: 5 cas/100 000 hab/semaine. Seuil épidémique: 10 cas/100 000 hab/semaine.',
      mandatoryNotificationActions: [
        'Alerte téléphonique immédiate sous 24h au Médecin Chef de District (MCD).',
        'Fiche individuelle de notification SIMR renseignée pour chaque cas suspect.',
        'Envoi sans délai du tube de LCR au laboratoire de référence.'
      ]
    },
    cardinalSigns: [
      { id: 'men_fievre', label: 'Fièvre brutale et élevée (> 38.5°C)', weight: 3, isCardinal: true },
      { id: 'men_raideur', label: 'Raideur de nuque invincible et douloureuse (signes de Kernig et Brudzinski positifs)', weight: 3, isCardinal: true },
      { id: 'men_fontanelle', label: 'Chez le nourrisson: Bombement tendu de la fontanelle antérieure au repos', weight: 3, isCardinal: true },
      { id: 'men_vomit', label: 'Céphalées atroces diffuses avec vomissements faciles en jet', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'men_photophobie', label: 'Photophobie et phonophobie (regard détourné de la lumière)', weight: 2 },
      { id: 'men_somnolence', label: 'Troubles de conscience: somnolence, stupeur ou agitation fébrile', weight: 2 },
      { id: 'men_chien', label: 'Position antalgique en "chien de fusil" (couché sur le côté, membres fléchis)', weight: 2 },
      { id: 'men_cris', label: 'Cris aigus plaintifs inexpliqués chez le nourrisson', weight: 2 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_men_purpura',
        label: 'PURPURA FULMINANS: Taches pétéchiales ou ecchymotiques extensives sur la peau',
        explanation: 'Signe de méningococcémie foudroyante et coagulation intravasculaire disséminée (CIVD). Décès en quelques heures si retard de traitement.',
        immediateAction: 'Injection IMMÉDIATE de Ceftriaxone IV ou IM (100 mg/kg enfant, 4g adulte) sans attendre la ponction lombaire ni l’évacuation ! Voie veineuse et remplissage.',
        vitalSystem: 'Sepsis'
      },
      {
        id: 'flag_men_coma',
        label: 'Coma avec score de Glasgow ≤ 8 ou convulsions fébriles subintrantes',
        explanation: 'Engagement cérébral ou œdème cérébral majeur.',
        immediateAction: 'Liberté des voies aériennes, oxygénothérapie, position tête surélevée 30°, Diazépam si convulsion, transfert médicalisé urgent.',
        vitalSystem: 'Neurologique'
      }
    ],
    paraclinicalExams: {
      essential: ['Ponction Lombaire (aspect macroscopique: eau de roche, louche, franchement purulent)', 'Test d’agglutination rapide au latex (Pastorex) sur LCR', 'TDR Paludisme systématique'],
      optional: ['Glycorachie et protéinorachie', 'NFS (hyperleucocytose à polynucléaires)', 'Hémoculture']
    },
    differentialDiagnoses: [
      { name: 'Neuropaludisme / Paludisme grave', distinguishingFeatures: 'Goutte épaisse/TDR positif, ponction lombaire montre un LCR clair normotendu.' },
      { name: 'Hémorragie méningée', distinguishingFeatures: 'Apyrétique au début, céphalée brutale "en coup de tonnerre", LCR uniformément hémorragique incoagulable.' },
      { name: 'Méningisme fébrile sur pneumonie ou otite', distinguishingFeatures: 'Nuque souple en torsion latérale, LCR clair normal.' }
    ],
    standardTreatment: {
      firstLineAdult: 'Ceftriaxone injectable: 4 g/jour en IV (ou IM en 2 points) pendant 5 à 7 jours. En période épidémique au Burkina Faso: Ceftriaxone dose unique 4 g IM ou protocole national.',
      firstLineChild: 'Ceftriaxone injectable: 100 mg/kg/jour en une injection IV ou IM (max 4 g) pendant 5 jours.',
      contraindications: ['Ne pas différer l’antibiothérapie pour faire la ponction lombaire si celle-ci est impossible ou si le patient est instable'],
      importantNotes: 'En période épidémique au Burkina Faso, le traitement de la méningite cérébrospinale est GRATUIT dans toutes les formations sanitaires publiques.'
    },
    emergencyConduct: 'Administrer la 1ère dose de Ceftriaxone immédiatement sur place au CSPS. Si le patient doit être référé au CMA/CHR: noter impérativement la date, l’heure et la dose administrée sur la fiche de transfert.',
    burkinaGuidelinesRef: 'Directives Nationales de Surveillance et de Riposte aux Épidémies de Méningite (Ministère de la Santé du Burkina Faso / DSE).'
  },
  {
    id: 'cholera-infection',
    name: 'Choléra Épidémique (Vibrio cholerae)',
    synonyms: ['Diarrhée cholérique', 'Acute watery diarrhea with severe dehydration'],
    category: 'Infectieuse & Parasitaire',
    definition: 'Infection intestinale aiguë foudroyante causée par Vibrio cholerae O1 ou O139, transmise par l’eau ou aliments souillés, à l’origine de déshydratation mortelle en quelques heures.',
    isEmergency: true,
    emergencyLevel: 'CRITICAL',
    mdoInfo: {
      isMDO: true,
      category: 'IMMEDIATE_24H',
      delayNotice: 'URGENCE ÉPIDÉMIQUE ABSOLUE - DÉCLARATION IMMÉDIATE (< 24h) au MCD, DRS et Ministère',
      simrCode: 'SIMR-CHOL-01',
      caseDefinitionSuspect: 'Toute personne de 5 ans ou plus présentant une diarrhée aqueuse aiguë profuse et brutale avec ou sans vomissements (« selles eau de riz »).',
      caseDefinitionConfirmed: 'Isolement de Vibrio cholerae dans les selles par culture ou PCR au laboratoire de référence.',
      laboratorySample: {
        sampleType: 'Selles liquides fraîches ou écouvillonnage rectal',
        condition: 'Milieu de transport Cary-Blair ou eau peptonée alcaline',
        transport: 'Température ambiante (ne pas congeler) au laboratoire',
        targetLab: 'Laboratoire National de Santé Publique (LNSP Ouagadougou)'
      },
      epidemicThreshold: 'UN SEUL cas suspect constitue une URGENCE ÉPIDÉMIQUE déclenchant la riposte.',
      mandatoryNotificationActions: [
        'Alerte téléphonique et radio d’urgence au Médecin Chef de District et à la DRS.',
        'Mise en place immédiate de l’Unité de Traitement du Choléra (UTC/CTC).',
        'Notification SIMR cas par cas et journalière.'
      ]
    },
    cardinalSigns: [
      { id: 'chol_selle', label: 'Diarrhée liquide aqueuse profuse, incolore avec flocons blanchâtres (« selles eau de riz »)', weight: 3, isCardinal: true },
      { id: 'chol_brutal', label: 'Début brutal sans fièvre ni ténesme initial', weight: 3, isCardinal: true },
      { id: 'chol_deshydrat', label: 'Déshydratation foudroyante en quelques heures (yeux très enfoncés, soif insatiable puis léthargie)', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'chol_vomit', label: 'Vomissements aqueux fréquents sans nausées préalables', weight: 2 },
      { id: 'chol_crampes', label: 'Crampes musculaires douloureuses intenses (mollets, cuisses) par perte potassique', weight: 2 },
      { id: 'chol_anurie', label: 'Oligurie ou anurie totale (arrêt d’émission d’urines)', weight: 2 },
      { id: 'chol_voix', label: 'Voix cassée ou aphone, faciès terreux émacié', weight: 1 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_chol_choc',
        label: 'COLLAPSUS HYPOVOLÉMIQUE MAJEUR (Pouls radial imprenable, TA imprenable, extrémités glacées)',
        explanation: 'Perte de plus de 10% du poids corporel en liquide. Le patient peut décéder en moins de 2 heures d’arrêt circulatoire.',
        immediateAction: 'Poser DEUX voies veineuses gros calibre (16G/18G). Débuter IMMÉDIATEMENT le Plan C OMS: Ringer Lactate en jet continu (adulte: 1 litre en 15 min, puis 1 litre en 45 min, puis 2 litres en 2-3h).',
        vitalSystem: 'Circulatoire'
      }
    ],
    paraclinicalExams: {
      essential: ['Test de Diagnostic Rapide (TDR) Choléra sur selles fraîches', 'Écouvillonnage sur milieu Cary-Blair pour confirmation LNSP'],
      optional: ['Ionogramme sanguin (hypokaliémie, acidose)', 'Créatinine']
    },
    differentialDiagnoses: [
      { name: 'Dysenterie bacillaire (Shigellose)', distinguishingFeatures: 'Selles glairo-sanglantes, fièvre élevée, épreintes et ténesme douloureux.' },
      { name: 'Gastro-entérite virale ou à E. coli entérotoxinogène', distinguishingFeatures: 'Pertes liquidiennes moins massives, TDR Choléra négatif.' },
      { name: 'Intoxication alimentaire collective', distinguishingFeatures: 'Contexte de repas partagé, vomissements au premier plan.' }
    ],
    standardTreatment: {
      firstLineAdult: 'Plan C OMS (si déshydratation sévère): Ringer Lactate IV 100 ml/kg (30 ml/kg en 30 min puis 70 ml/kg en 2h30). Dès que le patient peut boire: SRO à volonté. Antibiothérapie en fin de réhydratation: Doxycycline 300 mg per os dose unique ou Azithromycine 1g.',
      firstLineChild: 'Ringer Lactate IV 100 ml/kg (nourrisson < 1 an: 30 ml/kg en 1h puis 70 ml/kg en 5h; enfant ≥ 1 an: 30 ml/kg en 30 min puis 70 ml/kg en 2h30). Puis SRO + Zinc.',
      contraindications: ['Ne JAMAIS donner de soluté glucosé pur en réhydratation de choc (pas de sodium)', 'Ne pas donner d’antidiarrhéiques ralentisseurs du transit (Lopéramide proscrit)'],
      importantNotes: 'Isolement strict, port d’EPI, désinfection systématique des mains et surfaces à l’eau de javel (0.5% pour surfaces et déjections, 0.05% pour le lavage des mains).'
    },
    emergencyConduct: 'Réhydratation veineuse massive immédiate sur place (ne jamais transférer un choléra en choc sans avoir restauré le pouls radial). Déclaration d’urgence maximale au District Sanitaire.',
    burkinaGuidelinesRef: 'Plan National de Préparation et de Riposte aux Épidémies de Choléra au Burkina Faso.'
  },
  {
    id: 'rougeole-infection',
    name: 'Rougeole (Morbillivirus)',
    synonyms: ['Measles', 'Fièvre éruptive rougeoleuse'],
    category: 'Infectieuse & Parasitaire',
    definition: 'Infection virale aiguë extrêmement contagieuse, à transmission aérienne, caractérisée par une fièvre élevée, un catarrhe oculo-respiratoire et une éruption maculo-papuleuse descendante.',
    isEmergency: false,
    emergencyLevel: 'HIGH',
    mdoInfo: {
      isMDO: true,
      category: 'IMMEDIATE_24H',
      delayNotice: 'Déclaration IMMÉDIATE OBLIGATOIRE (< 24h) au Médecin Chef de District',
      simrCode: 'SIMR-ROUG-01',
      caseDefinitionSuspect: 'Toute personne fébrile avec éruption maculo-papuleuse généralisée ET au moins un signe parmi: toux, coryza (écoulement nasal) ou conjonctivite (yeux rouges).',
      caseDefinitionConfirmed: 'Cas suspect avec sérologie IgM rougeole positive ou lien épidémiologique avec un cas confirmé.',
      laboratorySample: {
        sampleType: 'Sang veineux sur tube sec (3 à 5 ml) pour sérologie IgM',
        condition: 'Prélèvement entre le 3ème et le 28ème jour après l’éruption',
        transport: 'Sérum décanté conservé entre +2°C et +8°C',
        targetLab: 'Laboratoire National de Référence Rougeole/Rubéole (LNSP Ouagadougou)'
      },
      epidemicThreshold: 'Seuil épidémique BF: 3 cas confirmés par IgM dans un district sanitaire sur une période de 4 semaines.',
      mandatoryNotificationActions: [
        'Alerte téléphonique et fiche individuelle d’investigation cas par cas au MCD.',
        'Prélèvement de sang pour les 5 premiers cas suspects par formation sanitaire.',
        'Recherche active des cas dans la communauté et vérification de la couverture vaccinale.'
      ]
    },
    cardinalSigns: [
      { id: 'roug_fievre', label: 'Fièvre élevée (≥ 38.5°C à 40°C) d’installation brutale', weight: 3, isCardinal: true },
      { id: 'roug_erup', label: 'Éruption maculo-papuleuse descendante (débute derrière les oreilles et sur le visage, puis s’étend au tronc et aux membres)', weight: 3, isCardinal: true },
      { id: 'roug_koplik', label: 'Signe de Koplik (petites taches blanches punctiformes sur fond rouge sur la muqueuse interne des joues face aux molaires)', weight: 3, isCardinal: true },
      { id: 'roug_catarrhe', label: 'Catarrhe oculo-respiratoire franc: conjonctivite bilatérale larmoyante, coryza abondant, toux sèche', weight: 3, isCardinal: true }
    ],
    secondarySigns: [
      { id: 'roug_facies', label: 'Faciès bouffi rougeoleux (yeux bouffis, photophobie, nez coulant)', weight: 2 },
      { id: 'roug_diarrhee', label: 'Diarrhée profuse accompagnatrice', weight: 2 },
      { id: 'roug_desquamation', label: 'Desquamation fine furfuracée en phase de rémission laissant des taches pigmentées', weight: 1 }
    ],
    emergencyRedFlags: [
      {
        id: 'flag_roug_pneumo',
        label: 'Détresse respiratoire aiguë / Pneumonie de surinfection',
        explanation: 'Cause majeure de mortalité rougeoleuse chez l’enfant malnutri ou immunodéprimé.',
        immediateAction: 'Oxygène, antibiothérapie IV urgente (Ampicilline + Gentamicine ou Ceftriaxone), transfert hospitalier.',
        vitalSystem: 'Respiratoire'
      },
      {
        id: 'flag_roug_oeil',
        label: 'Ulcération cornéenne ou cécité aiguë',
        explanation: 'Carence aiguë en vitamine A précipitée par la rougeole.',
        immediateAction: 'Dose immédiate de Vitamine A + Pommade ophtalmique tétracycline 1% (JAMAIS de corticoïdes dans l’œil !).',
        vitalSystem: 'Sepsis'
      },
      {
        id: 'flag_roug_croup',
        label: 'Stridor laryngé ou détresse laryngée (croup rougeoleux)',
        explanation: 'Obstruction des voies aériennes supérieures par laryngite inflammatoire.',
        immediateAction: 'Oxygène humidifié, Dexaméthasone ou Hydrocortisone IV, surveillance étroite de perméabilité trachéale.',
        vitalSystem: 'Respiratoire'
      }
    ],
    paraclinicalExams: {
      essential: ['Prélèvement sanguin sérologie IgM rougeole (sur tube sec)', 'TDR Paludisme systématique'],
      optional: ['Radiographie du thorax si signes respiratoires', 'NFS (leucopénie fréquente)']
    },
    differentialDiagnoses: [
      { name: 'Rubéole', distinguishingFeatures: 'Éruption plus discrète rosée, adénopathies rétro-auriculaires et sous-occipitales marquées, fébricule modérée.' },
      { name: 'Scarlatine', distinguishingFeatures: 'Angine streptococcique au premier plan, langue framboisée, éruption sans intervalle de peau saine prédominant aux plis de flexion.' },
      { name: 'Toxidermie médicamenteuse', distinguishingFeatures: 'Prurit intense, notion de prise récente de sulfamides ou d’antibiotiques, absence de catarrhe oculaire.' }
    ],
    standardTreatment: {
      firstLineAdult: 'Repos, hydratation, Paracétamol. Vitamine A si carence suspectée.',
      firstLineChild: 'VITAMINE A OBLIGATOIRE IMMÉDIATE (2 doses orales à 24h d’intervalle): 50 000 UI si < 6 mois, 100 000 UI si 6-11 mois, 200 000 UI si ≥ 12 mois. Paracétamol 15 mg/kg toutes les 6h. Lavage des yeux au sérum physiologique.',
      contraindications: ['Ne jamais prescrire de corticoïdes locaux oculaires (risque de perforation de la cornée)', 'Pas d’AINS'],
      importantNotes: 'Isolement de l’enfant malade jusqu’à 4 jours après l’apparition de l’éruption. Vaccination de riposte pour les enfants non vaccinés du voisinage.'
    },
    emergencyConduct: 'En cas de complication (pneumonie, croup, kératite): administrer la vitamine A, débuter l’antibiothérapie et référer immédiatement au CMA/CHR.',
    burkinaGuidelinesRef: 'Guide National SIMR / Directives du Programme Élargi de Vaccination (PEV) du Burkina Faso.'
  }
];
