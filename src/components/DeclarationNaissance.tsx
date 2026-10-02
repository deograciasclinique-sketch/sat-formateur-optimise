/**
 * Déclaration de naissance — salle d'accouchement.
 *
 * Établie à partir d'un accouchement du registre : les informations de la
 * naissance (date, heure, sexe, poids, accoucheuse) sont reprises
 * automatiquement ; la sage-femme complète l'identité de l'enfant, des
 * parents et du déclarant, puis imprime la déclaration (exemplaire des
 * parents + souche du service) à remettre pour l'état civil.
 */

import React, { useMemo, useState } from "react";
import { X, Printer, Save, FileText } from "lucide-react";
import { Accouchement, ConsultationPrenatale, DeclarationNaissance, PersonneDeclaration, Staff } from "../types";
import { getTodayStr } from "../data";

const personneVide = (): PersonneDeclaration => ({ nom: "", prenoms: "", nationalite: "Burkinabè" });

/** Numéro suivant pour l'année : DN-2026-0001, DN-2026-0002… */
export function prochainNumeroDeclaration(accouchements: Accouchement[], annee: string): string {
  const max = accouchements.reduce((m, a) => {
    const n = a.declarationNaissance?.numero;
    const r = n && n.startsWith(`DN-${annee}-`) ? parseInt(n.split("-")[2], 10) || 0 : 0;
    return Math.max(m, r);
  }, 0);
  return `DN-${annee}-${String(max + 1).padStart(4, "0")}`;
}

/** Sépare "Ouédraogo Awa Marie" en nom / prénoms (premier mot = nom). */
const decouperNom = (complet: string): { nom: string; prenoms: string } => {
  const t = (complet || "").replace(/^(madame|mme|mlle|mademoiselle)\.?\s+/i, "").trim().split(/\s+/);
  return { nom: t[0] || "", prenoms: t.slice(1).join(" ") };
};

