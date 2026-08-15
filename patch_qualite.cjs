const fs = require('fs');
let code = fs.readFileSync('src/components/TabQualite.tsx', 'utf8');

const oldCode = `      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erreur serveur lors de la génération du rapport.");
      }

      const data = await response.json();`;

const newCode = `      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Impossible de lire la réponse du serveur.");
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erreur serveur lors de la génération du rapport.");
      }`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('src/components/TabQualite.tsx', code);
