/**
 * Appels aux assistants IA (/api/…) : ajoute automatiquement le jeton de connexion
 * de l'appareil (compte du cabinet / de la clinique) à chaque requête.
 *
 * Le serveur refuse désormais tout appel sans ce jeton : seul le personnel d'un appareil
 * activé peut utiliser l'IA, et la clé Gemini reste uniquement sur le serveur.
 *
 * Doit être importé APRÈS ./natif (dans l'APK, natif.ts redirige /api vers le serveur
 * en ligne : notre en-tête doit être ajouté avant ce relais).
 */
import { firebase } from "./firebase";

const fetchPrecedent: typeof fetch = window.fetch.bind(window);

async function jetonAppareil(): Promise<string | null> {
  try {
    if (!firebase.apps.length) return null;
    const user = firebase.auth().currentUser;
    if (!user || user.isAnonymous) return null;
    return await user.getIdToken(); // renouvelé automatiquement par Firebase (validité 1 h)
  } catch {
    return null;
  }
}

window.fetch = async (input: any, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url || "";
  const versApi = /^\/api\//.test(url) || url.startsWith(window.location.origin + "/api/");
  if (!versApi) return fetchPrecedent(input, init);

  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  const jeton = await jetonAppareil();
  if (jeton) headers.set("Authorization", `Bearer ${jeton}`);
  return fetchPrecedent(input, { ...init, headers });
};
