const fs = require('fs');
let code = fs.readFileSync('src/components/TabConsultation.tsx', 'utf8');

const targetPlainte = '<label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block mb-1">Signes/symptômes dominants (10) *</label>';
const replacePlainte = `<div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block">Signes/symptômes dominants (10) *</label>
                <button
                  type="button"
                  onClick={() => startDictation("plainte")}
                  className={\`text-[10px] font-bold flex items-center gap-1 transition-all \${isDictating === "plainte" ? "text-rose-600 animate-pulse" : "text-stone-400 hover:text-indigo-600"}\`}
                  title={isDictating === "plainte" ? "Arrêter la dictée" : "Dicter la plainte"}
                >
                  {isDictating === "plainte" ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isDictating === "plainte" ? "Arrêter" : "Dicter"}
                </button>
              </div>`;

const targetExamen = '<label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block mb-1">Examen clinique physique (Signes, auscultation...)</label>';
const replaceExamen = `<div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block">Examen clinique physique (Signes, auscultation...)</label>
                <button
                  type="button"
                  onClick={() => startDictation("examen")}
                  className={\`text-[10px] font-bold flex items-center gap-1 transition-all \${isDictating === "examen" ? "text-rose-600 animate-pulse" : "text-stone-400 hover:text-indigo-600"}\`}
                  title={isDictating === "examen" ? "Arrêter la dictée" : "Dicter l'examen"}
                >
                  {isDictating === "examen" ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isDictating === "examen" ? "Arrêter" : "Dicter"}
                </button>
              </div>`;

const targetDiagnostic = '<label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block mb-1">Diagnostic (11) *</label>';
const replaceDiagnostic = `<div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block">Diagnostic (11) *</label>
                <button
                  type="button"
                  onClick={() => startDictation("diagnostic")}
                  className={\`text-[10px] font-bold flex items-center gap-1 transition-all \${isDictating === "diagnostic" ? "text-rose-600 animate-pulse" : "text-stone-400 hover:text-indigo-600"}\`}
                  title={isDictating === "diagnostic" ? "Arrêter la dictée" : "Dicter le diagnostic"}
                >
                  {isDictating === "diagnostic" ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  {isDictating === "diagnostic" ? "Arrêter" : "Dicter"}
                </button>
              </div>`;

code = code.replace(targetPlainte, replacePlainte);
code = code.replace(targetExamen, replaceExamen);
code = code.replace(targetDiagnostic, replaceDiagnostic);

fs.writeFileSync('src/components/TabConsultation.tsx', code);
