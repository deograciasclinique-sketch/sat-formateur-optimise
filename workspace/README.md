# Système Intégré de Gestion de Clinique (SIGH)

Une application complète (Full-Stack) de gestion hospitalière conçue pour fonctionner avec ou sans connexion internet (Offline-First). Elle inclut la gestion des dossiers patients, la pharmacie, les ressources humaines, la comptabilité et intègre un assistant IA pour l'aide au diagnostic clinique et l'optimisation opérationnelle.

## 🌟 Fonctionnalités Principales
- 🏥 **Dossiers Patients Informatisés (DPI)** : Consultations, antécédents, constantes vitales, impression d'ordonnances PDF.
- 💊 **Gestion de Pharmacie** : Suivi des stocks, alertes de péremption, traçabilité des mouvements, facturation.
- 👶 **Pédiatrie & Maternité** : Suivi des Consultations Prénatales (CPN), accouchements, courbes de croissance pédiatriques.
- 🤖 **Assistant IA Médical** : Aide au diagnostic (Diagnostics différentiels), rédaction de rapports d'optimisation (propulsé par l'API Gemini).
- 🎙️ **Saisie Vocale** : Dictée vocale pour les observations cliniques et les diagnostics.
- 📶 **Mode Hors-Ligne (Offline-First)** : L'application fonctionne parfaitement sans internet (les données sont sauvegardées localement dans le navigateur) et se synchronise lorsque la connexion revient.

---

## 💻 Prérequis

Pour installer et exécuter cette application sur vos serveurs ou ordinateurs locaux, vous devez disposer de :
- **[Node.js](https://nodejs.org/)** (version 18 ou supérieure recommandée)
- **npm** (inclus par défaut lors de l'installation de Node.js)
- Une clé **API Google Gemini** (pour activer l'assistant d'intelligence artificielle).

---

## 🚀 Guide d'Installation

### 1. Extraire les fichiers
Décompressez l'archive ZIP que vous avez reçue dans le dossier de votre choix sur votre ordinateur ou serveur.

### 2. Ouvrir le terminal
Ouvrez votre terminal (Invite de commandes sur Windows, Terminal sur Mac/Linux) et naviguez vers le dossier où vous avez extrait l'application :
```bash
cd chemin/vers/le/dossier/extrait
```

### 3. Installer les dépendances
Exécutez la commande suivante pour télécharger et installer toutes les bibliothèques nécessaires au fonctionnement du logiciel (listées dans `package.json`) :
```bash
npm install
```

---

## ⚙️ Configuration

1. Dans le dossier racine du projet, vous trouverez un fichier nommé `.env.example`.
2. Faites une copie de ce fichier et renommez la copie en **`.env`**.
3. Ouvrez le fichier `.env` avec un éditeur de texte (comme Bloc-notes ou VS Code) et ajoutez votre clé API Gemini :
   ```env
   GEMINI_API_KEY=votre_cle_api_gemini_ici
   ```

*(Note Avancée : Si vous utilisez la prise de rendez-vous en ligne, la configuration Firebase se trouve dans `src/lib/firebase.ts`. Vous devrez y mettre les identifiants de votre propre projet Firebase si vous souhaitez isoler totalement la base de données de rendez-vous en ligne).*

---

## 🛠️ Démarrage en Mode Local (Développement ou Test)

Pour lancer l'application sur l'ordinateur local de la clinique :

```bash
npm run dev
```

Une fois la commande lancée, ouvrez votre navigateur web (Chrome ou Edge recommandé) et allez à l'adresse suivante :
**http://localhost:3000**

---

## 🌍 Mise en Production (Déploiement sur un Serveur Réel)

Si vous installez l'application sur un serveur dédié (VPS, Cloud Run, Heroku, Render, etc.) pour qu'elle soit accessible sur tout le réseau de l'hôpital ou sur internet, suivez ces étapes :

1. **Compiler l'application** (créer une version optimisée) :
   ```bash
   npm run build
   ```

2. **Démarrer le serveur de production** :
   ```bash
   npm run start
   ```
   *L'application sera alors prête à accueillir des connexions de manière performante et sécurisée sur le port 3000.*

---

## 📦 Technologies Utilisées
- **Frontend** : React 19, TypeScript, Tailwind CSS, Vite, Lucide React (Icônes)
- **Backend / API** : Node.js, Express
- **Intelligence Artificielle** : SDK `@google/genai` (Modèles Gemini 3.5 Flash)
- **Base de données** : IndexedDB via LocalForage (Stockage local robuste), Firebase Firestore (Rendez-vous Cloud)
- **Génération PDF** : jsPDF, jspdf-autotable
