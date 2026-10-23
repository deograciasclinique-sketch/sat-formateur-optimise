/**
 * Pharmacies de Bobo-Dioulasso et leurs groupes de garde (1 à 4).
 *
 * Sources publiques recoupées (octobre 2026) :
 *  • listes des groupes 1 à 4 publiées par Orange Burkina (orange.bf, « Pharmacies de garde Bobo Dioulasso ») ;
 *  • annuaire PharmaGarde BF (adresses, positions GPS, numéros récents) — bf.pharmagarde.app.
 * Lorsque les deux sources donnent des numéros différents, les deux sont conservés.
 * Groupe 0 = pharmacie hors tour de garde connu.
 *
 * Tour de garde : rotation hebdomadaire 1 → 2 → 3 → 4, changement le samedi à 8 h.
 * Référence : groupe 4 de garde du samedi 17 au samedi 24 octobre 2026 (8 h), d'après PharmaGarde BF.
 * À VÉRIFIER avec le programme officiel de l'Ordre des pharmaciens ; corrigeable dans l'app (« Corriger une garde »).
 */
export interface PharmacieReference {
  nom: string;
  quartier: string;
  telephone: string;
  telephone2?: string;
  lat?: number;
  lng?: number;
  /** 1 à 4 ; 0 = sans groupe. */
  groupe: number;
}

export const ZONE_BOBO = "Bobo-Dioulasso";
export const REFERENCE_GARDE_BOBO = { groupe: 4, date: "2026-10-17", heure: "08:00", dureeJours: 7 };

