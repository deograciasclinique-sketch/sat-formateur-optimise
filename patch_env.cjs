const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

if (!code.includes('dotenv')) {
  code = 'import "dotenv/config";\n' + code;
  fs.writeFileSync('server.ts', code);
}
