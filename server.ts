import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  routeCompliance,
  routeOptimisation,
  routeConsultation,
  routeProcedureLabo,
} from "./api/_lib/routes.js";

// NOTE IMPORTANTE : ce serveur Express sert uniquement au développement local
// (npm run dev) et à un hébergement de type Node classique (Render, Cloud Run,
// VPS...). Sur Vercel, ces routes ne sont PAS utilisées : Vercel exécute plutôt
// les fonctions serverless indépendantes situées dans /api (api/gemini/*.ts,
// api/app-optimize.ts), qui appellent la même logique partagée dans
// api/_lib/geminiCore.ts. Toute modification des prompts/IA doit se faire dans
// geminiCore.ts pour rester valable dans les deux environnements.

const app = express();
const PORT = 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// Mêmes routes (et même sécurité : jeton, limite d'appels, validation) qu'en production.
app.post("/api/gemini/compliance", routeCompliance);
app.post("/api/app-optimize", routeOptimisation);
app.post("/api/gemini/consultation-assistant", routeConsultation);
app.post("/api/gemini/lab-procedure", routeProcedureLabo);
app.all(["/api/gemini/:route", "/api/app-optimize"], (_req, res) => {
  res.setHeader("Allow", "POST");
  res.status(405).json({ error: "Méthode non autorisée." });
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
