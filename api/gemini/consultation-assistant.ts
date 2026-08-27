/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Fonction serverless Vercel : POST /api/gemini/consultation-assistant

import { generateConsultationAssistant } from "../_lib/geminiCore.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  try {
    const result = await generateConsultationAssistant(req.body);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error in consultation assistant:", error);
    res.status(500).json({ error: error.message || "Erreur de l'assistant médical IA." });
  }
}
