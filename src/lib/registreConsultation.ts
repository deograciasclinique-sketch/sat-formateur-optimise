/**
 * Registre de consultation curative — même colonnes (1) à (17) que le
 * registre papier du Ministère de la Santé utilisé au cabinet.
 */
import { Consultation, ExamenLabo, Staff } from "../types";
import { enListeCAT } from "../components/ConduiteATenir";

export interface LigneRegistre {
  numero: number; // (1)
  date: string;
  nom: string; // (2)
  profession: string; // (3)
  sexe: string; // (4)
  femmeEnceinte: string; // (5)
  age: string; // (6)
  adresse: string; // (7)
  zone: string; // (8)
  modeEntree: string; // (9)
  signes: string; // (10)
  diagnostic: string; // (11)
  examens: string; // (12)
  resultats: string; // (13)
  traitement: string; // (14)
  ancienConsultant: string; // (15)
  observations: string; // (16)
  prestataire: string; // (17)
}

const norm = (s: string) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const jour = (d?: string) => (d || "").slice(0, 10);

/** Dossiers qui ont réellement été vus en consultation générale. */
export function estConsultationCurative(c: Consultation): boolean {
  if (c.serviceDestination && c.serviceDestination !== "Infirmerie") return false;
  if (c.statut && /^Attente (paiement consultation|prise en charge|consultation médecin)/.test(c.statut)) return false;
  return !!(c.diagnostic || c.diagnosticFinal || c.plainte);
}

const nomExamen = (e: ExamenLabo) => e.bilan || e.examen || e.analyses || "Examen";
const resultatExamen = (e: ExamenLabo) => {
  if (e.tdrPalu) return `TDR palu ${e.tdrPalu}`;
  const r = (e.resultat || "").replace(/\s+/g, " ").trim();
  if (r) return r.length > 90 ? r.slice(0, 87) + "…" : r;
  return e.statut === "Validé" || e.statut === "Résultat disponible" ? "—" : "En attente";
};

export function lignesRegistre(
  consultations: Consultation[],
  examens: ExamenLabo[],
  staff: Staff[],
  debut: string,
  fin: string
): LigneRegistre[] {
  return consultations
    .filter((c) => jour(c.date) >= debut && jour(c.date) <= fin && estConsultationCurative(c))
    .sort((a, b) => jour(a.date).localeCompare(jour(b.date)) || (a.createdAt || "").localeCompare(b.createdAt || ""))
    .map((c, i) => {
      // (12)/(13) : examens liés à la consultation + examens demandés le même jour pour ce patient.
      const lies = new Map<string, ExamenLabo>();
      (c.labResults || []).forEach((e) => e && lies.set(e.id, e));
      examens
        .filter((e) => norm(e.patient) === norm(c.patient) && jour(e.dateDemande) === jour(c.date))
        .forEach((e) => lies.set(e.id, e));
      const ex = [...lies.values()];

      const traitement = [
        ...(c.ordonnance || []).map((l) => [l.medicamentNom, l.posologie, l.duree].filter(Boolean).join(" ")),
        // Conduite à tenir thérapeutique (pas la surveillance, les examens ni les conseils).
        ...enListeCAT(c.conduiteATenir)
          .filter((x) => !["Surveillance", "Examens", "Conseils"].includes(x.type))
          .map((x) => x.description),
      ].filter(Boolean);

      const issue =
        c.decision === "Référer vers un autre service" ? `Référé${c.referenceService ? ` vers ${c.referenceService}` : ""}`
        : c.decision === "Hospitalisation" ? "Hospitalisé"
        : c.decision === "Mise en observation" ? "Mis en observation"
        : c.decision === "Admission aux urgences" ? "Admis aux urgences"
        : "";
      const prest = staff.find((s) => s.id === c.medecinId);

      return {
        numero: i + 1,
        date: jour(c.date),
        nom: c.patient,
        profession: c.profession || "",
        sexe: c.sexe === "Masculin" ? "M" : c.sexe === "Féminin" ? "F" : c.sexe || "",
        femmeEnceinte: c.sexe === "Féminin" ? (c.femmeEnceinte ? "Oui" : "Non") : "",
        age: c.age > 0 ? (c.age < 1 ? `${Math.round(c.age * 12)} mois` : `${c.age} ans`) : "",
        adresse: [c.commune, c.villageSecteur, c.contact].filter(Boolean).join(" · "),
        zone: c.zoneResidence || "",
        modeEntree: c.modeEntree || "",
        // GDT étape 5 : symptôme dominant, porte d'entrée, diagnostic présomptif, traitement.
        signes: c.symptomeDominant
          ? `${c.symptomeDominant}${c.porteEntree ? ` (${c.porteEntree})` : ""}${c.plainte ? ` — ${c.plainte}` : ""}`
          : c.plainte || "",
        diagnostic: c.diagnosticFinal && c.diagnosticFinal !== c.diagnostic
          ? `${c.diagnostic || ""}${c.diagnostic ? " → " : ""}retenu : ${c.diagnosticFinal}`
          : c.diagnostic || c.diagnosticFinal || "",
        examens: ex.map(nomExamen).join(" ; "),
        resultats: ex.map((e) => `${nomExamen(e)} : ${resultatExamen(e)}`).join(" ; "),
        traitement: traitement.join(" ; "),
        ancienConsultant: c.ancienConsultant ? "Oui" : "Non",
        observations: [
          issue,
          c.mdoDeclare ? `MDO déclarée : ${c.mdoDeclare}` : "",
          c.dateControle ? `Contrôle le ${new Date(c.dateControle + "T00:00:00").toLocaleDateString("fr-FR")}` : "",
          c.referenceEtatClinique ? `État : ${c.referenceEtatClinique}` : "",
          c.observations || "",
        ].filter(Boolean).join(" · "),
        prestataire: prest ? `${prest.nom}${prest.poste ? ` (${prest.poste})` : ""}` : "",
      };
    });
}

