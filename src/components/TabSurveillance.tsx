/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Onglet "Surveillance Épidémiologique (THLO)" — intègre le module généré
 * séparément (THLO District Sanitaire) au reste de l'application DEO GRACIAS.
 * Les rapports et la configuration FOSA sont synchronisés en temps réel entre
 * tous les appareils via useCloudSyncedState, comme le reste des données de
 * l'app (voir src/lib/useCloudSyncedState.ts et src/lib/liveSync.ts).
 */

import React, { useState, useEffect, useMemo } from "react";
import { Settings, History, Printer, PlusCircle, Building2, Activity } from "lucide-react";

import { useCloudSyncedState } from "./../lib/useCloudSyncedState";
import { Consultation } from "./../types";

import { MondayDeadlineBanner } from "./Surveillance/components/MondayDeadlineBanner.tsx";
import { EpidemiologicalSummary } from "./Surveillance/components/EpidemiologicalSummary.tsx";
import { DiseaseTable } from "./Surveillance/components/DiseaseTable.tsx";
import { TransmissionPanel } from "./Surveillance/components/TransmissionPanel.tsx";
import { FosaSettingsModal } from "./Surveillance/components/FosaSettingsModal.tsx";
import { HistoryModal } from "./Surveillance/components/HistoryModal.tsx";
import { NewWeekModal } from "./Surveillance/components/NewWeekModal.tsx";
import { OfficialPrintModal } from "./Surveillance/components/OfficialPrintModal.tsx";
import { AutoImportPanel } from "./Surveillance/components/AutoImportPanel.tsx";

import { ThloReport, FosaConfig } from "./Surveillance/types/thlo.ts";
import { getEpiWeek } from "./Surveillance/utils/epiCalendar.ts";
import {
  getDefaultFosaConfig,
  createEmptyReportForWeek,
  normalizeReportsList,
  upsertReport,
  mergeDetectedCasesIncremental,
} from "./Surveillance/utils/storage.ts";
import { detectCasesFromConsultations } from "./Surveillance/utils/consultationsMapping.ts";

const FOSA_CONFIG_KEY = "dg_thlo_fosa_config_v1";
const REPORTS_KEY = "dg_thlo_reports_v1";

interface TabSurveillanceProps {
  consultations: Consultation[];
}

