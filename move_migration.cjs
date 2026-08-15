const fs = require('fs');
let code = fs.readFileSync('src/components/TabSettings.tsx', 'utf8');

// Extract the Migration block
const migrationRegex = /\s*\{\/\* 🚀 Migration de Configuration \(Transfert Multi-Centres\) \*\/\}.*?\{\/\* 🌐 Espace Commercialisation SaaS & Gestion Multi-Clinique \(White-Label\) \*\/\}/s;
const match = code.match(migrationRegex);

if (match) {
  let migrationBlock = match[0].replace(/\s*\{\/\* 🌐 Espace Commercialisation SaaS & Gestion Multi-Clinique \(White-Label\) \*\/\}/, '');
  
  // Remove it from current location
  code = code.replace(migrationBlock, '');
  
  // Find the page header
  const headerEnd = '{/* Grid Configuration Panels */}';
  
  // Insert before Grid Configuration Panels
  code = code.replace(headerEnd, migrationBlock + '\n\n      ' + headerEnd);
  
  fs.writeFileSync('src/components/TabSettings.tsx', code);
  console.log("Moved successfully.");
} else {
  console.log("Could not find migration block.");
}
