/**
 * Caméras de surveillance du cabinet — réservé au Responsable du service.
 *
 * Les caméras EZVIZ, Imou et Hik-Connect passent par le cloud de leur marque :
 * le direct s'ouvre dans l'application de la marque (sur le téléphone : un
 * geste depuis l'APK ; sur PC : le site / logiciel de la marque). La liste des
 * caméras (nom, emplacement, marque) est partagée entre les appareils.
 */

import React, { useState } from "react";
import { Camera, Plus, Pencil, Trash2, ShieldCheck, Video, Info } from "lucide-react";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";
import { NATIF, ouvrirApplication } from "../lib/natif";
import { logActivity } from "../lib/activityLogger";

type Marque = "ezviz" | "imou" | "hik";

interface CameraCfg {
  id: string;
  nom: string;
  emplacement: string;
  marque: Marque;
  note?: string;
}

const MARQUES: Record<Marque, { nom: string; pkg: string; site: string; pc: string }> = {
  ezviz: { nom: "EZVIZ", pkg: "com.ezviz", site: "https://www.ezviz.com/", pc: "Sur PC : logiciel « EZVIZ Studio » (Windows), téléchargeable sur ezviz.com." },
  imou: { nom: "Imou Life", pkg: "com.mm.android.smartlifeiot", site: "https://www.imoulife.com/", pc: "Sur PC : logiciel « Imou Life » pour Windows, téléchargeable sur imoulife.com." },
  hik: { nom: "Hik-Connect", pkg: "com.connect.enduser", site: "https://www.hik-connect.com/", pc: "Sur PC : site hik-connect.com ou logiciel « iVMS-4200 » de Hikvision." },
};

const vide = (): CameraCfg => ({ id: "", nom: "", emplacement: "", marque: "ezviz", note: "" });