function TabSurveillance({ consultations }: TabSurveillanceProps) {
  const [fosaConfig, setFosaConfig] = useCloudSyncedState<FosaConfig>(FOSA_CONFIG_KEY, getDefaultFosaConfig());
  const [rawReports, setRawReports] = useCloudSyncedState<ThloReport[]>(REPORTS_KEY, []);

  const reports = useMemo(() => normalizeReportsList(rawReports), [rawReports]);

  const [activeReportId, setActiveReportId] = useState<string>("");

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isNewWeekOpen, setIsNewWeekOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  // Première utilisation (ou premier appareil connecté) : créer la semaine
  // épidémiologique courante, vide, si aucun rapport n'existe encore.
  useEffect(() => {
    if (reports.length === 0) {
      const currentEpi = getEpiWeek(new Date());
      const currentReport = createEmptyReportForWeek(currentEpi.weekNumber, currentEpi.year, fosaConfig);
      setRawReports([currentReport]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports.length]);

  // Garder une semaine active valide (par défaut, la plus récente).
  useEffect(() => {
    if (reports.length > 0 && !reports.find((r) => r.id === activeReportId)) {
      setActiveReportId(reports[0].id);
    }
  }, [reports, activeReportId]);

  const activeReport = reports.find((r) => r.id === activeReportId) || reports[0];

  // Consultations de la semaine du rapport actif (bornes de dates inclusives)
  // — toutes causes confondues, indépendamment du diagnostic. Sert à la fois
  // à l'indicateur d'activité générale du dashboard et à la détection des
  // cas MDO/mots-clés ci-dessous.
  const weekConsultations = useMemo(() => {
    if (!activeReport) return [];
    const start = activeReport.startDate;
    const end = activeReport.endDate;
    return (consultations || []).filter((c) => {
      const d = (c.date || "").slice(0, 10);
      return d >= start && d <= end;
    });
  }, [consultations, activeReport?.startDate, activeReport?.endDate]);

  // Détection automatique des cas MDO / mots-clés depuis les consultations
  // de la semaine du rapport actif.
  const detectedCases = useMemo(() => {
    if (!activeReport) return {};
    return detectCasesFromConsultations(weekConsultations);
  }, [weekConsultations, activeReport]);

  const handleReportChange = (updated: ThloReport) => {
    setRawReports(upsertReport(rawReports, updated));
  };

  // Synchronisation AUTOMATIQUE : dès qu'une consultation est enregistrée
  // (ou modifiée) dans la semaine du rapport actif, les cas nouvellement
  // détectés sont ajoutés au rapport sans qu'il soit nécessaire de cliquer
  // sur un bouton. La fusion est incrémentale (voir mergeDetectedCasesIncremental)
  // donc elle ne touche jamais un compteur déjà corrigé à la main.
  useEffect(() => {
    if (!activeReport) return;
    const { report: merged, hasNewCases } = mergeDetectedCasesIncremental(activeReport, detectedCases);
    if (hasNewCases > 0) {
      handleReportChange(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedCases, activeReport?.id]);

  // Conservé pour permettre à un agent de forcer une resynchronisation
  // immédiate (ex: après avoir corrigé un diagnostic), même si l'automatique
  // s'en charge normalement seule.
  const handleImportDetectedCases = () => {
    if (!activeReport) return;
    const { report: merged, hasNewCases } = mergeDetectedCasesIncremental(activeReport, detectedCases);
    if (hasNewCases > 0) {
      handleReportChange(merged);
    }
  };

  const handleMarkTransmitted = (channel: "whatsapp" | "sms" | "email" | "papier" = "whatsapp") => {
    if (!activeReport) return;
    const nowIso = new Date().toISOString();
    handleReportChange({
      ...activeReport,
      status: "transmis",
      transmittedAt: nowIso,
      transmissionChannel: channel,
      transmittedBy: fosaConfig.responsableName,
    });
  };

  const handleSaveConfig = (newConfig: FosaConfig) => {
    setFosaConfig(newConfig);
    if (activeReport) {
      handleReportChange({
        ...activeReport,
        fosa: { ...newConfig },
      });
    }
  };

  const handleCreateOrSelectWeek = (week: number, year: number) => {
    const targetId = `thlo_${year}_W${week < 10 ? "0" + week : week}`;
    const existing = reports.find((r) => r.id === targetId);
    if (existing) {
      setActiveReportId(targetId);
    } else {
      const newRep = createEmptyReportForWeek(week, year, fosaConfig);
      setRawReports([newRep, ...rawReports]);
      setActiveReportId(newRep.id);
    }
  };

  const handleDeleteReport = (reportId: string) => {
    const updated = rawReports.filter((r) => r.id !== reportId);
    setRawReports(updated);
    if (activeReportId === reportId && updated.length > 0) {
      setActiveReportId(updated[0].id);
    }
  };

  const handleScrollToTransmit = () => {
    const el = document.getElementById("transmission-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!activeReport) {
    return (
      <div className="flex items-center justify-center p-10">
        <p className="text-stone-500">Chargement du système de surveillance...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bandeau d'identification + actions rapides, dans le style des autres onglets */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white border border-stone-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-stone-900">Surveillance Épidémiologique (THLO)</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                SIMR / OMS
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 mt-0.5">
              <span className="flex items-center gap-1 font-medium text-stone-700">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                {fosaConfig.fosaName}
              </span>
              {fosaConfig.districtSanitaire && (
                <>
                  <span>•</span>
                  <span>
                    Destinataire : <strong className="text-stone-700">{fosaConfig.districtSanitaire}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setIsNewWeekOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors"
            title="Créer un nouveau rapport hebdomadaire"
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Nouv. Semaine</span>
          </button>
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors"
            title="Consulter les archives des semaines précédentes"
          >
            <History className="w-4 h-4 text-stone-600" />
            <span>Archives</span>
          </button>
          <button
            onClick={() => setIsPrintOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 transition-colors"
            title="Imprimer ou enregistrer en PDF la fiche officielle"
          >
            <Printer className="w-4 h-4 text-stone-600" />
            <span>Fiche Officielle</span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            title="Paramètres de la FOSA et contacts du District Sanitaire"
          >
            <Settings className="w-4 h-4 text-emerald-700" />
            <span>Configuration</span>
          </button>
        </div>
      </div>

      <MondayDeadlineBanner
        report={activeReport}
        onScrollToTransmit={handleScrollToTransmit}
        onMarkTransmitted={() => handleMarkTransmitted("whatsapp")}
      />

      <EpidemiologicalSummary report={activeReport} totalConsultations={weekConsultations.length} />

      <AutoImportPanel
        report={activeReport}
        detected={detectedCases}
        onImport={handleImportDetectedCases}
        lastImportedAt={activeReport.lastAutoImportAt}
      />

      <DiseaseTable report={activeReport} onChange={handleReportChange} />

      <TransmissionPanel
        report={activeReport}
        fosaConfig={fosaConfig}
        onMarkTransmitted={handleMarkTransmitted}
        onOpenPrint={() => setIsPrintOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <FosaSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={fosaConfig}
        onSave={handleSaveConfig}
      />

      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        reports={reports}
        activeReportId={activeReportId}
        onSelectReport={(id) => setActiveReportId(id)}
        onDeleteReport={handleDeleteReport}
      />

      <NewWeekModal
        isOpen={isNewWeekOpen}
        onClose={() => setIsNewWeekOpen(false)}
        onCreateWeek={handleCreateOrSelectWeek}
        existingWeekIds={reports.map((r) => r.id)}
      />

      <OfficialPrintModal isOpen={isPrintOpen} onClose={() => setIsPrintOpen(false)} report={activeReport} />
    </div>
  );
}

export default React.memo(TabSurveillance);
