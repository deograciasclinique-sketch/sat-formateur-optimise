/**
 * Secrétariat — « Ordres du médecin à facturer ».
 *
 * Dès que le médecin prend sa décision (soins, injectables, ordonnance, examens), le dossier
 * apparaît ici avec le coût calculé automatiquement (grille Actes & Tarifs + prix pharmacie).
 * La secrétaire vérifie / corrige puis :
 *   • Encaisser et envoyer : facture payée, dossier envoyé aux infirmiers / labo pour exécution ;
 *   • Envoyer à l'infirmerie, payer après : soins exécutés tout de suite, montant « à payer » ;
 *   • Annoncer au patient : impression du devis ou message WhatsApp, sans encaisser.
 * Les dossiers « à payer » restent listés jusqu'à l'encaissement.
 */
import React, { useMemo, useState } from "react";
import { Wallet, Send, Megaphone, Printer, Trash2, Plus, Stethoscope, AlertTriangle, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { ActeTarifaire, Consultation, ExamenLabo, Facture, Medicament } from "../types";
import { generateUid, getTodayStr } from "../data";
import { LigneDevis, proposerDevis, totalDevis, fcfa, texteDevis } from "../lib/devisActes";
import { ConduiteATenirListe, TYPES_INFIRMIER, catASoinsInfirmiers } from "./ConduiteATenir";
import { formatWhatsAppNumber } from "../lib/whatsapp";
import { echapperHtml } from "../lib/pharmacies";

type Props = {
  consultations: Consultation[];
  onUpdateConsultations: (c: Consultation[]) => void;
  factures: Facture[];
  onUpdateFactures: (f: Facture[]) => void;
  actes?: ActeTarifaire[];
  medicaments?: Medicament[];
  laboExamens?: ExamenLabo[];
  onUpdateLaboExamens?: (e: ExamenLabo[]) => void;
  agentNom?: string;
  isDark?: boolean;
};

function nomCabinet(): string {
  try { return JSON.parse(localStorage.getItem("dg_clinic_profile") || "{}").name || "Cabinet médical"; } catch { return "Cabinet médical"; }
}

export default function OrdresMedecin(props: Props) {
  const { consultations, isDark } = props;
  const aFacturer = useMemo(
    () => consultations
      .filter((c) => c.statut === "Attente paiement actes" || (c.devisActes?.statut === "à payer"))
      .sort((a, b) => (b.derniereMajLe || b.createdAt || "").localeCompare(a.derniereMajLe || a.createdAt || "")),
    [consultations]
  );
  if (aFacturer.length === 0) return null;
  return (
    <div className={`rounded-lg border-2 border-orange-400 p-4 space-y-3 ${isDark ? "bg-gray-800" : "bg-orange-50/50"}`}>
      <h3 className="font-bold flex items-center gap-2">
        <Stethoscope className="w-5 h-5 text-orange-500" /> Ordres du médecin à facturer ({aFacturer.length})
      </h3>
      <p className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
        Le coût est calculé automatiquement d'après la décision du médecin (grille Actes & Tarifs, prix de la pharmacie, examens demandés). Vérifiez, corrigez si besoin, puis encaissez ou envoyez.
      </p>
      {aFacturer.map((c) => <CarteOrdre key={c.id} c={c} {...props} />)}
    </div>
  );
}

function CarteOrdre({ c, consultations, onUpdateConsultations, factures, onUpdateFactures, actes = [], medicaments = [], laboExamens = [], onUpdateLaboExamens, agentNom, isDark }: Props & { c: Consultation }) {
  const dejaAPayer = c.devisActes?.statut === "à payer";
  const [ouvert, setOuvert] = useState(!dejaAPayer);
  const [lignes, setLignes] = useState<LigneDevis[]>(() =>
    c.devisActes ? c.devisActes.lignes.map((l, i) => ({ uid: "d" + i, designation: l.designation, qte: l.qte, prix: l.prix, source: (l.source as any) || "ajout" }))
      : proposerDevis(c, actes, medicaments, laboExamens)
  );
  const [mode, setMode] = useState("Espèces");
  const [ajout, setAjout] = useState("");
  const total = totalDevis(lignes);
  const aTarifer = lignes.some((l) => l.aTarifer && !l.prix);
  const carte = isDark ? "border-gray-700 bg-gray-900/40" : "border-gray-200 bg-white";

  const recalculer = () => setLignes(proposerDevis(c, actes, medicaments, laboExamens));
  const maj = (uid: string, champ: "qte" | "prix", v: number) => setLignes(lignes.map((l) => (l.uid === uid ? { ...l, [champ]: Math.max(0, v), aTarifer: champ === "prix" ? false : l.aTarifer } : l)));
  const ajouterActe = (id: string) => {
    const a = actes.find((x) => x.id === id);
    if (a) setLignes([...lignes, { uid: generateUid(), designation: a.nom, qte: 1, prix: a.prix, source: "ajout" }]);
    setAjout("");
  };
  const devis = (statut: "payé" | "à payer" | "annoncé", factureId?: string): NonNullable<Consultation["devisActes"]> => ({
    lignes: lignes.filter((l) => l.qte > 0).map((l) => ({ designation: l.designation, qte: l.qte, prix: l.prix, source: l.source })),
    total, statut, le: new Date().toISOString(), par: agentNom, factureId,
    examensIds: lignes.map((l) => l.examenId).filter(Boolean) as string[],
  });
  const verifier = () => {
    if (lignes.filter((l) => l.qte > 0).length === 0) { alert("Ajoutez au moins une ligne à facturer."); return false; }
    if (aTarifer && !confirm("Certaines lignes n'ont pas de prix (0 FCFA). Continuer quand même ?")) return false;
    return true;
  };

  const encaisser = () => {
    if (!verifier()) return;
    const factureId = generateUid();
    const f: Facture = {
      id: factureId, codePatient: c.codePatient, patient: c.patient, date: getTodayStr(), mode,
      lignes: lignes.filter((l) => l.qte > 0).map((l) => ({ id: generateUid(), designation: l.designation, qte: l.qte, prix: l.prix, montant: l.qte * l.prix })),
      total, montantPaye: total, statut: "Payée", createdAt: new Date().toISOString(), consultationId: c.id, typePaiement: "Actes",
    };
    onUpdateFactures([f, ...factures]);
    const ids = new Set(lignes.map((l) => l.examenId).filter(Boolean) as string[]);
    if (ids.size && onUpdateLaboExamens) onUpdateLaboExamens(laboExamens.map((e) => (ids.has(e.id) ? { ...e, facture: true } : e)));
    onUpdateConsultations(consultations.map((x) => x.id !== c.id ? x : {
      ...x,
      statut: x.statut === "Attente paiement actes" ? (x.soinsExecutes ? "Terminée" : "Attente exécution actes") : x.statut,
      devisActes: devis("payé", factureId),
    }));
    alert(`${fcfa(total)} encaissés pour ${c.patient}.${c.statut === "Attente paiement actes" && !c.soinsExecutes ? " Le dossier est envoyé aux infirmiers / au laboratoire pour exécution." : ""}`);
  };

  const envoyerSansPayer = () => {
    if (!verifier()) return;
    onUpdateConsultations(consultations.map((x) => x.id !== c.id ? x : {
      ...x,
      statut: x.soinsExecutes ? x.statut : "Attente exécution actes",
      devisActes: devis("à payer"),
    }));
    alert(`Dossier de ${c.patient} envoyé à l'infirmerie avec le coût (${fcfa(total)}, à payer). Il reste dans cette liste jusqu'à l'encaissement.`);
  };

  const annoncer = (canal: "imprimer" | "whatsapp") => {
    if (!verifier()) return;
    if (c.statut === "Attente paiement actes") onUpdateConsultations(consultations.map((x) => (x.id === c.id ? { ...x, devisActes: devis("annoncé") } : x)));
    if (canal === "whatsapp") {
      const n = formatWhatsAppNumber(c.contact || "");
      const msg = encodeURIComponent(texteDevis(c, lignes, nomCabinet()));
      window.open(n ? `https://wa.me/${n}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank");
      return;
    }
    const w = window.open("", "_blank");
    if (!w) return alert("Fenêtre d'impression bloquée : autorisez les fenêtres pop-up.");
    const rows = lignes.filter((l) => l.qte > 0).map((l) => `<tr><td>${echapperHtml(l.designation)}</td><td style="text-align:center">${l.qte}</td><td style="text-align:right">${echapperHtml(fcfa(l.prix))}</td><td style="text-align:right">${echapperHtml(fcfa(l.qte * l.prix))}</td></tr>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Devis — ${echapperHtml(c.patient)}</title>
      <style>body{font-family:Helvetica,Arial,sans-serif;padding:30px;color:#1c1917;font-size:13px}h1{font-size:18px;color:#0d9488;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #e7e5e4;padding:6px}th{text-align:left;font-size:11px;text-transform:uppercase;color:#78716c}.tot{font-size:16px;font-weight:bold;text-align:right;margin-top:12px}</style></head><body>
      <h1>${echapperHtml(nomCabinet())}</h1><p>Devis des soins prescrits — ${echapperHtml(new Date().toLocaleDateString("fr-FR"))}</p>
      <p><b>Patient :</b> ${echapperHtml(c.patient)}${c.codePatient ? ` (${echapperHtml(c.codePatient)})` : ""}</p>
      <table><thead><tr><th>Désignation</th><th>Qté</th><th>Prix</th><th>Montant</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot">Total : ${echapperHtml(fcfa(total))}</div><p style="color:#78716c;font-size:11px">À régler au secrétariat avant les soins.</p></body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className={`rounded border p-3 ${carte} ${dejaAPayer ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-orange-500"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">
            {c.codePatient && <span className="font-mono text-emerald-600 mr-1.5">{c.codePatient}</span>}{c.patient}
            {dejaAPayer && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Soins envoyés — {fcfa(c.devisActes!.total)} à payer</span>}
            {c.devisActes?.statut === "annoncé" && <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded bg-sky-100 text-sky-800">Devis annoncé au patient</span>}
          </div>
          <div className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            Décision : <b>{c.decision || "Soins / examens prescrits"}</b>{c.diagnostic ? ` · ${c.diagnostic}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{fcfa(total)}</span>
          <button type="button" onClick={() => setOuvert(!ouvert)} className="px-2 py-1 rounded border text-xs font-medium flex items-center gap-1">
            {ouvert ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}{ouvert ? "Réduire" : "Détails"}
          </button>
        </div>
      </div>

      {ouvert && (
        <div className="mt-3 space-y-3">
          {/* Ordre du médecin */}
          <div className={`rounded border p-2 text-sm space-y-1 ${isDark ? "border-gray-700 bg-gray-900/60" : "border-gray-200 bg-gray-50"}`}>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Ordre du médecin</div>
            {c.consignesInfirmier && <div><b>Consignes :</b> {c.consignesInfirmier}</div>}
            {catASoinsInfirmiers(c.conduiteATenir) && <ConduiteATenirListe items={c.conduiteATenir} seulementType={TYPES_INFIRMIER} compact />}
            {(c.ordonnance || []).length > 0 && (
              <div><b>Ordonnance :</b> {c.ordonnance.map((l) => l.medicamentNom + (l.quantitePrescrite ? ` ×${l.quantitePrescrite}` : "")).join(" ; ")}</div>
            )}
            {!c.consignesInfirmier && !catASoinsInfirmiers(c.conduiteATenir) && !(c.ordonnance || []).length && <div className="text-gray-500 italic">Voir la fiche de consultation.</div>}
          </div>

          {/* Devis */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={`text-left text-xs uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}><th className="py-1">À facturer</th><th className="w-16">Qté</th><th className="w-28">Prix (FCFA)</th><th className="w-28 text-right">Montant</th><th className="w-8"></th></tr></thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.uid} className={`border-t ${isDark ? "border-gray-700" : "border-gray-100"}`}>
                    <td className="py-1 pr-2">{l.designation}{l.aTarifer && !l.prix && <span className="ml-1 text-xs text-amber-700 font-bold"><AlertTriangle className="w-3 h-3 inline" /> prix à saisir</span>}</td>
                    <td><input type="number" min={0} className="w-14 px-1 py-0.5 rounded border bg-transparent" value={l.qte} onChange={(e) => maj(l.uid, "qte", Number(e.target.value) || 0)} /></td>
                    <td><input type="number" min={0} className="w-24 px-1 py-0.5 rounded border bg-transparent" value={l.prix} onChange={(e) => maj(l.uid, "prix", Number(e.target.value) || 0)} /></td>
                    <td className="text-right font-medium">{fcfa(l.qte * l.prix)}</td>
                    <td className="text-right"><button type="button" title="Retirer" onClick={() => setLignes(lignes.filter((x) => x.uid !== l.uid))} className="p-1 text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                  </tr>
                ))}
                {lignes.length === 0 && <tr><td colSpan={5} className="py-2 text-xs italic text-gray-500">Aucun acte reconnu automatiquement : ajoutez-les ci-dessous.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="px-2 py-1.5 text-sm rounded border bg-transparent max-w-xs" value={ajout} onChange={(e) => ajouterActe(e.target.value)}>
              <option value="">+ Ajouter un acte de la grille…</option>
              {actes.map((a) => <option key={a.id} value={a.id}>{a.nom} — {fcfa(a.prix)}</option>)}
            </select>
            <button type="button" onClick={() => setLignes([...lignes, { uid: generateUid(), designation: "Autre acte", qte: 1, prix: 0, source: "ajout", aTarifer: true }])} className="px-2 py-1.5 rounded border text-xs font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ligne libre</button>
            <button type="button" onClick={recalculer} className="px-2 py-1.5 rounded border text-xs font-medium">Recalculer</button>
            <span className="ml-auto text-base font-bold">Total : {fcfa(total)}</span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <div>
              <label className="text-xs font-medium block">Mode de paiement</label>
              <select className="mt-1 px-2 py-1.5 text-sm rounded border bg-transparent" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="Espèces">Espèces</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Assurance">Assurance</option>
              </select>
            </div>
            <button type="button" onClick={encaisser} className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Encaisser {fcfa(total)} et envoyer
            </button>
            {!dejaAPayer && c.statut === "Attente paiement actes" && (
              <button type="button" onClick={envoyerSansPayer} className="px-3 py-2 rounded bg-amber-500 hover:bg-amber-600 text-white font-medium flex items-center gap-2">
                <Send className="w-4 h-4" /> Envoyer à l'infirmerie, payer après
              </button>
            )}
            <button type="button" onClick={() => annoncer("imprimer")} className="px-3 py-2 rounded border font-medium flex items-center gap-2">
              <Printer className="w-4 h-4" /> Devis
            </button>
            <button type="button" onClick={() => annoncer("whatsapp")} className="px-3 py-2 rounded border font-medium flex items-center gap-2">
              <MessageCircle className="w-4 h-4" /> <Megaphone className="w-4 h-4" /> Annoncer (WhatsApp)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
