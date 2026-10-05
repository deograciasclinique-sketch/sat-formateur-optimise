/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Planification familiale — Registre des demandes de retrait de méthode
 * contraceptive (implant, DIU, etc.).
 *
 * Les demandes sont synchronisées en temps réel entre tous les appareils
 * (clé cloud "dg_pf_retraits"), pour qu'une demande enregistrée par un agent
 * puisse être reprise et réalisée par un collègue.
 */

import React, { useMemo, useState } from "react";
import { FichePlanifFamiliale, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import { Plus, Search, Printer, Trash2, X, CheckCircle, Clock, Undo2, Share2, Pencil } from "lucide-react";

export interface DemandeRetraitPF {
  id: string;
  numero: string;
  dateDemande: string;
  ficheId?: string; // fiche PF d'origine, si la méthode a été posée ici
  nomPatiente: string;
  prenomPatiente: string;
  age?: number;
  contact?: string;
  adresse?: string;
  methode: string;
  dateInsertion?: string;
  lieuInsertion: "Ce centre" | "Autre structure";
  structureInsertion?: string;
  motif: string;
  motifPrecision?: string;
  counselingEffectue: boolean;
  statut: StatutRetrait;
  dateRetrait?: string;
  methodeRelais?: string;
  incidents?: string;
  structureReference?: string;
  agentId?: string;
  agentNom?: string;
  observations?: string;
  createdAt: string;
  updatedAt?: string;
}

type StatutRetrait = "En attente" | "Retrait effectué" | "Référée" | "Méthode conservée";

export const METHODES_RETRAIT = [
  "Implants (Jadelle)",
  "Implants (Implanon)",
  "DIU au Cuivre",
  "DIU hormonal (SIU-LNG)",
  "Autre",
];

const MOTIFS_RETRAIT = [
  "Désir de grossesse",
  "Méthode arrivée à expiration",
  "Saignements irréguliers / abondants",
  "Aménorrhée mal vécue",
  "Céphalées",
  "Prise ou perte de poids",
  "Douleurs (bras, bas-ventre)",
  "Infection au site / infection pelvienne",
  "Changement de méthode",
  "Opposition du conjoint ou de la famille",
  "Raisons personnelles / sans motif précisé",
  "Autre motif",
];

const METHODES_RELAIS = [
  "Aucune",
  "Nouvel implant (Jadelle)",
  "Nouvel implant (Implanon)",
  "DIU au Cuivre",
  "Injectable Trimestriel (DMPA)",
  "Pilule combinée (COC)",
  "Pilule progestative seule (POP)",
  "Préservatifs & Méthodes Barrières",
  "MAMA (allaitement)",
  "Méthodes naturelles",
];

const STATUTS: { key: StatutRetrait; label: string; cls: string }[] = [
  { key: "En attente", label: "En attente", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  { key: "Retrait effectué", label: "Retrait effectué", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  { key: "Référée", label: "Référée", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" },
  { key: "Méthode conservée", label: "Méthode conservée", cls: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300" },
];

const inputCls =
  "w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2 text-stone-900 dark:text-white focus:outline-none text-xs";
const labelCls = "text-stone-500 dark:text-stone-400 block mb-1";

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR");
}

function dureePortage(debut?: string, fin?: string) {
  if (!debut) return "";
  const a = new Date(debut + "T00:00:00").getTime();
  const b = new Date((fin || getTodayStr()) + "T00:00:00").getTime();
  if (isNaN(a) || isNaN(b) || b < a) return "";
  const mois = Math.round((b - a) / (1000 * 60 * 60 * 24 * 30.44));
  if (mois < 1) return "moins d'un mois";
  if (mois < 12) return `${mois} mois`;
  const ans = Math.floor(mois / 12), reste = mois % 12;
  return `${ans} an${ans > 1 ? "s" : ""}${reste ? ` ${reste} mois` : ""}`;
}

function nomComplet(d: DemandeRetraitPF) {
  return `${d.prenomPatiente} ${d.nomPatiente}`.trim();
}

interface Props {
  staff: Staff[];
  currentUser?: Staff | null;
  planifs: FichePlanifFamiliale[];
  onFicheRetiree: (ficheId: string) => void;
  clinicName: string;
}

export default function RetraitsContraception({ staff, currentUser, planifs, onFicheRetiree, clinicName }: Props) {
  const [demandes, setDemandes] = useCloudSyncedState<DemandeRetraitPF[]>("dg_pf_retraits", []);
  const [editing, setEditing] = useState<Partial<DemandeRetraitPF> | null>(null);
  const [filtre, setFiltre] = useState<StatutRetrait | "Tous">("Tous");
  const [search, setSearch] = useState("");
  const [mois, setMois] = useState(getTodayStr().slice(0, 7));

  const liste = useMemo(
    () =>
      demandes
        .filter((d) => filtre === "Tous" || d.statut === filtre)
        .filter((d) => {
          const q = search.toLowerCase();
          return !q || nomComplet(d).toLowerCase().includes(q) || (d.contact || "").includes(q) || d.numero.toLowerCase().includes(q);
        })
        .sort((a, b) => (b.dateDemande || "").localeCompare(a.dateDemande || "") || b.createdAt.localeCompare(a.createdAt)),
    [demandes, filtre, search]
  );

  // Statistiques du mois choisi
  const duMois = demandes.filter((d) => (d.dateDemande || "").slice(0, 7) === mois);
  const retirees = duMois.filter((d) => d.statut === "Retrait effectué");
  const parMotif = Object.entries(
    duMois.reduce<Record<string, number>>((acc, d) => {
      acc[d.motif] = (acc[d.motif] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const parMethode = Object.entries(
    duMois.reduce<Record<string, number>>((acc, d) => {
      acc[d.methode] = (acc[d.methode] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const avecRelais = retirees.filter((d) => d.methodeRelais && d.methodeRelais !== "Aucune").length;

  function enregistrer(d: DemandeRetraitPF) {
    setDemandes((prev) => {
      const existe = prev.some((x) => x.id === d.id);
      return existe ? prev.map((x) => (x.id === d.id ? d : x)) : [d, ...prev];
    });
    if (d.statut === "Retrait effectué" && d.ficheId) onFicheRetiree(d.ficheId);
    setEditing(null);
  }

  function supprimer(d: DemandeRetraitPF) {
    if (!confirm(`Supprimer définitivement la demande de retrait de ${nomComplet(d)} ?`)) return;
    setDemandes((prev) => prev.filter((x) => x.id !== d.id));
    setEditing(null);
  }

  function imprimerRegistre() {
    const lignes = demandes
      .filter((d) => (d.dateDemande || "").slice(0, 7) === mois)
      .sort((a, b) => a.dateDemande.localeCompare(b.dateDemande))
      .map(
        (d, i) => `<tr>
          <td>${i + 1}</td><td>${fmtDate(d.dateDemande)}</td><td>${nomComplet(d)}</td><td>${d.age ?? ""}</td>
          <td>${d.contact || ""}</td><td>${d.methode}</td><td>${fmtDate(d.dateInsertion)}${d.lieuInsertion === "Autre structure" ? ` (${d.structureInsertion || "autre structure"})` : ""}</td>
          <td>${d.motif}${d.motifPrecision ? ` — ${d.motifPrecision}` : ""}</td><td>${d.statut}${d.dateRetrait ? ` le ${fmtDate(d.dateRetrait)}` : ""}</td>
          <td>${d.methodeRelais || ""}</td><td>${d.agentNom || ""}</td></tr>`
      )
      .join("");
    const titreMois = new Date(mois + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Registre des retraits PF</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#1c1917}
      h1{font-size:16px;margin:0}h2{font-size:13px;margin:4px 0 16px;font-weight:normal}
      table{width:100%;border-collapse:collapse;font-size:10.5px}th,td{border:1px solid #888;padding:4px 5px;text-align:left;vertical-align:top}
      th{background:#eee}.r{margin-top:14px;font-size:11px}
    </style></head><body>
      <h1>${clinicName.toUpperCase()} — REGISTRE DES DEMANDES DE RETRAIT DE MÉTHODE CONTRACEPTIVE</h1>
      <h2>Mois : ${titreMois}</h2>
      <table><thead><tr><th>N°</th><th>Date demande</th><th>Nom et prénom</th><th>Âge</th><th>Contact</th><th>Méthode</th><th>Date de pose</th><th>Motif</th><th>Décision</th><th>Méthode relais</th><th>Agent</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="11" style="text-align:center">Aucune demande ce mois-ci</td></tr>`}</tbody></table>
      <div class="r">Total demandes : <b>${duMois.length}</b> · Retraits effectués : <b>${retirees.length}</b> · Avec méthode relais : <b>${avecRelais}</b></div>
      <script>window.onload=function(){window.print()}</script>
    </body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      {/* En-tête de la rubrique */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-white">Demandes de retrait de méthode contraceptive</h2>
            <p className="text-sm text-stone-500">
              Enregistrez chaque patiente qui demande le retrait de son implant, de son DIU ou d'une autre méthode, le motif et la décision prise.
            </p>
          </div>
          <button
            onClick={() =>
              setEditing({
                dateDemande: getTodayStr(),
                lieuInsertion: "Ce centre",
                counselingEffectue: true,
                statut: "En attente",
                methode: METHODES_RETRAIT[0],
                motif: MOTIFS_RETRAIT[0],
                agentId: currentUser?.id || "",
              })
            }
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> Nouvelle demande de retrait
          </button>
        </div>
      </div>

      {/* Synthèse du mois */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-white">Synthèse du mois</h3>
          <div className="flex items-center gap-2">
            <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className={inputCls + " !w-auto"} />
            <button
              onClick={imprimerRegistre}
              className="px-3 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-lg text-xs font-bold border border-stone-200 dark:border-stone-700 flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Imprimer le registre du mois
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: "Demandes", v: duMois.length, c: "text-stone-900 dark:text-white" },
            { l: "En attente", v: duMois.filter((d) => d.statut === "En attente").length, c: "text-amber-600" },
            { l: "Retraits effectués", v: retirees.length, c: "text-emerald-600" },
            { l: "Avec méthode relais", v: avecRelais, c: "text-primary-600" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-stone-200 dark:border-stone-800 p-3 text-center">
              <div className={`text-2xl font-black ${s.c}`}>{s.v}</div>
              <div className="text-2xs font-bold uppercase text-stone-500 tracking-wide">{s.l}</div>
            </div>
          ))}
        </div>
        {duMois.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="font-bold text-stone-500 mb-1.5">Motifs</div>
              {parMotif.map(([m, n]) => (
                <div key={m} className="flex justify-between py-0.5 border-b border-stone-100 dark:border-stone-800">
                  <span>{m}</span>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
            <div>
              <div className="font-bold text-stone-500 mb-1.5">Méthodes concernées</div>
              {parMethode.map(([m, n]) => (
                <div key={m} className="flex justify-between py-0.5 border-b border-stone-100 dark:border-stone-800">
                  <span>{m}</span>
                  <strong>{n}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Liste */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une patiente, un contact, un N°…"
              className={inputCls + " pl-9"}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["Tous", ...STATUTS.map((s) => s.key)] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFiltre(s as StatutRetrait | "Tous")}
                className={`px-3 py-1.5 rounded-full text-2xs font-bold border ${
                  filtre === s ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700"
                }`}
              >
                {s} ({s === "Tous" ? demandes.length : demandes.filter((d) => d.statut === s).length})
              </button>
            ))}
          </div>
        </div>

        {liste.length === 0 ? (
          <div className="text-center text-sm text-stone-500 py-10">Aucune demande de retrait enregistrée.</div>
        ) : (
          <div className="space-y-2.5">
            {liste.map((d) => {
              const st = STATUTS.find((s) => s.key === d.statut);
              return (
                <div
                  key={d.id}
                  onClick={() => setEditing(d)}
                  className="border border-stone-200 dark:border-stone-800 rounded-2xl p-4 hover:border-primary-400 cursor-pointer transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-stone-900 dark:text-white">
                        {nomComplet(d)} {d.age ? <span className="font-medium text-stone-500">· {d.age} ans</span> : null}
                      </div>
                      <div className="text-xs text-stone-500">
                        {d.numero} · demande du {fmtDate(d.dateDemande)} {d.contact ? `· ${d.contact}` : ""}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-2xs font-bold ${st?.cls}`}>
                      {d.statut}
                      {d.statut === "Retrait effectué" && d.dateRetrait ? ` le ${fmtDate(d.dateRetrait)}` : ""}
                    </span>
                  </div>
                  <div className="mt-2 grid sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-stone-500">Méthode : </span>
                      <strong>{d.methode}</strong>
                      {d.dateInsertion && <span className="text-stone-500"> (portée {dureePortage(d.dateInsertion, d.dateRetrait) || "—"})</span>}
                    </div>
                    <div>
                      <span className="text-stone-500">Motif : </span>
                      <strong>{d.motif}</strong>
                    </div>
                    {d.methodeRelais && (
                      <div>
                        <span className="text-stone-500">Relais : </span>
                        <strong>{d.methodeRelais}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editing && (
        <FormulaireRetrait
          demande={editing}
          staff={staff}
          currentUser={currentUser}
          planifs={planifs}
          nbExistants={demandes.length}
          onSave={enregistrer}
          onDelete={editing.id ? () => supprimer(editing as DemandeRetraitPF) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function FormulaireRetrait({
  demande,
  staff,
  currentUser,
  planifs,
  nbExistants,
  onSave,
  onDelete,
  onClose,
}: {
  demande: Partial<DemandeRetraitPF>;
  staff: Staff[];
  currentUser?: Staff | null;
  planifs: FichePlanifFamiliale[];
  nbExistants: number;
  onSave: (d: DemandeRetraitPF) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const estNouvelle = !demande.id;
  const [f, setF] = useState<Partial<DemandeRetraitPF>>(demande);
  const set = <K extends keyof DemandeRetraitPF>(k: K, v: DemandeRetraitPF[K]) => setF((p) => ({ ...p, [k]: v }));

  // Fiches PF en cours dont la méthode peut être retirée (posée dans ce centre)
  const fichesRetirables = planifs.filter(
    (p) => p.statut !== "Retrait effectué" && /implant|diu/i.test(p.methodeChoisie)
  );

  function lierFiche(id: string) {
    const p = planifs.find((x) => x.id === id);
    if (!p) {
      set("ficheId", undefined);
      return;
    }
    const morceaux = p.patient.split(" ");
    setF((prev) => ({
      ...prev,
      ficheId: p.id,
      nomPatiente: p.nomPatiente || morceaux.slice(1).join(" ") || p.patient,
      prenomPatiente: p.prenomPatiente || morceaux[0] || "",
      age: p.age,
      contact: p.contact && p.contact !== "—" ? p.contact : prev.contact,
      adresse: p.adresse || prev.adresse,
      methode: METHODES_RETRAIT.includes(p.methodeChoisie) ? p.methodeChoisie : "Autre",
      dateInsertion: p.dateDebut,
      lieuInsertion: "Ce centre",
    }));
  }

  function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nomPatiente?.trim() || !f.prenomPatiente?.trim()) {
      alert("Le nom et le prénom de la patiente sont requis.");
      return;
    }
    if (!f.methode) {
      alert("Indiquez la méthode à retirer.");
      return;
    }
    if (f.motif === "Autre motif" && !f.motifPrecision?.trim()) {
      alert("Précisez le motif de la demande de retrait.");
      return;
    }
    if (f.statut === "Retrait effectué" && !f.dateRetrait) {
      alert("Indiquez la date à laquelle le retrait a été effectué.");
      return;
    }
    if (f.statut === "Référée" && !f.structureReference?.trim()) {
      alert("Indiquez la structure vers laquelle la patiente est référée.");
      return;
    }
    const agent = staff.find((s) => s.id === f.agentId);
    const annee = (f.dateDemande || getTodayStr()).slice(0, 4);
    onSave({
      ...(f as DemandeRetraitPF),
      id: f.id || generateUid(),
      numero: f.numero || `RET-${annee}-${String(nbExistants + 1).padStart(3, "0")}`,
      dateDemande: f.dateDemande || getTodayStr(),
      nomPatiente: f.nomPatiente!.trim(),
      prenomPatiente: f.prenomPatiente!.trim(),
      age: f.age ? Number(f.age) : undefined,
      lieuInsertion: f.lieuInsertion || "Ce centre",
      motif: f.motif || MOTIFS_RETRAIT[0],
      counselingEffectue: !!f.counselingEffectue,
      statut: (f.statut as StatutRetrait) || "En attente",
      dateRetrait: f.statut === "Retrait effectué" ? f.dateRetrait : undefined,
      methodeRelais: f.statut === "Retrait effectué" ? f.methodeRelais : undefined,
      structureReference: f.statut === "Référée" ? f.structureReference : undefined,
      agentNom: agent?.nom || currentUser?.nom || f.agentNom,
      createdAt: f.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={valider}
        className="bg-white dark:bg-stone-900 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 space-y-5 text-xs font-semibold"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-stone-900 dark:text-white flex items-center gap-2">
            {estNouvelle ? <Plus className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            {estNouvelle ? "Nouvelle demande de retrait" : `Demande ${demande.numero}`}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-stone-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Patiente */}
        <section className="space-y-3">
          <div className="text-2xs font-black uppercase tracking-wider text-primary-600">Patiente</div>
          {fichesRetirables.length > 0 && (
            <div>
              <label className={labelCls}>Patiente déjà suivie ici (remplit automatiquement la fiche)</label>
              <select value={f.ficheId || ""} onChange={(e) => lierFiche(e.target.value)} className={inputCls}>
                <option value="">— Nouvelle patiente / méthode posée ailleurs —</option>
                {fichesRetirables.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.patient} · {p.methodeChoisie} · posé le {fmtDate(p.dateDebut)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nom *</label>
              <input className={inputCls} value={f.nomPatiente || ""} onChange={(e) => set("nomPatiente", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Prénom(s) *</label>
              <input className={inputCls} value={f.prenomPatiente || ""} onChange={(e) => set("prenomPatiente", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Âge</label>
              <input type="number" min={10} max={60} className={inputCls} value={f.age ?? ""} onChange={(e) => set("age", e.target.value === "" ? undefined : Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Contact</label>
              <input className={inputCls} value={f.contact || ""} onChange={(e) => set("contact", e.target.value)} placeholder="Ex : 70 00 00 00" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Adresse / quartier</label>
            <input className={inputCls} value={f.adresse || ""} onChange={(e) => set("adresse", e.target.value)} />
          </div>
        </section>

        {/* Méthode */}
        <section className="space-y-3">
          <div className="text-2xs font-black uppercase tracking-wider text-primary-600">Méthode à retirer</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Méthode *</label>
              <select className={inputCls} value={f.methode || ""} onChange={(e) => set("methode", e.target.value)}>
                {METHODES_RETRAIT.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date de pose</label>
              <input type="date" className={inputCls} value={f.dateInsertion || ""} max={getTodayStr()} onChange={(e) => set("dateInsertion", e.target.value)} />
              {f.dateInsertion && <div className="text-2xs text-stone-500 mt-1">Portée depuis {dureePortage(f.dateInsertion) || "—"}</div>}
            </div>
            <div>
              <label className={labelCls}>Lieu de pose</label>
              <select className={inputCls} value={f.lieuInsertion || "Ce centre"} onChange={(e) => set("lieuInsertion", e.target.value as DemandeRetraitPF["lieuInsertion"])}>
                <option value="Ce centre">Dans ce centre</option>
                <option value="Autre structure">Dans une autre structure</option>
              </select>
            </div>
            {f.lieuInsertion === "Autre structure" && (
              <div>
                <label className={labelCls}>Structure de pose</label>
                <input className={inputCls} value={f.structureInsertion || ""} onChange={(e) => set("structureInsertion", e.target.value)} placeholder="Ex : CSPS de …" />
              </div>
            )}
          </div>
        </section>

        {/* Demande */}
        <section className="space-y-3">
          <div className="text-2xs font-black uppercase tracking-wider text-primary-600">Demande</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date de la demande</label>
              <input type="date" className={inputCls} value={f.dateDemande || ""} onChange={(e) => set("dateDemande", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Motif *</label>
              <select className={inputCls} value={f.motif || ""} onChange={(e) => set("motif", e.target.value)}>
                {MOTIFS_RETRAIT.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Précisions sur le motif {f.motif === "Autre motif" ? "*" : ""}</label>
            <input className={inputCls} value={f.motifPrecision || ""} onChange={(e) => set("motifPrecision", e.target.value)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!f.counselingEffectue} onChange={(e) => set("counselingEffectue", e.target.checked)} />
            <span>Counseling effectué (informer sur le retour à la fécondité et proposer une méthode relais)</span>
          </label>
        </section>

        {/* Décision */}
        <section className="space-y-3">
          <div className="text-2xs font-black uppercase tracking-wider text-primary-600">Décision</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STATUTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setF((p) => ({ ...p, statut: s.key, dateRetrait: s.key === "Retrait effectué" ? p.dateRetrait || getTodayStr() : p.dateRetrait }))}
                className={`py-2.5 rounded-lg border text-2xs font-bold flex items-center justify-center gap-1 ${
                  f.statut === s.key ? "bg-primary-600 text-white border-primary-600" : "border-stone-200 dark:border-stone-700"
                }`}
              >
                {s.key === "En attente" && <Clock className="w-3.5 h-3.5" />}
                {s.key === "Retrait effectué" && <CheckCircle className="w-3.5 h-3.5" />}
                {s.key === "Référée" && <Share2 className="w-3.5 h-3.5" />}
                {s.key === "Méthode conservée" && <Undo2 className="w-3.5 h-3.5" />}
                {s.label}
              </button>
            ))}
          </div>

          {f.statut === "Retrait effectué" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Date du retrait *</label>
                <input type="date" className={inputCls} value={f.dateRetrait || ""} max={getTodayStr()} onChange={(e) => set("dateRetrait", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Méthode relais adoptée</label>
                <select className={inputCls} value={f.methodeRelais || "Aucune"} onChange={(e) => set("methodeRelais", e.target.value)}>
                  {METHODES_RELAIS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Incidents / difficultés lors du retrait</label>
                <input className={inputCls} value={f.incidents || ""} onChange={(e) => set("incidents", e.target.value)} placeholder="Ex : implant profond, retrait sans incident…" />
              </div>
            </div>
          )}
          {f.statut === "Référée" && (
            <div>
              <label className={labelCls}>Référée vers *</label>
              <input className={inputCls} value={f.structureReference || ""} onChange={(e) => set("structureReference", e.target.value)} placeholder="Ex : CMA, CHU…" />
            </div>
          )}
          {f.statut === "Retrait effectué" && f.ficheId && (
            <div className="text-2xs text-emerald-700 dark:text-emerald-400">
              La fiche de suivi PF de la patiente passera automatiquement au statut « Retrait effectué ».
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Agent</label>
              <select className={inputCls} value={f.agentId || ""} onChange={(e) => set("agentId", e.target.value)}>
                <option value="">— Choisir —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Observations</label>
              <input className={inputCls} value={f.observations || ""} onChange={(e) => set("observations", e.target.value)} />
            </div>
          </div>
        </section>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2 border-t border-stone-150 dark:border-stone-800">
          {onDelete ? (
            <button type="button" onClick={onDelete} className="text-rose-600 text-xs font-bold flex items-center gap-1.5 py-2">
              <Trash2 className="w-4 h-4" /> Supprimer
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm">
            <CheckCircle className="w-4 h-4" /> Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