export default function TabCameras({ theme = "light", agentNom }: { theme?: string; agentNom?: string }) {
  const isDark = theme === "dark";
  const [cameras, setCameras] = useCloudSyncedState<CameraCfg[]>("dg_cameras", []);
  const [form, setForm] = useState<CameraCfg | null>(null);
  const card = `rounded-xl border ${isDark ? "border-stone-700 bg-stone-900" : "border-stone-200 bg-white"}`;
  const muted = isDark ? "text-stone-400" : "text-stone-500";
  const champ = `w-full mt-1 px-3 py-2 rounded-lg border bg-transparent ${isDark ? "border-stone-700" : "border-stone-300"}`;

  const marquesUtilisees = Array.from(new Set(cameras.map((c) => c.marque)));

  const voir = async (c: CameraCfg | null, m: Marque) => {
    const M = MARQUES[m];
    logActivity("Caméras : ouverture du direct", "autre", c ? `${c.nom} (${c.emplacement || M.nom})` : M.nom, agentNom);
    await ouvrirApplication(M.pkg, M.nom, M.site);
  };

  const enregistrer = () => {
    if (!form) return;
    if (!form.nom.trim()) { alert("Donnez un nom à la caméra (ex. : Entrée, Salle d'attente)."); return; }
    const c: CameraCfg = { ...form, nom: form.nom.trim().slice(0, 60), emplacement: form.emplacement.trim().slice(0, 80), note: (form.note || "").trim().slice(0, 200) };
    if (c.id) setCameras(cameras.map((x) => (x.id === c.id ? c : x)));
    else setCameras([...cameras, { ...c, id: "cam-" + Date.now().toString(36) }]);
    setForm(null);
  };

  const supprimer = (c: CameraCfg) => {
    if (!window.confirm(`Retirer la caméra « ${c.nom} » de la liste ?\n(La caméra elle-même n'est pas modifiée.)`)) return;
    setCameras(cameras.filter((x) => x.id !== c.id));
  };

  return (
    <div className={`p-4 space-y-4 ${isDark ? "text-stone-100" : "text-stone-900"}`}>
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2"><Camera className="w-5 h-5 text-emerald-600" /> Caméras de surveillance</h2>
        <p className={`text-sm ${muted}`}>
          Réservé au Responsable du service. Touchez « Voir en direct » : l'application de la caméra s'ouvre sur le direct, où que vous soyez.
        </p>
      </div>

      {marquesUtilisees.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {marquesUtilisees.map((m) => (
            <button key={m} onClick={() => voir(null, m)} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center gap-2">
              <Video className="w-4 h-4" /> Ouvrir {MARQUES[m].nom}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {cameras.map((c) => (
          <div key={c.id} className={`${card} p-4`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-base truncate">📹 {c.nom}</div>
                <div className={`text-sm ${muted}`}>{c.emplacement || "—"} · {MARQUES[c.marque].nom}</div>
                {c.note && <div className={`text-xs mt-1 ${muted}`}>{c.note}</div>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setForm({ ...c })} className={`p-2 rounded-lg border ${isDark ? "border-stone-700" : "border-stone-200"}`} aria-label={`Modifier ${c.nom}`}><Pencil className="w-4 h-4" /></button>
                <button onClick={() => supprimer(c)} className="p-2 rounded-lg border border-red-300 text-red-600" aria-label={`Retirer ${c.nom}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <button onClick={() => voir(c, c.marque)} className="mt-3 w-full px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2">
              <Video className="w-4 h-4" /> Voir en direct
            </button>
          </div>
        ))}
        {cameras.length === 0 && !form && (
          <div className={`${card} p-6 text-center sm:col-span-2`}>
            <p className={`text-sm ${muted} mb-3`}>Aucune caméra pour l'instant. Ajoutez chaque caméra du cabinet (une fois) : elle apparaîtra sur tous vos appareils.</p>
          </div>
        )}
      </div>

      {form ? (
        <div className={`${card} p-4 space-y-3`}>
          <div className="font-bold">{form.id ? "Modifier la caméra" : "Nouvelle caméra"}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Nom<input className={champ} value={form.nom} maxLength={60} placeholder="Ex. : Entrée principale" onChange={(e) => setForm({ ...form, nom: e.target.value })} /></label>
            <label className="text-sm font-medium">Emplacement<input className={champ} value={form.emplacement} maxLength={80} placeholder="Ex. : Accueil, couloir, parking" onChange={(e) => setForm({ ...form, emplacement: e.target.value })} /></label>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Application de la caméra</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(MARQUES) as Marque[]).map((m) => (
                <button key={m} type="button" onClick={() => setForm({ ...form, marque: m })}
                  className={`px-3 py-1.5 rounded-full border text-sm font-semibold ${form.marque === m ? "bg-emerald-600 border-emerald-600 text-white" : isDark ? "border-stone-700" : "border-stone-300"}`}>
                  {MARQUES[m].nom}
                </button>
              ))}
            </div>
          </div>
          <label className="text-sm font-medium block">Remarque (facultatif)<input className={champ} value={form.note || ""} maxLength={200} placeholder="Ex. : enregistre sur carte SD, vision de nuit" onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setForm(null)} className={`px-3 py-2 rounded-lg border text-sm font-semibold ${isDark ? "border-stone-700" : "border-stone-300"}`}>Annuler</button>
            <button onClick={enregistrer} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold">Enregistrer</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setForm(vide())} className={`px-4 py-2.5 rounded-xl border-2 border-dashed font-semibold text-sm flex items-center gap-2 ${isDark ? "border-stone-700" : "border-stone-300"}`}>
          <Plus className="w-4 h-4" /> Ajouter une caméra
        </button>
      )}

      <div className={`${card} p-4 text-sm space-y-2`}>
        <div className="font-bold flex items-center gap-2"><Info className="w-4 h-4 text-sky-600" /> Bon à savoir</div>
        <ul className={`list-disc pl-5 space-y-1 ${muted}`}>
          <li>Sur chaque appareil, l'application (ou le logiciel) de la marque doit être installée et connectée une fois au compte des caméras du cabinet.</li>
          {!NATIF && marquesUtilisees.map((m) => <li key={m}>{MARQUES[m].pc}</li>)}
          <li>Gardez le mot de passe du compte des caméras pour vous seul, et activez la vérification en 2 étapes dans l'application de la marque.</li>
        </ul>
        <div className="font-bold flex items-center gap-2 pt-1"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Respect des patients</div>
        <ul className={`list-disc pl-5 space-y-1 ${muted}`}>
          <li>Pas de caméra dans les salles de consultation, de soins, d'accouchement, d'hospitalisation ni dans les toilettes.</li>
          <li>Affichez « Zone sous vidéosurveillance » aux entrées filmées.</li>
        </ul>
      </div>
    </div>
  );
}
