const fs = require('fs');
let code = fs.readFileSync('src/components/TabConsultation.tsx', 'utf8');

const oldCode = `      if (!response.ok) {
        throw new Error("Erreur réseau");
      }

      const data = await response.json();`;

const newCode = `      let data;
      try {
        data = await response.json();
      } catch (err) {
        throw new Error("Impossible de lire la réponse du serveur.");
      }

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erreur serveur : Vérifiez que la clé API Gemini est bien configurée.");
      }`;

code = code.replace(oldCode, newCode);

code = code.replace(
  `alert("Impossible de joindre l'assistant IA. Veuillez vérifier votre connexion.");`,
  `alert("Erreur de l'assistant IA : " + (error.message || "Veuillez vérifier votre connexion."));`
);

fs.writeFileSync('src/components/TabConsultation.tsx', code);