const esc = (s: string) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fr = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR");

/** Ouvre le registre au format papier (paysage) et lance l'impression. */
export function imprimerRegistreConsultation(lignes: LigneRegistre[], debut: string, fin: string, clinique: string) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Autorisez les fenêtres pop-up pour imprimer le registre.");
    return;
  }
  const entetes = [
    "N° (1)", "Date", "Nom et prénom(s) (2)", "Profession (3)", "Sexe (4)", "Femme enceinte (5)", "Âge (6)",
    "Adresse (7)", "Zone de résidence (8)", "Mode d'entrée (9)", "Signes / symptômes dominants (10)", "Diagnostic (11)",
    "Examens paracliniques réalisés (12)", "Résultats des examens paracliniques (13)", "Traitement (14)",
    "Ancien consultant (15)", "Observations (16)", "Nom, prénom, qualification et signature du prestataire (17)",
  ];
  const corps = lignes
    .map((l) => [l.numero, fr(l.date), l.nom, l.profession, l.sexe, l.femmeEnceinte, l.age, l.adresse, l.zone, l.modeEntree,
      l.signes, l.diagnostic, l.examens, l.resultats, l.traitement, l.ancienConsultant, l.observations, l.prestataire]
      .map((v) => `<td>${esc(String(v))}</td>`).join(""))
    .map((tds) => `<tr>${tds}</tr>`)
    .join("");
  const nouveaux = lignes.filter((l) => l.ancienConsultant === "Non").length;
  const periode = debut === fin ? `Journée du ${fr(debut)}` : `Du ${fr(debut)} au ${fr(fin)}`;
  w.document.write(`<html><head><meta charset="utf-8"><title>Registre de consultation — ${esc(periode)}</title><style>
    @page{size:A4 landscape;margin:8mm}
    body{font-family:Arial,sans-serif;color:#111;margin:0}
    h1{font-size:14px;margin:0}h2{font-size:11px;margin:2px 0 8px;font-weight:normal}
    table{width:100%;border-collapse:collapse;font-size:7.5px;table-layout:fixed}
    th,td{border:1px solid #555;padding:2px 3px;vertical-align:top;word-wrap:break-word}
    th{background:#eee;font-size:7px}
    tr{page-break-inside:avoid}
    .pied{margin-top:8px;font-size:9px}
  </style></head><body>
    <h1>${esc(clinique.toUpperCase())} — REGISTRE DE CONSULTATION</h1>
    <h2>${esc(periode)} · ${lignes.length} consultation(s) · ${nouveaux} nouveau(x) consultant(s)</h2>
    <table><colgroup>${[2.5, 4.5, 7, 4.5, 2.5, 3, 3, 7, 3.5, 4, 8, 7, 6, 7, 9, 3, 7, 7.5].map((w) => `<col style="width:${w}%">`).join("")}</colgroup><thead><tr>${entetes.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${corps || `<tr><td colspan="${entetes.length}" style="text-align:center">Aucune consultation sur la période</td></tr>`}</tbody></table>
    <div class="pied">La colonne (17) est à signer par chaque prestataire. Numérotation (1) propre à la période imprimée.</div>
    <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
