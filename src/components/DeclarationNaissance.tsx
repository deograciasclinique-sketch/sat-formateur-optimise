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
import { X, Printer, Save, FileText, ChevronDown, ChevronUp, Send, Settings2, RotateCcw } from "lucide-react";
import { jsPDF } from "jspdf";
import { Accouchement, ConsultationPrenatale, DeclarationNaissance, PersonneDeclaration, Staff } from "../types";
import { getTodayStr, getClinicProfile, safeGet } from "../data";
import { PatientRegistre, normNom, tel8, normaliserCode, estUnCode } from "../lib/patients";
import { COMMERCIAL } from "../lib/edition";
import { formatWhatsAppNumber } from "../lib/whatsapp";
import { useCloudSyncedState } from "../lib/useCloudSyncedState";

// ---------------------------------------------------------------------------
// MODÈLE DE LA DÉCLARATION (en-tête + formulation) — paramétrable par établissement.
// Par défaut (édition cabinet) : modèle officiel du Cabinet DEO-GRACIAS, District
// sanitaire de Dô (Bobo-Dioulasso). Dans les éditions vendues, l'en-tête part du
// profil de la clinique cliente ; chaque clinique ajuste ses réglages (synchro cloud).
// ---------------------------------------------------------------------------
export interface ModeleDeclaration {
  ministere: string;
  direction: string;
  district: string;
  etablissement: string;   // ligne « « DEO - GRACIAS » » de l'en-tête
  adresse: string;
  pays: string;
  devise: string;
  ville: string;           // « Bobo, le … »
  structure: string;       // « En service au CABINET DE SOINS DEO GRACIAS »
  formatNumero: "code-patient" | "initiales-date" | "date";
  deuxExemplaires: boolean; // 2 exemplaires sur la même feuille A4 (à découper)
}

/** Devises nationales (pays du Burkina et de la sous-région). */
export const PAYS_DEVISES: [string, string][] = [
  ["BURKINA FASO", "La Patrie ou la Mort, nous Vaincrons"],
  ["REPUBLIQUE DE CÔTE D'IVOIRE", "Union – Discipline – Travail"],
  ["REPUBLIQUE DU MALI", "Un Peuple – Un But – Une Foi"],
  ["REPUBLIQUE DU NIGER", "Fraternité – Travail – Progrès"],
  ["REPUBLIQUE DU SENEGAL", "Un Peuple – Un But – Une Foi"],
  ["REPUBLIQUE TOGOLAISE", "Travail – Liberté – Patrie"],
  ["REPUBLIQUE DU BENIN", "Fraternité – Justice – Travail"],
  ["REPUBLIQUE DE GUINEE", "Travail – Justice – Solidarité"],
];

export function modeleParDefaut(): ModeleDeclaration {
  const commun = {
    ministere: "MINISTERE DE LA SANTE",
    direction: "DIRECTION REGIONALE DE LA SANTE",
    pays: PAYS_DEVISES[0][0],
    devise: PAYS_DEVISES[0][1],
    formatNumero: "code-patient" as const,
    deuxExemplaires: true,
  };
  if (COMMERCIAL) {
    const p = getClinicProfile();
    const nom = (p.name || "Ma clinique").trim();
    return {
      ...commun,
      district: "DISTRICT SANITAIRE DE ……………",
      etablissement: `« ${nom.toUpperCase()} »`,
      adresse: p.address || "",
      ville: (p.address || "").split(",")[0].trim() || "……………",
      structure: nom.toUpperCase(),
    };
  }
  return {
    ...commun,
    district: "DISTRICT SANITAIRE DE DO",
    etablissement: "« DEO - GRACIAS »",
    adresse: "Secteur 10 Yeguere",
    ville: "Bobo",
    structure: "CABINET DE SOINS DEO GRACIAS",
  };
}

/** Réglages enregistrés (seulement ce que l'établissement a modifié). */
export const CLE_MODELE = "dg_modele_declaration_naissance";
export function lireModele(surcharges?: Partial<ModeleDeclaration> | null): ModeleDeclaration {
  let s = surcharges;
  if (s === undefined) {
    try { s = JSON.parse(localStorage.getItem(CLE_MODELE) || "null"); } catch { s = null; }
  }
  return { ...modeleParDefaut(), ...(s || {}) };
}
const lignesEnTete = (m: ModeleDeclaration) => [m.ministere, m.direction, m.district, m.etablissement, m.adresse].filter((l) => (l || "").trim());

