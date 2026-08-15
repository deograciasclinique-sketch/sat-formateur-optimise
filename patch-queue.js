const fs = require('fs');
let code = fs.readFileSync('src/lib/offlineQueue.ts', 'utf8');
code = code.replace(
  "if (navigator.onLine) {",
  "window.dispatchEvent(new Event('offline-action-added'));\n  if (navigator.onLine) {"
);
fs.writeFileSync('src/lib/offlineQueue.ts', code);
