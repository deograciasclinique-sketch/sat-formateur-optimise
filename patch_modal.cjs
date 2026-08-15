const fs = require('fs');
let code = fs.readFileSync('src/components/TabSettings.tsx', 'utf8');

// Insert states
code = code.replace(
  '  const [importedFileName, setImportedFileName] = useState<string>("");',
  '  const [importedFileName, setImportedFileName] = useState<string>("");\n  const [showTransferConfirm, setShowTransferConfirm] = useState(false);\n  const [pendingTransferConfig, setPendingTransferConfig] = useState<any>(null);'
);

fs.writeFileSync('src/components/TabSettings.tsx', code);
