/**
 * Salle infirmier — Examens au lit du patient.
 *
 * Les tests rapides prescrits par le médecin (TDR paludisme/dengue, glycémie
 * capillaire, test de grossesse, bandelette urinaire, hémoglobine, tests
 * rapides VIH/syphilis/AgHBs…) arrivent ici au lieu du laboratoire.
 * L'infirmier(ère) réalise l'examen, remplit la fiche, et le résultat est
 * renvoyé automatiquement au médecin prescripteur (statut « Prêt », visible
 * dans sa consultation, dans « Résultats des examens paracliniques »).
 */
import React, { useMemo, useState } from "react";
import { Consultation, ExamenLabo } from "../types";
import { getTodayStr } from "../data";
import {
  ResultatTDR, TdrDengue, dengueComplet, interpreterDengue, alerteDengue, texteResultatTdr,
} from "../modules/thlo/tdr";
import {
  testsDetectes, enSalleInfirmier, examenTermine, TypeTestInfirmier,
  PARAMETRES_BANDELETTE, COTATIONS_BANDELETTE, interpreterGlycemie, interpreterHb,
} from "../lib/examensInfirmier";
import { FlaskConical, Send, Printer, ArrowLeftRight, AlertTriangle, CheckCircle2, X } from "lucide-react";

interface Props {
  examens: ExamenLabo[];
  onUpdateExamens: (e: ExamenLabo[]) => void;
  consultations: Consultation[];
  agentNom?: string;
  isDark: boolean;
}

const LIBELLES: Record<TypeTestInfirmier, string> = {
  tdr_palu: "TDR Paludisme",
  tdr_dengue: "TDR Dengue",
  glycemie: "Glycémie capillaire",
  grossesse: "Test de grossesse",
  hemoglobine: "Hémoglobine",
  bandelette: "Bandelette urinaire",
  rapide: "Test rapide",
};

