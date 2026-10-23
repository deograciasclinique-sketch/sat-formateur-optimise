/**
 * Portail patient : pharmacie(s) de garde du moment, avec appel et itinéraire en un geste.
 * Ville du cabinet par défaut ; le patient peut choisir une autre ville enregistrée par le cabinet.
 * Lit la copie publique « pharmacies_public/zone » (sans remarques internes) ; la garde est
 * recalculée ici, à l'heure du téléphone.
 */
import React, { useEffect, useState } from "react";
import { Pill, Phone, Navigation, ExternalLink } from "lucide-react";
import { db, authReady } from "../lib/firebase";
import { nettoyerDonnees } from "../lib/nettoyage";
import { DonneesPharmacies, normaliser, zoneOuCabinet, gardeDuMoment, lienItineraire, nomZone } from "../lib/pharmacies";

const CLE_VILLE = "dg_portail_ville_garde";

export default function PortailPharmacieGarde() {
  const [donnees, setDonnees] = useState<DonneesPharmacies | null>(null);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [villeId, setVilleId] = useState<string>(() => {
    try { return localStorage.getItem(CLE_VILLE) || ""; } catch { return ""; }
  });

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

  if (!donnees || donnees.zones.length === 0) return null;
  const zone = zoneOuCabinet(donnees, villeId);
  const garde = gardeDuMoment(zone, maintenant);
  const choisir = (id: string) => {
    setVilleId(id);
    try { localStorage.setItem(CLE_VILLE, id); } catch { /* ignore */ }
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-emerald-200 space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700"><Pill className="w-5 h-5" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-stone-800">Pharmacie de garde</h3>
          {garde && <p className="text-[11px] text-stone-500">{garde.periode}</p>}
        </div>
      </div>
      {donnees.zones.length > 1 && (
        <select value={zone?.id || ""} onChange={(e) => choisir(e.target.value)} aria-label="Ville"
          className="w-full p-2.5 bg-stone-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-500">
          {donnees.zones.map((z) => <option key={z.id} value={z.id}>{nomZone(z)}</option>)}
        </select>
      )}
      {!garde || garde.pharmacies.length === 0 ? (
        <p className="text-xs text-stone-500">
          La garde de {zone ? nomZone(zone) : "cette ville"} n'est pas encore renseignée.
          {zone?.lien && <> <a href={zone.lien} target="_blank" rel="noopener noreferrer" className="text-primary-700 font-bold underline inline-flex items-center gap-0.5">Voir la liste <ExternalLink className="w-3 h-3" /></a></>}
        </p>
      ) : garde.pharmacies.slice(0, 40).map((p) => {
        const lien = lienItineraire(p);
        return (
          <div key={p.id} className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-sm font-bold text-emerald-900">{p.nom}</p>
            {p.quartier && <p className="text-xs text-stone-600">{p.quartier}</p>}
            {p.horaires && <p className="text-xs text-stone-500 italic">{p.horaires}</p>}
            <div className="grid grid-cols-2 gap-2 mt-2">
              {p.telephone && (
                <a href={`tel:${zone?.pays === "Burkina Faso" ? p.telephone.replace(/[^\d+]/g, "").replace(/^(\d{8})$/, "+226$1") : p.telephone.replace(/[^\d+]/g, "")}`}
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
