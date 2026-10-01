/**
 * Conduite à tenir (CAT) décidée après le diagnostic de certitude, avant la
 * rédaction de l'ordonnance : traitement par voie orale, soins infirmiers à
 * réaliser, surveillance, examens, conseils…
 */

import React, { useState } from "react";
import { Plus, Trash2, ClipboardList } from "lucide-react";
import { ConduiteItem, Medicament } from "../types";
import { generateUid } from "../data";

export const TYPES_CAT: { value: string; label: string; emoji: string; placeholder: string; suggestions: string[] }[] = [
  {
    value: "Voie orale", label: "Voie orale", emoji: "💊",
    placeholder: "Ex. Artéméther-luméfantrine 80/480 mg : 1 cp matin et soir pendant 3 jours, au cours du repas",
    suggestions: ["Prendre les comprimés au cours du repas", "Traitement de 3 jours à terminer même si la fièvre disparaît", "Paracétamol 1 g si fièvre, 3 fois par jour au maximum"],
  },
  {
    value: "Voie injectable", label: "Voie injectable", emoji: "💉",
    placeholder: "",
    suggestions: [],
  },
  {
    value: "Soins infirmiers", label: "Soins infirmiers", emoji: "🩺",
    placeholder: "Ex. Artésunate 2,4 mg/kg IV à H0, H12, H24 puis relais oral / Pansement simple tous les 2 jours",
    suggestions: ["Pose d'une voie veineuse", "Perfusion de sérum glucosé 5 %", "Injection IM", "Pansement simple", "Nébulisation", "Prise des constantes toutes les 4 h"],
  },
  {
    value: "Surveillance", label: "Surveillance", emoji: "👁️",
    placeholder: "Ex. Surveiller la température, la conscience et la diurèse toutes les 4 h",
    suggestions: ["Température toutes les 4 h", "Tension artérielle matin et soir", "Surveiller l'état de conscience", "Surveiller la diurèse"],
  },
  {
    value: "Examens", label: "Examens complémentaires", emoji: "🧪",
    placeholder: "Ex. NFS, glycémie de contrôle à J3",
    suggestions: ["GE / TDR de contrôle", "NFS", "Glycémie de contrôle"],
  },
  {
    value: "Conseils", label: "Conseils / éducation", emoji: "🗣️",
    placeholder: "Ex. Dormir sous moustiquaire imprégnée, bien s'hydrater, revenir si vomissements",
    suggestions: ["Dormir sous moustiquaire imprégnée", "Bien s'hydrater", "Revenir immédiatement en cas de signes de danger", "Repos"],
  },
  {
    value: "Autre", label: "Autre", emoji: "📝",
    placeholder: "Toute autre consigne",
    suggestions: [],
  },
];

export const typeCat = (v: string) => TYPES_CAT.find((t) => t.value === v) || TYPES_CAT[TYPES_CAT.length - 1];

/** Types exécutés par l'infirmier (salle infirmier). */
export const TYPES_INFIRMIER = ["Voie injectable", "Soins infirmiers"];
export const catASoinsInfirmiers = (items?: ConduiteItem[]) => (items || []).some((i) => TYPES_INFIRMIER.includes(i.type));

export const VOIES_INJECTABLES = ["IV directe", "IV lente", "Perfusion IV", "IM", "SC", "ID"];
export const FREQUENCES_INJ = ["Dose unique", "1 fois / jour", "2 fois / jour (toutes les 12 h)", "3 fois / jour (toutes les 8 h)", "4 fois / jour (toutes les 6 h)", "H0, H12, H24 puis 1 fois / jour", "Si besoin"];
export const DUREES_INJ = ["1 jour", "2 jours", "3 jours", "5 jours", "7 jours", "10 jours", "Jusqu'au relais oral"];

