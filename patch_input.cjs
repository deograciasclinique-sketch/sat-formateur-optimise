const fs = require('fs');
let code = fs.readFileSync('src/components/TabDocuments.tsx', 'utf8');

const targetStr = `            <div>
              <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block mb-1">Nom du patient associé *</label>
              <input
                type="text"
                placeholder="Ex: Madame Sanou Alimata"
                value={docPatient}
                onChange={(e) => setDocPatient(e.target.value)}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
            </div>`;

const replaceStr = `            <div>
              <div className="flex justify-between items-end mb-1">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block">Dossier patient *</label>
                {docPatient.trim() && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery(docPatient.trim())}
                    className="text-[10px] text-teal-600 font-bold hover:text-teal-700 hover:underline flex items-center gap-1"
                  >
                    <Search className="w-3 h-3" />
                    Afficher ses documents
                  </button>
                )}
              </div>
              <input
                type="text"
                list="patients-list"
                placeholder="Rechercher ou saisir un patient..."
                value={docPatient}
                onChange={(e) => {
                   setDocPatient(e.target.value);
                   // Optionally auto-filter list when picking a patient from datalist
                   if (knownPatients.includes(e.target.value)) {
                     setSearchQuery(e.target.value);
                   }
                }}
                className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
              />
              <datalist id="patients-list">
                {knownPatients.map((p, idx) => (
                  <option key={idx} value={p} />
                ))}
              </datalist>
            </div>`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/TabDocuments.tsx', code);
