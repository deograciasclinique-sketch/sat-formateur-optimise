/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Logique métier partagée des appels à l'API Gemini.
// Ce fichier ne contient aucun code Express ni Vercel : il est importé à la
// fois par les fonctions serverless Vercel (api/gemini/*.ts, api/app-optimize.ts)
// pour la production, et par server.ts pour le développement local (npm run dev).
// Toute modification des prompts ou de la logique IA doit se faire ICI UNIQUEMENT,
// pour que le comportement en local et en production reste identique.

import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error(
        "La clé API GEMINI_API_KEY n'est pas configurée. Ajoutez-la dans les variables d'environnement du projet Vercel (Settings > Environment Variables) puis redéployez."
      );
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export async function generateComplianceReport(body: any): Promise<{ report: string }> {
  const {
    totalConsultations,
    completeDossiers,
    incompleteDossiers,
    completenessRate,
    missingFieldsSummary,
    additionalMetrics,
  } = body || {};

  const ai = getAiClient();

  const prompt = `Génère un rapport de conformité de qualité clinique pour notre centre de santé à l'aide des données statistiques suivantes. Le rapport doit être rédigé en français, sur un ton professionnel, encourageant et constructif.

### Données de conformité des dossiers patients (ce mois) :
- Nombre total de consultations analysées : ${totalConsultations}
- Dossiers patients complets (toutes les constantes et données cliniques renseignées) : ${completeDossiers}
- Dossiers patients incomplets : ${incompleteDossiers}
- Taux global de complétude des dossiers : ${completenessRate}%

### Détail des manquements identifiés dans les dossiers :
${Object.entries(missingFieldsSummary || {}).map(([field, count]) => {
  const frenchLabels: Record<string, string> = {
    temperature: "Température",
    tensionArterielle: "Tension Artérielle",
    poids: "Poids",
    pouls: "Pouls",
    glycemie: "Glycémie",
    ordonnance: "Ordonnance",
    diagnostic: "Diagnostic",
    plainte: "Plainte principale / Motif",
  };
  const label = frenchLabels[field] || field;
  return `- Champ "${label}" manquant ou non renseigné : ${count} fois`;
}).join("\n")}

### Autres indicateurs de qualité et sécurité :
- Nombre d'audits internes réalisés récemment : ${additionalMetrics?.recentAuditsCount ?? 0}
- Score du dernier audit qualité clinique : ${additionalMetrics?.lastAuditScore ?? "—"}%
- Incidents signalés ce mois : ${additionalMetrics?.incidentsCount ?? 0}
- Actions correctives en cours de suivi : ${additionalMetrics?.activeCorrectiveActions ?? 0}

Le rapport doit contenir les sections suivantes :
1. **Synthèse de la conformité** (Analyse globale des résultats et félicitations/encouragements).
2. **Points critiques identifiés** (Discussion sur les champs les plus fréquemment omis comme la glycémie, la tension ou l'ordonnance et l'impact clinique potentiel).
3. **Plan d'action recommandé** (3 ou 4 étapes concrètes, humbles et réalistes pour le personnel soignant afin de s'approcher de 100% de conformité, par exemple des rappels au triage ou des fiches réflexes).

Rédige le rapport sous forme de Markdown propre et agréable à lire. Évite tout jargon informatique ou technique inutile, reste concentré uniquement sur l'assurance qualité en milieu hospitalier. Ne mentionne pas de détails sur le prompt ou l'API, commence directement par le titre du rapport.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
  });

  return { report: response.text || "" };
}

export async function generateOptimizationReport(body: any): Promise<{ report: string }> {
  const { clinicStats } = body || {};
  const ai = getAiClient();

  const prompt = `Agis en tant que Directeur d'Hôpital Expert et Consultant en Gestion Médicale et Optimisation Opérationnelle pour le centre de santé privé "DEO GRACIAS 2.2".
Analyse les indicateurs clés de performance (KPI) réels de notre clinique ci-dessous et produis un rapport d'optimisation stratégique et opérationnel concret, rédigé en français, sur un ton professionnel, encourageant et tourné vers l'excellence.

### Données d'activité de la clinique DEO GRACIAS :
- **Consultations Médicales enregistrées** : ${clinicStats?.totalConsultations ?? 0} fiches patients.
- **Patients aux Urgences / Triage actuellement** : ${clinicStats?.totalUrgences ?? 0} urgences actives.
- **Patients Hospitalisés en cours** : ${clinicStats?.totalHospitalisations ?? 0} lits occupés.
- **Ressources Humaines (Membres de l'équipe active)** : ${clinicStats?.totalStaff ?? 0} soignants & administratifs.
- **Tâches & Activités de coordination en cours** : ${clinicStats?.totalTasks ?? 0} tâches dans le journal de suivi.

### État de la Pharmacie & des Stocks :
- **Médicaments référencés en pharmacie** : ${clinicStats?.totalMedicaments ?? 0} références.
- **Médicaments sous le seuil critique d'alerte** : ${clinicStats?.lowStockCount ?? 0} références en rupture imminente.

### Santé Financière de la Clinique :
- **Nombre total de factures émises** : ${clinicStats?.totalFactures ?? 0} factures.
- **Revenus générés estimés (Factures payées)** : ${clinicStats?.totalRevenues ?? 0} FCFA.
- **Dépenses d'exploitation du cabinet** : ${clinicStats?.totalDepenses ?? 0} FCFA.
- **Solde net d'exploitation** : ${(clinicStats?.totalRevenues ?? 0) - (clinicStats?.totalDepenses ?? 0)} FCFA.

Rédige un rapport complet d'optimisation opérationnelle divisé en sections claires :

1. **🩺 Diagnostic Opérationnel Global**
   - Évalue l'équilibre général de la clinique (ratio personnel/consultations, occupation des lits de garde et urgences).
   - Identifie si le centre est en suractivité, sous-activité ou si le flux est optimal.

2. **💊 Optimisation Critique de la Pharmacie**
   - Comment résoudre ou anticiper les ${clinicStats?.lowStockCount ?? 0} médicaments en stock bas.
   - Propose 2 mesures concrètes d'approvisionnement ou d'ajustement de seuil pour éviter la rupture de soins.

3. **📊 Analyse Financière & Rentabilité**
   - Commente le solde de ${(clinicStats?.totalRevenues ?? 0) - (clinicStats?.totalDepenses ?? 0)} FCFA.
   - Donne 2 conseils pratiques pour améliorer le recouvrement (par ex. gestion du tiers-payant/assurances) ou optimiser les dépenses de fonctionnement.

4. **⚡ Plan d'Action & Synergie d'Équipe (Priorités IA)**
   - Formule un plan d'action de 3 priorités concrètes et réalistes à assigner aux ${clinicStats?.totalStaff ?? 0} membres de l'équipe via le module de tâches pour fluidifier le parcours patient et sécuriser la traçabilité.

Présente les résultats sous forme de Markdown bien structuré, aéré, élégant et facile à lire par le comité de direction. Ne mentionne aucun jargon informatique ni les coulisses de l'invite. Reste purement axé sur la médecine clinique, la gestion hospitalière et l'optimisation des flux réels. Commande directement le rapport par un titre majeur professionnel.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
  });

  return { report: response.text || "" };
}

