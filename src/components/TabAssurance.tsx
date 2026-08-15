/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { PriseEnCharge, Facture, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { 
  Plus, Trash2, CheckCircle, HelpCircle, Shield, FileText, Search,
  Users, Building, CreditCard, Percent, Clock, Phone, AlertTriangle, ArrowRight
} from "lucide-react";

interface TabAssuranceProps {
  prisesEnCharge: PriseEnCharge[];
  factures: Facture[];
  staff: Staff[];
  assureurs: any[];
  assures: any[];
  onUpdatePrisesEnCharge: (p: PriseEnCharge[]) => void;
  onUpdateFactures: (f: Facture[]) => void;
  onUpdateAssureurs: (a: any[]) => void;
  onUpdateAssures: (as: any[]) => void;
}

export default function TabAssurance({
  prisesEnCharge,
  factures,
  staff,
  assureurs,
  assures,
  onUpdatePrisesEnCharge,
  onUpdateFactures,
  onUpdateAssureurs,
  onUpdateAssures
}: TabAssuranceProps) {
  // Navigation tabs
  const [activeSubTab, setActiveSubTab] = useState<"pec" | "adhesions" | "compagnies">("pec");

  // PEC Claim Form states
  const [pecFactureId, setPecFactureId] = useState("");
  const [pecAssureur, setPecAssureur] = useState("");
  const [pecTaux, setPecTaux] = useState("80");
  const [pecNumBillet, setPecNumBillet] = useState("");
  const [pecStatut, setPecStatut] = useState<"Accordé" | "Refusé" | "En attente">("En attente");
  const [pecNotes, setPecNotes] = useState("");

  // Patient Adhesion Form states
  const [adhPatient, setAdhPatient] = useState("");
  const [adhAssureurId, setAdhAssureurId] = useState("");
  const [adhNumero, setAdhNumero] = useState("");
  const [adhTaux, setAdhTaux] = useState("80");
  const [adhDateAdhesion, setAdhDateAdhesion] = useState(getTodayStr());
  const [adhDateExpiration, setAdhDateExpiration] = useState(() => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    return nextYear.toISOString().slice(0, 10);
  });

  // Partner Insurer Form states
  const [insNom, setInsNom] = useState("");
  const [insType, setInsType] = useState("Assurance privée");
  const [insContact, setInsContact] = useState("");
  const [insTaux, setInsTaux] = useState("80");
  const [insDelai, setInsDelai] = useState("30");

  const [searchQuery, setSearchQuery] = useState("");

  // Default fallback lists if parent state is somehow empty
  const localAssureurs = assureurs && assureurs.length > 0 ? assureurs : [
    { id: "ass-1", nom: "CNAMU (Burkina Faso)", type: "Régime public (CNAMU/RAMU)", contact: "+226 25 30 10 20", taux: 80, delai: 30 },
    { id: "ass-2", nom: "UAB Assurance", type: "Assurance privée", contact: "+226 25 31 15 15", taux: 70, delai: 45 },
    { id: "ass-3", nom: "Mutuelle de la Santé Bobo", type: "Mutuelle", contact: "+226 20 97 12 34", taux: 90, delai: 15 }
  ];

  // Set initial default insurer when companies list is available
  useEffect(() => {
    if (localAssureurs.length > 0 && !pecAssureur) {
      setPecAssureur(localAssureurs[0].nom);
    }
  }, [localAssureurs]);

  // AUTO-DETECT ADHESION WHEN SELECTING AN INVOICE!
  useEffect(() => {
    if (!pecFactureId) return;
    const linkedInvoice = factures.find((f) => f.id === pecFactureId);
    if (!linkedInvoice) return;

    // Search for a matching patient membership (case-insensitive check)
    const matchingAdh = (assures || []).find(
      (a) => a.patient.toLowerCase().trim() === linkedInvoice.patient.toLowerCase().trim()
    );

    if (matchingAdh) {
      const insurer = localAssureurs.find((c) => c.id === matchingAdh.assureurId);
      if (insurer) {
        setPecAssureur(insurer.nom);
        setPecTaux(String(matchingAdh.taux || insurer.taux || 80));
        setPecNumBillet(matchingAdh.numero || "");
        setPecNotes(`✨ Carte d'assuré détectée automatiquement : N° ${matchingAdh.numero}`);
      }
    } else {
      // Clear auto-filled details if no membership found
      setPecNumBillet("");
      setPecNotes("");
      if (localAssureurs.length > 0) {
        setPecAssureur(localAssureurs[0].nom);
        setPecTaux(String(localAssureurs[0].taux || 80));
      }
    }
  }, [pecFactureId, assures, factures]);

  // Actions for PEC Tracking
  const handleAddClaim = () => {
    if (!pecFactureId || !pecNumBillet.trim()) {
      alert("Veuillez sélectionner une facture et renseigner le numéro de prise en charge (PEC).");
      return;
    }

    const linkedInvoice = factures.find((f) => f.id === pecFactureId);
    if (!linkedInvoice) {
      alert("La facture sélectionnée est introuvable.");
      return;
    }

    const t = parseFloat(pecTaux) || 80;
    const montAssurance = (linkedInvoice.total * t) / 100;
    const montPatient = linkedInvoice.total - montAssurance;

    const newPec: PriseEnCharge = {
      id: generateUid(),
      factureId: pecFactureId,
      patient: linkedInvoice.patient,
      assureur: pecAssureur,
      assureurId: localAssureurs.find(a => a.nom === pecAssureur)?.id || "ass-custom",
      numeroDossier: pecNumBillet.trim(),
      numeroPriseEnCharge: pecNumBillet.trim(),
      dateSoins: linkedInvoice.date,
      montantTotal: linkedInvoice.total,
      taux: t,
      tauxCouverture: t,
      montantCouvert: montAssurance,
      montantAssurance: montAssurance,
      montantRestant: montPatient,
      montantPatient: montPatient,
      motif: linkedInvoice.lignes.map(l => l.designation).join(", ") || "Soins cliniques",
      statut: pecStatut,
      notes: pecNotes.trim(),
      createdAt: new Date().toISOString()
    };

    onUpdatePrisesEnCharge([newPec, ...prisesEnCharge]);

    // Update corresponding invoice payment and mode if Approved
    if (pecStatut === "Accordé") {
      const updatedFactures = factures.map((f) => {
        if (f.id === pecFactureId) {
          return {
            ...f,
            mode: `Assurance (${pecAssureur} ${t}%)`,
            montantPaye: montAssurance,
            statut: montPatient === 0 ? ("Payée" as const) : ("Partielle" as const)
          };
        }
        return f;
      });
      onUpdateFactures(updatedFactures);
    }

    setPecFactureId("");
    setPecNumBillet("");
    setPecNotes("");
    alert("Dossier de prise en charge d'assurance enregistré.");
  };

  const handleUpdateStatut = (id: string, statut: PriseEnCharge["statut"]) => {
    const updated = prisesEnCharge.map((p) => {
      if (p.id === id) {
        const linkedInvoice = factures.find((f) => f.id === p.factureId);
        const effectiveAssureur = p.assureur || (p.assureurId === "ass-1" ? "CNAMU" : p.assureurId === "ass-2" ? "UAB" : "Assurance");
        const effectiveTaux = p.tauxCouverture !== undefined ? p.tauxCouverture : p.taux || 0;
        const effectiveAssuranceAmt = p.montantAssurance !== undefined ? p.montantAssurance : p.montantCouvert || 0;
        const effectivePatientAmt = p.montantPatient !== undefined ? p.montantPatient : p.montantRestant || 0;

        if (linkedInvoice && statut === "Accordé" && p.statut !== "Accordé") {
          // Sync invoice status and payments
          const updatedFactures = factures.map((f) => {
            if (f.id === p.factureId) {
              return {
                ...f,
                mode: `Assurance (${effectiveAssureur} ${effectiveTaux}%)`,
                montantPaye: effectiveAssuranceAmt,
                statut: effectivePatientAmt === 0 ? ("Payée" as const) : ("Partielle" as const)
              };
            }
            return f;
          });
          onUpdateFactures(updatedFactures);
        }
        return { ...p, statut };
      }
      return p;
    });

    onUpdatePrisesEnCharge(updated);
    alert("Statut de la prise en charge mis à jour avec succès.");
  };

  const handleDeleteClaim = (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer ce dossier d'assurance ?")) {
      onUpdatePrisesEnCharge(prisesEnCharge.filter((p) => p.id !== id));
    }
  };

  // Actions for Patient Adhesions
  const handleAddAdhesion = () => {
    if (!adhPatient.trim() || !adhAssureurId || !adhNumero.trim()) {
      alert("Veuillez renseigner le nom du patient, sélectionner une mutuelle et saisir le numéro de carte.");
      return;
    }

    const t = parseFloat(adhTaux) || 80;
    const newAdh = {
      id: generateUid(),
      patient: adhPatient.trim(),
      assureurId: adhAssureurId,
      numero: adhNumero.trim(),
      taux: t,
      dateAdhesion: adhDateAdhesion,
      dateExpiration: adhDateExpiration,
      createdAt: new Date().toISOString()
    };

    onUpdateAssures([newAdh, ...assures]);
    setAdhPatient("");
    setAdhNumero("");
    alert(`Carte d'assuré enregistrée avec succès pour ${newAdh.patient}.`);
  };

  const handleDeleteAdhesion = (id: string) => {
    if (confirm("Révoquer l'adhésion de ce patient ?")) {
      onUpdateAssures(assures.filter((a) => a.id !== id));
    }
  };

  // Actions for Partner Insurers
  const handleAddInsurer = () => {
    if (!insNom.trim()) {
      alert("Veuillez renseigner le nom de la compagnie d'assurance.");
      return;
    }

    const newIns = {
      id: "ass-" + generateUid().slice(0, 4),
      nom: insNom.trim(),
      type: insType,
      contact: insContact.trim() || "N/A",
      taux: parseFloat(insTaux) || 80,
      delai: parseFloat(insDelai) || 30,
      createdAt: new Date().toISOString()
    };

    onUpdateAssureurs([...localAssureurs, newIns]);
    setInsNom("");
    setInsContact("");
    alert(`Compagnie d'assurance "${newIns.nom}" ajoutée aux partenaires.`);
  };

  const handleDeleteInsurer = (id: string) => {
    if (confirm("Supprimer cette convention d'assurance ? Les dossiers liés pourraient être affectés.")) {
      onUpdateAssureurs(localAssureurs.filter((a) => a.id !== id));
    }
  };

  // Calculations for KPI Cards
  const claimsPending = prisesEnCharge.filter((p) => p.statut === "En attente" || p.statut === "Soumis" || p.statut === "En cours de traitement");
  const claimsApproved = prisesEnCharge.filter((p) => p.statut === "Accordé" || p.statut === "Approuvé" || p.statut === "Remboursé");
  const claimsTotalAssurance = claimsApproved.reduce((s, p) => s + (p.montantAssurance !== undefined ? p.montantAssurance : p.montantCouvert || 0), 0);
  const claimsTotalPatient = claimsApproved.reduce((s, p) => s + (p.montantPatient !== undefined ? p.montantPatient : p.montantRestant || 0), 0);

  return (
    <div className="space-y-6">
      {/* Tab Header & Quick Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div>
          <h1 className="text-2xl font-serif font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary-600" />
            Espace Assurances & Tiers-Payant
          </h1>
          <p className="text-xs text-stone-500 font-medium mt-1">
            Gérez les conventions de mutuelles, enregistrez les cartes d'adhérents et suivez les demandes d'accords et remboursements.
          </p>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex bg-stone-100 p-1 rounded-xl self-start border border-stone-200">
          <button
            onClick={() => { setActiveSubTab("pec"); setSearchQuery(""); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "pec" 
                ? "bg-white text-primary-800 shadow-2xs font-semibold" 
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Suivi des PEC
          </button>
          <button
            onClick={() => { setActiveSubTab("adhesions"); setSearchQuery(""); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "adhesions" 
                ? "bg-white text-primary-800 shadow-2xs font-semibold" 
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Adhérents & Cartes
          </button>
          <button
            onClick={() => { setActiveSubTab("compagnies"); setSearchQuery(""); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === "compagnies" 
                ? "bg-white text-primary-800 shadow-2xs font-semibold" 
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            Compagnies
          </button>
        </div>
      </div>

      {/* KPI Cards (Always visible as they provide beautiful context) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs border-t-4 border-t-primary-600">
          <div className="text-2xl font-semibold text-primary-700 font-serif">{prisesEnCharge.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Dossiers créés</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Demandes de prise en charge</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs border-t-4 border-t-warning-500">
          <div className="text-2xl font-semibold text-warning-600 font-serif">{claimsPending.length}</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">PEC en attente</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">En attente d'accord écrit</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs border-t-4 border-t-success-600">
          <div className="text-xl font-semibold text-success-700 font-serif">{claimsTotalAssurance.toLocaleString("fr-FR")} F</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Part due Assureurs</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Tiers-payant à recouvrer</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs border-t-4 border-t-blue-600">
          <div className="text-xl font-semibold text-blue-700 font-serif">{claimsTotalPatient.toLocaleString("fr-FR")} F</div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mt-1">Tickets modérateurs</div>
          <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-sans">Reste à charge payé / patient</div>
        </div>
      </div>

      {claimsPending.length > 0 && activeSubTab === "pec" && (
        <div className="bg-warning-50/70 border border-warning-200 rounded-xl p-4 flex items-center gap-3 text-warning-800 text-xs font-semibold shadow-3xs">
          <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0 animate-pulse" />
          <div>
            <strong>Dossiers d'Assurance en attente :</strong> Il y a actuellement {claimsPending.length} dossier(s) en attente de visa ou de validation pour déclencher le remboursement tiers-payant.
          </div>
        </div>
      )}

      {/* SUB-TAB 1: SUIVI DES PRISES EN CHARGE */}
      {activeSubTab === "pec" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create PEC Form */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4">
            <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-700" />
              Saisir un Bon de Garantie / Accord (PEC)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Associer une Facture Patient *</label>
                <select
                  value={pecFactureId}
                  onChange={(e) => setPecFactureId(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-medium"
                >
                  <option value="">— Sélectionner la facture —</option>
                  {factures.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.patient} — ({f.total.toLocaleString("fr-FR")} F, émise le {new Date(f.date).toLocaleDateString("fr-FR")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Compagnie d'Assurance</label>
                  <select
                    value={pecAssureur}
                    onChange={(e) => setPecAssureur(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    {localAssureurs.map((a) => (
                      <option key={a.id} value={a.nom}>{a.nom}</option>
                    ))}
                    {localAssureurs.every(a => a.nom !== "ASCOMA") && <option value="ASCOMA">ASCOMA</option>}
                    {localAssureurs.every(a => a.nom !== "AXA") && <option value="AXA">AXA Assurances</option>}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Taux Prise en charge (%)</label>
                  <select
                    value={pecTaux}
                    onChange={(e) => setPecTaux(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                  >
                    <option value="100">100% (Gratuité totale)</option>
                    <option value="90">90%</option>
                    <option value="80">80%</option>
                    <option value="70">70%</option>
                    <option value="50">50%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Numéro du Billet / Bon d'Accord *</label>
                <input
                  type="text"
                  placeholder="Ex: BON-PEC-ASCOMA-9910"
                  value={pecNumBillet}
                  onChange={(e) => setPecNumBillet(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Statut Initial de l'Accord</label>
                <select
                  value={pecStatut}
                  onChange={(e) => setPecStatut(e.target.value as any)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="En attente">🟡 En attente de signature</option>
                  <option value="Accordé">🟢 Accord officiel signé</option>
                  <option value="Refusé">🔴 Refus de couverture</option>
                </select>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Notes explicatives</label>
                <input
                  type="text"
                  placeholder="Ex: Lettre de garantie n°44..."
                  value={pecNotes}
                  onChange={(e) => setPecNotes(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleAddClaim}
                className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2 cursor-pointer shadow-3xs"
              >
                Soumettre le dossier tiers-payant
              </button>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
            <div className="border-b border-stone-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-700" />
                Registre Général de Tiers-Payant
              </h3>

              <div className="relative w-full md:w-56">
                <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Chercher par patient, assureur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {prisesEnCharge.length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun claim d'assurance enregistré.</p>
            ) : (
              <div className="overflow-x-auto max-h-[450px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-500 font-bold border-b border-stone-200 text-xs uppercase tracking-wider">
                      <th className="p-3">Numéro PEC</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Assureur</th>
                      <th className="p-3 text-center">Taux</th>
                      <th className="p-3 text-right">Part Assureur</th>
                      <th className="p-3 text-right">Ticket Modérateur</th>
                      <th className="p-3 text-center">Statut</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {prisesEnCharge
                      .filter((p) => {
                        const f = factures.find(fact => fact.id === p.factureId);
                        const patName = p.patient || (f ? f.patient : "Inconnu");
                        const insName = p.assureur || (p.assureurId === "ass-1" ? "CNAMU" : p.assureurId === "ass-2" ? "UAB" : p.assureurId === "ass-3" ? "Mutuelle de Bobo" : "Assurance");
                        return patName.toLowerCase().includes(searchQuery.toLowerCase()) || insName.toLowerCase().includes(searchQuery.toLowerCase());
                      })
                      .map((p) => {
                        const f = factures.find((fact) => fact.id === p.factureId);
                        const patientName = p.patient || (f ? f.patient : "Inconnu");
                        const insurerName = p.assureur || (p.assureurId === "ass-1" ? "CNAMU (Burkina Faso)" : p.assureurId === "ass-2" ? "UAB Assurance" : p.assureurId === "ass-3" ? "Mutuelle de la Santé Bobo" : "Assurance");
                        const coverageRate = p.tauxCouverture !== undefined ? p.tauxCouverture : p.taux || 0;
                        const insurerAmt = p.montantAssurance !== undefined ? p.montantAssurance : p.montantCouvert || 0;
                        const patientAmt = p.montantPatient !== undefined ? p.montantPatient : p.montantRestant || 0;
                        const trackingNum = p.numeroPriseEnCharge || p.numeroDossier || "N/A";

                        return (
                          <tr key={p.id} className="hover:bg-stone-50/50">
                            <td className="p-3 font-mono font-bold text-primary-800">{trackingNum}</td>
                            <td className="p-3 font-bold text-stone-800">{patientName}</td>
                            <td className="p-3 text-stone-600 font-semibold">{insurerName}</td>
                            <td className="p-3 text-center font-mono font-bold text-success-700">{coverageRate}%</td>
                            <td className="p-3 text-right font-mono font-bold text-stone-900">{insurerAmt.toLocaleString("fr-FR")} F</td>
                            <td className="p-3 text-right font-mono font-bold text-stone-500">{patientAmt.toLocaleString("fr-FR")} F</td>
                            <td className="p-3 text-center">
                              <select
                                value={p.statut}
                                onChange={(e) => handleUpdateStatut(p.id, e.target.value as any)}
                                className={`border border-stone-200 rounded-lg p-1 bg-white font-bold text-xs focus:outline-none ${
                                  p.statut === "Accordé" || p.statut === "Approuvé" || p.statut === "Remboursé"
                                    ? "text-success-700 bg-success-50" 
                                    : p.statut === "Refusé" || p.statut === "Rejeté"
                                      ? "text-danger-700 bg-danger-50"
                                      : "text-warning-700 bg-warning-50"
                                }`}
                              >
                                <option value="En attente">🟡 En attente</option>
                                <option value="Soumis">🔵 Soumis</option>
                                <option value="Accordé">🟢 Accordé</option>
                                <option value="Refusé">🔴 Refusé</option>
                              </select>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteClaim(p.id)}
                                className="text-stone-300 hover:text-danger-600 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
      )}

      {/* SUB-TAB 2: CARTES D'ASSURÉS & ADHÉSIONS */}
      {activeSubTab === "adhesions" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Adhesion Form */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4">
            <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary-700" />
              Saisir une Carte d'Assuré / Adhésion
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom Complet du Patient *</label>
                <input
                  type="text"
                  placeholder="Ex: Traoré Alizèta"
                  value={adhPatient}
                  onChange={(e) => setAdhPatient(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
                />
                <span className="text-xs text-stone-500 dark:text-stone-400 mt-1 block">Renseignez exactement le nom utilisé sur les factures.</span>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Compagnie d'Assurance Partenaire *</label>
                <select
                  value={adhAssureurId}
                  onChange={(e) => setAdhAssureurId(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="">— Sélectionner l'assureur —</option>
                  {localAssureurs.map((a) => (
                    <option key={a.id} value={a.id}>🛡️ {a.nom} ({a.taux}%)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Numéro d'Affiliation *</label>
                  <input
                    type="text"
                    placeholder="Ex: CN-99120-X"
                    value={adhNumero}
                    onChange={(e) => setAdhNumero(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Taux Mutuelle (%)</label>
                  <select
                    value={adhTaux}
                    onChange={(e) => setAdhTaux(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white"
                  >
                    <option value="100">100%</option>
                    <option value="90">90%</option>
                    <option value="80">80%</option>
                    <option value="70">70%</option>
                    <option value="50">50%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date d'Adhésion</label>
                  <input
                    type="date"
                    value={adhDateAdhesion}
                    onChange={(e) => setAdhDateAdhesion(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Date d'Expiration</label>
                  <input
                    type="date"
                    value={adhDateExpiration}
                    onChange={(e) => setAdhDateExpiration(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-stone-50"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddAdhesion}
                className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2 cursor-pointer shadow-3xs"
              >
                Inscrire la carte de l'assuré
              </button>
            </div>
          </div>

          {/* Members list */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-2 space-y-4">
            <div className="border-b border-stone-100 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-700" />
                Liste des Assurés & Mutuelles Actives
              </h3>

              <div className="relative w-full md:w-56">
                <Search className="w-4 h-4 text-stone-500 dark:text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Rechercher par assuré..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {(assures || []).length === 0 ? (
              <p className="text-xs text-stone-500 dark:text-stone-400 py-12 text-center italic">Aucun patient assuré inscrit.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200 text-xs uppercase tracking-wider">
                      <th className="p-3">Patient / Titulaire</th>
                      <th className="p-3">Compagnie / Organisme</th>
                      <th className="p-3">N° Carte d'Assuré</th>
                      <th className="p-3 text-center">Taux Couverture</th>
                      <th className="p-3">Fin de validité</th>
                      <th className="p-3 text-center">Statut</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {(assures || [])
                      .filter((a) => a.patient.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((a) => {
                        const insurer = localAssureurs.find((c) => c.id === a.assureurId);
                        const isExpired = new Date(a.dateExpiration) < new Date();

                        return (
                          <tr key={a.id} className="hover:bg-stone-50/50">
                            <td className="p-3 font-bold text-stone-800">{a.patient}</td>
                            <td className="p-3 text-stone-600 font-semibold">{insurer ? insurer.nom : "Autre assureur"}</td>
                            <td className="p-3 font-mono font-bold text-primary-800">{a.numero}</td>
                            <td className="p-3 text-center font-mono font-bold text-success-700">{a.taux}%</td>
                            <td className="p-3 text-stone-500 font-medium">{new Date(a.dateExpiration).toLocaleDateString("fr-FR")}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-2xs font-black uppercase ${
                                isExpired ? "bg-danger-50 text-danger-700" : "bg-success-50 text-success-700"
                              }`}>
                                {isExpired ? "Expirée" : "Active"}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteAdhesion(a.id)}
                                className="text-stone-300 hover:text-danger-600 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
      )}

      {/* SUB-TAB 3: COMPAGNIES D'ASSURANCES */}
      {activeSubTab === "compagnies" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Insurer Form */}
          <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs lg:col-span-1 self-start space-y-4">
            <h3 className="text-base font-serif font-bold text-stone-900 border-b border-stone-100 pb-3 flex items-center gap-2">
              <Building className="w-5 h-5 text-primary-700" />
              Saisir une Nouvelle Compagnie / Mutuelle
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Nom de l'Organisme *</label>
                <input
                  type="text"
                  placeholder="Ex: ASCOMA Burkina"
                  value={insNom}
                  onChange={(e) => setInsNom(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Catégorie / Type de contrat</label>
                <select
                  value={insType}
                  onChange={(e) => setInsType(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                >
                  <option value="Assurance privée">🛡️ Assurance commerciale privée</option>
                  <option value="Régime public (CNAMU/RAMU)">🏛️ Régime public (CNAMU/RAMU)</option>
                  <option value="Mutuelle">🤝 Mutuelle de Santé</option>
                  <option value="Autre">📦 Autre convention</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Taux Par Défaut (%)</label>
                  <select
                    value={insTaux}
                    onChange={(e) => setInsTaux(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-2 py-2 bg-stone-50 focus:bg-white"
                  >
                    <option value="100">100%</option>
                    <option value="90">90%</option>
                    <option value="80">80%</option>
                    <option value="70">70%</option>
                    <option value="50">50%</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Délai Paiement (Jours)</label>
                  <input
                    type="number"
                    placeholder="Ex: 30"
                    value={insDelai}
                    onChange={(e) => setInsDelai(e.target.value)}
                    className="w-full text-xs border border-stone-200 rounded-lg px-3 py-1.5 bg-stone-50 focus:bg-white font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1">Contact administratif / Tél</label>
                <input
                  type="text"
                  placeholder="Ex: +226 25 30 00 00"
                  value={insContact}
                  onChange={(e) => setInsContact(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleAddInsurer}
                className="w-full text-xs font-bold py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all mt-2 cursor-pointer shadow-3xs"
              >
                Enregistrer la convention partenaire
              </button>
            </div>
          </div>

          {/* Insurer Grid */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-primary-700" />
                Compagnies & Mutuelles Conventionnées
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localAssureurs.map((a) => (
                <div key={a.id} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs relative flex flex-col justify-between hover:shadow-2xs transition-all">
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="p-2 bg-stone-50 rounded-lg border border-stone-100">
                        <Shield className="w-6 h-6 text-primary-600" />
                      </div>
                      <span className="px-2 py-0.5 rounded-lg text-2xs font-black uppercase bg-stone-100 text-stone-600 font-sans">
                        {a.type.split(" ")[0]}
                      </span>
                    </div>

                    <h4 className="text-sm font-serif font-bold text-stone-900 mt-3">{a.nom}</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-medium">{a.type}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-stone-100 text-sm">
                      <div className="flex items-center gap-1.5 text-stone-600">
                        <Percent className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                        <div>
                          <span className="font-bold text-stone-900">{a.taux}%</span>
                          <span className="text-2xs text-stone-500 dark:text-stone-400 block">Couverture</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-stone-600">
                        <Clock className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                        <div>
                          <span className="font-bold text-stone-900">{a.delai}j</span>
                          <span className="text-2xs text-stone-500 dark:text-stone-400 block">Délai remboursement</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-stone-50 text-sm text-stone-500">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                      <span className="font-semibold">{a.contact}</span>
                    </div>
                    {a.id !== "ass-1" && a.id !== "ass-2" && a.id !== "ass-3" && (
                      <button
                        type="button"
                        onClick={() => handleDeleteInsurer(a.id)}
                        className="text-stone-300 hover:text-danger-600 transition-all cursor-pointer"
                        title="Supprimer la compagnie"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
