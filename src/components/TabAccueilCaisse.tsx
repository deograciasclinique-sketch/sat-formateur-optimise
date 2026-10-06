/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Consultation, Facture, FactureLigne, ActeTarifaire } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, UserPlus, Wallet, ArrowRight, Clock, CheckCircle2, Trash2, ReceiptText, Search, ShieldCheck, AlertTriangle } from "lucide-react";
import { VALIDITE_RECU_JOURS, dernierRecu, listeRecusValides, dateCourteFr, RecuConsultation } from "../lib/recuConsultation";
import { PatientRegistre, chercherPatients, doublonsPossibles, nouveauCode, ageActuel, anneeDepuisAge, estUnCode, normaliserCode } from "../lib/patients";
import CartePatient from "./CartePatient";
import BarcodeScanner from "./BarcodeScanner";
import { IdCard, ScanLine, X } from "lucide-react";

interface TabAccueilCaisseProps {
  consultations: Consultation[];
  onUpdateConsultations: (consults: Consultation[]) => void;
  // Registre des patients (un code par patient, enregistré une seule fois).
  patients?: PatientRegistre[];
  onUpdatePatients?: (p: PatientRegistre[]) => void;
  factures: Facture[];
  onUpdateFactures: (factures: Facture[]) => void;
  // Catalogue des actes/tarifs (onglet "Actes & Tarifs"), pour que la
  // secrétaire puisse facturer directement selon la demande du patient
  // plutôt que de saisir un montant fixe.
  actes?: ActeTarifaire[];
  theme?: "light" | "dark";
}

// Ligne de panier : soit un acte du catalogue (acteId renseigné), soit une
// ligne libre saisie manuellement (acte non répertorié).
interface LignePanier {
  uid: string;
  acteId?: string;
  designation: string;
  qte: number;
  prix: number;
}

const ligneMontant = (l: LignePanier) => l.qte * l.prix;
const panierTotal = (lignes: LignePanier[]) => lignes.reduce((s, l) => s + ligneMontant(l), 0);

