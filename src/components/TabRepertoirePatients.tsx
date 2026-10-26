/**
 * Répertoire des patients consultés.
 *
 * Liste tous les patients qui ont eu au moins une visite (consultation,
 * passage infirmier, maternité, labo…) dans le service, à partir des dossiers
 * de consultation et du registre des patients (codes DG-xxxxx). Le répertoire
 * se met à jour tout seul, y compris avec les visites saisies sur les autres
 * appareils (synchronisation cloud).
 *
 * Les secrétaires voient l'identité et les dates de visite ; les diagnostics
 * ne sont affichés qu'aux soignants (voirClinique).
 */

import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BookUser, Search, FileDown, FileSpreadsheet, IdCard, X, Phone, MapPin, CalendarDays, Users, UserPlus, Stethoscope } from "lucide-react";
import { Consultation } from "../types";
import { PatientRegistre, ageActuel, cleIdentite, normNom, normaliserCode, tel8 } from "../lib/patients";
import CartePatient from "./CartePatient";

interface Props {
  consultations: Consultation[];
  patients: PatientRegistre[];
  theme?: string;
  voirClinique?: boolean;
}

interface Ligne {
  cle: string;
  code?: string;
  nom: string;
  sexe?: "Masculin" | "Féminin";
  age?: number;
  contact?: string;
  commune?: string;
  villageSecteur?: string;
  profession?: string;
  premiereVisite: string;
  derniereVisite: string;
  visites: Consultation[];
  dernierDiagnostic?: string;
  registre?: PatientRegistre;
}

const jourDe = (c: Consultation) => (c.date || c.createdAt || "").slice(0, 10);
const fmt = (iso?: string) => {
  if (!iso) return "—";
  const [a, m, j] = iso.slice(0, 10).split("-");
  return a && m && j ? `${j}/${m}/${a}` : iso;
};
const diagDe = (c: Consultation) => (c.diagnosticFinal || c.diagnostic || "").trim();

type Periode = "tout" | "7" | "30" | "annee";
type Tri = "recent" | "nom" | "visites";

