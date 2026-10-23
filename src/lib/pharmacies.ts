/**
 * Pharmacies et pharmacies de garde — plusieurs villes et plusieurs pays.
 *
 * Données (clé synchronisée « dg_pharmacies_zone ») : une liste de ZONES (une ville d'un pays),
 * chacune avec ses pharmacies et sa façon de connaître la garde :
 *   • « rotation » : tour de garde automatique (groupes dans l'ordre, une date de référence,
 *     une durée) — c'est le cas des villes du Burkina Faso ;
 *   • « manuel »   : la liste de garde change chaque semaine sans tour fixe (Abidjan, Lomé…) :
 *     le personnel coche les pharmacies de garde et la date de fin ; un lien vers la source
 *     officielle permet de vérifier.
 * Une zone est la « ville du cabinet » : utilisée par défaut sur l'ordonnance, WhatsApp et le portail.
 * Une copie publique (sans remarques internes) est publiée pour le portail patient.
 */

export interface Pharmacie {
  id: string;
  nom: string;
  quartier: string;
  telephone: string;
  telephone2?: string;
  lat?: number | null;
  lng?: number | null;
  lienMaps?: string;
  horaires?: string;
  remarques?: string;
  groupeId?: string;
}

export interface GroupeGarde {
  id: string;
  nom: string;
}

export interface ExceptionGarde {
  debut: string;
  groupeId: string;
}

export interface ConfigGarde {
  groupes: GroupeGarde[];
  groupeReferenceId: string;
  dateReference: string;
  heureChangement: string;
  dureeJours: number;
  exceptions: ExceptionGarde[];
}

export type ModeGarde = "rotation" | "manuel";

export interface Zone {
  id: string;
  pays: string;
  ville: string;
  pharmacies: Pharmacie[];
  modeGarde: ModeGarde;
  garde: ConfigGarde;
  /** Mode manuel : pharmacies cochées « de garde » et date de fin incluse (AAAA-MM-JJ). */
  gardeManuelle: { ids: string[]; jusquau: string };
  /** Source officielle / site pour vérifier la garde. */
  lien?: string;
  lienLibelle?: string;
}

export interface DonneesPharmacies {
  version: 2;
  zoneCabinetId: string;
  zones: Zone[];
}

export const CLE_PHARMACIES = "dg_pharmacies_zone";

export const GARDE_VIDE: ConfigGarde = {
  groupes: [],
  groupeReferenceId: "",
  dateReference: "",
  heureChangement: "08:00",
  dureeJours: 7,
  exceptions: [],
};

export const DONNEES_VIDES: DonneesPharmacies = { version: 2, zoneCabinetId: "", zones: [] };

export function nouvelleZone(id: string, pays: string, ville: string, champs: Partial<Zone> = {}): Zone {
  return { id, pays, ville, pharmacies: [], modeGarde: "rotation", garde: { ...GARDE_VIDE }, gardeManuelle: { ids: [], jusquau: "" }, ...champs };
}

function normaliserGarde(g: any): ConfigGarde {
  g = g || {};
  return {
    groupes: Array.isArray(g.groupes) ? g.groupes.filter((x: any) => x && typeof x.id === "string") : [],
    groupeReferenceId: typeof g.groupeReferenceId === "string" ? g.groupeReferenceId : "",
    dateReference: typeof g.dateReference === "string" ? g.dateReference : "",
    heureChangement: /^\d{2}:\d{2}$/.test(g.heureChangement || "") ? g.heureChangement : "08:00",
    dureeJours: Number.isInteger(g.dureeJours) && g.dureeJours >= 1 && g.dureeJours <= 31 ? g.dureeJours : 7,
    exceptions: Array.isArray(g.exceptions) ? g.exceptions.filter((e: any) => e && typeof e.debut === "string") : [],
  };
}

function normaliserZone(z: any): Zone | null {
  if (!z || typeof z.id !== "string") return null;
  const gm = z.gardeManuelle || {};
  return {
    id: z.id,
    pays: typeof z.pays === "string" && z.pays ? z.pays : "Burkina Faso",
    ville: typeof z.ville === "string" && z.ville ? z.ville : "Ma ville",
    pharmacies: Array.isArray(z.pharmacies) ? z.pharmacies.filter((p: any) => p && typeof p.id === "string") : [],
    modeGarde: z.modeGarde === "manuel" ? "manuel" : "rotation",
    garde: normaliserGarde(z.garde),
    gardeManuelle: {
      ids: Array.isArray(gm.ids) ? gm.ids.filter((x: any) => typeof x === "string") : [],
      jusquau: typeof gm.jusquau === "string" ? gm.jusquau : "",
    },
    lien: typeof z.lien === "string" && /^https:\/\//i.test(z.lien) ? z.lien : undefined,
    lienLibelle: typeof z.lienLibelle === "string" ? z.lienLibelle : undefined,
  };
}

