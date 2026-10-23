/**
 * Pharmacies & pharmacies de garde — plusieurs villes, plusieurs pays (onglet Pharmacie).
 *
 * • Choix de la ville en haut (la ville du cabinet ⭐ est utilisée par défaut sur l'ordonnance,
 *   WhatsApp et le portail patient).
 * • Garde du moment : calculée automatiquement (tour de garde) ou saisie à la main chaque semaine
 *   pour les villes sans tour fixe, avec un lien vers la source à vérifier.
 * • « Ajouter une ville » : villes du Burkina pré-remplies (pharmacies, GPS, groupes) et villes
 *   de la sous-région (Côte d'Ivoire, Mali, Niger, Ghana, Togo, Bénin, Sénégal, Guinée).
 * Toutes les modifications sont synchronisées entre les postes et publiées pour le portail patient.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Pill, Phone, Navigation, Share2, Printer, Settings, Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Crosshair, Search, X, Check, CalendarClock, Upload, AlertTriangle, Star, MapPin, ExternalLink, Globe,
} from "lucide-react";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import { db } from "../lib/firebase";
import { generateUid } from "../data";
import { nettoyerDonnees, nettoyerTexte } from "../lib/nettoyage";
import {
  CLE_PHARMACIES, DONNEES_VIDES, DonneesPharmacies, Pharmacie, PeriodeGarde, Zone, GroupeGarde,
  normaliser, nouvelleZone, zoneCabinet, nomZone, periodeDeGarde, gardeConfiguree, gardeDuMoment,
  libellePeriode, telephones, lienItineraire, lirePosition, texteGarde, echapperHtml, donneesPubliques, versJour,
} from "../lib/pharmacies";
import type { VilleReference } from "../lib/pharmaciesReference";

type Props = { theme?: "light" | "dark" };

const FORM_VIDE = { nom: "", quartier: "", telephone: "", telephone2: "", position: "", horaires: "", groupeId: "", remarques: "" };

function propre(t: string, max: number) {
  return nettoyerTexte(t).replace(/[<>]/g, "").trim().slice(0, max);
}
function chiffres(t: string) {
  return t.replace(/\D/g, "").length;
}
const cleNom = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^pharmacie\s+/, "").replace(/[^a-z0-9]/g, "");
const memeVille = (z: Zone, pays: string, ville: string) => cleNom(z.pays) === cleNom(pays) && cleNom(z.ville) === cleNom(ville);

/** Crée (ou complète) une zone à partir d'une ville de référence. Retourne la zone et le nombre de pharmacies ajoutées. */
function zoneDepuisReference(ref: VilleReference, existante?: Zone): { zone: Zone; ajoutees: number } {
  let zone: Zone = existante || nouvelleZone(generateUid(), ref.pays, ref.ville, {
    lien: ref.lien, lienLibelle: ref.lienLibelle, modeGarde: ref.rotation ? "rotation" : "manuel",
  });
  if (!zone.lien) zone = { ...zone, lien: ref.lien, lienLibelle: ref.lienLibelle };
  const groupes: GroupeGarde[] = [...zone.garde.groupes];
  const idGroupe = (num: number) => {
    if (!num) return "";
    const nom = `Groupe ${num}`;
    let g = groupes.find((x) => x.nom.toLowerCase() === nom.toLowerCase());
    if (!g) { g = { id: generateUid(), nom }; groupes.push(g); }
    return g.id;
  };
  if (ref.rotation) for (let i = 1; i <= ref.rotation.groupes; i++) idGroupe(i);
  const pharmacies = [...zone.pharmacies];
  let ajoutees = 0;
  for (const r of ref.pharmacies || []) {
    if (pharmacies.some((p) => cleNom(p.nom) === cleNom(r.nom))) continue;
    pharmacies.push({
      id: generateUid(), nom: r.nom, quartier: r.quartier, telephone: r.telephone, telephone2: r.telephone2 || "",
      lat: r.lat ?? null, lng: r.lng ?? null, groupeId: idGroupe(r.groupe),
    });
    ajoutees++;
  }
  pharmacies.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  let garde = { ...zone.garde, groupes };
  if (ref.rotation && !gardeConfiguree(zone)) {
    garde = { ...garde, groupeReferenceId: idGroupe(ref.rotation.groupe), dateReference: ref.rotation.date, heureChangement: "08:00", dureeJours: 7 };
  }
  return { zone: { ...zone, pharmacies, garde }, ajoutees };
}

