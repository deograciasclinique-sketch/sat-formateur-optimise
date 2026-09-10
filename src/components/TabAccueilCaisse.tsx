/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Consultation, Facture, FactureLigne, ActeTarifaire } from "../types";
import { generateUid, getTodayStr } from "../data";
import { Plus, UserPlus, Wallet, ArrowRight, Clock, CheckCircle2, Trash2, ReceiptText, Search } from "lucide-react";

interface TabAccueilCaisseProps {
  consultations: Consultation[];
  onUpdateConsultations: (consults: Consultation[]) => void;
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
// du catalogue). Une fois payé, le dossier est envoyé à l'infirmier (statut
// "Attente prise en charge infirmier"). Le reste du dossier (constantes,
// diagnostic, prescription) est complété plus loin dans le circuit par
// l'infirmier puis le médecin.
//
// La secrétaire peut aussi, à tout moment, facturer un acte supplémentaire à
// un patient déjà présent dans le service (ex: certificat, pansement,
// injection demandés en cours de journée), sans perturber son dossier
// clinique en cours.
export default function TabAccueilCaisse({
  consultations,
  onUpdateConsultations,
  factures,
  onUpdateFactures,
  actes = [],
  theme = "light",
}: TabAccueilCaisseProps) {
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

  const resetForm = () => {
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

    const statutParDestination: Record<typeof serviceDestination, Consultation["statut"]> = {
      Infirmerie: "Attente prise en charge infirmier",
      Maternite: "Attente prise en charge maternité",
      Laboratoire: "Attente prise en charge laboratoire",
    };

    const newCons: Consultation = {
      id: generateUid(),
      patient: patient.trim(),
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
          acte du catalogue). Le dossier est envoyé à l'infirmier une fois le paiement encaissé.
        </p>
      </div>

      <div
        className={`rounded-lg border p-4 space-y-4 ${
          isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Nom du patient *</label>
            <input
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent"
              value={patient}
              onChange={(e) => setPatient(e.target.value)}
              placeholder="Nom et prénoms"
            />
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
            <Wallet className="w-4 h-4" /> Encaisser & envoyer à l'infirmier
          </button>
        </div>
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
    </div>
  );
}