/** Normalise des données reçues ; convertit l'ancienne version (une seule zone). */
export function normaliser(d: any): DonneesPharmacies {
  if (d && Array.isArray(d.zones)) {
    const zones = d.zones.map(normaliserZone).filter(Boolean) as Zone[];
    const cab = zones.some((z) => z.id === d.zoneCabinetId) ? d.zoneCabinetId : zones[0]?.id || "";
    return { version: 2, zoneCabinetId: cab, zones };
  }
  // Ancienne version : { zone, pharmacies, garde }
  if (d && (Array.isArray(d.pharmacies) || d.garde)) {
    const z = normaliserZone({
      id: "zone-cabinet",
      pays: "Burkina Faso",
      ville: typeof d.zone === "string" && d.zone.trim() ? d.zone.trim() : "Bobo-Dioulasso",
      pharmacies: d.pharmacies,
      garde: d.garde,
    })!;
    return { version: 2, zoneCabinetId: z.id, zones: [z] };
  }
  return DONNEES_VIDES;
}

export function lirePharmaciesLocal(): DonneesPharmacies {
  try {
    const raw = localStorage.getItem(CLE_PHARMACIES);
    return raw ? normaliser(JSON.parse(raw)) : DONNEES_VIDES;
  } catch {
    return DONNEES_VIDES;
  }
}

export function zoneCabinet(d: DonneesPharmacies): Zone | null {
  return d.zones.find((z) => z.id === d.zoneCabinetId) || d.zones[0] || null;
}

/** Zone demandée (si elle existe), sinon la ville du cabinet. */
export function zoneOuCabinet(d: DonneesPharmacies, id?: string | null): Zone | null {
  return (id && d.zones.find((z) => z.id === id)) || zoneCabinet(d);
}

export function nomZone(z: Zone): string {
  return z.pays && z.pays !== "Burkina Faso" ? `${z.ville} (${z.pays})` : z.ville;
}

// ─── Tour de garde automatique ───────────────────────────────────────────

const JOUR_MS = 24 * 3600 * 1000;

function dateLocale(jour: string, heure: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  const h = /^(\d{2}):(\d{2})$/.exec(heure) || ["", "08", "00"];
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(h[1]), Number(h[2]), 0, 0);
}

