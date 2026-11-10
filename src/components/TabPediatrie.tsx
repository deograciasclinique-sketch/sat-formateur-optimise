/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { Consultation, FichePediatrique, RendezVous, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, Trash2, Search, Activity, ShieldAlert, AlertTriangle, Eye, Download, X, UserPlus, CalendarClock, Sparkles } from "lucide-react";
import {
  Classement, Couleur, EMOJI, LIBELLE_GLOBAL, PliCutane, Paleur, ResultatTdr,
  classerEnfant, classerNourrisson, couleurDeTexte, delaiSuiviJours, pire, texteClassement,
} from "../modules/pcime/classification";

interface TabPediatrieProps {
  pediatrie: FichePediatrique[];
  staff: Staff[];
  onUpdatePediatrie: (p: FichePediatrique[]) => void;
  theme?: "light" | "dark";
  /** Dossiers ouverts par la caisse (orientation « Consultation enfant »). */
  consultations?: Consultation[];
  onUpdateConsultations?: (c: Consultation[]) => void;
  /** Rendez-vous : la visite de suivi PCIME y est ajoutée. */
  rdvs?: RendezVous[];
  onUpdateRdvs?: (r: RendezVous[]) => void;
  agentNom?: string;
}

const COULEUR_BADGE: Record<Couleur, string> = {
  rouge: "bg-danger-100 text-danger-800 border-danger-200",
  jaune: "bg-warning-100 text-warning-800 border-warning-200",
  vert: "bg-success-100 text-success-800 border-success-200",
};

