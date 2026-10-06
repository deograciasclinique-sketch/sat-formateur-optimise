/**
 * Bilan mensuel d'activité : un tableau de janvier à décembre, calculé
 * automatiquement à partir des données de l'app (consultations, maternité,
 * laboratoire, PF, hospitalisations, finances…). Rien à saisir.
 */

import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart3, ChevronLeft, ChevronRight, FileDown, Printer, Sheet } from "lucide-react";
import {
  Consultation, FichePediatrique, ConsultationPrenatale, Accouchement, Hospitalisation, PatientUrgence,
  Vaccination, ExamenLabo, SoinRealise, FicheReference, Facture, Depense, FichePlanifFamiliale,
} from "../types";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import { maladiesDansTexte, jourDe } from "../modules/thlo/thloData";
import { demandeTdrPalu } from "../modules/thlo/tdr";
import { normNom } from "../lib/patients";

interface Props {
  consultations: Consultation[];
  pediatrie: FichePediatrique[];
  cpns: ConsultationPrenatale[];
  accouchements: Accouchement[];
  hospitalisations: Hospitalisation[];
  urgences: PatientUrgence[];
  vaccinations: Vaccination[];
  examens: ExamenLabo[];
  soins: SoinRealise[];
  references: FicheReference[];
  factures: Facture[];
  depenses: Depense[];
  theme?: "light" | "dark";
}

const MOIS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

type Ligne = { label: string; valeurs: number[]; argent?: boolean; sous?: boolean };
type Section = { titre: string; lignes: Ligne[] };

/** Index du mois (0-11) d'une date de l'année choisie, sinon -1. */
function moisDe(d: string | undefined, annee: number): number {
  const j = jourDe(d);
  if (!j || j.slice(0, 4) !== String(annee)) return -1;
  const m = parseInt(j.slice(5, 7), 10) - 1;
  return m >= 0 && m < 12 ? m : -1;
}

function compter<T>(items: T[], annee: number, date: (x: T) => string | undefined, filtre: (x: T) => boolean = () => true, poids: (x: T) => number = () => 1): number[] {
  const v = Array(12).fill(0);
  items.forEach((x) => {
    if (!filtre(x)) return;
    const m = moisDe(date(x), annee);
    if (m >= 0) v[m] += poids(x);
  });
  return v;
}

const somme = (v: number[]) => v.reduce((a, b) => a + b, 0);
const fmt = (n: number, argent?: boolean) => (argent ? n.toLocaleString("fr-FR") : String(n));