export default function PharmaciesGarde({ theme = "light" }: Props) {
  const [brut, setBrut] = useCloudSyncedState<DonneesPharmacies>(CLE_PHARMACIES, DONNEES_VIDES);
  const donnees = useMemo(() => normaliser(brut), [brut]);
  const majTout = (f: (d: DonneesPharmacies) => DonneesPharmacies) => setBrut((prev) => f(normaliser(prev)));

  const [zoneId, setZoneId] = useState<string>("");
  const z: Zone | null = donnees.zones.find((x) => x.id === zoneId) || zoneCabinet(donnees);
  const majZone = (f: (z: Zone) => Zone) => {
    if (!z) return;
    const id = z.id;
    majTout((d) => ({ ...d, zones: d.zones.map((x) => (x.id === id ? f(x) : x)) }));
  };

  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [gestion, setGestion] = useState(false);
  const [ajoutVille, setAjoutVille] = useState(false);
  const [references, setReferences] = useState<VilleReference[] | null>(null);
  const [refPays, setRefPays] = useState("Burkina Faso");
  const [refVille, setRefVille] = useState("");
  const [villeLibre, setVilleLibre] = useState({ pays: "", ville: "" });
  const [chargement, setChargement] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [importTexte, setImportTexte] = useState("");
  const [importOuvert, setImportOuvert] = useState(false);
  const [nouveauGroupe, setNouveauGroupe] = useState("");
  const [correction, setCorrection] = useState<{ decalage: number; groupeId: string }>({ decalage: 0, groupeId: "" });

  // Copie publique pour le portail patient.
  useEffect(() => {
    if (!db || donnees.zones.length === 0) return;
    const t = setTimeout(() => {
      db!.collection("pharmacies_public").doc("zone")
        .set(nettoyerDonnees({ ...donneesPubliques(donnees), updatedAt: Date.now() }))
        .catch((e: any) => console.error("[pharmacies] Publication pour le portail impossible :", e));
    }, 2000);
    return () => clearTimeout(t);
  }, [JSON.stringify(donnees)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Liste de référence : chargée seulement quand on en a besoin (fichier séparé).
  const chargerReferences = async (): Promise<VilleReference[]> => {
    if (references) return references;
    setChargement(true);
    try {
      const m = await import("../lib/pharmaciesReference");
      setReferences(m.VILLES_REFERENCE);
      return m.VILLES_REFERENCE;
    } finally {
      setChargement(false);
    }
  };
  useEffect(() => { if (ajoutVille) chargerReferences().catch(() => setErreur("Liste des villes indisponible (connexion ?).")); }, [ajoutVille]); // eslint-disable-line

  const ajouterReference = (refs: VilleReference[]) => {
    // Calcul sur l'état actuel, puis une seule écriture (le nombre ajouté est connu tout de suite).
    let total = 0;
    let dernierId = "";
    let zones = [...donnees.zones];
    for (const ref of refs) {
      const ex = zones.find((x) => memeVille(x, ref.pays, ref.ville));
      const { zone, ajoutees } = zoneDepuisReference(ref, ex);
      total += ajoutees;
      dernierId = zone.id;
      zones = ex ? zones.map((x) => (x.id === ex.id ? zone : x)) : [...zones, zone];
    }
    // Ville du cabinet : celle déjà choisie, sinon Bobo-Dioulasso si présente, sinon la première ajoutée.
    const zoneCabinetId = donnees.zoneCabinetId && zones.some((x) => x.id === donnees.zoneCabinetId)
      ? donnees.zoneCabinetId
      : zones.find((x) => memeVille(x, "Burkina Faso", "Bobo-Dioulasso"))?.id || zones[0]?.id || "";
    setBrut({ version: 2, zoneCabinetId, zones });
    if (refs.length === 1) setZoneId(dernierId);
    return total;
  };

  const ajouterVilleChoisie = async () => {
    const refs = await chargerReferences();
    const ref = refs.find((r) => r.pays === refPays && r.ville === refVille);
    if (!ref) return;
    const n = ajouterReference([ref]);
    setAjoutVille(false);
    setRefVille("");
    window.alert(`${ref.ville} ajoutée${n ? ` avec ${n} pharmacie(s)` : ""}.${ref.rotation ? " Tour de garde réglé : vérifiez la garde de cette semaine." : " Pas de tour fixe connu : saisissez chaque semaine les pharmacies de garde (lien de vérification fourni)."}`);
  };

  const ajouterToutBurkina = async () => {
    const refs = (await chargerReferences()).filter((r) => r.pays === "Burkina Faso");
    if (!window.confirm(`Ajouter les ${refs.length} villes du Burkina Faso (${refs.reduce((s, r) => s + (r.pharmacies?.length || 0), 0)} pharmacies) ? Les données déjà saisies sont conservées.`)) return;
    const n = ajouterReference(refs);
    setAjoutVille(false);
    window.alert(`${n} pharmacie(s) ajoutée(s). Vérifiez la garde de cette semaine dans chaque ville.`);
  };

  const ajouterToutPays = async (pays: string) => {
    const refs = (await chargerReferences()).filter((r) => r.pays === pays);
    ajouterReference(refs);
    setAjoutVille(false);
  };

  const ajouterVilleLibre = () => {
    const pays = propre(villeLibre.pays, 60) || "Burkina Faso";
    const ville = propre(villeLibre.ville, 60);
    if (ville.length < 2) return setErreur("Indiquez le nom de la ville.");
    if (donnees.zones.some((x) => memeVille(x, pays, ville))) return setErreur("Cette ville existe déjà.");
    const zone = nouvelleZone(generateUid(), pays, ville);
    majTout((d) => ({ ...d, zones: [...d.zones, zone], zoneCabinetId: d.zoneCabinetId || zone.id }));
    setZoneId(zone.id);
    setVilleLibre({ pays: "", ville: "" });
    setAjoutVille(false);
    setGestion(true);
  };

  const carte = theme === "dark" ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200";
  const titre = theme === "dark" ? "text-white" : "text-stone-900";
  const champ = "w-full p-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:ring-2 focus:ring-primary-500 outline-none";
  const nomGroupe = (id?: string) => z?.garde.groupes.find((g) => g.id === id)?.nom || "";
  const paysListe = Array.from(new Set(donnees.zones.map((x) => x.pays)));
  const estCabinet = !!z && z.id === (zoneCabinet(donnees)?.id || "");

  // ─── Garde affichée ───
  const rotation = z?.modeGarde === "rotation";
  const actuelle: PeriodeGarde | null = z && rotation ? periodeDeGarde(z, maintenant, 0) : null;
  const suivante: PeriodeGarde | null = z && rotation ? periodeDeGarde(z, maintenant, 1) : null;
  const gardeMoment = gardeDuMoment(z, maintenant);

  // ─── Pharmacies ───
  const enregistrerPharmacie = () => {
    if (!z) return;
    setErreur(null);
    const nom = propre(form.nom, 100);
    if (nom.length < 2) return setErreur("Indiquez le nom de la pharmacie.");
    if (form.telephone && (chiffres(form.telephone) < 8 || chiffres(form.telephone) > 15)) return setErreur("Téléphone 1 invalide (8 chiffres au moins).");
    if (form.telephone2 && (chiffres(form.telephone2) < 8 || chiffres(form.telephone2) > 15)) return setErreur("Téléphone 2 invalide (8 chiffres au moins).");
    let lat: number | null = null, lng: number | null = null, lienMaps = "";
    if (form.position.trim()) {
      const pos = lirePosition(form.position);
      if (!pos) return setErreur("Position non reconnue : collez un lien Google Maps (https://…) ou des coordonnées comme « 11.1771, -4.2979 ».");
      if ("lat" in pos) { lat = pos.lat; lng = pos.lng; } else lienMaps = pos.lien;
    }
    if (z.pharmacies.some((p) => p.id !== editionId && cleNom(p.nom) === cleNom(nom))) return setErreur("Une pharmacie porte déjà ce nom dans cette ville.");
    const ph: Pharmacie = {
      id: editionId || generateUid(), nom,
      quartier: propre(form.quartier, 100), telephone: propre(form.telephone, 20), telephone2: propre(form.telephone2, 20),
      lat, lng, lienMaps, horaires: propre(form.horaires, 100), remarques: propre(form.remarques, 300),
      groupeId: z.garde.groupes.some((g) => g.id === form.groupeId) ? form.groupeId : "",
    };
    majZone((x) => ({
      ...x,
      pharmacies: editionId ? x.pharmacies.map((p) => (p.id === editionId ? ph : p)) : [...x.pharmacies, ph].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
    }));
    setForm(FORM_VIDE);
    setEditionId(null);
  };

  const modifier = (p: Pharmacie) => {
    setEditionId(p.id);
    setErreur(null);
    setForm({
      nom: p.nom, quartier: p.quartier || "", telephone: p.telephone || "", telephone2: p.telephone2 || "",
      position: typeof p.lat === "number" && typeof p.lng === "number" ? `${p.lat}, ${p.lng}` : p.lienMaps || "",
      horaires: p.horaires || "", groupeId: p.groupeId || "", remarques: p.remarques || "",
    });
    document.getElementById("form-pharmacie")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const supprimer = (p: Pharmacie) => {
    if (!window.confirm(`Supprimer la pharmacie « ${p.nom} » ?`)) return;
    majZone((x) => ({ ...x, pharmacies: x.pharmacies.filter((y) => y.id !== p.id), gardeManuelle: { ...x.gardeManuelle, ids: x.gardeManuelle.ids.filter((i) => i !== p.id) } }));
  };

  const maPosition = () => {
    if (!navigator.geolocation) return setErreur("La localisation n'est pas disponible sur cet appareil. Collez plutôt le lien Google Maps.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, position: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` })),
      () => setErreur("Position introuvable (autorisation refusée ou GPS éteint). Collez plutôt le lien Google Maps."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const importer = () => {
    const lignes = importTexte.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lignes.length || !z) return;
    let ajoutees = 0, ignorees = 0;
    majZone((x) => {
      const groupes = [...x.garde.groupes];
      const pharmacies = [...x.pharmacies];
      for (const ligne of lignes.slice(0, 500)) {
        const [nomB, quartierB = "", telB = "", groupeB = ""] = ligne.split(/[;\t|]/).map((s) => s.trim());
        const nom = propre(nomB || "", 100);
        if (nom.length < 2 || pharmacies.some((p) => cleNom(p.nom) === cleNom(nom))) { ignorees++; continue; }
        let groupeId = "";
        const gNom = propre(groupeB, 50);
        if (gNom) {
          let g = groupes.find((y) => y.nom.toLowerCase() === gNom.toLowerCase());
          if (!g) { g = { id: generateUid(), nom: gNom }; groupes.push(g); }
          groupeId = g.id;
        }
        const tel = propre(telB, 20);
        pharmacies.push({ id: generateUid(), nom, quartier: propre(quartierB, 100), telephone: chiffres(tel) >= 8 ? tel : "", groupeId });
        ajoutees++;
      }
      pharmacies.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      return { ...x, pharmacies, garde: { ...x.garde, groupes } };
    });
    setImportTexte("");
    setImportOuvert(false);
    window.alert(`${ajoutees} pharmacie(s) ajoutée(s)${ignorees ? `, ${ignorees} ligne(s) ignorée(s) (nom vide ou déjà présent)` : ""}.`);
  };

  // ─── Groupes / tour de garde ───
  const ajouterGroupe = () => {
    const nom = propre(nouveauGroupe, 50);
    if (!nom || !z) return;
    if (z.garde.groupes.some((g) => g.nom.toLowerCase() === nom.toLowerCase())) return window.alert("Ce groupe existe déjà.");
    majZone((x) => ({ ...x, garde: { ...x.garde, groupes: [...x.garde.groupes, { id: generateUid(), nom }] } }));
    setNouveauGroupe("");
  };
  const deplacerGroupe = (i: number, sens: -1 | 1) => majZone((x) => {
    const g = [...x.garde.groupes];
    const j = i + sens;
    if (j < 0 || j >= g.length) return x;
    [g[i], g[j]] = [g[j], g[i]];
    return { ...x, garde: { ...x.garde, groupes: g } };
  });
  const renommerGroupe = (id: string) => {
    const actuel = nomGroupe(id);
    const nom = propre(window.prompt("Nouveau nom du groupe :", actuel) || "", 50);
    if (!nom || nom === actuel) return;
    majZone((x) => ({ ...x, garde: { ...x.garde, groupes: x.garde.groupes.map((g) => (g.id === id ? { ...g, nom } : g)) } }));
  };
  const supprimerGroupe = (id: string) => {
    if (!z) return;
    const n = z.pharmacies.filter((p) => p.groupeId === id).length;
    if (!window.confirm(`Supprimer le groupe « ${nomGroupe(id)} » ?${n ? ` ${n} pharmacie(s) n'auront plus de groupe.` : ""}`)) return;
    majZone((x) => ({
      ...x,
      pharmacies: x.pharmacies.map((p) => (p.groupeId === id ? { ...p, groupeId: "" } : p)),
      garde: {
        ...x.garde,
        groupes: x.garde.groupes.filter((g) => g.id !== id),
        groupeReferenceId: x.garde.groupeReferenceId === id ? "" : x.garde.groupeReferenceId,
        exceptions: x.garde.exceptions.filter((e) => e.groupeId !== id),
      },
    }));
  };
  const reglerGarde = (champs: Partial<Zone["garde"]>) => majZone((x) => ({ ...x, garde: { ...x.garde, ...champs } }));
  const appliquerCorrection = () => {
    if (!z) return;
    const p = periodeDeGarde(z, maintenant, correction.decalage);
    if (!p || !correction.groupeId) return;
    const debut = versJour(p.debut);
    majZone((x) => ({ ...x, garde: { ...x.garde, exceptions: [...x.garde.exceptions.filter((e) => e.debut !== debut), { debut, groupeId: correction.groupeId }].slice(-30) } }));
    setCorrection({ decalage: 0, groupeId: "" });
  };

  // ─── Garde manuelle ───
  const basculerGardeManuelle = (id: string) => majZone((x) => {
    const ids = x.gardeManuelle.ids.includes(id) ? x.gardeManuelle.ids.filter((i) => i !== id) : [...x.gardeManuelle.ids, id];
    const jusquau = x.gardeManuelle.jusquau && x.gardeManuelle.jusquau >= versJour(new Date()) ? x.gardeManuelle.jusquau : versJour(new Date(Date.now() + 6 * 86400000));
    return { ...x, gardeManuelle: { ids, jusquau } };
  });

  // ─── Ville ───
  const supprimerVille = () => {
    if (!z) return;
    if (!window.confirm(`Supprimer la ville « ${nomZone(z)} » et ses ${z.pharmacies.length} pharmacie(s) ?`)) return;
    const id = z.id;
    majTout((d) => {
      const zones = d.zones.filter((x) => x.id !== id);
      return { ...d, zones, zoneCabinetId: d.zoneCabinetId === id ? zones[0]?.id || "" : d.zoneCabinetId };
    });
    setZoneId("");
  };

  // ─── Partage / impression ───
  const partagerWhatsApp = () => {
    if (!gardeMoment) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(texteGarde(gardeMoment))}`, "_blank");
  };
  const imprimer = () => {
    if (!z) return;
    const w = window.open("", "_blank");
    if (!w) return window.alert("La fenêtre d'impression est bloquée. Autorisez les fenêtres pop-up.");
    const ligne = (p: Pharmacie) => `<tr><td><strong>${echapperHtml(p.nom)}</strong></td><td>${echapperHtml(p.quartier || "")}</td><td>${echapperHtml(telephones(p))}</td><td>${echapperHtml(p.horaires || "")}</td><td>${echapperHtml(nomGroupe(p.groupeId))}</td></tr>`;
    const bloc = (titreBloc: string, pharmacies: Pharmacie[], periode: string) => `<h2>${titreBloc}</h2><p class="per">${echapperHtml(periode)}</p>
      <table><tbody>${pharmacies.map(ligne).join("") || "<tr><td colspan='5'>Aucune pharmacie.</td></tr>"}</tbody></table>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pharmacies de garde — ${echapperHtml(nomZone(z))}</title>
      <style>body{font-family:Helvetica,Arial,sans-serif;color:#1c1917;padding:30px;font-size:13px}h1{color:#0d9488;font-size:20px;margin:0 0 4px}h2{color:#0d9488;font-size:15px;margin:24px 0 4px;text-transform:uppercase}
      .per{color:#57534e;margin:0 0 6px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e7e5e4;padding:6px 4px;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#78716c}</style></head><body>
      <h1>Pharmacies de garde — ${echapperHtml(nomZone(z))}</h1>
      <p class="per">Imprimé le ${echapperHtml(new Date().toLocaleString("fr-FR"))}</p>
      ${gardeMoment ? bloc("De garde en ce moment", gardeMoment.pharmacies, gardeMoment.periode) : ""}
      ${suivante ? bloc("Garde suivante", suivante.pharmacies, (suivante.groupe?.nom ? suivante.groupe.nom + " — " : "") + libellePeriode(suivante)) : ""}
      <h2>Toutes les pharmacies</h2>
      <table><thead><tr><th>Pharmacie</th><th>Quartier</th><th>Téléphone</th><th>Horaires</th><th>Groupe</th></tr></thead>
      <tbody>${z.pharmacies.map(ligne).join("")}</tbody></table></body></html>`);
    w.document.close();
    w.print();
  };

  const pharmaciesFiltrees = (z?.pharmacies || []).filter((p) => {
    const q = recherche.trim().toLowerCase();
    return !q || [p.nom, p.quartier, p.telephone, nomGroupe(p.groupeId)].some((v) => (v || "").toLowerCase().includes(q));
  });
  const prochaines = z && rotation && gardeConfiguree(z) ? [0, 1, 2, 3, 4, 5].map((k) => periodeDeGarde(z, maintenant, k)!) : [];
  const paysReference = references ? Array.from(new Set(references.map((r) => r.pays))) : [];

  const CartePharmacie = ({ p }: { p: Pharmacie }) => {
    const lien = lienItineraire(p);
    return (
      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
        <div className="font-bold text-sm text-emerald-900 dark:text-emerald-200">{p.nom}</div>
        {p.quartier && <div className="text-xs text-stone-600 dark:text-stone-400">{p.quartier}</div>}
        {p.horaires && <div className="text-xs text-stone-500 italic">{p.horaires}</div>}
        <div className="flex flex-wrap gap-2 mt-2">
          {[p.telephone, p.telephone2].filter(Boolean).map((t) => (
            <a key={t} href={`tel:${t!.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100">
              <Phone className="w-3.5 h-3.5 text-primary-600" />{t}
            </a>
          ))}
          {lien && (
            <a href={lien} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-100">
              <Navigation className="w-3.5 h-3.5 text-primary-600" />Itinéraire
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div id="pharmacies-garde" className={`rounded-2xl border p-5 shadow-xs ${carte}`}>
      {/* ─── En-tête : ville + actions ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
            <Pill className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className={`text-base font-serif font-bold ${titre}`}>Pharmacies de garde</h3>
            {donnees.zones.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <select className={`${champ} w-auto py-1`} value={z?.id || ""} onChange={(e) => setZoneId(e.target.value)} aria-label="Ville affichée">
                  {paysListe.map((pays) => (
                    <optgroup key={pays} label={pays}>
                      {donnees.zones.filter((x) => x.pays === pays).map((x) => (
                        <option key={x.id} value={x.id}>{x.id === donnees.zoneCabinetId ? "⭐ " : ""}{x.ville} ({x.pharmacies.length})</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {estCabinet && <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1"><Star className="w-3.5 h-3.5" />ville du cabinet (ordonnances, portail)</span>}
              </div>
            ) : (
              <p className="text-xs text-stone-500 font-medium">Aucune ville enregistrée.</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {gardeMoment && (
            <>
              <button type="button" onClick={partagerWhatsApp} className="px-3 py-2 bg-[#25D366] hover:brightness-95 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
                <Share2 className="w-4 h-4" /> WhatsApp
              </button>
              <button type="button" onClick={imprimer} className="px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-100 font-bold text-xs rounded-lg flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> Imprimer
              </button>
            </>
          )}
          <button type="button" onClick={() => { setAjoutVille(!ajoutVille); setErreur(null); }} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
            <Globe className="w-4 h-4" /> Ajouter une ville
          </button>
          {z && (
            <button type="button" onClick={() => setGestion(!gestion)} className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> {gestion ? "Fermer la gestion" : "Gérer"}
            </button>
          )}
        </div>
      </div>

      {/* ─── Ajouter une ville ─── */}
      {ajoutVille && (
        <div className="mt-4 p-4 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-3 text-sm">
          {chargement && <div className="text-xs text-stone-500">Chargement de la liste des villes…</div>}
          {references && (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div><label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">Pays</label>
                  <select className={`${champ} w-auto`} value={refPays} onChange={(e) => { setRefPays(e.target.value); setRefVille(""); }}>
                    {paysReference.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select></div>
                <div><label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">Ville</label>
                  <select className={`${champ} w-auto`} value={refVille} onChange={(e) => setRefVille(e.target.value)}>
                    <option value="">— choisir —</option>
                    {references.filter((r) => r.pays === refPays).map((r) => (
                      <option key={r.ville} value={r.ville}>
                        {r.ville}{r.pharmacies?.length ? ` — ${r.pharmacies.length} pharmacies` : ""}{r.rotation ? " · tour de garde" : ""}{donnees.zones.some((x) => memeVille(x, r.pays, r.ville)) ? " (déjà ajoutée)" : ""}
                      </option>
                    ))}
                  </select></div>
                <button type="button" disabled={!refVille} onClick={ajouterVilleChoisie} className="px-3 py-2 bg-primary-600 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" />Ajouter</button>
                <button type="button" onClick={() => ajouterToutPays(refPays)} className="px-3 py-2 bg-stone-200 dark:bg-stone-700 rounded-lg text-xs font-bold">Toutes les villes de ce pays</button>
              </div>
              <button type="button" onClick={ajouterToutBurkina} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold">
                Charger tout le Burkina Faso ({references.filter((r) => r.pays === "Burkina Faso").reduce((s, r) => s + (r.pharmacies?.length || 0), 0)} pharmacies pré-remplies)
              </button>
              <p className="text-xs text-stone-500">
                Burkina : pharmacies, positions GPS et groupes de garde pré-remplis d'après des sources publiques — à vérifier. Autres pays : pas de tour de garde fixe ;
                la ville est créée vide avec un lien pour vérifier la garde chaque semaine, puis vous cochez les pharmacies de garde.
              </p>
            </>
          )}
          <div className="flex flex-wrap items-end gap-2 border-t border-stone-200 dark:border-stone-700 pt-3">
            <span className="text-xs font-bold text-stone-600 dark:text-stone-300 w-full">Autre ville (saisie libre)</span>
            <input className={`${champ} w-40`} placeholder="Pays" maxLength={60} value={villeLibre.pays} onChange={(e) => setVilleLibre({ ...villeLibre, pays: e.target.value })} />
            <input className={`${champ} w-40`} placeholder="Ville" maxLength={60} value={villeLibre.ville} onChange={(e) => setVilleLibre({ ...villeLibre, ville: e.target.value })} />
            <button type="button" onClick={ajouterVilleLibre} className="px-3 py-2 bg-stone-200 dark:bg-stone-700 rounded-lg text-xs font-bold">Créer</button>
          </div>
          {erreur && <div className="text-xs text-danger-700 font-semibold">{erreur}</div>}
        </div>
      )}

      {/* ─── Garde du moment ─── */}
      <div className="mt-4">
        {!z ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Cliquez sur <strong>Ajouter une ville</strong> : choisissez d'abord la ville du cabinet (ex. Bobo-Dioulasso), puis les autres villes utiles à vos patients.</span>
          </div>
        ) : rotation ? (
          !actuelle ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Le tour de garde de {z.ville} n'est pas encore réglé. Cliquez sur <strong>Gérer</strong> : créez les groupes dans l'ordre du programme officiel, puis indiquez quel groupe est de garde à une date connue.</span>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                  De garde en ce moment {actuelle.groupe ? `· ${actuelle.groupe.nom}` : ""}{actuelle.corrigee ? " (corrigé)" : ""}
                </div>
                <div className="text-xs text-stone-500 mb-2">{libellePeriode(actuelle)}</div>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {actuelle.pharmacies.length ? actuelle.pharmacies.map((p) => <CartePharmacie key={p.id} p={p} />)
                    : <div className="text-xs text-stone-500 italic">Aucune pharmacie enregistrée dans ce groupe.</div>}
                </div>
              </div>
              {suivante && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Garde suivante {suivante.groupe ? `· ${suivante.groupe.nom}` : ""}{suivante.corrigee ? " (corrigé)" : ""}
                  </div>
                  <div className="text-xs text-stone-500 mb-2">{libellePeriode(suivante)}</div>
                  <div className="text-sm text-stone-700 dark:text-stone-300 space-y-1 max-h-[420px] overflow-y-auto">
                    {suivante.pharmacies.length ? suivante.pharmacies.map((p) => (
                      <div key={p.id}>• <strong>{p.nom}</strong>{p.quartier ? ` — ${p.quartier}` : ""}{telephones(p) ? ` — ${telephones(p)}` : ""}</div>
                    )) : <div className="text-xs italic text-stone-500">Aucune pharmacie dans ce groupe.</div>}
                  </div>
                </div>
              )}
            </div>
          )
        ) : gardeMoment ? (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">De garde (saisie manuelle)</div>
            <div className="text-xs text-stone-500 mb-2">{gardeMoment.periode}</div>
            <div className="grid sm:grid-cols-2 gap-2">{gardeMoment.pharmacies.map((p) => <CartePharmacie key={p.id} p={p} />)}</div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              Pas de tour de garde fixe à {z.ville} : la garde de cette semaine n'est pas encore saisie.
              {z.lien ? <> Consultez la liste sur <a className="underline font-bold" href={z.lien} target="_blank" rel="noopener noreferrer">{z.lienLibelle || "la source officielle"}</a>, puis</> : " Renseignez-vous, puis"}
              {" "}dans <strong>Gérer</strong>, ajoutez les pharmacies si besoin et cochez celles qui sont de garde.
            </span>
          </div>
        )}
        {z?.lien && (
          <a href={z.lien} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />Vérifier la garde sur {z.lienLibelle || "la source officielle"}
          </a>
        )}
      </div>

      {/* ─── Gestion de la ville affichée ─── */}
      {gestion && z && (
        <div className="mt-6 space-y-6 border-t border-stone-200 dark:border-stone-700 pt-5">
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <div><label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">Pays</label>
              <input className={champ} maxLength={60} value={z.pays} onChange={(e) => { const pays = nettoyerTexte(e.target.value).replace(/[<>]/g, "").slice(0, 60); majZone((x) => ({ ...x, pays })); }} /></div>
            <div><label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">Ville</label>
              <input className={champ} maxLength={60} value={z.ville} onChange={(e) => { const ville = nettoyerTexte(e.target.value).replace(/[<>]/g, "").slice(0, 60); majZone((x) => ({ ...x, ville })); }} /></div>
            <div><label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">Garde</label>
              <select className={champ} value={z.modeGarde} onChange={(e) => majZone((x) => ({ ...x, modeGarde: e.target.value === "manuel" ? "manuel" : "rotation" }))}>
                <option value="rotation">Tour de garde automatique (groupes)</option>
                <option value="manuel">Saisie manuelle chaque semaine</option>
              </select></div>
            <div className="flex gap-2">
              {!estCabinet && <button type="button" onClick={() => majTout((d) => ({ ...d, zoneCabinetId: z.id }))} className="px-3 py-2 bg-amber-100 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1"><Star className="w-3.5 h-3.5" />Ville du cabinet</button>}
              <button type="button" onClick={supprimerVille} className="px-3 py-2 bg-danger-50 text-danger-700 rounded-lg text-xs font-bold flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />Supprimer la ville</button>
            </div>
            <div className="sm:col-span-2 lg:col-span-4"><label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">Lien pour vérifier la garde (facultatif)</label>
              <input className={champ} maxLength={300} value={z.lien || ""} placeholder="https://…"
                onChange={(e) => { const v = e.target.value.trim(); majZone((x) => ({ ...x, lien: /^https:\/\/\S+$/i.test(v) ? v : undefined, lienLibelle: /^https:\/\//i.test(v) ? x.lienLibelle || "le site" : undefined })); }} /></div>
          </section>

          {rotation ? (
            <section className="space-y-3">
              <h4 className={`text-sm font-bold ${titre} flex items-center gap-2`}><CalendarClock className="w-4 h-4 text-primary-600" /> Groupes et tour de garde — {z.ville}</h4>
              <p className="text-xs text-stone-500">Créez les groupes <strong>dans l'ordre du programme officiel</strong>. Chaque garde passe au groupe suivant, puis le tour recommence.</p>
              <div className="flex gap-2 max-w-md">
                <input className={champ} value={nouveauGroupe} placeholder="Nom du groupe (ex : Groupe 1)" maxLength={50}
                  onChange={(e) => setNouveauGroupe(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ajouterGroupe()} />
                <button type="button" onClick={ajouterGroupe} className="px-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" />Ajouter</button>
              </div>
              {z.garde.groupes.length > 0 && (
                <ol className="space-y-1 max-w-md">
                  {z.garde.groupes.map((g, i) => (
                    <li key={g.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-stone-50 dark:bg-stone-800">
                      <span className="w-6 text-center font-bold text-stone-400">{i + 1}</span>
                      <span className="flex-1 font-semibold">{g.nom} <span className="text-xs text-stone-500 font-normal">({z.pharmacies.filter((p) => p.groupeId === g.id).length} pharmacie(s))</span></span>
                      <button type="button" title="Monter" onClick={() => deplacerGroupe(i, -1)} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded"><ChevronUp className="w-4 h-4" /></button>
                      <button type="button" title="Descendre" onClick={() => deplacerGroupe(i, 1)} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded"><ChevronDown className="w-4 h-4" /></button>
                      <button type="button" title="Renommer" onClick={() => renommerGroupe(g.id)} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded"><Pencil className="w-4 h-4" /></button>
                      <button type="button" title="Supprimer" onClick={() => supprimerGroupe(g.id)} className="p-1 hover:bg-danger-100 text-danger-600 rounded"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ol>
              )}
              {z.garde.groupes.length > 0 && (
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm flex flex-wrap items-center gap-2">
                  <span>Le groupe</span>
                  <select className={`${champ} w-auto`} value={z.garde.groupeReferenceId} onChange={(e) => reglerGarde({ groupeReferenceId: e.target.value })}>
                    <option value="">— choisir —</option>
                    {z.garde.groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                  </select>
                  <span>est de garde à partir du</span>
                  <input type="date" className={`${champ} w-auto`} value={z.garde.dateReference} onChange={(e) => reglerGarde({ dateReference: e.target.value })} />
                  <span>à</span>
                  <input type="time" className={`${champ} w-auto`} value={z.garde.heureChangement} onChange={(e) => reglerGarde({ heureChangement: /^\d{2}:\d{2}$/.test(e.target.value) ? e.target.value : "08:00" })} />
                  <span>; chaque garde dure</span>
                  <input type="number" min={1} max={31} className={`${champ} w-20`} value={z.garde.dureeJours}
                    onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 31) reglerGarde({ dureeJours: n }); }} />
                  <span>jours.</span>
                </div>
              )}
              {prochaines.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Prochaines gardes (vérifiez avec le programme officiel)</div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {prochaines.map((p, k) => (
                      <div key={k} className={`p-2 rounded-lg text-xs border ${k === 0 ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30" : "border-stone-200 dark:border-stone-700"}`}>
                        <div className="font-bold">{p.groupe?.nom || "—"}{p.corrigee ? " (corrigé)" : ""}</div>
                        <div className="text-stone-500">{libellePeriode(p)}</div>
                        <div className="text-stone-600 dark:text-stone-400 truncate">{p.pharmacies.map((x) => x.nom).join(", ") || "aucune pharmacie"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold">Corriger une garde :</span>
                    <select className={`${champ} w-auto`} value={correction.decalage} onChange={(e) => setCorrection({ ...correction, decalage: Number(e.target.value) })}>
                      {prochaines.map((p, k) => <option key={k} value={k}>{k === 0 ? "Garde actuelle" : `Garde du ${p.debut.toLocaleDateString("fr-FR")}`}</option>)}
                    </select>
                    <span>→</span>
                    <select className={`${champ} w-auto`} value={correction.groupeId} onChange={(e) => setCorrection({ ...correction, groupeId: e.target.value })}>
                      <option value="">— groupe —</option>
                      {z.garde.groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                    </select>
                    <button type="button" disabled={!correction.groupeId} onClick={appliquerCorrection} className="px-3 py-1.5 bg-primary-600 disabled:opacity-40 text-white rounded-lg font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" />Appliquer</button>
                  </div>
                  {z.garde.exceptions.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {z.garde.exceptions.map((e) => (
                        <span key={e.debut} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                          Garde du {new Date(e.debut + "T12:00").toLocaleDateString("fr-FR")} → {nomGroupe(e.groupeId) || "?"}
                          <button type="button" title="Retirer la correction" onClick={() => majZone((x) => ({ ...x, garde: { ...x.garde, exceptions: x.garde.exceptions.filter((y) => y.debut !== e.debut) } }))}><X className="w-3.5 h-3.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-2">
              <h4 className={`text-sm font-bold ${titre} flex items-center gap-2`}><CalendarClock className="w-4 h-4 text-primary-600" /> Garde de la semaine — {z.ville}</h4>
              <p className="text-xs text-stone-500">Cochez dans la liste ci-dessous les pharmacies de garde (colonne « De garde »), et indiquez jusqu'à quelle date.</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>De garde jusqu'au</span>
                <input type="date" className={`${champ} w-auto`} value={z.gardeManuelle.jusquau} onChange={(e) => majZone((x) => ({ ...x, gardeManuelle: { ...x.gardeManuelle, jusquau: e.target.value } }))} />
                <span className="text-xs text-stone-500">({z.gardeManuelle.ids.length} pharmacie(s) cochée(s))</span>
                {z.gardeManuelle.ids.length > 0 && <button type="button" onClick={() => majZone((x) => ({ ...x, gardeManuelle: { ids: [], jusquau: "" } }))} className="text-xs font-bold text-danger-700 hover:underline">Tout décocher</button>}
              </div>
            </section>
          )}

          {/* Pharmacies de la ville */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className={`text-sm font-bold ${titre} flex items-center gap-2`}><MapPin className="w-4 h-4 text-primary-600" /> Pharmacies — {z.ville} ({z.pharmacies.length})</h4>
              <button type="button" onClick={() => setImportOuvert(!importOuvert)} className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1"><Upload className="w-3.5 h-3.5" />Importer une liste</button>
            </div>
            {importOuvert && (
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2">
                <p className="text-xs text-stone-600 dark:text-stone-300">Une pharmacie par ligne : <code>Nom ; Quartier ; Téléphone ; Groupe</code> (le groupe est facultatif).</p>
                <textarea className={`${champ} h-32 font-mono text-xs`} value={importTexte} onChange={(e) => setImportTexte(e.target.value)}
                  placeholder={"Pharmacie du Marché ; Centre-ville ; 20 97 00 00 ; Groupe 1"} />
                <button type="button" onClick={importer} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold">Importer</button>
              </div>
            )}

            <div id="form-pharmacie" className="p-3 rounded-xl border border-stone-200 dark:border-stone-700 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="sm:col-span-2"><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Nom *</label>
                <input className={champ} maxLength={100} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Pharmacie …" /></div>
              <div><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Quartier / repère</label>
                <input className={champ} maxLength={100} value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} /></div>
              <div><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Groupe de garde</label>
                <select className={champ} value={form.groupeId} onChange={(e) => setForm({ ...form, groupeId: e.target.value })}>
                  <option value="">— aucun —</option>
                  {z.garde.groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select></div>
              <div><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Téléphone 1</label>
                <input className={champ} inputMode="tel" maxLength={20} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="70 12 34 56" /></div>
              <div><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Téléphone 2</label>
                <input className={champ} inputMode="tel" maxLength={20} value={form.telephone2} onChange={(e) => setForm({ ...form, telephone2: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Position GPS / lien Google Maps</label>
                <div className="flex gap-1">
                  <input className={champ} maxLength={500} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="11.1771, -4.2979  ou  https://maps.app.goo.gl/…" />
                  <button type="button" title="Ma position actuelle (depuis la pharmacie)" onClick={maPosition} className="px-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200"><Crosshair className="w-4 h-4 text-primary-600" /></button>
                </div></div>
              <div className="sm:col-span-2"><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Horaires</label>
                <input className={champ} maxLength={100} value={form.horaires} onChange={(e) => setForm({ ...form, horaires: e.target.value })} placeholder="Lun–Sam 7h30–22h ; 24h/24 pendant la garde" /></div>
              <div className="sm:col-span-2"><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Remarques (internes, non visibles des patients)</label>
                <input className={champ} maxLength={300} value={form.remarques} onChange={(e) => setForm({ ...form, remarques: e.target.value })} placeholder="Ex : accepte telle assurance" /></div>
              {erreur && <div className="sm:col-span-2 lg:col-span-4 text-xs text-danger-700 font-semibold">{erreur}</div>}
              <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
                <button type="button" onClick={enregistrerPharmacie} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center gap-1">
                  {editionId ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{editionId ? "Enregistrer les modifications" : "Ajouter la pharmacie"}
                </button>
                {editionId && <button type="button" onClick={() => { setEditionId(null); setForm(FORM_VIDE); setErreur(null); }} className="px-4 py-2 bg-stone-100 dark:bg-stone-800 rounded-lg text-xs font-bold">Annuler</button>}
              </div>
            </div>

            {z.pharmacies.length > 0 && (
              <>
                <div className="relative max-w-sm">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-stone-400" />
                  <input className={`${champ} pl-8`} value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (nom, quartier, groupe…)" />
                </div>
                <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white dark:bg-stone-900"><tr className="text-left text-xs uppercase text-stone-500 border-b border-stone-200 dark:border-stone-700">
                      {!rotation && <th className="py-2 pr-2">De garde</th>}
                      <th className="py-2 pr-2">Pharmacie</th><th className="pr-2">Quartier</th><th className="pr-2">Téléphone</th>{rotation && <th className="pr-2">Groupe</th>}<th className="pr-2">Carte</th><th></th>
                    </tr></thead>
                    <tbody>
                      {pharmaciesFiltrees.map((p) => {
                        const lien = lienItineraire(p);
                        const deGarde = gardeMoment?.pharmacies.some((x) => x.id === p.id);
                        return (
                          <tr key={p.id} className="border-b border-stone-100 dark:border-stone-800 align-top">
                            {!rotation && <td className="py-2 pr-2"><input type="checkbox" className="w-4 h-4" checked={z.gardeManuelle.ids.includes(p.id)} onChange={() => basculerGardeManuelle(p.id)} /></td>}
                            <td className="py-2 pr-2"><span className="font-semibold">{p.nom}</span>{deGarde && <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">de garde</span>}
                              {p.horaires && <div className="text-xs text-stone-500">{p.horaires}</div>}
                              {p.remarques && <div className="text-xs text-stone-500 italic">{p.remarques}</div>}</td>
                            <td className="pr-2 py-2">{p.quartier}</td>
                            <td className="pr-2 py-2 whitespace-nowrap">{telephones(p)}</td>
                            {rotation && <td className="pr-2 py-2">{nomGroupe(p.groupeId) || <span className="text-stone-400">—</span>}</td>}
                            <td className="pr-2 py-2">{lien ? <a href={lien} target="_blank" rel="noopener noreferrer" className="text-primary-600"><Navigation className="w-4 h-4" /></a> : <span className="text-stone-400">—</span>}</td>
                            <td className="py-2 whitespace-nowrap text-right">
                              <button type="button" title="Modifier" onClick={() => modifier(p)} className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"><Pencil className="w-4 h-4" /></button>
                              <button type="button" title="Supprimer" onClick={() => supprimer(p)} className="p-1 hover:bg-danger-100 text-danger-600 rounded"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
