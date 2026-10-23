/**
 * Générateur de rotation de garde du personnel (Mode Directeur, onglet Tâches).
 *
 * Cycle de chaque agent : Jour → Nuit → Repos → Repos (4 agents = 1 agent de jour et 1 agent
 * de nuit chaque jour, 2 jours de repos après chaque nuit). On choisit les agents dans l'ordre,
 * la date de départ et ce que fait le 1er agent ce jour-là ; l'app remplit le planning.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Wand2 } from "lucide-react";
import { Staff, GardeAgent } from "../types";
import { SHIFTS_GARDE } from "../lib/horaires";
import { getTodayStr } from "../data";

type Props = {
  staff: Staff[];
  gardes: GardeAgent[];
  onSave: (gardes: GardeAgent[]) => void;
};

const NOMS_PAR_DEFAUT = ["Zouré", "Rama", "Tobo", "Madiara"];
const SERVICES = ["Urgences", "Maternité", "Pédiatrie", "Médecine Générale", "Pharmacie"];

const sansAccent = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function decaler(jour: string, n: number): string {
  const d = new Date(jour + "T12:00:00");
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const SHIFT_JOUR = SHIFTS_GARDE.find((s) => /Jour|Matin/.test(s)) || SHIFTS_GARDE[0];
const SHIFT_NUIT = SHIFTS_GARDE.find((s) => /Nuit/.test(s)) || SHIFTS_GARDE[1];

type Agent = { id: string; nom: string; poste: string };

export default function RotationAutomatique({ staff, gardes, onSave }: Props) {
  // Pré-sélection : agents de la fiche RH dont le nom contient Zouré, Rama, Tobo, Madiara.
  const initial = useMemo(() => NOMS_PAR_DEFAUT.map((n) => {
    const s = staff.find((x) => sansAccent(x.nom).includes(sansAccent(n)));
    return s ? { choix: s.id, libre: "" } : { choix: "Autre", libre: n };
  }), [staff]);
  const [agents, setAgentsBrut] = useState(initial);
  const touche = useRef(false);
  const setAgents = (v: typeof initial) => { touche.current = true; setAgentsBrut(v); };
  // La liste du personnel peut arriver après l'ouverture : on refait la pré-sélection tant que rien n'a été modifié.
  useEffect(() => { if (!touche.current) setAgentsBrut(initial); }, [initial]);
  const [debut, setDebut] = useState(getTodayStr());
  const [premierFait, setPremierFait] = useState<"nuit" | "jour">("nuit");
  const [semaines, setSemaines] = useState(8);
  const [service, setService] = useState("Médecine Générale");

  const liste: Agent[] = agents.map((a) => {
    if (a.choix && a.choix !== "Autre") {
      const s = staff.find((x) => x.id === a.choix);
      if (s) return { id: s.id, nom: s.nom, poste: s.poste };
    }
    return { id: "", nom: a.libre.trim(), poste: "Personnel Clinique" };
  });
  const complet = liste.every((a) => a.nom) && new Set(liste.map((a) => a.id || sansAccent(a.nom))).size === 4;

  /** Pour un jour d (0 = départ) : qui est de jour, qui est de nuit. */
  const equipe = (d: number) => {
    const n = premierFait === "nuit" ? d % 4 : (d + 3) % 4; // agent de nuit
    return { nuit: liste[n], jour: liste[(n + 1) % 4] };
  };

  const apercu = Array.from({ length: 8 }, (_, d) => ({ date: decaler(debut, d), ...equipe(d) }));

  const generer = () => {
    if (!complet) return window.alert("Choisissez 4 agents différents.");
    const jours = semaines * 7;
    const fin = decaler(debut, jours - 1);
    const memeAgent = (g: GardeAgent, a: Agent) => (a.id && g.agentId === a.id) || sansAccent(g.agentNom || "") === sansAccent(a.nom);
    const existants = gardes.filter((g) => g.date >= debut && g.date <= fin && liste.some((a) => memeAgent(g, a)));
    if (!window.confirm(
      `Générer la rotation de ${liste.map((a) => a.nom).join(", ")} du ${new Date(debut + "T12:00").toLocaleDateString("fr-FR")} au ${new Date(fin + "T12:00").toLocaleDateString("fr-FR")} (${semaines} semaines) ?` +
      (existants.length ? `\n\n${existants.length} garde(s) déjà programmée(s) pour ces agents sur cette période seront remplacées.` : "")
    )) return;

    const conserves = gardes.filter((g) => !existants.includes(g));
    const nouveaux: GardeAgent[] = [];
    const stamp = Date.now();
    for (let d = 0; d < jours; d++) {
      const date = decaler(debut, d);
      const { jour, nuit } = equipe(d);
      for (const [a, shift] of [[jour, SHIFT_JOUR], [nuit, SHIFT_NUIT]] as [Agent, string][]) {
        nouveaux.push({
          id: `garde-rot-${stamp}-${d}-${shift === SHIFT_NUIT ? "n" : "j"}`,
          agentId: a.id,
          agentNom: a.nom,
          agentFonction: a.poste,
          date,
          shift,
          service,
          statut: "Confirmé",
          notes: "Rotation automatique (Jour → Nuit → Repos → Repos)",
        });
      }
    }
    onSave([...nouveaux, ...conserves]);
    window.alert(`Rotation enregistrée : ${nouveaux.length} gardes sur ${semaines} semaines.`);
  };

  const champ = "w-full border border-stone-200 dark:border-stone-750 rounded-lg px-2.5 py-2 bg-stone-50 dark:bg-stone-850 text-stone-800 dark:text-stone-200 font-semibold focus:outline-none text-xs";
  const fmt = (j: string) => new Date(j + "T12:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 shadow-xs space-y-4">
      <h4 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 border-b border-stone-150 dark:border-stone-800 pb-3">
        <Wand2 className="w-4 h-4 text-primary-600" /> Rotation automatique — 4 agents ({SHIFT_JOUR} · {SHIFT_NUIT})
      </h4>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        Chaque agent enchaîne <strong>Jour → Nuit → Repos → Repos</strong>. Chaque jour : un agent de jour, un agent de nuit, deux au repos.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {agents.map((a, i) => (
          <div key={i} className="space-y-1">
            <label className="text-xs uppercase font-semibold text-stone-500 tracking-wider">Agent {i + 1}</label>
            <select className={champ} value={a.choix} onChange={(e) => setAgents(agents.map((x, j) => (j === i ? { ...x, choix: e.target.value } : x)))}>
              <option value="">— choisir —</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
              <option value="Autre">Autre (saisir le nom)</option>
            </select>
            {a.choix === "Autre" && (
              <input className={champ} value={a.libre} maxLength={60} placeholder="Nom de l'agent"
                onChange={(e) => setAgents(agents.map((x, j) => (j === i ? { ...x, libre: e.target.value.replace(/[<>]/g, "") } : x)))} />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="space-y-1">
          <label className="text-xs uppercase font-semibold text-stone-500 tracking-wider">À partir du</label>
          <input type="date" className={champ} value={debut} onChange={(e) => e.target.value && setDebut(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase font-semibold text-stone-500 tracking-wider">Ce jour-là, {liste[0]?.nom || "l'agent 1"} est</label>
          <select className={champ} value={premierFait} onChange={(e) => setPremierFait(e.target.value === "jour" ? "jour" : "nuit")}>
            <option value="nuit">de garde de nuit ({SHIFT_NUIT})</option>
            <option value="jour">de jour ({SHIFT_JOUR})</option>
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

      {complet && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-stone-500 uppercase border-b border-stone-200 dark:border-stone-800">
                <th className="py-2 pr-3">Jour</th><th className="pr-3">{SHIFT_JOUR}</th><th className="pr-3">{SHIFT_NUIT}</th><th>Repos</th>
              </tr>
            </thead>
            <tbody>
              {apercu.map((l) => (
                <tr key={l.date} className="border-b border-stone-100 dark:border-stone-800">
                  <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">{fmt(l.date)}</td>
                  <td className="pr-3 text-primary-700 dark:text-primary-400 font-bold">{l.jour.nom}</td>
                  <td className="pr-3 text-info-700 dark:text-info-400 font-bold">{l.nuit.nom}</td>
                  <td className="text-stone-500">{liste.filter((a) => a !== l.jour && a !== l.nuit).map((a) => a.nom).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-stone-500 mt-1">Aperçu des 8 premiers jours ; le cycle se répète ensuite tous les 4 jours.</p>
        </div>
      )}

      <button type="button" disabled={!complet} onClick={generer}
        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
        <RefreshCw className="w-4 h-4" /> Générer le programme de garde
      </button>
    </div>
  );
}