// Bloc réutilisable : recherche dans le catalogue d'actes + panier avec
// quantités + ajout d'une ligne libre. Utilisé à la fois pour l'enregistrement
// d'un nouveau patient et pour la facturation d'actes à un patient déjà présent.
function SelecteurActes({
  actes,
  panier,
  setPanier,
  isDark,
}: {
  actes: ActeTarifaire[];
  panier: LignePanier[];
  setPanier: (lignes: LignePanier[]) => void;
  isDark: boolean;
}) {
  const [recherche, setRecherche] = useState("");
  const [libreDesignation, setLibreDesignation] = useState("");
  const [libreMontant, setLibreMontant] = useState("");

  const actesFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return actes;
    return actes.filter(
      (a) => a.nom.toLowerCase().includes(q) || (a.categorie || "").toLowerCase().includes(q)
    );
  }, [actes, recherche]);

  const ajouterActe = (acte: ActeTarifaire) => {
    const existante = panier.find((l) => l.acteId === acte.id);
    if (existante) {
      setPanier(panier.map((l) => (l.acteId === acte.id ? { ...l, qte: l.qte + 1 } : l)));
    } else {
      setPanier([...panier, { uid: generateUid(), acteId: acte.id, designation: acte.nom, qte: 1, prix: acte.prix }]);
    }
  };

  const ajouterLigneLibre = () => {
    const prix = parseFloat(libreMontant) || 0;
    if (!libreDesignation.trim() || prix <= 0) {
      alert("Renseignez une désignation et un montant valides pour la ligne libre.");
      return;
    }
    setPanier([...panier, { uid: generateUid(), designation: libreDesignation.trim(), qte: 1, prix }]);
    setLibreDesignation("");
    setLibreMontant("");
  };

  const majQte = (uid: string, qte: number) => {
    if (qte <= 0) {
      setPanier(panier.filter((l) => l.uid !== uid));
      return;
    }
    setPanier(panier.map((l) => (l.uid === uid ? { ...l, qte } : l)));
  };

  const retirerLigne = (uid: string) => setPanier(panier.filter((l) => l.uid !== uid));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className={`w-4 h-4 absolute left-2.5 top-2.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
        <input
          className="w-full pl-8 pr-3 py-2 rounded border bg-transparent text-sm"
          placeholder="Rechercher un acte (ex: pansement, certificat, injection...)"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {actes.length === 0 ? (
        <p className={`text-xs italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Aucun acte enregistré dans le catalogue "Actes & Tarifs" pour le moment.
        </p>
      ) : (
        <div className={`max-h-40 overflow-y-auto rounded border divide-y ${isDark ? "border-gray-700 divide-gray-700" : "border-gray-200 divide-gray-100"}`}>
          {actesFiltres.length === 0 ? (
            <p className={`text-xs italic p-2 ${isDark ? "text-gray-500" : "text-gray-400"}`}>Aucun acte ne correspond.</p>
          ) : (
            actesFiltres.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => ajouterActe(a)}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-emerald-500/10 ${isDark ? "text-gray-200" : "text-gray-800"}`}
              >
                <span>
                  {a.nom} <span className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}>({a.categorie})</span>
                </span>
                <span className="flex items-center gap-1 font-medium">
                  {a.prix.toLocaleString("fr-FR")} FCFA <Plus className="w-3.5 h-3.5" />
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="text-xs font-medium">Acte hors catalogue (ligne libre)</label>
          <input
            className="w-full mt-1 px-2 py-1.5 text-sm rounded border bg-transparent"
            placeholder="Désignation"
            value={libreDesignation}
            onChange={(e) => setLibreDesignation(e.target.value)}
          />
        </div>
        <div className="w-32">
          <label className="text-xs font-medium">Montant</label>
          <input
            type="number"
            className="w-full mt-1 px-2 py-1.5 text-sm rounded border bg-transparent"
            value={libreMontant}
            onChange={(e) => setLibreMontant(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={ajouterLigneLibre}
          className="px-3 py-1.5 rounded border text-sm font-medium hover:bg-gray-500/10"
        >
          Ajouter
        </button>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide mb-1">Panier</h4>
        {panier.length === 0 ? (
          <p className={`text-xs italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>Aucun acte sélectionné.</p>
        ) : (
          <div className="space-y-1">
            {panier.map((l) => (
              <div key={l.uid} className="flex items-center justify-between text-sm gap-2">
                <span className="flex-1">{l.designation}</span>
                <input
                  type="number"
                  min={1}
                  className="w-14 px-1.5 py-1 rounded border bg-transparent text-center"
                  value={l.qte}
                  onChange={(e) => majQte(l.uid, parseInt(e.target.value, 10) || 0)}
                />
                <span className="w-24 text-right font-medium">{ligneMontant(l).toLocaleString("fr-FR")} FCFA</span>
                <button type="button" onClick={() => retirerLigne(l.uid)} className="text-red-500 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm font-bold pt-1 border-t">
              <span>Total</span>
              <span>{panierTotal(panier).toLocaleString("fr-FR")} FCFA</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Écran secrétariat, étape 1 : le patient arrive, on l'enregistre (identité de
// base) et on encaisse les actes demandés (consultation et/ou tout autre acte
// du catalogue). Une fois payé, le dossier est envoyé vers la destination
// choisie par la secrétaire (infirmerie, maternité ou laboratoire — statut
// "Attente prise en charge ..."). Le reste du dossier (constantes,
// diagnostic, prescription) est complété plus loin dans le circuit par
// l'infirmier puis le médecin (ou directement par la sage-femme / le labo).
//
// La secrétaire peut aussi, à tout moment, facturer un acte supplémentaire à
// un patient déjà présent dans le service (ex: certificat, pansement,
// injection demandés en cours de journée), sans perturber son dossier
// clinique en cours.
export default function TabAccueilCaisse({
  consultations,
  onUpdateConsultations,
  patients = [],
  onUpdatePatients = () => {},
  factures,
  onUpdateFactures,
  actes = [],
  theme = "light",
}: TabAccueilCaisseProps) {
  // --- Patient déjà enregistré : retrouvé par son code, son nom ou son téléphone ---
  const [rechercheCode, setRechercheCode] = useState("");
  const [patientSel, setPatientSel] = useState<PatientRegistre | null>(null);
  const [scanOuvert, setScanOuvert] = useState(false);
  const [carte, setCarte] = useState<{ p: PatientRegistre; nouveau: boolean } | null>(null);
  const resultatsCode = useMemo(() => (patientSel ? [] : chercherPatients(patients, rechercheCode)), [patients, rechercheCode, patientSel]);

  const choisirPatient = (p: PatientRegistre) => {
    setPatientSel(p);
    setRechercheCode("");
    setPatient(p.nom);
    const a = ageActuel(p);
    setAge(a !== undefined ? String(a) : "");
    if (p.sexe) setSexe(p.sexe);
    setContact(p.contact || "");
    setCommune(p.commune || "");
  };
  const oublierPatient = () => {
    setPatientSel(null);
    setPatient(""); setAge(""); setSexe("Masculin"); setContact(""); setCommune("");
  };
  const apresScan = (texte: string) => {
    setScanOuvert(false);
    const code = normaliserCode(texte);
    const p = patients.find((x) => x.code === code);
    if (p) choisirPatient(p);
    else { setRechercheCode(texte); alert(`Aucun patient avec le code ${code || texte}.`); }
  };

  // Code du patient de la visite : celui choisi, sinon nouvelle fiche au registre.
  const enregistrerAuRegistre = (infos: { nom: string; age?: number; sexe?: "Masculin" | "Féminin"; contact?: string; commune?: string }, existant?: PatientRegistre | null) => {
    const maintenant = new Date().toISOString();
    if (existant) {
      const maj: PatientRegistre = {
        ...existant,
        contact: infos.contact || existant.contact,
        commune: infos.commune || existant.commune,
        sexe: infos.sexe || existant.sexe,
        anneeNaissance: existant.dateNaissance ? existant.anneeNaissance : anneeDepuisAge(infos.age) ?? existant.anneeNaissance,
        updatedAt: maintenant,
      };
      onUpdatePatients(patients.map((x) => (x.code === existant.code ? maj : x)));
      return { p: maj, nouveau: false };
    }
    const p: PatientRegistre = {
      code: nouveauCode(new Set(patients.map((x) => x.code))),
      nom: infos.nom.trim(), sexe: infos.sexe, anneeNaissance: anneeDepuisAge(infos.age),
      contact: infos.contact || undefined, commune: infos.commune || undefined,
      createdAt: maintenant, updatedAt: maintenant, origine: "accueil",
    };
    onUpdatePatients([p, ...patients]);
    return { p, nouveau: true };
  };

  const [patient, setPatient] = useState("");
  const [age, setAge] = useState("");
  const [sexe, setSexe] = useState<"Masculin" | "Féminin">("Masculin");
  const [contact, setContact] = useState("");
  const [commune, setCommune] = useState("");
  const [modePaiement, setModePaiement] = useState("Espèces");
  const [panierNouveau, setPanierNouveau] = useState<LignePanier[]>([]);
  // Orientation choisie par la secrétaire : vers l'infirmerie (circuit normal
  // de consultation générale), la maternité (CPN, etc.), ou directement le
  // laboratoire (examen demandé sans consultation médicale).
  const [serviceDestination, setServiceDestination] = useState<"Infirmerie" | "Maternite" | "Laboratoire">("Infirmerie");

  // Facturation d'actes pour un patient déjà présent dans le circuit.
  const [rechercheExistant, setRechercheExistant] = useState("");
  const [patientExistantId, setPatientExistantId] = useState("");
  const [modePaiementExistant, setModePaiementExistant] = useState("Espèces");
  const [panierExistant, setPanierExistant] = useState<LignePanier[]>([]);

  const isDark = theme === "dark";
  const today = getTodayStr();

  // --- Reçus de consultation encore valables (14 jours) -------------------
  const [rechercheRecus, setRechercheRecus] = useState("");
  const [visiteRecuId, setVisiteRecuId] = useState<string | null>(null);
  const [visiteDestination, setVisiteDestination] = useState<"Infirmerie" | "Maternite" | "Laboratoire">("Infirmerie");
  const recusValides = useMemo(() => listeRecusValides(factures, consultations, today), [factures, consultations, today]);
  const recusFiltres = useMemo(() => {
    const q = rechercheRecus.trim().toLowerCase();
    if (!q) return recusValides;
    return recusValides.filter((r) => r.patient.toLowerCase().includes(q) || (r.contact || "").includes(q));
  }, [recusValides, rechercheRecus]);
  // Reçu retrouvé pendant la saisie du nom dans le formulaire "Nouveau patient".
  const recuFormulaire = useMemo(
    () => (patient.trim().length >= 3 ? dernierRecu(factures, consultations, patient, contact, today) : null),
    [factures, consultations, patient, contact, today]
  );

  // Patients déjà au registre avec le même nom (pour ne pas créer de doublon).
  const memeNom = useMemo(
    () => (!patientSel && patient.trim().length >= 3 ? doublonsPossibles(patients, patient, contact) : []),
    [patients, patient, contact, patientSel]
  );

  // --- Patients à encaisser (ex. venus sur RDV avec un reçu expiré) --------
  const [encaisserId, setEncaisserId] = useState<string | null>(null);
  const [panierEncaisser, setPanierEncaisser] = useState<LignePanier[]>([]);
  const [modePaiementEncaisser, setModePaiementEncaisser] = useState("Espèces");

  const enAttentePaiementConsult = useMemo(
    () => consultations.filter((c) => c.statut === "Attente paiement consultation"),
    [consultations]
  );

  const dejaEnvoyesAujourdhui = useMemo(
    () =>
      consultations.filter(
        (c) => c.date === getTodayStr() && c.statut && c.statut !== "Attente paiement consultation"
      ),
    [consultations]
  );

  // Patients déjà présents dans le service aujourd'hui, pour la facturation
  // d'actes complémentaires (on exclut ceux qui attendent encore de payer
  // leur consultation initiale, déjà couverts par le formulaire du dessus).
  const patientsPresents = useMemo(
    () =>
      consultations
        .filter((c) => c.date === getTodayStr() && c.statut !== "Attente paiement consultation")
        .filter((c) => {
          const q = rechercheExistant.trim().toLowerCase();
          if (!q) return true;
          return c.patient.toLowerCase().includes(q);
        }),
    [consultations, rechercheExistant]
  );

  const facturesActesAujourdhui = useMemo(
    () => factures.filter((f) => f.date === getTodayStr() && f.typePaiement === "Actes"),
    [factures]
  );

  const statutPourDestination = (d: "Infirmerie" | "Maternite" | "Laboratoire"): Consultation["statut"] =>
    d === "Maternite" ? "Attente prise en charge maternité" : d === "Laboratoire" ? "Attente prise en charge laboratoire" : "Attente prise en charge infirmier";

  // Nouvelle visite couverte par un reçu encore valable : aucun paiement de
  // consultation. Les autres actes éventuels du panier sont facturés à part
  // (type "Actes", ce qui ne prolonge pas la validité du reçu).
  const creerVisiteAvecRecu = (
    recu: RecuConsultation,
    destination: "Infirmerie" | "Maternite" | "Laboratoire",
    infos?: { patient?: string; age?: number; sexe?: "Masculin" | "Féminin"; contact?: string; commune?: string },
    panierActes: LignePanier[] = [],
    mode = "Espèces"
  ) => {
    const o = recu.consultationOrigine;
    const nomVisite = (infos?.patient || recu.patient).trim();
    const existant = patientSel || (o?.codePatient ? patients.find((x) => x.code === o.codePatient) : undefined)
      || (doublonsPossibles(patients, nomVisite, infos?.contact || recu.contact).length === 1 ? doublonsPossibles(patients, nomVisite, infos?.contact || recu.contact)[0] : undefined);
    const { p: fiche, nouveau } = enregistrerAuRegistre(
      { nom: nomVisite, age: infos?.age || o?.age, sexe: infos?.sexe || o?.sexe, contact: (infos?.contact || recu.contact || "").trim(), commune: (infos?.commune || o?.commune || "").trim() },
      existant
    );
    const newCons: Consultation = {
      id: generateUid(),
      codePatient: fiche.code,
      patient: existant ? existant.nom : nomVisite,
      age: infos?.age || o?.age || 0,
      sexe: infos?.sexe || o?.sexe || "Masculin",
      contact: (infos?.contact || recu.contact || "").trim(),
      commune: (infos?.commune || o?.commune || "").trim(),
      profession: o?.profession,
      villageSecteur: o?.villageSecteur,
      zoneResidence: o?.zoneResidence,
      ancienConsultant: true,
      date: today,
      statut: statutPourDestination(destination),
      serviceDestination: destination,
      montantConsultation: 0,
      recuConsultationId: recu.facture.id,
      vitals: { temperature: 0, poids: 0, tensionArterielle: "", pouls: 0, glycemie: 0 },
      plainte: "",
      diagnostic: "",
      ordonnance: [],
      createdAt: new Date().toISOString(),
    };
    onUpdateConsultations([newCons, ...consultations]);
    const totalActes = panierTotal(panierActes);
    if (totalActes > 0) {
      onUpdateFactures([
        {
          id: generateUid(), codePatient: fiche.code, patient: newCons.patient, date: today, mode, lignes: lignesPanierVersFacture(panierActes),
          total: totalActes, montantPaye: totalActes, statut: "Payée", createdAt: new Date().toISOString(),
          consultationId: newCons.id, typePaiement: "Actes",
        },
        ...factures,
      ]);
    }
    if (nouveau) setCarte({ p: fiche, nouveau: true });
    alert(
      `${newCons.patient} (${fiche.code}) envoyé(e) ${destination === "Maternite" ? "à la maternité" : destination === "Laboratoire" ? "au laboratoire" : "à l'infirmerie"} sans payer la consultation (reçu du ${dateCourteFr(recu.payeLe)} valable jusqu'au ${dateCourteFr(recu.valableJusquau)}).` +
      (totalActes > 0 ? `\nAutres actes encaissés : ${totalActes.toLocaleString("fr-FR")} FCFA.` : "")
    );
  };

  const handleEnregistrerAvecRecu = () => {
    if (!recuFormulaire || !recuFormulaire.valide) return;
    // Le sexe du formulaire vaut "Masculin" par défaut : on garde celui de
    // la fiche d'origine quand elle existe, pour ne pas l'écraser.
    const o = recuFormulaire.consultationOrigine;
    creerVisiteAvecRecu(
      recuFormulaire,
      serviceDestination,
      {
        patient: o?.patient || patient,
        age: parseFloat(age) || undefined,
        sexe: o?.sexe || sexe,
        contact: contact.trim() || undefined,
        commune: commune.trim() || undefined,
      },
      panierNouveau,
      modePaiement
    );
    resetForm();
  };

  // Encaissement de la consultation d'un patient déjà enregistré mais pas
  // encore payé (ex. patient venu sur RDV dont le reçu a expiré, envoyé par
  // la salle infirmier). Si ses constantes ont déjà été prises, il va
  // directement chez le médecin.
  const handleEncaisserEnAttente = (c: Consultation) => {
    const total = panierTotal(panierEncaisser);
    if (total <= 0) {
      alert("Veuillez sélectionner au moins un acte à facturer (ex: consultation).");
      return;
    }
    const constantesPrises = !!(c.vitals && (c.vitals.temperature || c.vitals.tensionArterielle || c.vitals.pouls || c.vitals.poids));
    const destination = c.serviceDestination || "Infirmerie";
    const statut: Consultation["statut"] =
      constantesPrises && destination === "Infirmerie" ? "Attente consultation médecin" : statutPourDestination(destination);
    onUpdateConsultations(consultations.map((x) => (x.id === c.id ? { ...x, statut, montantConsultation: total } : x)));
    onUpdateFactures([
      {
        id: generateUid(), patient: c.patient, date: today, mode: modePaiementEncaisser, lignes: lignesPanierVersFacture(panierEncaisser),
        total, montantPaye: total, statut: "Payée", createdAt: new Date().toISOString(), consultationId: c.id, typePaiement: "Consultation",
      },
      ...factures,
    ]);
    setEncaisserId(null);
    setPanierEncaisser([]);
    alert(`Consultation encaissée pour ${c.patient}. ${statut === "Attente consultation médecin" ? "Ses constantes sont déjà prises : il/elle va directement chez le médecin." : "Dossier envoyé."}`);
  };

  const resetForm = () => {
    setPatientSel(null);
    setRechercheCode("");
    setPatient("");
    setAge("");
    setSexe("Masculin");
    setContact("");
    setCommune("");
    setPanierNouveau([]);
    setServiceDestination("Infirmerie");
  };

  const lignesPanierVersFacture = (lignes: LignePanier[]): FactureLigne[] =>
    lignes.map((l) => ({
      id: generateUid(),
      designation: l.designation,
      qte: l.qte,
      prix: l.prix,
      montant: ligneMontant(l),
    }));

  // Enregistrement + paiement en une seule action : le patient quitte le
  // secrétariat directement vers la salle des infirmiers une fois payé.
  const handleEnregistrerEtEncaisser = () => {
    if (!patient.trim()) {
      alert("Veuillez renseigner le nom du patient.");
      return;
    }
    const total = panierTotal(panierNouveau);
    if (total <= 0) {
      alert("Veuillez sélectionner au moins un acte à facturer (ex: consultation).");
      return;
    }
    if (
      recuFormulaire?.valide &&
      !window.confirm(
        `${recuFormulaire.patient} a déjà un reçu de consultation valable jusqu'au ${dateCourteFr(recuFormulaire.valableJusquau)}.\n\nVoulez-vous quand même encaisser ${total.toLocaleString("fr-FR")} FCFA ?`
      )
    ) {
      return;
    }

    // Même nom déjà au registre sans patient choisi : vérifier avant de créer un nouveau dossier.
    if (!patientSel && memeNom.length > 0 &&
      !window.confirm(`${memeNom.length > 1 ? `${memeNom.length} patients portent` : "Un patient porte"} déjà ce nom (${memeNom.map((x) => x.code).join(", ")}).\n\nOK = créer quand même un NOUVEAU patient.\nAnnuler = revenir et choisir le patient existant.`)) {
      return;
    }
    const { p: fiche, nouveau } = enregistrerAuRegistre(
      { nom: patient, age: parseFloat(age) || undefined, sexe, contact: contact.trim(), commune: commune.trim() },
      patientSel
    );

    const statutParDestination: Record<typeof serviceDestination, Consultation["statut"]> = {
      Infirmerie: "Attente prise en charge infirmier",
      Maternite: "Attente prise en charge maternité",
      Laboratoire: "Attente prise en charge laboratoire",
    };

    const newCons: Consultation = {
      id: generateUid(),
      codePatient: fiche.code,
      patient: patientSel ? patientSel.nom : patient.trim(),
      age: parseFloat(age) || 0,
      sexe,
      contact: contact.trim(),
      commune: commune.trim(),
      date: getTodayStr(),
      statut: statutParDestination[serviceDestination],
      serviceDestination,
      montantConsultation: total,
      vitals: {
        temperature: 0,
        poids: 0,
        tensionArterielle: "",
        pouls: 0,
        glycemie: 0,
      },
      plainte: "",
      diagnostic: "",
      ordonnance: [],
      createdAt: new Date().toISOString(),
    };

    const newFacture: Facture = {
      id: generateUid(),
      codePatient: fiche.code,
      patient: newCons.patient,
      date: getTodayStr(),
      mode: modePaiement,
      lignes: lignesPanierVersFacture(panierNouveau),
      total,
      montantPaye: total,
      statut: "Payée",
      createdAt: new Date().toISOString(),
      consultationId: newCons.id,
      typePaiement: "Consultation",
    };

    onUpdateConsultations([newCons, ...consultations]);
    onUpdateFactures([newFacture, ...factures]);
    resetForm();
    if (nouveau) setCarte({ p: fiche, nouveau: true });
  };

  const handleEncaisserActesExistant = () => {
    const selected = consultations.find((c) => c.id === patientExistantId);
    if (!selected) {
      alert("Veuillez choisir un patient déjà présent dans le service.");
      return;
    }
    const total = panierTotal(panierExistant);
    if (total <= 0) {
      alert("Veuillez sélectionner au moins un acte à facturer.");
      return;
    }

    const newFacture: Facture = {
      id: generateUid(),
      codePatient: selected.codePatient,
      patient: selected.patient,
      date: getTodayStr(),
      mode: modePaiementExistant,
      lignes: lignesPanierVersFacture(panierExistant),
      total,
      montantPaye: total,
      statut: "Payée",
      createdAt: new Date().toISOString(),
      consultationId: selected.id,
      typePaiement: "Actes",
    };

    onUpdateFactures([newFacture, ...factures]);
    setPanierExistant([]);
    setPatientExistantId("");
    setRechercheExistant("");
  };

  return (
    <div className={`p-4 space-y-6 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Accueil & Caisse — Nouveau patient
        </h2>
        <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
          Enregistrement du patient et facturation selon la demande (consultation et/ou tout autre
          acte du catalogue). Le dossier est envoyé vers l'infirmerie, la maternité ou le
          laboratoire une fois le paiement encaissé, selon l'orientation choisie ci-dessous.
        </p>
      </div>

      {enAttentePaiementConsult.length > 0 && (
        <div className={`rounded-lg border-2 border-amber-400 p-4 space-y-3 ${isDark ? "bg-gray-800" : "bg-amber-50/40"}`}>
          <h3 className="font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" /> À encaisser ({enAttentePaiementConsult.length})
          </h3>
          <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Patients déjà enregistrés mais dont la consultation n'est pas payée (par exemple venus sur rendez-vous avec un reçu expiré).
          </p>
          {enAttentePaiementConsult.map((c) => {
            const dr = dernierRecu(factures, consultations, c.patient, c.contact, today);
            const ouvert = encaisserId === c.id;
            return (
              <div key={c.id} className={`rounded border p-3 ${isDark ? "border-gray-700" : "border-gray-200 bg-white"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.patient}</div>
                    <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                      {c.plainte || "Consultation"}
                      {dr ? ` · dernier reçu du ${dateCourteFr(dr.payeLe)}, expiré le ${dateCourteFr(dr.valableJusquau)}` : " · aucun reçu antérieur"}
                    </div>
                  </div>
                  <button
                    onClick={() => { setEncaisserId(ouvert ? null : c.id); setPanierEncaisser([]); }}
                    className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-emerald-700"
                  >
                    <Wallet className="w-4 h-4" /> {ouvert ? "Fermer" : "Encaisser"}
                  </button>
                </div>
                {ouvert && (
                  <div className="mt-3 space-y-3">
                    <SelecteurActes actes={actes} panier={panierEncaisser} setPanier={setPanierEncaisser} isDark={isDark} />
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <label className="text-xs font-medium">Mode de paiement</label>
                        <select className="w-full mt-1 px-2 py-1.5 text-sm rounded border bg-transparent" value={modePaiementEncaisser} onChange={(e) => setModePaiementEncaisser(e.target.value)}>
                          <option value="Espèces">Espèces</option>
                          <option value="Mobile Money">Mobile Money</option>
                          <option value="Assurance">Assurance</option>
                        </select>
                      </div>
                      <button onClick={() => handleEncaisserEnAttente(c)} className="px-4 py-2 rounded bg-emerald-600 text-white font-medium flex items-center gap-2 hover:bg-emerald-700">
                        <Wallet className="w-4 h-4" /> Encaisser {panierTotal(panierEncaisser) > 0 ? `${panierTotal(panierEncaisser).toLocaleString("fr-FR")} FCFA` : ""}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div
        className={`rounded-lg border p-4 space-y-4 ${
          isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
        }`}
      >
        {/* Patient déjà enregistré : son code suffit */}
        {patientSel ? (
          <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <IdCard className="w-6 h-6 text-emerald-600 shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-emerald-700 uppercase">Patient déjà enregistré</div>
                <div className="font-bold truncate">
                  <span className="font-mono">{patientSel.code}</span> · {patientSel.nom}
                </div>
                <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                  {[patientSel.sexe, ageActuel(patientSel) !== undefined ? `${ageActuel(patientSel)} ans` : "", patientSel.contact, patientSel.commune].filter(Boolean).join(" · ")}
                  {" · "}{consultations.filter((c) => c.codePatient === patientSel.code).length} visite(s) au dossier
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCarte({ p: patientSel, nouveau: false })} className="px-3 py-1.5 rounded border text-sm font-medium flex items-center gap-1.5">
                <IdCard className="w-4 h-4" /> Carte
              </button>
              <button type="button" onClick={oublierPatient} className="px-3 py-1.5 rounded border text-sm font-medium flex items-center gap-1.5">
                <X className="w-4 h-4" /> Autre patient
              </button>
            </div>
          </div>
        ) : (
          <div className={`rounded-lg border p-3 space-y-2 ${isDark ? "border-gray-700" : "border-emerald-200 bg-emerald-50/40"}`}>
            <label className="text-sm font-semibold flex items-center gap-2">
              <IdCard className="w-4 h-4 text-emerald-600" /> Patient déjà venu ? Tapez son code patient (ou son nom / téléphone)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  className="w-full pl-8 pr-3 py-2 rounded border bg-transparent font-mono uppercase placeholder:normal-case placeholder:font-sans"
                  placeholder="Ex : DG-7K3PM"
                  value={rechercheCode}
                  onChange={(e) => setRechercheCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && resultatsCode.length === 1) choisirPatient(resultatsCode[0]); }}
                />
              </div>
              <button type="button" onClick={() => setScanOuvert(true)} className="px-3 py-2 rounded border text-sm font-medium flex items-center gap-1.5" title="Scanner la carte patient">
                <ScanLine className="w-4 h-4" /> Scanner
              </button>
            </div>
            {rechercheCode.trim().length >= 2 && (
              resultatsCode.length === 0 ? (
                <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  {estUnCode(rechercheCode) ? `Aucun patient avec le code ${normaliserCode(rechercheCode)}.` : "Aucun patient trouvé."} S'il vient pour la première fois, remplissez le formulaire ci-dessous : un code lui sera attribué.
                </div>
              ) : (
                <div className="space-y-1">
                  {resultatsCode.map((p) => (
                    <button key={p.code} type="button" onClick={() => choisirPatient(p)}
                      className={`w-full text-left px-3 py-2 rounded border text-sm flex flex-wrap justify-between gap-2 ${isDark ? "border-gray-700 hover:bg-gray-700" : "border-gray-200 bg-white hover:bg-emerald-50"}`}>
                      <span><b className="font-mono">{p.code}</b> · {p.nom}</span>
                      <span className="text-xs text-gray-500">{[p.sexe, ageActuel(p) !== undefined ? `${ageActuel(p)} ans` : "", p.contact].filter(Boolean).join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Nom du patient *</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={patient}
              onChange={(e) => setPatient(e.target.value)}
              placeholder="Nom et prénoms"
              readOnly={!!patientSel}
              title={patientSel ? "Patient déjà enregistré : cliquez sur « Autre patient » pour en changer" : undefined}
            />
            {memeNom.length > 0 && (
              <div className="mt-1 rounded border border-amber-400 bg-amber-500/10 p-2 text-xs space-y-1">
                <div className="font-semibold text-amber-700">Déjà enregistré ? Choisissez-le pour ne pas créer de doublon :</div>
                {memeNom.map((p) => (
                  <button key={p.code} type="button" onClick={() => choisirPatient(p)} className="block underline text-left">
                    {p.code} · {p.nom}{p.contact ? ` · ${p.contact}` : ""}{ageActuel(p) !== undefined ? ` · ${ageActuel(p)} ans` : ""}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Contact</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Téléphone"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Âge</label>
            <input
              type="number"
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Sexe</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={sexe}
              onChange={(e) => setSexe(e.target.value as "Masculin" | "Féminin")}
            >
              <option value="Masculin">Masculin</option>
              <option value="Féminin">Féminin</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Commune / Village</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Mode de paiement</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={modePaiement}
              onChange={(e) => setModePaiement(e.target.value)}
            >
              <option value="Espèces">Espèces</option>
              <option value="Mobile Money">Mobile Money</option>
              <option value="Assurance">Assurance</option>
            </select>
          </div>
        </div>

        {recuFormulaire && (
          recuFormulaire.valide ? (
            <div className="rounded-lg border-2 border-emerald-500 bg-emerald-500/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-bold text-emerald-700">Reçu de consultation valable — ne pas refacturer la consultation</div>
                  <div>
                    {recuFormulaire.patient} a payé le {dateCourteFr(recuFormulaire.payeLe)} ({recuFormulaire.facture.total.toLocaleString("fr-FR")} FCFA).
                    Valable jusqu'au <b>{dateCourteFr(recuFormulaire.valableJusquau)}</b>
                    {recuFormulaire.joursRestants === 0 ? " (dernier jour)" : ` (encore ${recuFormulaire.joursRestants + 1} jour${recuFormulaire.joursRestants > 0 ? "s" : ""})`}.
                    {recuFormulaire.visitesGratuites.length > 0 && ` Déjà revenu(e) ${recuFormulaire.visitesGratuites.length} fois avec ce reçu.`}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleEnregistrerAvecRecu}
                  className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-medium flex items-center gap-1.5 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" /> Envoyer sans payer la consultation
                  {panierTotal(panierNouveau) > 0 ? ` (+ ${panierTotal(panierNouveau).toLocaleString("fr-FR")} FCFA d'autres actes)` : ""}
                </button>
              </div>
              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                Si le patient demande d'autres actes (pansement, examen…), ajoutez-les ci-dessous : ils seront encaissés à part. Ne mettez pas la consultation dans le panier.
              </p>
            </div>
          ) : (
            <div className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${isDark ? "border-gray-700" : "border-gray-200 bg-gray-50"}`}>
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <span>
                Dernier reçu de consultation de {recuFormulaire.patient} : payé le {dateCourteFr(recuFormulaire.payeLe)}, expiré depuis le {dateCourteFr(recuFormulaire.valableJusquau)}. La consultation est à payer.
              </span>
            </div>
          )
        )}

        <div>
          <label className="text-sm font-medium">Orienter le patient vers *</label>
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(
              [
                { value: "Infirmerie", label: "Infirmerie", sous: "Prise des constantes → consultation générale" },
                { value: "Maternite", label: "Maternité", sous: "CPN ou autre suivi de grossesse" },
                { value: "Laboratoire", label: "Laboratoire", sous: "Examen demandé directement" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setServiceDestination(opt.value)}
                className={`text-left px-3 py-2 rounded-lg border transition-all ${
                  serviceDestination === opt.value
                    ? "border-primary-500 bg-primary-50 text-primary-800 ring-1 ring-primary-500"
                    : isDark
                    ? "border-gray-700 hover:bg-gray-700"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-bold">{opt.label}</div>
                <div className={`text-xs ${serviceDestination === opt.value ? "text-primary-700" : "text-gray-500"}`}>
                  {opt.sous}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Actes à facturer *</label>
          <div className="mt-1">
            <SelecteurActes actes={actes} panier={panierNouveau} setPanier={setPanierNouveau} isDark={isDark} />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleEnregistrerEtEncaisser}
            className="px-4 py-2 rounded bg-emerald-600 text-white font-medium flex items-center gap-2 hover:bg-emerald-700"
          >
            <Wallet className="w-4 h-4" />
            Encaisser &amp; envoyer{" "}
            {serviceDestination === "Infirmerie"
              ? "à l'infirmerie"
              : serviceDestination === "Maternite"
              ? "à la maternité"
              : "au laboratoire"}
          </button>
        </div>
      </div>

      <div className={`rounded-lg border p-4 space-y-3 ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" /> Reçus de consultation valables ({recusValides.length})
            </h2>
            <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Un reçu de consultation reste valable {VALIDITE_RECU_JOURS} jours, jour du paiement compris. Ces patients ne repaient pas la consultation s'ils reviennent, en consultation ou sur rendez-vous.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className={`w-4 h-4 absolute left-2.5 top-2.5 ${isDark ? "text-gray-500" : "text-gray-400"}`} />
            <input className="w-full pl-8 pr-3 py-2 rounded border bg-transparent text-sm" placeholder="Chercher un patient" value={rechercheRecus} onChange={(e) => setRechercheRecus(e.target.value)} />
          </div>
        </div>
        {recusFiltres.length === 0 ? (
          <p className={`text-sm italic ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            {recusValides.length === 0 ? "Aucun reçu de consultation en cours de validité." : "Aucun patient ne correspond."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={`text-left text-xs uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  <th className="py-2 pr-3">Patient</th>
                  <th className="py-2 pr-3">Payé le</th>
                  <th className="py-2 pr-3">Valable jusqu'au</th>
                  <th className="py-2 pr-3">Retours</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {recusFiltres.map((r) => {
                  const ouvert = visiteRecuId === r.facture.id;
                  const dejaAujourdhui = consultations.some((c) => c.recuConsultationId === r.facture.id && c.date === today) || (r.payeLe === today);
                  return (
                    <React.Fragment key={r.facture.id}>
                      <tr className={`border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.patient}</div>
                          <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>{r.contact || "—"}</div>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">{dateCourteFr(r.payeLe)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className={r.joursRestants <= 1 ? "text-amber-600 font-semibold" : ""}>{dateCourteFr(r.valableJusquau)}</span>
                          <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                            {r.joursRestants === 0 ? "dernier jour" : `encore ${r.joursRestants + 1} j`}
                          </div>
                        </td>
                        <td className="py-2 pr-3">{r.visitesGratuites.length}</td>
                        <td className="py-2 text-right">
                          {dejaAujourdhui ? (
                            <span className="text-xs text-emerald-600 font-medium">Déjà vu aujourd'hui</span>
                          ) : (
                            <button
                              onClick={() => { setVisiteRecuId(ouvert ? null : r.facture.id); setVisiteDestination("Infirmerie"); }}
                              className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 whitespace-nowrap"
                            >
                              {ouvert ? "Annuler" : "Il/elle revient"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {ouvert && (
                        <tr>
                          <td colSpan={5} className="pb-3">
                            <div className={`rounded-lg p-3 space-y-2 ${isDark ? "bg-gray-900" : "bg-emerald-50"}`}>
                              <div className="text-sm font-medium">Envoyer {r.patient} sans payer la consultation vers :</div>
                              <div className="flex flex-wrap gap-2">
                                {(["Infirmerie", "Maternite", "Laboratoire"] as const).map((d) => (
                                  <button key={d} type="button" onClick={() => setVisiteDestination(d)}
                                    className={`px-3 py-1.5 rounded-full text-sm border ${visiteDestination === d ? "bg-emerald-600 text-white border-emerald-600" : isDark ? "border-gray-600" : "border-gray-300 bg-white"}`}>
                                    {d === "Maternite" ? "Maternité" : d}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => { creerVisiteAvecRecu(r, visiteDestination); setVisiteRecuId(null); }}
                                className="px-4 py-2 rounded bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 hover:bg-emerald-700"
                              >
                                <ArrowRight className="w-4 h-4" /> Envoyer (0 FCFA)
                              </button>
                              <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                                Pour facturer d'autres actes à ce patient, utilisez plutôt le formulaire « Nouveau patient » en tapant son nom.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        className={`rounded-lg border p-4 space-y-4 ${
          isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
        }`}
      >
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ReceiptText className="w-5 h-5" /> Facturer un acte à un patient déjà présent
          </h2>
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Pour un patient déjà enregistré aujourd'hui qui demande un acte supplémentaire en cours
            de service (certificat, pansement, injection, etc.), sans modifier son dossier clinique.
          </p>
        </div>

        <div>
          <label className="text-sm font-medium">Patient</label>
          <input
            className="w-full mt-1 mb-1 px-3 py-1.5 text-sm rounded border bg-transparent"
            placeholder="Rechercher un patient présent aujourd'hui"
            value={rechercheExistant}
            onChange={(e) => setRechercheExistant(e.target.value)}
          />
          <select
            className="w-full px-3 py-2 rounded border bg-transparent"
            value={patientExistantId}
            onChange={(e) => setPatientExistantId(e.target.value)}
          >
            <option value="">— Choisir le patient —</option>
            {patientsPresents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.patient} — {c.statut}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Mode de paiement</label>
          <select
            className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
            value={modePaiementExistant}
            onChange={(e) => setModePaiementExistant(e.target.value)}
          >
            <option value="Espèces">Espèces</option>
            <option value="Mobile Money">Mobile Money</option>
            <option value="Assurance">Assurance</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">Actes demandés</label>
          <div className="mt-1">
            <SelecteurActes actes={actes} panier={panierExistant} setPanier={setPanierExistant} isDark={isDark} />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleEncaisserActesExistant}
            className="px-4 py-2 rounded bg-blue-600 text-white font-medium flex items-center gap-2 hover:bg-blue-700"
          >
            <Wallet className="w-4 h-4" /> Encaisser ces actes
          </button>
        </div>

        {facturesActesAujourdhui.length > 0 && (
          <div className="pt-2 border-t">
            <h3 className="text-xs font-semibold uppercase tracking-wide mb-1">Actes facturés aujourd'hui</h3>
            <div className="space-y-1">
              {facturesActesAujourdhui.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm">
                  <span>{f.patient}</span>
                  <span className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    {f.lignes.map((l) => l.designation).join(", ")}
                  </span>
                  <span className="font-medium">{f.total.toLocaleString("fr-FR")} FCFA</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4" /> En attente (aujourd'hui)
        </h3>
        {dejaEnvoyesAujourdhui.length === 0 ? (
          <p className={`text-sm ${isDark ? "text-gray-500" : "text-gray-400"}`}>
            Aucun patient envoyé pour l'instant aujourd'hui.
          </p>
        ) : (
          <div className="space-y-2">
            {dejaEnvoyesAujourdhui.map((c) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-3 py-2 rounded border ${
                  isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-gray-50"
                }`}
              >
                <span className="font-medium">{c.patient}</span>
                <span className="text-xs flex items-center gap-1 text-emerald-500">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {c.statut}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {carte && <CartePatient patient={carte.p} nouveau={carte.nouveau} onClose={() => setCarte(null)} />}
      {scanOuvert && <BarcodeScanner onScan={apresScan} onClose={() => setScanOuvert(false)} theme={theme} />}
    </div>
  );
}
