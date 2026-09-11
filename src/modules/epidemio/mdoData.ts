export interface MDODiseaseOverview {
  id: string;
  name: string;
  category: 'IMMEDIATE_24H' | 'HEBDO_TLM' | 'MENSUEL';
  epidemicPotential: boolean;
  standardCaseDefinition: {
    suspect: string;
    probable?: string;
    confirmed: string;
  };
  sampleType: string;
  transportCondition: string;
  nationalRefLab: string;
  notificationTarget: string;
  primaryResponseMeasures: string[];
  simrAlertThreshold?: string;
}

export const MDO_BURKINA_FASO_LIST: MDODiseaseOverview[] = [
  {
    id: 'meningite',
    name: 'Méningite Cérébrospinale Épidémique (Méningocoque / Pneumocoque / Hib)',
    category: 'IMMEDIATE_24H',
    epidemicPotential: true,
    standardCaseDefinition: {
      suspect: 'Toute personne avec début brutal de fièvre (> 38.5°C) ET raideur de nuque ou bombement de la fontanelle chez le nourrisson.',
      probable: 'Cas suspect avec LCR trouble, purulent ou leucocytes > 10/mm³ ou coloration Gram positive.',
      confirmed: 'Cas suspect ou probable confirmé par culture bactérienne, PCR ou test d’agglutination au latex (Pastorex) positif sur LCR.'
    },
    sampleType: 'Liquide Céphalo-Rachidien (LCR) stérile prélevé par ponction lombaire avant antibiotique.',
    transportCondition: 'Milieu Trans-Isolate (TI) maintenu à température ambiante (NE PAS METTRE AU RÉFRIGÉRATEUR).',
    nationalRefLab: 'Laboratoire National de Santé Publique (LNSP) - Ouagadougou / CHU Yalgado / Bobo-Dioulasso.',
    notificationTarget: 'Alerte téléphonique/SMS immédiate (< 24h) au Médecin Chef de District (MCD) et au CISSE.',
    simrAlertThreshold: 'Seuil d’alerte: 5 cas pour 100 000 hab/semaine. Seuil épidémique: 10 cas pour 100 000 hab/semaine (ou 5/semaine si population < 30 000).',
    primaryResponseMeasures: [
      'Traitement présomptif immédiat: Ceftriaxone injectable 100 mg/kg/j (adulte 4g/j) sans attendre le laboratoire.',
      'Notification immédiate et enregistrement sur la fiche individuelle SIMR.',
      'Gestion des cas selon le protocole de prise en charge gratuite en période épidémique au Burkina Faso.',
      'Recherche active des cas dans la zone et sensibilisation communautaire.'
    ]
  },
  {
    id: 'dengue_severe',
    name: 'Dengue avec Signes d’Alarme et Dengue Sévère',
    category: 'IMMEDIATE_24H',
    epidemicPotential: true,
    standardCaseDefinition: {
      suspect: 'Fièvre aiguë brutale (2-7 jours) avec au moins 2 signes parmi: céphalées rétro-orbitaires, myalgies, arthralgies, éruption cutanée, leucopénie.',
      probable: 'Cas suspect avec signes d’alarme (douleurs abdominales intenses, vomissements persistants, hépatomégalie > 2cm, hémorragies muqueuses, hématocrite élevé avec chute des plaquettes) OU TDR NS1/IgM positif.',
      confirmed: 'Confirmation virologique par RT-PCR ou isolement viral au laboratoire de référence.'
    },
    sampleType: 'Sang total sur tube sec ou EDTA (5 ml) prélevé au cours des 5 premiers jours de fièvre.',
    transportCondition: 'Sérum décanté conservé et transporté entre +2°C et +8°C avec accumulateurs de froid.',
    nationalRefLab: 'Laboratoire National de Référence des Fièvres Hémorragiques Virales (LNR-FHV) / Centre Muraz (Bobo-Dioulasso) / LNSP.',
    notificationTarget: 'Notification immédiate (< 24h) pour tout cas sévère ou hospitalisé au MCD et au CISSE.',
    simrAlertThreshold: 'Tout groupement de cas (cluster) de fièvre fébrile avec saignements ou TDR positifs en 48h.',
    primaryResponseMeasures: [
      'AUCUN AINS ni Aspirine (CONTRE-INDICATION ABSOLUE: risque mortel d’hémorragie digestive !). Paracétamol uniquement.',
      'Remplissage vasculaire contrôlé au Ringer Lactate ou Sérum Physiologique en cas de choc ou signes d’alarme.',
      'Notification immédiate à l’équipe cadre du District Sanitaire.',
      'Lutte anti-larvaire, destruction des gîtes de moustiques Aedes (vieux pneus, récipients d’eau) et moustiquaires imprégnées.'
    ]
  },
  {
    id: 'cholera',
    name: 'Choléra (Vibrio cholerae)',
    category: 'IMMEDIATE_24H',
    epidemicPotential: true,
    standardCaseDefinition: {
      suspect: 'Tout patient de 5 ans ou plus présentant une diarrhée aqueuse aiguë profuse et brutale avec ou sans vomissements (« selles eau de riz »).',
      probable: 'Cas suspect survenant dans une zone en alerte de choléra avec déshydratation sévère ou décès rapide.',
      confirmed: 'Isolement de Vibrio cholerae O1 ou O139 dans les selles par culture ou PCR.'
    },
    sampleType: 'Selles fraîches liquides ou écouvillonnage rectal.',
    transportCondition: 'Milieu de transport Cary-Blair ou eau peptonée alcaline à température ambiante.',
    nationalRefLab: 'Laboratoire National de Santé Publique (LNSP) Ouagadougou.',
    notificationTarget: 'Notification d’URGENCE ABSOLUE (< 24h) au MCD, DRS et Direction de la Surveillance Épidémiologique.',
    simrAlertThreshold: '1 SEUL cas suspect de choléra constitue une URGENCE ÉPIDÉMIQUE.',
    primaryResponseMeasures: [
      'Réhydratation immédiate d’urgence: Plan C Ringer Lactate 100 ml/kg en perfusion rapide (trois quarts dans les premières heures).',
      'Isolement strict dans une unité de traitement du choléra (UTC / CTC).',
      'Désinfection chlorée systématique des selles, vomissures, literie et latrines (eau de javel 0.5%).',
      'Antibiothérapie ciblée (Doxycycline ou Azithromycine) pour raccourcir la durée de la diarrhée et du portage.'
    ]
  },
  {
    id: 'rougeole',
    name: 'Rougeole (Morbillivirus)',
    category: 'IMMEDIATE_24H',
    epidemicPotential: true,
    standardCaseDefinition: {
      suspect: 'Toute personne présentant une fièvre avec éruption maculo-papuleuse généralisée ET au moins un des signes: toux, coryza (rhinite), ou conjonctivite.',
      confirmed: 'Cas suspect avec présence d’anticorps IgM spécifiques anti-rougeoleux ou lien épidémiologique avec un cas confirmé.'
    },
    sampleType: 'Sang sur tube sec (3-5 ml) pour sérologie IgM prélevé entre J3 et J28 après l’éruption.',
    transportCondition: 'Sérum décanté à +4°C (accumulateurs de froid, boîte isotherme).',
    nationalRefLab: 'Laboratoire National de Référence Rougeole/Rubéole (LNSP Ouagadougou).',
    notificationTarget: 'Notification immédiate (< 24h) sur fiche d’investigation cas par cas au MCD.',
    simrAlertThreshold: 'Seuil épidémique BF: 3 cas confirmés par sérologie IgM dans un district sanitaire en 1 mois.',
    primaryResponseMeasures: [
      'Administration obligatoire de Vitamine A à fortes doses: 2 doses à 24h d’intervalle (100 000 UI si 6-11 mois, 200 000 UI si ≥12 mois).',
      'Dépistage et traitement systématique des complications (pneumonie, otite, kératite, malnutrition).',
      'Isolement de l’enfant jusqu’à 4 jours après le début de l’éruption cutanée.',
      'Vérification du statut vaccinal et riposte vaccinale autour des foyers épidémiques.'
    ]
  },
  {
    id: 'fievre_jaune',
    name: 'Fièvre Jaune',
    category: 'IMMEDIATE_24H',
    epidemicPotential: true,
    standardCaseDefinition: {
      suspect: 'Toute personne présentant une maladie aiguë fébrile avec survenue d’un ictère (yeux/peau jaunes) dans les 14 jours suivant les premiers symptômes.',
      confirmed: 'Présence d’anticorps IgM spécifiques anti-amarils en l’absence de vaccination récente (< 30 jours) ou PCR positive.'
    },
    sampleType: 'Sang veineux sur tube sec (5 ml).',
    transportCondition: 'Sérum décanté transporté à +4°C au laboratoire de référence.',
    nationalRefLab: 'Centre Muraz / LNSP Ouagadougou / Institut Pasteur de Dakar.',
    notificationTarget: 'Notification immédiate obligatoire (< 24h) au Médecin Chef de District.',
    simrAlertThreshold: '1 seul cas confirmé déclenche une alerte nationale et une campagne de riposte vaccinale.',
    primaryResponseMeasures: [
      'Hospitalisation sous moustiquaire imprégnée pour éviter la transmission aux moustiques vecteurs (Aedes).',
      'Traitement symptomatique: antipyrétique (Paracétamol uniquement), réhydratation hydroélectrolytique.',
      'Enquête entomologique et recherche active des cas contacts dans un rayon de 5 km.'
    ]
  },
  {
    id: 'pfa_polio',
    name: 'Paralysie Flasque Aiguë (PFA - Surveillance Éradication Poliomyélite)',
    category: 'IMMEDIATE_24H',
    epidemicPotential: true,
    standardCaseDefinition: {
      suspect: 'Tout enfant de moins de 15 ans présentant un début brutal de paralysie ou parésie flasque, ou toute personne de tout âge si suspicion de poliomyélite.',
      confirmed: 'Isolement d’un poliovirus sauvage ou dérivé d’une souche vaccinale (PVDV) dans les selles.'
    },
    sampleType: 'Deux (2) échantillons de selles prélevés à 24-48 heures d’intervalle, dans les 14 jours suivant le début de la paralysie.',
    transportCondition: 'Flacons stériles à selles hermétiques, chaîne du froid stricte (entre +2°C et +8°C, jamais congelé).',
    nationalRefLab: 'Laboratoire National de Référence Polio (LNSP Ouagadougou).',
    notificationTarget: 'Notification immédiate (< 24h) obligatoire sur fiche SIMR / PFA au MCD et Point Focal PEV.',
    simrAlertThreshold: 'Indicateur de performance: Détecter et investiguer au moins 2 cas de PFA non-polio pour 100 000 enfants de moins de 15 ans par an.',
    primaryResponseMeasures: [
      'Remplissage de la fiche d’investigation détaillée PFA.',
      'Prélèvement sans délai des 2 selles réglementaires.',
      'Examen de suivi clinique à 60 jours pour évaluer la paralysie résiduelle.'
    ]
  },
  {
    id: 'tetanos_neonatal',
    name: 'Tétanos Néonatal et Obstétrical',
    category: 'IMMEDIATE_24H',
    epidemicPotential: false,
    standardCaseDefinition: {
      suspect: 'Nouveau-né qui tétait et pleurait normalement pendant les deux premiers jours de vie, puis présente entre le 3ème et le 28ème jour une incapacité de téter suivie de raideur musculaire ou de spasmes.',
      confirmed: 'Diagnostic purement clinique (aucun examen de laboratoire requis pour confirmer).'
    },
    sampleType: 'Aucun prélèvement biologique nécessaire pour la confirmation diagnostique.',
    transportCondition: 'N/A',
    nationalRefLab: 'Confirmation clinique au niveau de la formation sanitaire.',
    notificationTarget: 'Notification immédiate (< 24h) au MCD pour enquête sur la pratique d’accouchement et statut VAT de la mère.',
    primaryResponseMeasures: [
      'Sérum antitétanique ou Immunoglobulines humaines spécifiques d’urgence.',
      'Métronidazole ou Pénicilline G injectable + Diazépam en perfusion ou intra-rectal sous surveillance stricte.',
      'Environnement calme, obscur, soins locaux de la plaie ombilicale (chlorhexidine).',
      'Vaccination de la mère par le Tétanos-Diphtérie (Td) et sensibilisation communautaire.'
    ]
  },
  {
    id: 'rage_humaine',
    name: 'Rage Humaine (Lyssavirus)',
    category: 'IMMEDIATE_24H',
    epidemicPotential: false,
    standardCaseDefinition: {
      suspect: 'Toute personne présentant un syndrome d’encéphalomyélite aiguë avec hydrophobie (spasmes laryngés à la déglutition d’eau), aérophobie, agitation ou paralysie, après morsure/griffure d’animal suspect.',
      confirmed: 'Mise en évidence de l’antigène rabique par immunofluorescence directe sur biopsie de peau de la nuque ou salive post-mortem.'
    },
    sampleType: 'Prélèvement de salive ou biopsie nucale (réalisé par équipe spécialisée). Animal mordeur placé sous observation vétérinaire 15 jours.',
    transportCondition: 'Transport sécurisé à froid négatif (-20°C ou carboglace).',
    nationalRefLab: 'Laboratoire National d’Élevage / LNSP.',
    notificationTarget: 'Notification immédiate (< 24h) au District Sanitaire et au Service Départemental de l’Élevage.',
    primaryResponseMeasures: [
      'Lavage immédiat de la plaie à grande eau et au savon pendant 15 minutes complètes (vital !). Application d’antiseptique (Bétadine ou alcool).',
      'Prophylaxie Post-Exposition (PEP) sans délai: Vaccin antirabique (schéma Essen ou Zagreb) +/- Immunoglobulines antirabiques au site de morsure.',
      'Ne jamais suturer la plaie immédiatement si morsure récente.',
      'Notification et mise en observation vétérinaire de l’animal mordeur (règle des 15 jours).'
    ]
  },
  {
    id: 'paludisme',
    name: 'Paludisme (Plasmodium falciparum)',
    category: 'HEBDO_TLM',
    epidemicPotential: true,
    standardCaseDefinition: {
      suspect: 'Toute personne fébrile (T° ≥ 37.5°C) ou ayant des antécédents de fièvre au cours des 48h précédentes sans autre cause évidente.',
      confirmed: 'Cas suspect avec Test de Diagnostic Rapide (TDR) positif pour Plasmodium ou goutte épaisse/frottis sanguin positif.'
    },
    sampleType: 'Sang capillaire pour TDR ou goutte épaisse / frottis sanguin coloré au Giemsa.',
    transportCondition: 'Lames séchées à température ambiante pour contrôle de qualité.',
    nationalRefLab: 'Programme National de Lutte contre le Paludisme (PNLP) / Laboratoire de référence du district.',
    notificationTarget: 'Transmission hebdomadaire dans le Télégramme Lettre Officiel Hebdomadaire (TLM) et mensuelle dans le RMA.',
    simrAlertThreshold: 'Surveillance des courbes épidémiologiques hebdomadaires par district comparées aux 5 années antérieures.',
    primaryResponseMeasures: [
      'Paludisme simple: Combinaison Thérapeutique à base d’Artémisinine (CTA: AL ou ASAQ) par voie orale pendant 3 jours selon le poids.',
      'Paludisme grave: Artésunate injectable IV/IM 2.4 mg/kg à H0, H12, H24 puis toutes les 24h (minimum 3 doses) jusqu’au relais oral par CTA.',
      'Gratuité des soins pour les femmes enceintes et les enfants de moins de 5 ans au Burkina Faso.',
      'Utilisation universelle de Moustiquaires Imprégnées à Longue Durée d’Action (MILDA).'
    ]
  },
  {
    id: 'fievre_typhoide',
    name: 'Fièvre Typhoïde (Salmonella enterica sérovar Typhi)',
    category: 'HEBDO_TLM',
    epidemicPotential: true,
    standardCaseDefinition: {
      suspect: 'Fièvre continue prolongée > 3 jours avec céphalées, asthénie, anorexie, troubles digestifs (constipation ou diarrhée ocre) et parfois dissociation pouls-température.',
      confirmed: 'Hémoculture positive pour Salmonella Typhi ou coproculture positive.'
    },
    sampleType: 'Sang pour hémoculture (au début de la fièvre) ou selles pour coproculture.',
    transportCondition: 'Flacon d’hémoculture à température ambiante.',
    nationalRefLab: 'Laboratoire du CMA / CHR / LNSP.',
    notificationTarget: 'Rapport hebdomadaire TLM au District Sanitaire.',
    primaryResponseMeasures: [
      'Antibiothérapie adaptée: Ciprofloxacine, Ceftriaxone ou Azithromycine selon la gravité clinique.',
      'Surveillance étroite du risque de perforation iléale (douleur abdo brutale, défense = urgence chirurgicale !).',
      'Mesures d’hygiène de l’eau et des aliments (lavage des mains, désinfection au chlore).'
    ]
  },
  {
    id: 'tuberculose',
    name: 'Tuberculose Pulmonaire (Mycobacterium tuberculosis)',
    category: 'MENSUEL',
    epidemicPotential: false,
    standardCaseDefinition: {
      suspect: 'Toute personne présentant une toux persistante de plus de 2 à 3 semaines, avec ou sans expectorations hémoptoïques, sueurs nocturnes, fébricule et amaigrissement.',
      confirmed: 'Mise en évidence de bacilles acido-alcoolo-résistants (BAAR) à la microscopie ou détection d’ADN bactérien par GeneXpert MTB/RIF.'
    },
    sampleType: 'Deux (2) échantillons d’expectorations matinales profondes (crachats).',
    transportCondition: 'Crachoirs hermétiques stériles à l’abri de la lumière.',
    nationalRefLab: 'Centres de Diagnostic et de Traitement (CDT) / Programme National de Lutte contre la Tuberculose (PNT).',
    notificationTarget: 'Enregistrement sur le registre PNT et notification trimestrielle/mensuelle au médecin coordonnateur TB.',
    primaryResponseMeasures: [
      'Régime standardisé gratuit: 2 mois de RHZE (Rifampicine, Isoniazide, Pyrazinamide, Éthambutol) + 4 mois de RH.',
      'Prise sous Traitement Directement Observé (TDO/DOTS).',
      'Dépistage systématique du VIH et dépistage des sujets contacts du foyer.'
    ]
  }
];
