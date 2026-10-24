/**
 * Salle infirmière — actes et consommables ajoutés pendant les soins.
 *
 * L'infirmier ajoute ce qui n'était pas dans l'ordre du médecin (pansement supplémentaire,
 * seringues, gants, perfuseur…) :
 *   • un acte de la grille Actes & Tarifs, ou un article du stock (consommable / médicament) ;
 *   • le stock est déduit tout de suite (mouvement de sortie tracé) ;
 *   • la ligne part au secrétariat « à facturer » (traçabilité : qui, quand).
 */
import React, { useState } from "react";
import { Plus, PackageMinus, Trash2 } from "lucide-react";
import { ActeTarifaire, Consultation, Medicament, MouvementStock } from "../types";
import { generateUid, getTodayStr } from "../data";

type Props = {
  c: Consultation;
  consultations: Consultation[];
  onUpdateConsultations: (c: Consultation[]) => void;
  actes?: ActeTarifaire[];
  medicaments?: Medicament[];
  onUpdateMedicaments?: (m: Medicament[]) => void;
  mouvements?: MouvementStock[];
  onUpdateMouvements?: (m: MouvementStock[]) => void;
  agentNom?: string;
  isDark?: boolean;
};

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

export default function ComplementsSoins({ c, consultations, onUpdateConsultations, actes = [], medicaments = [], onUpdateMedicaments, mouvements = [], onUpdateMouvements, agentNom, isDark }: Props) {
  const [choix, setChoix] = useState("");
  const [qte, setQte] = useState(1);
  const liste = c.complementsInfirmier || [];
  const actesSoins = actes.filter((a) => !/^(consultation|laboratoire)$/i.test((a.categorie || "").trim()));
  const articles = medicaments.filter((m) => m.stock > 0).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  const ajouter = () => {
    if (!choix || qte <= 0) return;
    const [genre, id] = choix.split(":");
    const le = new Date().toISOString();
    let ligne: NonNullable<Consultation["complementsInfirmier"]>[number] | null = null;
    if (genre === "a") {
      const a = actes.find((x) => x.id === id);
      if (a) ligne = { id: generateUid(), designation: a.nom, qte, prix: a.prix, acteId: a.id, par: agentNom, le };
    } else {
      const m = medicaments.find((x) => x.id === id);
      if (!m) return;
      if (qte > m.stock && !confirm(`Stock de ${m.nom} : ${m.stock} seulement. Continuer ?`)) return;
      const sortie = Math.min(qte, m.stock);
      ligne = { id: generateUid(), designation: `${m.nom}${m.dosage ? " " + m.dosage : ""}`, qte, prix: m.prixVente || 0, medicamentId: m.id, par: agentNom, le };
      // Gestion de stock automatique : sortie tracée.
      if (sortie > 0 && onUpdateMedicaments) onUpdateMedicaments(medicaments.map((x) => (x.id === m.id ? { ...x, stock: x.stock - sortie } : x)));
      if (sortie > 0 && onUpdateMouvements) onUpdateMouvements([{
        id: generateUid(), medId: m.id, type: "sortie", qte: sortie, motif: `Soins salle infirmière — Patient : ${c.patient}${agentNom ? ` (par ${agentNom})` : ""}`,
        prixUnitaire: m.prixVente || 0, montant: (m.prixVente || 0) * sortie, date: getTodayStr(), createdAt: le,
      }, ...mouvements]);
    }
    if (!ligne) return;
    onUpdateConsultations(consultations.map((x) => (x.id === c.id ? { ...x, complementsInfirmier: [...(x.complementsInfirmier || []), ligne!] } : x)));
    setChoix("");
    setQte(1);
  };

  const retirer = (id: string) => {
    const l = liste.find((x) => x.id === id);
    if (!l || l.factureId) return;
    if (!confirm(`Retirer « ${l.designation} » ?${l.medicamentId ? " L'article sera remis en stock." : ""}`)) return;
    if (l.medicamentId) {
      const m = medicaments.find((x) => x.id === l.medicamentId);
      if (m && onUpdateMedicaments) onUpdateMedicaments(medicaments.map((x) => (x.id === m.id ? { ...x, stock: x.stock + l.qte } : x)));
      if (m && onUpdateMouvements) onUpdateMouvements([{
        id: generateUid(), medId: m.id, type: "entree", qte: l.qte, motif: `Retour (complément annulé) — Patient : ${c.patient}`,
        prixUnitaire: m.prixVente || 0, montant: (m.prixVente || 0) * l.qte, date: getTodayStr(), createdAt: new Date().toISOString(),
      }, ...mouvements]);
    }
    onUpdateConsultations(consultations.map((x) => (x.id === c.id ? { ...x, complementsInfirmier: (x.complementsInfirmier || []).filter((y) => y.id !== id) } : x)));
  };

  return (
    <div className={`mt-2 rounded border p-2 text-xs space-y-2 ${isDark ? "border-gray-700 bg-gray-900/40" : "border-sky-200 bg-sky-50/60"}`}>
      <div className="font-bold flex items-center gap-1"><PackageMinus className="w-3.5 h-3.5" /> Actes / consommables ajoutés en salle infirmière</div>
      {liste.length > 0 && (
        <ul className="space-y-0.5">
          {liste.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <span className="flex-1">{l.designation} × {l.qte} — {fcfa(l.qte * l.prix)} <span className="text-gray-500">({l.par || "—"}, {new Date(l.le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})</span></span>
              <span className={`px-1.5 py-0.5 rounded font-bold ${l.factureId ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{l.factureId ? "facturé" : "à facturer"}</span>
              {!l.factureId && <button type="button" title="Retirer" onClick={() => retirer(l.id)} className="text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <select className="px-2 py-1 rounded border bg-transparent max-w-[260px]" value={choix} onChange={(e) => setChoix(e.target.value)}>
          <option value="">Choisir un acte ou un article…</option>
          {actesSoins.length > 0 && <optgroup label="Actes (grille tarifaire)">{actesSoins.map((a) => <option key={a.id} value={"a:" + a.id}>{a.nom} — {fcfa(a.prix)}</option>)}</optgroup>}
          {articles.length > 0 && <optgroup label="Stock (consommables, médicaments)">{articles.map((m) => <option key={m.id} value={"m:" + m.id}>{m.nom}{m.dosage ? " " + m.dosage : ""} — {fcfa(m.prixVente || 0)} (stock {m.stock})</option>)}</optgroup>}
        </select>
        <input type="number" min={1} className="w-14 px-1 py-1 rounded border bg-transparent" value={qte} onChange={(e) => setQte(Math.max(1, Number(e.target.value) || 1))} />
        <button type="button" disabled={!choix} onClick={ajouter} className="px-2 py-1 rounded bg-sky-600 disabled:opacity-40 text-white font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ajouter</button>
      </div>
    </div>
  );
}