/** Produits injectables courants (proposés quand le stock ne les contient pas). */
export const INJECTABLES_COURANTS: { produit: string; dosage: string; voie: string; dose: string; frequence: string }[] = [
  { produit: "Artésunate", dosage: "60 mg", voie: "IV directe", dose: "2,4 mg/kg", frequence: "H0, H12, H24 puis 1 fois / jour" },
  { produit: "Artéméther", dosage: "80 mg/1 ml", voie: "IM", dose: "3,2 mg/kg à J1 puis 1,6 mg/kg", frequence: "1 fois / jour" },
  { produit: "Quinine", dosage: "600 mg/2 ml", voie: "Perfusion IV", dose: "10 mg/kg dans SG 10 %", frequence: "3 fois / jour (toutes les 8 h)" },
  { produit: "Ceftriaxone", dosage: "1 g", voie: "IV lente", dose: "1 g", frequence: "1 fois / jour" },
  { produit: "Ampicilline", dosage: "1 g", voie: "IV lente", dose: "50 mg/kg", frequence: "4 fois / jour (toutes les 6 h)" },
  { produit: "Gentamicine", dosage: "80 mg/2 ml", voie: "IM", dose: "3 à 5 mg/kg", frequence: "1 fois / jour" },
  { produit: "Paracétamol perfusion", dosage: "1 g/100 ml", voie: "Perfusion IV", dose: "15 mg/kg (1 g adulte)", frequence: "4 fois / jour (toutes les 6 h)" },
  { produit: "Diclofénac", dosage: "75 mg/3 ml", voie: "IM", dose: "75 mg", frequence: "1 fois / jour" },
  { produit: "Métoclopramide", dosage: "10 mg/2 ml", voie: "IV lente", dose: "10 mg", frequence: "3 fois / jour (toutes les 8 h)" },
  { produit: "Dexaméthasone", dosage: "4 mg/1 ml", voie: "IV directe", dose: "4 à 8 mg", frequence: "1 fois / jour" },
  { produit: "Sérum glucosé 10 %", dosage: "500 ml", voie: "Perfusion IV", dose: "500 ml", frequence: "1 fois / jour" },
  { produit: "Sérum salé 0,9 %", dosage: "500 ml", voie: "Perfusion IV", dose: "500 ml", frequence: "1 fois / jour" },
  { produit: "Ringer lactate", dosage: "500 ml", voie: "Perfusion IV", dose: "20 ml/kg", frequence: "Dose unique" },
];

export type PrescInjectable = NonNullable<ConduiteItem["injectable"]>;

export function texteInjectable(p: PrescInjectable): string {
  const prod = [p.produit, p.dosage].filter(Boolean).join(" ");
  const parts = [`${prod} — ${p.voie}`, p.dose ? `${p.dose}` : "", p.frequence || "", p.duree ? `pendant ${p.duree}` : ""].filter(Boolean);
  let t = parts.join(", ");
  if (p.dilution) t += ` (${p.dilution})`;
  return t;
}

export function conduiteEnLignes(items?: ConduiteItem[]): string[] {
  return (items || []).map((i) => `${typeCat(i.type).label} : ${i.description}`);
}

