/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Planification familiale — Clientes des contraceptifs injectables.
 *
 * Chaque cliente a une fiche avec l'historique de ses injections. La date du
 * prochain rendez-vous est calculée automatiquement selon le produit
 * (DMPA : 13 semaines, NET-EN : 8 semaines), et l'app signale les clientes à
 * relancer (rendez-vous proche, en retard, ou hors délai de grâce).
 *
 * Données synchronisées en temps réel entre appareils (clé "dg_pf_injectables").
 */

import React, { useMemo, useState } from "react";
import { FichePlanifFamiliale, Staff } from "../types";
import { generateUid, getTodayStr } from "../data";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import {
  Plus, Search, Printer, Trash2, X, CheckCircle, Syringe, Phone, MessageCircle, AlertTriangle, CalendarClock, Pencil,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Produits et règles de calcul                                       */
/* ------------------------------------------------------------------ */

interface ProduitInjectable {
  id: string;
  label: string;
  voie: "IM" | "SC";
  intervalleJours: number; // délai jusqu'à la prochaine injection
  graceJours: number; // retard toléré sans test de grossesse (OMS)
}

export const PRODUITS_INJECTABLES: ProduitInjectable[] = [
  { id: "dmpa_im", label: "DMPA-IM (Dépo-Provera 150 mg)", voie: "IM", intervalleJours: 91, graceJours: 28 },
  { id: "dmpa_sc", label: "DMPA-SC (Sayana Press 104 mg)", voie: "SC", intervalleJours: 91, graceJours: 28 },
  { id: "net_en", label: "NET-EN (Noristérat 200 mg)", voie: "IM", intervalleJours: 56, graceJours: 14 },
];

const TYPES_VISITE = ["Nouvelle acceptante", "Renouvellement", "Reprise après arrêt"] as const;
type TypeVisite = (typeof TYPES_VISITE)[number];

const EFFETS = [
  "Aucun",
  "Saignements irréguliers / spotting",
  "Aménorrhée",
  "Saignements abondants",
  "Céphalées",
  "Prise de poids",
  "Douleur au point d'injection",
  "Autre",
];

const MOTIFS_ARRET = [
  "Désir de grossesse",
  "Changement de méthode",
  "Effets secondaires",
  "Ménopause",
  "Perdue de vue",
  "Décision du couple",
  "Autre",
];

export interface InjectionPF {
  id: string;
  date: string;
  produitId: string;
  typeVisite: TypeVisite;
  autoInjection?: boolean;
  lot?: string;
  ta?: string;
  poids?: string;
  grossesseExclue: boolean;
  effets?: string;
  agentId?: string;
  agentNom?: string;
  prochaineDate: string;
  observations?: string;
}

export interface ClienteInjectable {
  id: string;
  numero: string;
  ficheId?: string;
  nom: string;
  prenom: string;
  age?: number;
  contact?: string;
  adresse?: string;
  nombreEnfants?: number;
  dateEnregistrement: string;
  actif: boolean;
  motifArret?: string;
  dateArret?: string;
  injections: InjectionPF[];
  observations?: string;
  createdAt: string;
  updatedAt?: string;
}

/* ------------------------------------------------------------------ */
/*  Outils                                                             */
/* ------------------------------------------------------------------ */

const inputCls =
  "w-full bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg px-3 py-2 text-stone-900 dark:text-white focus:outline-none text-xs";
const labelCls = "text-stone-500 dark:text-stone-400 block mb-1";
const carteCls = "bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-850 rounded-3xl p-6 shadow-xs";

function produit(id: string) {
  return PRODUITS_INJECTABLES.find((p) => p.id === id) || PRODUITS_INJECTABLES[0];
}
function ajouterJours(date: string, jours: number) {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + jours);
  return d.toISOString().slice(0, 10);
}
function ecartJours(de: string, a: string) {
  return Math.round((new Date(a + "T00:00:00").getTime() - new Date(de + "T00:00:00").getTime()) / 86400000);
}
function fmt(d?: string) {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR") : "—";
}
function nomComplet(c: ClienteInjectable) {
  return `${c.prenom} ${c.nom}`.trim();
}
function derniere(c: ClienteInjectable): InjectionPF | undefined {
  return [...c.injections].sort((a, b) => b.date.localeCompare(a.date))[0];
}
function telWhatsApp(t?: string) {
  let d = (t || "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8) d = "226" + d;
  return d;
}

type Situation = "a_jour" | "bientot" | "retard" | "hors_delai" | "arret" | "aucune";

function situation(c: ClienteInjectable, aujourdhui = getTodayStr()): { code: Situation; label: string; cls: string; jours?: number } {
  if (!c.actif) return { code: "arret", label: "A arrêté la méthode", cls: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300" };
  const der = derniere(c);
  if (!der) return { code: "aucune", label: "Aucune injection", cls: "bg-stone-100 text-stone-600" };
  const j = ecartJours(der.prochaineDate, aujourdhui); // > 0 = en retard
  const grace = produit(der.produitId).graceJours;
  if (j > grace) return { code: "hors_delai", label: `Hors délai (${j} j de retard)`, cls: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300", jours: j };
  if (j > 0) return { code: "retard", label: `En retard de ${j} j`, cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", jours: j };
  if (j >= -7) return { code: "bientot", label: j === 0 ? "RDV aujourd'hui" : `RDV dans ${-j} j`, cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", jours: j };
  return { code: "a_jour", label: `À jour · RDV le ${fmt(der.prochaineDate)}`, cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", jours: j };
}

function messageRappel(c: ClienteInjectable, clinic: string) {
  const der = derniere(c);
  return `Bonjour ${c.prenom}, ici ${clinic}. Votre prochaine injection contraceptive était prévue le ${fmt(der?.prochaineDate)}. Merci de passer au cabinet dès que possible pour rester protégée. À bientôt !`;
}

/* ------------------------------------------------------------------ */
/*  Rubrique principale                                                */
/* ------------------------------------------------------------------ */

interface Props {
  staff: Staff[];
  currentUser?: Staff | null;
  planifs: FichePlanifFamiliale[];
  clinicName: string;
}

export default function InjectablesPF({ staff, currentUser, planifs, clinicName }: Props) {
  const [clientes, setClientes] = useCloudSyncedState<ClienteInjectable[]>("dg_pf_injectables", []);
  const [ouverte, setOuverte] = useState<string | null>(null); // id de la cliente affichée
  const [nouvelleCliente, setNouvelleCliente] = useState(false);
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<"toutes" | "relancer" | "actives" | "arret">("toutes");
  const [mois, setMois] = useState(getTodayStr().slice(0, 7));

  const avecSituation = useMemo(() => clientes.map((c) => ({ c, s: situation(c) })), [clientes]);
  const aRelancer = avecSituation
    .filter(({ s }) => s.code === "bientot" || s.code === "retard" || s.code === "hors_delai")
    .sort((a, b) => (b.s.jours ?? 0) - (a.s.jours ?? 0));

  const liste = avecSituation
    .filter(({ c, s }) => {
      if (filtre === "relancer") return ["bientot", "retard", "hors_delai"].includes(s.code);
      if (filtre === "actives") return c.actif;
      if (filtre === "arret") return !c.actif;
      return true;
    })
    .filter(({ c }) => {
      const q = search.toLowerCase();
      return !q || nomComplet(c).toLowerCase().includes(q) || (c.contact || "").includes(q) || c.numero.toLowerCase().includes(q);
    })
    .sort((a, b) => nomComplet(a.c).localeCompare(nomComplet(b.c)));

  // Statistiques du mois
  const injectionsDuMois = clientes.flatMap((c) => c.injections.filter((i) => i.date.slice(0, 7) === mois).map((i) => ({ c, i })));
  const stat = (t: TypeVisite) => injectionsDuMois.filter(({ i }) => i.typeVisite === t).length;
  const horsDelai = avecSituation.filter(({ s }) => s.code === "hors_delai").length;

  function enregistrerCliente(c: ClienteInjectable) {
    setClientes((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev]));
  }
  function supprimerCliente(c: ClienteInjectable) {
    if (!confirm(`Supprimer définitivement la fiche de ${nomComplet(c)} et tout son historique d'injections ?`)) return;
    setClientes((prev) => prev.filter((x) => x.id !== c.id));
    setOuverte(null);
  }

  function imprimerRegistre() {
    const lignes = injectionsDuMois
      .sort((a, b) => a.i.date.localeCompare(b.i.date))
      .map(
        ({ c, i }, n) => `<tr><td>${n + 1}</td><td>${fmt(i.date)}</td><td>${c.numero}</td><td>${nomComplet(c)}</td><td>${c.age ?? ""}</td>
        <td>${c.contact || ""}</td><td>${produit(i.produitId).label}${i.autoInjection ? " (auto-injection)" : ""}</td><td>${i.typeVisite}</td>
        <td>${i.lot || ""}</td><td>${i.ta || ""}</td><td>${i.poids || ""}</td><td>${fmt(i.prochaineDate)}</td><td>${i.agentNom || ""}</td></tr>`
      )
      .join("");
    const titreMois = new Date(mois + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Registre des injectables</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#1c1917}h1{font-size:16px;margin:0}h2{font-size:13px;margin:4px 0 16px;font-weight:normal}
      table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #888;padding:4px;text-align:left}th{background:#eee}.r{margin-top:14px;font-size:11px}
    </style></head><body>
      <h1>${clinicName.toUpperCase()} — REGISTRE DES CONTRACEPTIFS INJECTABLES</h1><h2>Mois : ${titreMois}</h2>
      <table><thead><tr><th>N°</th><th>Date</th><th>N° cliente</th><th>Nom et prénom</th><th>Âge</th><th>Contact</th><th>Produit</th><th>Type de visite</th><th>Lot</th><th>TA</th><th>Poids</th><th>Prochain RDV</th><th>Agent</th></tr></thead>
      <tbody>${lignes || `<tr><td colspan="13" style="text-align:center">Aucune injection ce mois-ci</td></tr>`}</tbody></table>
      <div class="r">Total injections : <b>${injectionsDuMois.length}</b> · Nouvelles acceptantes : <b>${stat("Nouvelle acceptante")}</b> · Renouvellements : <b>${stat("Renouvellement")}</b> · Reprises : <b>${stat("Reprise après arrêt")}</b></div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  const clienteOuverte = clientes.find((c) => c.id === ouverte) || null;

  // Fiches PF « injectable » (consentement signé dans la rubrique) qui ne sont
  // pas encore dans le suivi des injections.
  const fichesASuivre = planifs.filter(
    (p) => /inject|dmpa|sayana|net-en/i.test(p.methodeChoisie) && p.statut !== "Retrait effectué" && p.statut !== "Terminé" && !clientes.some((c) => c.ficheId === p.id)
  );

  function produitDeFiche(methode: string) {
    const m = methode.toLowerCase();
    if (m.includes("sayana") || m.includes("sous-cutané")) return "dmpa_sc";
    if (m.includes("net-en") || m.includes("bimestriel")) return "net_en";
    return "dmpa_im";
  }

  function inscrireFiches(fiches: FichePlanifFamiliale[]) {
    const nouvelles: ClienteInjectable[] = fiches.map((p, k) => {
      const morceaux = p.patient.split(" ");
      const date = p.dateDebut || getTodayStr();
      const prod = produitDeFiche(p.methodeChoisie);
      const agent = staff.find((x) => x.id === p.agentId);
      return {
        id: generateUid(),
        numero: `INJ-${date.slice(0, 4)}-${String(clientes.length + k + 1).padStart(3, "0")}`,
        ficheId: p.id,
        nom: p.nomPatiente || morceaux.slice(1).join(" ") || p.patient,
        prenom: p.prenomPatiente || morceaux[0] || "",
        age: p.age,
        contact: p.contact && p.contact !== "—" ? p.contact : undefined,
        adresse: p.adresse,
        nombreEnfants: p.nombreEnfants,
        dateEnregistrement: date,
        actif: true,
        injections: [
          {
            id: generateUid(),
            date,
            produitId: prod,
            typeVisite: p.estNouvelleFois === false ? "Renouvellement" : "Nouvelle acceptante",
            ta: p.ta,
            poids: p.poids ? String(p.poids) : undefined,
            grossesseExclue: true,
            effets: "Aucun",
            agentId: p.agentId,
            agentNom: agent?.nom,
            prochaineDate: ajouterJours(date, produit(prod).intervalleJours),
            observations: "Première injection enregistrée depuis la fiche de consentement PF",
          },
        ],
        createdAt: new Date().toISOString(),
      };
    });
    setClientes((prev) => [...nouvelles, ...prev]);
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className={carteCls}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900 dark:text-white flex items-center gap-2">
              <Syringe className="w-4 h-4 text-primary-600" /> Contraception injectable
            </h2>
            <p className="text-sm text-stone-500">
              Suivi des injections : historique de chaque cliente et rappel automatique de la prochaine date (DMPA tous les 3 mois, NET-EN tous les 2 mois). La première visite se fait avec la fiche de consentement ci-dessus.
            </p>
          </div>
          <button
            onClick={() => setNouvelleCliente(true)}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" /> Nouvelle cliente
          </button>
        </div>
      </div>

      {fichesASuivre.length > 0 && (
        <div className="bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-900 rounded-3xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-primary-800 dark:text-primary-300">
              {fichesASuivre.length} cliente{fichesASuivre.length > 1 ? "s" : ""} du registre PF à ajouter au suivi des injections
            </div>
            <button onClick={() => inscrireFiches(fichesASuivre)} className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold">
              Tout ajouter au suivi
            </button>
          </div>
          <div className="space-y-1.5">
            {fichesASuivre.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white dark:bg-stone-900 rounded-xl px-3 py-2">
                <span>
                  <strong>{p.patient}</strong> · {p.methodeChoisie} · injection du {fmt(p.dateDebut)}
                </span>
                <button onClick={() => inscrireFiches([p])} className="text-primary-700 dark:text-primary-300 font-bold">
                  Ajouter au suivi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clientes à relancer */}
      <div className={carteCls + " space-y-3"}>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-white flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-amber-600" /> Clientes à relancer ({aRelancer.length})
        </h3>
        {aRelancer.length === 0 ? (
          <div className="text-xs text-stone-500">Aucune cliente attendue cette semaine ni en retard.</div>
        ) : (
          <div className="space-y-2">
            {aRelancer.map(({ c, s }) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 border border-stone-200 dark:border-stone-800 rounded-2xl px-3 py-2">
                <button onClick={() => setOuverte(c.id)} className="flex-1 min-w-[160px] text-left">
                  <div className="text-sm font-bold text-stone-900 dark:text-white">{nomComplet(c)}</div>
                  <div className="text-2xs text-stone-500">{produit(derniere(c)!.produitId).label} · prévue le {fmt(derniere(c)!.prochaineDate)}</div>
                </button>
                <span className={`px-2.5 py-1 rounded-full text-2xs font-bold ${s.cls}`}>{s.label}</span>
                {c.contact && (
                  <>
                    <a href={`tel:${c.contact}`} className="p-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200" title="Appeler">
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${telWhatsApp(c.contact)}?text=${encodeURIComponent(messageRappel(c, clinicName))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700"
                      title="Rappel WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {horsDelai > 0 && (
          <div className="text-2xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Hors délai de grâce : avant de réinjecter, s'assurer raisonnablement de l'absence de grossesse (test si besoin) et conseiller une méthode d'appoint pendant 7 jours.
          </div>
        )}
      </div>

      {/* Synthèse du mois */}
      <div className={carteCls + " space-y-4"}>
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
            { l: "Injections", v: injectionsDuMois.length, c: "text-stone-900 dark:text-white" },
            { l: "Nouvelles acceptantes", v: stat("Nouvelle acceptante"), c: "text-primary-600" },
            { l: "Renouvellements", v: stat("Renouvellement") + stat("Reprise après arrêt"), c: "text-emerald-600" },
            { l: "Hors délai (à ce jour)", v: horsDelai, c: "text-rose-600" },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl border border-stone-200 dark:border-stone-800 p-3 text-center">
              <div className={`text-2xl font-black ${s.c}`}>{s.v}</div>
              <div className="text-2xs font-bold uppercase text-stone-500 tracking-wide">{s.l}</div>
            </div>
          ))}
        </div>
        {injectionsDuMois.length > 0 && (
          <div className="text-xs space-y-1">
            {PRODUITS_INJECTABLES.map((p) => {
              const n = injectionsDuMois.filter(({ i }) => i.produitId === p.id).length;
              return n ? (
                <div key={p.id} className="flex justify-between border-b border-stone-100 dark:border-stone-800 py-0.5">
                  <span>{p.label}</span>
                  <strong>{n}</strong>
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>

      {/* Liste des clientes */}
      <div className={carteCls + " space-y-4"}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une cliente, un contact, un N°…" className={inputCls + " pl-9"} />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[
              { k: "toutes", l: `Toutes (${clientes.length})` },
              { k: "relancer", l: `À relancer (${aRelancer.length})` },
              { k: "actives", l: `Actives (${clientes.filter((c) => c.actif).length})` },
              { k: "arret", l: `Arrêt (${clientes.filter((c) => !c.actif).length})` },
            ].map((f) => (
              <button
                key={f.k}
                onClick={() => setFiltre(f.k as typeof filtre)}
                className={`px-3 py-1.5 rounded-full text-2xs font-bold border ${
                  filtre === f.k ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700"
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {liste.length === 0 ? (
          <div className="text-center text-sm text-stone-500 py-10">Aucune cliente enregistrée.</div>
        ) : (
          <div className="space-y-2.5">
            {liste.map(({ c, s }) => {
              const der = derniere(c);
              return (
                <div
                  key={c.id}
                  onClick={() => setOuverte(c.id)}
                  className="border border-stone-200 dark:border-stone-800 rounded-2xl p-4 hover:border-primary-400 cursor-pointer transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-stone-900 dark:text-white">
                        {nomComplet(c)} {c.age ? <span className="font-medium text-stone-500">· {c.age} ans</span> : null}
                      </div>
                      <div className="text-xs text-stone-500">
                        {c.numero} {c.contact ? `· ${c.contact}` : ""} · {c.injections.length} injection{c.injections.length > 1 ? "s" : ""}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-2xs font-bold ${s.cls}`}>{s.label}</span>
                  </div>
                  {der && (
                    <div className="mt-1.5 text-xs text-stone-600 dark:text-stone-300">
                      Dernière injection le <strong>{fmt(der.date)}</strong> · {produit(der.produitId).label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {nouvelleCliente && (
        <FormulaireCliente
          planifs={planifs}
          nbExistantes={clientes.length}
          onSave={(c) => {
            enregistrerCliente(c);
            setNouvelleCliente(false);
            setOuverte(c.id);
          }}
          onClose={() => setNouvelleCliente(false)}
        />
      )}

      {clienteOuverte && (
        <FicheCliente
          cliente={clienteOuverte}
          staff={staff}
          currentUser={currentUser}
          planifs={planifs}
          onSave={enregistrerCliente}
          onDelete={() => supprimerCliente(clienteOuverte)}
          onClose={() => setOuverte(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Création / modification de l'identité de la cliente                */
/* ------------------------------------------------------------------ */

function FormulaireCliente({
  cliente,
  planifs,
  nbExistantes,
  onSave,
  onClose,
}: {
  cliente?: ClienteInjectable;
  planifs: FichePlanifFamiliale[];
  nbExistantes: number;
  onSave: (c: ClienteInjectable) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<Partial<ClienteInjectable>>(cliente || { dateEnregistrement: getTodayStr(), actif: true, injections: [] });
  const set = <K extends keyof ClienteInjectable>(k: K, v: ClienteInjectable[K]) => setF((p) => ({ ...p, [k]: v }));
  const fichesInjectables = planifs.filter((p) => /injectable|dmpa/i.test(p.methodeChoisie));

  function lierFiche(id: string) {
    const p = planifs.find((x) => x.id === id);
    if (!p) return set("ficheId", undefined);
    const morceaux = p.patient.split(" ");
    setF((prev) => ({
      ...prev,
      ficheId: p.id,
      nom: p.nomPatiente || morceaux.slice(1).join(" ") || p.patient,
      prenom: p.prenomPatiente || morceaux[0] || "",
      age: p.age,
      contact: p.contact && p.contact !== "—" ? p.contact : prev.contact,
      adresse: p.adresse || prev.adresse,
      nombreEnfants: p.nombreEnfants,
    }));
  }

  function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nom?.trim() || !f.prenom?.trim()) return alert("Le nom et le prénom de la cliente sont requis.");
    const annee = (f.dateEnregistrement || getTodayStr()).slice(0, 4);
    onSave({
      ...(f as ClienteInjectable),
      id: f.id || generateUid(),
      numero: f.numero || `INJ-${annee}-${String(nbExistantes + 1).padStart(3, "0")}`,
      nom: f.nom!.trim(),
      prenom: f.prenom!.trim(),
      age: f.age ? Number(f.age) : undefined,
      nombreEnfants: f.nombreEnfants !== undefined && f.nombreEnfants !== null && String(f.nombreEnfants) !== "" ? Number(f.nombreEnfants) : undefined,
      dateEnregistrement: f.dateEnregistrement || getTodayStr(),
      actif: f.actif ?? true,
      injections: f.injections || [],
      createdAt: f.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <Modale titre={cliente ? "Modifier la fiche" : "Nouvelle cliente — injectable"} onClose={onClose}>
      <form onSubmit={valider} className="space-y-4 text-xs font-semibold">
        {!cliente && fichesInjectables.length > 0 && (
          <div>
            <label className={labelCls}>Cliente déjà enregistrée en PF (remplit automatiquement)</label>
            <select value={f.ficheId || ""} onChange={(e) => lierFiche(e.target.value)} className={inputCls}>
              <option value="">— Nouvelle cliente —</option>
              {fichesInjectables.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patient} · {p.methodeChoisie} · depuis le {fmt(p.dateDebut)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nom *</label>
            <input className={inputCls} value={f.nom || ""} onChange={(e) => set("nom", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Prénom(s) *</label>
            <input className={inputCls} value={f.prenom || ""} onChange={(e) => set("prenom", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Âge</label>
            <input type="number" min={12} max={60} className={inputCls} value={f.age ?? ""} onChange={(e) => set("age", e.target.value === "" ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Contact (pour les rappels)</label>
            <input className={inputCls} value={f.contact || ""} onChange={(e) => set("contact", e.target.value)} placeholder="Ex : 70 00 00 00" />
          </div>
          <div>
            <label className={labelCls}>Nombre d'enfants</label>
            <input type="number" min={0} className={inputCls} value={f.nombreEnfants ?? ""} onChange={(e) => set("nombreEnfants", e.target.value === "" ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Date d'enregistrement</label>
            <input type="date" className={inputCls} value={f.dateEnregistrement || ""} onChange={(e) => set("dateEnregistrement", e.target.value)} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Adresse / quartier</label>
          <input className={inputCls} value={f.adresse || ""} onChange={(e) => set("adresse", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Observations</label>
          <input className={inputCls} value={f.observations || ""} onChange={(e) => set("observations", e.target.value)} />
        </div>
        {cliente && (
          <div className="border-t border-stone-150 dark:border-stone-800 pt-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!f.actif} onChange={(e) => setF((p) => ({ ...p, actif: !e.target.checked, dateArret: e.target.checked ? p.dateArret || getTodayStr() : undefined }))} />
              <span>La cliente a arrêté la méthode injectable</span>
            </label>
            {!f.actif && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Motif de l'arrêt</label>
                  <select className={inputCls} value={f.motifArret || ""} onChange={(e) => set("motifArret", e.target.value)}>
                    <option value="">— Choisir —</option>
                    {MOTIFS_ARRET.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Date de l'arrêt</label>
                  <input type="date" className={inputCls} value={f.dateArret || ""} onChange={(e) => set("dateArret", e.target.value)} />
                </div>
              </div>
            )}
          </div>
        )}
        <button type="submit" className="w-full px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
          <CheckCircle className="w-4 h-4" /> {cliente ? "Enregistrer" : "Créer la fiche"}
        </button>
      </form>
    </Modale>
  );
}

/* ------------------------------------------------------------------ */
/*  Fiche d'une cliente : historique + nouvelle injection             */
/* ------------------------------------------------------------------ */

function FicheCliente({
  cliente,
  staff,
  currentUser,
  planifs,
  onSave,
  onDelete,
  onClose,
}: {
  cliente: ClienteInjectable;
  staff: Staff[];
  currentUser?: Staff | null;
  planifs: FichePlanifFamiliale[];
  onSave: (c: ClienteInjectable) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [modeEdition, setModeEdition] = useState(false);
  const [injection, setInjection] = useState<Partial<InjectionPF> | null>(null);
  const s = situation(cliente);
  const historique = [...cliente.injections].sort((a, b) => b.date.localeCompare(a.date));

  function nouvelleInjection() {
    const der = derniere(cliente);
    const type: TypeVisite = !der ? "Nouvelle acceptante" : !cliente.actif || s.code === "hors_delai" ? "Reprise après arrêt" : "Renouvellement";
    setInjection({
      date: getTodayStr(),
      produitId: der?.produitId || PRODUITS_INJECTABLES[0].id,
      typeVisite: type,
      grossesseExclue: false,
      effets: "Aucun",
      agentId: currentUser?.id || "",
    });
  }

  function enregistrerInjection(i: InjectionPF) {
    const existe = cliente.injections.some((x) => x.id === i.id);
    onSave({
      ...cliente,
      actif: true,
      motifArret: undefined,
      dateArret: undefined,
      injections: existe ? cliente.injections.map((x) => (x.id === i.id ? i : x)) : [...cliente.injections, i],
      updatedAt: new Date().toISOString(),
    });
    setInjection(null);
  }

  function supprimerInjection(i: InjectionPF) {
    if (!confirm(`Supprimer l'injection du ${fmt(i.date)} ?`)) return;
    onSave({ ...cliente, injections: cliente.injections.filter((x) => x.id !== i.id), updatedAt: new Date().toISOString() });
    setInjection(null);
  }

  if (modeEdition) {
    return (
      <FormulaireCliente
        cliente={cliente}
        planifs={planifs}
        nbExistantes={0}
        onSave={(c) => {
          onSave(c);
          setModeEdition(false);
        }}
        onClose={() => setModeEdition(false)}
      />
    );
  }

  if (injection) {
    return (
      <FormulaireInjection
        injection={injection}
        cliente={cliente}
        staff={staff}
        currentUser={currentUser}
        situationActuelle={s}
        onSave={enregistrerInjection}
        onDelete={injection.id ? () => supprimerInjection(injection as InjectionPF) : undefined}
        onClose={() => setInjection(null)}
      />
    );
  }

  return (
    <Modale titre={nomComplet(cliente)} onClose={onClose}>
      <div className="space-y-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-2xs font-bold ${s.cls}`}>{s.label}</span>
          <span className="text-stone-500">{cliente.numero}</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-stone-50 dark:bg-stone-950 rounded-2xl p-3">
          <div><span className="text-stone-500">Âge : </span><strong>{cliente.age ?? "—"}</strong></div>
          <div><span className="text-stone-500">Contact : </span><strong>{cliente.contact || "—"}</strong></div>
          <div><span className="text-stone-500">Enfants : </span><strong>{cliente.nombreEnfants ?? "—"}</strong></div>
          <div><span className="text-stone-500">Depuis le : </span><strong>{fmt(cliente.dateEnregistrement)}</strong></div>
          {cliente.adresse && <div className="col-span-2"><span className="text-stone-500">Adresse : </span><strong>{cliente.adresse}</strong></div>}
          {!cliente.actif && (
            <div className="col-span-2 text-rose-700">
              Arrêt le {fmt(cliente.dateArret)}{cliente.motifArret ? ` — ${cliente.motifArret}` : ""}
            </div>
          )}
          {cliente.observations && <div className="col-span-2"><span className="text-stone-500">Observations : </span>{cliente.observations}</div>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={nouvelleInjection} className="flex-1 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
            <Syringe className="w-4 h-4" /> Enregistrer une injection
          </button>
          <button onClick={() => setModeEdition(true)} className="px-4 py-2.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-bold flex items-center gap-1.5">
            <Pencil className="w-4 h-4" /> Modifier la fiche
          </button>
        </div>

        <div>
          <div className="text-2xs font-black uppercase tracking-wider text-primary-600 mb-2">Historique des injections ({historique.length})</div>
          {historique.length === 0 ? (
            <div className="text-stone-500">Aucune injection enregistrée.</div>
          ) : (
            <div className="space-y-2">
              {historique.map((i) => (
                <div
                  key={i.id}
                  onClick={() => setInjection(i)}
                  className="border border-stone-200 dark:border-stone-800 rounded-xl p-3 cursor-pointer hover:border-primary-400"
                >
                  <div className="flex justify-between gap-2 flex-wrap">
                    <strong className="text-stone-900 dark:text-white">{fmt(i.date)} · {produit(i.produitId).label}</strong>
                    <span className="text-stone-500">{i.typeVisite}</span>
                  </div>
                  <div className="text-stone-600 dark:text-stone-300 mt-0.5">
                    Prochain RDV : <strong>{fmt(i.prochaineDate)}</strong>
                    {i.ta ? ` · TA ${i.ta}` : ""}
                    {i.poids ? ` · ${i.poids} kg` : ""}
                    {i.lot ? ` · lot ${i.lot}` : ""}
                    {i.autoInjection ? " · auto-injection" : ""}
                  </div>
                  {i.effets && i.effets !== "Aucun" && <div className="text-amber-700 mt-0.5">Effets signalés : {i.effets}</div>}
                  {i.agentNom && <div className="text-stone-400 mt-0.5">Par {i.agentNom}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={onDelete} className="text-rose-600 text-xs font-bold flex items-center gap-1.5 py-1">
          <Trash2 className="w-4 h-4" /> Supprimer la fiche
        </button>
      </div>
    </Modale>
  );
}

function FormulaireInjection({
  injection,
  cliente,
  staff,
  currentUser,
  situationActuelle,
  onSave,
  onDelete,
  onClose,
}: {
  injection: Partial<InjectionPF>;
  cliente: ClienteInjectable;
  staff: Staff[];
  currentUser?: Staff | null;
  situationActuelle: ReturnType<typeof situation>;
  onSave: (i: InjectionPF) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<Partial<InjectionPF>>(injection);
  const set = <K extends keyof InjectionPF>(k: K, v: InjectionPF[K]) => setF((p) => ({ ...p, [k]: v }));
  const p = produit(f.produitId || PRODUITS_INJECTABLES[0].id);
  const prochaineAuto = f.date ? ajouterJours(f.date, p.intervalleJours) : "";
  const [prochaineManuelle, setProchaineManuelle] = useState<string>(injection.prochaineDate || "");
  const prochaine = prochaineManuelle || prochaineAuto;
  const horsDelai = !injection.id && situationActuelle.code === "hors_delai";

  function valider(e: React.FormEvent) {
    e.preventDefault();
    if (!f.date) return alert("Indiquez la date de l'injection.");
    if (!f.grossesseExclue) {
      if (!confirm("La grossesse n'a pas été écartée. Voulez-vous quand même enregistrer cette injection ?")) return;
    }
    const agent = staff.find((s) => s.id === f.agentId);
    onSave({
      ...(f as InjectionPF),
      id: f.id || generateUid(),
      date: f.date,
      produitId: p.id,
      typeVisite: (f.typeVisite as TypeVisite) || "Renouvellement",
      autoInjection: p.voie === "SC" ? !!f.autoInjection : false,
      grossesseExclue: !!f.grossesseExclue,
      prochaineDate: prochaine,
      agentNom: agent?.nom || currentUser?.nom || f.agentNom,
    });
  }

  return (
    <Modale titre={`${injection.id ? "Injection du " + fmt(injection.date) : "Nouvelle injection"} — ${nomComplet(cliente)}`} onClose={onClose}>
      <form onSubmit={valider} className="space-y-4 text-xs font-semibold">
        {horsDelai && (
          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl p-3 text-rose-800 dark:text-rose-300 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Cliente hors délai de grâce ({situationActuelle.jours} jours de retard). S'assurer raisonnablement qu'elle n'est pas enceinte (test de grossesse si besoin) et conseiller une méthode d'appoint (préservatif) pendant 7 jours.
            </span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date de l'injection *</label>
            <input type="date" className={inputCls} value={f.date || ""} max={getTodayStr()} onChange={(e) => { set("date", e.target.value); setProchaineManuelle(""); }} />
          </div>
          <div>
            <label className={labelCls}>Type de visite</label>
            <select className={inputCls} value={f.typeVisite || ""} onChange={(e) => set("typeVisite", e.target.value as TypeVisite)}>
              {TYPES_VISITE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Produit</label>
            <select className={inputCls} value={p.id} onChange={(e) => { set("produitId", e.target.value); setProchaineManuelle(""); }}>
              {PRODUITS_INJECTABLES.map((x) => <option key={x.id} value={x.id}>{x.label} — voie {x.voie}</option>)}
            </select>
          </div>
          {p.voie === "SC" && (
            <label className="col-span-2 flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!f.autoInjection} onChange={(e) => set("autoInjection", e.target.checked)} />
              <span>Auto-injection par la cliente (Sayana Press)</span>
            </label>
          )}
          <div>
            <label className={labelCls}>N° de lot</label>
            <input className={inputCls} value={f.lot || ""} onChange={(e) => set("lot", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Prochain rendez-vous</label>
            <input type="date" className={inputCls} value={prochaine} onChange={(e) => setProchaineManuelle(e.target.value)} />
            <div className="text-2xs text-stone-500 mt-1">
              Calculé : {fmt(prochaineAuto)} ({p.intervalleJours === 91 ? "13 semaines" : "8 semaines"}) · délai de grâce {p.graceJours / 7} semaines
            </div>
          </div>
          <div>
            <label className={labelCls}>TA</label>
            <input className={inputCls} value={f.ta || ""} onChange={(e) => set("ta", e.target.value)} placeholder="Ex : 120/80" />
          </div>
          <div>
            <label className={labelCls}>Poids (kg)</label>
            <input className={inputCls} value={f.poids || ""} onChange={(e) => set("poids", e.target.value)} inputMode="decimal" />
          </div>
        </div>

        <label className="flex items-start gap-2 cursor-pointer bg-stone-50 dark:bg-stone-950 rounded-xl p-3">
          <input type="checkbox" className="mt-0.5" checked={!!f.grossesseExclue} onChange={(e) => set("grossesseExclue", e.target.checked)} />
          <span>Grossesse raisonnablement écartée (dans le délai de grâce, ou critères OMS / test de grossesse négatif)</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Effets signalés depuis la dernière injection</label>
            <select className={inputCls} value={f.effets || "Aucun"} onChange={(e) => set("effets", e.target.value)}>
              {EFFETS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Agent</label>
            <select className={inputCls} value={f.agentId || ""} onChange={(e) => set("agentId", e.target.value)}>
              <option value="">— Choisir —</option>
              {staff.map((x) => <option key={x.id} value={x.id}>{x.nom} ({x.poste})</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Observations</label>
          <input className={inputCls} value={f.observations || ""} onChange={(e) => set("observations", e.target.value)} />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2 border-t border-stone-150 dark:border-stone-800">
          {onDelete ? (
            <button type="button" onClick={onDelete} className="text-rose-600 text-xs font-bold flex items-center gap-1.5 py-2">
              <Trash2 className="w-4 h-4" /> Supprimer cette injection
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> Enregistrer l'injection
          </button>
        </div>
      </form>
    </Modale>
  );
}

function Modale({ titre, onClose, children }: { titre: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-stone-900 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900 dark:text-white">{titre}</h2>
          <button type="button" onClick={onClose} className="p-1 text-stone-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
