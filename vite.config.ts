import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

// Édition démo (VITE_EDITION=demo) : le nom du cabinet est remplacé partout dans les écrans et
// les impressions par une clinique fictive. L'édition « cabinet » n'est pas modifiée.
// L'édition commerciale (VITE_EDITION=commercial : démo + espace clinique) est nettoyée de la même façon.
const DEMO = process.env.VITE_EDITION === 'demo' || process.env.VITE_EDITION === 'commercial';
const REMPLACEMENTS: [RegExp, string][] = [
  [/Cabinet Privé de Soins DEO[ -]GRACIAS/g, 'Clinique Démo Santé'],
  [/Cabinet Médical (DEO[ -]GRACIAS|Deo[ -]Gracias)/g, 'Clinique Démo Santé'],
  [/CABINET MÉDICAL DEO[ -]GRACIAS/g, 'CLINIQUE DÉMO SANTÉ'],
  [/CACHET & SIGNATURE DEO[ -]GRACIAS/g, 'CACHET & SIGNATURE'],
  [/CSI DEO[ -]GRACIAS/g, 'CSI DÉMO'],
  [/CLINIQUE DEO[ -]GRACIAS/g, 'CLINIQUE DÉMO'],
  [/cabinet (DEO[ -]GRACIAS|Deo[ -]Gracias)/g, 'cabinet'],
  [/Clinique Deogracias/g, 'Clinique Démo'],
  [/Dr\. Deogracias/g, 'Dr. Démo'],
  [/deograciasclinique@gmail\.com/g, 'contact@clinique-demo.bf'],
  [/acheteur@deogracias\.com/g, 'acheteur@clinique.bf'],
  [/cabinet-deogracias-/g, 'clinique-'],
  [/deogracias_sauvegarde_/g, 'sauvegarde_'],
  [/DEO[ -]GRACIAS/g, 'DÉMO'],
  [/Deo[ -]Gracias/g, 'Démo'],
];
const editionDemo = {
  name: 'edition-demo',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!DEMO || !/\/src\/.*\.(tsx?|jsx?)$/.test(id) || /\/src\/lib\/(firebase|edition)\.ts$/.test(id)) return null;
    let out = code;
    for (const [re, rep] of REMPLACEMENTS) out = out.replace(re, rep);
    return out === code ? null : { code: out, map: null };
  },
  // fichiers de « public/ » (copiés tels quels) : nettoyés aussi dans l'édition démo
  closeBundle() {
    if (!DEMO) return;
    for (const f of ['manifest.json', 'manifest-patient.json', 'sw.js']) {
      const p = path.resolve(__dirname, 'dist', f);
      if (!fs.existsSync(p)) continue;
      let t = fs.readFileSync(p, 'utf8');
      if (f === 'manifest.json') t = t.replace(/"name":\s*"[^"]*"/, '"name": "Système de Santé Intégré 2.2"').replace(/"short_name":\s*"[^"]*"/, '"short_name": "Santé Intégré"');
      for (const [re, rep] of REMPLACEMENTS) t = t.replace(re, rep);
      fs.writeFileSync(p, t);
    }
  },
  transformIndexHtml(html: string) {
    if (!DEMO) return html;
    let out = html.replace(/<title>[^<]*<\/title>/, '<title>Système de Santé Intégré 2.2</title>');
    for (const [re, rep] of REMPLACEMENTS) out = out.replace(re, rep);
    return out;
  },
};

export default defineConfig(() => {
  return {
    plugins: [editionDemo, react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
