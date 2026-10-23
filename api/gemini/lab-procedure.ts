/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Fonction serverless Vercel : POST /api/gemini/lab-procedure
// Sécurité (jeton du personnel, limite d'appels, validation des champs) : voir api/_lib/securite.ts et validation.ts.

import { routeProcedureLabo } from "../_lib/routes.js";

export default routeProcedureLabo;
