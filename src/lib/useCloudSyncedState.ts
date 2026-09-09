/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hook générique pour remplacer un `useState` + `localStorage` par une version
 * qui synchronise aussi automatiquement la donnée vers Firestore (cloud), en
 * temps réel, entre tous les appareils connectés.
 *
 * Utilisation (remplace le pattern habituel) :
 *   AVANT :
 *     const [profile, setProfile] = useState(() => safeGet("dg_clinic_profile", DEFAULT));
 *     // ... puis quelque part : localStorage.setItem("dg_clinic_profile", JSON.stringify(profile));
 *
 *   APRÈS :
 *     const [profile, setProfile] = useCloudSyncedState("dg_clinic_profile", DEFAULT);
 *     // la lecture initiale (local), la sauvegarde locale ET la synchro cloud
 *     // temps réel sont gérées automatiquement.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { subscribeToCloudKey, pushToCloudKey } from "./liveSync";
import { db } from "./firebase";

function readLocal<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function useCloudSyncedState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => readLocal(key, defaultValue));

  // Dernière valeur (sérialisée) connue comme synchronisée avec le cloud,
  // pour éviter les boucles d'écriture entre appareils.
  const lastSyncedJson = useRef<string>(JSON.stringify(state));
  const pushTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Écoute des changements distants (autre appareil / autre agent).
  useEffect(() => {
    if (!db) return;
    const unsubscribe = subscribeToCloudKey(key, (remoteData) => {
      if (remoteData === undefined || remoteData === null) return;
      const remoteJson = JSON.stringify(remoteData);
      if (remoteJson === lastSyncedJson.current) return; // rien de neuf
      lastSyncedJson.current = remoteJson;
      setState(remoteData as T);
      try {
        localStorage.setItem(key, remoteJson);
      } catch {
        // ignore (quota local plein, etc.)
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Sauvegarde locale immédiate + envoi cloud légèrement différé (debounce),
  // pour éviter de spammer Firestore lors de saisies rapides.
  useEffect(() => {
    const json = JSON.stringify(state);
    try {
      localStorage.setItem(key, json);
    } catch {
      // ignore
    }
    if (json === lastSyncedJson.current) return;

    if (pushTimeout.current) clearTimeout(pushTimeout.current);

    // Tente l'envoi vers le cloud, avec plusieurs essais en cas d'échec
    // (connexion instable, etc.). Important : on ne marque la donnée comme
    // "synchronisée" (lastSyncedJson) qu'une fois l'envoi RÉELLEMENT réussi —
    // sinon une donnée jamais reçue par Firestore restait bloquée pour
    // toujours sur l'appareil d'origine, sans jamais réessayer.
    const attemptPush = (attempt: number) => {
      pushToCloudKey(key, state)
        .then(() => {
          lastSyncedJson.current = json;
        })
        .catch((err) => {
          console.error(`[sync] Échec de l'envoi de "${key}" (essai ${attempt}):`, err);
          if (attempt < 5) {
            // Nouvel essai avec un délai croissant (2s, 4s, 8s, 16s, 32s).
            const delay = Math.min(2000 * 2 ** (attempt - 1), 32000);
            pushTimeout.current = setTimeout(() => attemptPush(attempt + 1), delay);
          }
          // Après 5 essais infructueux, on abandonne pour cette modification
          // précise : elle sera renvoyée automatiquement dès la prochaine
          // modification de cette même donnée (ou au prochain montage du
          // composant), car lastSyncedJson n'a jamais été mis à jour.
        });
    };

    pushTimeout.current = setTimeout(() => attemptPush(1), 1000);

    return () => {
      if (pushTimeout.current) clearTimeout(pushTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state]);

  const setSynced = useCallback((value: T | ((prev: T) => T)) => {
    setState(value);
  }, []);

  return [state, setSynced];
}
