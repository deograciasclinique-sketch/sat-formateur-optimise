/**
 * Alertes de la Salle des soins.
 *
 * Toujours monté au niveau de l'app (quel que soit l'onglet ouvert) pour les
 * postes qui ont accès à la Salle des Infirmiers. Vérifie toutes les 30 s les
 * plans de traitement en cours et :
 *  - 30 min avant l'heure d'une prise : bandeau + son + notification Windows/téléphone ;
 *  - à l'heure, si la prise n'est pas faite : nouvelle alerte « en retard ».
 * Le bandeau reste affiché tant que la prise n'est pas enregistrée (« Faire le
 * soin »), ou est mis en pause 10 min avec « Plus tard ».
 * Les données étant synchronisées, une prise faite sur un poste fait
 * disparaître l'alerte sur tous les autres.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellRing, AlertTriangle, Syringe, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { PlanSoins, SoinRealise } from "../types";
import { alertesSoins, AlerteSoin, localDate } from "./SalleDesSoins";
import { sendBrowserNotification, isNotificationSupported, requestNotificationPermission } from "../lib/browserNotifications";

const CLE_NOTIFIEES = "dg_alertes_soins_notifiees";
const PAUSE_MIN = 10;

/** Alarme sonore : trois bips nets, audibles dans une salle. */
function jouerAlarme(urgent: boolean) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const freq = urgent ? 988 : 880;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      o.connect(g);
      g.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.35;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.start(t0);
      o.stop(t0 + 0.27);
    }
    window.setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    /* son bloqué par le navigateur : le bandeau reste visible */
  }
}

/** Alertes déjà notifiées sur ce poste (pour ne pas répéter la notification). */
function lireNotifiees(): Set<string> {
  try {
    const t = localDate();
    const arr: string[] = JSON.parse(localStorage.getItem(CLE_NOTIFIEES) || "[]");
    return new Set(arr.filter((k) => k.includes(`|${t}|`)));
  } catch {
    return new Set();
  }
}
function ecrireNotifiees(s: Set<string>) {
  try { localStorage.setItem(CLE_NOTIFIEES, JSON.stringify([...s])); } catch { /* ignore */ }
}

const texteDelai = (a: AlerteSoin) =>
  a.statut === "bientot"
    ? `Dans ${a.ecartMinutes} min`
    : -a.ecartMinutes < 1 ? "C'est l'heure" : `En retard de ${-a.ecartMinutes >= 60 ? `${Math.floor(-a.ecartMinutes / 60)} h ${String(-a.ecartMinutes % 60).padStart(2, "0")}` : `${-a.ecartMinutes} min`}`;

const texteLigne = (l: { produit: string; dose?: string; voie?: string }) => [l.produit, l.dose, l.voie].filter(Boolean).join(" · ");

