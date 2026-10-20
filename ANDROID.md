# Application Android (APK) — DEO GRACIAS Santé

Le dossier `android/` (Capacitor) transforme l'application du personnel en **APK Android officiel signé**.
À chaque envoi sur `main`, GitHub Actions (`.github/workflows/android.yml`) construit l'APK et le publie dans **Releases** :
`https://github.com/deograciasclinique-sketch/sat-formateur-optimise/releases/latest/download/DEO-GRACIAS-Sante.apk`

## Signature
`android/app/dg.keystore` est verrouillée par un mot de passe gardé **uniquement** dans le secret GitHub
`DG_KEYSTORE_PASSWORD` (Settings → Secrets and variables → Actions). Sans ce secret : APK de test, non publié.
Ne jamais perdre ce mot de passe : sans lui, plus de mise à jour qui s'installe par-dessus.

## Ce que fait l'APK en plus du site (src/lib/natif.ts + NatifPlugin.java)
- Impressions (ordonnances, résultats, cartes, déclarations…) : aperçu dans l'app puis impression Android / « Enregistrer en PDF ».
- PDF, CSV, sauvegardes, images : enregistrés dans Téléchargements › DEO GRACIAS, puis ouverts.
- Dictée vocale : reconnaissance vocale d'Android (français).
- Alertes de la Salle des soins : notifications Android.
- Assistants IA (/api/…) : appelés sur le serveur en ligne `sat-formateur-main.vercel.app`.
- Confidentialité : captures d'écran bloquées et écran masqué dans les applications récentes (réglable dans Paramètres).
- Bouton retour Android, écran de démarrage (logo de l'app + logo du cabinet), mise à jour automatique, envoi de l'APK par WhatsApp.
- APK final non débogable, sans sauvegarde des données vers Google, connexions chiffrées seulement.

Le site web (Vercel) et le portail patient continuent de fonctionner comme avant.
