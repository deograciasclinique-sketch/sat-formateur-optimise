/**
 * Déclaration de naissance — salle d'accouchement.
 *
 * Le document imprimé reprend exactement le modèle du cabinet (en-tête
 * Ministère / District sanitaire de Dô, N° = date de naissance, texte
 * « Je soussigné… déclare avoir donné des soins à… »).
 *
 * Les autres informations de la naissance (identité de l'enfant, père,
 * déclarant, mensurations…) sont enregistrées avec la naissance dans le
 * registre, mais ne sont pas imprimées sur la déclaration.
 */

import React, { useMemo, useState } from "react";
import { X, Printer, Save, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Accouchement, ConsultationPrenatale, DeclarationNaissance, PersonneDeclaration, Staff } from "../types";
import { getTodayStr } from "../data";

// En-tête du modèle officiel du cabinet.
const EN_TETE = {
  gauche: ["MINISTERE DE LA SANTE", "DIRECTION REGIONALE DE LA SANTE", "DISTRICT SANITAIRE DE DO", "« DEO - GRACIAS »", "Secteur 10 Yeguere Rue de l'habitat porte n°363 / 76404327"],
  pays: "BURKINA FASO",
  devise: "Unité-Progrès-Justice",
  etablissement: "CABINET DE SOINS DEO GRACIAS",
  ville: "Bobo",
};

const personneVide = (): PersonneDeclaration => ({ nom: "", prenoms: "", nationalite: "Burkinabè" });

