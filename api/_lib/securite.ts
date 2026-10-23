/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Sécurité commune à toutes les routes /api (Vercel en production, server.ts en local).
//
//  1. Seul le PERSONNEL connecté (compte du cabinet ou d'une clinique abonnée) peut
//     utiliser les assistants IA : chaque appel doit porter le jeton Firebase de
//     l'appareil (en-tête « Authorization: Bearer … »), vérifié ici avec les clés
//     publiques de Google. Les connexions anonymes (portail patient) sont refusées.
//  2. Limitation du nombre d'appels (rate limiting) par adresse IP et par compte,
//     pour qu'un robot ne puisse ni épuiser le quota Gemini, ni faire monter la facture.
//  3. Les erreurs internes ne sont jamais renvoyées telles quelles au navigateur.
//
// La clé GEMINI_API_KEY reste uniquement sur le serveur (process.env) : elle n'est
// jamais envoyée au navigateur.

import crypto from "node:crypto";

// ─── Projets Firebase acceptés ──────────────────────────────────────────────
// Cabinet DEO GRACIAS + version commerciale (SaaS). Modifiable sans toucher au code
// avec la variable d'environnement FIREBASE_PROJECT_IDS (liste séparée par des virgules).
const PROJETS_AUTORISES = (process.env.FIREBASE_PROJECT_IDS || "deo-gracias-rdv-5d815,sat-formateur-commercial")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// ─── Limites d'appels ───────────────────────────────────────────────────────
const FENETRE_SEC = 10 * 60; // 10 minutes
const MAX_PAR_IP = Number(process.env.RATE_LIMIT_IP || 60); // par adresse IP / 10 min
const MAX_PAR_COMPTE = Number(process.env.RATE_LIMIT_COMPTE || 40); // par compte / 10 min
const TAILLE_MAX_CORPS = 50_000; // caractères JSON (les assistants n'ont besoin que de texte court)

// ═══════════════════════════════════════════════════════════════════════════
// Vérification du jeton Firebase (sans dépendance supplémentaire)
// ═══════════════════════════════════════════════════════════════════════════

const URL_CERTS = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let certs: { cles: Record<string, crypto.KeyObject>; expire: number } | null = null;

async function clesPubliques(): Promise<Record<string, crypto.KeyObject>> {
  if (certs && certs.expire > Date.now()) return certs.cles;
  const r = await fetch(URL_CERTS);
  if (!r.ok) throw new Error(`Certificats Google indisponibles (${r.status})`);
  const json = (await r.json()) as Record<string, string>;
  const cles: Record<string, crypto.KeyObject> = {};
  for (const [kid, pem] of Object.entries(json)) cles[kid] = crypto.createPublicKey(pem);
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get("cache-control") || "")?.[1] || 3600);
  certs = { cles, expire: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 };
  return cles;
}

function decoderSegment(seg: string): any {
  return JSON.parse(Buffer.from(seg, "base64url").toString("utf8"));
}

export type Utilisateur = { uid: string; email: string | null; projet: string };

/** Vérifie un jeton d'identité Firebase. Retourne l'utilisateur, ou null si invalide. */
export async function verifierJeton(jeton: string): Promise<Utilisateur | null> {
  const parts = jeton.split(".");
  if (parts.length !== 3 || jeton.length > 4096) return null;
  let entete: any, charge: any;
  try {
    entete = decoderSegment(parts[0]);
    charge = decoderSegment(parts[1]);
  } catch {
    return null;
  }
  if (entete?.alg !== "RS256" || typeof entete.kid !== "string") return null;

  let cles = await clesPubliques();
  if (!cles[entete.kid]) {
    certs = null; // Google a peut-être fait tourner ses clés
    cles = await clesPubliques();
  }
  const cle = cles[entete.kid];
  if (!cle) return null;

  const signatureOk = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    cle,
    Buffer.from(parts[2], "base64url")
  );
  if (!signatureOk) return null;

  const maintenant = Math.floor(Date.now() / 1000);
  const aud = charge?.aud;
  if (typeof aud !== "string" || !PROJETS_AUTORISES.includes(aud)) return null;
  if (charge.iss !== `https://securetoken.google.com/${aud}`) return null;
  if (typeof charge.exp !== "number" || charge.exp <= maintenant) return null;
  if (typeof charge.iat !== "number" || charge.iat > maintenant + 300) return null;
  if (typeof charge.sub !== "string" || !charge.sub || charge.sub.length > 128) return null;
  // Portail patient (connexion anonyme) : pas d'accès aux assistants IA.
  if (charge.firebase?.sign_in_provider === "anonymous") return null;

  return { uid: charge.sub, email: typeof charge.email === "string" ? charge.email : null, projet: aud };
}

// ═══════════════════════════════════════════════════════════════════════════
// Limitation du nombre d'appels
// ═══════════════════════════════════════════════════════════════════════════
// • Si une base Upstash Redis est reliée au projet Vercel (Storage → Upstash),
//   le compteur est partagé entre toutes les instances du serveur : limite exacte.
// • Sinon, compteur en mémoire de l'instance (protection « au mieux », suffisante
//   pour freiner un abus, mais remise à zéro quand Vercel redémarre l'instance).

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "";

