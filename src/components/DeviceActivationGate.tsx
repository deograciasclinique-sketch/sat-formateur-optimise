/**
 * Écran d'activation d'un appareil du cabinet (PC, téléphone, tablette).
 *
 * À faire UNE SEULE FOIS par appareil, avec le compte du cabinet créé dans
 * Firebase (Authentication). Ensuite l'appareil reste reconnu et les agents
 * se connectent comme avant avec leur code PIN.
 *
 * Sans cette activation, aucune donnée médicale n'est accessible : c'est ce
 * qui empêche un visiteur du portail patient public d'y accéder.
 */

import React, { useEffect, useState } from "react";
import { activateDevice, onDeviceActivationChange } from "../lib/firebase";
import { Loader2, ShieldCheck, Lock } from "lucide-react";

export default function DeviceActivationGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "activated" | "needs_activation">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Si Firebase ne répond pas (hors-ligne au tout premier démarrage), on
    // n'affiche l'écran d'activation qu'après quelques secondes.
    const timer = setTimeout(() => setState((s) => (s === "checking" ? "needs_activation" : s)), 6000);
    const unsubscribe = onDeviceActivationChange((activated) => {
      setState(activated ? "activated" : "needs_activation");
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Saisissez l'e-mail et le mot de passe du cabinet.");
      return;
    }
    setBusy(true);
    try {
      await activateDevice(email, password);
      setPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (state === "activated") return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 text-stone-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Connexion sécurisée…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-900 to-stone-900 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="text-center space-y-2">
          <img src="/app-icon-192-v2.png" alt="" className="w-16 h-16 mx-auto rounded-xl" />
          <h1 className="text-base font-serif font-bold text-stone-900">Activation de cet appareil</h1>
          <p className="text-xs text-stone-500">
            À faire une seule fois sur chaque appareil du cabinet. Ensuite, chaque agent se connecte avec son code PIN habituel.
          </p>
        </div>

        {error && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-3 text-xs text-danger-800 font-semibold">{error}</div>
        )}

        <div className="space-y-1">
          <label className="text-xs font-bold text-stone-600">E-mail du cabinet</label>
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 bg-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-stone-600">Mot de passe du cabinet</label>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 bg-stone-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        <button type="submit" disabled={busy}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Activer l'appareil
        </button>

        <p className="text-[11px] text-stone-400 text-center flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" /> Accès réservé au personnel du cabinet DEO-GRACIAS
        </p>
      </form>
    </div>
  );
}
