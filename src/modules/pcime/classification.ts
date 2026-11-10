/**
 * Classification PCIME (Prise en Charge Intégrée des Maladies de l'Enfant).
 *
 * Règles tirées des tableaux OMS/UNICEF de la PCIME (enfant de 2 mois à 5 ans
 * et nourrisson de 0 à 2 mois). Le résultat est une SUGGESTION affichée au
 * soignant : il peut toujours la remplacer par sa propre classification.
 * Les seuils doivent être vérifiés par l'équipe médicale contre le guide
 * national PCIME en vigueur avant usage en routine.
 *
 * Couleurs : rouge = référence urgente, jaune = traitement au centre,
 * vert = soins à domicile.
 */

export type Couleur = "rouge" | "jaune" | "vert";

export interface Classement {
  couleur: Couleur;
  libelle: string;
  /** Rubrique de la fiche (Toux, Diarrhée…), pour l'affichage. */
  rubrique: string;
}

const RANG: Record<Couleur, number> = { vert: 0, jaune: 1, rouge: 2 };

export const pire = (liste: Classement[]): Classement | undefined =>
  liste.reduce<Classement | undefined>((a, c) => (!a || RANG[c.couleur] > RANG[a.couleur] ? c : a), undefined);

/** Libellés de la classification globale, identiques à ceux déjà enregistrés dans l'application. */
export const LIBELLE_GLOBAL: Record<Couleur, string> = {
  rouge: "Rouge (Référence urgente)",
  jaune: "Jaune (Traitement ambulatoire)",
  vert: "Vert (Traitement à domicile)",
};

export const EMOJI: Record<Couleur, string> = { rouge: "🔴", jaune: "🟡", vert: "🟢" };

/** Texte enregistré dans la fiche pour une rubrique : « Rouge — … ». */
export const texteClassement = (c?: Classement): string =>
  c ? `${c.couleur === "rouge" ? "Rouge" : c.couleur === "jaune" ? "Jaune" : "Vert"} — ${c.libelle}` : "";

/** Couleur d'un texte de classification déjà enregistré (« Rouge — … », « Jaune (…) »…). */
export const couleurDeTexte = (t?: string): Couleur | undefined => {
  const v = (t || "").toLowerCase();
  if (v.startsWith("rouge")) return "rouge";
  if (v.startsWith("jaune")) return "jaune";
  if (v.startsWith("vert")) return "vert";
  return undefined;
};

/* ------------------------------------------------------------------ */
/*  Enfant de 2 mois à 5 ans                                           */
/* ------------------------------------------------------------------ */

export type PliCutane = "normal" | "lent" | "tres_lent";
export type Paleur = "aucune" | "legere" | "severe";
export type ResultatTdr = "Positif" | "Négatif" | "Non fait";

export interface SignesEnfant {
  ageMois: number;
  temperature?: number;
  // Signes généraux de danger
  nePeutBoire: boolean;
  vomitTout: boolean;
  convulsions: boolean;
  lethargique: boolean;
  // Toux / difficulté respiratoire
  toux: boolean;
  freqRespiratoire?: number;
  tirageSousCostal: boolean;
  stridor: boolean;
  // Diarrhée
  diarrhee: boolean;
  diarrheeJours?: number;
  sangSelles: boolean;
  diarrheeLethargique: boolean;
  agiteIrritable: boolean;
  yeuxEnfonces: boolean;
  boitDifficilement: boolean;
  boitAvidement: boolean;
  pliCutane: PliCutane;
  // Fièvre
  fievre: boolean;
  fievreJours?: number;
  raideurNuque: boolean;
  tdr: ResultatTdr;
  eruptionGeneralisee: boolean;
  // Oreille
  oreilleDouleur: boolean;
  oreilleEcoulement: boolean;
  oreilleJours?: number;
  gonflementRetroAuriculaire: boolean;
  // Nutrition / anémie
  pb?: number;
  oedemes: boolean;
  paleur: Paleur;
}

export interface ResultatEnfant {
  danger?: Classement;
  respiratoire?: Classement;
  diarrhee: Classement[];
  fievre: Classement[];
  oreille?: Classement;
  nutrition?: Classement;
  anemie?: Classement;
  global?: Classement;
  tous: Classement[];
  /** Paludisme simple / grave pour le TLOH, si le TDR est positif. */
  classementPalu?: "PS" | "PG";
  /** Remarques à afficher (TDR à faire, fièvre prolongée…). */
  alertes: string[];
}

/** Respiration rapide selon l'âge (seuils PCIME). */
export const seuilRespirationRapide = (ageMois: number): number =>
  ageMois < 2 ? 60 : ageMois < 12 ? 50 : 40;