export default function ExamensSalleInfirmier({ examens, onUpdateExamens, consultations, agentNom = "", isDark }: Props) {
  const [ficheId, setFicheId] = useState<string | null>(null);
  const [voirTermines, setVoirTermines] = useState(false);

  const aFaire = useMemo(
    () =>
      examens
        .filter((e) => enSalleInfirmier(e) && !examenTermine(e))
        .sort((a, b) => (a.priorite === "urgente" ? -1 : 0) - (b.priorite === "urgente" ? -1 : 0) || (a.createdAt || "").localeCompare(b.createdAt || "")),
    [examens]
  );
  const termines = useMemo(
    () => examens.filter((e) => enSalleInfirmier(e) && examenTermine(e)).sort((a, b) => (b.renvoyeAuMedecinLe || b.dateResultat || "").localeCompare(a.renvoyeAuMedecinLe || a.dateResultat || "")).slice(0, 50),
    [examens]
  );

  const nonPaye = (e: ExamenLabo) =>
    consultations.some((c) => c.patient.trim().toLowerCase() === e.patient.trim().toLowerCase() && c.statut === "Attente paiement actes");

  const renvoyerAuLabo = (e: ExamenLabo) => {
    if (!window.confirm(`Renvoyer l'examen « ${e.analyses} » de ${e.patient} au laboratoire ?`)) return;
    onUpdateExamens(examens.map((x) => (x.id === e.id ? { ...x, lieuExecution: "Laboratoire" } : x)));
  };

  const carte = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const sous = isDark ? "text-gray-400" : "text-gray-500";
  const examenFiche = examens.find((e) => e.id === ficheId) || null;

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5" /> Examens à faire en salle infirmier
          </h2>
          <p className={`text-sm ${sous}`}>
            Tests rapides prescrits par le médecin. Faites l'examen, remplissez la fiche : le résultat repart automatiquement au médecin prescripteur.
          </p>
        </div>
        <button
          onClick={() => setVoirTermines((v) => !v)}
          className={`text-sm font-semibold px-3 py-1.5 rounded-lg border ${isDark ? "border-gray-600" : "border-gray-300"}`}
        >
          {voirTermines ? "Voir les examens à faire" : `Résultats déjà renvoyés (${termines.length})`}
        </button>
      </div>

      {!voirTermines && aFaire.length === 0 && (
        <div className={`rounded-xl border p-6 text-center ${carte} ${sous}`}>Aucun examen en attente en salle infirmier.</div>
      )}

      {!voirTermines &&
        aFaire.map((e) => {
          const bloque = nonPaye(e);
          const tests = testsDetectes(e.analyses || e.examen);
          return (
            <div key={e.id} className={`rounded-xl border p-4 flex flex-wrap items-center justify-between gap-3 ${carte} ${e.priorite === "urgente" ? "ring-2 ring-red-400" : ""}`}>
              <div className="min-w-0">
                <div className="font-bold flex items-center gap-2 flex-wrap">
                  {e.patient}
                  {e.priorite === "urgente" && <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">URGENT</span>}
                </div>
                <div className="text-sm font-semibold text-emerald-700">{e.analyses || e.examen}</div>
                <div className={`text-xs ${sous}`}>
                  Prescrit par {e.prescripteur || "—"} · {new Date(e.dateDemande).toLocaleDateString("fr-FR")}
                  {tests.length > 0 && <> · Fiche : {tests.map((t) => LIBELLES[t]).join(", ")}</>}
                </div>
                {bloque && (
                  <div className="text-xs font-semibold text-amber-700 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Le patient doit d'abord régler les actes prescrits au secrétariat.
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => renvoyerAuLabo(e)}
                  title="Cet examen doit finalement être fait au laboratoire"
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-1 ${isDark ? "border-gray-600" : "border-gray-300"}`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" /> Envoyer au labo
                </button>
                <button
                  disabled={bloque}
                  onClick={() => setFicheId(e.id)}
                  className="text-sm font-bold px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Faire l'examen
                </button>
              </div>
            </div>
          );
        })}

      {voirTermines && (
        <div className="space-y-2">
          {termines.length === 0 && <div className={`rounded-xl border p-6 text-center ${carte} ${sous}`}>Aucun résultat renvoyé pour l'instant.</div>}
          {termines.map((e) => (
            <div key={e.id} className={`rounded-xl border p-3 flex flex-wrap items-start justify-between gap-3 ${carte}`}>
              <div className="min-w-0">
                <div className="font-bold">{e.patient} <span className="text-sm font-semibold text-emerald-700">— {e.analyses}</span></div>
                <pre className={`text-xs whitespace-pre-wrap font-mono mt-1 ${isDark ? "text-gray-200" : "text-gray-700"}`}>{e.resultat}</pre>
                <div className={`text-xs mt-1 ${sous}`}>
                  {e.interpretation && <>Interprétation : <b>{e.interpretation}</b> · </>}
                  Fait par {e.technicien || "—"} · renvoyé à {e.prescripteur || "médecin"}
                  {e.renvoyeAuMedecinLe && <> le {new Date(e.renvoyeAuMedecinLe).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</>}
                </div>
              </div>
              <button onClick={() => imprimerFiche(e)} className={`text-xs font-semibold px-3 py-2 rounded-lg border flex items-center gap-1 ${isDark ? "border-gray-600" : "border-gray-300"}`}>
                <Printer className="w-3.5 h-3.5" /> Imprimer la fiche
              </button>
            </div>
          ))}
        </div>
      )}

      {examenFiche && (
        <FicheResultat
          examen={examenFiche}
          agentNom={agentNom}
          isDark={isDark}
          onAnnuler={() => setFicheId(null)}
          onValider={(maj) => {
            onUpdateExamens(examens.map((x) => (x.id === maj.id ? maj : x)));
            setFicheId(null);
            alert(`Résultat enregistré et renvoyé au médecin prescripteur (${maj.prescripteur || "médecin"}).`);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fiche de résultat
// ---------------------------------------------------------------------------

function FicheResultat({
  examen, agentNom, isDark, onAnnuler, onValider,
}: {
  examen: ExamenLabo;
  agentNom: string;
  isDark: boolean;
  onAnnuler: () => void;
  onValider: (e: ExamenLabo) => void;
}) {
  const tests = testsDetectes(examen.analyses || examen.examen);
  const a = (t: TypeTestInfirmier) => tests.includes(t);

  const [palu, setPalu] = useState<ResultatTDR | "">(examen.tdrPalu || "");
  const [dengue, setDengue] = useState<TdrDengue>(examen.tdrDengue || {});
  const [glyc, setGlyc] = useState(examen.ficheInfirmier?.glycemie?.toString() || "");
  const [unite, setUnite] = useState<"g/L" | "mmol/L">("g/L");
  const [aJeun, setAJeun] = useState(!!examen.ficheInfirmier?.aJeun);
  const [hb, setHb] = useState(examen.ficheInfirmier?.hemoglobine?.toString() || "");
  const [grossesse, setGrossesse] = useState<ResultatTDR | "">(examen.ficheInfirmier?.testGrossesse || "");
  const [rapide, setRapide] = useState<ResultatTDR | "">(examen.ficheInfirmier?.testRapide || "");
  const [bandelette, setBandelette] = useState<Record<string, string>>(examen.ficheInfirmier?.bandelette || {});
  const [observations, setObservations] = useState(examen.ficheInfirmier?.observations || "");
  const [interpretation, setInterpretation] = useState("");
  const [agent, setAgent] = useState(agentNom);
  const [heure, setHeure] = useState(() => new Date().toTimeString().slice(0, 5));

  const glycGL = (() => {
    const v = parseFloat(glyc.replace(",", "."));
    if (!isFinite(v) || v <= 0) return null;
    return unite === "mmol/L" ? Math.round((v * 0.18) * 100) / 100 : v;
  })();
  const hbVal = (() => { const v = parseFloat(hb.replace(",", ".")); return isFinite(v) && v > 0 ? v : null; })();
  const interpGlyc = a("glycemie") && glycGL !== null ? interpreterGlycemie(glycGL, aJeun) : null;
  const interpHb = a("hemoglobine") && hbVal !== null ? interpreterHb(hbVal) : null;
  const interpDengue = a("tdr_dengue") ? interpreterDengue(dengue) : null;
  const avertDengue = a("tdr_dengue") ? alerteDengue(dengue) : null;

  const valider = () => {
    // Contrôles obligatoires selon les tests de la demande.
    if (a("tdr_palu") && !palu) return alert("TDR Paludisme : indiquez POSITIF ou NÉGATIF.");
    if (a("tdr_dengue") && !dengueComplet(dengue)) return alert("TDR Dengue : indiquez le résultat des 3 bandes (NS1, IgM, IgG).");
    if (a("glycemie") && glycGL === null) return alert("Glycémie : saisissez la valeur mesurée.");
    if (a("hemoglobine") && hbVal === null) return alert("Hémoglobine : saisissez la valeur mesurée.");
    if (a("grossesse") && !grossesse) return alert("Test de grossesse : indiquez POSITIF ou NÉGATIF.");
    if (a("rapide") && !rapide) return alert("Test rapide : indiquez POSITIF ou NÉGATIF.");
    if (a("bandelette") && Object.keys(bandelette).length === 0) return alert("Bandelette urinaire : renseignez au moins un paramètre.");
    if (tests.length === 0 && !observations.trim()) return alert("Saisissez le résultat de l'examen.");
    if (!agent.trim()) return alert("Indiquez le nom de l'agent qui a réalisé l'examen.");

    const L: string[] = [];
    const tdr = texteResultatTdr(a("tdr_palu") ? (palu as ResultatTDR) : undefined, a("tdr_dengue") ? dengue : undefined);
    if (tdr) L.push(tdr);
    if (a("glycemie") && glycGL !== null) L.push(`Glycémie capillaire (${aJeun ? "à jeun" : "hors jeûne"}) : ${glycGL.toLocaleString("fr-FR")} g/L${unite === "mmol/L" ? ` (${glyc} mmol/L)` : ""} → ${interpGlyc?.libelle}`);
    if (a("hemoglobine") && hbVal !== null) L.push(`Hémoglobine : ${hbVal.toLocaleString("fr-FR")} g/dL → ${interpHb?.libelle}`);
    if (a("grossesse")) L.push(`Test de grossesse urinaire : ${(grossesse as string).toUpperCase()}`);
    if (a("rapide")) L.push(`${examen.analyses} : ${(rapide as string).toUpperCase()}`);
    if (a("bandelette")) L.push(`Bandelette urinaire : ${Object.entries(bandelette).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    if (observations.trim()) L.push(`Observations : ${observations.trim()}`);
    L.push(`(Réalisé en salle infirmier à ${heure})`);

    const critique = interpGlyc?.critique || interpHb?.critique;
    const anormal =
      critique || interpGlyc?.anormal || interpHb?.anormal || palu === "Positif" || rapide === "Positif" || interpDengue?.probable ||
      Object.values(bandelette).some((v) => v !== "Négatif" && v !== "" && !/^\d/.test(v));
    const interpAuto = [
      palu ? `TDR paludisme ${palu.toLowerCase()}` : "",
      interpDengue?.libelle || "",
      interpGlyc?.libelle || "",
      interpHb?.libelle || "",
      grossesse ? `Grossesse : test ${grossesse.toLowerCase()}` : "",
    ].filter(Boolean).join(" ; ");
    const niveau = critique ? "Critique" : anormal ? "Anormal" : "Normal";

    const fiche: NonNullable<ExamenLabo["ficheInfirmier"]> = { heure };
    if (glycGL !== null && a("glycemie")) { fiche.glycemie = glycGL; fiche.aJeun = aJeun; }
    if (hbVal !== null && a("hemoglobine")) fiche.hemoglobine = hbVal;
    if (grossesse && a("grossesse")) fiche.testGrossesse = grossesse;
    if (rapide && a("rapide")) fiche.testRapide = rapide;
    if (a("bandelette")) fiche.bandelette = bandelette;
    if (observations.trim()) fiche.observations = observations.trim();

    const maj: ExamenLabo = {
      ...examen,
      statut: "Prêt",
      resultat: L.join("\n"),
      interpretation: interpretation.trim() || `${niveau}${interpAuto ? " — " + interpAuto : ""}`,
      technicien: agent.trim(),
      dateResultat: getTodayStr(),
      ficheInfirmier: fiche,
      renvoyeAuMedecinLe: new Date().toISOString(),
    };
    if (a("tdr_palu") && palu) maj.tdrPalu = palu;
    if (a("tdr_dengue") && dengueComplet(dengue)) maj.tdrDengue = { ...dengue };
    onValider(maj);
  };

  const fond = isDark ? "bg-gray-900 text-gray-100" : "bg-white text-gray-900";
  const champ = `w-full rounded-lg border px-3 py-2 text-sm ${isDark ? "bg-gray-800 border-gray-600" : "bg-gray-50 border-gray-300"}`;
  const bloc = `rounded-xl border p-3 space-y-2 ${isDark ? "border-gray-700" : "border-gray-200"}`;

  const PosNeg = ({ val, set }: { val: string; set: (v: ResultatTDR) => void }) => (
    <div className="flex gap-2">
      {(["Positif", "Négatif"] as ResultatTDR[]).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => set(r)}
          className={`flex-1 py-2 rounded-lg text-sm font-bold border ${
            val === r ? (r === "Positif" ? "bg-red-600 text-white border-red-600" : "bg-emerald-600 text-white border-emerald-600") : isDark ? "border-gray-600" : "border-gray-300"
          }`}
        >
          {r === "Positif" ? "POSITIF (+)" : "NÉGATIF (−)"}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center overflow-y-auto p-4">
      <div className={`w-full max-w-xl rounded-2xl shadow-xl p-5 space-y-4 ${fond}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold">Fiche de résultat — salle infirmier</h3>
            <div className="text-sm"><b>{examen.patient}</b> · {examen.analyses}</div>
            <div className="text-xs opacity-70">Prescripteur : {examen.prescripteur || "—"}</div>
          </div>
          <button onClick={onAnnuler} aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>

        {a("tdr_palu") && (
          <div className={bloc}>
            <div className="font-semibold text-sm">TDR Paludisme *</div>
            <PosNeg val={palu} set={setPalu} />
            {palu === "Positif" && <p className="text-xs opacity-70">Le classement PS / PG reste décidé par le médecin selon les signes cliniques.</p>}
          </div>
        )}

        {a("tdr_dengue") && (
          <div className={bloc}>
            <div className="font-semibold text-sm">TDR Dengue * (3 bandes)</div>
            {(["ns1", "igm", "igg"] as const).map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-12 text-sm font-semibold uppercase">{k}</span>
                <div className="flex-1"><PosNeg val={dengue[k] || ""} set={(v) => setDengue({ ...dengue, [k]: v })} /></div>
              </div>
            ))}
            <label className="text-xs flex items-center gap-2">
              Jour de fièvre (J)
              <input type="number" min={1} max={30} value={dengue.jourFievre || ""} onChange={(e) => setDengue({ ...dengue, jourFievre: e.target.value ? Number(e.target.value) : undefined })} className={`${champ} w-20`} />
            </label>
            {interpDengue && <p className="text-xs font-semibold">{interpDengue.libelle}</p>}
            {avertDengue && <p className="text-xs text-amber-600">{avertDengue}</p>}
          </div>
        )}

        {a("glycemie") && (
          <div className={bloc}>
            <div className="font-semibold text-sm">Glycémie capillaire *</div>
            <div className="flex gap-2">
              <input inputMode="decimal" placeholder="Valeur" value={glyc} onChange={(e) => setGlyc(e.target.value)} className={champ} />
              <select value={unite} onChange={(e) => setUnite(e.target.value as "g/L" | "mmol/L")} className={`${champ} w-28`}>
                <option>g/L</option>
                <option>mmol/L</option>
              </select>
            </div>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={aJeun} onChange={(e) => setAJeun(e.target.checked)} /> Patient à jeun</label>
            {interpGlyc && <p className={`text-xs font-semibold ${interpGlyc.critique ? "text-red-600" : interpGlyc.anormal ? "text-amber-600" : "text-emerald-600"}`}>{interpGlyc.libelle}{unite === "mmol/L" && glycGL !== null ? ` (= ${glycGL} g/L)` : ""}</p>}
          </div>
        )}

        {a("hemoglobine") && (
          <div className={bloc}>
            <div className="font-semibold text-sm">Hémoglobine (g/dL) *</div>
            <input inputMode="decimal" placeholder="ex : 11,5" value={hb} onChange={(e) => setHb(e.target.value)} className={champ} />
            {interpHb && <p className={`text-xs font-semibold ${interpHb.critique ? "text-red-600" : interpHb.anormal ? "text-amber-600" : "text-emerald-600"}`}>{interpHb.libelle}</p>}
          </div>
        )}

        {a("grossesse") && (
          <div className={bloc}>
            <div className="font-semibold text-sm">Test de grossesse urinaire *</div>
            <PosNeg val={grossesse} set={setGrossesse} />
          </div>
        )}

        {a("rapide") && (
          <div className={bloc}>
            <div className="font-semibold text-sm">{examen.analyses} *</div>
            <PosNeg val={rapide} set={setRapide} />
          </div>
        )}

        {a("bandelette") && (
          <div className={bloc}>
            <div className="font-semibold text-sm">Bandelette urinaire *</div>
            <div className="grid grid-cols-2 gap-2">
              {PARAMETRES_BANDELETTE.map((p) => (
                <label key={p} className="text-xs">
                  {p}
                  {p === "pH" || p === "Densité" ? (
                    <input value={bandelette[p] || ""} placeholder={p === "pH" ? "ex : 6" : "ex : 1,015"} onChange={(e) => setBandelette({ ...bandelette, [p]: e.target.value })} className={champ} />
                  ) : (
                    <select value={bandelette[p] || ""} onChange={(e) => { const v = { ...bandelette }; if (e.target.value) v[p] = e.target.value; else delete v[p]; setBandelette(v); }} className={champ}>
                      <option value="">—</option>
                      {COTATIONS_BANDELETTE.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className={bloc}>
          <div className="font-semibold text-sm">{tests.length === 0 ? "Résultat de l'examen *" : "Observations (facultatif)"}</div>
          <textarea rows={3} value={observations} onChange={(e) => setObservations(e.target.value)} className={champ} placeholder="Constat, remarques, difficulté de prélèvement…" />
          <label className="text-xs block">
            Interprétation (laisser vide pour l'interprétation automatique)
            <input value={interpretation} onChange={(e) => setInterpretation(e.target.value)} className={champ} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Réalisé par *<input value={agent} onChange={(e) => setAgent(e.target.value)} className={champ} /></label>
          <label className="text-xs">Heure<input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} className={champ} /></label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onAnnuler} className={`px-4 py-2 rounded-lg text-sm font-semibold border ${isDark ? "border-gray-600" : "border-gray-300"}`}>Annuler</button>
          <button onClick={valider} className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2">
            <Send className="w-4 h-4" /> Enregistrer et renvoyer au médecin
          </button>
        </div>
        <p className="text-xs opacity-60 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Les TDR paludisme et dengue saisis ici sont comptés automatiquement dans le TLOH.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impression de la fiche de résultat
// ---------------------------------------------------------------------------

function imprimerFiche(e: ExamenLabo) {
  let nom = "Cabinet Privé de Soins DEO-GRACIAS";
  try { const p = JSON.parse(localStorage.getItem("dg_clinic_profile") || "null"); if (p?.name) nom = p.name; } catch { /* profil absent */ }
  const esc = (s?: string) => (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  const w = window.open("", "_blank");
  if (!w) return alert("Autorisez les fenêtres pop-up pour imprimer.");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fiche examen — ${esc(e.patient)}</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;max-width:700px;margin:auto}h1{font-size:18px;margin:0}h2{font-size:15px;border-bottom:2px solid #059669;padding-bottom:4px}
  td{padding:4px 8px;vertical-align:top}.res{white-space:pre-wrap;font-family:monospace;border:1px solid #ccc;border-radius:6px;padding:10px}.sig{margin-top:40px;display:flex;justify-content:space-between}</style></head><body>
  <h1>${esc(nom)}</h1><h2>Fiche de résultat d'examen — Salle infirmier</h2>
  <table><tr><td><b>Patient</b></td><td>${esc(e.patient)}${e.contact ? " — " + esc(e.contact) : ""}</td></tr>
  <tr><td><b>Examen</b></td><td>${esc(e.analyses || e.examen)}</td></tr>
  <tr><td><b>Prescrit par</b></td><td>${esc(e.prescripteur)} le ${new Date(e.dateDemande).toLocaleDateString("fr-FR")}</td></tr>
  <tr><td><b>Réalisé le</b></td><td>${e.dateResultat ? new Date(e.dateResultat).toLocaleDateString("fr-FR") : ""} ${esc(e.ficheInfirmier?.heure)}</td></tr></table>
  <h2>Résultat</h2><div class="res">${esc(e.resultat)}</div>
  <p><b>Interprétation :</b> ${esc(e.interpretation)}</p>
  <div class="sig"><div>L'agent : <b>${esc(e.technicien)}</b></div><div>Visa du médecin :</div></div>
  <script>window.onload=()=>window.print()</script></body></html>`);
  w.document.close();
}