export default function AlertesSoins({ plans, soins, isDark, onFaire }: {
  plans: PlanSoins[];
  soins: SoinRealise[];
  isDark: boolean;
  onFaire: (planId: string, lignes: string[]) => void;
}) {
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [pauses, setPauses] = useState<Record<string, number>>({});
  const [reduit, setReduit] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "absent">(
    isNotificationSupported() ? Notification.permission : "absent"
  );
  const visiblesAvant = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = window.setInterval(() => setMaintenant(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const alertes = useMemo(() => alertesSoins(plans, soins, maintenant), [plans, soins, maintenant]);
  const visibles = useMemo(
    () => alertes.filter((a) => !(pauses[a.cle] && pauses[a.cle] > maintenant.getTime())),
    [alertes, pauses, maintenant]
  );

  // Notification (une fois par prise et par étape : 30 min avant, puis à l'heure)
  // et son à chaque nouvelle alerte visible (y compris à la fin d'une pause).
  useEffect(() => {
    const notifiees = lireNotifiees();
    let changer = false;
    alertes.forEach((a) => {
      const k = `${a.cle}|${a.statut}`;
      if (notifiees.has(k)) return;
      notifiees.add(k);
      changer = true;
      const meds = a.lignes.map((l) => l.produit).join(", ");
      sendBrowserNotification(
        a.statut === "bientot" ? `⏰ Soin à ${a.heure} — ${a.plan.patient}` : `⚠ Soin en retard (${a.heure}) — ${a.plan.patient}`,
        a.statut === "bientot" ? `Dans ${a.ecartMinutes} min : ${meds}` : `Prise de ${a.heure} pas encore faite : ${meds}`,
        `soin-${a.cle}-${a.statut}`
      );
    });
    if (changer) ecrireNotifiees(notifiees);

    const nouvelles = visibles.filter((a) => !visiblesAvant.current.has(`${a.cle}|${a.statut}`));
    if (nouvelles.length) {
      jouerAlarme(nouvelles.some((a) => a.statut === "retard"));
      setReduit(false);
    }
    visiblesAvant.current = new Set(visibles.map((a) => `${a.cle}|${a.statut}`));
  }, [alertes, visibles]);

  if (!visibles.length) return null;

  const retards = visibles.filter((a) => a.statut === "retard").length;
  const fond = isDark ? "bg-gray-900 text-gray-100 border-gray-700" : "bg-white text-gray-900 border-gray-200";
  const muted = isDark ? "text-gray-400" : "text-gray-500";

  if (reduit) {
    return (
      <button
        onClick={() => setReduit(false)}
        className={`fixed bottom-4 right-4 z-[60] rounded-full shadow-xl px-4 py-2.5 font-bold text-sm flex items-center gap-2 ${retards ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"} animate-pulse`}
      >
        <BellRing className="w-4 h-4" /> {visibles.length} soin(s) à faire <ChevronUp className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-[60] w-full sm:w-[380px] max-h-[70vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border shadow-2xl ${fond}`} role="alert">
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-t-2xl ${retards ? "bg-red-600" : "bg-amber-400"} ${retards ? "text-white" : "text-amber-950"}`}>
        <span className="font-bold text-sm flex items-center gap-2"><BellRing className="w-4 h-4" /> Salle des soins — {visibles.length} prise(s)</span>
        <button onClick={() => setReduit(true)} className="p-1 rounded hover:bg-black/10" aria-label="Réduire" title="Réduire"><ChevronDown className="w-4 h-4" /></button>
      </div>

      <div className="p-3 space-y-2">
        {visibles.map((a) => (
          <div key={a.cle} className={`rounded-xl border-2 p-3 ${a.statut === "retard" ? "border-red-500" : "border-amber-400"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${a.statut === "retard" ? "bg-red-600 text-white" : "bg-amber-100 text-amber-900"}`}>
                {a.statut === "retard" ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />} {texteDelai(a)}
              </span>
              <span className="text-lg font-black tabular-nums">{a.heure}</span>
            </div>
            <div className="font-bold mt-1">{a.plan.patient}</div>
            <ul className="text-sm list-disc pl-5">
              {a.lignes.map((l) => <li key={l.id}>{texteLigne(l)}</li>)}
            </ul>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onFaire(a.plan.id, a.lignes.map((l) => l.id))}
                className="flex-[2] rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Syringe className="w-4 h-4" /> Faire le soin
              </button>
              <button
                onClick={() => setPauses({ ...pauses, [a.cle]: Date.now() + PAUSE_MIN * 60000 })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${isDark ? "border-gray-600" : "border-gray-300"}`}
                title={`Masquer ${PAUSE_MIN} minutes`}
              >
                Plus tard
              </button>
            </div>
          </div>
        ))}

        {permission === "default" && (
          <button
            onClick={async () => setPermission(await requestNotificationPermission())}
            className={`w-full text-sm font-semibold rounded-lg border border-dashed px-3 py-2 flex items-center justify-center gap-1.5 ${isDark ? "border-gray-600" : "border-gray-300"}`}
          >
            <Bell className="w-4 h-4" /> Activer les notifications sur ce poste
          </button>
        )}
        {permission === "denied" && (
          <p className={`text-xs ${muted}`}>Les notifications sont bloquées dans ce navigateur : seuls le son et ce bandeau préviennent.</p>
        )}
      </div>
    </div>
  );
}
