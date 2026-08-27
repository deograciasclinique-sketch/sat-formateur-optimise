/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Fonction serverless Vercel : POST /api/gemini/compliance
// Chaque fichier sous /api devient automatiquement une route sur Vercel — c'est
// ce mécanisme qui manquait auparavant (les routes vivaient uniquement dans un
// serveur Express classique, jamais démarré par Vercel en production).

import { generateComplianceReport } from "../_lib/geminiCore";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const result = await generateComplianceReport(req.body);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error generating compliance report:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la génération du rapport." });
  }
}
