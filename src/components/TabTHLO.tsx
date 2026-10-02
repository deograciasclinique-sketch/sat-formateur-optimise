/**
 * THLO — Rapport hebdomadaire de surveillance épidémiologique (SIMR).
 *
 * Les chiffres se calculent tout seuls à partir des consultations, des fiches
 * pédiatriques et des hospitalisations de la semaine : il n'y a rien à
 * importer, le tableau se met à jour dès qu'un dossier change (y compris sur
 * les autres appareils, grâce à la synchronisation cloud).
 */

import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCopy, FileDown, Lock, RotateCcw, Send, Settings2, Unlock, Activity,
} from "lucide-react";
import { Consultation, ExamenLabo, FichePediatrique, Hospitalisation } from "../types";
import {
  MALADIES_THLO, TRANCHES_AGE, Compte, RapportTHLO, ConfigTHLO, CONFIG_THLO_DEFAUT, SemaineEpi,
  compterSemaine, semaineDe, semainePrecedente, decalerSemaine, libelleSemaine, valeursFinales, texteTHLO, somme, zero, dateLimite, isoDate,
  indicateursSemaine, indicateursFinaux, autresAuto, numeroTLOH, INDICATEURS_FICHE, CleIndicateur,
} from "../modules/thlo/thloData";
import { formatWhatsAppNumber } from "../lib/whatsapp";

interface Props {
  consultations: Consultation[];
  pediatrie: FichePediatrique[];
  hospitalisations: Hospitalisation[];
  /** Examens du laboratoire (pour compter les TDR paludisme et les tests dengue). */
  laboExamens?: ExamenLabo[];
  rapports: RapportTHLO[];
  onUpdateRapports: (r: RapportTHLO[]) => void;
  config?: ConfigTHLO;
  onUpdateConfig: (c: ConfigTHLO) => void;
  theme?: "light" | "dark";
  agentNom?: string;
}