const memoire = new Map<string, { n: number; fin: number }>();

function compterEnMemoire(cle: string, fenetreSec: number): { n: number; resteSec: number } {
  const now = Date.now();
  if (memoire.size > 5000) {
    for (const [k, v] of memoire) if (v.fin <= now) memoire.delete(k);
  }
  let e = memoire.get(cle);
  if (!e || e.fin <= now) {
    e = { n: 0, fin: now + fenetreSec * 1000 };
    memoire.set(cle, e);
  }
  e.n += 1;
  return { n: e.n, resteSec: Math.ceil((e.fin - now) / 1000) };
}

async function compter(cle: string, fenetreSec: number): Promise<{ n: number; resteSec: number }> {
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const r = await fetch(`${REDIS_URL.replace(/\/$/, "")}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          ["INCR", cle],
          ["EXPIRE", cle, String(fenetreSec), "NX"],
          ["TTL", cle],
        ]),
      });
      if (r.ok) {
        const res = (await r.json()) as Array<{ result?: any }>;
        const n = Number(res?.[0]?.result);
        const ttl = Number(res?.[2]?.result);
        if (Number.isFinite(n)) return { n, resteSec: ttl > 0 ? ttl : fenetreSec };
      }
    } catch (e) {
      console.error("[rate-limit] Upstash injoignable, compteur en mémoire utilisé :", e);
    }
  }
  return compterEnMemoire(cle, fenetreSec);
}

// ═══════════════════════════════════════════════════════════════════════════
// Garde commune à toutes les routes
// ═══════════════════════════════════════════════════════════════════════════

function adresseIp(req: any): string {
  const xff = String(req.headers?.["x-forwarded-for"] || "");
  const ip = xff.split(",")[0].trim() || String(req.headers?.["x-real-ip"] || "") || req.socket?.remoteAddress || "inconnue";
  return ip.slice(0, 64);
}

function trop(res: any, resteSec: number, max: number) {
  res.setHeader?.("Retry-After", String(resteSec));
  res.setHeader?.("X-RateLimit-Limit", String(max));
  res.status(429).json({
    error: `Trop de demandes envoyées à l'assistant IA. Réessayez dans ${Math.max(1, Math.ceil(resteSec / 60))} minute(s).`,
  });
}

/**
 * À appeler au début de chaque route. Envoie elle-même la réponse d'erreur
 * (405, 413, 401, 429…) et retourne null si la requête doit s'arrêter là.
 */
export async function proteger(req: any, res: any, route: string): Promise<Utilisateur | null> {
  res.setHeader?.("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    res.status(405).json({ error: "Méthode non autorisée." });
    return null;
  }
  const type = String(req.headers?.["content-type"] || "");
  if (!/^application\/json\b/i.test(type)) {
    res.status(415).json({ error: "Format de requête non pris en charge." });
    return null;
  }
  let tailleCorps = 0;
  try {
    tailleCorps = JSON.stringify(req.body ?? null).length;
  } catch {
    tailleCorps = Infinity;
  }
  if (tailleCorps > TAILLE_MAX_CORPS) {
    res.status(413).json({ error: "Les données envoyées sont trop volumineuses." });
    return null;
  }

  // 1) Limite par adresse IP — AVANT la vérification du jeton, pour freiner aussi
  //    les robots qui essaient des jetons au hasard.
  const ip = adresseIp(req);
  const parIp = await compter(`rl:ip:${ip}`, FENETRE_SEC);
  if (parIp.n > MAX_PAR_IP) {
    trop(res, parIp.resteSec, MAX_PAR_IP);
    return null;
  }

  // 2) Authentification : personnel connecté uniquement.
  const auth = String(req.headers?.authorization || "");
  const jeton = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() || "";
  let utilisateur: Utilisateur | null = null;
  if (jeton) {
    try {
      utilisateur = await verifierJeton(jeton);
    } catch (e) {
      console.error(`[${route}] Vérification du jeton impossible :`, e);
      res.status(503).json({ error: "Service momentanément indisponible. Réessayez dans un instant." });
      return null;
    }
  }
  if (!utilisateur) {
    res.status(401).json({
      error: "Accès réservé au personnel connecté. Activez cet appareil avec le compte du cabinet, puis réessayez.",
    });
    return null;
  }

  // 3) Limite par compte.
  const parCompte = await compter(`rl:uid:${utilisateur.projet}:${utilisateur.uid}`, FENETRE_SEC);
  if (parCompte.n > MAX_PAR_COMPTE) {
    trop(res, parCompte.resteSec, MAX_PAR_COMPTE);
    return null;
  }

  return utilisateur;
}

/** Erreur « métier » dont le message peut être montré tel quel à l'utilisateur. */
export class ErreurPublique extends Error {
  constructor(message: string, public statut = 400) {
    super(message);
  }
}

/** Réponse d'erreur : message lisible, sans détail technique interne. */
export function repondreErreur(res: any, route: string, erreur: any, messageParDefaut: string) {
  if (erreur instanceof ErreurPublique) {
    res.status(erreur.statut).json({ error: erreur.message });
    return;
  }
  console.error(`[${route}]`, erreur);
  res.status(500).json({ error: messageParDefaut });
}