export function classerEnfant(s: SignesEnfant): ResultatEnfant {
  const tous: Classement[] = [];
  const alertes: string[] = [];
  const add = (c: Classement) => { tous.push(c); return c; };
  const signeDanger = s.nePeutBoire || s.vomitTout || s.convulsions || s.lethargique;

  let danger: Classement | undefined;
  if (signeDanger) danger = add({ couleur: "rouge", libelle: "Maladie très grave (signe général de danger)", rubrique: "Signes de danger" });

  // --- Toux ou difficulté respiratoire ---
  let respiratoire: Classement | undefined;
  if (s.toux) {
    const rapide = !!s.freqRespiratoire && s.freqRespiratoire >= seuilRespirationRapide(s.ageMois);
    if (signeDanger || s.stridor || s.tirageSousCostal)
      respiratoire = { couleur: "rouge", libelle: "Pneumonie grave ou maladie très grave", rubrique: "Toux" };
    else if (rapide)
      respiratoire = { couleur: "jaune", libelle: "Pneumonie", rubrique: "Toux" };
    else
      respiratoire = { couleur: "vert", libelle: "Pas de pneumonie : toux ou rhume", rubrique: "Toux" };
    add(respiratoire);
    if (!s.freqRespiratoire) alertes.push("Comptez la fréquence respiratoire sur 1 minute pour classer la toux.");
  }

  // --- Diarrhée ---
  const diarrhee: Classement[] = [];
  if (s.diarrhee) {
    const lethargique = s.diarrheeLethargique || s.lethargique;
    const nePeutBoire = s.boitDifficilement || s.nePeutBoire;
    const severe = [lethargique, s.yeuxEnfonces, nePeutBoire, s.pliCutane === "tres_lent"].filter(Boolean).length >= 2;
    const modere = [s.agiteIrritable, s.yeuxEnfonces, s.boitAvidement, s.pliCutane === "lent" || s.pliCutane === "tres_lent"].filter(Boolean).length >= 2;
    const deshydratation: Couleur = severe ? "rouge" : modere ? "jaune" : "vert";
    diarrhee.push(
      severe
        ? { couleur: "rouge", libelle: "Déshydratation sévère (Plan C)", rubrique: "Diarrhée" }
        : modere
        ? { couleur: "jaune", libelle: "Signes évidents de déshydratation (Plan B)", rubrique: "Diarrhée" }
        : { couleur: "vert", libelle: "Pas de déshydratation (Plan A)", rubrique: "Diarrhée" }
    );
    if ((s.diarrheeJours ?? 0) >= 14)
      diarrhee.push(
        deshydratation !== "vert"
          ? { couleur: "rouge", libelle: "Diarrhée persistante sévère", rubrique: "Diarrhée" }
          : { couleur: "jaune", libelle: "Diarrhée persistante", rubrique: "Diarrhée" }
      );
    if (s.sangSelles) diarrhee.push({ couleur: "jaune", libelle: "Dysenterie (diarrhée sanglante)", rubrique: "Diarrhée" });
    diarrhee.forEach(add);
  }

  // --- Fièvre (zone à haut risque de paludisme) ---
  const fievre: Classement[] = [];
  let classementPalu: "PS" | "PG" | undefined;
  if (s.fievre) {
    const tresGrave = signeDanger || s.raideurNuque;
    if (tresGrave) {
      fievre.push({ couleur: "rouge", libelle: s.tdr === "Positif" ? "Maladie fébrile très grave — paludisme grave" : "Maladie fébrile très grave", rubrique: "Fièvre" });
      if (s.tdr === "Positif") classementPalu = "PG";
    } else if (s.tdr === "Positif") {
      fievre.push({ couleur: "jaune", libelle: "Paludisme simple (TDR positif)", rubrique: "Fièvre" });
      classementPalu = "PS";
    } else if (s.tdr === "Négatif") {
      fievre.push({ couleur: "vert", libelle: "Fièvre : pas de paludisme (TDR négatif) — chercher une autre cause", rubrique: "Fièvre" });
    } else {
      fievre.push({ couleur: "jaune", libelle: "Fièvre — TDR paludisme à faire", rubrique: "Fièvre" });
      alertes.push("Fièvre : faites le TDR paludisme avant de classer.");
    }
    if (s.eruptionGeneralisee)
      fievre.push(
        signeDanger
          ? { couleur: "rouge", libelle: "Rougeole grave et compliquée (suspicion) — à déclarer", rubrique: "Fièvre" }
          : { couleur: "jaune", libelle: "Rougeole (suspicion) — à déclarer", rubrique: "Fièvre" }
      );
    if ((s.fievreJours ?? 0) >= 7) alertes.push("Fièvre depuis 7 jours ou plus : référer pour bilan.");
    fievre.forEach(add);
  }

  // --- Oreille ---
  let oreille: Classement | undefined;
  if (s.oreilleDouleur || s.oreilleEcoulement || s.gonflementRetroAuriculaire) {
    if (s.gonflementRetroAuriculaire) oreille = { couleur: "rouge", libelle: "Mastoïdite", rubrique: "Oreille" };
    else if (s.oreilleEcoulement && (s.oreilleJours ?? 0) >= 14) oreille = { couleur: "jaune", libelle: "Infection chronique de l'oreille", rubrique: "Oreille" };
    else oreille = { couleur: "jaune", libelle: "Infection aiguë de l'oreille", rubrique: "Oreille" };
    add(oreille);
  }

  // --- Nutrition (PB / œdèmes) ---
  let nutrition: Classement | undefined;
  const pb = s.pb && s.pb > 0 ? s.pb : undefined;
  if (s.oedemes || pb !== undefined) {
    const mas = s.oedemes || (pb !== undefined && pb < 11.5);
    if (mas) {
      const complique = signeDanger || respiratoire?.couleur === "rouge" || diarrhee.some((d) => d.couleur === "rouge") || fievre.some((f) => f.couleur === "rouge");
      nutrition = complique
        ? { couleur: "rouge", libelle: "Malnutrition aiguë sévère compliquée (CREN interne)", rubrique: "Nutrition" }
        : { couleur: "jaune", libelle: "Malnutrition aiguë sévère sans complication (CRENAS)", rubrique: "Nutrition" };
    } else if (pb !== undefined && pb < 12.5) {
      nutrition = { couleur: "jaune", libelle: "Malnutrition aiguë modérée", rubrique: "Nutrition" };
    } else {
      nutrition = { couleur: "vert", libelle: "Pas de malnutrition aiguë", rubrique: "Nutrition" };
    }
    add(nutrition);
    if (s.ageMois < 6 && pb !== undefined) alertes.push("PB : seuils valables à partir de 6 mois — utilisez le poids/taille avant 6 mois.");
  }

  // --- Anémie ---
  let anemie: Classement | undefined;
  if (s.paleur === "severe") anemie = add({ couleur: "rouge", libelle: "Anémie sévère (pâleur palmaire sévère)", rubrique: "Anémie" });
  else if (s.paleur === "legere") anemie = add({ couleur: "jaune", libelle: "Anémie (pâleur palmaire légère)", rubrique: "Anémie" });

  return { danger, respiratoire, diarrhee, fievre, oreille, nutrition, anemie, global: pire(tous), tous, classementPalu, alertes };
}

