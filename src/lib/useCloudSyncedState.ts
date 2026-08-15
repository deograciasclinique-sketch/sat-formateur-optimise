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
    pushTimeout.current = setTimeout(() => {
      lastSyncedJson.current = json;
      pushToCloudKey(key, state).catch(() => {
        // échec (hors-ligne) : la valeur locale reste correcte, on retentera
        // au prochain changement ou au prochain montage.
      });
    }, 1000);

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
