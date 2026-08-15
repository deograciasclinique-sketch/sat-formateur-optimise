/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { subscribeToCloudKey, pushToCloudKey } from "./liveSync";

const CLOUD_KEY = "dg_activity_logs";

export interface ActivityLog {
  id: string;
  action: string;      // e.g. "Suppression de consultation", "Modification de stock"
  category: "stock" | "suppression" | "securite" | "autre";
  details: string;     // Detailed info
  timestamp: string;   // ISO 8601 string
  user: string;        // Name and position
}

/**
 * Log a critical activity on the app.
 * Resolves current user automatically from PIN inside localStorage if not provided.
 */
export function logActivity(
  action: string,
  category: "stock" | "suppression" | "securite" | "autre",
  details: string,
  explicitUser?: string
) {
  try {
    let userName = explicitUser || "";

    if (!userName) {
      const pin = localStorage.getItem("dg_current_user_pin") || "";
      if (pin === "0000") {
        userName = "Responsable du Service (Responsable)";
      } else if (pin) {
        const staffData = localStorage.getItem("dg_staff");
        if (staffData) {
          try {
            const staff = JSON.parse(staffData);
            if (Array.isArray(staff)) {
              const found = staff.find((s: any) => s.codeEntree === pin);
              if (found) {
                userName = `${found.nom} (${found.poste})`;
              }
            }
          } catch (e) {
            console.error("Error parsing staff data in activityLogger", e);
          }
        }
      }
    }

    if (!userName) {
      userName = "Utilisateur Système / Hors-session";
    }

    const newLog: ActivityLog = {
      id: "log_" + Math.random().toString(36).substring(2, 11),
      action,
      category,
      details,
      timestamp: new Date().toISOString(),
      user: userName
    };

    const existingLogsData = localStorage.getItem("dg_activity_logs");
    let logs: ActivityLog[] = [];
    if (existingLogsData) {
      try {
        logs = JSON.parse(existingLogsData);
      } catch (e) {
        logs = [];
      }
    }

    if (!Array.isArray(logs)) {
      logs = [];
    }

    logs.unshift(newLog);

    // Keep last 500 logs
    if (logs.length > 500) {
      logs = logs.slice(0, 500);
    }

    localStorage.setItem("dg_activity_logs", JSON.stringify(logs));

    // Synchronise le journal vers le cloud pour qu'il soit visible depuis
    // tous les appareils (l'écoute temps réel se fait via subscribeToActivityLogs).
    pushToCloudKey(CLOUD_KEY, logs).catch(() => {
      // échec (hors-ligne) : le log reste correct en local, sera repoussé
      // au prochain appel de logActivity une fois la connexion revenue.
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
  }
}

/**
 * S'abonne aux changements distants du journal d'activité (autre appareil).
 * Retourne une fonction de désabonnement à appeler au démontage.
 */
export function subscribeToActivityLogs(onUpdate: (logs: ActivityLog[]) => void): () => void {
  return subscribeToCloudKey(CLOUD_KEY, (remoteLogs) => {
    if (!Array.isArray(remoteLogs)) return;
    try {
      localStorage.setItem(CLOUD_KEY, JSON.stringify(remoteLogs));
    } catch (e) {
      // ignore
    }
    onUpdate(remoteLogs);
  });
}

/**
 * Retrieve all activity logs stored in localStorage
 */
export function getActivityLogs(): ActivityLog[] {
  try {
    const existingLogsData = localStorage.getItem("dg_activity_logs");
    if (existingLogsData) {
      const logs = JSON.parse(existingLogsData);
      if (Array.isArray(logs)) {
        return logs;
      }
    }
  } catch (e) {
    console.error("Failed to parse activity logs:", e);
  }
  return [];
}

/**
 * Clear the activity logs
 */
export function clearActivityLogs() {
  try {
    localStorage.removeItem("dg_activity_logs");
    pushToCloudKey(CLOUD_KEY, []).catch(() => {});
  } catch (e) {
    console.error("Failed to clear activity logs:", e);
  }
}