export const PHARMACIES_BOBO: PharmacieReference[] = [
  {"nom": "Pharmacie Abby", "quartier": "Belle-ville à 100m de la Station Shell", "telephone": "20 97 63 64", "lat": 11.180476, "lng": -4.351685, "groupe": 4},
  {"nom": "Pharmacie Adama Traore", "quartier": "Route de Leguema, face cite SONATUR sect32", "telephone": "76 44 43 06", "lat": 11.176572, "lng": -4.313346, "groupe": 4},
  {"nom": "Pharmacie Aeroport", "quartier": "Face à la Brakina", "telephone": "20 97 50 14", "lat": 11.166304, "lng": -4.312095, "groupe": 2},
  {"nom": "Pharmacie Amine", "quartier": "Sect. 22 à 300m côté Ouest CMA de 22", "telephone": "20 97 19 97", "lat": 11.198702, "lng": -4.323069, "groupe": 4},
  {"nom": "Pharmacie Amirbouba", "quartier": "Sect. 10, côté Est du CMA de Dô, vers l’Ex gare de Dandé", "telephone": "25 39 34 64", "lat": 11.205418, "lng": -4.311239, "groupe": 3},
  {"nom": "Pharmacie Aoudi", "quartier": "Bolmakoté, face Sapeurs Pompiers", "telephone": "20 98 18 98", "lat": 11.163229, "lng": -4.292432, "groupe": 1},
  {"nom": "Pharmacie Aube Nouvelle", "quartier": "Sect 17, Face Marché de Sarfalao", "telephone": "20 97 78 78", "lat": 11.159154, "lng": -4.268997, "groupe": 4},
  {"nom": "Pharmacie Audrey", "quartier": "Sect. 24, face à la station Oil Lybia, route Ouaga", "telephone": "20 95 44 69", "lat": 11.166814, "lng": -4.242034, "groupe": 4},
  {"nom": "Pharmacie Badenya", "quartier": "", "telephone": "63 83 22 57", "lat": 11.236968, "lng": -4.301746, "groupe": 0},
  {"nom": "Pharmacie Becy", "quartier": "Sarfalao, à 200m de SOS Village enfant", "telephone": "20 95 58 41", "lat": 11.197623, "lng": -4.301324, "groupe": 3},
  {"nom": "Pharmacie Belleville", "quartier": "Route de l’INSSA, à côté du petit marché Belle-ville", "telephone": "20 98 22 00", "lat": 11.164922, "lng": -4.305154, "groupe": 1},
  {"nom": "Pharmacie Bethel", "quartier": "Sect. 21 (Colsama) à 100m du temple Bethel", "telephone": "20 97 37 59", "telephone2": "20 97 37 39", "lat": 11.184057, "lng": -4.321203, "groupe": 1},
  {"nom": "Pharmacie Bien-Etre", "quartier": "Route du marché de fruits, à côté Agence Orange sect21", "telephone": "20 97 20 79", "lat": 11.177276, "lng": -4.316409, "groupe": 4},
  {"nom": "Pharmacie Bolibana", "quartier": "Non loin WEND-Konta cité relais sect23", "telephone": "20 96 50 96", "lat": 11.241587, "lng": -4.28702, "groupe": 2},
  {"nom": "Pharmacie Boulevard", "quartier": "Face à TSR", "telephone": "20 97 30 00", "telephone2": "20 95 20 93", "lat": 11.183645, "lng": -4.285103, "groupe": 2},
  {"nom": "Pharmacie Boyam", "quartier": "Bindougousso, à 500m du CMA de Dafra", "telephone": "20 95 64 29", "lat": 11.193875, "lng": -4.296526, "groupe": 3},
  {"nom": "Pharmacie Christ-Roi", "quartier": "Sect 24, à 300m du CSPS de Kua", "telephone": "20 95 58 53", "lat": 11.176754, "lng": -4.248498, "groupe": 2},
  {"nom": "Pharmacie Colma", "quartier": "Derrière la mairie de Colma, en face du petit marché.", "telephone": "20 95 17 02", "lat": 11.204441, "lng": -4.295693, "groupe": 4},
  {"nom": "Pharmacie Colombe", "quartier": "", "telephone": "79 74 53 18", "telephone2": "20 97 28 29", "groupe": 1},
  {"nom": "Pharmacie Dinie", "quartier": "Kodéni, route de Banfora à 100 m de la station Oryx", "telephone": "56 89 89 12", "lat": 11.13462, "lng": -4.320155, "groupe": 2},
  {"nom": "Pharmacie Diyama", "quartier": "Section 25 côté Sud OCADES", "telephone": "70 17 28 23", "lat": 11.159913, "lng": -4.24092, "groupe": 0},
  {"nom": "Pharmacie Djam", "quartier": "Sect 29 à côté de l’INSSA", "telephone": "57 04 78 85", "lat": 11.183539, "lng": -4.368604, "groupe": 2},
  {"nom": "Pharmacie Djena", "quartier": "Av. Nelson Mandela, Ouezzin Ville", "telephone": "20 98 37 98", "telephone2": "20 98 38 98", "lat": 11.201312, "lng": -4.315001, "groupe": 2},
  {"nom": "Pharmacie Dogona", "quartier": "", "telephone": "20 95 64 48", "lat": 11.188642, "lng": -4.280068, "groupe": 4},
  {"nom": "Pharmacie Ekossinnes", "quartier": "Bobo 2010", "telephone": "60 76 38 38", "lat": 11.222967, "lng": -4.306501, "groupe": 4},
  {"nom": "Pharmacie Entente", "quartier": "Koko, à 300m de la maternité Guimbi OUATTARA", "telephone": "20 97 19 16", "lat": 11.172603, "lng": -4.290314, "groupe": 3},
  {"nom": "Pharmacie Esperance", "quartier": "Bindougousso à 200m de Maderssa Salam", "telephone": "20 97 47 17", "lat": 11.189048, "lng": -4.270344, "groupe": 1},
  {"nom": "Pharmacie Fanyansa", "quartier": "Av. Nelson Mandela à 100m du centre des jeunes de Ouezzin-ville", "telephone": "20 97 14 80", "lat": 11.179229, "lng": -4.266475, "groupe": 1},
  {"nom": "Pharmacie Grâce Divine", "quartier": "", "telephone": "20 97 48 25", "groupe": 4},
  {"nom": "Pharmacie Hadim", "quartier": "Boulevard face à la cité an II, non loin de la SONABEL", "telephone": "20 98 42 00", "telephone2": "20 95 42 00", "lat": 11.177907, "lng": -4.272701, "groupe": 4},
  {"nom": "Pharmacie Harmonie", "quartier": "Lafiabougou, route de Orodara", "telephone": "20 97 07 17", "lat": 11.158342, "lng": -4.320083, "groupe": 1},
  {"nom": "Pharmacie Havvah", "quartier": "A côté de Burkina secours sect24", "telephone": "20 95 75 98", "lat": 11.172165, "lng": -4.233642, "groupe": 2},
  {"nom": "Pharmacie Hayatt", "quartier": "Belle-Ville, route de Nasso", "telephone": "20 97 00 00", "lat": 11.1781, "lng": -4.335947, "groupe": 3},
  {"nom": "Pharmacie Hereso", "quartier": "Sarfalao, face à la place de la femme", "telephone": "20 97 09 95", "lat": 11.171407, "lng": -4.267627, "groupe": 3},
  {"nom": "Pharmacie Hopital", "quartier": "Face au camp militaire Ouezzin Coulibaly", "telephone": "20 98 37 47", "lat": 11.169117, "lng": -4.303035, "groupe": 4},
  {"nom": "Pharmacie Houet Nouvelle", "quartier": "Sect. 1 à côté de la Direction de la SOFITEX", "telephone": "20 95 53 08", "lat": 11.1752, "lng": -4.301501, "groupe": 2},
  {"nom": "Pharmacie Jigiya", "quartier": "Accart ville à 50 m du marché", "telephone": "20 97 12 04", "lat": 11.18774, "lng": -4.312135, "groupe": 4},
  {"nom": "Pharmacie Jolean", "quartier": "Sect. 22, entre le plateau Yêguéré et CMA 22", "telephone": "20 98 21 20", "lat": 11.201332, "lng": -4.314973, "groupe": 1},
  {"nom": "Pharmacie Kanta", "quartier": "Sect. 21, sur les voies du Conseil Regional/Station Shell", "telephone": "20 66 10 51", "lat": 11.165598, "lng": -4.302385, "groupe": 4},
  {"nom": "Pharmacie Kiri", "quartier": "", "telephone": "52 73 20 20", "groupe": 0},
  {"nom": "Pharmacie Kone", "quartier": "A côté du Tribunal du Commerce sect18", "telephone": "20 95 76 95", "lat": 11.138072, "lng": -4.282703, "groupe": 2},
  {"nom": "Pharmacie Lafia", "quartier": "Yeguere coura route Bobo 2010", "telephone": "20 95 54 37", "lat": 11.214854, "lng": -4.309872, "groupe": 2},
  {"nom": "Pharmacie Lafiabougou", "quartier": "A côté de l’école Sapeur pompiers", "telephone": "20 95 64 27", "lat": 11.176098, "lng": -4.288508, "groupe": 4},
  {"nom": "Pharmacie Lakari", "quartier": "Rue Vicens, Koko à côté du pont Bessin", "telephone": "53 68 18 18", "telephone2": "20 97 47 51", "lat": 11.174208, "lng": -4.280007, "groupe": 4},
  {"nom": "Pharmacie Lame", "quartier": "A côté de la station Ola Bobo 2010 route de Bama", "telephone": "20 95 76 75", "lat": 11.226106, "lng": -4.315047, "groupe": 3},
  {"nom": "Pharmacie Lamoussa David", "quartier": "", "telephone": "20 97 21 72", "lat": 11.170778, "lng": -4.281738, "groupe": 0},
  {"nom": "Pharmacie Levant", "quartier": "Sikasso Sira route camp miltaire Ouezzin Coulibaly", "telephone": "20 97 03 33", "lat": 11.172773, "lng": -4.303002, "groupe": 1},
  {"nom": "Pharmacie Lucien", "quartier": "Sect. 1 à côté du commissariat central", "telephone": "20 97 51 52", "telephone2": "20 97 51 32", "lat": 11.160033, "lng": -4.269894, "groupe": 2},
  {"nom": "Pharmacie Mah-Ta", "quartier": "Sect. 21, face à la base aériènne, route de Nasso", "telephone": "20 98 28 25", "lat": 11.175743, "lng": -4.327655, "groupe": 2},
  {"nom": "Pharmacie Medine", "quartier": "Sect. 01, Av. de la République, à 100m de la DIACFA", "telephone": "20 97 09 10", "lat": 11.179162, "lng": -4.298749, "groupe": 3},
  {"nom": "Pharmacie Moderne", "quartier": "Sect. 05 entre Maison de la culture et place de la femme", "telephone": "20 97 02 50", "lat": 11.177255, "lng": -4.298174, "groupe": 1},
  {"nom": "Pharmacie Nazindi-Gouba", "quartier": "Colma, route de Dédougou, face au CAS", "telephone": "20 97 57 57", "lat": 11.196, "lng": -4.29222, "groupe": 2},
  {"nom": "Pharmacie Nazounki", "quartier": "Sect. 22 à 200m du Stade LAMIZANA", "telephone": "20 97 31 00", "lat": 11.189928, "lng": -4.325763, "groupe": 2},
  {"nom": "Pharmacie Okana", "quartier": "", "telephone": "02 95 87 87", "lat": 11.210525, "lng": -4.287281, "groupe": 0},
  {"nom": "Pharmacie Orlea", "quartier": "Sect. 19, zone industrielle port sec, route de Banfora", "telephone": "25 39 25 33", "lat": 11.135, "lng": -4.28876, "groupe": 1},
  {"nom": "Pharmacie Oulagnan Traore", "quartier": "Marche de fruits sect10", "telephone": "57 93 93 56", "lat": 11.176547, "lng": -4.313345, "groupe": 3},
  {"nom": "Pharmacie Remedis", "quartier": "Sect. 05 entre Maison de la culture et place de la femme", "telephone": "20 97 09 52", "lat": 11.16491, "lng": -4.276022, "groupe": 1},
  {"nom": "Pharmacie Saint-Antoine", "quartier": "Sakabi, route de Dédougou", "telephone": "20 95 13 01", "lat": 11.215522, "lng": -4.284521, "groupe": 3},
  {"nom": "Pharmacie Saint-Raphael", "quartier": "Lafiabougou, route de Banfora", "telephone": "20 98 63 91", "lat": 11.156213, "lng": -4.315143, "groupe": 3},
  {"nom": "Pharmacie Sakaby", "quartier": "Sect. 10, face à total, à 400m du CSPS de Sakaby", "telephone": "60 75 36 36", "lat": 11.216816, "lng": -4.286024, "groupe": 4},
  {"nom": "Pharmacie Sala", "quartier": "Colma, route de Bo o 2010 à 200 m des rails", "telephone": "20 97 18 89", "lat": 11.186738, "lng": -4.301887, "groupe": 1},
  {"nom": "Pharmacie Samba", "quartier": "À côté du CSPS St Bernard Bindougousso sect 14", "telephone": "04 37 24 24", "lat": 11.192819, "lng": -4.265227, "groupe": 4},
  {"nom": "Pharmacie Samhita", "quartier": "Sect. 24, après l’école prima re KUA D. sur la grande voie", "telephone": "25 39 34 81", "telephone2": "25 93 34 81", "lat": 11.182132, "lng": -4.240138, "groupe": 3},
  {"nom": "Pharmacie Sanitas", "quartier": "Marchés du sect. 25", "telephone": "20 97 22 42", "lat": 11.162441, "lng": -4.250536, "groupe": 3},
  {"nom": "Pharmacie Sarfalao", "quartier": "A 200m de la Mairie, Arrdt N°5 (ex DAFRA)", "telephone": "20 97 01 35", "lat": 11.159428, "lng": -4.28079, "groupe": 2},
  {"nom": "Pharmacie Sibiri", "quartier": "Sect. 25, route de Ouaga, collé à la Pyramide", "telephone": "20 97 79 02", "lat": 11.169132, "lng": -4.250947, "groupe": 1},
  {"nom": "Pharmacie Sifoma", "quartier": "Accart Ville face à la SONABEL", "telephone": "20 97 19 65", "lat": 11.182528, "lng": -4.307545, "groupe": 2},
  {"nom": "Pharmacie Sisaolé", "quartier": "", "telephone": "72 76 11 20", "lat": 11.18384, "lng": -4.344243, "groupe": 0},
  {"nom": "Pharmacie Siyara", "quartier": "Sect. 01 face au Grand marché", "telephone": "20 97 13 73", "lat": 11.176672, "lng": -4.301627, "groupe": 4},
  {"nom": "Pharmacie Solidarite", "quartier": "Médina Coura, route Trypano", "telephone": "20 97 17 26", "lat": 11.191809, "lng": -4.275092, "groupe": 4},
  {"nom": "Pharmacie Soudia", "quartier": "Av. de l’Unité, voie menant à l’hippodrome", "telephone": "20 97 14 49", "lat": 11.188443, "lng": -4.304341, "groupe": 3},
  {"nom": "Pharmacie Souligne", "quartier": "Sect. 01, imm SANGA Issa, siège ORANGE", "telephone": "20 97 08 16", "lat": 11.173843, "lng": -4.299887, "groupe": 3},
  {"nom": "Pharmacie Sya (Ex Dafra)", "quartier": "Rue Vicens, face au rond point des 03 luttes", "telephone": "20 97 79 93", "lat": 11.174054, "lng": -4.278631, "groupe": 2},
  {"nom": "Pharmacie Tene", "quartier": "Sect. 14, Bindougousso, à 300m de la station Shell", "telephone": "20 66 00 05", "lat": 11.193875, "lng": -4.296526, "groupe": 3},
  {"nom": "Pharmacie Vitalis", "quartier": "Sect. 22, route du plateau de Yéguèré", "telephone": "70 52 39 57", "telephone2": "20 98 12 17", "lat": 11.191268, "lng": -4.314333, "groupe": 3},
  {"nom": "Pharmacie Wobi", "quartier": "Av. de la République face Ex gare de SOGEBAF", "telephone": "20 97 36 97", "lat": 11.185261, "lng": -4.298237, "groupe": 1},
  {"nom": "Pharmacie Yamba", "quartier": "Souroukoukin, 300m de l’ex Ecole Jamot, route Bobo 2010", "telephone": "20 97 77 78", "lat": 11.180302, "lng": -4.302897, "groupe": 3},
  {"nom": "Pharmacie Yiwo Yo", "quartier": "", "telephone": "69 99 28 77", "lat": 11.171757, "lng": -4.257327, "groupe": 0},
  {"nom": "Pharmacie Zoe", "quartier": "Sect. 20, route de Orodara, Paroisse St Jean Paul II / Lafiabougou", "telephone": "63 10 07 75", "lat": 11.154532, "lng": -4.325211, "groupe": 2},
];
