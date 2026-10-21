/**
 * Mode clinique du SaaS « Santé Intégré 2.2 » : après la connexion du compte de la clinique,
 * vérifie son abonnement (document comptes/<e-mail> de la base commerciale) et ouvre SON espace.
 *  • abonnement actif → l'application s'ouvre sur les données de cette clinique uniquement ;
 *  • suspendu, expiré ou compte inconnu → écran bloqué (le serveur refuse aussi l'accès aux données) ;
 *  • e-mail administrateur → console de gestion des cliniques.
 * Si une autre clinique se connecte sur le même appareil, les données gardées sur l'appareil
 * sont effacées avant d'ouvrir son espace.
 */
import React, { useEffect, useState } from "react";
import { Loader2, Lock, LogOut, MessageCircle } from "lucide-react";
import { baseCommerciale, definirClinique, deactivateDevice, firebase } from "../lib/firebase";
import { ADMIN_EMAILS, CONTACT_VENTE, NOM_PRODUIT, profilClinique, choisirMode } from "../lib/edition";
import ConsoleAdmin from "./ConsoleAdmin";

type Compte = { clinique: string; nom: string; actif: boolean; fin: number };
const CLE_COMPTE = "si-compte";
const JOUR = 86400000;

function lireCache(): (Compte & { email: string }) | null {
  try { return JSON.parse(localStorage.getItem(CLE_COMPTE) || "null"); } catch { return null; }
}
function versMillis(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  return 0;
}

export default function AbonnementGate({ children }: { children: React.ReactNode }) {
  const email = (firebase.auth().currentUser?.email || "").toLowerCase();
  const admin = ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email);
  const [compte, setCompte] = useState<Compte | null | undefined>(() => {
    const c = lireCache();
    return c && c.email === email ? c : undefined;
  });

  useEffect(() => {
    if (admin || !email) return;
    // Une autre clinique s'était connectée sur cet appareil : on efface ses données locales.
    const c = lireCache();
    if (c && c.email !== email) {
      Object.keys(localStorage).filter((k) => k.startsWith("dg_") || k.startsWith("deogracias")).forEach((k) => localStorage.removeItem(k));
      localStorage.removeItem(CLE_COMPTE);
      setCompte(undefined);
    }
    const base = baseCommerciale();
    if (!base) { setCompte(null); return; }
    return base.collection("comptes").doc(email).onSnapshot(
      (snap) => {
        if (!snap.exists) { setCompte(null); return; }
        const d: any = snap.data();
        const k: Compte = { clinique: String(d.clinique || ""), nom: String(d.nom || ""), actif: d.actif === true, fin: versMillis(d.finAbonnement) };
        try { localStorage.setItem(CLE_COMPTE, JSON.stringify({ ...k, email })); } catch { /* */ }
        setCompte(k);
      },
      () => { /* hors connexion : on garde le dernier état connu */ setCompte((x) => (x === undefined ? null : x)); },
    );
  }, [email, admin]);

  if (admin) return <ConsoleAdmin email={email} />;

  if (compte === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 text-stone-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Vérification de l'abonnement…</span>
      </div>
    );
  }

  const maintenant = Date.now();
  const ok = !!compte && compte.actif && !!compte.clinique && compte.fin > maintenant;
  if (!ok) {
    const raison = !compte
      ? "Ce compte n'est relié à aucune clinique abonnée."
      : !compte.actif
        ? `L'abonnement de ${compte.nom || "votre clinique"} est suspendu.`
        : `L'abonnement de ${compte.nom || "votre clinique"} a expiré le ${new Date(compte.fin).toLocaleDateString("fr-FR")}.`;
    const lien = `https://wa.me/${CONTACT_VENTE.whatsapp}?text=${encodeURIComponent(`Bonjour, je souhaite renouveler l'abonnement ${NOM_PRODUIT} de ${compte?.nom || "ma clinique"} (${email}).`)}`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 to-stone-900 p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4 text-center">
          <img src="/app-icon-192-v2.png" alt="" className="w-16 h-16 mx-auto rounded-xl" />
          <h1 className="text-base font-serif font-bold text-stone-900 flex items-center justify-center gap-2"><Lock className="w-4 h-4" /> Accès en pause</h1>
          <p className="text-sm text-stone-600">{raison}</p>
          <p className="text-xs text-stone-500">Vos données sont conservées. L'accès revient dès le renouvellement de l'abonnement.</p>
          <a href={lien} target="_blank" rel="noopener noreferrer" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 no-underline">
            <MessageCircle className="w-4 h-4" /> Renouveler l'abonnement
          </a>
          <button type="button" onClick={async () => { await deactivateDevice().catch(() => {}); choisirMode("clinique"); }} className="w-full text-xs font-bold text-stone-500 py-2 flex items-center justify-center gap-1 cursor-pointer">
            <LogOut className="w-3.5 h-3.5" /> Se connecter avec un autre compte
          </button>
        </div>
      </div>
    );
  }

  definirClinique(compte.clinique);
  // Premier lancement : le nom de la clinique vient de son compte.
  try {
    if (!localStorage.getItem("dg_clinic_profile")) {
      localStorage.setItem("dg_clinic_profile", JSON.stringify({ ...profilClinique(compte.nom) }));
    }
  } catch { /* */ }
  const jours = Math.ceil((compte.fin - maintenant) / JOUR);
  return (
    <>
      {jours <= 7 && (
        <div role="status" className="fixed bottom-3 left-3 right-3 z-[9999] mx-auto max-w-xl rounded-xl bg-amber-500 text-white text-xs font-bold px-4 py-2.5 shadow-lg text-center">
          Abonnement : {jours <= 1 ? "expire demain" : `expire dans ${jours} jours`} ({new Date(compte.fin).toLocaleDateString("fr-FR")}). Pensez à le renouveler.
        </div>
      )}
      {children}
    </>
  );
}