/* ------------------------------------------------------------------ */
/*  Nourrisson de 0 à 2 mois                                           */
/* ------------------------------------------------------------------ */

export interface SignesNourrisson {
  ageJours?: number;
  temperature?: number;
  poids?: number;
  // Infection bactérienne possible / maladie très grave
  neSalimentePasBien: boolean;
  convulsions: boolean;
  freqRespiratoire?: number;
  tirageSevere: boolean;
  bougeSeulementStimule: boolean; // ou ne bouge pas du tout
  // Infection bactérienne locale
  ombilicRougeOuPus: boolean;
  pustulesCutanees: boolean;
  // Ictère
  ictere: boolean;
  ictereAvant24h: boolean;
  paumesPlantesJaunes: boolean;
  // Diarrhée
  diarrhee: boolean;
  diarrheeJours?: number;
  sangSelles: boolean;
  agiteIrritable: boolean;
  yeuxEnfonces: boolean;
  pliCutane: PliCutane;
  // Alimentation / poids
  allaitementDifficile: boolean; // mauvaise prise du sein ou succion inefficace
  moinsDe8Tetees: boolean;
  autresAliments: boolean;
  muguet: boolean;
  poidsFaible: boolean; // poids faible pour l'âge sur la courbe
}

export interface ResultatNourrisson {
  infection?: Classement;
  ictere?: Classement;
  diarrhee: Classement[];
  alimentation?: Classement;
  global?: Classement;
  tous: Classement[];
  alertes: string[];
}

