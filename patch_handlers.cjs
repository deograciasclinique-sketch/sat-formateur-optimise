const fs = require('fs');
let code = fs.readFileSync('src/components/TabSettings.tsx', 'utf8');

const oldHandler = `  const handleImportTransferConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };`;

const newHandler = `  const handleImportTransferConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setPendingTransferConfig(json);
        setShowTransferConfirm(true);
      } catch (err) {
        alert("Fichier de configuration invalide.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const confirmTransferConfig = () => {
    if (!pendingTransferConfig) return;
    const json = pendingTransferConfig;
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
    setShowTransferConfirm(false);
    setPendingTransferConfig(null);
    alert("Configuration transférée avec succès. L'application va se recharger.");
    window.location.reload();
  };

  const cancelTransferConfig = () => {
    setShowTransferConfirm(false);
    setPendingTransferConfig(null);
  };`;

code = code.replace(oldHandler, newHandler);
fs.writeFileSync('src/components/TabSettings.tsx', code);