export default function TabRepertoirePatients({ consultations, patients, theme, voirClinique = true }: Props) {
  const isDark = theme === "dark";
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const card = `rounded-lg border ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`;
  const input = `px-3 py-2 rounded-lg border text-sm ${isDark ? "bg-gray-900 border-gray-600 text-gray-100" : "bg-white border-gray-300"}`;

  const [q, setQ] = useState("");
  const [sexe, setSexe] = useState<"" | "Masculin" | "Féminin">("");
  const [periode, setPeriode] = useState<Periode>("tout");
  const [commune, setCommune] = useState("");
  const [tri, setTri] = useState<Tri>("recent");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [carte, setCarte] = useState<PatientRegistre | null>(null);
  const [page, setPage] = useState(1);
  const PAR_PAGE = 50;

  // Regroupe les visites par patient (code patient, sinon nom + téléphone).
  const lignes = useMemo<Ligne[]>(() => {
    const parCode = new Map(patients.map((p) => [p.code, p]));
    const groupes = new Map<string, Ligne>();
    consultations.forEach((c) => {
      if (!normNom(c.patient)) return;
      const cle = c.codePatient || `id:${cleIdentite(c.patient, c.contact)}`;
      const jour = jourDe(c);
      let l = groupes.get(cle);
      if (!l) {
        const reg = c.codePatient ? parCode.get(c.codePatient) : undefined;
        l = {
          cle, code: c.codePatient, registre: reg,
          nom: reg?.nom || c.patient.trim(),
          sexe: reg?.sexe || c.sexe,
          age: reg ? ageActuel(reg) ?? c.age : c.age,
          contact: reg?.contact || c.contact,
          commune: reg?.commune || c.commune,
          villageSecteur: reg?.villageSecteur || c.villageSecteur,
          profession: reg?.profession || c.profession,
          premiereVisite: jour, derniereVisite: jour, visites: [],
        };
        groupes.set(cle, l);
      }
      l.visites.push(c);
      if (jour && (!l.premiereVisite || jour < l.premiereVisite)) l.premiereVisite = jour;
      if (jour && jour > l.derniereVisite) l.derniereVisite = jour;
      if (!l.contact && c.contact) l.contact = c.contact;
      if (!l.commune && c.commune) l.commune = c.commune;
    });
    groupes.forEach((l) => {
      l.visites.sort((a, b) => (jourDe(b) + (b.createdAt || "")).localeCompare(jourDe(a) + (a.createdAt || "")));
      l.dernierDiagnostic = l.visites.map(diagDe).find(Boolean);
    });
    return [...groupes.values()];
  }, [consultations, patients]);

  const communes = useMemo(
    () => [...new Set(lignes.map((l) => (l.commune || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [lignes]
  );

  const aujourdhui = new Date().toISOString().slice(0, 10);
  const debutPeriode = useMemo(() => {
    const d = new Date();
    if (periode === "7") d.setDate(d.getDate() - 7);
    else if (periode === "30") d.setDate(d.getDate() - 30);
    else if (periode === "annee") return `${d.getFullYear()}-01-01`;
    else return "";
    return d.toISOString().slice(0, 10);
  }, [periode]);

  const filtres = useMemo(() => {
    const code = normaliserCode(q);
    const n = normNom(q);
    const chiffres = q.replace(/\D/g, "");
    const res = lignes.filter((l) => {
      if (sexe && l.sexe !== sexe) return false;
      if (commune && (l.commune || "").trim() !== commune) return false;
      if (debutPeriode && l.derniereVisite < debutPeriode) return false;
      if (!q.trim()) return true;
      return (
        (!!l.code && code.length > 4 && l.code.startsWith(code)) ||
        normNom(l.nom).includes(n) ||
        (chiffres.length >= 4 && tel8(l.contact).includes(chiffres))
      );
    });
    res.sort((a, b) =>
      tri === "nom" ? a.nom.localeCompare(b.nom)
      : tri === "visites" ? b.visites.length - a.visites.length || b.derniereVisite.localeCompare(a.derniereVisite)
      : b.derniereVisite.localeCompare(a.derniereVisite)
    );
    return res;
  }, [lignes, q, sexe, commune, debutPeriode, tri]);

  const moisCourant = aujourdhui.slice(0, 7);
  const stats = useMemo(() => ({
    total: lignes.length,
    nouveauxMois: lignes.filter((l) => l.premiereVisite.startsWith(moisCourant)).length,
    visitesMois: consultations.filter((c) => jourDe(c).startsWith(moisCourant)).length,
    aujourdhui: lignes.filter((l) => l.derniereVisite === aujourdhui).length,
  }), [lignes, consultations, moisCourant, aujourdhui]);

  const pages = Math.max(1, Math.ceil(filtres.length / PAR_PAGE));
  const pageCourante = Math.min(page, pages);
  const visibles = filtres.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);
  const detail = ouvert ? lignes.find((l) => l.cle === ouvert) : undefined;

  const colonnes = () => {
    const tete = ["Code", "Nom et prénom(s)", "Sexe", "Âge", "Téléphone", "Commune / Secteur", "1re visite", "Dernière visite", "Visites"];
    if (voirClinique) tete.push("Dernier diagnostic");
    const corps = filtres.map((l) => {
      const r = [l.code || "—", l.nom, l.sexe || "", l.age !== undefined ? String(l.age) : "", l.contact || "",
        [l.commune, l.villageSecteur].filter(Boolean).join(" / "), fmt(l.premiereVisite), fmt(l.derniereVisite), String(l.visites.length)];
      if (voirClinique) r.push(l.dernierDiagnostic || "");
      return r;
    });
    return { tete, corps };
  };

  const exporterCSV = () => {
    const { tete, corps } = colonnes();
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = "﻿" + [tete, ...corps].map((r) => r.map(cell).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `repertoire-patients-${aujourdhui}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exporterPDF = () => {
    const { tete, corps } = colonnes();
    let clinique = "Cabinet Médical";
    try { clinique = JSON.parse(localStorage.getItem("dg_clinic_profile") || "{}").name || clinique; } catch { /* rien */ }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(13);
    doc.text(`${clinique} — Répertoire des patients consultés`, 14, 15);
    doc.setFontSize(9);
    doc.text(`Édité le ${fmt(aujourdhui)} · ${filtres.length} patient(s)`, 14, 21);
    autoTable(doc, { startY: 25, head: [tete], body: corps, styles: { fontSize: 7.5 }, headStyles: { fillColor: [13, 148, 136] } });
    doc.save(`repertoire-patients-${aujourdhui}.pdf`);
  };

  const tuile = (Icone: any, valeur: number, libelle: string) => (
    <div className={`${card} p-3 flex items-center gap-3`}>
      <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600"><Icone className="w-5 h-5" /></div>
      <div><div className="text-xl font-bold">{valeur}</div><div className={`text-xs ${muted}`}>{libelle}</div></div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookUser className="w-6 h-6 text-teal-600" />
          <div>
            <h2 className="text-lg font-bold">Répertoire des patients</h2>
            <p className={`text-xs ${muted}`}>Tous les patients consultés dans le service, mis à jour automatiquement.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exporterCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-teal-600 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20">
            <FileSpreadsheet className="w-4 h-4" /> Excel (CSV)
          </button>
          <button onClick={exporterPDF} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-teal-600 text-white hover:bg-teal-700">
            <FileDown className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tuile(Users, stats.total, "Patients au répertoire")}
        {tuile(UserPlus, stats.nouveauxMois, "Nouveaux patients ce mois")}
        {tuile(Stethoscope, stats.visitesMois, "Visites ce mois")}
        {tuile(CalendarDays, stats.aujourdhui, "Vus aujourd'hui")}
      </div>

      <div className={`${card} p-3 flex flex-wrap gap-2 items-center`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Nom, code patient (DG-…) ou téléphone" className={`${input} w-full pl-9`} />
        </div>
        <select value={sexe} onChange={(e) => { setSexe(e.target.value as any); setPage(1); }} className={input}>
          <option value="">Tous les sexes</option>
          <option value="Masculin">Masculin</option>
          <option value="Féminin">Féminin</option>
        </select>
        <select value={periode} onChange={(e) => { setPeriode(e.target.value as Periode); setPage(1); }} className={input}>
          <option value="tout">Toutes les visites</option>
          <option value="7">Vus ces 7 derniers jours</option>
          <option value="30">Vus ces 30 derniers jours</option>
          <option value="annee">Vus cette année</option>
        </select>
        {communes.length > 0 && (
          <select value={commune} onChange={(e) => { setCommune(e.target.value); setPage(1); }} className={input}>
            <option value="">Toutes les communes</option>
            {communes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={tri} onChange={(e) => setTri(e.target.value as Tri)} className={input}>
          <option value="recent">Tri : dernière visite</option>
          <option value="nom">Tri : nom (A → Z)</option>
          <option value="visites">Tri : nombre de visites</option>
        </select>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm">
          <thead className={isDark ? "bg-gray-900/60" : "bg-gray-50"}>
            <tr className={`text-left text-xs uppercase ${muted}`}>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Sexe / Âge</th>
              <th className="px-3 py-2">Téléphone</th>
              <th className="px-3 py-2">Commune / Secteur</th>
              <th className="px-3 py-2">Dernière visite</th>
              <th className="px-3 py-2 text-center">Visites</th>
              {voirClinique && <th className="px-3 py-2">Dernier diagnostic</th>}
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <tr key={l.cle} onClick={() => setOuvert(l.cle)}
                className={`border-t cursor-pointer ${isDark ? "border-gray-700 hover:bg-gray-700/50" : "border-gray-100 hover:bg-teal-50/60"}`}>
                <td className="px-3 py-2 font-mono text-xs text-teal-700">{l.code || "—"}</td>
                <td className="px-3 py-2 font-medium">{l.nom}</td>
                <td className="px-3 py-2">{[l.sexe === "Masculin" ? "M" : l.sexe === "Féminin" ? "F" : "", l.age !== undefined ? `${l.age} ans` : ""].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2">{l.contact || "—"}</td>
                <td className="px-3 py-2">{[l.commune, l.villageSecteur].filter(Boolean).join(" / ") || "—"}</td>
                <td className="px-3 py-2">{fmt(l.derniereVisite)}</td>
                <td className="px-3 py-2 text-center"><span className="px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 text-xs font-semibold">{l.visites.length}</span></td>
                {voirClinique && <td className="px-3 py-2 max-w-[220px] truncate" title={l.dernierDiagnostic}>{l.dernierDiagnostic || "—"}</td>}
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr><td colSpan={voirClinique ? 8 : 7} className={`px-3 py-10 text-center ${muted}`}>
                {lignes.length === 0 ? "Aucun patient consulté pour le moment." : "Aucun patient ne correspond à la recherche."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className={muted}>{filtres.length} patient(s) · page {pageCourante}/{pages}</span>
          <div className="flex gap-2">
            <button disabled={pageCourante <= 1} onClick={() => setPage(pageCourante - 1)} className={`${input} disabled:opacity-40`}>Précédent</button>
            <button disabled={pageCourante >= pages} onClick={() => setPage(pageCourante + 1)} className={`${input} disabled:opacity-40`}>Suivant</button>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setOuvert(null)}>
          <div className={`w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 ${isDark ? "bg-gray-800 text-gray-100" : "bg-white"}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-teal-700">{detail.code || "Sans code patient"}</div>
                <h3 className="text-lg font-bold">{detail.nom}</h3>
                <div className={`text-sm ${muted}`}>
                  {[detail.sexe, detail.age !== undefined ? `${detail.age} ans` : "", detail.profession].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button onClick={() => setOuvert(null)} className={`p-1 rounded ${muted}`} aria-label="Fermer"><X className="w-5 h-5" /></button>
            </div>

            <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-teal-600" />{detail.contact || "—"}</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-teal-600" />{[detail.commune, detail.villageSecteur].filter(Boolean).join(" / ") || "—"}</div>
              <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-teal-600" />1re visite : {fmt(detail.premiereVisite)}</div>
              <div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-teal-600" />Dernière : {fmt(detail.derniereVisite)}</div>
            </div>

            {detail.registre && (
              <button onClick={() => setCarte(detail.registre!)} className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-teal-600 text-teal-700 hover:bg-teal-50">
                <IdCard className="w-4 h-4" /> Voir / réimprimer la carte patient
              </button>
            )}

            <h4 className="mt-5 mb-2 font-semibold text-sm">Historique des visites ({detail.visites.length})</h4>
            <div className="space-y-2">
              {detail.visites.map((v) => (
                <div key={v.id} className={`rounded-lg border p-3 text-sm ${isDark ? "border-gray-700" : "border-gray-200"}`}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-semibold">{fmt(jourDe(v))}</span>
                    <span className={`text-xs ${muted}`}>{[v.serviceDestination, v.statut].filter(Boolean).join(" · ")}</span>
                  </div>
                  {voirClinique ? (
                    <div className="mt-1 space-y-0.5">
                      {v.plainte && <div><span className={muted}>Motif : </span>{v.plainte}</div>}
                      {diagDe(v) && <div><span className={muted}>Diagnostic : </span>{diagDe(v)}</div>}
                      {v.decision && <div><span className={muted}>Décision : </span>{v.decision}{v.referenceService ? ` (${v.referenceService})` : ""}</div>}
                    </div>
                  ) : (
                    v.montantConsultation ? <div className={`mt-1 ${muted}`}>Consultation : {v.montantConsultation.toLocaleString("fr-FR")} F CFA</div> : null
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {carte && <CartePatient patient={carte} onClose={() => setCarte(null)} />}
    </div>
  );
}
