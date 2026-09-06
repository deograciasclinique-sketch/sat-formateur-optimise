/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Consultation, Staff, LigneOrdonnance, Hospitalisation, PatientUrgence, Medicament, MouvementStock } from "../types";
import { generateUid } from "../data";
import { Activity, ArrowRight, Stethoscope, Syringe, CheckCircle2, ClipboardCheck, Plus, Trash2, Send } from "lucide-react";

interface TabInfirmierProps {
  consultations: Consultation[];
  onUpdateConsultations: (consults: Consultation[]) => void;
  theme?: "light" | "dark";
  // Liste du personnel (même source que l'onglet RH), pour choisir le
  // prestataire qui prend en charge le patient.
  staff?: Staff[];
  // Optionnels : permettent à l'infirmier(ère) ou à la sage-femme de créer
  // automatiquement le dossier correspondant lorsqu'il/elle conclut
  // lui-même/elle-même une consultation avec décision d'hospitalisation ou
  // d'admission aux urgences (même logique qu'en Consultation Générale).
  hospitalisations?: Hospitalisation[];
  onUpdateHospitalisations?: (h: Hospitalisation[]) => void;
  urgences?: PatientUrgence[];
  onUpdateUrgences?: (u: PatientUrgence[]) => void;
  // Optionnels : permettent de rattacher une ligne d'ordonnance à un article
  // de la pharmacie et de déduire automatiquement le stock, exactement comme
  // en Consultation Générale.
  medicaments?: Medicament[];
  onUpdateMedicaments?: (meds: Medicament[]) => void;
  mouvements?: MouvementStock[];
  onUpdateMouvements?: (movs: MouvementStock[]) => void;
}

type ModeCloture = "transfert" | "moimeme";
type DecisionFinale = "Retour à domicile" | "Référer vers un autre service" | "Hospitalisation" | "Mise en observation" | "Admission aux urgences";

const ZONES_RESIDENCE = ["0-4 km", "5-9 km", "10 km et plus"];
const MODES_ENTREE = ["Auto orienté", "Référé", "Evacué", "Transféré (CMA)"];