export function versJour(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type AvecGarde = { pharmacies: Pharmacie[]; garde: ConfigGarde };

export interface PeriodeGarde {
  debut: Date;
  fin: Date;
  groupe: GroupeGarde | null;
  pharmacies: Pharmacie[];
  corrigee: boolean;
}

export function gardeConfiguree(z: AvecGarde): boolean {
  const g = z.garde;
  return g.groupes.length > 0 && g.groupes.some((x) => x.id === g.groupeReferenceId) && !!dateLocale(g.dateReference, g.heureChangement);
}

export function periodeDeGarde(z: AvecGarde, date: Date = new Date(), decalage = 0): PeriodeGarde | null {
  if (!gardeConfiguree(z)) return null;
  const g = z.garde;
  const ref = dateLocale(g.dateReference, g.heureChangement)!;
  const n = g.groupes.length;
  const indexRef = g.groupes.findIndex((x) => x.id === g.groupeReferenceId);
  let k = Math.floor((date.getTime() - ref.getTime()) / (g.dureeJours * JOUR_MS));
  k += decalage;
  const debut = new Date(ref);
  debut.setDate(ref.getDate() + k * g.dureeJours);
  const fin = new Date(debut);
  fin.setDate(debut.getDate() + g.dureeJours);
  const exception = g.exceptions.find((e) => e.debut === versJour(debut));
  let groupe: GroupeGarde | null = g.groupes[(((indexRef + k) % n) + n) % n] || null;
  let corrigee = false;
  if (exception) {
    const ge = g.groupes.find((x) => x.id === exception.groupeId);
    if (ge) { groupe = ge; corrigee = true; }
  }
  const pharmacies = groupe ? z.pharmacies.filter((p) => p.groupeId === groupe!.id) : [];
  return { debut, fin, groupe, pharmacies, corrigee };
}

// ─── Garde du moment (tous modes) ────────────────────────────────────────

export interface GardeDuMoment {
  zone: Zone;
  pharmacies: Pharmacie[];
  /** « du samedi … au samedi … » ou « jusqu'au … » */
  periode: string;
  groupe: GroupeGarde | null;
  corrigee: boolean;
}

const FMT_JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const FMT_HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function libellePeriode(p: { debut: Date; fin: Date }): string {
  return `du ${FMT_JOUR.format(p.debut)} à ${FMT_HEURE.format(p.debut)} au ${FMT_JOUR.format(p.fin)} à ${FMT_HEURE.format(p.fin)}`;
}

/** Garde manuelle encore valable à cette date ? */
export function gardeManuelleValide(z: Zone, date = new Date()): boolean {
  return z.modeGarde === "manuel" && z.gardeManuelle.ids.length > 0 && !!z.gardeManuelle.jusquau && versJour(date) <= z.gardeManuelle.jusquau;
}

export function gardeDuMoment(z: Zone | null, date = new Date()): GardeDuMoment | null {
  if (!z) return null;
  if (z.modeGarde === "manuel") {
    if (!gardeManuelleValide(z, date)) return null;
    const ids = new Set(z.gardeManuelle.ids);
    const fin = new Date(z.gardeManuelle.jusquau + "T12:00");
    return { zone: z, pharmacies: z.pharmacies.filter((p) => ids.has(p.id)), periode: `jusqu'au ${FMT_JOUR.format(fin)}`, groupe: null, corrigee: false };
  }
  const p = periodeDeGarde(z, date);
  if (!p) return null;
  return { zone: z, pharmacies: p.pharmacies, periode: libellePeriode(p), groupe: p.groupe, corrigee: p.corrigee };
}

// ─── Affichage / partage ─────────────────────────────────────────────────

export function telephones(p: Pharmacie): string {
  return [p.telephone, p.telephone2].filter(Boolean).join(" / ");
}

export function lienItineraire(p: Pharmacie): string | null {
  if (typeof p.lat === "number" && typeof p.lng === "number") return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  if (p.lienMaps && /^https:\/\//i.test(p.lienMaps)) return p.lienMaps;
  return null;
}

export function lirePosition(texte: string): { lat: number; lng: number } | { lien: string } | null {
  const t = texte.trim();
  if (!t) return null;
  const m = /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/.exec(t);
  if (m) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }
  if (/^https:\/\/\S+$/i.test(t) && t.length <= 500) return { lien: t };
  return null;
}

export function texteGarde(g: GardeDuMoment, avecTitre = true): string {
  const lignes: string[] = [];
  if (avecTitre) lignes.push(`💊 *Pharmacie${g.pharmacies.length > 1 ? "s" : ""} de garde — ${nomZone(g.zone)}*`);
  lignes.push(`(${g.periode})`);
  if (g.pharmacies.length === 0) lignes.push("Aucune pharmacie enregistrée pour cette garde.");
  g.pharmacies.forEach((ph) => {
    const details = [ph.quartier, telephones(ph) && `☎ ${telephones(ph)}`].filter(Boolean).join(" — ");
    lignes.push(`• ${ph.nom}${details ? " — " + details : ""}`);
    const lien = lienItineraire(ph);
    if (lien) lignes.push(`  📍 ${lien}`);
  });
  return lignes.join("\n");
}

/** Texte de garde pour une zone (ou la ville du cabinet), ou "" si rien à afficher. */
export function texteGardeZone(zoneId?: string | null, d: DonneesPharmacies = lirePharmaciesLocal(), date = new Date()): string {
  const g = gardeDuMoment(zoneOuCabinet(d, zoneId), date);
  return g && g.pharmacies.length ? texteGarde(g) : "";
}

export function echapperHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Bloc HTML « pharmacie de garde » pour le bas de l'ordonnance (vide si rien à afficher). */
export function blocGardeHtml(zoneId?: string | null, d: DonneesPharmacies = lirePharmaciesLocal(), date = new Date()): string {
  const g = gardeDuMoment(zoneOuCabinet(d, zoneId), date);
  if (!g || g.pharmacies.length === 0) return "";
  const lignes = g.pharmacies
    .slice(0, 30)
    .map((ph) => `<div style="margin:2px 0"><strong>${echapperHtml(ph.nom)}</strong>${ph.quartier ? " — " + echapperHtml(ph.quartier) : ""}${telephones(ph) ? " — Tél : " + echapperHtml(telephones(ph)) : ""}</div>`)
    .join("");
  const colonnes = g.pharmacies.length > 8 ? "column-count:2;column-gap:20px;" : "";
  return `<div style="margin-top:30px;padding:10px 14px;border:1px solid #0d9488;border-radius:8px;font-size:11px;page-break-inside:avoid">
    <div style="font-weight:bold;color:#0d9488;text-transform:uppercase;font-size:11px;letter-spacing:.5px;margin-bottom:4px">Pharmacie${g.pharmacies.length > 1 ? "s" : ""} de garde — ${echapperHtml(nomZone(g.zone))}</div>
    <div style="color:#57534e;font-size:10px;margin-bottom:4px">${echapperHtml(g.periode)}</div>
    <div style="${colonnes}">${lignes}</div>
  </div>`;
}

/** Données publiées pour le portail patient (sans remarques internes). */
export function donneesPubliques(d: DonneesPharmacies) {
  return {
    version: 2,
    zoneCabinetId: d.zoneCabinetId,
    zones: d.zones.map((z) => ({ ...z, pharmacies: z.pharmacies.map(({ remarques: _r, ...reste }) => reste) })),
  };
}
