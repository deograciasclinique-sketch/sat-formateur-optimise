/**
 * Générateur de rotation de garde pour N agents — édition commerciale (Mode Directeur, onglet Tâches).
 *
 * • On choisit les agents dans l'ordre (2 à 40) et un cycle de postes (ex. Matin → Après-midi → Nuit
 *   → Repos → Repos), modifiable ou choisi parmi des modèles.
 * • Chaque agent suit le même cycle, décalé de quelques jours par rapport au précédent ; l'aperçu
 *   montre qui est à chaque poste chaque jour et signale les postes non couverts.
 */
import React, { useMemo, useState } from "react";
import { RefreshCw, Wand2, Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { Staff, GardeAgent } from "../types";
import { SHIFTS_GARDE } from "../lib/horaires";
import { getTodayStr } from "../data";

type Props = { staff: Staff[]; gardes: GardeAgent[]; onSave: (gardes: GardeAgent[]) => void };

const REPOS = "Repos";
const SERVICES = ["Urgences", "Maternité", "Pédiatrie", "Médecine Générale", "Pharmacie"];
const trouver = (re: RegExp) => SHIFTS_GARDE.find((s) => re.test(s)) || "";
const MATIN = trouver(/Matin|Jour/);
const APRES_MIDI = trouver(/Après-midi/);
const NUIT = trouver(/Nuit/);
const H24 = trouver(/24/);

const MODELES: { nom: string; cycle: string[] }[] = [
  { nom: "Matin → Après-midi → Nuit → Repos → Repos", cycle: [MATIN, APRES_MIDI, NUIT, REPOS, REPOS] },
  { nom: "Matin → Matin → Après-midi → Après-midi → Nuit → Nuit → Repos → Repos", cycle: [MATIN, MATIN, APRES_MIDI, APRES_MIDI, NUIT, NUIT, REPOS, REPOS] },
  { nom: "Jour → Nuit → Repos → Repos", cycle: [MATIN, NUIT, REPOS, REPOS] },
  { nom: "Garde 24h → Repos → Repos → Repos", cycle: [H24, REPOS, REPOS, REPOS] },
].map((m) => ({ ...m, cycle: m.cycle.filter(Boolean) }));

const sansAccent = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function decaler(jour: string, n: number): string {
  const d = new Date(jour + "T12:00:00");
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
const mod = (a: number, n: number) => ((a % n) + n) % n;

type Ligne = { choix: string; libre: string };
type Agent = { id: string; nom: string; poste: string };

export default function RotationAutomatiqueN({ staff, gardes, onSave }: Props) {
  const [lignes, setLignes] = useState<Ligne[]>(() => [{ choix: "", libre: "" }, { choix: "", libre: "" }, { choix: "", libre: "" }]);
  const [cycle, setCycle] = useState<string[]>(MODELES[0].cycle);
  const [debut, setDebut] = useState(getTodayStr());
  const [etapeDepart, setEtapeDepart] = useState(0);
  const [decalage, setDecalage] = useState(1);
  const [semaines, setSemaines] = useState(8);
  const [service, setService] = useState("Médecine Générale");

  const agents: Agent[] = lignes.map((l) => {
    if (l.choix && l.choix !== "Autre") {
      const s = staff.find((x) => x.id === l.choix);
      if (s) return { id: s.id, nom: s.nom, poste: s.poste };
    }
    return { id: "", nom: l.choix === "Autre" ? l.libre.trim() : "", poste: "Personnel Clinique" };
  });
  const valides = agents.filter((a) => a.nom);
  const doublon = new Set(valides.map((a) => a.id || sansAccent(a.nom))).size !== valides.length;
  const pret = valides.length >= 2 && !doublon && cycle.length >= 2 && cycle.some((c) => c !== REPOS);
  const L = cycle.length;
  const postes = useMemo(() => Array.from(new Set(cycle.filter((c) => c !== REPOS))), [cycle]);

  /** Poste de l'agent i (dans la liste des agents valides) au jour d. */
  const posteDe = (i: number, d: number) => cycle[mod(etapeDepart + d - i * decalage, L)];

  const planJour = (d: number) => {
    const parPoste: Record<string, string[]> = {};
    postes.forEach((p) => (parPoste[p] = []));
    const repos: string[] = [];
    valides.forEach((a, i) => {
      const p = posteDe(i, d);
      if (p === REPOS) repos.push(a.nom);
      else parPoste[p].push(a.nom);
    });
    return { parPoste, repos };
  };
  const apercu = pret ? Array.from({ length: Math.max(8, L) }, (_, d) => ({ date: decaler(debut, d), ...planJour(d) })) : [];
  const trous = apercu.some((j) => postes.some((p) => j.parPoste[p].length === 0));

  const generer = () => {
    if (!pret) return;
    const jours = semaines * 7;
    const fin = decaler(debut, jours - 1);
    const memeAgent = (g: GardeAgent, a: Agent) => (a.id && g.agentId === a.id) || sansAccent(g.agentNom || "") === sansAccent(a.nom);
    const existants = gardes.filter((g) => g.date >= debut && g.date <= fin && valides.some((a) => memeAgent(g, a)));
    if (!window.confirm(
      `Générer la rotation de ${valides.length} agents du ${new Date(debut + "T12:00").toLocaleDateString("fr-FR")} au ${new Date(fin + "T12:00").toLocaleDateString("fr-FR")} ?\nCycle : ${cycle.join(" → ")}` +
      (trous ? "\n\n⚠️ Certains postes ne sont pas couverts certains jours (voir l'aperçu)." : "") +
      (existants.length ? `\n\n${existants.length} garde(s) déjà programmée(s) pour ces agents sur cette période seront remplacées.` : "")
    )) return;
    const nouveaux: GardeAgent[] = [];
    const stamp = Date.now();
    for (let d = 0; d < jours; d++) {
      const date = decaler(debut, d);
      valides.forEach((a, i) => {
        const shift = posteDe(i, d);
        if (shift === REPOS) return;
        nouveaux.push({
          id: `garde-rotn-${stamp}-${d}-${i}`, agentId: a.id, agentNom: a.nom, agentFonction: a.poste,
          date, shift, service, statut: "Confirmé", notes: `Rotation automatique (${cycle.join(" → ")})`,
        });
      });
    }
    onSave([...nouveaux, ...gardes.filter((g) => !existants.includes(g))]);
    window.alert(`Rotation enregistrée : ${nouveaux.length} gardes sur ${semaines} semaines.`);
  };

  const majLigne = (i: number, v: Partial<Ligne>) => setLignes(lignes.map((l, j) => (j === i ? { ...l, ...v } : l)));
  const deplacer = (i: number, s: -1 | 1) => {
    const j = i + s;
    if (j < 0 || j >= lignes.length) return;
    const c = [...lignes];
    [c[i], c[j]] = [c[j], c[i]];
    setLignes(c);
  };
  const champ = "w-full border border-stone-200 dark:border-stone-750 rounded-lg px-2.5 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 font-semibold focus:outline-none text-xs";
  const fmt = (j: string) => new Date(j + "T12:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs space-y-4">
      <h4 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 border-b border-stone-150 dark:border-stone-800 pb-3">
        <Wand2 className="w-4 h-4 text-primary-600" /> Rotation automatique — {valides.length || "N"} agent(s)
      </h4>

      {/* Agents */}
      <div className="space-y-2">
        <div className="text-xs uppercase font-semibold text-stone-500 tracking-wider">Agents, dans l'ordre de la rotation</div>
        {lignes.map((l, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="w-6 text-center text-xs font-bold text-stone-400">{i + 1}</span>
            <select className={`${champ} w-56`} value={l.choix} onChange={(e) => majLigne(i, { choix: e.target.value })}>
              <option value="">— choisir —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.nom}{s.poste ? ` (${s.poste})` : ""}</option>)}
              <option value="Autre">Autre (saisir le nom)</option>
            </select>
            {l.choix === "Autre" && <input className={`${champ} w-48`} value={l.libre} maxLength={60} placeholder="Nom de l'agent" onChange={(e) => majLigne(i, { libre: e.target.value.replace(/[<>]/g, "") })} />}
            {pret && agents[i].nom && <span className="text-[11px] text-stone-500">aujourd'hui : <strong>{posteDe(valides.indexOf(agents[i]), 0)}</strong></span>}
            <button type="button" title="Monter" onClick={() => deplacer(i, -1)} className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"><ChevronUp className="w-4 h-4" /></button>
            <button type="button" title="Descendre" onClick={() => deplacer(i, 1)} className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"><ChevronDown className="w-4 h-4" /></button>
            <button type="button" title="Retirer" disabled={lignes.length <= 2} onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="p-1 hover:bg-danger-100 text-danger-600 rounded disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={lignes.length >= 40} onClick={() => setLignes([...lignes, { choix: "", libre: "" }])} className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ajouter un agent</button>
          {staff.length > 0 && <button type="button" onClick={() => setLignes(staff.slice(0, 40).map((s) => ({ choix: s.id, libre: "" })))} className="px-3 py-1.5 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-bold">Tout le personnel ({Math.min(staff.length, 40)})</button>}
        </div>
        {doublon && <p className="text-xs text-danger-700 font-semibold">Un même agent est choisi deux fois.</p>}
      </div>

      {/* Cycle */}
      <div className="space-y-2">
        <div className="text-xs uppercase font-semibold text-stone-500 tracking-wider">Cycle de chaque agent ({L} jours)</div>
        <select className={`${champ} md:w-auto`} value="" onChange={(e) => { const m = MODELES[Number(e.target.value)]; if (m) { setCycle(m.cycle); setEtapeDepart(0); } }}>
          <option value="">Choisir un modèle de cycle…</option>
          {MODELES.map((m, i) => <option key={i} value={i}>{m.nom}</option>)}
        </select>
        <div className="flex flex-wrap items-center gap-1.5">
          {cycle.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1">
              <select className={`${champ} w-auto py-1`} value={c} onChange={(e) => setCycle(cycle.map((x, j) => (j === i ? e.target.value : x)))}>
                {[...SHIFTS_GARDE, REPOS].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" title="Retirer ce jour" disabled={cycle.length <= 2} onClick={() => { setCycle(cycle.filter((_, j) => j !== i)); setEtapeDepart(0); }} className="text-stone-400 hover:text-danger-600 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
              {i < cycle.length - 1 && <span className="text-stone-400">→</span>}
            </span>
          ))}
          <button type="button" disabled={cycle.length >= 28} onClick={() => setCycle([...cycle, REPOS])} className="px-2 py-1 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Jour</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div className="space-y-1">
          <label className="text-xs uppercase font-semibold text-stone-500 tracking-wider">À partir du</label>
          <input type="date" className={champ} value={debut} onChange={(e) => e.target.value && setDebut(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-semibold text-stone-500 tracking-wider">Ce jour-là, l'agent 1 fait</label>
          <select className={champ} value={etapeDepart} onChange={(e) => setEtapeDepart(Number(e.target.value))}>
            {cycle.map((c, i) => <option key={i} value={i}>{`Jour ${i + 1} du cycle : ${c}`}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-semibold text-stone-500 tracking-wider">Décalage entre agents</label>
          <select className={champ} value={decalage} onChange={(e) => setDecalage(Number(e.target.value))}>
            {Array.from({ length: Math.max(1, L - 1) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} jour{n > 1 ? "s" : ""}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-semibold text-stone-500 tracking-wider">Durée</label>
          <select className={champ} value={semaines} onChange={(e) => setSemaines(Number(e.target.value))}>
            {[4, 8, 12, 26].map((n) => <option key={n} value={n}>{n} semaines</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-semibold text-stone-500 tracking-wider">Service</label>
          <select className={champ} value={service} onChange={(e) => setService(e.target.value)}>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {pret && (
        <div className="overflow-x-auto">
          {trous && (
            <p className="mb-2 text-xs text-warning-800 bg-warning-50 border border-warning-200 rounded-lg p-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Certains postes restent vides certains jours : ajoutez des agents ou changez le cycle / le décalage.
            </p>
          )}
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-stone-500 uppercase border-b border-stone-200 dark:border-stone-800">
                <th className="py-2 pr-3">Jour</th>{postes.map((p) => <th key={p} className="pr-3">{p}</th>)}<th>Repos</th>
              </tr>
            </thead>
            <tbody>
              {apercu.map((j) => (
                <tr key={j.date} className="border-b border-stone-100 dark:border-stone-800 align-top">
                  <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{fmt(j.date)}</td>
                  {postes.map((p) => (
                    <td key={p} className={`pr-3 py-1.5 font-bold ${j.parPoste[p].length ? "text-primary-700 dark:text-primary-400" : "text-danger-600"}`}>
                      {j.parPoste[p].join(", ") || "— vide —"}
                    </td>
                  ))}
                  <td className="text-stone-500 py-1.5">{j.repos.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-stone-500 mt-1">Aperçu des premiers jours ; le cycle se répète ensuite.</p>
        </div>
      )}

      <button type="button" disabled={!pret} onClick={generer}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
        <RefreshCw className="w-4 h-4" /> Générer le programme de garde
      </button>
    </div>
  );
}