const personneVide = (): PersonneDeclaration => ({ nom: "", prenoms: "", nationalite: "Burkinabè" });

/** Initiales de la maman : 1re lettre du nom + 1re lettre du prénom (ex. BAH Djènèba → "BD"). */
export function initialesMere(nom?: string, prenoms?: string): string {
  const ini = (x?: string) => (x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase();
  return ini(nom) + ini(prenoms);
}

/**
 * N° = initiales de la maman + date de naissance JJMMAAAA (ex. BD07032026) ;
 * -2, -3… si le même numéro existe déjà.
 */
/** Premier numéro libre à partir d'une base (suffixe -2, -3… si déjà pris par une autre naissance). */
function numeroLibre(accouchements: Accouchement[], base: string, exclureId?: string): string {
  const pris = new Set(accouchements.filter((a) => a.id !== exclureId).map((a) => a.declarationNaissance?.numero).filter(Boolean));
  if (!pris.has(base)) return base;
  let i = 2;
  while (pris.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/** Code patient de la maman dans le registre des patients (même nom, et même téléphone s'il est connu). */
export function codePatientMere(nomComplet: string, contact?: string): string {
  const registre = safeGet<PatientRegistre[]>("dg_patients", []);
  const n = normNom(nomComplet), t = tel8(contact);
  if (!n) return "";
  const memeNom = registre.filter((p) => normNom(p.nom) === n);
  const avecTel = t ? memeNom.filter((p) => tel8(p.contact) === t) : [];
  if (avecTel.length === 1) return avecTel[0].code;
  return memeNom.length === 1 ? memeNom[0].code : "";
}

export function prochainNumeroDeclaration(accouchements: Accouchement[], dateIso: string, exclureId?: string, initiales = ""): string {
  const [y, m, d] = (dateIso || getTodayStr()).split("-");
  const base = `${initiales}${d}${m}${y}`;
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

/** "12:21" → "12h (douze) 21 (vingt et un) minutes" (comme le modèle du service). */
export function heureEnToutesLettres(hhmm?: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return hhmm || "";
  const h = parseInt(m[1], 10), mn = parseInt(m[2], 10);
  const lettres = (n: number) => enLettres(n, true).replace(/-et-/, " et ");
  const hh = String(h).padStart(2, "0"), mm = String(mn).padStart(2, "0");
  return `${hh}h (${lettres(h)})${mn ? ` ${mm} (${lettres(mn)}) minute${mn > 1 ? "s" : ""}` : ""}`;
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

const POINTS = "……………………………";
const majuscule1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type Style = "n" | "bi"; // normal | gras italique
type Ligne = [string, Style][];

/**
 * Lignes de la déclaration, mot pour mot comme le modèle du service
 * (seuls les noms, dates et heure changent). Communes à l'impression, au
 * PDF et au message WhatsApp.
 */
function contenu(a: Accouchement, d: DeclarationNaissance, staff: Staff[], m: ModeleDeclaration = lireModele()) {
  const agent = staff.find((s) => s.id === (d.declarantAgentId || a.sageFemmeId));
  const nomAgent = d.declarantAgentNom || agent?.nom || POINTS;
  const fonction = majuscule1(d.declarantAgentFonction || agent?.poste || "sage-femme");
  const fille = a.sexeEnfant === "Féminin";
  const mere = `${(d.mere.nom || "").toUpperCase()} ${d.mere.prenoms || ""}`.trim();
  const neeLe = `${d.mere.dateNaissance ? dateFr(d.mere.dateNaissance) : "……/……/…………"} à ${d.mere.lieuNaissance || POINTS}`;
  const civ = d.declarantAgentCivilite || "Mme";
  const vivant = d.vivant !== false;
  const lignes: Ligne[] = [
    [[`Je soussigné ${civ} ${nomAgent} ${fonction}`, "n"]],
    [["En service au ", "n"], [m.structure, "bi"], [", déclare avoir donné des soins à", "n"]],
    [[`Madame ${mere || POINTS + POINTS}`, "n"]],
    [[`Née le : ${neeLe}`, "n"]],
    [["Qui a accouchée le ", "n"], [`${a.date ? dateFr(a.date) : "……/……/…………"} à ${a.heure ? heureEnToutesLettres(a.heure) : "……h (……………) …… (……………) minutes"}`, "bi"]],
    [["D'un enfant de sexe ", "n"], [fille ? "féminin" : "masculin", "bi"]],
    vivant
      ? [[fille ? "Née " : "Né ", "n"], [fille ? "vivante." : "vivant.", "bi"]]
      : [[fille ? "Mort-née." : "Mort-né.", "bi"]],
  ];
  return { lignes, lieu: d.lieuSignature || m.ville, m };
}

/** Déclaration au format PDF (même mise en page que l'impression : 1 ou 2 exemplaires par A4). */
export function genererPdfDeclaration(a: Accouchement, d: DeclarationNaissance, staff: Staff[], modele?: ModeleDeclaration): Blob {
  const c = contenu(a, d, staff, modele || lireModele());
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const X = 22, L = 210 - 22, XD = 158;
  const exemplaire = (y0: number) => {
    const gauche = lignesEnTete(c.m);
    doc.setFont("helvetica", "bold").setFontSize(11);
    gauche.forEach((l, i) => doc.text(l, X, y0 + i * 5.5));
    doc.text(c.m.pays, XD, y0, { align: "center" });
    const devise = doc.splitTextToSize(c.m.devise, 72) as string[];
    devise.forEach((l, i) => doc.text(l, XD, y0 + 5.5 * (i + 1), { align: "center" }));
    doc.text(`${c.lieu}, le ${dateFr(d.dateEtablissement)}`, XD, y0 + 5.5 * (gauche.length - 1), { align: "center" });
    doc.setFontSize(12);
    const titre = `DECLARATION DE NAISSANCE N° ${d.numero}`;
    const yt = y0 + 5.5 * gauche.length + 9;
    doc.text(titre, 105, yt, { align: "center" });
    const tw = doc.getTextWidth(titre);
    doc.setLineWidth(0.3).line(105 - tw / 2, yt + 1, 105 + tw / 2, yt + 1);
    let y = yt + 12;
    c.lignes.forEach((ligne) => {
      let x = X;
      ligne.forEach(([t, style]) => {
        doc.setFont("helvetica", style === "bi" ? "bolditalic" : "normal");
        const morceaux = doc.splitTextToSize(t, L - x) as string[];
        doc.text(morceaux[0], x, y);
        x += doc.getTextWidth(morceaux[0]);
        morceaux.slice(1).forEach((r) => { y += 7.5; x = X; doc.text(r, x, y); x += doc.getTextWidth(r); });
      });
      y += 7.5;
    });
  };
  exemplaire(20);
  if (c.m.deuxExemplaires) {
    doc.setLineDashPattern([1, 1.2], 0).setLineWidth(0.2).line(10, 148.5, 200, 148.5).setLineDashPattern([], 0);
    exemplaire(148.5 + 14);
  }
  return doc.output("blob");
}

/** Message WhatsApp accompagnant la déclaration. */
export function messageWhatsAppDeclaration(a: Accouchement, d: DeclarationNaissance, staff: Staff[], pour: "famille" | "etat", modele?: ModeleDeclaration): string {
  const c = contenu(a, d, staff, modele || lireModele());
  return [
    pour === "famille" ? "Bonjour," : "Bonjour, à l'attention du service de l'état civil,",
    "",
    ...lignesEnTete(c.m),
    `${c.m.pays} — ${c.m.devise}`,
    `${c.lieu}, le ${dateFr(d.dateEtablissement)}`,
    "",
    `*DECLARATION DE NAISSANCE N° ${d.numero}*`,
    "",
    ...c.lignes.map((l) => l.map(([t, st]) => (st === "bi" ? `*_${t.trim()}_*${t.endsWith(" ") ? " " : ""}` : t)).join("")),
    "",
    pour === "famille"
      ? "Présentez l'original signé et cacheté au centre d'état civil pour établir l'acte de naissance de l'enfant."
      : "Le document est joint (PDF).",
  ].join("\n");
}

/** Un exemplaire de la déclaration en HTML (impression et aperçu). */
function exemplaireHtml(a: Accouchement, d: DeclarationNaissance, staff: Staff[], m: ModeleDeclaration): string {
  const c = contenu(a, d, staff, m);
  const gauche = lignesEnTete(m);
  return `<div class="ex">
    <table class="entete"><tr>
      <td class="g">${gauche.map((l) => `<div>${esc(l)}</div>`).join("")}</td>
      <td class="d"><div>${esc(m.pays)}</div><div>${esc(m.devise)}</div><div class="lieu">${esc(c.lieu)}, le ${esc(dateFr(d.dateEtablissement))}</div></td>
    </tr></table>
    <h1>DECLARATION DE NAISSANCE N° ${esc(d.numero)}</h1>
    ${c.lignes.map((l) => `<p>${l.map(([t, st]) => (st === "bi" ? `<b><i>${esc(t)}</i></b>` : esc(t))).join("")}</p>`).join("\n    ")}
  </div>`;
}

/** Lignes d'une fiche vierge (à remplir à la main). */
function lignesVierges(m: ModeleDeclaration): Ligne[] {
  return [
    [[`Je soussigné(e) ${POINTS}${POINTS} ${POINTS}`, "n"]],
    [["En service au ", "n"], [m.structure, "bi"], [", déclare avoir donné des soins à", "n"]],
    [[`Madame ${POINTS}${POINTS}${POINTS}`, "n"]],
    [[`Née le : ……/……/………… à ${POINTS}${POINTS}`, "n"]],
    [["Qui a accouchée le ", "n"], ["……/……/………… à ……h (……………) …… (……………) minutes", "bi"]],
    [["D'un enfant de sexe ", "n"], [POINTS, "bi"]],
    [["Né(e) ", "n"], [POINTS, "bi"]],
  ];
}

/** Imprime une déclaration VIERGE (pointillés) avec l'en-tête de l'établissement. */
export function imprimerDeclarationVierge(modele?: ModeleDeclaration) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("La fenêtre d'impression est bloquée. Veuillez autoriser les pop-ups pour cette application.");
    return;
  }
  const m = modele || lireModele();
  const gauche = lignesEnTete(m);
  const un = `<div class="ex">
    <table class="entete"><tr>
      <td class="g">${gauche.map((l) => `<div>${esc(l)}</div>`).join("")}</td>
      <td class="d"><div>${esc(m.pays)}</div><div>${esc(m.devise)}</div><div class="lieu">${esc(m.ville)}, le ……/……/…………</div></td>
    </tr></table>
    <h1>DECLARATION DE NAISSANCE N° ………………………</h1>
    ${lignesVierges(m).map((l) => `<p>${l.map(([t, st]) => (st === "bi" ? `<b><i>${esc(t)}</i></b>` : esc(t))).join("")}</p>`).join("\n    ")}
  </div>`;
  ecrireImpression(w, "Déclaration de naissance (fiche vierge)", un, m);
}

function ecrireImpression(w: Window, titre: string, un: string, m: ModeleDeclaration) {
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titre)}</title>
    <style>
      @page{size:A4;margin:12mm 20mm}
      @media screen{body{padding:12mm 20mm;max-width:210mm}}
      body{font-family:"Times New Roman",Times,serif;color:#000;font-size:12pt;margin:0}
      .ex{height:${m.deuxExemplaires ? "128mm" : "auto"};overflow:hidden}
      .entete{width:100%;border-collapse:collapse}
      .entete td{vertical-align:top;font-weight:bold;line-height:1.45;padding:0}
      .entete .g{width:55%}
      .entete .d{text-align:center}
      .entete .d .lieu{margin-top:2.9em}
      h1{text-align:center;font-size:12pt;text-decoration:underline;margin:18px 0 14px;font-weight:bold}
      p{margin:0;line-height:1.75;white-space:pre-wrap}
      .coupe{border-top:1.5px dotted #000;margin:6mm -10mm 8mm}
    </style></head><body>
    ${un}
    ${m.deuxExemplaires ? `<div class="coupe"></div>${un}` : ""}
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
    </body></html>`);
  w.document.close();
}

export function imprimerDeclaration(a: Accouchement, d: DeclarationNaissance, staff: Staff[], modele?: ModeleDeclaration) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("La fenêtre d'impression est bloquée. Veuillez autoriser les pop-ups pour cette application.");
    return;
  }
  const m = modele || lireModele();
  ecrireImpression(w, `Déclaration de naissance N° ${d.numero}`, exemplaireHtml(a, d, staff, m), m);
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

  // Modèle de l'établissement (en-tête, devise, N°…) : réglages partagés par tout le service.
  const [surcharges, setSurcharges] = useCloudSyncedState<Partial<ModeleDeclaration> | null>(CLE_MODELE, null);
  const modele = useMemo(() => lireModele(surcharges), [surcharges]);
  const [reglages, setReglages] = useState(false);
  const setModele = (patch: Partial<ModeleDeclaration>) => setSurcharges(JSON.parse(JSON.stringify({ ...(surcharges || {}), ...patch })));

  const agentsPossibles = staff.filter((s) => /sage|m[ée]decin|infirm|accouch/i.test(s.poste || ""));

  const [d, setD] = useState<DeclarationNaissance>(() => {
    const agent = staff.find((s) => s.id === a.sageFemmeId) || (currentUser && /sage/i.test(currentUser.poste || "") ? currentUser : undefined);
    const m = decouperNom(a.patient);
    const base: DeclarationNaissance = {
      numero: prochainNumeroDeclaration(accouchements, a.date, a.id, initialesMere(m.nom, m.prenoms)),
      declarantAgentId: agent?.id || "",
      declarantAgentNom: agent?.nom || "",
      declarantAgentCivilite: "Mme",
      declarantAgentFonction: agent?.poste ? agent.poste.toLowerCase() : "sage-femme",
      lieuSignature: lireModele().ville,
      nomEnfant: "",
      prenomsEnfant: "",
      naissance: "Unique",
      vivant: true,
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
  // Envoi WhatsApp : numéro de l'état civil mémorisé pour tout le service (synchro cloud).
  const [numeroEtatCivil, setNumeroEtatCivil] = useCloudSyncedState<string>("dg_etat_civil_whatsapp", "");
  const [envoi, setEnvoi] = useState<null | "famille" | "etat">(null);
  const [numeroEnvoi, setNumeroEnvoi] = useState("");

  // N° automatique (non modifiable) :
  //  • par défaut, le CODE PATIENT de la maman (celui de son enregistrement, utilisé
  //    en CPN), retrouvé dans le registre des patients — ou saisi s'il n'est pas trouvé ;
  //  • sinon (réglage, ou code introuvable) : initiales + date JJMMAAAA, ou date seule.
  // Suffixe -2, -3… si le numéro existe déjà (jumeaux, nouvelle grossesse).
  const codeTrouve = useMemo(
    () => codePatientMere(a.patient, d.mere.contact || cpnMere?.contact),
    [a.patient, d.mere.contact, cpnMere?.contact],
  );
  const codeSaisi = estUnCode(d.codePatientMere || "") ? normaliserCode(d.codePatientMere || "") : "";
  const codeMere = codeSaisi || codeTrouve;
  const [j, mo, an] = [a.date.slice(8, 10), a.date.slice(5, 7), a.date.slice(0, 4)];
  const initiales = modele.formatNumero === "date" ? "" : initialesMere(d.mere.nom, d.mere.prenoms);
  const parCode = modele.formatNumero === "code-patient" && !!codeMere;
  const baseNumero = parCode ? codeMere : `${initiales}${j}${mo}${an}`;
  const numeroExistantValide =
    !!existante?.numero &&
    // déjà remise aux parents / transmise : son N° ne change plus
    (existante.statut !== "Établie" || existante.numero === baseNumero || existante.numero.startsWith(`${baseNumero}-`)) &&
    !accouchements.some((x) => x.id !== a.id && x.declarationNaissance?.numero === existante.numero);
  const numeroAuto = numeroExistantValide ? existante!.numero : numeroLibre(accouchements, baseNumero, a.id);

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
    return JSON.parse(JSON.stringify({ ...d, numero: numeroAuto, codePatientMere: codeMere || d.codePatientMere })); // retire les undefined (synchro cloud)
  };

  const enregistrer = (imprimer: boolean) => {
    const ok = valider();
    if (!ok) return;
    onSave(ok);
    if (imprimer) imprimerDeclaration(a, ok, staff, modele);
    onClose();
  };

  const ouvrirEnvoi = (pour: "famille" | "etat") => {
    setEnvoi(pour);
    setNumeroEnvoi(pour === "etat" ? numeroEtatCivil : d.declarantContact || d.pere.contact || d.mere.contact || cpnMere?.contact || "");
  };

  const envoyerWhatsApp = async (modeNumero: boolean) => {
    if (!envoi) return;
    const ok = valider();
    if (!ok) return;
    const num = formatWhatsAppNumber(numeroEnvoi);
    if (modeNumero && !num) {
      alert("Numéro WhatsApp invalide. Saisissez par exemple 70 12 34 56 ou +225 07 12 34 56 78.");
      return;
    }
    if (envoi === "etat" && num && numeroEnvoi !== numeroEtatCivil) setNumeroEtatCivil(numeroEnvoi);
    // Suivi : la déclaration est remise à la famille / transmise à l'état civil.
    const today = getTodayStr();
    const suivi: DeclarationNaissance =
      envoi === "etat"
        ? { ...ok, statut: "Transmise à l'état civil", dateTransmission: ok.dateTransmission || today, dateRemise: ok.dateRemise || today }
        : { ...ok, statut: ok.statut === "Établie" ? "Remise aux parents" : ok.statut, dateRemise: ok.dateRemise || today };
    suivi.observations = [ok.observations, `Envoyée par WhatsApp ${envoi === "etat" ? "à l'état civil" : "à la famille"} le ${dateFr(today)}${num ? ` (${numeroEnvoi})` : ""}`].filter(Boolean).join(" · ");
    onSave(JSON.parse(JSON.stringify(suivi)));
    setD(suivi);

    const texte = messageWhatsAppDeclaration(a, ok, staff, envoi, modele);
    const nomFichier = `Declaration_naissance_${ok.numero}.pdf`;
    const pdf = new File([genererPdfDeclaration(a, ok, staff, modele)], nomFichier, { type: "application/pdf" });

    // Téléphone : partage direct du PDF vers WhatsApp (on choisit le contact dans WhatsApp).
    if (!modeNumero && (navigator as any).canShare?.({ files: [pdf] })) {
      try {
        await navigator.share({ files: [pdf], text: texte, title: `Déclaration de naissance N° ${ok.numero}` });
        setEnvoi(null);
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    // Ordinateur : le PDF est téléchargé, puis la discussion WhatsApp s'ouvre avec le message.
    const url = URL.createObjectURL(pdf);
    const lien = document.createElement("a");
    lien.href = url; lien.download = nomFichier;
    document.body.appendChild(lien); lien.click(); lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    window.open(`https://wa.me/${num || ""}?text=${encodeURIComponent(texte)}`, "_blank", "noopener");
    alert(`Le PDF « ${nomFichier} » a été téléchargé.\nDans WhatsApp, joignez-le au message (trombone 📎 → Document).`);
    setEnvoi(null);
  };

  const peutPartager = typeof navigator !== "undefined" && !!(navigator as any).canShare;

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
                {modele.formatNumero === "code-patient" && (
                  codeTrouve && !d.codePatientMere ? (
                    <div className="text-2xs text-emerald-700 mt-1">Code patient de la maman ({codeTrouve})</div>
                  ) : (
                    <input
                      className={`${input} mt-1 font-mono uppercase`}
                      placeholder="Code patient (ex. DG-7K3PM)"
                      value={d.codePatientMere || ""}
                      onChange={(e) => set({ codePatientMere: e.target.value })}
                      title="Maman non retrouvée automatiquement au registre des patients : saisissez son code patient (carnet / accueil)"
                    />
                  )
                )}
                {modele.formatNumero === "code-patient" && !codeMere && (
                  <div className="text-2xs text-amber-700 mt-1">Code patient introuvable : saisissez-le, sinon le N° provisoire ci-dessus (initiales + date) sera utilisé.</div>
                )}
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

            {/* Aperçu de la déclaration telle qu'elle sera imprimée / envoyée */}
            {(() => {
              const c = contenu(a, { ...d, numero: numeroAuto }, staff, modele);
              return (
                <div className="rounded-lg border border-stone-300 bg-white p-4 text-[13px] text-black leading-relaxed shadow-inner font-serif">
                  <div className="text-2xs font-bold uppercase text-pink-700 mb-2 font-sans">Aperçu de la déclaration{modele.deuxExemplaires ? " (imprimée en 2 exemplaires sur la même feuille)" : ""}</div>
                  <div className="flex justify-between gap-4 text-xs font-bold">
                    <div>{lignesEnTete(modele).map((l, i) => <div key={i}>{l}</div>)}</div>
                    <div className="text-center">
                      <div>{modele.pays}</div>
                      <div>{modele.devise}</div>
                      <div className="mt-6">{c.lieu}, le {dateFr(d.dateEtablissement)}</div>
                    </div>
                  </div>
                  <div className="text-center font-bold underline my-4">DECLARATION DE NAISSANCE N° {numeroAuto}</div>
                  {c.lignes.map((l, i) => (
                    <div key={i} className="whitespace-pre-wrap">
                      {l.map(([t, st], j) => (st === "bi" ? <b key={j}><i>{t}</i></b> : <span key={j}>{t}</span>))}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* --- Réglages du modèle de l'établissement (en-tête, devise, N°) --- */}
          <div className="rounded-xl border border-stone-200">
            <button type="button" onClick={() => setReglages(!reglages)} className="w-full p-3 flex items-center justify-between text-left">
              <span className="text-xs font-bold uppercase text-stone-600 flex items-center gap-1.5"><Settings2 className="w-4 h-4" /> Modèle de l'établissement (en-tête, pays, N°) — commun à tout le service</span>
              {reglages ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {reglages && (
              <div className="p-3 pt-0 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><label className={lbl}>Ministère</label><input className={input} value={modele.ministere} onChange={(e) => setModele({ ministere: e.target.value })} /></div>
                  <div><label className={lbl}>Direction régionale</label><input className={input} value={modele.direction} onChange={(e) => setModele({ direction: e.target.value })} /></div>
                  <div><label className={lbl}>District sanitaire</label><input className={input} value={modele.district} onChange={(e) => setModele({ district: e.target.value })} /></div>
                  <div><label className={lbl}>Nom dans l'en-tête</label><input className={input} value={modele.etablissement} onChange={(e) => setModele({ etablissement: e.target.value })} /></div>
                  <div><label className={lbl}>Adresse (secteur, quartier…)</label><input className={input} value={modele.adresse} onChange={(e) => setModele({ adresse: e.target.value })} /></div>
                  <div><label className={lbl}>« En service au … »</label><input className={input} value={modele.structure} onChange={(e) => setModele({ structure: e.target.value })} /></div>
                  <div>
                    <label className={lbl}>Pays</label>
                    <select className={input} value={PAYS_DEVISES.some(([p]) => p === modele.pays) ? modele.pays : ""} onChange={(e) => {
                      const x = PAYS_DEVISES.find(([p]) => p === e.target.value);
                      if (x) setModele({ pays: x[0], devise: x[1] });
                    }}>
                      <option value="">— Autre (saisir ci-dessous) —</option>
                      {PAYS_DEVISES.map(([p]) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <input className={`${input} mt-1`} value={modele.pays} onChange={(e) => setModele({ pays: e.target.value })} />
                  </div>
                  <div><label className={lbl}>Devise nationale</label><input className={input} value={modele.devise} onChange={(e) => setModele({ devise: e.target.value })} /></div>
                  <div><label className={lbl}>Ville (« …, le »)</label><input className={input} value={modele.ville} onChange={(e) => { setModele({ ville: e.target.value }); set({ lieuSignature: e.target.value }); }} /></div>
                  <div>
                    <label className={lbl}>Numérotation</label>
                    <select className={input} value={modele.formatNumero} onChange={(e) => setModele({ formatNumero: e.target.value as ModeleDeclaration["formatNumero"] })}>
                      <option value="code-patient">Code patient de la maman (ex. DG-7K3PM)</option>
                      <option value="initiales-date">Initiales de la maman + date (ex. OS05082026)</option>
                      <option value="date">Date seule (ex. 05082026)</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                    <input type="checkbox" checked={modele.deuxExemplaires} onChange={(e) => setModele({ deuxExemplaires: e.target.checked })} /> Imprimer 2 exemplaires sur la même feuille A4 (à découper)
                  </label>
                  <button type="button" onClick={() => { if (confirm("Rétablir le modèle par défaut de l'établissement ?")) setSurcharges(null); }} className="text-xs text-stone-500 flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Modèle par défaut</button>
                </div>
              </div>
            )}
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

        {envoi && (
          <div className="px-4 pt-3 border-t border-stone-100 space-y-2 bg-emerald-50/60">
            <div className="text-xs font-bold text-emerald-800">
              Envoyer la déclaration par WhatsApp {envoi === "etat" ? "à l'état civil" : "à la famille"}
            </div>
            <div className="flex flex-wrap items-end gap-2 pb-3">
              <div className="flex-1 min-w-[180px]">
                <label className={lbl}>{envoi === "etat" ? "WhatsApp de l'état civil (mémorisé)" : "WhatsApp de la famille"}</label>
                <input className={input} inputMode="tel" placeholder="Ex: 70 12 34 56" value={numeroEnvoi} onChange={(e) => setNumeroEnvoi(e.target.value)} />
              </div>
              {peutPartager && (
                <button type="button" onClick={() => envoyerWhatsApp(false)} className="px-3 py-2 text-xs font-bold rounded-lg bg-[#25D366] text-white flex items-center gap-1.5">
                  <Send className="w-4 h-4" /> Partager le PDF
                </button>
              )}
              <button type="button" onClick={() => envoyerWhatsApp(true)} className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 ${peutPartager ? "border border-[#25D366] text-emerald-800" : "bg-[#25D366] text-white"}`}>
                <Send className="w-4 h-4" /> {peutPartager ? "Envoyer à ce numéro" : "Ouvrir WhatsApp"}
              </button>
              <button type="button" onClick={() => setEnvoi(null)} className="px-2 py-2 text-xs text-stone-500">Annuler</button>
            </div>
            {peutPartager && <p className="text-2xs text-stone-500 pb-2 -mt-2">« Partager le PDF » envoie le document directement : choisissez WhatsApp puis le contact.</p>}
          </div>
        )}

        <div className="p-4 border-t border-stone-100 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => ouvrirEnvoi("famille")} className="px-3 py-2 text-xs font-bold rounded-lg border border-[#25D366] text-emerald-800 flex items-center gap-1.5"><Send className="w-4 h-4" /> WhatsApp famille</button>
          <button type="button" onClick={() => ouvrirEnvoi("etat")} className="px-3 py-2 text-xs font-bold rounded-lg border border-[#25D366] text-emerald-800 flex items-center gap-1.5 mr-auto"><Send className="w-4 h-4" /> WhatsApp état civil</button>
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold rounded-lg border border-stone-300 text-stone-700">Fermer</button>
          <button type="button" onClick={() => enregistrer(false)} className="px-3 py-2 text-xs font-bold rounded-lg border border-pink-600 text-pink-700 flex items-center gap-1.5"><Save className="w-4 h-4" /> Enregistrer</button>
          <button type="button" onClick={() => enregistrer(true)} className="px-3 py-2 text-xs font-bold rounded-lg bg-pink-600 hover:bg-pink-700 text-white flex items-center gap-1.5"><Printer className="w-4 h-4" /> Enregistrer et imprimer</button>
        </div>
      </div>
    </div>
  );
}
