/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Assistant de Surveillance Épidémiologique & Aide au Diagnostic
 * ----------------------------------------------------------------
 * Module fusionné dans la Consultation Générale (TabConsultation.tsx).
 * Fonctionne HORS-LIGNE (aucun appel API) et vient EN COMPLÉMENT de
 * l'Assistant Diagnostic IA existant (Gemini) : évaluation immédiate
 * et déterministe des constantes vitales selon les seuils nationaux
 * SIMR/PCIME, catalogue de pathologies avec score de certitude
 * diagnostique, et registre officiel des Maladies à Déclaration
 * Obligatoire (MDO) du Burkina Faso.
 */
import React, { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert, Search, ChevronDown, ChevronUp, Siren, FileWarning, CheckCircle2 } from "lucide-react";
import { evaluateVitals, VitalAlert } from "../utils/vitalSignsEvaluator";
import { ALL_PATHOLOGIES, searchPathologies } from "../modules/epidemio/pathologiesIndex";
import { MDO_BURKINA_FASO_LIST, MDODiseaseOverview } from "../modules/epidemio/mdoData";
import { Pathology } from "../modules/epidemio/clinicalTypes";

export interface EpidemioAssistantProps {
  theme?: "light" | "dark";
  // Constantes vitales telles que saisies dans TabConsultation (chaînes brutes des inputs)
  temperature?: string; // "37.5"
  tension?: string; // "12/8"
  pouls?: string; // "80"
  glycemie?: string; // "0.95"
  // Contexte patient pour affiner les seuils d'alerte
  ageAnnees?: string;
  femmeEnceinte?: boolean;
  // Plainte du patient, utilisée pour pré-remplir la recherche du catalogue
  plainte?: string;
  // Remonte le diagnostic choisi vers le formulaire de consultation
  onSelectDiagnostic?: (nomDiagnostic: string) => void;
  // Remonte une alerte MDO détectée (pour proposer une notification / décision de référence)
  onDetectMDO?: (maladie: MDODiseaseOverview) => void;
}

function parseAgeCategory(ageAnnees?: string, femmeEnceinte?: boolean): "Nourrisson" | "Enfant" | "Adulte" | "FemmeEnceinte" {
  if (femmeEnceinte) return "FemmeEnceinte";
  const age = parseFloat(ageAnnees || "");
  if (!isNaN(age)) {
    if (age < 2) return "Nourrisson";
    if (age < 15) return "Enfant";
  }
  return "Adulte";
}

function parseTension(tension?: string): { sys?: number; dia?: number } {
  if (!tension) return {};
  const match = tension.match(/(\d+)\s*[\/\-]\s*(\d+)/);
  if (!match) return {};
  return { sys: parseInt(match[1], 10), dia: parseInt(match[2], 10) };
}

const SEVERITY_STYLES: Record<VitalAlert["severity"], string> = {
  DANGER: "bg-danger-100 border-danger-300 text-danger-800",
  WARNING: "bg-warning-100 border-warning-300 text-warning-800",
  NORMAL: "bg-success-50 border-success-200 text-success-700",
};

