/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Les 4 routes des assistants IA, partagées entre Vercel (api/…) et server.ts.

import { creerRoute } from "./route.js";
import {
  generateComplianceReport,
  generateOptimizationReport,
  generateConsultationAssistant,
  generateLabProcedure,
} from "./geminiCore.js";
import {
  validerCompliance,
  validerOptimisation,
  validerConsultation,
  validerProcedureLabo,
} from "./validation.js";

export const routeCompliance = creerRoute(
  "compliance", validerCompliance, generateComplianceReport,
  "Erreur lors de la génération du rapport. Réessayez dans un instant."
);
export const routeOptimisation = creerRoute(
  "app-optimize", validerOptimisation, generateOptimizationReport,
  "Erreur lors de la génération du rapport d'optimisation. Réessayez dans un instant."
);
export const routeConsultation = creerRoute(
  "consultation-assistant", validerConsultation, generateConsultationAssistant,
  "L'assistant médical IA n'a pas pu répondre. Réessayez dans un instant."
);
export const routeProcedureLabo = creerRoute(
  "lab-procedure", validerProcedureLabo, generateLabProcedure,
  "Erreur lors de la génération de la procédure. Réessayez dans un instant."
);
