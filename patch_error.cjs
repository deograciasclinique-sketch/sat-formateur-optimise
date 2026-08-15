const fs = require('fs');
let code = fs.readFileSync('src/components/TabSettings.tsx', 'utf8');

// We have multiple places that call fetch and throw a hardcoded error. Let's fix them.
const optimizeErrorOld = `      if (!response.ok) {
        throw new Error("Impossible de se connecter au serveur d'optimisation. Vérifiez que la clé API Gemini est bien configurée dans AI Studio.");
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }`;

const optimizeErrorNew = `      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Impossible de se connecter au serveur d'optimisation.");
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erreur serveur : Vérifiez que la clé API Gemini est bien configurée dans AI Studio.");
      }`;

code = code.replace(optimizeErrorOld, optimizeErrorNew);
fs.writeFileSync('src/components/TabSettings.tsx', code);
