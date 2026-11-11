/**
 * Panneau de lecture du Guide de Diagnostic et de Traitement (GDT 2024),
 * ouvert à côté du formulaire de consultation, à la page demandée.
 */
import React from "react";
import { BookOpen, ExternalLink, X } from "lucide-react";
import { GDT_PDF, PAGE_ORDINOGRAMME, PROTOCOLES_GDT, SYMPTOMES_DOMINANTS, pagePdf } from "../modules/nomenclature/gdt";
import { NATIF, SERVEUR } from "../lib/natif";

/** URL du GDT à une page imprimée donnée. */
export const urlGdt = (pageImprimee?: number) =>
  `${NATIF ? SERVEUR : ""}${GDT_PDF}${pageImprimee ? `#page=${pagePdf(pageImprimee)}` : ""}`;

/** Ouvre le GDT hors de l'application (onglet, ou lecteur PDF du téléphone sur Android). */
export function ouvrirGdtExterne(pageImprimee?: number) {
  window.open(urlGdt(pageImprimee), "_blank");
}

export default function GdtPanneau({ page, titre, onChangePage, onClose }: {
  page: number; // page imprimée (0 = sommaire)
  titre?: string;
  onChangePage: (page: number, titre: string) => void;
  onClose: () => void;
}) {
  const choix = [
    { label: "Sommaire", page: 0 },
    ...SYMPTOMES_DOMINANTS.flatMap((g) => g.items.map((i) => ({ label: `Ordinogramme — ${i}`, page: PAGE_ORDINOGRAMME[i] }))),
    ...PROTOCOLES_GDT.map((p) => ({ label: `${p.page >= 236 ? "Geste / CAT" : "Protocole"} — ${p.titre}`, page: p.page })),
  ];
  // Sommaire = page 2 du PDF (page imprimée 1).
  const src = `${GDT_PDF}#page=${page ? pagePdf(page) : 2}&navpanes=0&view=FitH`;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[48vw] lg:w-[42vw] bg-white border-l border-stone-200 shadow-2xl flex flex-col">
      <div className="p-2.5 border-b border-stone-200 flex items-center gap-2 bg-primary-50">
        <BookOpen className="w-4 h-4 text-primary-700 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-primary-900 truncate">GDT 2024 — {titre || "Sommaire"}{page ? ` (p. ${page})` : ""}</div>
          <select
            value={page}
            onChange={(e) => {
              const p = Number(e.target.value);
              onChangePage(p, choix.find((c) => c.page === p)?.label.replace(/^.*— /, "") || "Sommaire");
            }}
            className="mt-1 w-full text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white"
          >
            {choix.map((c) => <option key={c.label} value={c.page}>{c.label}{c.page ? ` (p. ${c.page})` : ""}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => ouvrirGdtExterne(page || undefined)} title="Ouvrir dans un onglet"
          className="p-1.5 rounded-lg hover:bg-primary-100 text-primary-700"><ExternalLink className="w-4 h-4" /></button>
        <button type="button" onClick={onClose} title="Fermer" className="p-1.5 rounded-lg hover:bg-primary-100 text-stone-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      {/* key = page : recharge le lecteur pour sauter à la page demandée */}
      <iframe key={page} src={src} title="Guide de diagnostic et de traitement" className="flex-1 w-full" />
      <div className="px-3 py-1.5 text-2xs text-stone-500 border-t border-stone-100">
        Guide de diagnostic et de traitement des affections prioritaires au premier échelon, 4e édition — MSHP Burkina Faso. Disponible hors connexion après la première ouverture.
      </div>
    </div>
  );
}
