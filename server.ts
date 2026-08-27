import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  generateComplianceReport,
  generateOptimizationReport,
  generateConsultationAssistant,
} from "./api/_lib/geminiCore";

// NOTE IMPORTANTE : ce serveur Express sert uniquement au développement local
// (npm run dev) et à un hébergement de type Node classique (Render, Cloud Run,
// VPS...). Sur Vercel, ces routes ne sont PAS utilisées : Vercel exécute plutôt
// les fonctions serverless indépendantes situées dans /api (api/gemini/*.ts,
// api/app-optimize.ts), qui appellent la même logique partagée dans
// api/_lib/geminiCore.ts. Toute modification des prompts/IA doit se faire dans
// geminiCore.ts pour rester valable dans les deux environnements.

const app = express();
const PORT = 3000;

app.use(express.json());

// API endpoint for compliance report generation
app.post("/api/gemini/compliance", async (req, res) => {
  try {
    const result = await generateComplianceReport(req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Error generating compliance report:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la génération du rapport." });
  }
});

// API endpoint for App & Clinical Operations Optimization
app.post("/api/app-optimize", async (req, res) => {
  try {
    const result = await generateOptimizationReport(req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Error generating optimization report:", error);
    res.status(500).json({ error: error.message || "Erreur lors de la génération du rapport d'optimisation." });
  }
});

// API endpoint for Smart Consultation Assistant
app.post("/api/gemini/consultation-assistant", async (req, res) => {
  try {
    const result = await generateConsultationAssistant(req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Error in consultation assistant:", error);
    res.status(500).json({ error: error.message || "Erreur de l'assistant médical IA." });
  }
});

// Vite middleware for development vs static asset serving for production
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

setupVite();