// Écran infirmier : liste des patients dont la consultation a été payée au
// secrétariat et qui attendent la prise des constantes / complément d'état
// civil. Une fois enregistré, le dossier passe au médecin.
export default function TabInfirmier({
  consultations,
  onUpdateConsultations,
  theme = "light",
  staff = [],
  hospitalisations = [],
  onUpdateHospitalisations,
  urgences = [],
  onUpdateUrgences,
  medicaments = [],
  onUpdateMedicaments,
  mouvements = [],
  onUpdateMouvements,
}: TabInfirmierProps) {
  const isDark = theme === "dark";
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Choix fait par l'infirmier(ère)/sage-femme : conclure elle/lui-même la
  // consultation (diagnostic + prescription) ou la transférer (au médecin,
  // en Consultation Générale, ou vers un autre service).
  const [modeCloture, setModeCloture] = useState<ModeCloture>("transfert");
  const [examenPhysique, setExamenPhysique] = useState("");
  const [diagnostic, setDiagnostic] = useState("");
  const [diagnosticFinal, setDiagnosticFinal] = useState("");
  const [decision, setDecision] = useState<DecisionFinale>("Retour à domicile");
  const [referenceService, setReferenceService] = useState("");
  const [ordonnance, setOrdonnance] = useState<LigneOrdonnance[]>([]);
  const [ligneMedNom, setLigneMedNom] = useState("");
  const [ligneMedPosologie, setLigneMedPosologie] = useState("");
  const [ligneMedDuree, setLigneMedDuree] = useState("");
  const [destinationTransfert, setDestinationTransfert] = useState<"medecin" | "autre">("medecin");
  const [autreServiceTexte, setAutreServiceTexte] = useState("");
  // Recherche d'un article de la pharmacie pour rattacher la ligne
  // d'ordonnance et permettre la déduction automatique du stock.
  const [ligneMedId, setLigneMedId] = useState<string | undefined>(undefined);
  const [ligneMedQte, setLigneMedQte] = useState("1");
  const [pharmacieSearchOpen, setPharmacieSearchOpen] = useState(false);

  const pharmacieSearchResults = useMemo(() => {
    const q = ligneMedNom.trim().toLowerCase();
    if (!q || ligneMedId) return [];
    return medicaments
      .filter((m) => m.stock > 0 && m.nom.toLowerCase().includes(q))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"))
      .slice(0, 15);
  }, [medicaments, ligneMedNom, ligneMedId]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(todayIso);
  const [profession, setProfession] = useState("");
  const [commune, setCommune] = useState("");
  const [villageSecteur, setVillageSecteur] = useState("");
  const [zoneResidence, setZoneResidence] = useState("");
  const [modeEntree, setModeEntree] = useState("");
  const [ancienConsultant, setAncienConsultant] = useState(false);
  const [praticienId, setPraticienId] = useState("");
  const [filtrePraticien, setFiltrePraticien] = useState("");
  const [telephonePraticien, setTelephonePraticien] = useState("");
  const [temperature, setTemperature] = useState("");
  const [poids, setPoids] = useState("");
  const [taille, setTaille] = useState("");
  const [ta, setTa] = useState("");
  const [pouls, setPouls] = useState("");
  const [glycemie, setGlycemie] = useState("");
  const [plainte, setPlainte] = useState("");

  const praticiensFiltres = useMemo(() => {
    if (!filtrePraticien.trim()) return staff;
    const q = filtrePraticien.trim().toLowerCase();
    return staff.filter((s) => (s.nom || "").toLowerCase().includes(q));
  }, [staff, filtrePraticien]);

  const enAttente = useMemo(
    () => consultations.filter((c) => c.statut === "Attente prise en charge infirmier"),
    [consultations]
  );

  // Dossiers dont les actes prescrits ont été payés au secrétariat : les
  // soins à faire dans la salle infirmier (hors examens labo, gérés dans
  // l'onglet Laboratoire) sont exécutés ici.
  const actesAExecuter = useMemo(
    () => consultations.filter((c) => c.statut === "Attente exécution actes"),
    [consultations]
  );

  const handleMarquerSoinsExecutes = (c: Consultation) => {
    onUpdateConsultations(
      consultations.map((cons) => (cons.id === c.id ? { ...cons, statut: "Terminée" } : cons))
    );
  };

  const selected = consultations.find((c) => c.id === selectedId) || null;

  const openPatient = (c: Consultation) => {
    setSelectedId(c.id);
    setDate(c.date || todayIso);
    setProfession(c.profession || "");
    setCommune(c.commune || "");
    setVillageSecteur(c.villageSecteur || "");
    setZoneResidence(c.zoneResidence || "");
    setModeEntree(c.modeEntree || "");
    setAncienConsultant(!!c.ancienConsultant);
    setPraticienId(c.praticienId || "");
    setFiltrePraticien("");
    setTelephonePraticien(c.telephonePraticien || "");
    setTemperature(c.vitals?.temperature ? String(c.vitals.temperature) : "");
    setPoids(c.vitals?.poids ? String(c.vitals.poids) : "");
    setTaille(c.vitals?.taille ? String(c.vitals.taille) : "");
    setTa(c.vitals?.tensionArterielle || "");
    setPouls(c.vitals?.pouls ? String(c.vitals.pouls) : "");
    setGlycemie(c.vitals?.glycemie ? String(c.vitals.glycemie) : "");
    setPlainte(c.plainte || "");
    // Réinitialisation de la partie "conclusion de la consultation"
    setModeCloture("transfert");
    setExamenPhysique(c.examenPhysique || "");
    setDiagnostic(c.diagnostic || "");
    setDiagnosticFinal(c.diagnosticFinal || "");
    setDecision((c.decision as DecisionFinale) || "Retour à domicile");
    setReferenceService(c.referenceService || "");
    setOrdonnance(c.ordonnance || []);
    setLigneMedNom("");
    setLigneMedPosologie("");
    setLigneMedDuree("");
    setLigneMedId(undefined);
    setLigneMedQte("1");
    setPharmacieSearchOpen(false);
  };

  const handleAjouterLigneOrdonnance = () => {
    if (!ligneMedNom.trim()) return;
    const qte = parseFloat(ligneMedQte) || 0;
    setOrdonnance((prev) => [
      ...prev,
      {
        id: generateUid(),
        medicamentNom: ligneMedNom.trim(),
        posologie: ligneMedPosologie.trim(),
        duree: ligneMedDuree.trim(),
        // Rattaché à un article de la pharmacie uniquement si sélectionné
        // dans la liste (pas en saisie libre) : c'est ce qui permet la
        // déduction automatique du stock à la clôture de la consultation.
        medicamentId: ligneMedId,
        quantitePrescrite: ligneMedId ? qte : undefined,
      },
    ]);
    setLigneMedNom("");
    setLigneMedPosologie("");
    setLigneMedDuree("");
    setLigneMedId(undefined);
    setLigneMedQte("1");
    setPharmacieSearchOpen(false);
  };

  const handleSupprimerLigneOrdonnance = (id: string) => {
    setOrdonnance((prev) => prev.filter((l) => l.id !== id));
  };

  // Construit les constantes + informations communes aux deux issues
  // possibles (transfert ou clôture par l'infirmier/la sage-femme).
  const buildBaseUpdate = (): Consultation => {
    const weightNum = parseFloat(poids) || 0;
    const heightNum = parseFloat(taille) || 0;
    let imc: number | undefined = undefined;
    if (weightNum > 0 && heightNum > 0) {
      const heightM = heightNum / 100;
      imc = parseFloat((weightNum / (heightM * heightM)).toFixed(2));
    }
    return {
      ...selected!,
      date,
      profession: profession.trim(),
      commune: commune.trim(),
      villageSecteur: villageSecteur.trim(),
      zoneResidence,
      modeEntree,
      ancienConsultant,
      praticienId,
      telephonePraticien: telephonePraticien.trim(),
      plainte: plainte.trim(),
      vitals: {
        temperature: parseFloat(temperature) || 0,
        poids: weightNum,
        tensionArterielle: ta.trim(),
        pouls: parseFloat(pouls) || 0,
        glycemie: parseFloat(glycemie) || 0,
        taille: heightNum || undefined,
        imc,
      },
    };
  };

  const handleTerminerMoiMeme = () => {
    if (!selected) return;
    if (!plainte.trim()) {
      alert("Veuillez renseigner le motif de consultation.");
      return;
    }
    if (!diagnostic.trim()) {
      alert("Veuillez renseigner le diagnostic avant de clôturer la consultation.");
      return;
    }
    if (decision === "Référer vers un autre service" && !referenceService.trim()) {
      alert("Veuillez préciser le service vers lequel le patient est référé.");
      return;
    }

    const nowTime = new Date().toTimeString().slice(0, 5);
    const praticienNom = staff.find((s) => s.id === praticienId)?.nom || "";

    let updated: Consultation = {
      ...buildBaseUpdate(),
      examenPhysique: examenPhysique.trim(),
      diagnostic: diagnostic.trim(),
      diagnosticFinal: diagnosticFinal.trim() || undefined,
      ordonnance: [...ordonnance],
      decision,
      referenceService: decision === "Référer vers un autre service" ? referenceService.trim() : undefined,
      // Dossier clos par l'infirmier/la sage-femme : s'il reste des actes à
      // payer (ordonnance), on repasse par le secrétariat, sinon le dossier
      // est terminé.
      statut: ordonnance.length > 0 ? "Attente paiement actes" : "Terminée",
    };

    if (decision === "Hospitalisation" || decision === "Mise en observation") {
      if (onUpdateHospitalisations) {
        const newHosp: Hospitalisation = {
          id: generateUid(),
          patient: updated.patient,
          contact: updated.contact,
          dateAdmission: updated.date,
          heureAdmission: nowTime,
          service: decision === "Mise en observation" ? "Observation" : "Hospitalisation",
          chambre: "",
          medecin: praticienNom,
          motif: updated.plainte,
          notesInitiales: `Diagnostic (Salle Infirmier/Maternité) : ${updated.diagnostic}${updated.examenPhysique ? "\nExamen clinique : " + updated.examenPhysique : ""}`,
          typeAdmission: decision === "Mise en observation" ? "Mise en Observation (72h)" : "Hospitalisation",
          statut: "En cours",
          dateSortie: "",
          statutSortie: "",
          diagnosticSortie: "",
          createdAt: new Date().toISOString(),
        };
        updated.linkedHospitalisationId = newHosp.id;
        onUpdateHospitalisations([newHosp, ...hospitalisations]);
      }
    } else if (decision === "Admission aux urgences") {
      if (onUpdateUrgences) {
        const newUrg: PatientUrgence = {
          id: generateUid(),
          patient: updated.patient,
          contact: updated.contact,
          severite: "Urgent (Jaune)",
          plainte: updated.plainte,
          constantes: `T°: ${updated.vitals.temperature}°C | TA: ${updated.vitals.tensionArterielle} | Pouls: ${updated.vitals.pouls} | Glycémie: ${updated.vitals.glycemie}`,
          medecinId: praticienId,
          dateArrivee: updated.date,
          heureArrivee: nowTime,
          statut: "En attente de médecin",
          createdAt: new Date().toISOString(),
        };
        updated.linkedUrgenceId = newUrg.id;
        onUpdateUrgences([newUrg, ...urgences]);
      }
    }

    // Déduction automatique du stock pharmacie pour chaque ligne d'ordonnance
    // rattachée à un article de la pharmacie (même logique qu'en Consultation
    // Générale).
    if (onUpdateMedicaments && onUpdateMouvements) {
      const workingStock = [...medicaments];
      const newStockMovements: MouvementStock[] = [];
      let stockShortfallWarnings: string[] = [];

      updated.ordonnance.forEach((line) => {
        if (!line.medicamentId || !line.quantitePrescrite || line.quantitePrescrite <= 0) return;
        const idx = workingStock.findIndex((m) => m.id === line.medicamentId);
        if (idx === -1) return;

        const med = workingStock[idx];
        const deduction = Math.min(line.quantitePrescrite, med.stock);
        if (deduction < line.quantitePrescrite) {
          stockShortfallWarnings.push(
            `${med.nom} : ${line.quantitePrescrite} demandé(s), seulement ${med.stock} disponible(s) en stock.`
          );
        }
        if (deduction <= 0) return;

        workingStock[idx] = { ...med, stock: med.stock - deduction };

        newStockMovements.push({
          id: generateUid(),
          medId: med.id,
          type: "sortie",
          qte: deduction,
          motif: `Prescription — Salle Infirmier/Maternité — Patient : ${updated.patient}`,
          prixUnitaire: med.prixVente || 0,
          montant: (med.prixVente || 0) * deduction,
          date: updated.date,
          createdAt: new Date().toISOString(),
        });
      });

      if (newStockMovements.length > 0) {
        onUpdateMedicaments(workingStock);
        onUpdateMouvements([...newStockMovements, ...mouvements]);
      }
      if (stockShortfallWarnings.length > 0) {
        alert("Attention, stock insuffisant :\n" + stockShortfallWarnings.join("\n"));
      }
    }

    onUpdateConsultations(consultations.map((c) => (c.id === selected.id ? updated : c)));
    setSelectedId(null);
    alert("Consultation clôturée et enregistrée pour : " + updated.patient);
  };

  const handleEnvoyerAuMedecin = () => {
    if (!selected) return;
    if (!plainte.trim()) {
      alert("Veuillez renseigner le motif de consultation.");
      return;
    }
    if (destinationTransfert === "autre" && !autreServiceTexte.trim()) {
      alert("Veuillez préciser le service vers lequel le patient est transféré.");
      return;
    }

    const updated: Consultation = {
      ...buildBaseUpdate(),
      referenceService: destinationTransfert === "autre" ? autreServiceTexte.trim() : undefined,
      statut: destinationTransfert === "autre" ? "Transféré vers un autre service" : "Attente consultation médecin",
    };

    onUpdateConsultations(consultations.map((c) => (c.id === selected.id ? updated : c)));
    setSelectedId(null);
  };

  return (
    <div className={`p-4 grid grid-cols-1 md:grid-cols-3 gap-4 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
      <div className="md:col-span-1 space-y-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Activity className="w-5 h-5" /> Patients à prendre en charge
        </h2>
        {enAttente.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Aucun patient en attente pour le moment.
          </p>
        ) : (
          enAttente.map((c) => (
            <button
              key={c.id}
              onClick={() => openPatient(c)}
              className={`w-full text-left px-3 py-2 rounded border transition ${
                selectedId === c.id
                  ? "border-emerald-500 bg-emerald-500/10"
                  : isDark
                  ? "border-gray-700 bg-gray-800 hover:bg-gray-700"
                  : "border-gray-200 bg-white hover:bg-gray-50"
              }`}
            >
              <div className="font-medium">{c.patient}</div>
              <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                {c.age ? `${c.age} ans` : ""} {c.contact ? `· ${c.contact}` : ""}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="md:col-span-2">
        {!selected ? (
          <div className={`h-full flex items-center justify-center text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Sélectionnez un patient pour saisir ses constantes.
          </div>
        ) : (
          <div className={`rounded-lg border p-4 space-y-4 ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
            <h3 className="font-semibold text-lg">{selected.patient}</h3>

            <div>
              <label className="text-sm font-medium">Date de la consultation</label>
              <input
                type="date"
                className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <p className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                Par défaut, la date du jour. Modifiez-la pour enregistrer un ancien dossier de consultation (antérieur à aujourd'hui).
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Profession</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                placeholder="Ex: Enseignant"
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Adresse - Commune/Arrond.</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                  placeholder="Ex: Bobo-Dioulasso, Secteur 15"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Adresse - Village/Secteur</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                  placeholder="Ex: Belle-ville"
                  value={villageSecteur}
                  onChange={(e) => setVillageSecteur(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Zone de résidence du consultant</label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                  value={zoneResidence}
                  onChange={(e) => setZoneResidence(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {ZONES_RESIDENCE.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Mode d'entrée</label>
                <select
                  className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                  value={modeEntree}
                  onChange={(e) => setModeEntree(e.target.value)}
                >
                  <option value="">— Choisir —</option>
                  {MODES_ENTREE.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={ancienConsultant}
                onChange={(e) => setAncienConsultant(e.target.checked)}
              />
              Ancien consultant (Déjà venu)
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Nom, prénom, qualification et signature du prestataire</label>
                <input
                  className="w-full mt-1 mb-1 px-3 py-1.5 text-sm rounded border bg-transparent"
                  placeholder="Filtrer praticien"
                  value={filtrePraticien}
                  onChange={(e) => setFiltrePraticien(e.target.value)}
                />
                <select
                  className="w-full px-3 py-2 rounded border bg-transparent"
                  value={praticienId}
                  onChange={(e) => {
                    setPraticienId(e.target.value);
                    const s = staff.find((st) => st.id === e.target.value);
                    setTelephonePraticien(s?.contact || "");
                  }}
                >
                  <option value="">— Choisir le praticien —</option>
                  {praticiensFiltres.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nom}{s.poste ? ` (${s.poste})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Téléphone</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                  placeholder="+226..."
                  value={telephonePraticien}
                  onChange={(e) => setTelephonePraticien(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Motif de consultation *</label>
              <textarea className="w-full mt-1 px-3 py-2 rounded border bg-transparent" rows={2} value={plainte} onChange={(e) => setPlainte(e.target.value)} />
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Constantes</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs">Température (°C)</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Poids (kg)</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={poids} onChange={(e) => setPoids(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Taille (cm)</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={taille} onChange={(e) => setTaille(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Tension artérielle</label>
                  <input className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={ta} onChange={(e) => setTa(e.target.value)} placeholder="12/8" />
                </div>
                <div>
                  <label className="text-xs">Pouls (bpm)</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={pouls} onChange={(e) => setPouls(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Glycémie</label>
                  <input type="number" className="w-full mt-1 px-2 py-1.5 rounded border bg-transparent" value={glycemie} onChange={(e) => setGlycemie(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-dashed">
              <h4 className="text-sm font-semibold mb-2">Suite à donner</h4>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setModeCloture("moimeme")}
                  className={`flex-1 px-3 py-2 rounded border text-sm font-medium flex items-center justify-center gap-2 transition ${
                    modeCloture === "moimeme"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : isDark
                      ? "border-gray-700 hover:bg-gray-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4" /> Je termine la consultation moi-même
                </button>
                <button
                  type="button"
                  onClick={() => setModeCloture("transfert")}
                  className={`flex-1 px-3 py-2 rounded border text-sm font-medium flex items-center justify-center gap-2 transition ${
                    modeCloture === "transfert"
                      ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                      : isDark
                      ? "border-gray-700 hover:bg-gray-700"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Send className="w-4 h-4" /> Transférer le patient
                </button>
              </div>

              {modeCloture === "moimeme" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Examen clinique</label>
                    <textarea
                      className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                      rows={2}
                      value={examenPhysique}
                      onChange={(e) => setExamenPhysique(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Diagnostic *</label>
                    <textarea
                      className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                      rows={2}
                      value={diagnostic}
                      onChange={(e) => setDiagnostic(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Diagnostic final / de sortie (si nécessaire)</label>
                    <textarea
                      className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                      rows={2}
                      value={diagnosticFinal}
                      onChange={(e) => setDiagnosticFinal(e.target.value)}
                    />
                  </div>

                  <div>
                    <h5 className="text-xs font-semibold mb-1">Ordonnance</h5>
                    {ordonnance.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {ordonnance.map((l) => (
                          <div
                            key={l.id}
                            className={`flex items-center justify-between px-2 py-1.5 rounded border text-sm ${
                              isDark ? "border-gray-700 bg-gray-900" : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            <span>
                              {l.medicamentNom}
                              {l.posologie ? ` — ${l.posologie}` : ""}
                              {l.duree ? ` (${l.duree})` : ""}
                            </span>
                            <button type="button" onClick={() => handleSupprimerLigneOrdonnance(l.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2 relative">
                      <div className="col-span-2 relative">
                        <input
                          className="w-full px-2 py-1.5 text-sm rounded border bg-transparent"
                          placeholder="Rechercher un médicament en stock..."
                          value={ligneMedNom}
                          onChange={(e) => {
                            setLigneMedNom(e.target.value);
                            setLigneMedId(undefined);
                            setPharmacieSearchOpen(true);
                          }}
                          onFocus={() => setPharmacieSearchOpen(true)}
                        />
                        {ligneMedId && (
                          <span className="absolute right-2 top-1.5 text-xs text-emerald-600 font-medium">
                            en stock
                          </span>
                        )}
                        {pharmacieSearchOpen && ligneMedNom.trim() && !ligneMedId && (
                          <div
                            className={`absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border shadow-lg ${
                              isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                            }`}
                          >
                            {pharmacieSearchResults.length > 0 ? (
                              pharmacieSearchResults.map((m) => (
                                <button
                                  type="button"
                                  key={m.id}
                                  onClick={() => {
                                    setLigneMedId(m.id);
                                    setLigneMedNom(m.nom);
                                    setPharmacieSearchOpen(false);
                                  }}
                                  className={`w-full text-left px-2 py-1.5 text-sm flex items-center justify-between ${
                                    isDark ? "hover:bg-gray-700" : "hover:bg-gray-50"
                                  }`}
                                >
                                  <span>{m.nom}</span>
                                  <span className="text-xs text-gray-400">stock : {m.stock}</span>
                                </button>
                              ))
                            ) : (
                              <button
                                type="button"
                                onClick={() => setPharmacieSearchOpen(false)}
                                className="w-full text-left px-2 py-1.5 text-xs text-gray-400"
                              >
                                ✏️ Aucun article trouvé — utiliser « {ligneMedNom.trim()} » en saisie libre (stock non
                                déduit)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <input
                        className="px-2 py-1.5 text-sm rounded border bg-transparent"
                        placeholder="Posologie"
                        value={ligneMedPosologie}
                        onChange={(e) => setLigneMedPosologie(e.target.value)}
                      />
                      <input
                        className="px-2 py-1.5 text-sm rounded border bg-transparent"
                        placeholder="Durée"
                        value={ligneMedDuree}
                        onChange={(e) => setLigneMedDuree(e.target.value)}
                      />
                    </div>
                    {ligneMedId && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs">Quantité à prescrire (déduite du stock) :</label>
                        <input
                          type="number"
                          min="1"
                          className="w-20 px-2 py-1 text-sm rounded border bg-transparent"
                          value={ligneMedQte}
                          onChange={(e) => setLigneMedQte(e.target.value)}
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleAjouterLigneOrdonnance}
                      className="mt-2 text-xs font-medium flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                    </button>
                    <p className={`text-xs mt-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                      Choisir un médicament dans la liste déduit automatiquement le stock de la pharmacie à la
                      clôture. En saisie libre (article non trouvé), le stock n'est pas déduit.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Décision</label>
                    <select
                      className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                      value={decision}
                      onChange={(e) => setDecision(e.target.value as DecisionFinale)}
                    >
                      <option value="Retour à domicile">Retour à domicile</option>
                      <option value="Référer vers un autre service">Référer vers un autre service</option>
                      <option value="Hospitalisation">Hospitalisation</option>
                      <option value="Mise en observation">Mise en observation</option>
                      <option value="Admission aux urgences">Admission aux urgences</option>
                    </select>
                  </div>
                  {decision === "Référer vers un autre service" && (
                    <div>
                      <label className="text-sm font-medium">Service de destination</label>
                      <input
                        className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                        placeholder="Ex: Kinésithérapie, clinique partenaire..."
                        value={referenceService}
                        onChange={(e) => setReferenceService(e.target.value)}
                      />
                    </div>
                  )}

                  <button
                    onClick={handleTerminerMoiMeme}
                    className="px-4 py-2 rounded bg-emerald-600 text-white font-medium flex items-center gap-2 hover:bg-emerald-700"
                  >
                    <ClipboardCheck className="w-4 h-4" /> Terminer la consultation
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Transférer vers</label>
                    <select
                      className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                      value={destinationTransfert}
                      onChange={(e) => setDestinationTransfert(e.target.value as "medecin" | "autre")}
                    >
                      <option value="medecin">Le médecin (Consultation Générale)</option>
                      <option value="autre">Un autre service</option>
                    </select>
                  </div>
                  {destinationTransfert === "autre" && (
                    <div>
                      <label className="text-sm font-medium">Préciser le service</label>
                      <input
                        className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
                        placeholder="Ex: Maternité, clinique partenaire..."
                        value={autreServiceTexte}
                        onChange={(e) => setAutreServiceTexte(e.target.value)}
                      />
                    </div>
                  )}
                  <button
                    onClick={handleEnvoyerAuMedecin}
                    className="px-4 py-2 rounded bg-blue-600 text-white font-medium flex items-center gap-2 hover:bg-blue-700"
                  >
                    <Stethoscope className="w-4 h-4" /> Transférer <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actes payés en attente d'exécution (soins prescrits par le médecin,
          hors examens labo qui se gèrent dans l'onglet Laboratoire). */}
      {actesAExecuter.length > 0 && (
        <div className="md:col-span-3 space-y-2 pt-4 border-t border-dashed">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Syringe className="w-5 h-5" /> Soins à exécuter (actes payés)
          </h2>
          <div className="space-y-2">
            {actesAExecuter.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-3 py-2 rounded border ${
                  isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
                }`}
              >
                <div>
                  <div className="font-medium">{c.patient}</div>
                  <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {(c.ordonnance || []).length > 0
                      ? `${c.ordonnance.length} ligne(s) d'ordonnance à exécuter`
                      : "Aucun soin à exécuter (voir Laboratoire pour les examens)"}
                  </div>
                </div>
                <button
                  onClick={() => handleMarquerSoinsExecutes(c)}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" /> Soins exécutés
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