const esc = (s?: string | number) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const dateLongue = (iso?: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";

function profilClinique() {
  try {
    const p = JSON.parse(localStorage.getItem("dg_clinic_profile") || "null");
    if (p && p.name) return p;
  } catch { /* stockage indisponible */ }
  return {
    name: "Cabinet Privé de Soins DEO-GRACIAS",
    slogan: "Nous vous soignons, Dieu vous guérit",
    address: "Yéguéré, 363 Rue de l'Habitat",
    phone: "44 92 01 62 / 76 40 43 27",
  };
}

export function imprimerDeclaration(a: Accouchement, d: DeclarationNaissance, staff: Staff[]) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("La fenêtre d'impression est bloquée. Veuillez autoriser les pop-ups pour cette application.");
    return;
  }
  const p = profilClinique();
  const accoucheuse = staff.find((s) => s.id === a.sageFemmeId);
  const ligne = (label: string, val?: string | number) =>
    `<tr><td class="l">${esc(label)}</td><td class="v">${val !== undefined && val !== "" ? esc(val) : "&nbsp;"}</td></tr>`;
  const personne = (titre: string, x: PersonneDeclaration) => `
    <h3>${titre}</h3>
    <table>
      ${ligne("Nom", x.nom)}${ligne("Prénom(s)", x.prenoms)}
      ${ligne("Date de naissance / âge", [x.dateNaissance ? new Date(x.dateNaissance + "T00:00:00").toLocaleDateString("fr-FR") : "", x.age ? `${x.age} ans` : ""].filter(Boolean).join(" — "))}
      ${ligne("Profession", x.profession)}${ligne("Domicile", x.domicile)}${ligne("Nationalité", x.nationalite)}
      ${ligne("Pièce d'identité", x.pieceIdentite)}${ligne("Contact", x.contact)}
    </table>`;
  const volet = (exemplaire: string) => `
    <div class="page">
      <div class="entete">
        ${p.logoUrl ? `<img src="${esc(p.logoUrl)}" class="logo" />` : ""}
        <div class="id">
          <div class="pays">BURKINA FASO</div>
          <div class="fs">${esc(p.name)}</div>
          ${p.slogan ? `<div class="slogan">${esc(p.slogan)}</div>` : ""}
          <div class="adr">${esc(p.address || "")}${p.phone ? ` — Tél. ${esc(p.phone)}` : ""}</div>
        </div>
        <div class="num">N° ${esc(d.numero)}<br/><span>${esc(exemplaire)}</span></div>
      </div>
      <h1>DÉCLARATION DE NAISSANCE</h1>
      <p class="intro">Je soussigné(e), <b>${esc(accoucheuse?.nom || d.etabliePar || "……………………")}</b>${accoucheuse?.poste ? `, ${esc(accoucheuse.poste)}` : ""}, certifie que
        ${a.sexeEnfant === "Féminin"
          ? (d.vivant ? "l'enfant désignée ci-dessous est née vivante" : "l'enfant désignée ci-dessous est <b>née sans vie (mort-née)</b>")
          : (d.vivant ? "l'enfant désigné ci-dessous est né vivant" : "l'enfant désigné ci-dessous est <b>né sans vie (mort-né)</b>")} au sein de notre établissement.</p>
      <h3>L'enfant</h3>
      <table>
        ${ligne("Nom", d.nomEnfant)}${ligne("Prénom(s)", d.prenomsEnfant)}
        ${ligne("Sexe", a.sexeEnfant)}
        ${ligne("Date de naissance", dateLongue(a.date))}${ligne("Heure de naissance", a.heure)}
        ${ligne("Lieu de naissance", `${p.name}${p.address ? `, ${p.address}` : ""}`)}
        ${ligne("Naissance", d.naissance + (d.rang ? ` (${d.rang})` : ""))}
        ${ligne("Mode d'accouchement", a.mode)}
        ${ligne("Poids / taille / PC", [a.poidsEnfant ? `${a.poidsEnfant} g` : "", d.taille ? `${d.taille} cm` : "", d.perimetreCranien ? `PC ${d.perimetreCranien} cm` : ""].filter(Boolean).join(" — "))}
      </table>
      ${personne("La mère", d.mere)}
      ${d.pereNonDeclare ? `<h3>Le père</h3><p class="na">Non déclaré</p>` : personne("Le père", d.pere)}
      <h3>Le déclarant</h3>
      <table>${ligne("Nom et prénom(s)", d.declarantNom)}${ligne("Lien avec l'enfant", d.declarantLien)}${ligne("Contact", d.declarantContact)}</table>
      ${d.observations ? `<p class="obs"><b>Observations :</b> ${esc(d.observations)}</p>` : ""}
      <p class="rappel">La présente déclaration est à présenter au centre d'état civil pour l'établissement de l'acte de naissance de l'enfant.</p>
      <div class="sign">
        <div>Fait le ${esc(new Date(d.dateEtablissement + "T00:00:00").toLocaleDateString("fr-FR"))}<br/><br/>Le déclarant</div>
        <div>L'accoucheur / l'accoucheuse<br/><span>(cachet et signature)</span></div>
      </div>
    </div>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Déclaration de naissance ${esc(d.numero)}</title>
    <style>
      body{font-family:Georgia,'Times New Roman',serif;color:#111;margin:0}
      .page{padding:14mm 16mm;page-break-after:always}
      .page:last-child{page-break-after:auto}
      .entete{display:flex;gap:12px;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:8px}
      .logo{width:64px;height:64px;object-fit:contain}
      .id{flex:1}
      .pays{font-weight:bold;letter-spacing:2px;font-size:12px}
      .fs{font-size:17px;font-weight:bold}
      .slogan{font-style:italic;font-size:11px}
      .adr{font-size:11px}
      .num{text-align:right;font-weight:bold;font-size:13px;white-space:nowrap}
      .num span{font-weight:normal;font-style:italic;font-size:11px}
      h1{text-align:center;font-size:20px;letter-spacing:3px;margin:14px 0 8px}
      h3{font-size:13px;text-transform:uppercase;margin:10px 0 3px;border-bottom:1px solid #999}
      table{width:100%;border-collapse:collapse;font-size:12.5px}
      td{padding:2px 4px;vertical-align:top}
      td.l{width:34%;color:#444}
      td.v{font-weight:bold;border-bottom:1px dotted #999}
      .intro{font-size:12.5px;line-height:1.5}
      .na{font-size:12.5px;font-style:italic}
      .obs,.rappel{font-size:11.5px}
      .rappel{font-style:italic;margin-top:10px}
      .sign{display:flex;justify-content:space-between;margin-top:18px;font-size:12.5px}
      .sign>div{width:45%;text-align:center;min-height:70px}
      .sign span{font-size:11px;font-style:italic}
    </style></head><body>
    ${volet("Exemplaire des parents")}
    ${volet("Souche — à conserver au service")}
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
    </body></html>`);
  w.document.close();
}

