/**
 * Carte patient : affiche le code patient (en grand + QR code) et permet de
 * l'imprimer pour la remettre au patient. À chaque visite, le patient donne
 * son code (ou montre sa carte) et il est retrouvé immédiatement.
 */

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer, X, IdCard } from "lucide-react";
import { PatientRegistre, ageActuel } from "../lib/patients";

function nomClinique(): { name: string; phone?: string } {
  try {
    const p = JSON.parse(localStorage.getItem("dg_clinic_profile") || "{}");
    return { name: p.name || "Cabinet Médical DEO-GRACIAS", phone: p.phone };
  } catch {
    return { name: "Cabinet Médical DEO-GRACIAS" };
  }
}

export function useQr(code: string) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let ok = true;
    QRCode.toDataURL(code, { margin: 1, width: 220 }).then((u) => ok && setSrc(u)).catch(() => {});
    return () => { ok = false; };
  }, [code]);
  return src;
}

const esc = (v?: string) => (v || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));

export function imprimerCarte(p: PatientRegistre, qr: string) {
  const c0 = nomClinique();
  const c = { name: esc(c0.name), phone: esc(c0.phone) };
  const age = ageActuel(p);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>Carte patient ${p.code}</title><style>
    @page { size: 86mm 54mm; margin: 0 }
    body { margin: 0; font-family: Arial, sans-serif; }
    .carte { width: 86mm; height: 54mm; box-sizing: border-box; padding: 4mm 5mm; border: 0.4mm solid #0d9488; border-radius: 3mm; display: flex; gap: 4mm; }
    .g { flex: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 0; }
    .cl { font-size: 8pt; font-weight: bold; color: #0d9488; text-transform: uppercase; }
    .t { font-size: 6.5pt; color: #555; letter-spacing: .5pt; }
    .nom { font-size: 10pt; font-weight: bold; margin-top: 1mm; }
    .info { font-size: 7pt; color: #333; }
    .code { font-size: 17pt; font-weight: bold; letter-spacing: 1pt; font-family: 'Courier New', monospace; }
    .note { font-size: 6pt; color: #555; }
    img { width: 26mm; height: 26mm; align-self: center; }
  </style></head><body>
    <div class="carte">
      <div class="g">
        <div><div class="cl">${c.name}</div><div class="t">CARTE PATIENT</div></div>
        <div>
          <div class="nom">${esc(p.nom)}</div>
          <div class="info">${esc([p.sexe, age !== undefined ? `${age} ans` : "", p.contact].filter(Boolean).join(" · "))}</div>
        </div>
        <div>
          <div class="t">CODE PATIENT</div>
          <div class="code">${p.code}</div>
          <div class="note">À présenter à chaque visite${c.phone ? ` · ${c.phone}` : ""}</div>
        </div>
      </div>
      ${qr ? `<img src="${qr}" />` : ""}
    </div>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

export default function CartePatient({ patient, nouveau, onClose }: { patient: PatientRegistre; nouveau?: boolean; onClose: () => void }) {
  const qr = useQr(patient.code);
  const age = ageActuel(patient);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white text-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <IdCard className="w-5 h-5 text-emerald-600" /> {nouveau ? "Patient enregistré" : "Carte patient"}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-500"><X className="w-5 h-5" /></button>
        </div>
        {nouveau && (
          <p className="text-sm text-gray-600">
            Remettez ce code au patient (carte imprimée ou noté dans son carnet). À sa prochaine visite, son code suffit pour le retrouver.
          </p>
        )}
        <div className="rounded-xl border-2 border-emerald-600 p-4 flex gap-4 items-center">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-emerald-700 uppercase">Code patient</div>
            <div className="text-3xl font-black tracking-wider font-mono">{patient.code}</div>
            <div className="font-semibold mt-1 truncate">{patient.nom}</div>
            <div className="text-xs text-gray-500">{[patient.sexe, age !== undefined ? `${age} ans` : "", patient.contact].filter(Boolean).join(" · ")}</div>
          </div>
          {qr && <img src={qr} alt={`QR ${patient.code}`} className="w-24 h-24" />}
        </div>
        <div className="flex gap-2">
          <button onClick={() => imprimerCarte(patient, qr)} className="flex-1 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-emerald-700">
            <Printer className="w-4 h-4" /> Imprimer la carte
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border font-medium">Fermer</button>
        </div>
      </div>
    </div>
  );
}
