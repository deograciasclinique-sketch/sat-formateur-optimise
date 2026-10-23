/**
 * Bandeau « Pharmacie de garde » affiché en haut de la page de CHAQUE utilisateur (tous les postes),
 * sur tous les onglets. Une ligne repliée (ville, période, premières pharmacies) ; un clic déplie la
 * liste complète avec Appeler / Itinéraire. Chaque agent peut choisir sa ville (retenue sur l'appareil).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Pill, Phone, Navigation, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import {
  CLE_PHARMACIES, DONNEES_VIDES, DonneesPharmacies, normaliser, zoneOuCabinet, gardeDuMoment,
  lienItineraire, nomZone, telephones,
} from "../lib/pharmacies";

type Props = { utilisateurId?: string; theme?: "light" | "dark"; onGerer?: () => void };

export default function BandeauPharmacieGarde({ utilisateurId = "", theme = "light", onGerer }: Props) {
  const [brut] = useCloudSyncedState<DonneesPharmacies>(CLE_PHARMACIES, DONNEES_VIDES);
  const donnees = useMemo(() => normaliser(brut), [brut]);
  const cleVille = `dg_bandeau_ville_${utilisateurId || "poste"}`;
  const [villeId, setVilleId] = useState<string>(() => { try { return localStorage.getItem(cleVille) || ""; } catch { return ""; } });
  const [ouvert, setOuvert] = useState(false);
  const [maintenant, setMaintenant] = useState(() => new Date());

  useEffect(() => {
    try { setVilleId(localStorage.getItem(cleVille) || ""); } catch { /* ignore */ }
  }, [cleVille]);
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60_000); // passe à la garde suivante à l'heure prévue
    return () => clearInterval(t);
  }, []);

  if (donnees.zones.length === 0) return null;
  const zone = zoneOuCabinet(donnees, villeId);
  const garde = gardeDuMoment(zone, maintenant);
  const choisir = (id: string) => {
    setVilleId(id);
    try { localStorage.setItem(cleVille, id); } catch { /* ignore */ }
  };

  const sombre = theme === "dark";
  const apercu = garde?.pharmacies.slice(0, 3).map((p) => p.nom.replace(/^Pharmacie\s+/i, "")).join(", ");

  return (
    <div className={`mb-4 rounded-xl border text-sm ${sombre ? "bg-emerald-950/30 border-emerald-900/60 text-emerald-100" : "bg-emerald-50 border-emerald-200 text-emerald-900"}`}>
      <button type="button" onClick={() => setOuvert(!ouvert)} className="w-full px-4 py-2.5 flex items-center gap-2 text-left">
        <Pill className="w-4 h-4 flex-shrink-0" />
        <span className="font-bold whitespace-nowrap">Pharmacie de garde{zone ? ` — ${nomZone(zone)}` : ""}</span>
        <span className={`flex-1 min-w-0 truncate text-xs ${sombre ? "text-emerald-200/80" : "text-emerald-800/80"}`}>
          {garde && garde.pharmacies.length
            ? `${garde.groupe ? garde.groupe.nom + " · " : ""}${apercu}${garde.pharmacies.length > 3 ? ` et ${garde.pharmacies.length - 3} autre(s)` : ""}`
            : "garde non renseignée pour cette semaine"}
        </span>
        <span className="text-xs font-bold whitespace-nowrap flex items-center gap-1">{ouvert ? "Masquer" : "Voir"}{ouvert ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {ouvert && (
        <div className={`px-4 pb-4 space-y-3 border-t ${sombre ? "border-emerald-900/60" : "border-emerald-200"}`}>
          <div className="flex flex-wrap items-center gap-2 pt-3 text-xs">
            {donnees.zones.length > 1 && (
              <select value={zone?.id || ""} onChange={(e) => choisir(e.target.value)} aria-label="Ville"
                className={`p-1.5 rounded-lg border text-xs ${sombre ? "bg-stone-900 border-stone-700 text-white" : "bg-white border-emerald-200 text-stone-800"}`}>
                {donnees.zones.map((z) => <option key={z.id} value={z.id}>{z.id === donnees.zoneCabinetId ? "⭐ " : ""}{nomZone(z)}</option>)}
              </select>
            )}
            {garde && <span className="opacity-80">{garde.periode}</span>}
            {zone?.lien && (
              <a href={zone.lien} target="_blank" rel="noopener noreferrer" className="font-bold underline inline-flex items-center gap-0.5">
                Vérifier <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {onGerer && <button type="button" onClick={onGerer} className="ml-auto font-bold underline">Gérer les pharmacies</button>}
          </div>
          {garde && garde.pharmacies.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto pr-1">
              {garde.pharmacies.map((p) => {
                const lien = lienItineraire(p);
                return (
                  <div key={p.id} className={`p-2.5 rounded-lg border ${sombre ? "bg-stone-900 border-stone-800" : "bg-white border-emerald-100"}`}>
                    <div className="font-bold text-sm">{p.nom}</div>
                    {p.quartier && <div className="text-xs opacity-75">{p.quartier}</div>}
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {telephones(p) && (
                        <a href={`tel:${(p.telephone || p.telephone2 || "").replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-xs font-bold">
                          <Phone className="w-3.5 h-3.5" />{telephones(p)}
                        </a>
                      )}
                      {lien && (
                        <a href={lien} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold">
                          <Navigation className="w-3.5 h-3.5" />Itinéraire
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs opacity-80">
              La garde de cette semaine n'est pas encore renseignée pour {zone ? nomZone(zone) : "cette ville"}
              {onGerer ? " : ouvrez « Gérer les pharmacies »." : " : signalez-le au responsable de la pharmacie."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
