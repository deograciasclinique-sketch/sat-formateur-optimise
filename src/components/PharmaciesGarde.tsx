/**
 * Pharmacies de la zone & pharmacie de garde (onglet Pharmacie).
 *
 * • En haut : la (les) pharmacie(s) de garde EN CE MOMENT, calculée(s) automatiquement,
 *   avec la garde suivante, le partage WhatsApp et l'impression.
 * • « Gérer » : liste des pharmacies (ajout, import par lot), groupes et réglage du tour de garde,
 *   corrections ponctuelles, aperçu des prochaines semaines.
 * Toutes les modifications sont synchronisées entre les postes et publiées pour le portail patient.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  Pill, Phone, Navigation, Share2, Printer, Settings, Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Crosshair, Search, X, Check, CalendarClock, Upload, AlertTriangle,
} from "lucide-react";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import { db } from "../lib/firebase";
import { generateUid } from "../data";
import { nettoyerDonnees, nettoyerTexte } from "../lib/nettoyage";
import {
  CLE_PHARMACIES, DONNEES_VIDES, DonneesPharmacies, Pharmacie, PeriodeGarde,
  normaliser, periodeDeGarde, gardeConfiguree, libellePeriode, telephones, lienItineraire,
  lirePosition, texteGarde, echapperHtml, donneesPubliques, versJour,
} from "../lib/pharmacies";

type Props = { theme?: "light" | "dark" };

const FORM_VIDE = { nom: "", quartier: "", telephone: "", telephone2: "", position: "", horaires: "", groupeId: "", remarques: "" };

function propre(t: string, max: number) {
  return nettoyerTexte(t).replace(/[<>]/g, "").trim().slice(0, max);
}
function chiffres(t: string) {
  return t.replace(/\D/g, "").length;
}

export default function PharmaciesGarde({ theme = "light" }: Props) {
  const [brut, setBrut] = useCloudSyncedState<DonneesPharmacies>(CLE_PHARMACIES, DONNEES_VIDES);
  const donnees = useMemo(() => normaliser(brut), [brut]);
  const maj = (f: (d: DonneesPharmacies) => DonneesPharmacies) => setBrut((prev) => f(normaliser(prev)));

  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 60_000); // la garde change à l'heure prévue, sans recharger
    return () => clearInterval(t);
  }, []);

  const actuelle = periodeDeGarde(donnees, maintenant, 0);
  const suivante = periodeDeGarde(donnees, maintenant, 1);

  const [gestion, setGestion] = useState(false);
  const [form, setForm] = useState(FORM_VIDE);
  const [editionId, setEditionId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [importTexte, setImportTexte] = useState("");
  const [importOuvert, setImportOuvert] = useState(false);
  const [nouveauGroupe, setNouveauGroupe] = useState("");
  const [correction, setCorrection] = useState<{ decalage: number; groupeId: string }>({ decalage: 0, groupeId: "" });

  // ─── Copie publique pour le portail patient (si connecté au cloud) ───
  useEffect(() => {
    if (!db || (donnees.pharmacies.length === 0 && donnees.garde.groupes.length === 0)) return;
    const t = setTimeout(() => {
      db!.collection("pharmacies_public").doc("zone")
        .set(nettoyerDonnees({ ...donneesPubliques(donnees), updatedAt: Date.now() }))
        .catch((e: any) => console.error("[pharmacies] Publication pour le portail impossible :", e));
    }, 2000);
    return () => clearTimeout(t);
  }, [JSON.stringify(donnees)]); // eslint-disable-line react-hooks/exhaustive-deps

  const carte = theme === "dark" ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200";
  const titre = theme === "dark" ? "text-white" : "text-stone-900";
  const champ = "w-full p-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 focus:ring-2 focus:ring-primary-500 outline-none";
  const nomGroupe = (id?: string) => donnees.garde.groupes.find((g) => g.id === id)?.nom || "";

  // ─── Pharmacies : ajout / modification ───
  const enregistrerPharmacie = () => {
    setErreur(null);
    const nom = propre(form.nom, 100);
    if (nom.length < 2) return setErreur("Indiquez le nom de la pharmacie.");
    if (form.telephone && (chiffres(form.telephone) < 8 || chiffres(form.telephone) > 15)) return setErreur("Téléphone 1 invalide (8 chiffres attendus).");
    if (form.telephone2 && (chiffres(form.telephone2) < 8 || chiffres(form.telephone2) > 15)) return setErreur("Téléphone 2 invalide (8 chiffres attendus).");
    let lat: number | null = null, lng: number | null = null, lienMaps = "";
    if (form.position.trim()) {
      const pos = lirePosition(form.position);
      if (!pos) return setErreur("Position non reconnue : collez un lien Google Maps (https://…) ou des coordonnées comme « 11.1771, -4.2979 ».");
      if ("lat" in pos) { lat = pos.lat; lng = pos.lng; } else lienMaps = pos.lien;
    }
    const doublon = donnees.pharmacies.find((p) => p.id !== editionId && p.nom.toLowerCase() === nom.toLowerCase());
    if (doublon) return setErreur("Une pharmacie porte déjà ce nom.");
    const ph: Pharmacie = {
      id: editionId || generateUid(),
      nom,
      quartier: propre(form.quartier, 100),
      telephone: propre(form.telephone, 20),
      telephone2: propre(form.telephone2, 20),
      lat, lng, lienMaps,
      horaires: propre(form.horaires, 100),
      remarques: propre(form.remarques, 300),
      groupeId: donnees.garde.groupes.some((g) => g.id === form.groupeId) ? form.groupeId : "",
    };
    maj((d) => ({
      ...d,
      pharmacies: editionId ? d.pharmacies.map((p) => (p.id === editionId ? ph : p)) : [...d.pharmacies, ph].sort((a, b) => a.nom.localeCompare(b.nom, "fr")),
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
    maj((d) => ({ ...d, pharmacies: d.pharmacies.filter((x) => x.id !== p.id) }));
  };

  const maPosition = () => {
    if (!navigator.geolocation) return setErreur("La localisation n'est pas disponible sur cet appareil. Collez plutôt le lien Google Maps.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, position: `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}` })),
      () => setErreur("Position introuvable (autorisation refusée ou GPS éteint). Collez plutôt le lien Google Maps."),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // ─── Import par lot : « Nom ; Quartier ; Téléphone ; Groupe » ───
  const importer = () => {
    const lignes = importTexte.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lignes.length) return;
    let ajoutees = 0, ignorees = 0;
    maj((d) => {
      const groupes = [...d.garde.groupes];
      const pharmacies = [...d.pharmacies];
      for (const ligne of lignes.slice(0, 500)) {
        const [nomB, quartierB = "", telB = "", groupeB = ""] = ligne.split(/[;\t|]/).map((s) => s.trim());
        const nom = propre(nomB || "", 100);
        if (nom.length < 2 || pharmacies.some((p) => p.nom.toLowerCase() === nom.toLowerCase())) { ignorees++; continue; }
        let groupeId = "";
        const gNom = propre(groupeB, 50);
        if (gNom) {
          let g = groupes.find((x) => x.nom.toLowerCase() === gNom.toLowerCase());
          if (!g) { g = { id: generateUid(), nom: gNom }; groupes.push(g); }
          groupeId = g.id;
        }
        const tel = propre(telB, 20);
        pharmacies.push({ id: generateUid(), nom, quartier: propre(quartierB, 100), telephone: chiffres(tel) >= 8 ? tel : "", groupeId });
        ajoutees++;
      }
      pharmacies.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
      return { ...d, pharmacies, garde: { ...d.garde, groupes } };
    });
    setImportTexte("");
    setImportOuvert(false);
    window.alert(`${ajoutees} pharmacie(s) ajoutée(s)${ignorees ? `, ${ignorees} ligne(s) ignorée(s) (nom vide ou déjà présent)` : ""}.`);
  };

  // ─── Groupes / tour de garde ───
  const ajouterGroupe = () => {
    const nom = propre(nouveauGroupe, 50);
    if (!nom) return;
    if (donnees.garde.groupes.some((g) => g.nom.toLowerCase() === nom.toLowerCase())) return window.alert("Ce groupe existe déjà.");
    maj((d) => ({ ...d, garde: { ...d.garde, groupes: [...d.garde.groupes, { id: generateUid(), nom }] } }));
    setNouveauGroupe("");
  };
  const deplacerGroupe = (i: number, sens: -1 | 1) => maj((d) => {
    const g = [...d.garde.groupes];
    const j = i + sens;
    if (j < 0 || j >= g.length) return d;
    [g[i], g[j]] = [g[j], g[i]];
    return { ...d, garde: { ...d.garde, groupes: g } };
  });
  const renommerGroupe = (id: string) => {
    const actuel = nomGroupe(id);
    const nom = propre(window.prompt("Nouveau nom du groupe :", actuel) || "", 50);
    if (!nom || nom === actuel) return;
    maj((d) => ({ ...d, garde: { ...d.garde, groupes: d.garde.groupes.map((g) => (g.id === id ? { ...g, nom } : g)) } }));
  };
  const supprimerGroupe = (id: string) => {
    const n = donnees.pharmacies.filter((p) => p.groupeId === id).length;
    if (!window.confirm(`Supprimer le groupe « ${nomGroupe(id)} » ?${n ? ` ${n} pharmacie(s) n'auront plus de groupe.` : ""}`)) return;
    maj((d) => ({
      ...d,
      pharmacies: d.pharmacies.map((p) => (p.groupeId === id ? { ...p, groupeId: "" } : p)),
      garde: {
        ...d.garde,
        groupes: d.garde.groupes.filter((g) => g.id !== id),
        groupeReferenceId: d.garde.groupeReferenceId === id ? "" : d.garde.groupeReferenceId,
        exceptions: d.garde.exceptions.filter((e) => e.groupeId !== id),
      },
    }));
  };
  const reglerGarde = (champs: Partial<DonneesPharmacies["garde"]>) => maj((d) => ({ ...d, garde: { ...d.garde, ...champs } }));

  const appliquerCorrection = () => {
    const p = periodeDeGarde(donnees, maintenant, correction.decalage);
    if (!p || !correction.groupeId) return;
    const debut = versJour(p.debut);
    maj((d) => ({
      ...d,
      garde: { ...d.garde, exceptions: [...d.garde.exceptions.filter((e) => e.debut !== debut), { debut, groupeId: correction.groupeId }].slice(-30) },
    }));
    setCorrection({ decalage: 0, groupeId: "" });
  };

  // ─── Partage / impression ───
  const partagerWhatsApp = (p: PeriodeGarde) => {
    window.open(`https://wa.me/?text=${encodeURIComponent(texteGarde(donnees, p))}`, "_blank");
  };

  const imprimer = () => {
    const w = window.open("", "_blank");
    if (!w) return window.alert("La fenêtre d'impression est bloquée. Autorisez les fenêtres pop-up.");
    const ligne = (p: Pharmacie) => `<tr><td><strong>${echapperHtml(p.nom)}</strong></td><td>${echapperHtml(p.quartier || "")}</td><td>${echapperHtml(telephones(p))}</td><td>${echapperHtml(p.horaires || "")}</td><td>${echapperHtml(nomGroupe(p.groupeId))}</td></tr>`;
    const bloc = (titreBloc: string, p: PeriodeGarde | null) => !p ? "" : `<h2>${titreBloc}</h2><p class="per">${echapperHtml(p.groupe?.nom || "")} — ${echapperHtml(libellePeriode(p))}</p>
      <table><tbody>${p.pharmacies.map(ligne).join("") || "<tr><td colspan='5'>Aucune pharmacie dans ce groupe.</td></tr>"}</tbody></table>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pharmacies de garde${donnees.zone ? " — " + echapperHtml(donnees.zone) : ""}</title>
      <style>body{font-family:Helvetica,Arial,sans-serif;color:#1c1917;padding:30px;font-size:13px}h1{color:#0d9488;font-size:20px;margin:0 0 4px}h2{color:#0d9488;font-size:15px;margin:24px 0 4px;text-transform:uppercase}
      .per{color:#57534e;margin:0 0 6px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e7e5e4;padding:6px 4px;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#78716c}</style></head><body>
      <h1>Pharmacies de garde${donnees.zone ? " — " + echapperHtml(donnees.zone) : ""}</h1>
      <p class="per">Imprimé le ${echapperHtml(new Date().toLocaleString("fr-FR"))}</p>
      ${bloc("De garde en ce moment", actuelle)}${bloc("Garde suivante", suivante)}
      <h2>Toutes les pharmacies de la zone</h2>
      <table><thead><tr><th>Pharmacie</th><th>Quartier</th><th>Téléphone</th><th>Horaires</th><th>Groupe</th></tr></thead>
      <tbody>${donnees.pharmacies.map(ligne).join("")}</tbody></table></body></html>`);
    w.document.close();
    w.print();
  };

  const pharmaciesFiltrees = donnees.pharmacies.filter((p) => {
    const q = recherche.trim().toLowerCase();
    return !q || [p.nom, p.quartier, p.telephone, nomGroupe(p.groupeId)].some((v) => (v || "").toLowerCase().includes(q));
  });
  const prochaines = gardeConfiguree(donnees) ? [0, 1, 2, 3, 4, 5].map((k) => periodeDeGarde(donnees, maintenant, k)!) : [];

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
      {/* ─── En-tête + garde actuelle ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-base font-serif font-bold ${titre}`}>Pharmacies de garde{donnees.zone ? ` — ${donnees.zone}` : ""}</h3>
            <p className="text-xs text-stone-500 font-medium">
              {donnees.pharmacies.length} pharmacie(s) de la zone · garde calculée automatiquement, affichée sur l'ordonnance et le portail patient
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actuelle && (
            <>
              <button type="button" onClick={() => partagerWhatsApp(actuelle)} className="px-3 py-2 bg-[#25D366] hover:brightness-95 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
                <Share2 className="w-4 h-4" /> WhatsApp
              </button>
              <button type="button" onClick={imprimer} className="px-3 py-2 bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-100 font-bold text-xs rounded-lg flex items-center gap-1.5">
                <Printer className="w-4 h-4" /> Imprimer
              </button>
            </>
          )}
          <button type="button" onClick={() => setGestion(!gestion)} className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5">
            <Settings className="w-4 h-4" /> {gestion ? "Fermer la gestion" : "Gérer"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        {!actuelle ? (
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              Le tour de garde n'est pas encore réglé. Cliquez sur <strong>Gérer</strong> : ajoutez les pharmacies (ou importez la liste),
              créez les groupes de garde dans l'ordre du programme officiel, puis indiquez quel groupe est de garde à une date connue.
            </span>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">
                De garde en ce moment {actuelle.groupe ? `· ${actuelle.groupe.nom}` : ""}{actuelle.corrigee ? " (corrigé)" : ""}
              </div>
              <div className="text-xs text-stone-500 mb-2">{libellePeriode(actuelle)}</div>
              <div className="space-y-2">
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
                <div className="text-sm text-stone-700 dark:text-stone-300 space-y-1">
                  {suivante.pharmacies.length ? suivante.pharmacies.map((p) => (
                    <div key={p.id}>• <strong>{p.nom}</strong>{p.quartier ? ` — ${p.quartier}` : ""}{telephones(p) ? ` — ${telephones(p)}` : ""}</div>
                  )) : <div className="text-xs italic text-stone-500">Aucune pharmacie dans ce groupe.</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Gestion ─── */}
      {gestion && (
        <div className="mt-6 space-y-6 border-t border-stone-200 dark:border-stone-700 pt-5">
          <div className="max-w-sm">
            <label className="block text-xs font-bold text-stone-600 dark:text-stone-300 mb-1">Zone / ville (affichée aux patients)</label>
            <input className={champ} value={donnees.zone} maxLength={80} placeholder="Ex : Bobo-Dioulasso"
              onChange={(e) => { const zone = nettoyerTexte(e.target.value).replace(/[<>]/g, "").slice(0, 80); maj((d) => ({ ...d, zone })); }}
              onBlur={() => maj((d) => ({ ...d, zone: d.zone.trim() }))} />
          </div>

          {/* 1. Tour de garde */}
          <section className="space-y-3">
            <h4 className={`text-sm font-bold ${titre} flex items-center gap-2`}><CalendarClock className="w-4 h-4 text-primary-600" /> 1. Groupes et tour de garde</h4>
            <p className="text-xs text-stone-500">Créez les groupes <strong>dans l'ordre du programme officiel</strong> (ex. Groupe 1, Groupe 2…). Chaque garde passe au groupe suivant, puis le tour recommence.</p>
            <div className="flex gap-2 max-w-md">
              <input className={champ} value={nouveauGroupe} placeholder="Nom du groupe (ex : Groupe 1)" maxLength={50}
                onChange={(e) => setNouveauGroupe(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ajouterGroupe()} />
              <button type="button" onClick={ajouterGroupe} className="px-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"><Plus className="w-4 h-4" />Ajouter</button>
            </div>
            {donnees.garde.groupes.length > 0 && (
              <ol className="space-y-1 max-w-md">
                {donnees.garde.groupes.map((g, i) => (
                  <li key={g.id} className="flex items-center gap-2 text-sm p-2 rounded-lg bg-stone-50 dark:bg-stone-800">
                    <span className="w-6 text-center font-bold text-stone-400">{i + 1}</span>
                    <span className="flex-1 font-semibold">{g.nom} <span className="text-xs text-stone-500 font-normal">({donnees.pharmacies.filter((p) => p.groupeId === g.id).length} pharmacie(s))</span></span>
                    <button type="button" title="Monter" onClick={() => deplacerGroupe(i, -1)} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded"><ChevronUp className="w-4 h-4" /></button>
                    <button type="button" title="Descendre" onClick={() => deplacerGroupe(i, 1)} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded"><ChevronDown className="w-4 h-4" /></button>
                    <button type="button" title="Renommer" onClick={() => renommerGroupe(g.id)} className="p-1 hover:bg-stone-200 dark:hover:bg-stone-700 rounded"><Pencil className="w-4 h-4" /></button>
                    <button type="button" title="Supprimer" onClick={() => supprimerGroupe(g.id)} className="p-1 hover:bg-danger-100 text-danger-600 rounded"><Trash2 className="w-4 h-4" /></button>
                  </li>
                ))}
              </ol>
            )}

            {donnees.garde.groupes.length > 0 && (
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-sm flex flex-wrap items-center gap-2">
                <span>Le groupe</span>
                <select className={`${champ} w-auto`} value={donnees.garde.groupeReferenceId} onChange={(e) => reglerGarde({ groupeReferenceId: e.target.value })}>
                  <option value="">— choisir —</option>
                  {donnees.garde.groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select>
                <span>est de garde à partir du</span>
                <input type="date" className={`${champ} w-auto`} value={donnees.garde.dateReference} onChange={(e) => reglerGarde({ dateReference: e.target.value })} />
                <span>à</span>
                <input type="time" className={`${champ} w-auto`} value={donnees.garde.heureChangement} onChange={(e) => reglerGarde({ heureChangement: /^\d{2}:\d{2}$/.test(e.target.value) ? e.target.value : "08:00" })} />
                <span>; chaque garde dure</span>
                <input type="number" min={1} max={31} className={`${champ} w-20`} value={donnees.garde.dureeJours}
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
                    {donnees.garde.groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                  </select>
                  <button type="button" disabled={!correction.groupeId} onClick={appliquerCorrection} className="px-3 py-1.5 bg-primary-600 disabled:opacity-40 text-white rounded-lg font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" />Appliquer</button>
                </div>
                {donnees.garde.exceptions.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {donnees.garde.exceptions.map((e) => (
                      <span key={e.debut} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                        Garde du {new Date(e.debut + "T12:00").toLocaleDateString("fr-FR")} → {nomGroupe(e.groupeId) || "?"}
                        <button type="button" title="Retirer la correction" onClick={() => maj((d) => ({ ...d, garde: { ...d.garde, exceptions: d.garde.exceptions.filter((x) => x.debut !== e.debut) } }))}><X className="w-3.5 h-3.5" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 2. Pharmacies */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className={`text-sm font-bold ${titre} flex items-center gap-2`}><Pill className="w-4 h-4 text-primary-600" /> 2. Pharmacies de la zone</h4>
              <button type="button" onClick={() => setImportOuvert(!importOuvert)} className="text-xs font-bold text-primary-600 hover:underline flex items-center gap-1"><Upload className="w-3.5 h-3.5" />Importer une liste</button>
            </div>

            {importOuvert && (
              <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 space-y-2">
                <p className="text-xs text-stone-600 dark:text-stone-300">
                  Une pharmacie par ligne : <code>Nom ; Quartier ; Téléphone ; Groupe</code>. Les groupes inconnus sont créés automatiquement (dans l'ordre d'apparition — vérifiez ensuite l'ordre).
                </p>
                <textarea className={`${champ} h-32 font-mono text-xs`} value={importTexte} onChange={(e) => setImportTexte(e.target.value)}
                  placeholder={"Pharmacie du Marché ; Centre-ville ; 20 97 00 00 ; Groupe 1\nPharmacie Yéguéré ; Yéguéré ; 70 00 00 00 ; Groupe 2"} />
                <button type="button" onClick={importer} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-bold">Importer</button>
              </div>
            )}

            <div id="form-pharmacie" className="p-3 rounded-xl border border-stone-200 dark:border-stone-700 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="sm:col-span-2"><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Nom *</label>
                <input className={champ} maxLength={100} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Pharmacie …" /></div>
              <div><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Quartier</label>
                <input className={champ} maxLength={100} value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} /></div>
              <div><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Groupe de garde</label>
                <select className={champ} value={form.groupeId} onChange={(e) => setForm({ ...form, groupeId: e.target.value })}>
                  <option value="">— aucun —</option>
                  {donnees.garde.groupes.map((g) => <option key={g.id} value={g.id}>{g.nom}</option>)}
                </select></div>
              <div><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Téléphone 1</label>
                <input className={champ} inputMode="tel" maxLength={20} value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="70 12 34 56" /></div>
              <div><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Téléphone 2</label>
                <input className={champ} inputMode="tel" maxLength={20} value={form.telephone2} onChange={(e) => setForm({ ...form, telephone2: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className="text-xs font-bold text-stone-600 dark:text-stone-300">Position GPS / lien Google Maps</label>
                <div className="flex gap-1">
                  <input className={champ} maxLength={500} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="11.1771, -4.2979  ou  https://maps.app.goo.gl/…" />
                  <button type="button" title="Ma position actuelle (à faire depuis la pharmacie)" onClick={maPosition} className="px-2 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200"><Crosshair className="w-4 h-4 text-primary-600" /></button>
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

            {donnees.pharmacies.length > 0 && (
              <>
                <div className="relative max-w-sm">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-stone-400" />
                  <input className={`${champ} pl-8`} value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher (nom, quartier, groupe…)" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs uppercase text-stone-500 border-b border-stone-200 dark:border-stone-700">
                      <th className="py-2 pr-2">Pharmacie</th><th className="pr-2">Quartier</th><th className="pr-2">Téléphone</th><th className="pr-2">Groupe</th><th className="pr-2">Carte</th><th></th>
                    </tr></thead>
                    <tbody>
                      {pharmaciesFiltrees.map((p) => {
                        const lien = lienItineraire(p);
                        const deGarde = actuelle?.pharmacies.some((x) => x.id === p.id);
                        return (
                          <tr key={p.id} className="border-b border-stone-100 dark:border-stone-800 align-top">
                            <td className="py-2 pr-2"><span className="font-semibold">{p.nom}</span>{deGarde && <span className="ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">de garde</span>}
                              {p.horaires && <div className="text-xs text-stone-500">{p.horaires}</div>}
                              {p.remarques && <div className="text-xs text-stone-500 italic">{p.remarques}</div>}</td>
                            <td className="pr-2 py-2">{p.quartier}</td>
                            <td className="pr-2 py-2 whitespace-nowrap">{telephones(p)}</td>
                            <td className="pr-2 py-2">{nomGroupe(p.groupeId) || <span className="text-stone-400">—</span>}</td>
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
