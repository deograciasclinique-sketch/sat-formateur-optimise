/**
 * Premier écran de l'application commerciale « Santé Intégré 2.2 » (Google Play) :
 * essayer la démonstration, ou se connecter à l'espace de sa clinique abonnée.
 */
import React from "react";
import { Building2, MessageCircle, PlayCircle } from "lucide-react";
import { CONFIG_COMMERCIALE, MODE, NOM_PRODUIT, choisirMode, lienAchat } from "../lib/edition";

export default function ChoixMode() {
  const indisponible = MODE === "clinique" && !CONFIG_COMMERCIALE;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 via-primary-800 to-stone-900 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="text-center space-y-2">
          <img src="/app-icon-192-v2.png" alt="" className="w-20 h-20 mx-auto rounded-2xl shadow" />
          <h1 className="font-serif font-bold text-lg text-stone-900">{NOM_PRODUIT}</h1>
          <p className="text-xs text-stone-500">Dossiers patients, consultations, laboratoire, pharmacie, caisse et rapports — pour cliniques et cabinets.</p>
        </div>

        {indisponible ? (
          <div className="rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm p-3 text-center">
            L'espace clinique ouvre très bientôt. Contactez-nous pour réserver votre abonnement.
          </div>
        ) : null}

        <button type="button" onClick={() => choisirMode("demo")} className="w-full rounded-xl border-2 border-primary-200 hover:border-primary-500 p-4 text-left flex items-center gap-3 cursor-pointer bg-white">
          <PlayCircle className="w-8 h-8 text-primary-700 shrink-0" />
          <span><span className="block font-bold text-sm text-stone-900">Essayer la démonstration</span><span className="block text-xs text-stone-500">Gratuit, données fictives, sans compte.</span></span>
        </button>

        {!indisponible && (
          <button type="button" onClick={() => choisirMode("clinique")} className="w-full rounded-xl border-2 border-emerald-200 hover:border-emerald-500 p-4 text-left flex items-center gap-3 cursor-pointer bg-white">
            <Building2 className="w-8 h-8 text-emerald-700 shrink-0" />
            <span><span className="block font-bold text-sm text-stone-900">Se connecter à ma clinique</span><span className="block text-xs text-stone-500">Avec le compte remis lors de l'abonnement.</span></span>
          </button>
        )}

        <a href={lienAchat()} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 no-underline text-sm">
          <MessageCircle className="w-4 h-4" /> S'abonner / nous contacter
        </a>
        {indisponible && (
          <button type="button" onClick={() => choisirMode(null)} className="w-full text-xs text-stone-500 font-bold cursor-pointer">Retour</button>
        )}
      </div>
    </div>
  );
}
