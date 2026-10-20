import React, { useEffect, useState } from "react";
import { Smartphone, RefreshCw, Send, Share2, ShieldCheck, Download } from "lucide-react";
import { NATIF, APK_LINK, versionInstallee, chercherMiseAJour, envoyerApk, envoyerLienApk, ecranProtege, protegerEcran, DG } from "../lib/natif";

/** Paramètres → Application Android : version, mise à jour, envoi de l'APK, confidentialité de l'écran. */
export default function CarteApplicationAndroid() {
  const [v, setV] = useState<{ version: string } | null>(null);
  const [etat, setEtat] = useState("");
  const [maj, setMaj] = useState<{ version: string; url: string } | null>(null);
  const [protege, setProtege] = useState(ecranProtege());
  const [msg, setMsg] = useState("");
  useEffect(() => { versionInstallee().then(setV); }, []);
  const dire = (t: string) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  async function verifier() {
    if (navigator.onLine === false) { dire("Pas de connexion internet pour vérifier."); return; }
    setEtat("…"); const m = await chercherMiseAJour(); setMaj(m); setEtat(m ? "" : "ok");
  }
  async function envoyer(apk: boolean) {
    try { if (apk) await envoyerApk(); else await envoyerLienApk(); } catch (e: any) { dire("Envoi impossible : " + (e?.message || "erreur")); }
  }
  async function basculer() {
    const n = !protege; setProtege(n); await protegerEcran(n).catch(() => {});
    dire(n ? "Captures d'écran bloquées sur ce téléphone" : "Captures d'écran autorisées sur ce téléphone");
  }

  const btn = "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all cursor-pointer";
  return (
    <div className="bg-white dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 p-5 rounded-2xl shadow-xs">
      <div className="flex items-center gap-3">
        <img src="/app-icon-192-v2.png" alt="" className="w-12 h-12 rounded-xl border border-stone-200" />
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-serif font-bold text-stone-900 dark:text-stone-100">Application Android</h3>
          <p className="text-xs text-stone-500 font-semibold">{NATIF ? `Application officielle signée · version ${v ? v.version : "…"}` : "Vous utilisez la version web (navigateur)"}</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-emerald-600" aria-label="Application officielle" />
      </div>

      {NATIF ? (
        <div className="mt-4 space-y-2">
          {maj ? (
            <button type="button" className={`${btn} w-full bg-primary-600 hover:bg-primary-700 text-white`} onClick={() => { dire("Téléchargement… puis ouvrez le fichier pour installer"); DG.openUrl({ url: maj.url }).catch(() => {}); }}>
              <RefreshCw className="w-4 h-4" /> Installer la version {maj.version}
            </button>
          ) : (
            <button type="button" className={`${btn} w-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200`} onClick={verifier}>
              <RefreshCw className="w-4 h-4" /> {etat === "…" ? "Vérification…" : etat === "ok" ? "✓ Vous avez la dernière version" : "Rechercher une mise à jour"}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`${btn} bg-[#25D366] text-white`} onClick={() => envoyer(true)}><Send className="w-4 h-4" /> Envoyer l'APK</button>
            <button type="button" className={`${btn} bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200`} onClick={() => envoyer(false)}><Share2 className="w-4 h-4" /> Envoyer le lien</button>
          </div>
          <p className="text-[11px] text-stone-500">« Envoyer l'APK » transmet le fichier d'installation à un collègue par WhatsApp, même sans internet.</p>

          <label className="flex items-start gap-3 mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 cursor-pointer">
            <input type="checkbox" className="mt-0.5 w-4 h-4 accent-emerald-600" checked={protege} onChange={basculer} />
            <span className="text-xs text-stone-700 dark:text-stone-300"><b className="text-stone-900 dark:text-stone-100">Confidentialité médicale : bloquer les captures d'écran</b><br />Les dossiers des patients ne peuvent pas être photographiés par capture d'écran, et l'écran est masqué dans la liste des applications récentes. Recommandé.</span>
          </label>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <a href={APK_LINK} className={`${btn} w-full bg-primary-600 hover:bg-primary-700 text-white no-underline`}><Download className="w-4 h-4" /> Télécharger l'application Android</a>
          <button type="button" className={`${btn} w-full bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200`} onClick={() => envoyer(false)}><Smartphone className="w-4 h-4" /> Envoyer le lien aux collègues</button>
        </div>
      )}
      {msg && <p role="status" className="mt-3 text-xs font-bold text-primary-700 dark:text-primary-400">{msg}</p>}
    </div>
  );
}