interface Props {
  accouchement: Accouchement;
  accouchements: Accouchement[];
  cpns: ConsultationPrenatale[];
  staff: Staff[];
  currentUser?: Staff | null;
  onSave: (d: DeclarationNaissance) => void;
  onClose: () => void;
}

export default function DeclarationNaissanceModal({ accouchement: a, accouchements, cpns, staff, currentUser, onSave, onClose }: Props) {
  const existante = a.declarationNaissance;
  const cpnMere = useMemo(() => {
    const n = (x: string) => (x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    return cpns.filter((c) => n(c.patient) === n(a.patient)).sort((x, y) => y.dateVisite.localeCompare(x.dateVisite))[0];
  }, [cpns, a.patient]);

  const [d, setD] = useState<DeclarationNaissance>(() => {
    if (existante) return existante;
    const m = decouperNom(a.patient);
    return {
      numero: prochainNumeroDeclaration(accouchements, (a.date || getTodayStr()).slice(0, 4)),
      nomEnfant: "",
      prenomsEnfant: "",
      naissance: "Unique",
      vivant: !/mort|deced|décéd/i.test(a.etatEnfant || ""),
      mere: { ...personneVide(), nom: m.nom, prenoms: m.prenoms, contact: cpnMere?.contact || "" },
      pere: personneVide(),
      declarantNom: "",
      declarantLien: "Père",
      statut: "Établie",
      dateEtablissement: getTodayStr(),
      etabliePar: currentUser?.nom || "",
    };
  });

  const set = (patch: Partial<DeclarationNaissance>) => setD((x) => ({ ...x, ...patch }));
  const setP = (qui: "mere" | "pere", patch: Partial<PersonneDeclaration>) => setD((x) => ({ ...x, [qui]: { ...x[qui], ...patch } }));

  const valider = (): DeclarationNaissance | null => {
    const manque: string[] = [];
    if (!d.nomEnfant.trim()) manque.push("nom de l'enfant");
    if (d.vivant && !d.prenomsEnfant.trim()) manque.push("prénom(s) de l'enfant");
    if (!d.mere.nom.trim()) manque.push("nom de la mère");
    if (!d.pereNonDeclare && !d.pere.nom.trim()) manque.push("nom du père (ou cochez « père non déclaré »)");
    if (!d.declarantNom.trim()) manque.push("nom du déclarant");
    if (manque.length) {
      alert("Veuillez compléter : " + manque.join(", ") + ".");
      return null;
    }
    const propre: DeclarationNaissance = JSON.parse(JSON.stringify(d)); // retire les undefined (synchro cloud)
    return propre;
  };

  const enregistrer = (imprimer: boolean) => {
    const ok = valider();
    if (!ok) return;
    onSave(ok);
    if (imprimer) imprimerDeclaration(a, ok, staff);
    onClose();
  };

  const input = "w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none";
  const lbl = "text-xs uppercase font-semibold tracking-wider text-stone-500 block mb-1";
  const accoucheuse = staff.find((s) => s.id === a.sageFemmeId);

  const blocPersonne = (qui: "mere" | "pere", titre: string) => {
    const x = d[qui];
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-pink-700">{titre}</h4>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lbl}>Nom *</label><input className={input} value={x.nom} onChange={(e) => setP(qui, { nom: e.target.value })} /></div>
          <div><label className={lbl}>Prénom(s)</label><input className={input} value={x.prenoms} onChange={(e) => setP(qui, { prenoms: e.target.value })} /></div>
          <div><label className={lbl}>Date de naissance</label><input type="date" className={input} value={x.dateNaissance || ""} onChange={(e) => setP(qui, { dateNaissance: e.target.value })} /></div>
          <div><label className={lbl}>ou âge (ans)</label><input type="number" min={10} className={input} value={x.age || ""} onChange={(e) => setP(qui, { age: e.target.value })} /></div>
          <div><label className={lbl}>Profession</label><input className={input} value={x.profession || ""} onChange={(e) => setP(qui, { profession: e.target.value })} /></div>
          <div><label className={lbl}>Nationalité</label><input className={input} value={x.nationalite || ""} onChange={(e) => setP(qui, { nationalite: e.target.value })} /></div>
          <div className="col-span-2"><label className={lbl}>Domicile (secteur / village, commune)</label><input className={input} value={x.domicile || ""} onChange={(e) => setP(qui, { domicile: e.target.value })} /></div>
          <div><label className={lbl}>Pièce d'identité (type et N°)</label><input className={input} placeholder="Ex: CNIB B1234567" value={x.pieceIdentite || ""} onChange={(e) => setP(qui, { pieceIdentite: e.target.value })} /></div>
          <div><label className={lbl}>Contact</label><input className={input} value={x.contact || ""} onChange={(e) => setP(qui, { contact: e.target.value })} /></div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl shadow-xl border border-stone-200 bg-white overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-4 border-b border-stone-100 flex justify-between items-center">
          <h3 className="font-serif font-bold text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-pink-600" />
            Déclaration de naissance — N° {d.numero}
          </h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="rounded-xl bg-pink-50 border border-pink-200 p-3 text-xs text-stone-700 grid grid-cols-2 sm:grid-cols-3 gap-1">
            <div><b>Mère :</b> {a.patient}</div>
            <div><b>Né(e) le :</b> {new Date(a.date + "T00:00:00").toLocaleDateString("fr-FR")} à {a.heure}</div>
            <div><b>Sexe :</b> {a.sexeEnfant}</div>
            <div><b>Poids :</b> {a.poidsEnfant} g</div>
            <div><b>Mode :</b> {a.mode}</div>
            <div><b>Accoucheuse :</b> {accoucheuse?.nom || "—"}</div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-pink-700">L'enfant</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><label className={lbl}>Nom *</label><input className={input} value={d.nomEnfant} onChange={(e) => set({ nomEnfant: e.target.value })} /></div>
              <div className="sm:col-span-2"><label className={lbl}>Prénom(s) {d.vivant ? "*" : ""}</label><input className={input} value={d.prenomsEnfant} onChange={(e) => set({ prenomsEnfant: e.target.value })} /></div>
              <div><label className={lbl}>Taille (cm)</label><input type="number" className={input} value={d.taille ?? ""} onChange={(e) => set({ taille: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
              <div><label className={lbl}>Périmètre crânien (cm)</label><input type="number" className={input} value={d.perimetreCranien ?? ""} onChange={(e) => set({ perimetreCranien: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
              <div>
                <label className={lbl}>Naissance</label>
                <select className={input} value={d.naissance} onChange={(e) => set({ naissance: e.target.value as DeclarationNaissance["naissance"] })}>
                  <option value="Unique">Unique</option>
                  <option value="Gémellaire">Gémellaire (jumeaux)</option>
                  <option value="Multiple">Multiple (triplés ou plus)</option>
                </select>
              </div>
              {d.naissance !== "Unique" && (
                <div><label className={lbl}>Rang</label><input className={input} placeholder="Ex: 1er jumeau" value={d.rang || ""} onChange={(e) => set({ rang: e.target.value })} /></div>
              )}
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 pb-2">
                  <input type="checkbox" checked={!d.vivant} onChange={(e) => set({ vivant: !e.target.checked })} /> Enfant mort-né
                </label>
              </div>
            </div>
          </div>

          {blocPersonne("mere", "La mère")}

          <label className="flex items-center gap-2 text-xs font-semibold text-stone-700">
            <input type="checkbox" checked={!!d.pereNonDeclare} onChange={(e) => set({ pereNonDeclare: e.target.checked })} /> Père non déclaré
          </label>
          {!d.pereNonDeclare && blocPersonne("pere", "Le père")}

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-pink-700">Le déclarant</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-1 col-span-2"><label className={lbl}>Nom et prénom(s) *</label><input className={input} value={d.declarantNom} onChange={(e) => set({ declarantNom: e.target.value })} /></div>
              <div>
                <label className={lbl}>Lien avec l'enfant</label>
                <select className={input} value={d.declarantLien} onChange={(e) => set({ declarantLien: e.target.value })}>
                  {["Père", "Mère", "Grand-parent", "Oncle / tante", "Autre parent", "Autre"].map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Contact</label><input className={input} value={d.declarantContact || ""} onChange={(e) => set({ declarantContact: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!d.pereNonDeclare && d.pere.nom && (
                <button type="button" className="text-xs font-semibold text-pink-700 underline" onClick={() => set({ declarantNom: `${d.pere.nom} ${d.pere.prenoms}`.trim(), declarantLien: "Père", declarantContact: d.pere.contact || d.declarantContact })}>Le père est le déclarant</button>
              )}
              {d.mere.nom && (
                <button type="button" className="text-xs font-semibold text-pink-700 underline" onClick={() => set({ declarantNom: `${d.mere.nom} ${d.mere.prenoms}`.trim(), declarantLien: "Mère", declarantContact: d.mere.contact || d.declarantContact })}>La mère est la déclarante</button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className={lbl}>Suivi</label>
              <select className={input} value={d.statut} onChange={(e) => {
                const statut = e.target.value as DeclarationNaissance["statut"];
                set({
                  statut,
                  dateRemise: statut !== "Établie" ? d.dateRemise || getTodayStr() : d.dateRemise,
                  dateTransmission: statut === "Transmise à l'état civil" ? d.dateTransmission || getTodayStr() : d.dateTransmission,
                });
              }}>
                <option>Établie</option>
                <option>Remise aux parents</option>
                <option>Transmise à l'état civil</option>
              </select>
            </div>
            <div><label className={lbl}>Date d'établissement</label><input type="date" className={input} value={d.dateEtablissement} onChange={(e) => set({ dateEtablissement: e.target.value })} /></div>
            {d.statut !== "Établie" && (
              <div><label className={lbl}>Remise aux parents le</label><input type="date" className={input} value={d.dateRemise || ""} onChange={(e) => set({ dateRemise: e.target.value })} /></div>
            )}
            <div className="col-span-2 sm:col-span-3"><label className={lbl}>Observations</label><input className={input} value={d.observations || ""} onChange={(e) => set({ observations: e.target.value })} /></div>
          </div>
        </div>

        <div className="p-4 border-t border-stone-100 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold rounded-lg border border-stone-300 text-stone-700">Fermer</button>
          <button type="button" onClick={() => enregistrer(false)} className="px-3 py-2 text-xs font-bold rounded-lg border border-pink-600 text-pink-700 flex items-center gap-1.5"><Save className="w-4 h-4" /> Enregistrer</button>
          <button type="button" onClick={() => enregistrer(true)} className="px-3 py-2 text-xs font-bold rounded-lg bg-pink-600 hover:bg-pink-700 text-white flex items-center gap-1.5"><Printer className="w-4 h-4" /> Enregistrer et imprimer</button>
        </div>
      </div>
    </div>
  );
}
