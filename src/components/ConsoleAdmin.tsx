/**
 * Console d'administration du SaaS (réservée aux e-mails de ADMIN_EMAILS).
 * Le vendeur y crée les cliniques clientes, prolonge / suspend leur abonnement
 * et renvoie un lien de nouveau mot de passe. Il ne voit PAS les données médicales
 * des cliniques (les règles du serveur l'en empêchent aussi).
 */
import React, { useEffect, useState } from "react";
import { Building2, KeyRound, LogOut, Pause, Play, Plus, RefreshCw } from "lucide-react";
import { baseCommerciale, deactivateDevice, firebase } from "../lib/firebase";
import { CONFIG_COMMERCIALE, NOM_PRODUIT, choisirMode } from "../lib/edition";

type Clinique = { id: string; nom: string; email: string; actif: boolean; fin: number; creeLe: number; ville?: string; telephone?: string };
const MOIS = 30 * 86400000;

function ms(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  return 0;
}
function identifiant(nom: string): string {
  const base = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "clinique";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
function motDePasse(): string {
  const c = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const t = new Uint32Array(10);
  crypto.getRandomValues(t);
  return Array.from(t, (n) => c[n % c.length]).join("");
}

export default function ConsoleAdmin({ email }: { email: string }) {
  const base = baseCommerciale()!;
  const [liste, setListe] = useState<Clinique[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [info, setInfo] = useState("");
  const [form, setForm] = useState({ nom: "", email: "", ville: "", telephone: "", mois: 1 });
  const [occupe, setOccupe] = useState(false);

  useEffect(() => base.collection("cliniques_index").onSnapshot(
    (s) => setListe(s.docs.map((d) => {
      const x: any = d.data();
      return { id: d.id, nom: x.nom, email: x.email, actif: x.actif === true, fin: ms(x.finAbonnement), creeLe: ms(x.creeLe), ville: x.ville, telephone: x.telephone };
    }).sort((a, b) => a.fin - b.fin)),
    (e) => setErreur("Lecture impossible : " + e.message),
  ), []);

  async function majAbonnement(c: Clinique, champs: { actif?: boolean; fin?: number }) {
    const maj: any = {};
    if (champs.actif !== undefined) maj.actif = champs.actif;
    if (champs.fin !== undefined) maj.finAbonnement = firebase.firestore.Timestamp.fromMillis(champs.fin);
    const lot = base.batch();
    lot.update(base.collection("comptes").doc(c.email), maj);
    lot.update(base.collection("cliniques_index").doc(c.id), maj);
    try { await lot.commit(); setInfo(`${c.nom} : mis à jour.`); } catch (e: any) { setErreur(e.message); }
  }

  function prolonger(c: Clinique, mois: number) {
    const depart = Math.max(c.fin, Date.now());
    majAbonnement(c, { fin: depart + mois * MOIS, actif: true });
  }

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(""); setInfo("");
    const mail = form.email.trim().toLowerCase();
    if (!form.nom.trim() || !/^\S+@\S+\.\S+$/.test(mail)) { setErreur("Nom de la clinique et e-mail valides requis."); return; }
    setOccupe(true);
    const mdp = motDePasse();
    // Une 2ᵉ instance Firebase crée le compte sans déconnecter l'administrateur.
    const app2 = firebase.initializeApp(CONFIG_COMMERCIALE!, "creation-" + Date.now());
    try {
      await app2.auth().createUserWithEmailAndPassword(mail, mdp);
      const id = identifiant(form.nom);
      const fin = firebase.firestore.Timestamp.fromMillis(Date.now() + form.mois * MOIS);
      const commun = { nom: form.nom.trim(), actif: true, finAbonnement: fin, creeLe: firebase.firestore.FieldValue.serverTimestamp() };
      const lot = base.batch();
      lot.set(base.collection("comptes").doc(mail), { ...commun, clinique: id });
      lot.set(base.collection("cliniques_index").doc(id), { ...commun, email: mail, ville: form.ville.trim(), telephone: form.telephone.trim() });
      await lot.commit();
      setInfo(`✅ ${form.nom} créée. Identifiants à remettre au client — e-mail : ${mail} · mot de passe : ${mdp} (il pourra le changer avec « mot de passe oublié »).`);
      setForm({ nom: "", email: "", ville: "", telephone: "", mois: 1 });
    } catch (err: any) {
      const code = err?.code || "";
      setErreur(code.includes("email-already-in-use") ? "Cet e-mail a déjà un compte." : "Création impossible : " + (err?.message || code));
    } finally {
      await app2.delete().catch(() => {});
      setOccupe(false);
    }
  }

  async function reinitialiser(c: Clinique) {
    try { await firebase.auth().sendPasswordResetEmail(c.email); setInfo(`Lien de nouveau mot de passe envoyé à ${c.email}.`); }
    catch (e: any) { setErreur(e.message); }
  }

  const maintenant = Date.now();
  const actives = (liste || []).filter((c) => c.actif && c.fin > maintenant).length;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="bg-primary-900 text-white px-4 py-3 flex items-center gap-3">
        <img src="/app-icon-192-v2.png" alt="" className="w-9 h-9 rounded-lg" />
        <div className="flex-1 min-w-0">
          <div className="font-serif font-bold text-sm">{NOM_PRODUIT} — Administration</div>
          <div className="text-[11px] opacity-75 truncate">{email}</div>
        </div>
        <button type="button" onClick={async () => { await deactivateDevice().catch(() => {}); choisirMode("clinique"); }} className="text-xs font-bold flex items-center gap-1 cursor-pointer"><LogOut className="w-4 h-4" /> Quitter</button>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-white rounded-xl p-3 shadow-sm"><div className="text-2xl font-bold">{liste?.length ?? "…"}</div><div className="text-xs text-stone-500">Cliniques</div></div>
          <div className="bg-white rounded-xl p-3 shadow-sm"><div className="text-2xl font-bold text-emerald-700">{actives}</div><div className="text-xs text-stone-500">Abonnements actifs</div></div>
          <div className="bg-white rounded-xl p-3 shadow-sm"><div className="text-2xl font-bold text-red-700">{(liste?.length || 0) - actives}</div><div className="text-xs text-stone-500">Expirés / suspendus</div></div>
        </div>

        {erreur && <div className="bg-red-50 border border-red-300 text-red-800 text-sm rounded-xl px-4 py-2">{erreur}</div>}
        {info && <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm rounded-xl px-4 py-2 break-words select-all">{info}</div>}

        <form onSubmit={creer} className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <h2 className="font-bold text-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Nouvelle clinique cliente</h2>
          <div className="grid sm:grid-cols-2 gap-2">
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Nom de la clinique *" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="E-mail de connexion *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Ville" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
            <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-stone-600">Abonnement initial :</label>
            <select className="border rounded-lg px-2 py-1.5 text-sm" value={form.mois} onChange={(e) => setForm({ ...form, mois: Number(e.target.value) })}>
              <option value={1}>1 mois</option><option value={3}>3 mois</option><option value={6}>6 mois</option><option value={12}>12 mois</option>
            </select>
            <button disabled={occupe} className="ml-auto bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg cursor-pointer">{occupe ? "Création…" : "Créer la clinique"}</button>
          </div>
        </form>

        <div className="space-y-2">
          {liste === null && <div className="text-sm text-stone-500 text-center py-6">Chargement…</div>}
          {liste?.length === 0 && <div className="text-sm text-stone-500 text-center py-6">Aucune clinique pour l'instant.</div>}
          {liste?.map((c) => {
            const ok = c.actif && c.fin > maintenant;
            const jours = Math.ceil((c.fin - maintenant) / 86400000);
            return (
              <div key={c.id} className="bg-white rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-2">
                <Building2 className="w-5 h-5 text-stone-400 shrink-0" />
                <div className="flex-1 min-w-[180px]">
                  <div className="font-bold text-sm">{c.nom} {c.ville ? <span className="font-normal text-stone-500">· {c.ville}</span> : null}</div>
                  <div className="text-xs text-stone-500">{c.email}{c.telephone ? ` · ${c.telephone}` : ""}</div>
                  <div className={`text-xs font-bold ${ok ? (jours <= 7 ? "text-amber-600" : "text-emerald-700") : "text-red-700"}`}>
                    {!c.actif ? "Suspendue" : ok ? `Actif jusqu'au ${new Date(c.fin).toLocaleDateString("fr-FR")} (${jours} j)` : `Expiré le ${new Date(c.fin).toLocaleDateString("fr-FR")}`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {[1, 3, 12].map((m) => (
                    <button key={m} type="button" onClick={() => prolonger(c, m)} className="text-xs font-bold border border-emerald-300 text-emerald-800 rounded-lg px-2 py-1 cursor-pointer flex items-center gap-1"><RefreshCw className="w-3 h-3" />+{m} mois</button>
                  ))}
                  {c.actif
                    ? <button type="button" onClick={() => { if (confirm(`Suspendre ${c.nom} ?`)) majAbonnement(c, { actif: false }); }} className="text-xs font-bold border border-red-300 text-red-700 rounded-lg px-2 py-1 cursor-pointer flex items-center gap-1"><Pause className="w-3 h-3" />Suspendre</button>
                    : <button type="button" onClick={() => majAbonnement(c, { actif: true })} className="text-xs font-bold border border-stone-300 rounded-lg px-2 py-1 cursor-pointer flex items-center gap-1"><Play className="w-3 h-3" />Réactiver</button>}
                  <button type="button" onClick={() => reinitialiser(c)} className="text-xs font-bold border border-stone-300 rounded-lg px-2 py-1 cursor-pointer flex items-center gap-1"><KeyRound className="w-3 h-3" />Mot de passe</button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
