const fs = require('fs');
let code = fs.readFileSync('src/components/TabConsultation.tsx', 'utf8');

const targetStr = `                        <button
                          type="button"
                          onClick={() => setSelectedConsultation(c)}
                          className="bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-teal-200 transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Dossier
                        </button>`;

const replaceStr = `                        <div className="flex flex-col gap-1 items-center">
                          <button
                            type="button"
                            onClick={() => setSelectedConsultation(c)}
                            className="bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-teal-200 transition-all inline-flex items-center gap-1 w-full justify-center"
                          >
                            <Eye className="w-3 h-3" /> Dossier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleContinuerDossier(c)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-indigo-200 transition-all inline-flex items-center gap-1 w-full justify-center"
                            title="Nouveau dossier pour ce patient"
                          >
                            <Plus className="w-3 h-3" /> Nouveau RDV
                          </button>
                        </div>`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/TabConsultation.tsx', code);
