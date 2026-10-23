/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Fonction serverless Vercel : POST /api/gemini/compliance
// Sécurité (jeton du personnel, limite d'appels, validation des champs) : voir api/_lib/securite.ts et validation.ts.

import { routeCompliance } from "../_lib/routes.js";

export default routeCompliance;