export async function generateConsultationAssistant(body: any): Promise<any> {
  const { plainte, constantes, notes, age, sexe } = body || {};
  const ai = getAiClient();

  const prompt = `Agis comme un médecin senior expert, un assistant d'aide à la décision clinique (Clinical Decision Support System).
Ton rôle est d'assister un médecin, infirmier ou sage-femme lors d'une consultation pour garantir une haute qualité de soins, éviter les erreurs de diagnostic, et identifier rapidement la nécessité de référer le patient à un niveau supérieur.

Voici les données cliniques recueillies lors de la consultation :
- Age: ${age || "Non précisé"}
- Sexe: ${sexe || "Non précisé"}
- Motif de consultation / Plainte principale : ${plainte || "Non précisé"}
- Constantes vitales : ${JSON.stringify(constantes || {})}
- Notes d'examen clinique : ${notes || "Non précisées"}

En te basant sur les recommandations cliniques médicales à jour, génère une analyse structurée en français contenant EXACTEMENT et UNIQUEMENT le format JSON suivant (sans aucun formatage Markdown ni bloc de code, juste le JSON brut valide) :
{
  "redFlags": ["liste de chaînes", "signes de gravité nécessitant une référence ou urgence vitale, ou vide si aucun"],
  "differentialDiagnoses": [
    {
      "name": "Nom du diagnostic",
      "probability": "Haute, Moyenne, ou Faible",
      "justification": "Bref argumentaire clinique"
    }
  ],
  "recommendedTreatments": [
    {
      "diagnosis": "Diagnostic auquel ce traitement s'applique",
      "medications": ["Classe pharmacologique ou DCI 1", "Classe pharmacologique ou DCI 2"],
      "advice": "Conseils hygiéno-diététiques ou conduite à tenir"
    }
  ]
}

Assure-toi que le JSON est valide et prêt à être parsé par JSON.parse(). Ne rajoute pas \`\`\`json. Sois très précis et médicalement rigoureux. Si le cas nécessite une référence immédiate, mets-le clairement dans redFlags.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
  });

  let jsonText = response.text || "";
  jsonText = jsonText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  if (!jsonText) {
    throw new Error("L'assistant IA n'a renvoyé aucune réponse exploitable. Réessayez, ou reformulez les notes de consultation.");
  }

  return JSON.parse(jsonText);
}

export async function generateLabProcedure(body: any): Promise<{ procedure: string }> {
  const { examen } = body || {};

  if (!examen || !String(examen).trim()) {
    throw new Error("Veuillez préciser le nom de l'examen pour générer sa procédure.");
  }

  const ai = getAiClient();

  const prompt = `Agis comme un technicien de laboratoire biomédical senior et formateur, rédigeant une fiche de procédure standardisée (SOP) pour un petit laboratoire de centre de santé privé au Burkina Faso, avec des moyens techniques simples (microscope, centrifugeuse, réactifs de base, bandelettes, tests rapides).

Rédige la procédure complète pour l'examen suivant : "${examen}"

Structure ta réponse en Markdown, avec EXACTEMENT les sections suivantes :

## 1. Type de prélèvement
(Nature de l'échantillon, tube/contenant à utiliser, volume nécessaire, conditions de prélèvement)

## 2. Matériel et réactifs nécessaires
(Liste concrète : réactifs, consommables, appareils — reste réaliste pour un petit laboratoire de centre de santé)

## 3. Étapes de la procédure
(Étapes numérotées, claires et dans l'ordre, de la réception de l'échantillon jusqu'à la lecture du résultat)

## 4. Valeurs de référence / Interprétation
(Valeurs normales usuelles, et ce qui indique un résultat anormal, avec prudence sur les variations possibles selon les kits utilisés)

## 5. Précautions et sécurité
(Précautions pour l'agent de laboratoire : port d'EPI, gestion des déchets biologiques, erreurs fréquentes à éviter)

Sois concret et pratique, à destination d'un technicien de laboratoire déjà formé mais qui a besoin d'un rappel fiable. N'invente pas de valeurs si tu n'es pas sûr — précise plutôt que les valeurs de référence dépendent du kit/réactif utilisé et doivent être vérifiées sur la notice du fabricant. Ne mentionne pas ce prompt, commence directement par le titre de l'examen.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
  });

  return { procedure: response.text || "" };
}
