/**
 * Fenêtre obligatoire affichée au responsable tant qu'il utilise encore le
 * code par défaut « 0000 » : il choisit son code personnel, valable ensuite
 * sur tous les appareils du cabinet.
 */

import React, { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { setResponsableCode } from "../lib/accessSession";

const TROP_SIMPLES = ["000000", "111111", "123456", "654321", "121212", "112233", "123123"];

export default function ResponsableCodeSetup({ staffCodes, onDone }: { staffCodes: string[]; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const c = code.trim();
    if (!/^\d{6,10}$/.test(c)) return setError("Le code doit contenir 6 à 10 chiffres.");
    if (/^(\d)\1+$/.test(c) || TROP_SIMPLES.includes(c)) return setError("Ce code est trop facile à deviner. Choisissez-en un autre.");
    if (staffCodes.includes(c)) return setError("Ce code est déjà utilisé par un agent. Choisissez-en un autre.");
    if (c !== confirm.trim()) return setError("Les deux codes ne sont pas identiques.");
    setBusy(true);
    try {
      await setResponsableCode(c);
      onDone();
    } catch {
      // Enregistré sur cet appareil ; l'envoi aux autres se refera à la prochaine modification.
      setError("Code enregistré sur cet appareil, mais pas encore envoyé aux autres (pas de connexion). Réessayez quand internet revient.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/70">
      <form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-stone-900 rounded-2xl shadow-2xl p-6 space-y-4 text-stone-900 dark:text-stone-100">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-warning-50 text-warning-700 flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-base">Choisissez votre code personnel</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Le code « 0000 » est connu de tous et ne protège pas l'accès Responsable. Choisissez un code secret de 6 chiffres ou plus.
            Il remplacera « 0000 » sur tous les appareils du cabinet.
          </p>
        </div>

        {error && <p className="text-xs text-danger-700 bg-danger-50 border border-danger-200 rounded-lg p-2 font-semibold">{error}</p>}

        <input type="password" inputMode="numeric" autoComplete="new-password" placeholder="Nouveau code" value={code}
          onChange={(e) => setCode(e.target.value)} autoFocus
          className="w-full text-center text-xl font-mono tracking-widest border border-stone-200 dark:border-stone-700 rounded-lg py-2 bg-stone-50 dark:bg-stone-950 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <input type="password" inputMode="numeric" autoComplete="new-password" placeholder="Confirmer le code" value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full text-center text-xl font-mono tracking-widest border border-stone-200 dark:border-stone-700 rounded-lg py-2 bg-stone-50 dark:bg-stone-950 focus:outline-none focus:ring-2 focus:ring-primary-500" />

        <button type="submit" disabled={busy}
          className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Enregistrer mon code
        </button>
        <p className="text-[11px] text-center text-stone-400">Notez-le en lieu sûr : il n'est stocké nulle part en clair.</p>
      </form>
    </div>
  );
}