export default function EpidemioAssistant({
  theme = "light",
  temperature,
  tension,
  pouls,
  glycemie,
  ageAnnees,
  femmeEnceinte,
  plainte,
  onSelectDiagnostic,
  onDetectMDO,
}: EpidemioAssistantProps) {
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [showMDO, setShowMDO] = useState(false);
  const [catalogueQuery, setCatalogueQuery] = useState("");
  const [mdoQuery, setMdoQuery] = useState("");
  const [selectedPathology, setSelectedPathology] = useState<Pathology | null>(null);
  const [selectedMDO, setSelectedMDO] = useState<MDODiseaseOverview | null>(null);

  // --- 1. Évaluation automatique et déterministe des constantes vitales ---
  const vitalsResult = useMemo(() => {
    const { sys, dia } = parseTension(tension);
    const vitals = {
      temperature: temperature ? parseFloat(temperature) : undefined,
      systolicBP: sys,
      diastolicBP: dia,
      pulse: pouls ? parseInt(pouls, 10) : undefined,
      glycemia: glycemie ? parseFloat(glycemie) : undefined,
    };
    const hasAny = Object.values(vitals).some((v) => v !== undefined && !isNaN(v as number));
    if (!hasAny) return null;
    return evaluateVitals(vitals, parseAgeCategory(ageAnnees, femmeEnceinte));
  }, [temperature, tension, pouls, glycemie, ageAnnees, femmeEnceinte]);

  const dangerousAlerts = (vitalsResult?.alerts || []).filter((a) => a.severity !== "NORMAL");

  // --- 2. Recherche dans le catalogue de pathologies (SIMR / PCIME) ---
  const effectiveQuery = catalogueQuery || plainte || "";
  const filteredPathologies = useMemo(() => {
    if (!showCatalogue) return [];
    return searchPathologies(effectiveQuery).slice(0, 12);
  }, [effectiveQuery, showCatalogue]);

  // --- 3. Recherche dans le registre officiel des MDO ---
  const filteredMDO = useMemo(() => {
    if (!showMDO) return [];
    const q = mdoQuery.trim().toLowerCase();
    if (!q) return MDO_BURKINA_FASO_LIST;
    return MDO_BURKINA_FASO_LIST.filter((m) => m.name.toLowerCase().includes(q));
  }, [mdoQuery, showMDO]);

  return (
    <div className="space-y-3">
      {/* Bandeau d'alerte immédiate sur les constantes vitales (hors-ligne, sans IA) */}
      {dangerousAlerts.length > 0 && (
        <div className={`rounded-xl border p-3 space-y-2 ${dangerousAlerts.some(a => a.severity === "DANGER") ? "bg-danger-50 border-danger-200" : "bg-warning-50 border-warning-200"}`}>
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
            <Siren className={`w-4 h-4 ${dangerousAlerts.some(a => a.severity === "DANGER") ? "text-danger-600 animate-pulse" : "text-warning-600"}`} />
            <span className={dangerousAlerts.some(a => a.severity === "DANGER") ? "text-danger-800" : "text-warning-800"}>
              Évaluation immédiate des constantes (SIMR/PCIME)
            </span>
          </div>
          <div className="grid gap-1.5">
            {dangerousAlerts.map((a, idx) => (
              <div key={idx} className={`text-xs rounded-lg border px-2.5 py-1.5 ${SEVERITY_STYLES[a.severity]}`}>
                <div className="font-bold">{a.parameter} : {a.value} — {a.message}</div>
                <div className="opacity-90 mt-0.5">➜ {a.immediateRecommendation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boutons d'accès au catalogue de pathologies et au registre MDO */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowCatalogue((v) => !v)}
          className="text-xs font-bold flex items-center gap-1.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg px-3 py-1.5 hover:bg-primary-100 transition-all"
        >
          <Search className="w-3.5 h-3.5" />
          Catalogue Pathologies (SIMR/PCIME)
          {showCatalogue ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <button
          type="button"
          onClick={() => setShowMDO((v) => !v)}
          className="text-xs font-bold flex items-center gap-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg px-3 py-1.5 hover:bg-orange-100 transition-all"
        >
          <FileWarning className="w-3.5 h-3.5" />
          Registre Maladies à Déclaration Obligatoire
          {showMDO ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Catalogue des pathologies */}
      {showCatalogue && (
        <div className="bg-stone-50 border border-stone-150 rounded-xl p-3 space-y-2">
          <input
            type="text"
            placeholder="Rechercher une pathologie (nom, signe, catégorie)..."
            value={catalogueQuery}
            onChange={(e) => setCatalogueQuery(e.target.value)}
            className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          />
          <div className="text-2xs text-stone-500">{filteredPathologies.length} résultat(s) sur {ALL_PATHOLOGIES.length} pathologies référencées</div>

          <div className="grid gap-1.5 max-h-64 overflow-y-auto pr-1">
            {filteredPathologies.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setSelectedPathology(p)}
                className={`text-left text-xs rounded-lg border px-2.5 py-2 transition-all ${
                  p.isEmergency ? "border-danger-200 bg-danger-50/50 hover:bg-danger-50" : "border-stone-200 bg-white hover:bg-primary-50"
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {p.isEmergency && <ShieldAlert className="w-3 h-3 text-danger-600 shrink-0" />}
                  {p.name}
                  {p.mdoInfo?.isMDO && (
                    <span className="ml-1 text-2xs font-black uppercase bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">MDO</span>
                  )}
                </div>
                <div className="text-stone-500 mt-0.5">{p.category}</div>
              </button>
            ))}
          </div>

          {/* Détail de la pathologie sélectionnée */}
          {selectedPathology && (
            <div className="bg-white border border-primary-200 rounded-xl p-3 text-xs space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-primary-900">{selectedPathology.name}</h4>
                <button onClick={() => setSelectedPathology(null)} className="text-stone-400 hover:text-stone-700">✕</button>
              </div>
              <p className="text-stone-600">{selectedPathology.definition}</p>

              {selectedPathology.cardinalSigns.length > 0 && (
                <div>
                  <span className="font-semibold uppercase text-2xs text-stone-500">Signes cardinaux</span>
                  <ul className="list-disc list-inside text-stone-700">
                    {selectedPathology.cardinalSigns.map((s) => <li key={s.id}>{s.label}</li>)}
                  </ul>
                </div>
              )}

              {selectedPathology.emergencyRedFlags.length > 0 && (
                <div className="bg-danger-50 border border-danger-200 rounded-lg p-2">
                  <span className="font-semibold uppercase text-2xs text-danger-700 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Signes de danger / conduite immédiate
                  </span>
                  <ul className="list-disc list-inside text-danger-800 mt-1">
                    {selectedPathology.emergencyRedFlags.map((f) => (
                      <li key={f.id}><span className="font-semibold">{f.label}</span> — {f.immediateAction}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <span className="font-semibold uppercase text-2xs text-stone-500">Traitement de 1ère intention</span>
                <p className="text-stone-700">{selectedPathology.standardTreatment.firstLineAdult}</p>
              </div>

              {selectedPathology.mdoInfo?.isMDO && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-orange-800">
                  <span className="font-semibold uppercase text-2xs flex items-center gap-1">
                    <FileWarning className="w-3 h-3" /> Maladie à Déclaration Obligatoire — {selectedPathology.mdoInfo.delayNotice}
                  </span>
                  <p className="mt-1">{selectedPathology.mdoInfo.mandatoryNotificationActions[0]}</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => onSelectDiagnostic?.(selectedPathology.name)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg py-2 mt-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Utiliser comme diagnostic de présomption
              </button>
            </div>
          )}
        </div>
      )}

      {/* Registre MDO */}
      {showMDO && (
        <div className="bg-stone-50 border border-stone-150 rounded-xl p-3 space-y-2">
          <input
            type="text"
            placeholder="Rechercher une maladie à déclaration obligatoire..."
            value={mdoQuery}
            onChange={(e) => setMdoQuery(e.target.value)}
            className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          />
          <div className="grid gap-1.5 max-h-64 overflow-y-auto pr-1">
            {filteredMDO.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => setSelectedMDO(m)}
                className="text-left text-xs rounded-lg border border-orange-200 bg-white hover:bg-orange-50 px-2.5 py-2"
              >
                <div className="font-bold text-orange-900">{m.name}</div>
                <div className="text-2xs text-orange-600 uppercase font-semibold mt-0.5">
                  {m.category === "IMMEDIATE_24H" ? "⚠️ Alerte immédiate (< 24h)" : m.category === "HEBDO_TLM" ? "Notification hebdomadaire" : "Notification mensuelle"}
                </div>
              </button>
            ))}
          </div>

          {selectedMDO && (
            <div className="bg-white border border-orange-200 rounded-xl p-3 text-xs space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-orange-900">{selectedMDO.name}</h4>
                <button onClick={() => setSelectedMDO(null)} className="text-stone-400 hover:text-stone-700">✕</button>
              </div>
              <div><span className="font-semibold uppercase text-2xs text-stone-500">Définition de cas suspect : </span>{selectedMDO.standardCaseDefinition.suspect}</div>
              <div><span className="font-semibold uppercase text-2xs text-stone-500">Échantillon : </span>{selectedMDO.sampleType}</div>
              <div><span className="font-semibold uppercase text-2xs text-stone-500">Conservation/Transport : </span>{selectedMDO.transportCondition}</div>
              <div><span className="font-semibold uppercase text-2xs text-stone-500">Laboratoire de référence : </span>{selectedMDO.nationalRefLab}</div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-orange-800">
                <span className="font-semibold uppercase text-2xs">À notifier à : </span>{selectedMDO.notificationTarget}
              </div>
              <ul className="list-disc list-inside text-stone-700">
                {selectedMDO.primaryResponseMeasures.map((m2, idx) => <li key={idx}>{m2}</li>)}
              </ul>
              <button
                type="button"
                onClick={() => onDetectMDO?.(selectedMDO)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg py-2 mt-1"
              >
                <FileWarning className="w-3.5 h-3.5" /> Signaler ce cas (générer le bordereau MDO)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