/** Éditeur de la conduite à tenir (formulaire de consultation). */
export function ConduiteATenirEditor({ items, onChange, medicaments = [], onAjouterOrdonnance }: {
  items: ConduiteItem[]; onChange: (items: ConduiteItem[]) => void; medicaments?: Medicament[];
  /** Si fourni : l'injectable peut aussi être ajouté à l'ordonnance (facturation + stock). */
  onAjouterOrdonnance?: (p: PrescInjectable, quantite: number) => void;
}) {
  const [type, setType] = useState(TYPES_CAT[0].value);
  const [texte, setTexte] = useState("");
  const t = typeCat(type);

  const ajouter = (desc = texte) => {
    const d = desc.trim();
    if (!d) return;
    onChange([...items, { id: generateUid(), type, description: d }]);
    setTexte("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {TYPES_CAT.map((x) => (
          <button
            key={x.value}
            type="button"
            onClick={() => setType(x.value)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
              type === x.value ? "bg-primary-600 text-white border-primary-600" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
            }`}
          >
            {x.emoji} {x.label}
          </button>
        ))}
      </div>

      {type === "Voie injectable" ? (
        <FormInjectable
          medicaments={medicaments}
          avecOrdonnance={!!onAjouterOrdonnance}
          onAjouter={(p, qte) => { if (onAjouterOrdonnance && qte > 0) onAjouterOrdonnance(p, qte); }}
          onAjouterCAT={(p) => onChange([...items, { id: generateUid(), type: "Voie injectable", description: texteInjectable(p), injectable: p }])}
        />
      ) : (<>
      <div className="flex gap-2 items-start">
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ajouter(); } }}
          placeholder={t.placeholder}
          className="flex-1 text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none min-h-[52px]"
        />
        <button
          type="button"
          onClick={() => ajouter()}
          disabled={!texte.trim()}
          className="shrink-0 px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 hover:bg-primary-700"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      {t.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {t.suggestions.map((s) => (
            <button key={s} type="button" onClick={() => setTexte(texte ? `${texte.trim()} ; ${s}` : s)}
              className="text-2xs px-2 py-0.5 rounded-full border border-dashed border-stone-300 text-stone-500 hover:bg-stone-50">
              + {s}
            </button>
          ))}
        </div>
      )}
      </>)}

      {items.length > 0 && (
        <ol className="space-y-1.5 mt-1">
          {items.map((i, idx) => (
            <li key={i.id} className="flex items-start gap-2 text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-2">
              <span className="font-bold text-stone-400">{idx + 1}.</span>
              <div className="flex-1">
                <span className="font-bold text-primary-700">{typeCat(i.type).emoji} {typeCat(i.type).label} : </span>
                <span className="whitespace-pre-wrap">{i.description}</span>
              </div>
              <button type="button" onClick={() => onChange(items.filter((x) => x.id !== i.id))} title="Retirer" className="text-danger-600 hover:bg-danger-50 rounded p-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const VIDE_INJ: PrescInjectable = { produit: "", voie: "IV directe", dose: "", frequence: "", duree: "", dosage: "", dilution: "" };

/** Formulaire de prescription d'un produit injectable avec sa posologie. */
function FormInjectable({ medicaments, onAjouter, onAjouterCAT, avecOrdonnance }: {
  medicaments: Medicament[]; onAjouter: (p: PrescInjectable, quantite: number) => void;
  onAjouterCAT: (p: PrescInjectable) => void; avecOrdonnance: boolean;
}) {
  const [p, setP] = useState<PrescInjectable>(VIDE_INJ);
  const [versOrd, setVersOrd] = useState(true);
  const [qte, setQte] = useState("1");
  const [ouvert, setOuvert] = useState(false);
  const set = (k: keyof PrescInjectable, v: string) => setP((x) => ({ ...x, [k]: v }));

  const q = p.produit.trim().toLowerCase();
  const estInj = (m: Medicament) => /inj|amp|flacon|perf|solut|iv|im\b|sérum|serum/i.test(`${m.forme} ${m.nom}`);
  const resultatsStock = q
    ? medicaments
        .filter((m) => (m.typeArticle || "Médicament") === "Médicament" && m.nom.toLowerCase().includes(q))
        .sort((a, b) => Number(estInj(b)) - Number(estInj(a)) || a.nom.localeCompare(b.nom, "fr"))
        .slice(0, 8)
    : [];
  const resultatsCourants = INJECTABLES_COURANTS.filter((c) => !q || c.produit.toLowerCase().includes(q)).slice(0, q ? 5 : 13);
  const valide = p.produit.trim() && p.voie && p.dose.trim();

  const champ = "w-full text-xs border border-stone-200 rounded-lg px-2.5 py-1.5 bg-stone-50 focus:bg-white focus:outline-none";
  const lab = "text-2xs font-semibold uppercase tracking-wider text-stone-500 block mb-0.5";

  return (
    <div className="border border-primary-200 bg-primary-50/40 rounded-xl p-3 space-y-2.5">
      <div className="relative">
        <label className={lab}>Produit injectable *</label>
        <input
          value={p.produit}
          onChange={(e) => { setP((x) => ({ ...x, produit: e.target.value, medicamentId: undefined })); setOuvert(true); }}
          onFocus={() => setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 200)}
          placeholder="Tapez le nom : Artésunate, Ceftriaxone, Quinine…"
          className={champ}
        />
        {ouvert && (resultatsStock.length > 0 || resultatsCourants.length > 0) && (
          <div className="absolute z-20 left-0 right-0 mt-1 max-h-60 overflow-auto bg-white border border-stone-200 rounded-lg shadow-lg text-xs">
            {resultatsStock.length > 0 && <div className="px-2.5 py-1 text-2xs font-bold uppercase text-stone-400 bg-stone-50">En stock</div>}
            {resultatsStock.map((m) => (
              <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setP((x) => ({ ...x, produit: m.nom, medicamentId: m.id, dosage: m.dosage || x.dosage })); setOuvert(false); }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-primary-50 flex justify-between gap-2">
                <span><b>{m.nom}</b> {m.dosage} <span className="text-stone-400">{m.forme}</span></span>
                <span className={m.stock > 0 ? "text-emerald-600" : "text-danger-600"}>stock {m.stock}</span>
              </button>
            ))}
            {resultatsCourants.length > 0 && <div className="px-2.5 py-1 text-2xs font-bold uppercase text-stone-400 bg-stone-50">Injectables courants (posologie proposée)</div>}
            {resultatsCourants.map((c) => (
              <button key={c.produit} type="button" onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setP((x) => ({ ...x, ...c, medicamentId: undefined })); setOuvert(false); }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-primary-50">
                <b>{c.produit}</b> {c.dosage} <span className="text-stone-500">— {c.voie}, {c.dose}, {c.frequence}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label className={lab}>Dosage / présentation</label>
          <input value={p.dosage || ""} onChange={(e) => set("dosage", e.target.value)} placeholder="Ex. 60 mg, 1 g, 80 mg/2 ml" className={champ} />
        </div>
        <div>
          <label className={lab}>Voie *</label>
          <select value={p.voie} onChange={(e) => set("voie", e.target.value)} className={champ}>
            {VOIES_INJECTABLES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={lab}>Dose par prise *</label>
          <input value={p.dose} onChange={(e) => set("dose", e.target.value)} placeholder="Ex. 2,4 mg/kg, 1 g, 1 ampoule" className={champ} />
        </div>
        <div>
          <label className={lab}>Fréquence</label>
          <input list="cat-freq-inj" value={p.frequence || ""} onChange={(e) => set("frequence", e.target.value)} placeholder="Ex. 2 fois / jour" className={champ} />
          <datalist id="cat-freq-inj">{FREQUENCES_INJ.map((f) => <option key={f} value={f} />)}</datalist>
        </div>
        <div>
          <label className={lab}>Durée</label>
          <input list="cat-duree-inj" value={p.duree || ""} onChange={(e) => set("duree", e.target.value)} placeholder="Ex. 3 jours" className={champ} />
          <datalist id="cat-duree-inj">{DUREES_INJ.map((f) => <option key={f} value={f} />)}</datalist>
        </div>
        <div>
          <label className={lab}>Dilution / remarque</label>
          <input value={p.dilution || ""} onChange={(e) => set("dilution", e.target.value)} placeholder="Ex. dans 250 ml SG 5 %, 20 gouttes/min" className={champ} />
        </div>
      </div>

      {p.produit.trim() && (
        <div className="text-xs text-stone-600 bg-white border border-dashed border-stone-300 rounded-lg px-2.5 py-1.5">
          <b>Aperçu :</b> {texteInjectable(p)}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {avecOrdonnance ? (
          <label className="flex items-center gap-1.5 text-xs text-stone-600">
            <input type="checkbox" checked={versOrd} onChange={(e) => setVersOrd(e.target.checked)} />
            Ajouter aussi à l'ordonnance (facturation et stock) — quantité
            <input type="number" min={1} value={qte} onChange={(e) => setQte(e.target.value)} disabled={!versOrd}
              className="w-14 text-xs border border-stone-200 rounded px-1.5 py-0.5" />
            ampoule(s)/flacon(s)
          </label>
        ) : <span />}
        <button type="button" disabled={!valide}
          onClick={() => {
            const presc = { ...p, produit: p.produit.trim(), dose: p.dose.trim() };
            onAjouterCAT(presc);
            if (avecOrdonnance && versOrd) onAjouter(presc, Math.max(1, parseInt(qte) || 1));
            setP(VIDE_INJ); setQte("1");
          }}
          className="px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40 hover:bg-primary-700">
          <Plus className="w-3.5 h-3.5" /> Ajouter l'injectable
        </button>
      </div>
      {!valide && <p className="text-2xs text-stone-500 italic">Renseignez au minimum le produit, la voie et la dose.</p>}
    </div>
  );
}

/** Affichage en lecture seule (dossier, salle infirmier). */
export function ConduiteATenirListe({ items, seulementType, compact }: { items?: ConduiteItem[]; seulementType?: string | string[]; compact?: boolean }) {
  const filtre = seulementType ? (Array.isArray(seulementType) ? seulementType : [seulementType]) : null;
  const liste = (items || []).filter((i) => !filtre || filtre.includes(i.type));
  const unSeulType = filtre && filtre.length === 1;
  if (!liste.length) return null;
  return (
    <ol className={compact ? "space-y-0.5" : "space-y-1.5"}>
      {liste.map((i, idx) => (
        <li key={i.id} className={`flex gap-2 ${compact ? "text-xs" : "text-sm"}`}>
          <span className="font-bold opacity-50">{idx + 1}.</span>
          <span>
            {!unSeulType && <b>{typeCat(i.type).emoji} {typeCat(i.type).label} : </b>}
            <span className="whitespace-pre-wrap">{i.description}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export const IconeCAT = ClipboardList;