export default function TabBilanMensuel(props: Props) {
  const { consultations, pediatrie, cpns, accouchements, hospitalisations, urgences, vaccinations, examens, soins, references, factures, depenses, theme = "light" } = props;
  const isDark = theme === "dark";
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const card = `rounded-xl border ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`;
  const anneeCourante = new Date().getFullYear();
  const [annee, setAnnee] = useState(anneeCourante);

  // Données de planification familiale (synchronisées en direct, lecture seule).
  const [pfFiches] = useCloudSyncedState<FichePlanifFamiliale[]>("dg_planif_familiale", []);
  const [pfInjectables] = useCloudSyncedState<any[]>("dg_pf_injectables", []);
  const [pfRetraits] = useCloudSyncedState<any[]>("dg_pf_retraits", []);
  const pf = useMemo(() => ({ fiches: pfFiches || [], injectables: pfInjectables || [], retraits: pfRetraits || [] }), [pfFiches, pfInjectables, pfRetraits]);

  const sections: Section[] = useMemo(() => {
    const cons = consultations.filter((c) => (c.patient || "").trim());

    // Nouveaux consultants : première visite connue du patient dans le cabinet.
    const premiere = new Map<string, string>();
    cons.forEach((c) => {
      const k = c.codePatient || `${normNom(c.patient)}|${(c.contact || "").replace(/\D/g, "").slice(-8)}`;
      const d = jourDe(c.date);
      if (!premiere.has(k) || d < premiere.get(k)!) premiere.set(k, d);
    });
    const estNouveau = (c: Consultation) => {
      const k = c.codePatient || `${normNom(c.patient)}|${(c.contact || "").replace(/\D/g, "").slice(-8)}`;
      return premiere.get(k) === jourDe(c.date) && !c.ancienConsultant;
    };

    // Paludisme : un patient compté une fois par mois (classement du médecin, sinon diagnostic).
    const palu = (grave: boolean) => {
      const vus = new Set<string>();
      const v = Array(12).fill(0);
      cons.forEach((c) => {
        const m = moisDe(c.date, annee);
        if (m < 0) return;
        const texte = [c.diagnosticFinal, c.diagnostic].filter(Boolean).join(" ");
        const ids = c.classementPalu ? [c.classementPalu === "PG" ? "palu_grave" : "palu_simple"] : maladiesDansTexte(texte).map((x) => x.id);
        if (!ids.includes(grave ? "palu_grave" : "palu_simple")) return;
        const k = `${m}|${c.codePatient || normNom(c.patient)}`;
        if (vus.has(k)) return;
        vus.add(k);
        v[m]++;
      });
      return v;
    };

    const tdrPalu = (e: ExamenLabo) => demandeTdrPalu(e.analyses || (e as any).examen) || !!(e as any).tdrPalu;
    const recettes = compter(factures, annee, (f) => f.date, () => true, (f) => Number(f.montantPaye ?? f.total) || 0);
    const depensesM = compter(depenses, annee, (d) => d.date, () => true, (d) => Number(d.montant) || 0);
    const injections = pf.injectables.flatMap((c: any) => (c.injections || []) as any[]);

    return [
      {
        titre: "Consultations",
        lignes: [
          { label: "Consultations (total)", valeurs: compter(cons, annee, (c) => c.date) },
          { label: "dont nouveaux consultants", valeurs: compter(cons, annee, (c) => c.date, estNouveau), sous: true },
          { label: "dont anciens consultants", valeurs: compter(cons, annee, (c) => c.date, (c) => !estNouveau(c)), sous: true },
          { label: "Hommes", valeurs: compter(cons, annee, (c) => c.date, (c) => c.sexe === "Masculin"), sous: true },
          { label: "Femmes", valeurs: compter(cons, annee, (c) => c.date, (c) => c.sexe === "Féminin"), sous: true },
          { label: "Moins de 5 ans", valeurs: compter(cons, annee, (c) => c.date, (c) => c.age > 0 && c.age < 5), sous: true },
          { label: "5 à 14 ans", valeurs: compter(cons, annee, (c) => c.date, (c) => c.age >= 5 && c.age < 15), sous: true },
          { label: "15 ans et plus", valeurs: compter(cons, annee, (c) => c.date, (c) => c.age >= 15), sous: true },
          { label: "Âge non renseigné", valeurs: compter(cons, annee, (c) => c.date, (c) => !(c.age > 0)), sous: true },
          { label: "Consultations pédiatriques (fiches)", valeurs: compter(pediatrie, annee, (p) => p.date) },
          { label: "Urgences reçues", valeurs: compter(urgences, annee, (u) => u.dateArrivee) },
        ],
      },
      {
        titre: "Paludisme et laboratoire",
        lignes: [
          { label: "Examens de laboratoire demandés", valeurs: compter(examens, annee, (e) => e.dateDemande) },
          { label: "TDR paludisme réalisés", valeurs: compter(examens, annee, (e) => e.dateResultat || e.dateDemande, (e) => tdrPalu(e) && ((e as any).tdrPalu === "Positif" || (e as any).tdrPalu === "Négatif")) },
          { label: "TDR paludisme positifs", valeurs: compter(examens, annee, (e) => e.dateResultat || e.dateDemande, (e) => tdrPalu(e) && (e as any).tdrPalu === "Positif"), sous: true },
          { label: "Paludisme simple (PS)", valeurs: palu(false) },
          { label: "Paludisme grave (PG)", valeurs: palu(true) },
        ],
      },
      {
        titre: "Hospitalisation, soins et références",
        lignes: [
          { label: "Hospitalisations (admissions)", valeurs: compter(hospitalisations, annee, (h) => h.dateAdmission) },
          { label: "Décès", valeurs: compter(hospitalisations, annee, (h) => h.dateSortie || h.dateAdmission, (h) => h.statut === "Décès") },
          { label: "Références / évacuations", valeurs: compter(references, annee, (r) => r.dateReference) },
          { label: "Soins infirmiers réalisés", valeurs: compter(soins, annee, (s) => s.date) },
        ],
      },
      {
        titre: "Santé de la mère et de l'enfant",
        lignes: [
          { label: "Consultations prénatales (CPN)", valeurs: compter(cpns, annee, (c) => c.dateVisite) },
          { label: "dont CPN 1", valeurs: compter(cpns, annee, (c) => c.dateVisite, (c) => c.numeroVisite === "CPN 1"), sous: true },
          { label: "Accouchements", valeurs: compter(accouchements, annee, (a) => a.date) },
          { label: "dont césariennes", valeurs: compter(accouchements, annee, (a) => a.date, (a) => a.mode === "Césarienne"), sous: true },
          { label: "Doses de vaccin administrées", valeurs: compter(vaccinations, annee, (v) => v.dateAdmin) },
        ],
      },
      {
        titre: "Planification familiale",
        lignes: [
          { label: "Fiches PF (nouvelles procédures)", valeurs: compter(pf.fiches, annee, (p) => p.dateDebut) },
          { label: "dont nouvelles utilisatrices", valeurs: compter(pf.fiches, annee, (p) => p.dateDebut, (p) => p.estNouvelleFois !== false), sous: true },
          { label: "Injections contraceptives", valeurs: compter(injections, annee, (i: any) => i.date) },
          { label: "Retraits de méthode effectués", valeurs: compter(pf.retraits, annee, (r: any) => r.dateRetrait, (r: any) => r.statut === "Retrait effectué") },
        ],
      },
      {
        titre: "Finances (FCFA)",
        lignes: [
          { label: "Recettes encaissées", valeurs: recettes, argent: true },
          { label: "Dépenses", valeurs: depensesM, argent: true },
          { label: "Solde", valeurs: recettes.map((r, i) => r - depensesM[i]), argent: true },
        ],
      },
    ];
  }, [annee, consultations, pediatrie, cpns, accouchements, hospitalisations, urgences, vaccinations, examens, soins, references, factures, depenses, pf]);

  const consultationsParMois = sections[0].lignes[0].valeurs;
  const maxCons = Math.max(1, ...consultationsParMois);
  const moisCourant = annee === anneeCourante ? new Date().getMonth() : 11;

  const nomCabinet = (() => {
    try { return JSON.parse(localStorage.getItem("dg_clinic_profile") || "{}").name || "CSI DEO GRACIAS"; } catch { return "CSI DEO GRACIAS"; }
  })();

  const exporterPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text(`${nomCabinet} — Bilan mensuel d'activité ${annee}`, 14, 14);
    doc.setFontSize(9);
    doc.text(`Édité le ${new Date().toLocaleDateString("fr-FR")}`, 14, 20);
    const body: any[] = [];
    sections.forEach((s) => {
      body.push([{ content: s.titre.toUpperCase(), colSpan: 14, styles: { fillColor: [230, 245, 243], fontStyle: "bold", halign: "left" } }]);
      s.lignes.forEach((l) => body.push([(l.sous ? "   " : "") + l.label, ...l.valeurs.map((v) => fmt(v, l.argent)), fmt(somme(l.valeurs), l.argent)]));
    });
    autoTable(doc, {
      startY: 24,
      head: [["Indicateur", ...MOIS, "Total"]],
      body,
      styles: { fontSize: 7, halign: "center", cellPadding: 1.2 },
      columnStyles: { 0: { halign: "left", cellWidth: 62 }, 13: { fontStyle: "bold" } },
      headStyles: { fillColor: [13, 148, 136] },
    });
    doc.save(`bilan-mensuel-${annee}.pdf`);
  };

  const exporterExcel = () => {
    const cell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lignes = [["Indicateur", ...MOIS, "Total"].join(";")];
    sections.forEach((s) => {
      lignes.push(cell(s.titre.toUpperCase()));
      s.lignes.forEach((l) => lignes.push([cell(l.label), ...l.valeurs.map(String), String(somme(l.valeurs))].join(";")));
    });
    const url = URL.createObjectURL(new Blob(["﻿" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `bilan-mensuel-${annee}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className={`p-4 space-y-5 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-600" /> Bilan mensuel d'activité</h2>
          <p className={`text-sm ${muted}`}>De janvier à décembre, calculé automatiquement à partir des dossiers de l'app. Rien à saisir.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center rounded-lg border ${isDark ? "border-gray-600" : "border-gray-300"}`}>
            <button onClick={() => setAnnee(annee - 1)} className="p-2" aria-label="Année précédente"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 font-bold">{annee}</span>
            <button onClick={() => setAnnee(annee + 1)} disabled={annee >= anneeCourante} className="p-2 disabled:opacity-30" aria-label="Année suivante"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <button onClick={exporterPDF} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-emerald-700"><FileDown className="w-4 h-4" /> PDF</button>
          <button onClick={exporterExcel} className={`px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}><Sheet className="w-4 h-4" /> Excel</button>
          <button onClick={() => window.print()} className={`px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}><Printer className="w-4 h-4" /> Imprimer</button>
        </div>
      </div>

      {/* Chiffres clés de l'année */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Consultations", somme(consultationsParMois), false],
          ["Hospitalisations", somme(sections[2].lignes[0].valeurs), false],
          ["Accouchements", somme(sections[3].lignes[2].valeurs), false],
          ["Recettes (FCFA)", somme(sections[5].lignes[0].valeurs), true],
        ].map(([l, v, a]) => (
          <div key={l as string} className={`${card} p-3`}>
            <div className={`text-xs uppercase font-semibold ${muted}`}>{l} {annee}</div>
            <div className="text-2xl font-bold">{fmt(v as number, a as boolean)}</div>
          </div>
        ))}
      </div>

      {/* Consultations par mois */}
      <div className={`${card} p-4`}>
        <div className="font-semibold mb-3">Consultations par mois — {annee}</div>
        <div className="flex items-end gap-1.5 h-36">
          {consultationsParMois.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${MOIS[i]} : ${v} consultation(s)`}>
              <span className={`text-[11px] font-semibold ${v ? "" : muted}`}>{v || ""}</span>
              <div className={`w-full rounded-t ${i > moisCourant ? (isDark ? "bg-gray-700" : "bg-gray-100") : "bg-emerald-500"}`} style={{ height: `${Math.max(v ? 4 : 2, (v / maxCons) * 100)}%` }} />
              <span className={`text-[10px] ${muted}`}>{MOIS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tableau complet */}
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={isDark ? "bg-gray-900" : "bg-emerald-600 text-white"}>
              <th className="text-left px-3 py-2 sticky left-0 bg-inherit min-w-[230px]">Indicateur</th>
              {MOIS.map((m, i) => <th key={m} className={`px-2 py-2 text-center whitespace-nowrap ${i > moisCourant ? "opacity-60" : ""}`}>{m}</th>)}
              <th className="px-3 py-2 text-center">Total {annee}</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <React.Fragment key={s.titre}>
                <tr className={isDark ? "bg-gray-900/60" : "bg-emerald-50"}>
                  <td colSpan={14} className="px-3 py-1.5 font-bold text-emerald-700 uppercase text-xs tracking-wide">{s.titre}</td>
                </tr>
                {s.lignes.map((l) => (
                  <tr key={l.label} className={`border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                    <td className={`px-3 py-1.5 sticky left-0 ${isDark ? "bg-gray-800" : "bg-white"} ${l.sous ? `pl-7 ${muted}` : "font-medium"}`}>{l.label}</td>
                    {l.valeurs.map((v, i) => (
                      <td key={i} className={`px-2 py-1.5 text-center whitespace-nowrap ${v ? "" : muted} ${l.argent && v < 0 ? "text-red-600" : ""}`}>{v ? fmt(v, l.argent) : "·"}</td>
                    ))}
                    <td className={`px-3 py-1.5 text-center font-bold whitespace-nowrap ${l.argent && somme(l.valeurs) < 0 ? "text-red-600" : ""}`}>{fmt(somme(l.valeurs), l.argent)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`text-xs ${muted}`}>
        Les mois à venir sont grisés. Un patient venu pour la première fois dans le cabinet compte comme nouveau consultant ; le paludisme est compté une fois par patient et par mois.
      </p>
    </div>
  );
}
