/**
 * Panneau de lecture des documents de référence du Ministère (GDT 2024,
 * directives paludisme, guide TB, charte de qualité), ouvert à côté du
 * formulaire, à la page demandée.
 */
import React from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { BIBLIOTHEQUE, docRef } from "../modules/nomenclature/gdt";
import { NATIF, SERVEUR } from "../lib/natif";

export interface CibleDoc { docId: string; page: number; titre?: string } // page du fichier PDF

const urlDoc = (c: CibleDoc, absolu = false) => `${absolu && NATIF ? SERVEUR : ""}${docRef(c.docId).fichier}#page=${c.page}`;

/** Ouvre le document hors de l'application (onglet, ou lecteur PDF du téléphone sur Android). */
export function ouvrirDocExterne(c: CibleDoc) {
  window.open(urlDoc(c, true), "_blank");
}

export default function GdtPanneau({ cible, onChange, onClose }: {
  cible: CibleDoc;
  onChange: (c: CibleDoc) => void;
  onClose: () => void;
}) {
  const doc = docRef(cible.docId);
  const section = doc.sections.find((s) => s.page === cible.page && s.titre === cible.titre) || doc.sections.find((s) => s.page === cible.page);
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[48vw] lg:w-[42vw] bg-white border-l border-stone-200 shadow-2xl flex flex-col">
      <div className="p-2.5 border-b border-stone-200 flex items-start gap-2 bg-primary-50">
        <BookOpen className="w-4 h-4 text-primary-700 shrink-0 mt-1.5" />
        <div className="min-w-0 flex-1 space-y-1">
          <select value={doc.id} onChange={(e) => onChange({ docId: e.target.value, page: docRef(e.target.value).sections[0].page })}
            className="w-full text-xs font-bold border border-stone-200 rounded-lg px-2 py-1 bg-white text-primary-900">
            {BIBLIOTHEQUE.map((d) => <option key={d.id} value={d.id}>{d.court}</option>)}
          </select>
          <select value={section ? `${section.page}|${section.titre}` : ""}
            onChange={(e) => { const [p, ...t] = e.target.value.split("|"); onChange({ docId: doc.id, page: Number(p), titre: t.join("|") }); }}
            className="w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white">
            {!section && <option value="">Page {cible.page}</option>}
            {doc.sections.map((s) => <option key={`${s.page}|${s.titre}`} value={`${s.page}|${s.titre}`}>{s.titre}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => ouvrirDocExterne(cible)} title="Ouvrir dans un onglet"
          className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-700"><ExternalLink className="w-4 h-4" /></button>
        <button type="button" onClick={onClose} title="Fermer" className="p-1.5 rounded-lg hover:bg-primary-100 text-stone-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* key : recharge le lecteur pour sauter à la page demandée */}
      <iframe key={`${doc.id}-${cible.page}`} src={`${doc.fichier}#page=${cible.page}&navpanes=0&view=FitH`} title={doc.court} className="flex-1 w-full" />
      <div className="px-3 py-1.5 text-2xs text-stone-500 border-t border-stone-100">
        {doc.titre} — Ministère de la Santé et de l'Hygiène Publique, Burkina Faso. Disponible hors connexion après la première ouverture.
      </div>
    </div>
  );
}