const dateFr = (iso?: string) => (iso ? new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function TabTHLO({
  consultations, pediatrie, hospitalisations, laboExamens = [], rapports, onUpdateRapports, config, onUpdateConfig, theme = "light", agentNom,
}: Props) {
  const isDark = theme === "dark";
  const cfg: ConfigTHLO = { ...CONFIG_THLO_DEFAUT, ...(config || {}) };
  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const card = `rounded-lg border ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`;
  const today = isoDate(new Date());

  // Par défaut : la semaine en cours, qui se remplit au fil des consultations.
  const [semaine, setSemaine] = useState<SemaineEpi>(() => semaineDe(isoDate(new Date())));
  const [choixManuel, setChoixManuel] = useState(false);
  const allerA = (s: SemaineEpi) => { setSemaine(s); setChoixManuel(s.id !== semaineDe(isoDate(new Date())).id); };
  // Si l'app reste ouverte au passage à une nouvelle semaine, on suit le calendrier.
  React.useEffect(() => {
    const t = setInterval(() => {
      const courante = semaineDe(isoDate(new Date()));
      if (!choixManuel && courante.id !== semaine.id) setSemaine(courante);
    }, 60000);
    return () => clearInterval(t);
  }, [choixManuel, semaine.id]);
  const [seulementAvecCas, setSeulementAvecCas] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(!config?.district);
  const [cfgDraft, setCfgDraft] = useState<ConfigTHLO>(cfg);

  const auto = useMemo(
    () => compterSemaine(semaine, consultations, pediatrie, hospitalisations),
    [semaine, consultations, pediatrie, hospitalisations]
  );
  const rapport = rapports.find((r) => r.id === semaine.id);
  const verrouille = !!rapport && rapport.statut !== "Brouillon";
  const valeurs = valeursFinales(rapport, auto);
  const totalCas = MALADIES_THLO.reduce((s, m) => s + somme(valeurs.cas[m.id]), 0);
  const totalDeces = MALADIES_THLO.reduce((s, m) => s + somme(valeurs.deces[m.id]), 0);
  const maladiesAvecCas = MALADIES_THLO.filter((m) => somme(valeurs.cas[m.id]) + somme(valeurs.deces[m.id]) > 0);
  const immediates = maladiesAvecCas.filter((m) => m.immediate);
  const limite = dateLimite(semaine, cfg);
  const semaineCourante = semaineDe(today);
  const semaineTerminee = semaine.fin < today;
  const agesAVerifier = auto.details.filter((d) => d.ageInconnu).length;

  // --- Bloc de la fiche TLOH (TDR, PS, PG, dengue, autres) ---
  const autoInd = useMemo(
    () => indicateursSemaine(semaine, consultations, pediatrie, laboExamens),
    [semaine, consultations, pediatrie, laboExamens]
  );
  const indicateurs = indicateursFinaux(rapport, autoInd, valeurs);
  const autresAutomatique = autresAuto(valeurs);
  const autresTexte = (rapport?.autres ?? "").trim() || autresAutomatique;
  const [detailInd, setDetailInd] = useState<"tdr" | "dengue" | null>(null);
  const [numDraft, setNumDraft] = useState("");
  const [autresDraft, setAutresDraft] = useState("");

  const [obs, setObs] = useState("");
  const [redige, setRedige] = useState("");
  React.useEffect(() => {
    setObs(rapport?.observations || "");
    setRedige(rapport?.redigePar || agentNom || cfg.responsable || "");
    setDetailId(null);
    setNumDraft(rapport?.numeroTLOH || "");
    setAutresDraft(rapport?.autres || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semaine.id, rapport?.id]);

  const corrigerIndicateur = (cle: CleIndicateur, valeur: string) => {
    if (verrouille || cle === "ps" || cle === "pg") return;
    const r = baseRapport();
    const v = Math.max(0, parseInt(valeur, 10) || 0);
    const autoV = (autoInd.valeurs as Record<string, number>)[cle];
    sauver({ ...r, observations: obs, redigePar: redige, indicateursCorrections: { ...(r.indicateursCorrections || {}), [cle]: v === autoV ? null : v } });
  };
  const enregistrerFiche = () => {
    if (verrouille) return;
    const r = baseRapport();
    if ((r.numeroTLOH || "") === numDraft.trim() && (r.autres || "") === autresDraft.trim()) return;
    sauver({ ...r, observations: obs, redigePar: redige, numeroTLOH: numDraft.trim() || undefined, autres: autresDraft.trim() || undefined });
  };

  const baseRapport = (): RapportTHLO =>
    rapport || {
      id: semaine.id, annee: semaine.annee, semaine: semaine.numero, debut: semaine.debut, fin: semaine.fin,
      corrections: {}, observations: "", redigePar: "", statut: "Brouillon",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

  const sauver = (r: RapportTHLO) => {
    const next = { ...r, updatedAt: new Date().toISOString() };
    onUpdateRapports(rapports.some((x) => x.id === r.id) ? rapports.map((x) => (x.id === r.id ? next : x)) : [next, ...rapports]);
  };

  const corriger = (maladieId: string, type: "cas" | "deces", tranche: number, valeur: string) => {
    if (verrouille) return;
    const r = baseRapport();
    // Seule la case modifiée est corrigée ; les autres restent automatiques.
    const actuel = [...((r.corrections[maladieId]?.[type]) || [null, null, null, null])];
    const v = Math.max(0, parseInt(valeur, 10) || 0);
    actuel[tranche] = v === auto[type][maladieId][tranche] ? null : v;
    sauver({
      ...r, observations: obs, redigePar: redige,
      corrections: { ...r.corrections, [maladieId]: { ...(r.corrections[maladieId] || {}), [type]: actuel } },
    });
  };

  const annulerCorrection = (maladieId: string) => {
    if (!rapport || verrouille) return;
    const c = { ...rapport.corrections };
    delete c[maladieId];
    sauver({ ...rapport, corrections: c });
  };

  const enregistrerTexte = () => sauver({ ...baseRapport(), observations: obs.trim(), redigePar: redige.trim() });

  const valider = () => {
    if (!semaineTerminee && !window.confirm("La semaine n'est pas terminée. Valider quand même le rapport maintenant ?")) return;
    sauver({
      ...baseRapport(), observations: obs.trim(), redigePar: redige.trim(), statut: "Validé", valideLe: new Date().toISOString(),
      valeursFigees: { cas: valeurs.cas, deces: valeurs.deces },
      indicateursFiges: indicateurs,
      numeroTLOH: numDraft.trim() || undefined, autres: autresDraft.trim() || undefined,
    });
  };

  const rouvrir = () => {
    if (!rapport) return;
    if (!window.confirm("Rouvrir ce rapport ? Les chiffres seront de nouveau recalculés à partir des dossiers.")) return;
    sauver({ ...rapport, statut: "Brouillon", valeursFigees: undefined, indicateursFiges: undefined, transmisLe: undefined, moyenTransmission: undefined });
  };

  const texte = texteTHLO(semaine, cfg, valeurs, { ...baseRapport(), observations: obs, redigePar: redige, numeroTLOH: numDraft }, { indicateurs, autres: autresTexte });
  const numDistrict = formatWhatsAppNumber(cfg.telephoneDistrict);

  const marquerTransmis = (moyen: string) => {
    const r = baseRapport();
    sauver({
      ...r, observations: obs.trim(), redigePar: redige.trim(), statut: "Transmis",
      valeursFigees: r.valeursFigees || { cas: valeurs.cas, deces: valeurs.deces },
      indicateursFiges: r.indicateursFiges || indicateurs,
      valideLe: r.valideLe || new Date().toISOString(),
      transmisLe: new Date().toISOString(), transmisPar: redige.trim() || agentNom, moyenTransmission: moyen,
    });
  };

  const copier = async () => {
    try { await navigator.clipboard.writeText(texte); alert("Rapport copié : vous pouvez le coller dans WhatsApp ou un SMS."); }
    catch { alert("La copie n'a pas fonctionné sur cet appareil."); }
  };

  const telechargerPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text(`${cfg.formationSanitaire} — TLOH N° ${numeroTLOH(rapport, semaine)}`, 14, 14);
    doc.setFontSize(10);
    doc.text(`Semaine épidémiologique ${libelleSemaine(semaine)}`, 14, 21);
    doc.text(`District : ${cfg.district || "—"}   Région : ${cfg.region || "—"}`, 14, 27);
    autoTable(doc, {
      startY: 31,
      head: [["TDR réalisés", "TDR +", "TDR -", "PS", "PG", "Dengue cas suspects", "Dengue cas probables"]],
      body: [[indicateurs.tdrRealises, indicateurs.tdrPositifs, indicateurs.tdrNegatifs, indicateurs.ps, indicateurs.pg, indicateurs.dengueSuspect, indicateurs.dengueProbable]],
      styles: { fontSize: 10, halign: "center", fontStyle: "bold" },
      headStyles: { fillColor: [13, 148, 136], fontStyle: "bold" },
    });
    const yAutres = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(9);
    doc.text(doc.splitTextToSize(`Autres : ${autresTexte || "RAS"}`, 265), 14, yAutres);
    autoTable(doc, {
      startY: yAutres + 5,
      head: [
        [{ content: "Maladie", rowSpan: 2 }, { content: "Cas", colSpan: 5 }, { content: "Décès", colSpan: 5 }],
        [...TRANCHES_AGE, "Total", ...TRANCHES_AGE, "Total"],
      ],
      body: MALADIES_THLO.map((m) => [
        m.nom + (m.immediate ? " *" : ""),
        ...valeurs.cas[m.id], somme(valeurs.cas[m.id]),
        ...valeurs.deces[m.id], somme(valeurs.deces[m.id]),
      ]),
      foot: [["TOTAL", "", "", "", "", totalCas, "", "", "", "", totalDeces]],
      styles: { fontSize: 8, halign: "center" },
      columnStyles: { 0: { halign: "left", cellWidth: 70 } },
      headStyles: { fillColor: [13, 148, 136] },
      footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    });
    const y = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(9);
    doc.text("* Maladie à notification immédiate (dans les 24 h) au District.", 14, y);
    if (obs.trim()) doc.text(`Observations : ${obs.trim()}`.slice(0, 180), 14, y + 6);
    doc.text(`Rédigé par : ${redige || "—"}      Statut : ${rapport?.statut || "Brouillon"}${rapport?.transmisLe ? ` (transmis le ${dateFr(rapport.transmisLe)})` : ""}`, 14, y + 12);
    doc.save(`TLOH_${semaine.id}.pdf`);
  };

  // Historique des 12 dernières semaines (complétude et promptitude).
  const historique = useMemo(() => {
    const out: { s: SemaineEpi; r?: RapportTHLO }[] = [];
    let s = semainePrecedente(today);
    for (let i = 0; i < 12; i++) { out.push({ s, r: rapports.find((x) => x.id === s.id) }); s = decalerSemaine(s, -1); }
    return out;
  }, [rapports, today]);
  const transmises = historique.filter((h) => h.r?.statut === "Transmis");
  const aTemps = transmises.filter((h) => h.r!.transmisLe!.slice(0, 10) <= dateLimite(h.s, cfg));

  const statutChip = (st?: string) => {
    const s = st || "Non commencé";
    const cls = s === "Transmis" ? "bg-emerald-500/15 text-emerald-600" : s === "Validé" ? "bg-blue-500/15 text-blue-600" : s === "Brouillon" ? "bg-amber-500/15 text-amber-600" : "bg-gray-500/15 text-gray-500";
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{s}</span>;
  };

  const lignes = seulementAvecCas ? maladiesAvecCas : MALADIES_THLO;

  // Fonction de rendu (et non composant) pour que le champ garde le focus
  // pendant la saisie.
  const cellule = (m: (typeof MALADIES_THLO)[number], type: "cas" | "deces", i: number) => {
    const v = valeurs[type][m.id][i];
    const cc = rapport?.corrections?.[m.id]?.[type]?.[i];
    const corrige = !verrouille && cc !== null && cc !== undefined && cc !== auto[type][m.id][i];
    if (verrouille) return <td key={type + i} className={`px-1 py-1 text-center ${v ? "font-bold" : muted}`}>{v}</td>;
    return (
      <td key={type + i} className="px-1 py-1 text-center">
        <input
          type="number" min={0} inputMode="numeric" value={v}
          onChange={(e) => corriger(m.id, type, i, e.target.value)}
          title={corrige ? `Corrigé à la main (valeur automatique : ${auto[type][m.id][i]})` : "Valeur calculée automatiquement"}
          className={`w-12 text-center rounded border px-1 py-0.5 bg-transparent ${v ? "font-bold" : ""} ${corrige ? "border-amber-500 bg-amber-500/10" : isDark ? "border-gray-700" : "border-gray-200"}`}
        />
      </td>
    );
  };

  return (
    <div className={`p-4 space-y-4 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-600" /> TLOH — Surveillance épidémiologique hebdomadaire</h2>
          <p className={`text-sm ${muted}`}>
            Les cas et décès se comptent tout seuls à partir des consultations, des fiches pédiatriques et des hospitalisations. Vérifiez, corrigez si besoin, validez puis transmettez au District.
          </p>
        </div>
        <button onClick={() => { setCfgDraft(cfg); setShowConfig(!showConfig); }} className={`text-sm font-semibold rounded-lg px-3 py-1.5 border flex items-center gap-1 ${isDark ? "border-gray-600" : "border-gray-300"}`}>
          <Settings2 className="w-4 h-4" /> Réglages
        </button>
      </div>

      {showConfig && (
        <div className={`${card} p-4 space-y-3`}>
          <h3 className="font-semibold">Réglages du rapport</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {([
              ["formationSanitaire", "Formation sanitaire", "Cabinet Privé de Soins DEO-GRACIAS"],
              ["district", "District sanitaire", "Ex. District sanitaire de Dô"],
              ["region", "Région", "Ex. Hauts-Bassins"],
              ["responsable", "Responsable de la surveillance", "Nom et fonction"],
              ["telephoneDistrict", "WhatsApp du point focal du District", "Ex. 70 00 00 00"],
            ] as const).map(([k, l, ph]) => (
              <div key={k}>
                <label className="text-sm font-medium">{l}</label>
                <input className="w-full mt-1 px-3 py-2 rounded border bg-transparent" placeholder={ph} value={(cfgDraft as any)[k] || ""} onChange={(e) => setCfgDraft({ ...cfgDraft, [k]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium">Transmission au plus tard le</label>
              <select className="w-full mt-1 px-3 py-2 rounded border bg-transparent" value={cfgDraft.jourLimite} onChange={(e) => setCfgDraft({ ...cfgDraft, jourLimite: Number(e.target.value) })}>
                {["lundi", "mardi", "mercredi", "jeudi", "vendredi"].map((j, i) => <option key={j} value={i + 1}>{j} suivant la semaine</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowConfig(false)} className={`px-3 py-1.5 rounded border text-sm ${isDark ? "border-gray-600" : "border-gray-300"}`}>Fermer</button>
            <button onClick={() => { onUpdateConfig(cfgDraft); setShowConfig(false); }} className="px-3 py-1.5 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">Enregistrer les réglages</button>
          </div>
        </div>
      )}

      {/* Choix de la semaine */}
      <div className={`${card} p-3 flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <button onClick={() => allerA(decalerSemaine(semaine, -1))} aria-label="Semaine précédente" className={`p-2 rounded border ${isDark ? "border-gray-600" : "border-gray-300"}`}><ChevronLeft className="w-4 h-4" /></button>
          <div>
            <div className="font-bold">Semaine épidémiologique {libelleSemaine(semaine)}</div>
            <div className={`text-xs ${muted}`}>
              {semaine.id === semaineCourante.id ? "Semaine en cours (pas encore terminée) · " : ""}
              À transmettre au plus tard le {dateFr(limite)}
            </div>
          </div>
          <button onClick={() => allerA(decalerSemaine(semaine, 1))} disabled={semaine.id === semaineCourante.id} aria-label="Semaine suivante" className={`p-2 rounded border disabled:opacity-30 ${isDark ? "border-gray-600" : "border-gray-300"}`}><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-2">
          {statutChip(rapport?.statut)}
          {rapport?.transmisLe && <span className={`text-xs ${muted}`}>transmis le {dateFr(rapport.transmisLe)}{rapport.moyenTransmission ? ` (${rapport.moyenTransmission})` : ""}</span>}
        </div>
      </div>

      {(() => {
        const prec = semainePrecedente(today);
        const rp = rapports.find((x) => x.id === prec.id);
        if (semaine.id === prec.id || rp?.statut === "Transmis") return null;
        return (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <b>Rapport de la semaine passée (S{String(prec.numero).padStart(2, "0")}) à transmettre</b> au plus tard le {dateFr(dateLimite(prec, cfg))}
              {today > dateLimite(prec, cfg) ? <b className="text-red-600"> — en retard</b> : ""}.
            </span>
            <button onClick={() => allerA(prec)} className="px-3 py-1.5 rounded bg-amber-500 text-white font-semibold">Ouvrir S{String(prec.numero).padStart(2, "0")}</button>
          </div>
        );
      })()}

      {verrouille && (() => {
        const autoCas = MALADIES_THLO.reduce((x, m) => x + somme(auto.cas[m.id]), 0);
        const autoDeces = MALADIES_THLO.reduce((x, m) => x + somme(auto.deces[m.id]), 0);
        const change = MALADIES_THLO.some((m) => auto.cas[m.id].some((v, i) => v !== valeurs.cas[m.id][i]) || auto.deces[m.id].some((v, i) => v !== valeurs.deces[m.id][i]));
        if (!change) return null;
        return (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-500/10 p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              <b>Des dossiers de cette semaine ont changé depuis la validation</b> : les dossiers comptent maintenant {autoCas} cas et {autoDeces} décès, contre {totalCas} cas et {totalDeces} décès dans le rapport figé.
              {" "}Rouvrez le rapport pour le mettre à jour{rapport?.statut === "Transmis" ? " puis transmettez un rectificatif au District" : ""}.
            </span>
            <button onClick={rouvrir} className="px-3 py-1.5 rounded bg-amber-500 text-white font-semibold">Rouvrir et mettre à jour</button>
          </div>
        );
      })()}

      {immediates.length > 0 && (
        <div className="rounded-lg border-2 border-red-500 bg-red-500/10 p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <div className="font-bold text-red-600">Maladie à notification immédiate : {immediates.map((m) => m.nom).join(", ")}</div>
            Le District doit être prévenu dans les 24 heures, sans attendre le rapport hebdomadaire (fiche individuelle de notification).
          </div>
        </div>
      )}

      {/* Fiche TLOH : en-tête + paludisme / dengue / autres */}
      <div className={`${card} p-4 space-y-3`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-lg font-bold uppercase tracking-wide">{cfg.formationSanitaire || "Formation sanitaire"}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-bold">TLOH N°</span>
              {verrouille ? (
                <b>{numeroTLOH(rapport, semaine)}</b>
              ) : (
                <input
                  value={numDraft} onChange={(e) => setNumDraft(e.target.value)} onBlur={enregistrerFiche}
                  placeholder={String(semaine.numero).padStart(2, "0")}
                  className={`w-24 px-2 py-1 rounded border bg-transparent font-bold ${isDark ? "border-gray-600" : "border-gray-300"}`}
                />
              )}
              <span className={`text-xs ${muted}`}>(par défaut : n° de la semaine)</span>
            </div>
          </div>
          <div className={`text-xs ${muted} max-w-md`}>
            Calcul automatique : TDR à partir des résultats du laboratoire et des diagnostics (« TDR+ », « TDR négatif ») ; PS et PG = lignes paludisme du tableau ; dengue « probable » si le diagnostic le dit ou si un test dengue est positif.
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {INDICATEURS_FICHE.map((ind) => {
            const v = indicateurs[ind.cle];
            const corr = rapport?.indicateursCorrections?.[ind.cle];
            const corrige = !verrouille && corr !== null && corr !== undefined && ind.cle !== "ps" && ind.cle !== "pg";
            const lectureSeule = verrouille || ind.cle === "ps" || ind.cle === "pg";
            return (
              <div key={ind.cle} className={`rounded-lg border p-2 ${corrige ? "border-amber-500 bg-amber-500/10" : isDark ? "border-gray-700" : "border-gray-200"}`} title={ind.aide}>
                <div className={`text-xs font-semibold ${muted}`}>{ind.label}</div>
                {lectureSeule ? (
                  <div className="text-2xl font-bold">{v}</div>
                ) : (
                  <input type="number" min={0} inputMode="numeric" value={v} onChange={(e) => corrigerIndicateur(ind.cle, e.target.value)}
                    className="w-full text-2xl font-bold bg-transparent outline-none" />
                )}
                {corrige && (
                  <button onClick={() => { const r = baseRapport(); sauver({ ...r, indicateursCorrections: { ...(r.indicateursCorrections || {}), [ind.cle]: null } }); }}
                    className="text-[11px] text-amber-600 inline-flex items-center gap-0.5"><RotateCcw className="w-3 h-3" /> auto ({(autoInd.valeurs as Record<string, number>)[ind.cle]})</button>
                )}
                {(ind.cle === "ps" || ind.cle === "pg") && !verrouille && <div className={`text-[11px] ${muted}`}>suit le tableau</div>}
              </div>
            );
          })}
        </div>

        {(() => {
          const alertes: string[] = [];
          if (indicateurs.tdrPositifs + indicateurs.tdrNegatifs !== indicateurs.tdrRealises)
            alertes.push(`TDR + (${indicateurs.tdrPositifs}) + TDR − (${indicateurs.tdrNegatifs}) ≠ TDR réalisés (${indicateurs.tdrRealises})${autoInd.details.some((d) => d.cle === "tdr" && d.resultat === "indetermine") ? " : certains résultats de TDR sont illisibles, vérifiez le détail" : ""}.`);
          if (indicateurs.ps + indicateurs.pg > indicateurs.tdrPositifs && indicateurs.tdrRealises > 0)
            alertes.push(`PS + PG (${indicateurs.ps + indicateurs.pg}) dépasse le nombre de TDR positifs (${indicateurs.tdrPositifs}) : des cas de paludisme ont-ils été confirmés autrement (goutte épaisse) ?`);
          const dengueTableau = somme(valeurs.cas["dengue"] || zero());
          if (indicateurs.dengueSuspect + indicateurs.dengueProbable !== dengueTableau)
            alertes.push(`Dengue : suspects + probables (${indicateurs.dengueSuspect + indicateurs.dengueProbable}) ≠ cas de dengue du tableau (${dengueTableau}).`);
          return alertes.length > 0 && !verrouille ? (
            <div className="text-sm text-amber-600 space-y-0.5">{alertes.map((a, i) => <div key={i} className="flex gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {a}</div>)}</div>
          ) : null;
        })()}

        <div className="flex flex-wrap gap-3 text-xs">
          {(["tdr", "dengue"] as const).map((k) => {
            const n = autoInd.details.filter((d) => d.cle === k).length;
            return n > 0 ? (
              <button key={k} onClick={() => setDetailInd(detailInd === k ? null : k)} className="font-semibold text-emerald-600">
                {detailInd === k ? "Masquer" : `Voir les ${n} ${k === "tdr" ? "TDR" : "cas de dengue"} trouvés`}
              </button>
            ) : null;
          })}
        </div>
        {detailInd && (
          <div className={`rounded p-2 text-xs space-y-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
            {autoInd.details.filter((d) => d.cle === detailInd).map((d, i) => (
              <div key={i} className="flex flex-wrap gap-x-3">
                <b>{d.patient}</b><span>{dateFr(d.date)}</span><span>{d.source}</span>
                <span className={`font-semibold ${d.resultat === "positif" || d.resultat === "probable" ? "text-red-600" : d.resultat === "indetermine" ? "text-amber-600" : ""}`}>{d.resultat === "indetermine" ? "résultat illisible" : d.resultat}</span>
                <span className={muted}>« {d.texte} »</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="text-sm font-medium">Autres</label>
          {verrouille ? (
            <div className="text-sm mt-1">{autresTexte || "RAS"}</div>
          ) : (
            <textarea
              className="w-full mt-1 px-3 py-2 rounded border bg-transparent min-h-[50px]"
              value={autresDraft} onChange={(e) => setAutresDraft(e.target.value)} onBlur={enregistrerFiche}
              placeholder={autresAutomatique ? `Automatique : ${autresAutomatique}` : "RAS (aucune autre maladie sous surveillance cette semaine)"}
            />
          )}
          {!verrouille && !autresDraft.trim() && <p className={`text-xs ${muted}`}>Laissé vide, le rapport reprend automatiquement les autres maladies du tableau ci-dessous.</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          ["Dossiers de la semaine", auto.nbDossiersAnalyses],
          ["Encore sans diagnostic", auto.sansDiagnostic],
          ["Cas notifiés", totalCas],
          ["Décès", totalDeces],
          ["Maladies avec cas", maladiesAvecCas.length],
        ].map(([l, v]) => (
          <div key={l as string} className={`${card} p-3`}>
            <div className={`text-xs uppercase font-semibold ${muted}`}>{l}</div>
            <div className={`text-2xl font-bold ${l === "Décès" && Number(v) > 0 ? "text-red-600" : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      {agesAVerifier > 0 && !verrouille && (
        <p className="text-sm text-amber-600 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {agesAVerifier} cas sans âge renseigné (classés en « 15 ans et + ») : vérifiez-les dans le détail et corrigez la tranche d'âge si besoin.
        </p>
      )}

      {/* Tableau */}
      <div className={`${card} p-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="font-semibold">Cas et décès par tranche d'âge</div>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={seulementAvecCas} onChange={(e) => setSeulementAvecCas(e.target.checked)} /> Seulement les maladies avec des cas
          </label>
        </div>
        {!verrouille && <p className={`text-xs mb-2 ${muted}`}>Les chiffres sont calculés automatiquement. Vous pouvez les corriger : une case corrigée devient orange.</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`text-xs ${muted}`}>
                <th rowSpan={2} className="text-left px-2 py-1 align-bottom">Maladie</th>
                <th colSpan={5} className="px-1 py-1 border-b">Cas</th>
                <th colSpan={5} className="px-1 py-1 border-b">Décès</th>
                <th rowSpan={2}></th>
              </tr>
              <tr className={`text-[11px] ${muted}`}>
                {TRANCHES_AGE.map((t) => <th key={"c" + t} className="px-1 py-1 whitespace-nowrap">{t}</th>)}
                <th className="px-1 py-1">Total</th>
                {TRANCHES_AGE.map((t) => <th key={"d" + t} className="px-1 py-1 whitespace-nowrap">{t}</th>)}
                <th className="px-1 py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((m) => {
                const nbDetails = auto.details.filter((d) => d.maladieId === m.id).length;
                const aCorrection = !verrouille && !!rapport?.corrections?.[m.id];
                return (
                  <React.Fragment key={m.id}>
                    <tr className={`border-t ${isDark ? "border-gray-700" : "border-gray-100"} ${somme(valeurs.cas[m.id]) ? (isDark ? "bg-gray-900/40" : "bg-emerald-50/50") : ""}`}>
                      <td className="px-2 py-1 font-medium">
                        {m.nom}
                        {m.immediate && <span title="Notification immédiate (24 h)" className="ml-1 text-red-600">⚠</span>}
                      </td>
                      {[0, 1, 2, 3].map((i) => cellule(m, "cas", i))}
                      <td className="px-1 py-1 text-center font-bold">{somme(valeurs.cas[m.id])}</td>
                      {[0, 1, 2, 3].map((i) => cellule(m, "deces", i))}
                      <td className={`px-1 py-1 text-center font-bold ${somme(valeurs.deces[m.id]) ? "text-red-600" : ""}`}>{somme(valeurs.deces[m.id])}</td>
                      <td className="px-1 py-1 whitespace-nowrap text-right">
                        {nbDetails > 0 && (
                          <button onClick={() => setDetailId(detailId === m.id ? null : m.id)} className="text-xs font-semibold text-emerald-600">
                            {detailId === m.id ? "Masquer" : `Voir ${nbDetails} dossier${nbDetails > 1 ? "s" : ""}`}
                          </button>
                        )}
                        {aCorrection && (
                          <button onClick={() => annulerCorrection(m.id)} title="Revenir aux valeurs automatiques" className="ml-2 text-xs text-amber-600 inline-flex items-center gap-0.5"><RotateCcw className="w-3 h-3" /> auto</button>
                        )}
                      </td>
                    </tr>
                    {detailId === m.id && (
                      <tr>
                        <td colSpan={12} className="px-2 pb-2">
                          <div className={`rounded p-2 text-xs space-y-1 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
                            {auto.details.filter((d) => d.maladieId === m.id).map((d) => (
                              <div key={d.refId + (d.deces ? "d" : "")} className="flex flex-wrap gap-x-3">
                                <b>{d.patient}</b>
                                <span>{dateFr(d.date)}</span>
                                <span>{d.source}</span>
                                <span>{TRANCHES_AGE[d.tranche]}{d.ageInconnu ? " (âge non renseigné)" : ""}</span>
                                <span className={muted}>« {d.texte} »</span>
                                {d.deces && <span className="text-red-600 font-semibold">Décès</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <tr className={`border-t-2 font-bold ${isDark ? "border-gray-600" : "border-gray-300"}`}>
                <td className="px-2 py-1">TOTAL</td>
                {[0, 1, 2, 3].map((i) => <td key={i} className="text-center">{MALADIES_THLO.reduce((s, m) => s + valeurs.cas[m.id][i], 0)}</td>)}
                <td className="text-center">{totalCas}</td>
                {[0, 1, 2, 3].map((i) => <td key={i} className="text-center">{MALADIES_THLO.reduce((s, m) => s + valeurs.deces[m.id][i], 0)}</td>)}
                <td className={`text-center ${totalDeces ? "text-red-600" : ""}`}>{totalDeces}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Observations et actions */}
      <div className={`${card} p-4 space-y-3`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="text-sm font-medium">Observations (rupture d'intrants, rumeurs, alertes communautaires…)</label>
            <textarea className="w-full mt-1 px-3 py-2 rounded border bg-transparent min-h-[70px]" disabled={verrouille} value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => !verrouille && (obs !== (rapport?.observations || "")) && enregistrerTexte()} />
          </div>
          <div>
            <label className="text-sm font-medium">Rédigé par</label>
            <input className="w-full mt-1 px-3 py-2 rounded border bg-transparent" disabled={verrouille} value={redige} onChange={(e) => setRedige(e.target.value)} onBlur={() => !verrouille && (redige !== (rapport?.redigePar || "")) && enregistrerTexte()} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={telechargerPDF} className={`px-3 py-2 rounded border text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}><FileDown className="w-4 h-4" /> PDF</button>
          <button onClick={copier} className={`px-3 py-2 rounded border text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}><ClipboardCopy className="w-4 h-4" /> Copier le texte</button>
          {verrouille ? (
            <button onClick={rouvrir} className={`px-3 py-2 rounded border text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}><Unlock className="w-4 h-4" /> Rouvrir</button>
          ) : (
            <button onClick={valider} className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-blue-700"><Lock className="w-4 h-4" /> Valider les chiffres</button>
          )}
          {numDistrict ? (
            <a href={`https://wa.me/${numDistrict}?text=${encodeURIComponent(texte)}`} target="_blank" rel="noopener noreferrer" onClick={() => marquerTransmis("WhatsApp")}
              className="px-3 py-2 rounded bg-[#25D366] text-white text-sm font-semibold flex items-center gap-1.5">
              <Send className="w-4 h-4" /> Transmettre au District (WhatsApp)
            </a>
          ) : (
            <button onClick={() => { setCfgDraft(cfg); setShowConfig(true); }} className="px-3 py-2 rounded bg-[#25D366] text-white text-sm font-semibold flex items-center gap-1.5">
              <Send className="w-4 h-4" /> Transmettre au District
            </button>
          )}
          {rapport?.statut !== "Transmis" && (
            <button onClick={() => { if (window.confirm("Marquer ce rapport comme transmis (par un autre moyen : papier, DHIS2, SMS) ?")) marquerTransmis("Autre moyen"); }} className={`px-3 py-2 rounded border text-sm font-semibold flex items-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}>
              <CheckCircle2 className="w-4 h-4" /> Déjà transmis autrement
            </button>
          )}
        </div>
        {!numDistrict && <p className={`text-xs text-right ${muted}`}>Renseignez le WhatsApp du point focal du District dans les Réglages pour transmettre en un clic.</p>}
      </div>

      {/* Historique */}
      <div className={`${card} p-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <h3 className="font-semibold">12 dernières semaines</h3>
          <div className={`text-sm ${muted}`}>
            Complétude : <b>{transmises.length}/12</b> rapports transmis · Promptitude : <b>{aTemps.length}/{transmises.length || 0}</b> à temps
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {historique.map(({ s, r }) => {
            const enRetard = !r || r.statut !== "Transmis" ? today > dateLimite(s, cfg) : r.transmisLe!.slice(0, 10) > dateLimite(s, cfg);
            const tc = r?.valeursFigees ? MALADIES_THLO.reduce((x, m) => x + somme(r.valeursFigees!.cas[m.id] || zero()), 0) : null;
            return (
              <button key={s.id} onClick={() => allerA(s)}
                className={`text-left rounded border p-2 ${s.id === semaine.id ? "ring-2 ring-emerald-500" : ""} ${isDark ? "border-gray-700 hover:bg-gray-700" : "border-gray-200 hover:bg-gray-50"}`}>
                <div className="flex justify-between items-center gap-1">
                  <b className="text-sm">S{String(s.numero).padStart(2, "0")}</b>
                  {statutChip(r?.statut)}
                </div>
                <div className={`text-xs ${muted}`}>{dateFr(s.debut).replace(/ \d{4}$/, "")} → {dateFr(s.fin).replace(/ \d{4}$/, "")}</div>
                <div className={`text-xs mt-0.5 ${enRetard ? "text-red-600 font-semibold" : muted}`}>
                  {tc !== null ? `${tc} cas · ` : ""}{r?.statut === "Transmis" ? (enRetard ? "transmis en retard" : "transmis à temps") : enRetard ? "en retard" : "à faire"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
