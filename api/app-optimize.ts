/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Fonction serverless Vercel : POST /api/app-optimize

import { generateOptimizationReport } from "./_lib/geminiCore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const result = await generateOptimizationReport(req.body);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error generating optimization report:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la génération du rapport d'optimisation." });
  }
}
