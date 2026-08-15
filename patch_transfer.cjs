const fs = require('fs');
let code = fs.readFileSync('src/components/TabSettings.tsx', 'utf8');

// Insert functions
const functionsToInsert = `
  const handleExportTransferConfig = () => {
    try {
      const configData = {
        staff: JSON.parse(localStorage.getItem("dg_staff") || "[]"),
        medTypeThresholds: JSON.parse(localStorage.getItem("dg_med_type_thresholds") || "null") || localTypeThresholds,
        medCategoryThresholds: JSON.parse(localStorage.getItem("dg_med_category_thresholds") || "null") || localCategoryThresholds,
        thresholdApplyMode: localStorage.getItem("dg_threshold_apply_mode") || localApplyMode
      };

      const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = \`config-transfert-\${new Date().toISOString().split("T")[0]}.json\`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error", err);
      alert("Erreur lors de la génération du fichier de transfert.");
    }
  };

  const handleImportTransferConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.staff) {
          localStorage.setItem("dg_staff", JSON.stringify(json.staff));
        }
        if (json.medTypeThresholds) {
          localStorage.setItem("dg_med_type_thresholds", JSON.stringify(json.medTypeThresholds));
        }
        if (json.medCategoryThresholds) {
          localStorage.setItem("dg_med_category_thresholds", JSON.stringify(json.medCategoryThresholds));
        }
        if (json.thresholdApplyMode) {
          localStorage.setItem("dg_threshold_apply_mode", json.thresholdApplyMode);
        }
        alert("Configuration transférée avec succès. L'application va se recharger.");
        window.location.reload();
      } catch (err) {
        alert("Fichier de configuration invalide.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };
`;

code = code.replace('  const handleSave = () => {', functionsToInsert + '\n  const handleSave = () => {');

// Insert UI
const uiToInsert = `
      {/* 🚀 Migration de Configuration (Transfert Multi-Centres) */}
      <div className={\`p-6 rounded-2xl border \${theme === 'dark' ? 'bg-stone-900/40 border-stone-800' : 'bg-white border-stone-200'} shadow-xs space-y-6\`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-stone-150 dark:border-stone-800/60 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-xl">
              <RefreshCw className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-serif font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Migration de Configuration & Transfert
                <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-md">
                  Multi-Centres
                </span>
              </h3>
              <p className="text-[11px] text-stone-400 font-semibold mt-1">
                Téléchargez un fichier léger contenant uniquement vos profils utilisateurs (staff) et vos seuils configurés. Utile pour dupliquer ces paramètres vers un autre ordinateur ou centre de santé.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleExportTransferConfig}
            className="flex items-center gap-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-700 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Download className="w-4 h-4" />
            Exporter config-transfert.json
          </button>
          
          <div className="relative">
            <input
              type="file"
              accept=".json"
              onChange={handleImportTransferConfig}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              title="Importer une configuration"
            />
            <button
              className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <Upload className="w-4 h-4" />
              Importer Configuration
            </button>
          </div>
        </div>
      </div>
`;

code = code.replace('{/* 🌐 Espace Commercialisation SaaS & Gestion Multi-Clinique (White-Label) */}', uiToInsert + '\n      {/* 🌐 Espace Commercialisation SaaS & Gestion Multi-Clinique (White-Label) */}');

fs.writeFileSync('src/components/TabSettings.tsx', code);
