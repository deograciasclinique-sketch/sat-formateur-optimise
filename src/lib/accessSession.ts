/**
 * Session de l'agent connecté (code PIN) + code personnel du Responsable.
 *
 * 1) SESSION : le code de l'agent connecté est gardé en sessionStorage (et non
 *    plus en localStorage). Conséquence : quand on FERME l'app (ou l'onglet),
 *    la session est perdue et le code est redemandé à la réouverture. Une
 *    session inactive depuis plus de 5 minutes n'est jamais restaurée, même
 *    après un simple rechargement de la page.
 *
 * 2) CODE RESPONSABLE : l'ancien code commun « 0000 » n'est accepté que tant
 *    qu'aucun code personnel n'a été défini. Le code personnel est stocké sous
 *    forme d'empreinte (SHA-256), jamais en clair, et synchronisé entre tous
 *    les appareils du cabinet. En interne, l'identifiant du responsable reste
 *    "0000" (utilisé partout dans l'app pour reconnaître ce rôle).
 */

import { pushToCloudKey, subscribeToCloudKey } from "./liveSync";

export const RESPONSABLE_ID = "0000";
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const PIN_KEY = "dg_current_user_pin";
const ACTIVITY_KEY = "dg_last_activity";
const RESP_HASH_KEY = "dg_responsable_code_hash";

function ss(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

// Les versions précédentes gardaient la session en localStorage : on l'efface
// pour que l'ancienne session ne soit jamais restaurée automatiquement.
try { localStorage.removeItem(PIN_KEY); } catch { /* ignore */ }

/** Code de l'agent connecté, ou "" si aucune session valide. */
export function getSessionPin(): string {
  const s = ss();
  if (!s) return "";
  const pin = s.getItem(PIN_KEY) || "";
  const last = Number(s.getItem(ACTIVITY_KEY) || 0);
  if (!pin) return "";
  if (!last || Date.now() - last > INACTIVITY_TIMEOUT_MS) {
    clearSessionPin();
    return "";
  }
  return pin;
}

export function setSessionPin(pin: string): void {
  const s = ss();
  if (!s) return;
  s.setItem(PIN_KEY, pin);
  s.setItem(ACTIVITY_KEY, String(Date.now()));
}

export function clearSessionPin(): void {
  const s = ss();
  if (!s) return;
  s.removeItem(PIN_KEY);
  s.removeItem(ACTIVITY_KEY);
}

export function recordActivity(timestamp: number = Date.now()): void {
  const s = ss();
  if (s && s.getItem(PIN_KEY)) s.setItem(ACTIVITY_KEY, String(timestamp));
}

export function getLastActivity(): number {
  const s = ss();
  return Number(s?.getItem(ACTIVITY_KEY) || 0) || Date.now();
}

// ─── Code personnel du Responsable ────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode("deo-gracias::responsable::" + text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getStoredHash(): string {
  try { return localStorage.getItem(RESP_HASH_KEY) || ""; } catch { return ""; }
}

/** Vrai si le responsable a déjà remplacé le code par défaut « 0000 ». */
export function hasCustomResponsableCode(): boolean {
  return !!getStoredHash();
}

/** Vérifie le code saisi par le responsable. */
export async function isResponsableCode(pin: string): Promise<boolean> {
  const p = (pin || "").trim();
  if (!p) return false;
  const stored = getStoredHash();
  if (!stored) return p === RESPONSABLE_ID;
  return (await sha256(p)) === stored;
}

/** Enregistre un nouveau code responsable (local + tous les appareils). */
export async function setResponsableCode(newPin: string): Promise<void> {
  const hash = await sha256(newPin.trim());
  try { localStorage.setItem(RESP_HASH_KEY, hash); } catch { /* ignore */ }
  window.dispatchEvent(new Event("dg_responsable_code_changed"));
  await pushToCloudKey(RESP_HASH_KEY, hash);
}

/** Garde l'empreinte du code responsable à jour depuis le cloud. */
export function startResponsableCodeSync(): () => void {
  return subscribeToCloudKey(RESP_HASH_KEY, (hash) => {
    if (typeof hash === "string" && hash && hash !== getStoredHash()) {
      try { localStorage.setItem(RESP_HASH_KEY, hash); } catch { /* ignore */ }
      window.dispatchEvent(new Event("dg_responsable_code_changed"));
    }
  });
}
