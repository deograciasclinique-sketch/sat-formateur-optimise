/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Fabrique des routes /api : même chaîne de sécurité pour toutes, en production
// (fonctions Vercel) comme en local (server.ts) :
//   méthode + taille → limite par IP → jeton du personnel → limite par compte
//   → validation/nettoyage des champs → appel IA → réponse (sans détail interne).

import { proteger, repondreErreur } from "./securite.js";

export function creerRoute<E, S>(
  nom: string,
  valider: (body: unknown) => E,
  executer: (entree: E) => Promise<S>,
  messageErreur: string
) {
  return async function handler(req: any, res: any) {
    const utilisateur = await proteger(req, res, nom);
    if (!utilisateur) return;
    try {
      const entree = valider(req.body);
      const resultat = await executer(entree);
      res.status(200).json(resultat);
    } catch (erreur) {
      repondreErreur(res, nom, erreur, messageErreur);
    }
  };
}