/** Suggestion automatique PCIME d'une rubrique + choix manuel pour la remplacer. */
function ChoixClassement({ auto, valeur, onChange, options }: { auto: Classement[]; valeur: string; onChange: (v: string) => void; options?: string[] }) {
  if (auto.length === 0 && !options) return null;
  return (
    <div className="space-y-1.5">
      {auto.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <Sparkles className="w-3.5 h-3.5 text-primary-600" />
          {auto.map((c, i) => (
            <span key={i} className={`text-2xs font-bold px-2 py-0.5 rounded-lg border ${COULEUR_BADGE[c.couleur]} ${valeur ? "opacity-50 line-through" : ""}`}>
              {EMOJI[c.couleur]} {c.libelle}
            </span>
          ))}
        </div>
      )}
      {options && (
        <select value={valeur} onChange={(e) => onChange(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none font-semibold">
          <option value="">{auto.length ? "✓ Garder la classification automatique" : "— Classification —"}</option>
          {options.map((o) => (
            <option key={o} value={o}>{EMOJI[couleurDeTexte(o) || "vert"]} {o.replace(/^(Rouge|Jaune|Vert) — /, "")} (manuel)</option>
          ))}
        </select>
      )}
    </div>
  );
}

const ajouterJours = (iso: string, jours: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function TabPediatrie({ pediatrie, staff, onUpdatePediatrie, theme = "light", consultations = [], onUpdateConsultations, rdvs = [], onUpdateRdvs, agentNom }: TabPediatrieProps) {
  // Load dynamic clinic profile from LocalStorage safely
  const profile = (() => {
    try {
      const saved = localStorage.getItem("dg_clinic_profile");
      return saved ? JSON.parse(saved) : {
        name: "Cabinet Médical DEO-GRACIAS",
        address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital",
        phone: "+226 20 97 12 34"
      };
    } catch {
      return { name: "Cabinet Médical DEO-GRACIAS", address: "Bobo-Dioulasso, Secteur 15, Rue de l'Hôpital", phone: "+226 20 97 12 34" };
    }
  })();

  // --- Identification ---
  const [pedPatient, setPedPatient] = useState("");
  const [pedSexe, setPedSexe] = useState<"Masculin" | "Féminin" | "">("");
  const [pedDateNaissance, setPedDateNaissance] = useState("");
  const [pedAgeMois, setPedAgeMois] = useState("");
  const [pedContact, setPedContact] = useState("");
  const [pedTemperature, setPedTemperature] = useState("");
  const [pedMotif, setPedMotif] = useState("");

  // --- Mesures anthropométriques ---
  const [pedPoids, setPedPoids] = useState("");
  const [pedTaille, setPedTaille] = useState("");
  const [pedPc, setPedPc] = useState("");
  const [pedPb, setPedPb] = useState("");
  const [pedOedemes, setPedOedemes] = useState(false);
  const [paleur, setPaleur] = useState<Paleur>("aucune");
  const [classifNutrition, setClassifNutrition] = useState("");

  // --- Formulaire : nourrisson 0-2 mois ou enfant 2 mois-5 ans ---
  const [tranche, setTranche] = useState<"0-2m" | "2m-5a">("2m-5a");
  const [ageJours, setAgeJours] = useState("");
  const NOURRISSON_VIDE = {
    neSalimentePasBien: false, convulsions: false, tirageSevere: false, bougeSeulementStimule: false,
    ombilicRougeOuPus: false, pustulesCutanees: false, ictere: false, ictereAvant24h: false, paumesPlantesJaunes: false,
    allaitementDifficile: false, moinsDe8Tetees: false, autresAliments: false, muguet: false, poidsFaible: false,
  };
  const [nour, setNour] = useState(NOURRISSON_VIDE);
  const setN = (k: keyof typeof NOURRISSON_VIDE, v: boolean) => setNour((x) => ({ ...x, [k]: v }));

  // --- Lien caisse / TDR / suivi ---
  const [consultationLiee, setConsultationLiee] = useState<Consultation | null>(null);
  const [tdrPalu, setTdrPalu] = useState<ResultatTdr>("Non fait");
  const [raideurNuque, setRaideurNuque] = useState(false);
  const [gonflementRetro, setGonflementRetro] = useState(false);
  const [programmerSuivi, setProgrammerSuivi] = useState(true);
  const [dateControle, setDateControle] = useState("");

  // --- Signes Généraux de Danger (PCIME) ---
  const [dangerNePeutBoire, setDangerNePeutBoire] = useState(false);
  const [dangerVomitTout, setDangerVomitTout] = useState(false);
  const [dangerConvulsions, setDangerConvulsions] = useState(false);
  const [dangerLethargique, setDangerLethargique] = useState(false);

  // --- Toux / difficulté respiratoire ---
  const [touxPresent, setTouxPresent] = useState(false);
  const [touxDureeJours, setTouxDureeJours] = useState("");
  const [freqRespiratoire, setFreqRespiratoire] = useState("");
  const [tirageSousCostal, setTirageSousCostal] = useState(false);
  const [stridor, setStridor] = useState(false);
  const [classifRespiratoire, setClassifRespiratoire] = useState("");

  // --- Diarrhée ---
  const [diarrheePresent, setDiarrheePresent] = useState(false);
  const [diarrheeDureeJours, setDiarrheeDureeJours] = useState("");
  const [diarrheeSangSelles, setDiarrheeSangSelles] = useState(false);
  const [diarrheeLethargique, setDiarrheeLethargique] = useState(false);
  const [diarrheeAgite, setDiarrheeAgite] = useState(false);
  const [diarrheeBoitDifficilement, setDiarrheeBoitDifficilement] = useState(false);
  const [diarrheeYeuxEnfonces, setDiarrheeYeuxEnfonces] = useState(false);
  const [diarrheeBoitAvidement, setDiarrheeBoitAvidement] = useState(false);
  const [pliCutane, setPliCutane] = useState<PliCutane>("normal");
  const [classifDiarrhee, setClassifDiarrhee] = useState("");

  // --- Fièvre ---
  const [fievrePresent, setFievrePresent] = useState(false);
  const [fievreDureeJours, setFievreDureeJours] = useState("");
  const [fievreTypePalu, setFievreTypePalu] = useState(false);
  const [fievreTypeRougeole, setFievreTypeRougeole] = useState(false);
  const [classifFievre, setClassifFievre] = useState("");

  // --- Problème d'oreille ---
  const [oreilleDouleur, setOreilleDouleur] = useState(false);
  const [oreilleEcoulement, setOreilleEcoulement] = useState(false);
  const [oreilleDureeJours, setOreilleDureeJours] = useState("");
  const [classifOreille, setClassifOreille] = useState("");

  // --- Vaccination / Vitamine A ---
  const [pedVaccinsAJour, setPedVaccinsAJour] = useState(true);
  const [vitAAdministree, setVitAAdministree] = useState(false);
  const [deparasitageFait, setDeparasitageFait] = useState(false);
  const [pedAlimentation, setPedAlimentation] = useState("Allaitement maternel exclusif");

  // --- Conclusion ---
  const [pedConsultant, setPedConsultant] = useState("");
  const [classificationGlobale, setClassificationGlobale] = useState("");
  const [pedConduiteATenir, setPedConduiteATenir] = useState("");
  const [pedDiagnostic, setPedDiagnostic] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiche, setSelectedFiche] = useState<FichePediatrique | null>(null);

  // Calcul automatique de l'âge en mois à partir de la date de naissance
  const computeAgeMoisFromDob = (dob: string): number | null => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (now.getDate() < birth.getDate()) months -= 1;
    return Math.max(0, months);
  };

  const handleDateNaissanceChange = (val: string) => {
    setPedDateNaissance(val);
    const computed = computeAgeMoisFromDob(val);
    if (computed !== null) setPedAgeMois(String(computed));
    const naissance = new Date(val + "T00:00:00");
    if (val && !isNaN(naissance.getTime())) {
      const jours = Math.max(0, Math.floor((Date.now() - naissance.getTime()) / 86400000));
      setAgeJours(String(jours));
      // Moins de 2 mois : formulaire nourrisson.
      setTranche(jours < 60 ? "0-2m" : "2m-5a");
    }
  };

  const auMoinsUnSigneDanger = dangerNePeutBoire || dangerVomitTout || dangerConvulsions || dangerLethargique;
  const estNourrisson = tranche === "0-2m";
  const num = (v: string) => (v.trim() ? parseFloat(v.replace(",", ".")) : undefined);

  // --- Classification automatique PCIME (suggestion, modifiable) ---
  const resEnfant = classerEnfant({
    ageMois: num(pedAgeMois) ?? 12,
    temperature: num(pedTemperature),
    nePeutBoire: dangerNePeutBoire, vomitTout: dangerVomitTout, convulsions: dangerConvulsions, lethargique: dangerLethargique,
    toux: touxPresent, freqRespiratoire: num(freqRespiratoire), tirageSousCostal, stridor,
    diarrhee: diarrheePresent, diarrheeJours: num(diarrheeDureeJours), sangSelles: diarrheeSangSelles,
    diarrheeLethargique, agiteIrritable: diarrheeAgite, yeuxEnfonces: diarrheeYeuxEnfonces,
    boitDifficilement: diarrheeBoitDifficilement, boitAvidement: diarrheeBoitAvidement, pliCutane,
    fievre: fievrePresent, fievreJours: num(fievreDureeJours), raideurNuque, tdr: tdrPalu, eruptionGeneralisee: fievreTypeRougeole,
    oreilleDouleur, oreilleEcoulement, oreilleJours: num(oreilleDureeJours), gonflementRetroAuriculaire: gonflementRetro,
    pb: num(pedPb), oedemes: pedOedemes, paleur,
  });
  const resNour = classerNourrisson({
    ...nour,
    ageJours: num(ageJours) ?? (num(pedAgeMois) !== undefined ? Math.round((num(pedAgeMois) as number) * 30.4) : undefined),
    temperature: num(pedTemperature), poids: num(pedPoids), freqRespiratoire: num(freqRespiratoire),
    diarrhee: diarrheePresent, diarrheeJours: num(diarrheeDureeJours), sangSelles: diarrheeSangSelles,
    agiteIrritable: diarrheeAgite, yeuxEnfonces: diarrheeYeuxEnfonces, pliCutane,
  });

  // Classements retenus : le choix manuel du soignant remplace la suggestion de la rubrique.
  const retenu = (manuel: string, auto: Classement[], rubrique: string): Classement[] => {
    if (!manuel) return auto;
    const c = couleurDeTexte(manuel) || "vert";
    return [{ couleur: c, libelle: manuel.replace(/^(Rouge|Jaune|Vert) — /, ""), rubrique }];
  };
  const optionnel = (c?: Classement) => (c ? [c] : []);
  const classementsRetenus: Classement[] = estNourrisson
    ? resNour.tous
    : [
        ...optionnel(resEnfant.danger),
        ...(touxPresent ? retenu(classifRespiratoire, optionnel(resEnfant.respiratoire), "Toux") : []),
        ...(diarrheePresent ? retenu(classifDiarrhee, resEnfant.diarrhee, "Diarrhée") : []),
        ...(fievrePresent ? retenu(classifFievre, resEnfant.fievre, "Fièvre") : []),
        ...retenu(classifOreille, optionnel(resEnfant.oreille), "Oreille"),
        ...retenu(classifNutrition, optionnel(resEnfant.nutrition), "Nutrition"),
        ...optionnel(resEnfant.anemie),
      ];
  const globalAuto = pire(classementsRetenus);
  const alertesPcime = estNourrisson ? resNour.alertes : resEnfant.alertes;
  const delaiSuivi = delaiSuiviJours(classementsRetenus);
  const dateControleProposee = delaiSuivi ? ajouterJours(getTodayStr(), delaiSuivi) : "";
  const dateControleEffective = dateControle || dateControleProposee;

  // Nutritional MUAC Classifier
  const getNutritionStatus = (pbVal: number, hasOedemes: boolean): { status: string; color: string; label: string } => {
    if (hasOedemes) {
      return { status: "MAS", color: "bg-danger-100 text-danger-800 border-danger-200", label: "🔴 Malnutrition Aiguë Sévère (MAS - avec oedèmes)" };
    }
    if (!pbVal) return { status: "Non évalué", color: "bg-stone-100 text-stone-600 border-stone-200", label: "Non évalué" };

    if (pbVal < 11.5) {
      return { status: "MAS", color: "bg-danger-100 text-danger-800 border-danger-200 animate-pulse", label: "🔴 Malnutrition Aiguë Sévère (MAS)" };
    } else if (pbVal >= 11.5 && pbVal < 12.5) {
      return { status: "MAM", color: "bg-warning-100 text-warning-800 border-warning-200", label: "🟡 Malnutrition Aiguë Modérée (MAM)" };
    } else {
      return { status: "Normal", color: "bg-success-100 text-success-800 border-success-200", label: "🟢 Normal (Eutrophique)" };
    }
  };

  const resetForm = () => {
    setPedPatient("");
    setPedSexe("");
    setPedDateNaissance("");
    setPedAgeMois("");
    setPedContact("");
    setPedTemperature("");
    setPedMotif("");
    setPedPoids("");
    setPedTaille("");
    setPedPc("");
    setPedPb("");
    setPedOedemes(false);
    setPaleur("aucune");
    setClassifNutrition("");
    setTranche("2m-5a");
    setAgeJours("");
    setNour(NOURRISSON_VIDE);
    setConsultationLiee(null);
    setTdrPalu("Non fait");
    setRaideurNuque(false);
    setGonflementRetro(false);
    setProgrammerSuivi(true);
    setDateControle("");
    setDangerNePeutBoire(false);
    setDangerVomitTout(false);
    setDangerConvulsions(false);
    setDangerLethargique(false);
    setTouxPresent(false);
    setTouxDureeJours("");
    setFreqRespiratoire("");
    setTirageSousCostal(false);
    setStridor(false);
    setClassifRespiratoire("");
    setDiarrheePresent(false);
    setDiarrheeDureeJours("");
    setDiarrheeSangSelles(false);
    setDiarrheeLethargique(false);
    setDiarrheeAgite(false);
    setDiarrheeBoitDifficilement(false);
    setDiarrheeYeuxEnfonces(false);
    setDiarrheeBoitAvidement(false);
    setPliCutane("normal");
    setClassifDiarrhee("");
    setFievrePresent(false);
    setFievreDureeJours("");
    setFievreTypePalu(false);
    setFievreTypeRougeole(false);
    setClassifFievre("");
    setOreilleDouleur(false);
    setOreilleEcoulement(false);
    setOreilleDureeJours("");
    setClassifOreille("");
    setVitAAdministree(false);
    setDeparasitageFait(false);
    setClassificationGlobale("");
    setPedConduiteATenir("");
    setPedDiagnostic("");
  };

  const handleAddPediatrie = () => {
    const ageSaisi = estNourrisson ? (num(ageJours) !== undefined || !!pedAgeMois) : !!pedAgeMois;
    if (!pedPatient.trim() || !ageSaisi || !pedPoids) {
      alert(`Veuillez saisir le nom de l'enfant, son âge (${estNourrisson ? "jours" : "mois"}) et son poids.`);
      return;
    }

    const jours = num(ageJours);
    const age = estNourrisson && jours !== undefined ? Math.round((jours / 30.44) * 10) / 10 : parseFloat(pedAgeMois) || 1;
    const poids = parseFloat(pedPoids) || 0;
    const taille = parseFloat(pedTaille) || 0;
    const pc = parseFloat(pedPc) || 0;
    const pb = estNourrisson ? 0 : parseFloat(pedPb) || 0;

    const nutObj = getNutritionStatus(pb, pedOedemes);
    const textes = (l: Classement[]) => l.map(texteClassement).join(" ; ") || undefined;
    const classificationGlobaleFinale = classificationGlobale || (globalAuto ? LIBELLE_GLOBAL[globalAuto.couleur] : undefined);
    // PS / PG : seulement si le TDR est positif (et pas de choix manuel « fièvre » contraire).
    const classementPalu = !estNourrisson && fievrePresent && tdrPalu === "Positif"
      ? (couleurDeTexte(classifFievre) === "rouge" ? "PG" : classifFievre ? "PS" : resEnfant.classementPalu)
      : undefined;

    const ficheId = generateUid();
    let rdvId: string | undefined;
    const faireRdv = programmerSuivi && !!dateControleEffective && !!onUpdateRdvs && (couleurDeTexte(classificationGlobale) || globalAuto?.couleur) !== "rouge";
    if (faireRdv && onUpdateRdvs) {
      const consultantNom = staff.find((x) => x.id === pedConsultant)?.nom || "";
      const motifs = classementsRetenus.filter((c) => c.couleur === "jaune").map((c) => c.libelle);
      const nouveauRdv: RendezVous = {
        id: generateUid(),
        patient: pedPatient.trim(),
        date: dateControleEffective,
        heure: "08:00",
        contact: pedContact.trim(),
        type: "Suivi",
        praticien: consultantNom,
        motif: `Visite de suivi PCIME${motifs.length ? ` : ${motifs.join(", ")}` : ""}`,
        notes: `Programmé depuis la consultation enfant du ${new Date().toLocaleDateString("fr-FR")}.`,
        statut: "Planifié",
        createdAt: new Date().toISOString(),
        creePar: agentNom,
      };
      rdvId = nouveauRdv.id;
      onUpdateRdvs([...rdvs, nouveauRdv]);
    }

    const newFiche: FichePediatrique = {
      id: ficheId,
      patient: pedPatient.trim(),
      sexe: pedSexe || undefined,
      dateNaissance: pedDateNaissance || undefined,
      ageMois: age,
      ageJours: estNourrisson ? jours : undefined,
      tranche,
      contact: pedContact.trim(),
      temperature: pedTemperature ? parseFloat(pedTemperature) : undefined,
      motif: pedMotif.trim(),
      poids,
      taille,
      pc,
      pb,
      oedemes: estNourrisson ? false : pedOedemes,
      statutNutritionnel: estNourrisson ? (resNour.alimentation?.couleur === "vert" ? "Normal" : resNour.alimentation?.libelle || "Non évalué") : nutObj.status,
      vaccinsAJour: pedVaccinsAJour,
      alimentation: pedAlimentation,
      consultant: pedConsultant,

      dangerNePeutBoireOuTeter: estNourrisson ? nour.neSalimentePasBien : dangerNePeutBoire,
      dangerVomitTout: estNourrisson ? false : dangerVomitTout,
      dangerConvulsions: estNourrisson ? nour.convulsions : dangerConvulsions,
      dangerLethargiqueInconscient: estNourrisson ? nour.bougeSeulementStimule : dangerLethargique,

      touxPresent: estNourrisson ? false : touxPresent,
      touxDureeJours: !estNourrisson && touxDureeJours ? parseFloat(touxDureeJours) : undefined,
      freqRespiratoire: freqRespiratoire ? parseFloat(freqRespiratoire) : undefined,
      tirageSousCostal: estNourrisson ? nour.tirageSevere : tirageSousCostal,
      stridor: estNourrisson ? false : stridor,
      classificationRespiratoire: !estNourrisson && touxPresent ? classifRespiratoire || textes(optionnel(resEnfant.respiratoire)) : undefined,

      diarrheePresent,
      diarrheeDureeJours: diarrheeDureeJours ? parseFloat(diarrheeDureeJours) : undefined,
      diarrheeSangSelles,
      diarrheeLethargique: estNourrisson ? undefined : diarrheeLethargique,
      diarrheeAgiteIrritable: diarrheeAgite,
      diarrheeLethargiqueAgite: diarrheeLethargique || diarrheeAgite,
      diarrheeBoitDifficilement: estNourrisson ? undefined : diarrheeBoitDifficilement,
      diarrheeYeuxEnfonces,
      diarrheeBoitAvidement: estNourrisson ? false : diarrheeBoitAvidement,
      pliCutane,
      diarrheePliCutanePersistant: pliCutane !== "normal",
      classificationDiarrhee: diarrheePresent ? (estNourrisson ? textes(resNour.diarrhee) : classifDiarrhee || textes(resEnfant.diarrhee)) : undefined,

      fievrePresent: estNourrisson ? false : fievrePresent,
      fievreDureeJours: !estNourrisson && fievreDureeJours ? parseFloat(fievreDureeJours) : undefined,
      fievreTypePalu: !estNourrisson && (fievreTypePalu || tdrPalu === "Positif"),
      fievreTypeRougeole: !estNourrisson && fievreTypeRougeole,
      raideurNuque: !estNourrisson && raideurNuque,
      classificationFievre: !estNourrisson && fievrePresent ? classifFievre || textes(resEnfant.fievre) : undefined,
      tdrPalu: !estNourrisson && fievrePresent ? tdrPalu : undefined,
      classementPalu,

      oreilleDouleur: !estNourrisson && oreilleDouleur,
      oreilleEcoulement: !estNourrisson && oreilleEcoulement,
      oreilleDureeJours: !estNourrisson && oreilleDureeJours ? parseFloat(oreilleDureeJours) : undefined,
      gonflementRetroAuriculaire: !estNourrisson && gonflementRetro,
      classificationOreille: estNourrisson ? undefined : classifOreille || textes(optionnel(resEnfant.oreille)),

      palmesPales: !estNourrisson && paleur !== "aucune",
      paleurPalmaire: estNourrisson ? undefined : paleur,
      classificationNutrition: estNourrisson ? undefined : classifNutrition || textes(optionnel(resEnfant.nutrition)),
      classificationAnemie: estNourrisson ? undefined : textes(optionnel(resEnfant.anemie)),

      nourrisson: estNourrisson
        ? {
            ...nour,
            classificationInfection: textes(optionnel(resNour.infection)),
            classificationIctere: textes(optionnel(resNour.ictere)),
            classificationAlimentation: textes(optionnel(resNour.alimentation)),
          }
        : undefined,

      vitAAdministree,
      deparasitageFait,

      classifications: classementsRetenus.map(texteClassement),
      classificationGlobale: classificationGlobaleFinale,
      classificationModifiee: !!classificationGlobale,
      conduiteATenir: pedConduiteATenir.trim(),

      dateControle: faireRdv ? dateControleEffective : undefined,
      rdvId,
      consultationId: consultationLiee?.id,
      codePatient: consultationLiee?.codePatient,

      diagnostic: pedDiagnostic.trim(),
      date: getTodayStr(),
      createdAt: new Date().toISOString()
    };

    // Dossier venu de la caisse : il est clos, la fiche PCIME le remplace.
    if (consultationLiee && onUpdateConsultations) {
      onUpdateConsultations(
        consultations.map((c) =>
          c.id === consultationLiee.id ? { ...c, statut: "Terminée", plainte: c.plainte || pedMotif.trim(), diagnostic: c.diagnostic || pedDiagnostic.trim() } : c
        )
      );
    }

    onUpdatePediatrie([newFiche, ...pediatrie]);
    resetForm();
    alert(
      `Fiche de consultation ${estNourrisson ? "nourrisson (0-2 mois)" : "enfant (PCIME)"} sauvegardée.` +
        (rdvId ? `\nVisite de suivi programmée le ${new Date(dateControleEffective + "T00:00:00").toLocaleDateString("fr-FR")} (onglet Rendez-vous).` : "")
    );
  };

  // Enfants envoyés par la caisse, en attente de consultation.
  const enfantsOrientes = consultations.filter(
    (c) => c.serviceDestination === "Pediatrie" && c.statut === "Attente prise en charge pédiatrie"
  );

  const handlePrendreEnCharge = (c: Consultation) => {
    resetForm();
    setConsultationLiee(c);
    setPedPatient(c.patient);
    setPedContact(c.contact || "");
    const sx = (c.sexe || "").toUpperCase();
    setPedSexe(sx.startsWith("M") ? "Masculin" : sx.startsWith("F") ? "Féminin" : "");
    // L'âge saisi à la caisse est en années.
    if (c.age > 0) {
      const mois = Math.round(c.age * 12);
      setPedAgeMois(String(mois));
      setTranche(mois < 2 ? "0-2m" : "2m-5a");
      if (mois < 2) setAgeJours(String(Math.round(c.age * 365)));
    }
    if (c.vitals?.temperature) setPedTemperature(String(c.vitals.temperature));
    if (c.vitals?.poids) setPedPoids(String(c.vitals.poids));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeletePed = (id: string) => {
    if (confirm("Supprimer cette fiche pédiatrique ?")) {
      onUpdatePediatrie(pediatrie.filter((p) => p.id !== id));
    }
  };

  const handleDownloadPDF = (p: FichePediatrique) => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(13, 148, 136);
    doc.text(profile.name, pageWidth / 2, y, { align: "center" });
    y += 5;
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${profile.address} — Tél: ${profile.phone}`, pageWidth / 2, y, { align: "center" });
    y += 8;

    doc.setFillColor(240, 253, 250);
    doc.rect(margin, y, contentWidth, 9, "F");
    doc.setDrawColor(13, 148, 136);
    doc.rect(margin, y, contentWidth, 9, "S");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(13, 148, 136);
    doc.text(p.tranche === "0-2m" ? "FICHE PCIME — NOURRISSON DE 0 À 2 MOIS" : "FICHE DE CONSULTATION PÉDIATRIQUE (PCIME)", pageWidth / 2, y + 6, { align: "center" });
    y += 16;

    const drawRow = (label: string, value: string) => {
      if (y > 275) { doc.addPage(); y = margin; }
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 70);
      doc.text(label, margin, y);
      doc.setFont("Helvetica", "normal");
      doc.setTextColor(20, 20, 20);
      const lines = doc.splitTextToSize(value || "—", contentWidth - 55);
      doc.text(lines, margin + 55, y);
      y += 5.5 * lines.length;
    };

    const drawSectionTitle = (title: string) => {
      y += 2;
      doc.setFillColor(245, 245, 244);
      doc.rect(margin, y, contentWidth, 6, "F");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(70, 70, 70);
      doc.text(title, margin + 2, y + 4.3);
      y += 9;
    };

    drawRow("Nom de l'enfant :", p.patient);
    drawRow("Sexe / Date de naissance :", `${p.sexe || "—"} / ${p.dateNaissance ? new Date(p.dateNaissance).toLocaleDateString("fr-FR") : "—"}`);
    drawRow("Âge :", p.tranche === "0-2m" && p.ageJours !== undefined ? `${p.ageJours} jours` : `${p.ageMois} mois`);
    drawRow("Contact parent :", p.contact || "—");
    drawRow("Température :", p.temperature ? `${p.temperature} °C` : "—");
    drawRow("Motif de consultation :", p.motif || "—");

    drawSectionTitle("MESURES ANTHROPOMÉTRIQUES");
    drawRow("Poids / Taille :", `${p.poids} kg / ${p.taille || "—"} cm`);
    drawRow("Périmètre crânien / MUAC (PB) :", `${p.pc || "—"} cm / ${p.pb || "—"} cm`);
    if (p.tranche !== "0-2m") {
      drawRow("Oedèmes / Pâleur palmaire :", `${p.oedemes ? "Oui" : "Non"} / ${p.paleurPalmaire === "severe" ? "Sévère" : p.paleurPalmaire === "legere" ? "Légère" : p.palmesPales ? "Oui" : "Non"}`);
      drawRow("Classification nutrition :", p.classificationNutrition || p.statutNutritionnel);
      if (p.classificationAnemie) drawRow("Anémie :", p.classificationAnemie);
    } else {
      drawRow("Statut nutritionnel :", p.statutNutritionnel);
    }

    if (p.tranche === "0-2m" && p.nourrisson) {
      const n = p.nourrisson;
      const oui = (l: [boolean, string][]) => l.filter(([b]) => b).map(([, t]) => t).join(", ") || "Aucun";
      drawSectionTitle("NOURRISSON 0-2 MOIS — INFECTION BACTÉRIENNE");
      drawRow("Signes de gravité :", oui([[n.neSalimentePasBien, "Ne s'alimente pas bien"], [n.convulsions, "Convulsions"], [n.tirageSevere, "Tirage sous-costal marqué"], [n.bougeSeulementStimule, "Ne bouge que stimulé / pas du tout"]]));
      drawRow("Fréquence respiratoire :", p.freqRespiratoire ? `${p.freqRespiratoire} /min` : "—");
      drawRow("Signes locaux :", oui([[n.ombilicRougeOuPus, "Ombilic rouge ou purulent"], [n.pustulesCutanees, "Pustules cutanées"]]));
      drawRow("Classification :", n.classificationInfection || "—");
      drawSectionTitle("ICTÈRE");
      drawRow("Signes :", oui([[n.ictere, "Ictère"], [n.ictereAvant24h, "Apparu avant 24 h de vie"], [n.paumesPlantesJaunes, "Paumes / plantes jaunes"]]));
      drawRow("Classification :", n.classificationIctere || "—");
      drawSectionTitle("ALIMENTATION ET POIDS");
      drawRow("Problèmes :", oui([[n.allaitementDifficile, "Mauvaise prise du sein / succion inefficace"], [n.moinsDe8Tetees, "Moins de 8 tétées / 24 h"], [n.autresAliments, "Reçoit d'autres aliments ou liquides"], [n.muguet, "Muguet"], [n.poidsFaible, "Poids faible pour l'âge"]]));
      drawRow("Classification :", n.classificationAlimentation || "—");
    }

    if (p.dangerNePeutBoireOuTeter || p.dangerVomitTout || p.dangerConvulsions || p.dangerLethargiqueInconscient) {
      drawSectionTitle("⚠ SIGNES GÉNÉRAUX DE DANGER");
      const signes: string[] = [];
      if (p.dangerNePeutBoireOuTeter) signes.push("Ne peut boire/téter");
      if (p.dangerVomitTout) signes.push("Vomit tout");
      if (p.dangerConvulsions) signes.push("Convulsions");
      if (p.dangerLethargiqueInconscient) signes.push("Léthargique/Inconscient");
      drawRow("Signes présents :", signes.join(", "));
    }

    if (p.touxPresent) {
      drawSectionTitle("TOUX / DIFFICULTÉ À RESPIRER");
      drawRow("Durée / Fréq. respiratoire :", `${p.touxDureeJours || "—"} j / ${p.freqRespiratoire || "—"} cpm`);
      drawRow("Tirage sous-costal / Stridor :", `${p.tirageSousCostal ? "Oui" : "Non"} / ${p.stridor ? "Oui" : "Non"}`);
      drawRow("Classification :", p.classificationRespiratoire || "—");
    }

    if (p.diarrheePresent) {
      drawSectionTitle("DIARRHÉE");
      drawRow("Durée / Sang dans selles :", `${p.diarrheeDureeJours || "—"} j / ${p.diarrheeSangSelles ? "Oui" : "Non"}`);
      drawRow("Léthargique / Agité / Yeux enfoncés :", `${(p.diarrheeLethargique ?? p.diarrheeLethargiqueAgite) ? "Oui" : "Non"} / ${p.diarrheeAgiteIrritable ? "Oui" : "Non"} / ${p.diarrheeYeuxEnfonces ? "Oui" : "Non"}`);
      drawRow("Boit avidement / Pli cutané :", `${p.diarrheeBoitAvidement ? "Oui" : "Non"} / ${p.pliCutane === "tres_lent" ? "Très lentement" : p.pliCutane === "lent" ? "Lentement" : p.diarrheePliCutanePersistant ? "Persistant" : "Normal"}`);
      drawRow("Classification :", p.classificationDiarrhee || "—");
    }

    if (p.fievrePresent) {
      drawSectionTitle("FIÈVRE");
      drawRow("Durée / Type suspecté :", `${p.fievreDureeJours || "—"} j / ${[p.fievreTypePalu ? "Palu" : "", p.fievreTypeRougeole ? "Rougeole" : ""].filter(Boolean).join(", ") || "—"}`);
      drawRow("TDR paludisme / Classement :", `${p.tdrPalu || "—"}${p.classementPalu ? ` / ${p.classementPalu === "PG" ? "Paludisme grave (PG)" : "Paludisme simple (PS)"}` : ""}`);
      drawRow("Classification :", p.classificationFievre || "—");
    }

    if (p.oreilleDouleur || p.oreilleEcoulement) {
      drawSectionTitle("PROBLÈME D'OREILLE");
      drawRow("Douleur / Écoulement :", `${p.oreilleDouleur ? "Oui" : "Non"} / ${p.oreilleEcoulement ? "Oui" : "Non"}`);
      drawRow("Durée / Classification :", `${p.oreilleDureeJours || "—"} j / ${p.classificationOreille || "—"}`);
    }

    drawSectionTitle("VACCINATION & COMPLÉMENTS");
    drawRow("PEV à jour / Vitamine A :", `${p.vaccinsAJour ? "Oui" : "Non"} / ${p.vitAAdministree ? "Administrée" : "Non"}`);
    drawRow("Déparasitage / Alimentation :", `${p.deparasitageFait ? "Fait" : "Non"} / ${p.alimentation}`);

    drawSectionTitle("CONCLUSION");
    if (y > 250) { doc.addPage(); y = margin; }
    doc.setFillColor(
      p.classificationGlobale?.includes("Rouge") ? 254 : p.classificationGlobale?.includes("Jaune") ? 255 : 240,
      p.classificationGlobale?.includes("Rouge") ? 226 : p.classificationGlobale?.includes("Jaune") ? 247 : 253,
      p.classificationGlobale?.includes("Rouge") ? 226 : p.classificationGlobale?.includes("Jaune") ? 205 : 250
    );
    doc.rect(margin, y, contentWidth, 8, "F");
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 20);
    doc.text(`CLASSIFICATION GLOBALE : ${p.classificationGlobale || "Non renseignée"}`, margin + 2, y + 5.5);
    y += 12;

    if (p.classifications?.length) drawRow("Classements PCIME :", p.classifications.join("\n"));
    drawRow("Diagnostic :", p.diagnostic);
    drawRow("Conduite à tenir :", p.conduiteATenir || "—");
    if (p.dateControle) drawRow("Visite de suivi :", new Date(p.dateControle + "T00:00:00").toLocaleDateString("fr-FR"));
    y += 8;
    const doctorStaff = staff.find((s) => s.id === p.consultant);
    drawRow("Consultant :", doctorStaff ? doctorStaff.nom : "—");

    doc.save(`fiche_pediatrique_${p.patient.replace(/\s+/g, "_")}_${p.date}.pdf`);
  };

  // Calculations
  const curMonth = getTodayStr().slice(0, 7);
  const pediatrieMonth = pediatrie.filter((p) => p.date.slice(0, 7) === curMonth);
  const totalConsultsMonth = pediatrieMonth.length;

  const severeMalnutritionCases = pediatrie.filter((p) => p.statutNutritionnel === "MAS");
  const moderateMalnutritionCases = pediatrie.filter((p) => p.statutNutritionnel === "MAM");
  const nonVaccinesCount = pediatrie.filter((p) => !p.vaccinsAJour).length;
  const dangerCasesCount = pediatrie.filter(
    (p) => p.dangerNePeutBoireOuTeter || p.dangerVomitTout || p.dangerConvulsions || p.dangerLethargiqueInconscient
  ).length;

  const filteredPedList = pediatrie
    .filter((p) => p.patient.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const cardBase = theme === "dark" ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200";

  const chk = "rounded-lg text-primary-600 focus:ring-primary-500";
  const lblChk = "flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer";

  return (
    <div className="space-y-6">
      {/* Enfants orientés par la caisse, en attente de consultation */}
      {enfantsOrientes.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="text-base font-serif font-bold text-primary-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Enfants envoyés par le secrétariat ({enfantsOrientes.length})
          </h3>
          <div className="space-y-2">
            {enfantsOrientes.map((c) => (
              <div key={c.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border rounded-xl p-3 ${consultationLiee?.id === c.id ? "border-primary-500 ring-1 ring-primary-500" : "border-primary-200"}`}>
                <div>
                  <div className="font-bold text-stone-800">{c.patient}</div>
                  <div className="text-xs text-stone-500">
                    {c.contact || "Sans contact"} · {c.age > 0 ? (c.age < 1 ? `${Math.round(c.age * 12)} mois` : `${c.age} an${c.age >= 2 ? "s" : ""}`) : "âge non saisi"}
                  </div>
                </div>
                {consultationLiee?.id === c.id ? (
                  <span className="text-xs font-bold text-primary-700">En cours de consultation ↓</span>
                ) : (
                  <button type="button" onClick={() => handlePrendreEnCharge(c)} className="px-4 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all">
                    Prendre en charge (préremplir la fiche)
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-primary-600`}>
          <div className="text-3xl font-semibold text-primary-700 font-serif">{totalConsultsMonth}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Consults Pédiatriques</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Mois en cours</div>
        </div>
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-700`}>
          <div className="text-3xl font-semibold text-danger-700 font-serif">{dangerCasesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Signes de Danger</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🚨 Référence urgente</div>
        </div>
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-danger-600`}>
          <div className="text-3xl font-semibold text-danger-700 font-serif">{severeMalnutritionCases.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Malnutrition Sévère (MAS)</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🔴 Tri 1 - Prise en charge CREN</div>
        </div>
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-warning-600`}>
          <div className="text-3xl font-semibold text-warning-700 font-serif">{moderateMalnutritionCases.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Malnutrition Modérée (MAM)</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">🟡 Suivi nutritionnel</div>
        </div>
        <div className={`${cardBase} border rounded-2xl p-5 shadow-xs border-t-4 border-t-purple-600`}>
          <div className="text-3xl font-semibold text-purple-700 font-serif">{nonVaccinesCount}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Vaccins non à jour</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Relances PEV requises</div>
        </div>
      </div>

      {/* Critical nutritional warning alerts */}
      {severeMalnutritionCases.length > 0 && (
        <div className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-xl text-xs font-bold flex items-center gap-3 shadow-2xs">
          <ShieldAlert className="w-5 h-5 text-danger-600 flex-shrink-0" />
          <div>
            <strong>ALERTE CREN :</strong> Il y a actuellement <strong>{severeMalnutritionCases.length} cas de Malnutrition Aiguë Sévère (MAS)</strong> enregistrés. Supplémentation ATPE (Aliments Thérapeutiques Prêts à l'Emploi / Plumpy'Nut) et transfert CREN requis.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PCIME consultation entry form */}
        <div className={`${cardBase} border rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4`}>
          <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100 border-b border-stone-100 dark:border-stone-800 pb-3 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary-700" />
            Nouvelle Consultation Pédiatrique (PCIME)
          </h3>

          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-stone-100">
            {([["0-2m", "Nourrisson 0-2 mois"], ["2m-5a", "Enfant 2 mois-5 ans"]] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setTranche(v)}
                className={`text-xs font-bold py-2 rounded-lg transition-all ${tranche === v ? "bg-white text-primary-700 shadow-xs" : "text-stone-500 hover:text-stone-700"}`}>
                {l}
              </button>
            ))}
          </div>
          {consultationLiee && (
            <div className="text-xs bg-primary-50 border border-primary-200 rounded-lg p-2 flex items-center justify-between gap-2">
              <span>Dossier caisse : <strong>{consultationLiee.patient}</strong>{consultationLiee.codePatient ? ` (${consultationLiee.codePatient})` : ""}</span>
              <button type="button" onClick={() => setConsultationLiee(null)} className="text-stone-400 hover:text-stone-600" title="Détacher"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* 1. Identification */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">1. Identification</h4>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom complet de l'enfant *</label>
              <input
                type="text"
                placeholder="Prénom Nom"
                value={pedPatient}
                onChange={(e) => setPedPatient(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Sexe</label>
                <select
                  value={pedSexe}
                  onChange={(e) => setPedSexe(e.target.value as "Masculin" | "Féminin" | "")}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="Masculin">Masculin</option>
                  <option value="Féminin">Féminin</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date de naissance</label>
                <input
                  type="date"
                  value={pedDateNaissance}
                  onChange={(e) => handleDateNaissanceChange(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                {estNourrisson ? (
                  <>
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Âge (jours) *</label>
                    <input
                      type="number"
                      placeholder="Ex: 21"
                      value={ageJours}
                      onChange={(e) => setAgeJours(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                    />
                  </>
                ) : (
                  <>
                    <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Âge de l'enfant (Mois) *</label>
                    <input
                      type="number"
                      placeholder="Ex: 18"
                      value={pedAgeMois}
                      onChange={(e) => setPedAgeMois(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                    />
                    {!!pedAgeMois && parseFloat(pedAgeMois) < 2 && (
                      <button type="button" onClick={() => setTranche("0-2m")} className="text-2xs text-primary-700 underline mt-0.5">Moins de 2 mois : fiche nourrisson</button>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Téléphone Parent</label>
                <input
                  type="tel"
                  placeholder="+226..."
                  value={pedContact}
                  onChange={(e) => setPedContact(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Température (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 38.5"
                  value={pedTemperature}
                  onChange={(e) => setPedTemperature(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Motif de consultation</label>
                <input
                  type="text"
                  placeholder="Ex: Toux + fièvre"
                  value={pedMotif}
                  onChange={(e) => setPedMotif(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>

          {estNourrisson && (
            <>
              {/* N1. Infection bactérienne grave possible */}
              <div className={`space-y-2 p-3 rounded-xl border ${resNour.infection?.couleur === "rouge" ? "bg-danger-50 border-danger-300" : "bg-stone-50 border-stone-100"}`}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-danger-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> 2. Maladie grave / infection bactérienne
                </h4>
                <label className={lblChk}><input type="checkbox" checked={nour.neSalimentePasBien} onChange={(e) => setN("neSalimentePasBien", e.target.checked)} className={chk} />Ne s'alimente pas bien (ne tète pas)</label>
                <label className={lblChk}><input type="checkbox" checked={nour.convulsions} onChange={(e) => setN("convulsions", e.target.checked)} className={chk} />Convulsions</label>
                <label className={lblChk}><input type="checkbox" checked={nour.tirageSevere} onChange={(e) => setN("tirageSevere", e.target.checked)} className={chk} />Tirage sous-costal marqué</label>
                <label className={lblChk}><input type="checkbox" checked={nour.bougeSeulementStimule} onChange={(e) => setN("bougeSeulementStimule", e.target.checked)} className={chk} />Ne bouge que si on le stimule, ou ne bouge pas</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Fréq. respiratoire (/min)</label>
                    <input type="number" value={freqRespiratoire} onChange={(e) => setFreqRespiratoire(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                  <div className="text-2xs text-stone-500 self-end pb-1">Rapide si ≥ 60/min · fièvre ≥ 37,5 °C ou &lt; 35,5 °C = gravité</div>
                </div>
                <label className={lblChk}><input type="checkbox" checked={nour.ombilicRougeOuPus} onChange={(e) => setN("ombilicRougeOuPus", e.target.checked)} className={chk} />Ombilic rouge ou qui suinte du pus</label>
                <label className={lblChk}><input type="checkbox" checked={nour.pustulesCutanees} onChange={(e) => setN("pustulesCutanees", e.target.checked)} className={chk} />Pustules cutanées</label>
                <ChoixClassement auto={resNour.infection ? [resNour.infection] : []} valeur="" onChange={() => {}} />
              </div>

              {/* N2. Ictère */}
              <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">3. Ictère (jaunisse)</h4>
                <label className={lblChk}><input type="checkbox" checked={nour.ictere} onChange={(e) => setN("ictere", e.target.checked)} className={chk} />Ictère (peau ou yeux jaunes)</label>
                {(nour.ictere || nour.paumesPlantesJaunes) && (
                  <>
                    <label className={lblChk}><input type="checkbox" checked={nour.ictereAvant24h} onChange={(e) => setN("ictereAvant24h", e.target.checked)} className={chk} />Apparu dans les 24 premières heures de vie</label>
                    <label className={lblChk}><input type="checkbox" checked={nour.paumesPlantesJaunes} onChange={(e) => setN("paumesPlantesJaunes", e.target.checked)} className={chk} />Paumes des mains ou plantes des pieds jaunes</label>
                  </>
                )}
                <ChoixClassement auto={resNour.ictere ? [resNour.ictere] : []} valeur="" onChange={() => {}} />
              </div>

              {/* N3. Diarrhée */}
              <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 cursor-pointer">
                  <input type="checkbox" checked={diarrheePresent} onChange={(e) => setDiarrheePresent(e.target.checked)} className={chk} />
                  4. Diarrhée
                </label>
                {diarrheePresent && (
                  <div className="space-y-2 pl-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée (jours)</label>
                        <input type="number" value={diarrheeDureeJours} onChange={(e) => setDiarrheeDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                      </div>
                      <label className={`${lblChk} self-end pb-1.5`}><input type="checkbox" checked={diarrheeSangSelles} onChange={(e) => setDiarrheeSangSelles(e.target.checked)} className={chk} />Sang dans les selles</label>
                    </div>
                    <label className={lblChk}><input type="checkbox" checked={diarrheeAgite} onChange={(e) => setDiarrheeAgite(e.target.checked)} className={chk} />Agité, irritable</label>
                    <label className={lblChk}><input type="checkbox" checked={diarrheeYeuxEnfonces} onChange={(e) => setDiarrheeYeuxEnfonces(e.target.checked)} className={chk} />Yeux enfoncés</label>
                    <div>
                      <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Pli cutané</label>
                      <select value={pliCutane} onChange={(e) => setPliCutane(e.target.value as PliCutane)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                        <option value="normal">S'efface immédiatement</option>
                        <option value="lent">S'efface lentement</option>
                        <option value="tres_lent">S'efface très lentement (&gt; 2 s)</option>
                      </select>
                    </div>
                    <p className="text-2xs text-stone-500">« Ne bouge que stimulé » (rubrique 2) compte aussi pour la déshydratation sévère.</p>
                    <ChoixClassement auto={resNour.diarrhee} valeur="" onChange={() => {}} />
                  </div>
                )}
              </div>

              {/* N4. Alimentation */}
              <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">5. Alimentation et poids</h4>
                <label className={lblChk}><input type="checkbox" checked={nour.allaitementDifficile} onChange={(e) => setN("allaitementDifficile", e.target.checked)} className={chk} />Mauvaise prise du sein ou succion inefficace</label>
                <label className={lblChk}><input type="checkbox" checked={nour.moinsDe8Tetees} onChange={(e) => setN("moinsDe8Tetees", e.target.checked)} className={chk} />Moins de 8 tétées par 24 heures</label>
                <label className={lblChk}><input type="checkbox" checked={nour.autresAliments} onChange={(e) => setN("autresAliments", e.target.checked)} className={chk} />Reçoit d'autres aliments ou liquides</label>
                <label className={lblChk}><input type="checkbox" checked={nour.muguet} onChange={(e) => setN("muguet", e.target.checked)} className={chk} />Muguet (plaques blanches dans la bouche)</label>
                <label className={lblChk}><input type="checkbox" checked={nour.poidsFaible} onChange={(e) => setN("poidsFaible", e.target.checked)} className={chk} />Poids faible pour l'âge (courbe)</label>
                <ChoixClassement auto={resNour.alimentation ? [resNour.alimentation] : []} valeur="" onChange={() => {}} />
              </div>
            </>
          )}

          {!estNourrisson && (
            <>
          {/* 2. Signes Généraux de Danger */}
          <div className={`space-y-2 p-3 rounded-xl border ${auMoinsUnSigneDanger ? "bg-danger-50 border-danger-300" : "bg-stone-50 border-stone-100"}`}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-danger-800 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> 2. Signes Généraux de Danger
            </h4>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={dangerNePeutBoire} onChange={(e) => setDangerNePeutBoire(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
              Ne peut pas boire ou téter
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={dangerVomitTout} onChange={(e) => setDangerVomitTout(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
              Vomit tout ce qu'il consomme
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={dangerConvulsions} onChange={(e) => setDangerConvulsions(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
              Convulsions (actuelles ou récentes)
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={dangerLethargique} onChange={(e) => setDangerLethargique(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
              Léthargique ou inconscient
            </label>
            {auMoinsUnSigneDanger && (
              <p className="text-xs font-bold text-danger-700 pt-1">🚨 Au moins un signe de danger présent : référence urgente recommandée.</p>
            )}
          </div>

          {/* 3. Toux / difficulté respiratoire */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 cursor-pointer">
              <input type="checkbox" checked={touxPresent} onChange={(e) => setTouxPresent(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
              3. Toux ou difficulté à respirer
            </label>
            {touxPresent && (
              <div className="space-y-2 pl-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée (jours)</label>
                    <input type="number" value={touxDureeJours} onChange={(e) => setTouxDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Fréq. respiratoire (cpm)</label>
                    <input type="number" value={freqRespiratoire} onChange={(e) => setFreqRespiratoire(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={tirageSousCostal} onChange={(e) => setTirageSousCostal(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Tirage sous-costal
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={stridor} onChange={(e) => setStridor(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Stridor chez un enfant calme
                </label>
                <ChoixClassement auto={resEnfant.respiratoire ? [resEnfant.respiratoire] : []} valeur={classifRespiratoire} onChange={setClassifRespiratoire}
                  options={["Rouge — Pneumonie grave ou maladie très grave", "Jaune — Pneumonie", "Vert — Pas de pneumonie : toux ou rhume"]} />
              </div>
            )}
          </div>

          {/* 4. Diarrhée */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 cursor-pointer">
              <input type="checkbox" checked={diarrheePresent} onChange={(e) => setDiarrheePresent(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
              4. Diarrhée
            </label>
            {diarrheePresent && (
              <div className="space-y-2 pl-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée (jours)</label>
                    <input type="number" value={diarrheeDureeJours} onChange={(e) => setDiarrheeDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer self-end pb-1.5">
                    <input type="checkbox" checked={diarrheeSangSelles} onChange={(e) => setDiarrheeSangSelles(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                    Sang dans les selles
                  </label>
                </div>
                <label className={lblChk}><input type="checkbox" checked={diarrheeLethargique} onChange={(e) => setDiarrheeLethargique(e.target.checked)} className={chk} />Léthargique ou inconscient</label>
                <label className={lblChk}><input type="checkbox" checked={diarrheeAgite} onChange={(e) => setDiarrheeAgite(e.target.checked)} className={chk} />Agité(e), irritable</label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={diarrheeYeuxEnfonces} onChange={(e) => setDiarrheeYeuxEnfonces(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Yeux enfoncés
                </label>
                <label className={lblChk}><input type="checkbox" checked={diarrheeBoitDifficilement} onChange={(e) => setDiarrheeBoitDifficilement(e.target.checked)} className={chk} />Incapable de boire ou boit difficilement</label>
                <label className={lblChk}><input type="checkbox" checked={diarrheeBoitAvidement} onChange={(e) => setDiarrheeBoitAvidement(e.target.checked)} className={chk} />Boit avidement, assoiffé</label>
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Pli cutané</label>
                  <select value={pliCutane} onChange={(e) => setPliCutane(e.target.value as PliCutane)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                    <option value="normal">S'efface immédiatement</option>
                    <option value="lent">S'efface lentement</option>
                    <option value="tres_lent">S'efface très lentement (&gt; 2 s)</option>
                  </select>
                </div>
                <ChoixClassement auto={resEnfant.diarrhee} valeur={classifDiarrhee} onChange={setClassifDiarrhee}
                  options={["Rouge — Déshydratation sévère (Plan C)", "Jaune — Signes évidents de déshydratation (Plan B)", "Vert — Pas de déshydratation (Plan A)"]} />
              </div>
            )}
          </div>

          {/* 5. Fièvre */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 cursor-pointer">
              <input type="checkbox" checked={fievrePresent} onChange={(e) => setFievrePresent(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
              5. Fièvre
            </label>
            {fievrePresent && (
              <div className="space-y-2 pl-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée (jours)</label>
                    <input type="number" value={fievreDureeJours} onChange={(e) => setFievreDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                  </div>
                  <div className="flex flex-col justify-end gap-1">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                      <input type="checkbox" checked={fievreTypePalu} onChange={(e) => setFievreTypePalu(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                      Suspicion Paludisme
                    </label>
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input type="checkbox" checked={fievreTypeRougeole} onChange={(e) => setFievreTypeRougeole(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                  Éruption cutanée généralisée (suspicion Rougeole)
                </label>
                <label className={lblChk}><input type="checkbox" checked={raideurNuque} onChange={(e) => setRaideurNuque(e.target.checked)} className={chk} />Raideur de la nuque</label>
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">TDR paludisme</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["Positif", "Négatif", "Non fait"] as const).map((r) => (
                      <button key={r} type="button" onClick={() => setTdrPalu(r)}
                        className={`text-xs font-bold py-1.5 rounded-lg border ${tdrPalu === r ? (r === "Positif" ? "bg-danger-600 border-danger-600 text-white" : r === "Négatif" ? "bg-success-600 border-success-600 text-white" : "bg-stone-600 border-stone-600 text-white") : "bg-white border-stone-200 text-stone-600"}`}>
                        {r}
                      </button>
                    ))}
                  </div>
                  {tdrPalu === "Positif" && (
                    <p className="text-2xs font-semibold text-stone-600 mt-1">
                      Compté au TLOH comme {(couleurDeTexte(classifFievre) === "rouge" || (!classifFievre && resEnfant.classementPalu === "PG")) ? "paludisme grave (PG)" : "paludisme simple (PS)"}.
                    </p>
                  )}
                </div>
                <ChoixClassement auto={resEnfant.fievre} valeur={classifFievre} onChange={setClassifFievre}
                  options={["Rouge — Maladie fébrile très grave / paludisme grave", "Jaune — Paludisme simple (TDR positif)", "Vert — Fièvre : pas de paludisme (TDR négatif)"]} />
              </div>
            )}
          </div>

          {/* 6. Problème d'oreille */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">6. Problème d'oreille</h4>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                <input type="checkbox" checked={oreilleDouleur} onChange={(e) => setOreilleDouleur(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Douleur auriculaire
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                <input type="checkbox" checked={oreilleEcoulement} onChange={(e) => setOreilleEcoulement(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Écoulement auriculaire
              </label>
            </div>
            <label className={lblChk}><input type="checkbox" checked={gonflementRetro} onChange={(e) => setGonflementRetro(e.target.checked)} className={chk} />Gonflement douloureux derrière l'oreille</label>
            {(oreilleDouleur || oreilleEcoulement || gonflementRetro) && (
              <div className="space-y-2 pl-1">
                <div>
                  <label className="text-2xs uppercase font-semibold text-stone-500 block mb-0.5">Durée de l'écoulement (jours)</label>
                  <input type="number" value={oreilleDureeJours} onChange={(e) => setOreilleDureeJours(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none" />
                </div>
                <ChoixClassement auto={resEnfant.oreille ? [resEnfant.oreille] : []} valeur={classifOreille} onChange={setClassifOreille}
                  options={["Rouge — Mastoïdite", "Jaune — Infection aiguë de l'oreille", "Jaune — Infection chronique de l'oreille", "Vert — Pas d'infection de l'oreille"]} />
              </div>
            )}
          </div>

            </>
          )}

          {/* 7. Mesures anthropométriques & nutrition */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">{estNourrisson ? 6 : 7}. Croissance & État Nutritionnel</h4>
            <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-xl border border-stone-100">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Poids (kg) *</label>
                <input type="number" step="0.1" placeholder="Ex: 9.5" value={pedPoids} onChange={(e) => setPedPoids(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white focus:outline-none font-bold" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Taille (cm)</label>
                <input type="number" step="0.1" placeholder="Ex: 80" value={pedTaille} onChange={(e) => setPedTaille(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white focus:outline-none font-bold" />
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">P. Cranien (cm)</label>
                <input type="number" step="0.1" placeholder="Ex: 46" value={pedPc} onChange={(e) => setPedPc(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg p-1 bg-white focus:outline-none font-bold" />
              </div>
            </div>

            {!estNourrisson && (
            <div className="grid grid-cols-2 gap-3 bg-danger-50/50 p-3 rounded-xl border border-danger-100">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-danger-900 block mb-1">MUAC (PB) (cm) *</label>
                <input type="number" step="0.1" placeholder="Périmètre brachial" value={pedPb} onChange={(e) => setPedPb(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none font-bold text-danger-800" />
              </div>
              <div className="flex flex-col justify-end gap-1">
                <label className="flex items-center gap-1.5 text-xs font-bold text-danger-900 cursor-pointer">
                  <input type="checkbox" checked={pedOedemes} onChange={(e) => setPedOedemes(e.target.checked)} className="rounded-lg text-danger-600 focus:ring-danger-500" />
                  Oedèmes (+ bilateral)
                </label>
                <label className="text-2xs uppercase font-bold text-danger-900">Pâleur palmaire</label>
                <select value={paleur} onChange={(e) => setPaleur(e.target.value as Paleur)} className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white focus:outline-none">
                  <option value="aucune">Pas de pâleur</option>
                  <option value="legere">Pâleur légère</option>
                  <option value="severe">Pâleur sévère</option>
                </select>
              </div>
              <div className="col-span-2 pt-1">
                <span className="text-2xs uppercase font-bold tracking-wider text-stone-500 dark:text-stone-400 block mb-1">Indice nutritionnel automatique</span>
                <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border text-center block ${getNutritionStatus(parseFloat(pedPb) || 0, pedOedemes).color}`}>
                  {getNutritionStatus(parseFloat(pedPb) || 0, pedOedemes).label}
                </span>
              </div>
              <div className="col-span-2">
                <ChoixClassement auto={[resEnfant.nutrition, resEnfant.anemie].filter((x): x is Classement => !!x)} valeur={classifNutrition} onChange={setClassifNutrition}
                  options={["Rouge — Malnutrition aiguë sévère compliquée (CREN interne)", "Jaune — Malnutrition aiguë sévère sans complication (CRENAS)", "Jaune — Malnutrition aiguë modérée", "Vert — Pas de malnutrition aiguë"]} />
              </div>
            </div>
            )}
          </div>

          {/* 8. Vaccination, vitamine A, alimentation */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">{estNourrisson ? 7 : 8}. Vaccination & Alimentation</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Alimentation enfant</label>
                <select value={pedAlimentation} onChange={(e) => setPedAlimentation(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-2.5 py-2 bg-stone-50 focus:bg-white focus:outline-none font-medium">
                  <option value="Allaitement maternel exclusif">🤱 Allaitement maternel exclusif</option>
                  <option value="Allaitement diversifié">👶 Allaitement + Diversifié</option>
                  <option value="Alimentation familiale">🍲 Alimentation familiale</option>
                  <option value="Lait artificiel">🍼 Lait artificiel premier âge</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Pédiatre / Consultant</label>
                <select value={pedConsultant} onChange={(e) => setPedConsultant(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4 py-1">
              <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={pedVaccinsAJour} onChange={(e) => setPedVaccinsAJour(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Vaccinations à jour (PEV)
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
                <input type="checkbox" checked={vitAAdministree} onChange={(e) => setVitAAdministree(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
                Vitamine A donnée
              </label>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-bold text-stone-700 cursor-pointer">
              <input type="checkbox" checked={deparasitageFait} onChange={(e) => setDeparasitageFait(e.target.checked)} className="rounded-lg text-primary-600 focus:ring-primary-500" />
              Déparasitage effectué
            </label>
          </div>

          {/* 9. Conclusion */}
          <div className="space-y-2 border-t border-stone-100 pt-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700">{estNourrisson ? 8 : 9}. Conclusion</h4>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Classification globale</label>
              {globalAuto && (
                <div className={`mb-2 rounded-lg border p-2 ${COULEUR_BADGE[globalAuto.couleur]} ${classificationGlobale ? "opacity-60" : ""}`}>
                  <div className="text-xs font-bold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Suggestion PCIME : {EMOJI[globalAuto.couleur]} {LIBELLE_GLOBAL[globalAuto.couleur]}</div>
                  <ul className="mt-1 text-2xs font-semibold space-y-0.5">
                    {classementsRetenus.filter((c) => c.couleur !== "vert" || classementsRetenus.every((x) => x.couleur === "vert")).map((c, k) => (
                      <li key={k}>{EMOJI[c.couleur]} {c.rubrique} : {c.libelle}</li>
                    ))}
                  </ul>
                </div>
              )}
              {alertesPcime.length > 0 && (
                <ul className="mb-2 text-2xs font-semibold text-warning-800 bg-warning-50 border border-warning-200 rounded-lg p-2 space-y-0.5">
                  {alertesPcime.map((a, k) => <li key={k}>⚠ {a}</li>)}
                </ul>
              )}
              <select value={classificationGlobale} onChange={(e) => setClassificationGlobale(e.target.value)} className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold">
                <option value="">{globalAuto ? "✓ Garder la suggestion automatique" : "— Choisir —"}</option>
                <option value="Rouge (Référence urgente)">🔴 Rouge — Référence urgente</option>
                <option value="Jaune (Traitement ambulatoire)">🟡 Jaune — Traitement ambulatoire</option>
                <option value="Vert (Traitement à domicile)">🟢 Vert — Traitement / conseils à domicile</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Diagnostic clinique</label>
              <textarea
                placeholder="Ex: Rhinopharyngite aiguë avec poussée fébrile."
                value={pedDiagnostic}
                onChange={(e) => setPedDiagnostic(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-14 resize-none"
              />
            </div>
            <div>
              <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Conduite à tenir / Traitement prescrit</label>
              <textarea
                placeholder="Ex: Paracétamol sirop, ACT selon poids, conseils à la mère..."
                value={pedConduiteATenir}
                onChange={(e) => setPedConduiteATenir(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none h-16 resize-none"
              />
            </div>
            <p className="text-2xs text-stone-500 italic">
              La classification automatique suit les tableaux PCIME : c'est une aide, le soignant décide. Les doses restent celles du guide national.
            </p>
          </div>

          {/* 10. Visite de suivi */}
          <div className="space-y-2 p-3 rounded-xl border border-stone-100 bg-stone-50">
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary-700 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> {estNourrisson ? 9 : 10}. Visite de suivi</h4>
            {(couleurDeTexte(classificationGlobale) || globalAuto?.couleur) === "rouge" ? (
              <p className="text-xs text-danger-700 font-semibold">Enfant à référer en urgence : pas de rendez-vous de suivi au centre.</p>
            ) : (
              <>
                <label className={lblChk}>
                  <input type="checkbox" checked={programmerSuivi} onChange={(e) => setProgrammerSuivi(e.target.checked)} className={chk} disabled={!onUpdateRdvs} />
                  Programmer un rendez-vous de suivi
                </label>
                {programmerSuivi && (
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <input type="date" value={dateControleEffective} min={getTodayStr()} onChange={(e) => setDateControle(e.target.value)}
                      className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                    <span className="text-2xs text-stone-500">
                      {delaiSuivi ? `Suivi PCIME conseillé à J+${delaiSuivi}${dateControle && dateControle !== dateControleProposee ? " (date modifiée)" : ""}` : "Aucun suivi requis par la PCIME — choisissez une date si besoin."}
                    </span>
                  </div>
                )}
                {programmerSuivi && !dateControleEffective && <p className="text-2xs text-stone-500">Sans date, aucun rendez-vous ne sera créé.</p>}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddPediatrie}
            className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2"
          >
            Enregistrer l'examen de l'enfant
          </button>
        </div>

        {/* Pediatric consult ledger list */}
        <div className={`${cardBase} border rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4`}>
          <div className="border-b border-stone-100 dark:border-stone-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary-700" />
              Registre de Surveillance Pédiatrique & CREN
            </h3>

            <div className="relative w-full md:w-48">
              <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher enfant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {filteredPedList.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun examen pédiatrique trouvé.</p>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto pr-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs">
                    <th className="p-3">Date</th>
                    <th className="p-3">Enfant / Parent</th>
                    <th className="p-3 text-center">Sexe / Âge</th>
                    <th className="p-3 text-center">Poids / Taille</th>
                    <th className="p-3 text-center">MUAC (PB)</th>
                    <th className="p-3 text-center">État Nutritionnel</th>
                    <th className="p-3 text-center">Classification</th>
                    <th className="p-3 text-center">PEV</th>
                    <th className="p-3">Diagnostic</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredPedList.map((p) => {
                    const doc = staff.find((s) => s.id === p.consultant);
                    const nutObj = getNutritionStatus(p.pb, p.oedemes);
                    const hasDanger = p.dangerNePeutBoireOuTeter || p.dangerVomitTout || p.dangerConvulsions || p.dangerLethargiqueInconscient;

                    return (
                      <tr key={p.id} className={`hover:bg-stone-50/50 ${hasDanger ? "bg-danger-50/40" : ""}`}>
                        <td className="p-3 font-mono text-stone-500 dark:text-stone-400">{new Date(p.date).toLocaleDateString("fr-FR")}</td>
                        <td className="p-3 font-bold text-stone-800">
                          <div className="flex items-center gap-1">
                            {hasDanger && <span title="Signe de danger présent">🚨</span>}
                            {p.patient}
                          </div>
                          {p.contact && <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold mt-0.5">📞 {p.contact}</div>}
                        </td>
                        <td className="p-3 text-center font-bold text-stone-700">
                          <div>{p.sexe === "Masculin" ? "M" : p.sexe === "Féminin" ? "F" : "—"}</div>
                          <div className="font-mono text-stone-500 dark:text-stone-400">{p.tranche === "0-2m" && p.ageJours !== undefined ? `${p.ageJours} j` : `${p.ageMois} mois`}</div>
                          {p.tranche === "0-2m" && <div className="text-2xs font-bold text-primary-700">Nourrisson</div>}
                        </td>
                        <td className="p-3 text-center">
                          <div className="font-bold text-stone-900 font-mono">{p.poids} kg</div>
                          <div className="text-xs text-stone-500 dark:text-stone-400 font-mono">{p.taille || "—"} cm</div>
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-danger-700">{p.pb ? `${p.pb} cm` : "—"}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold inline-block border ${nutObj.color}`}>
                            {p.statutNutritionnel}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {p.classificationGlobale ? (
                            <span
                              className={`px-2 py-0.5 rounded-lg text-xs font-semibold inline-block border ${
                                p.classificationGlobale.includes("Rouge")
                                  ? "bg-danger-100 text-danger-800 border-danger-200"
                                  : p.classificationGlobale.includes("Jaune")
                                  ? "bg-warning-100 text-warning-800 border-warning-200"
                                  : "bg-success-100 text-success-800 border-success-200"
                              }`}
                            >
                              {p.classificationGlobale.split(" ")[0]}
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {p.vaccinsAJour ? (
                            <span className="text-success-700 font-semibold text-sm">🟢 Oui</span>
                          ) : (
                            <span className="text-danger-600 font-semibold text-sm animate-pulse">🔴 Non</span>
                          )}
                        </td>
                        <td className="p-3 text-stone-600 font-medium max-w-[150px] truncate" title={p.diagnostic}>
                          <div>{p.diagnostic || "—"}</div>
                          {p.tdrPalu && p.tdrPalu !== "Non fait" && (
                            <div className={`text-2xs font-bold ${p.tdrPalu === "Positif" ? "text-danger-700" : "text-success-700"}`}>TDR {p.tdrPalu}{p.classementPalu ? ` · ${p.classementPalu}` : ""}</div>
                          )}
                          {p.dateControle && <div className="text-2xs font-semibold text-primary-700">Suivi le {new Date(p.dateControle + "T00:00:00").toLocaleDateString("fr-FR")}</div>}
                          <div className="text-2xs text-stone-500 dark:text-stone-400 font-semibold uppercase mt-0.5">By: {doc ? doc.nom : "Pédiatrie"}</div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => setSelectedFiche(p)} className="text-primary-600 hover:text-primary-800 transition-all" title="Voir la fiche complète">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDownloadPDF(p)} className="text-success-600 hover:text-success-800 transition-all" title="Télécharger le PDF">
                              <Download className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDeletePed(p.id)} className="text-stone-300 hover:text-danger-600 transition-all" title="Supprimer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selectedFiche && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className={`w-full max-w-2xl rounded-2xl shadow-xl border overflow-hidden max-h-[90vh] flex flex-col ${theme === "dark" ? "bg-stone-900 border-stone-800 text-stone-100" : "bg-white border-stone-200 text-stone-800"}`}>
            <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex justify-between items-center">
              <h3 className="font-serif font-bold text-base">Fiche PCIME — {selectedFiche.patient}</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleDownloadPDF(selectedFiche)} className="bg-success-600 hover:bg-success-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5">
                  <Download className="w-4 h-4" /> PDF
                </button>
                <button type="button" onClick={() => setSelectedFiche(null)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-all">
                  <X className="w-5 h-5 text-stone-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Sexe :</span> {selectedFiche.sexe || "—"}</div>
                <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Âge :</span> {selectedFiche.tranche === "0-2m" && selectedFiche.ageJours !== undefined ? `${selectedFiche.ageJours} jours (nourrisson)` : `${selectedFiche.ageMois} mois`}</div>
                <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Température :</span> {selectedFiche.temperature ? `${selectedFiche.temperature} °C` : "—"}</div>
                <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Motif :</span> {selectedFiche.motif || "—"}</div>
              </div>

              {(selectedFiche.dangerNePeutBoireOuTeter || selectedFiche.dangerVomitTout || selectedFiche.dangerConvulsions || selectedFiche.dangerLethargiqueInconscient) && (
                <div className="bg-danger-50 border border-danger-200 rounded-xl p-3">
                  <span className="font-bold text-danger-800">🚨 Signes de danger : </span>
                  {[
                    selectedFiche.dangerNePeutBoireOuTeter && "Ne peut boire/téter",
                    selectedFiche.dangerVomitTout && "Vomit tout",
                    selectedFiche.dangerConvulsions && "Convulsions",
                    selectedFiche.dangerLethargiqueInconscient && "Léthargique/Inconscient"
                  ].filter(Boolean).join(", ")}
                </div>
              )}

              {!!selectedFiche.classifications?.length && (
                <div className="space-y-1">
                  <span className="text-stone-500 dark:text-stone-400 font-semibold block">Classements PCIME :</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFiche.classifications.map((t, k) => (
                      <span key={k} className={`px-2 py-0.5 rounded-lg border font-semibold ${COULEUR_BADGE[couleurDeTexte(t) || "vert"]}`}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {(selectedFiche.tdrPalu || selectedFiche.dateControle) && (
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-stone-500 dark:text-stone-400 font-semibold">TDR paludisme :</span> {selectedFiche.tdrPalu || "—"}{selectedFiche.classementPalu ? ` (${selectedFiche.classementPalu})` : ""}</div>
                  <div><span className="text-stone-500 dark:text-stone-400 font-semibold">Visite de suivi :</span> {selectedFiche.dateControle ? new Date(selectedFiche.dateControle + "T00:00:00").toLocaleDateString("fr-FR") : "—"}</div>
                </div>
              )}

              {selectedFiche.classificationGlobale && (
                <div className="bg-primary-50 border border-primary-100 rounded-xl p-3">
                  <span className="font-bold text-primary-800">Classification globale : </span>{selectedFiche.classificationGlobale}
                  {selectedFiche.classificationModifiee && <span className="text-2xs text-stone-500"> (modifiée par le soignant)</span>}
                </div>
              )}

              <div>
                <span className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">Diagnostic :</span>
                <p className="bg-stone-50 dark:bg-stone-800 p-2 rounded-lg">{selectedFiche.diagnostic || "—"}</p>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">Conduite à tenir :</span>
                <p className="bg-stone-50 dark:bg-stone-800 p-2 rounded-lg">{selectedFiche.conduiteATenir || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