export function classerNourrisson(s: SignesNourrisson): ResultatNourrisson {
  const tous: Classement[] = [];
  const alertes: string[] = [];
  const add = (c: Classement) => { tous.push(c); return c; };
  const t = s.temperature;
  const temperatureAnormale = t !== undefined && t > 0 && (t >= 37.5 || t < 35.5);
  const rapide = !!s.freqRespiratoire && s.freqRespiratoire >= 60;
  const moinsDe7Jours = s.ageJours !== undefined && s.ageJours < 7;

  // --- Infection bactérienne possible / maladie très grave ---
  let infection: Classement | undefined;
  if (s.neSalimentePasBien || s.convulsions || s.tirageSevere || s.bougeSeulementStimule || temperatureAnormale || (rapide && (moinsDe7Jours || s.ageJours === undefined)))
    infection = { couleur: "rouge", libelle: "Maladie très grave / infection bactérienne grave possible", rubrique: "Infection" };
  else if (rapide)
    infection = { couleur: "jaune", libelle: "Pneumonie (respiration rapide isolée, 7 à 59 jours)", rubrique: "Infection" };
  else if (s.ombilicRougeOuPus || s.pustulesCutanees)
    infection = { couleur: "jaune", libelle: "Infection bactérienne locale", rubrique: "Infection" };
  else
    infection = { couleur: "vert", libelle: "Infection grave ou locale peu probable", rubrique: "Infection" };
  add(infection);
  if (!s.freqRespiratoire) alertes.push("Comptez la fréquence respiratoire (respiration rapide = 60/min ou plus).");
  if (!(t && t > 0)) alertes.push("Prenez la température (fièvre ≥ 37,5 °C ou hypothermie < 35,5 °C = signe de gravité).");

  // --- Ictère ---
  let ictere: Classement | undefined;
  if (s.ictere || s.paumesPlantesJaunes) {
    ictere = s.ictereAvant24h || s.paumesPlantesJaunes
      ? { couleur: "rouge", libelle: "Ictère sévère", rubrique: "Ictère" }
      : { couleur: "jaune", libelle: "Ictère", rubrique: "Ictère" };
    add(ictere);
    if ((s.ageJours ?? 0) >= 14 && ictere.couleur === "jaune") alertes.push("Ictère encore présent après 14 jours : à référer pour bilan.");
  }

  // --- Diarrhée ---
  const diarrhee: Classement[] = [];
  if (s.diarrhee) {
    const severe = [s.bougeSeulementStimule, s.yeuxEnfonces, s.pliCutane === "tres_lent"].filter(Boolean).length >= 2;
    const modere = [s.agiteIrritable, s.yeuxEnfonces, s.pliCutane === "lent" || s.pliCutane === "tres_lent"].filter(Boolean).length >= 2;
    diarrhee.push(
      severe
        ? { couleur: "rouge", libelle: "Déshydratation sévère", rubrique: "Diarrhée" }
        : modere
        ? { couleur: "jaune", libelle: "Signes évidents de déshydratation", rubrique: "Diarrhée" }
        : { couleur: "vert", libelle: "Pas de déshydratation", rubrique: "Diarrhée" }
    );
    if ((s.diarrheeJours ?? 0) >= 14) diarrhee.push({ couleur: "rouge", libelle: "Diarrhée persistante sévère", rubrique: "Diarrhée" });
    if (s.sangSelles) diarrhee.push({ couleur: "rouge", libelle: "Sang dans les selles", rubrique: "Diarrhée" });
    diarrhee.forEach(add);
  }

  // --- Alimentation et poids ---
  let alimentation: Classement | undefined;
  if (s.poids && s.poids > 0 && s.poids < 2) {
    alimentation = { couleur: "rouge", libelle: "Poids très faible (< 2 kg)", rubrique: "Alimentation" };
  } else if (s.allaitementDifficile || s.moinsDe8Tetees || s.autresAliments || s.muguet || s.poidsFaible) {
    alimentation = { couleur: "jaune", libelle: "Problème d'alimentation ou poids faible", rubrique: "Alimentation" };
  } else {
    alimentation = { couleur: "vert", libelle: "Pas de problème d'alimentation", rubrique: "Alimentation" };
  }
  add(alimentation);

  return { infection, ictere, diarrhee, alimentation, global: pire(tous), tous, alertes };
}

/* ------------------------------------------------------------------ */
/*  Rendez-vous de suivi                                               */
/* ------------------------------------------------------------------ */

/**
 * Délai de visite de suivi conseillé (en jours) selon les classements :
 * le plus court des délais applicables. Aucun RDV si l'enfant est référé
 * (classement rouge) ou si rien ne demande de suivi.
 */
export function delaiSuiviJours(tous: Classement[]): number | undefined {
  if (tous.some((c) => c.couleur === "rouge")) return undefined;
  const regles: [RegExp, number][] = [
    [/^ictère$/, 1],
    [/infection bactérienne locale|respiration rapide isolée|problème d'alimentation/, 2],
    [/pas de paludisme/, 2],
    [/^pneumonie$|dysenterie|paludisme simple/, 3],
    [/persistante|oreille/, 5],
    [/sévère sans complication/, 7],
    [/anémie/, 14],
    [/modérée/, 30],
  ];
  const delais = tous
    .filter((c) => c.couleur === "jaune" || /pas de paludisme/.test(c.libelle.toLowerCase()))
    .flatMap((c) => regles.filter(([re]) => re.test(c.libelle.toLowerCase())).map(([, j]) => j));
  return delais.length ? Math.min(...delais) : undefined;
}
