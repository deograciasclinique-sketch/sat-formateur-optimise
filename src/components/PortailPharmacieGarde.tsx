/**
 * Portail patient : pharmacie(s) de garde du moment, avec appel et itinéraire en un geste.
 * Lit la copie publique « pharmacies_public/zone » publiée par l'onglet Pharmacie
 * (sans les remarques internes) ; le groupe de garde est recalculé ici, à l'heure du téléphone.
 */
import React, { useEffect, useState } from "react";
import { Pill, Phone, Navigation } from "lucide-react";
import { db, authReady } from "../lib/firebase";
import { nettoyerDonnees } from "../lib/nettoyage";
import { DonneesPharmacies, normaliser, periodeDeGarde, libellePeriode, lienItineraire } from "../lib/pharmacies";

export default function PortailPharmacieGarde() {
  const [donnees, setDonnees] = useState<DonneesPharmacies | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
    let annule = false;
    let stop: (() => void) | undefined;
    authReady.then(() => {
      if (annule || !db) return;
      stop = db.collection("pharmacies_public").doc("zone").onSnapshot(
        (snap) => setDonnees(snap.exists ? normaliser(nettoyerDonnees(snap.data())) : null),
        (err) => console.error("[portail] Pharmacies de garde indisponibles :", err)
      );
    });
    const t = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => { annule = true; stop?.(); clearInterval(t); };
  }, []);

  const garde = donnees ? periodeDeGarde(donnees, maintenant) : null;
  if (!donnees || !garde || garde.pharmacies.length === 0) return null;

  return (
    <div className="bg-white p-4 rounded-2xl border border-emerald-200 space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700"><Pill className="w-5 h-5" /></div>
        <div>
          <h3 className="text-sm font-bold text-stone-800">Pharmacie{garde.pharmacies.length > 1 ? "s" : ""} de garde{donnees.zone ? ` — ${donnees.zone}` : ""}</h3>
          <p className="text-[11px] text-stone-500">{libellePeriode(garde)}</p>
        </div>
      </div>
      {garde.pharmacies.map((p) => {
        const lien = lienItineraire(p);
        return (
          <div key={p.id} className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-sm font-bold text-emerald-900">{p.nom}</p>
            {p.quartier && <p className="text-xs text-stone-600">{p.quartier}</p>}
            {p.horaires && <p className="text-xs text-stone-500 italic">{p.horaires}</p>}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {p.telephone && (
                <a href={`tel:${p.telephone.replace(/[^\d+]/g, "").replace(/^(\d{8})$/, "+226$1")}`}
                  className="flex items-center justify-center gap-1.5 bg-white rounded-lg py-2 text-xs font-bold text-stone-800 border border-stone-200">
                  <Phone className="w-4 h-4 text-primary-600" />Appeler
                </a>
              )}
              {lien && (
                <a href={lien} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-white rounded-lg py-2 text-xs font-bold text-stone-800 border border-stone-200">
                  <Navigation className="w-4 h-4 text-primary-600" />Itinéraire
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