/** N° = date de naissance JJMMAAAA (ex. 07032026) ; -2, -3… si plusieurs naissances le même jour. */
export function prochainNumeroDeclaration(accouchements: Accouchement[], dateIso: string, exclureId?: string): string {
  const [y, m, d] = (dateIso || getTodayStr()).split("-");
  const base = `${d}${m}${y}`;
  const pris = new Set(accouchements.filter((a) => a.id !== exclureId).map((a) => a.declarationNaissance?.numero).filter(Boolean));
  if (!pris.has(base)) return base;
  let i = 2;
  while (pris.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

const UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const DIZAINES: Record<number, string> = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante" };
/** Nombre en lettres (0 à 59). */
export function enLettres(n: number, feminin = false): string {
  if (n === 1) return feminin ? "une" : "un";
  if (n < 20) return UNITES[n];
  const dz = Math.floor(n / 10), u = n % 10;
  if (u === 0) return DIZAINES[dz];
  if (u === 1) return `${DIZAINES[dz]}-et-${feminin ? "une" : "un"}`;
  return `${DIZAINES[dz]}-${UNITES[u]}`;
}

/** "07:35" → "07h (sept) heures 35 (trente-cinq) minutes" */
export function heureEnToutesLettres(hhmm?: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return hhmm || "";
  const h = parseInt(m[1], 10), mn = parseInt(m[2], 10);
  const hh = String(h).padStart(2, "0"), mm = String(mn).padStart(2, "0");
  return `${hh}h (${enLettres(h, true)}) heure${h > 1 ? "s" : ""}${mn ? ` ${mm} (${enLettres(mn, true)}) minute${mn > 1 ? "s" : ""}` : ""}`;
}

const esc = (s?: string | number) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const dateFr = (iso?: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** Sépare "Bah Djènèba" en nom / prénoms (premier mot = nom). */
const decouperNom = (complet: string): { nom: string; prenoms: string } => {
  const t = (complet || "").replace(/^(madame|mme|mlle|mademoiselle)\.?\s+/i, "").trim().split(/\s+/);
  return { nom: t[0] || "", prenoms: t.slice(1).join(" ") };
};

export function imprimerDeclaration(a: Accouchement, d: DeclarationNaissance, staff: Staff[]) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("La fenêtre d'impression est bloquée. Veuillez autoriser les pop-ups pour cette application.");
    return;
  }
  const agent = staff.find((s) => s.id === (d.declarantAgentId || a.sageFemmeId));
  const nomAgent = d.declarantAgentNom || agent?.nom || "……………………";
  const fonction = (d.declarantAgentFonction || agent?.poste || "sage-femme").toLowerCase();
  const fille = a.sexeEnfant === "Féminin";
  const etat = d.vivant ? (fille ? "Née vivante" : "Né vivant") : fille ? "Mort-née" : "Mort-né";
  const mere = `${(d.mere.nom || "").toUpperCase()} ${d.mere.prenoms || ""}`.trim();
  const neeLe = [d.mere.dateNaissance ? dateFr(d.mere.dateNaissance) : "", d.mere.lieuNaissance ? `à ${d.mere.lieuNaissance.toUpperCase()}` : ""].filter(Boolean).join(" ");

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Déclaration de naissance N° ${esc(d.numero)}</title>
    <style>
      @page{size:A4;margin:18mm 18mm}
      @media screen{body{padding:18mm;max-width:210mm}}
      body{font-family:Calibri,Carlito,Arial,sans-serif;color:#000;font-size:15px;margin:0}
      .entete{display:flex;justify-content:space-between;align-items:flex-start}
      .g div{font-weight:bold;line-height:1.55}
      .g div:last-child{font-weight:bold}
      .d{text-align:center;font-weight:bold;line-height:1.55}
      .d .lieu{margin-top:30px}
      h1{text-align:center;font-size:16px;text-decoration:underline;margin:34px 0 22px;font-weight:bold}
      p{margin:0;line-height:1.75}
      .bas{display:flex;justify-content:flex-end;margin-top:36px}
      .bas div{width:45%;text-align:center;min-height:120px}
    </style></head><body>
    <div class="entete">
      <div class="g">${EN_TETE.gauche.map((l) => `<div>${esc(l)}</div>`).join("")}</div>
      <div class="d">
        <div>${esc(EN_TETE.pays)}</div>
        <div>${esc(EN_TETE.devise)}</div>
        <div class="lieu">${esc(d.lieuSignature || EN_TETE.ville)}, le ${esc(dateFr(d.dateEtablissement))}</div>
      </div>
    </div>
    <h1>DECLARATION DE NAISSANCE N° ${esc(d.numero)}</h1>
    <p>Je soussigné${d.declarantAgentCivilite === "M." ? "" : "e"} ${esc(d.declarantAgentCivilite || "Mme")} <b>${esc(nomAgent)}</b> ${esc(fonction)}</p>
    <p>En service à la maternité du <b><i>${esc(EN_TETE.etablissement)}</i></b>, déclare avoir donné des soins à</p>
    <p>Madame : <b>${esc(mere)}</b></p>
    <p>Née le : ${esc(neeLe)}</p>
    <p>Qui a accouché le <b><i>${esc(dateFr(a.date))} à ${esc(heureEnToutesLettres(a.heure))}</i></b></p>
    <p>D'un enfant de sexe <b><i>${fille ? "FÉMININ" : "MASCULIN"}</i></b></p>
    <p><b><i>${etat}</i></b></p>
    <div class="bas"><div></div></div>
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

  const agentsPossibles = staff.filter((s) => /sage|m[ée]decin|infirm|accouch/i.test(s.poste || ""));

  const [d, setD] = useState<DeclarationNaissance>(() => {
    const agent = staff.find((s) => s.id === a.sageFemmeId) || (currentUser && /sage/i.test(currentUser.poste || "") ? currentUser : undefined);
    const m = decouperNom(a.patient);
    const base: DeclarationNaissance = {
      numero: prochainNumeroDeclaration(accouchements, a.date, a.id),
      declarantAgentId: agent?.id || "",
      declarantAgentNom: agent?.nom || "",
      declarantAgentCivilite: "Mme",
      declarantAgentFonction: agent?.poste ? agent.poste.toLowerCase() : "sage-femme",
      lieuSignature: EN_TETE.ville,
      nomEnfant: "",
      prenomsEnfant: "",
      naissance: "Unique",
      vivant: !/mort|deced|décéd/i.test(a.etatEnfant || ""),
      mere: { ...personneVide(), nom: m.nom, prenoms: m.prenoms, contact: cpnMere?.contact || "" },
      pere: personneVide(),
      declarantNom: "",
      declarantLien: "Père",
      statut: "Établie",
      dateEtablissement: a.date || getTodayStr(),
      etabliePar: currentUser?.nom || "",
    };
    // Déclarations établies avec l'ancien modèle : on complète les nouveaux champs.
    return existante ? { ...base, ...existante, mere: { ...base.mere, ...existante.mere }, pere: { ...base.pere, ...existante.pere } } : base;
  });
  const [plus, setPlus] = useState(false);

  // N° automatique (non modifiable) : date de naissance JJMMAAAA, suffixe -2, -3…
  // si plusieurs naissances le même jour. Recalculé à l'enregistrement à partir
  // de la liste à jour, pour éviter deux fois le même numéro.
  const [j, mo, an] = [a.date.slice(8, 10), a.date.slice(5, 7), a.date.slice(0, 4)];
  const baseNumero = `${j}${mo}${an}`;
  const numeroExistantValide =
    !!existante?.numero &&
    (existante.numero === baseNumero || existante.numero.startsWith(`${baseNumero}-`)) &&
    !accouchements.some((x) => x.id !== a.id && x.declarationNaissance?.numero === existante.numero);
  const numeroAuto = numeroExistantValide ? existante!.numero : prochainNumeroDeclaration(accouchements, a.date, a.id);

  const set = (patch: Partial<DeclarationNaissance>) => setD((x) => ({ ...x, ...patch }));
  const setP = (qui: "mere" | "pere", patch: Partial<PersonneDeclaration>) => setD((x) => ({ ...x, [qui]: { ...x[qui], ...patch } }));

  const valider = (): DeclarationNaissance | null => {
    const manque: string[] = [];
    if (!(d.declarantAgentNom || "").trim()) manque.push("nom de la sage-femme / de l'accoucheur");
    if (!d.mere.nom.trim()) manque.push("nom de la mère");
    if (!d.mere.dateNaissance) manque.push("date de naissance de la mère");
    if (!(d.mere.lieuNaissance || "").trim()) manque.push("lieu de naissance de la mère");
    if (manque.length) {
      alert("Veuillez compléter : " + manque.join(", ") + ".");
      return null;
    }
    return JSON.parse(JSON.stringify({ ...d, numero: numeroAuto })); // retire les undefined (synchro cloud)
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

  const blocPersonne = (qui: "mere" | "pere", titre: string) => {
    const x = d[qui];
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-pink-700">{titre}</h4>
        <div className="grid grid-cols-2 gap-2">
          {qui === "pere" && (
            <>
              <div><label className={lbl}>Nom</label><input className={input} value={x.nom} onChange={(e) => setP(qui, { nom: e.target.value })} /></div>
              <div><label className={lbl}>Prénom(s)</label><input className={input} value={x.prenoms} onChange={(e) => setP(qui, { prenoms: e.target.value })} /></div>
              <div><label className={lbl}>Date de naissance</label><input type="date" className={input} value={x.dateNaissance || ""} onChange={(e) => setP(qui, { dateNaissance: e.target.value })} /></div>
              <div><label className={lbl}>Lieu de naissance</label><input className={input} value={x.lieuNaissance || ""} onChange={(e) => setP(qui, { lieuNaissance: e.target.value })} /></div>
            </>
          )}
          <div><label className={lbl}>Profession</label><input className={input} value={x.profession || ""} onChange={(e) => setP(qui, { profession: e.target.value })} /></div>
          <div><label className={lbl}>Nationalité</label><input className={input} value={x.nationalite || ""} onChange={(e) => setP(qui, { nationalite: e.target.value })} /></div>
          <div className="col-span-2"><label className={lbl}>Domicile (secteur / village, commune)</label><input className={input} value={x.domicile || ""} onChange={(e) => setP(qui, { domicile: e.target.value })} /></div>
          <div><label className={lbl}>Pièce d'identité (type et N°)</label><input className={input} placeholder="Ex: CNIB B1234567" value={x.pieceIdentite || ""} onChange={(e) => setP(qui, { pieceIdentite: e.target.value })} /></div>
          <div><label className={lbl}>Contact</label><input className={input} value={x.contact || ""} onChange={(e) => setP(qui, { contact: e.target.value })} /></div>
        </div>
      </div>
    );
  };

  const fille = a.sexeEnfant === "Féminin";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl shadow-xl border border-stone-200 bg-white overflow-hidden max-h-[92vh] flex flex-col">
        <div className="p-4 border-b border-stone-100 flex justify-between items-center">
          <h3 className="font-serif font-bold text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-pink-600" />
            Déclaration de naissance — {a.patient}
          </h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* --- Ce qui figure sur la déclaration imprimée --- */}
          <div className="rounded-xl border-2 border-pink-200 p-3 space-y-3">
            <div className="text-xs font-bold uppercase text-pink-800">Imprimé sur la déclaration</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label className={lbl}>N° de la déclaration (automatique)</label>
                <div className="text-sm font-bold font-mono text-pink-800 px-3 py-1.5 rounded-lg bg-pink-50 border border-pink-200">{numeroAuto}</div>
              </div>
              <div><label className={lbl}>Fait à</label><input className={input} value={d.lieuSignature || ""} onChange={(e) => set({ lieuSignature: e.target.value })} /></div>
              <div><label className={lbl}>Le</label><input type="date" className={input} value={d.dateEtablissement} onChange={(e) => set({ dateEtablissement: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className={lbl}>Civilité</label>
                <select className={input} value={d.declarantAgentCivilite || "Mme"} onChange={(e) => set({ declarantAgentCivilite: e.target.value as DeclarationNaissance["declarantAgentCivilite"] })}>
                  <option>Mme</option><option>Mlle</option><option>M.</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Je soussigné(e) — sage-femme / accoucheur *</label>
                <select className={input} value={d.declarantAgentId || ""} onChange={(e) => {
                  const s = staff.find((x) => x.id === e.target.value);
                  set({ declarantAgentId: e.target.value, declarantAgentNom: s?.nom || d.declarantAgentNom, declarantAgentFonction: s?.poste ? s.poste.toLowerCase() : d.declarantAgentFonction });
                }}>
                  <option value="">— Choisir —</option>
                  {agentsPossibles.map((s) => <option key={s.id} value={s.id}>{s.nom} ({s.poste})</option>)}
                </select>
                <input className={`${input} mt-1`} placeholder="ou saisir le nom (ex. ZOURE Abibata)" value={d.declarantAgentNom || ""} onChange={(e) => set({ declarantAgentNom: e.target.value })} />
              </div>
              <div><label className={lbl}>Fonction</label><input className={input} value={d.declarantAgentFonction || ""} onChange={(e) => set({ declarantAgentFonction: e.target.value })} /></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><label className={lbl}>Madame — nom *</label><input className={input} value={d.mere.nom} onChange={(e) => setP("mere", { nom: e.target.value })} /></div>
              <div><label className={lbl}>Prénom(s)</label><input className={input} value={d.mere.prenoms} onChange={(e) => setP("mere", { prenoms: e.target.value })} /></div>
              <div><label className={lbl}>Née le *</label><input type="date" className={input} value={d.mere.dateNaissance || ""} onChange={(e) => setP("mere", { dateNaissance: e.target.value })} /></div>
              <div><label className={lbl}>à *</label><input className={input} placeholder="Ex: Koumassi/CIV" value={d.mere.lieuNaissance || ""} onChange={(e) => setP("mere", { lieuNaissance: e.target.value })} /></div>
            </div>

            <div className="text-xs text-stone-700 bg-pink-50 rounded-lg p-2 space-y-0.5">
              <div>Qui a accouché le <b>{dateFr(a.date)} à {heureEnToutesLettres(a.heure)}</b></div>
              <div>D'un enfant de sexe <b>{fille ? "FÉMININ" : "MASCULIN"}</b> <span className="text-stone-500">(repris de l'enregistrement de la naissance)</span></div>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-stone-700">
              <input type="checkbox" checked={!d.vivant} onChange={(e) => set({ vivant: !e.target.checked })} />
              Enfant {fille ? "mort-née" : "mort-né"} (sinon : « {fille ? "Née vivante" : "Né vivant"} »)
            </label>
          </div>

          {/* --- Le reste : enregistré avec la naissance, non imprimé --- */}
          <div className="rounded-xl border border-stone-200">
            <button type="button" onClick={() => setPlus(!plus)} className="w-full p-3 flex items-center justify-between text-left">
              <span className="text-xs font-bold uppercase text-stone-600">Autres informations de la naissance (registre — non imprimées)</span>
              {plus ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {plus && (
              <div className="p-3 pt-0 space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-pink-700">L'enfant</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div><label className={lbl}>Nom</label><input className={input} value={d.nomEnfant} onChange={(e) => set({ nomEnfant: e.target.value })} /></div>
                    <div className="sm:col-span-2"><label className={lbl}>Prénom(s)</label><input className={input} value={d.prenomsEnfant} onChange={(e) => set({ prenomsEnfant: e.target.value })} /></div>
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
                  </div>
                </div>

                {blocPersonne("mere", "La mère (compléments)")}

                <label className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                  <input type="checkbox" checked={!!d.pereNonDeclare} onChange={(e) => set({ pereNonDeclare: e.target.checked })} /> Père non déclaré
                </label>
                {!d.pereNonDeclare && blocPersonne("pere", "Le père")}

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-pink-700">Le déclarant à l'état civil</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="col-span-2 sm:col-span-1"><label className={lbl}>Nom et prénom(s)</label><input className={input} value={d.declarantNom} onChange={(e) => set({ declarantNom: e.target.value })} /></div>
                    <div>
                      <label className={lbl}>Lien avec l'enfant</label>
                      <select className={input} value={d.declarantLien} onChange={(e) => set({ declarantLien: e.target.value })}>
                        {["Père", "Mère", "Grand-parent", "Oncle / tante", "Autre parent", "Autre"].map((l) => <option key={l}>{l}</option>)}
                      </select>
                    </div>
                    <div><label className={lbl}>Contact</label><input className={input} value={d.declarantContact || ""} onChange={(e) => set({ declarantContact: e.target.value })} /></div>
                  </div>
                </div>

                <div><label className={lbl}>Observations</label><input className={input} value={d.observations || ""} onChange={(e) => set({ observations: e.target.value })} /></div>
              </div>
            )}
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
            {d.statut !== "Établie" && (
              <div><label className={lbl}>Remise aux parents le</label><input type="date" className={input} value={d.dateRemise || ""} onChange={(e) => set({ dateRemise: e.target.value })} /></div>
            )}
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
