/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { getActivityLogs, clearActivityLogs, subscribeToActivityLogs, ActivityLog } from "../lib/activityLogger";
import { Search, Trash2, Filter, RefreshCw, FileText, Download, Check, AlertTriangle, ShieldAlert, History, User, Clock, Info } from "lucide-react";

export default function TabQualiteActivityLog() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [limit, setLimit] = useState(30);

  const loadLogs = () => {
    setLogs(getActivityLogs());
  };

  useEffect(() => {
    loadLogs();
    // Écoute en temps réel les nouveaux logs enregistrés depuis un autre appareil.
    const unsubscribe = subscribeToActivityLogs((remoteLogs) => {
      setLogs(remoteLogs);
    });
    return unsubscribe;
  }, []);

  const handleClear = () => {
    clearActivityLogs();
    loadLogs();
    setShowConfirmClear(false);
  };

  // Get a unique sorted list of all users who performed actions in the logs
  const uniqueUsers = useMemo(() => {
    const users = logs.map((log) => log.user);
    return Array.from(new Set(users)).sort();
  }, [logs]);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.user.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || log.category === categoryFilter;
    const matchesUser = userFilter === "all" || log.user === userFilter;

    return matchesSearch && matchesCategory && matchesUser;
  });

  const exportCSV = () => {
    try {
      const headers = ["ID", "Horodatage", "Action", "Categorie", "Details", "Utilisateur"];
      const rows = filteredLogs.map((log) => [
        log.id,
        new Date(log.timestamp).toLocaleString("fr-FR"),
        log.action,
        log.category,
        log.details.replace(/"/g, '""'),
        log.user
      ]);

      const csvContent =
        "\uFEFF" + // UTF-8 BOM for Excel French accents support
        [headers.join(";"), ...rows.map((r) => r.map((val) => `"${val}"`).join(";"))].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `journal_activite_clinique_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Erreur lors de l'exportation du journal.");
    }
  };

  const getCategoryBadge = (category: "stock" | "suppression" | "securite" | "autre") => {
    switch (category) {
      case "stock":
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
            Stock
          </span>
        );
      case "suppression":
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-danger-50 text-danger-700 border border-danger-200 uppercase tracking-wider">
            Suppression
          </span>
        );
      case "securite":
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-warning-50 text-warning-700 border border-warning-200 uppercase tracking-wider">
            Sécurité
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-bold rounded-lg bg-stone-100 text-stone-600 border border-stone-200 uppercase tracking-wider">
            Autre
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div>
          <h3 className="text-base font-serif font-bold text-stone-900 flex items-center gap-2.5">
            <History className="w-5 h-5 text-primary-600" />
            Journal d'Activité Clinique & Traçabilité (Audit Trail)
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Historique complet des actions critiques effectuées sur l'application (modifications de stocks, suppressions de fiches, sécurité) pour la démarche qualité de la clinique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadLogs}
            className="p-2 text-stone-500 hover:text-primary-600 bg-stone-50 hover:bg-stone-100 rounded-lg transition-all cursor-pointer border border-stone-200"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            type="button"
            disabled={filteredLogs.length === 0}
            onClick={exportCSV}
            className="px-4 py-2 text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Exporter en CSV
          </button>

          {!showConfirmClear ? (
            <button
              type="button"
              disabled={logs.length === 0}
              onClick={() => setShowConfirmClear(true)}
              className="px-4 py-2 text-xs font-bold bg-danger-50 hover:bg-danger-100 text-danger-700 border border-danger-200 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" /> Vider le journal
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-danger-50 border border-danger-200 p-1.5 rounded-xl animate-fade-in">
              <span className="text-xs font-bold text-danger-800 px-1">Confirmer ?</span>
              <button
                type="button"
                onClick={handleClear}
                className="px-2.5 py-1 text-xs font-bold bg-danger-600 text-white rounded-lg hover:bg-danger-700 cursor-pointer"
              >
                Oui, vider
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmClear(false)}
                className="px-2.5 py-1 text-xs font-bold bg-white text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-100 cursor-pointer"
              >
                Non
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Search Input */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-500 dark:text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher une action, des détails, ou un responsable..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:bg-white focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl">
          <Filter className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-stone-600 focus:outline-none cursor-pointer"
          >
            <option value="all">📁 Toutes les catégories</option>
            <option value="stock">📦 Modifications de Stocks</option>
            <option value="suppression">❌ Suppressions de Fiches</option>
            <option value="securite">🔐 Actions de Sécurité</option>
            <option value="autre">⚙️ Autres actions</option>
          </select>
        </div>

        {/* User Filter */}
        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl">
          <User className="w-4 h-4 text-stone-500 dark:text-stone-400 shrink-0" />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full bg-transparent text-xs text-stone-600 focus:outline-none cursor-pointer"
          >
            <option value="all">👤 Tous les utilisateurs</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs List Table */}
      {filteredLogs.length === 0 ? (
        <div className="py-12 border border-dashed border-stone-200 rounded-2xl bg-stone-50 flex flex-col items-center justify-center text-center p-6">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 dark:text-stone-400 mb-3">
            <Info className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-stone-700">Aucune action critique enregistrée</p>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-sm">
            Les actions critiques comme les suppressions de consultations ou modifications de stocks apparaîtront ici en temps réel avec horodatage et nom du responsable.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-stone-150 rounded-xl shadow-2xs max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 text-stone-600 font-semibold tracking-wider uppercase border-b border-stone-200 text-xs sticky top-0 z-10">
                  <th className="p-3">Horodatage</th>
                  <th className="p-3">Catégorie</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Détails de l'Action</th>
                  <th className="p-3">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredLogs.slice(0, limit).map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                    <td className="p-3 whitespace-nowrap text-stone-500 font-mono text-sm">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0" />
                        <span>
                          {new Date(log.timestamp).toLocaleString("fr-FR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit"
                          })}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">{getCategoryBadge(log.category)}</td>
                    <td className="p-3 whitespace-nowrap font-bold text-stone-700">{log.action}</td>
                    <td className="p-3 text-stone-600 leading-normal min-w-[280px] max-w-md italic font-serif">
                      "{log.details}"
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-stone-700">
                        <User className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400 shrink-0" />
                        <span>{log.user}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length > limit && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setLimit((prev) => prev + 30)}
                className="px-4 py-2 text-xs font-bold text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-lg transition-all cursor-pointer inline-block"
              >
                Afficher plus de logs ({filteredLogs.length - limit} restants)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
