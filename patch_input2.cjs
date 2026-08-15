const fs = require('fs');
let code = fs.readFileSync('src/components/TabConsultation.tsx', 'utf8');

const targetStr = `              <div className="col-span-2">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block mb-1">Nom et prénom(s) (2) *</label>
                <input
                  type="text"
                  placeholder="Prénom Nom"
                  value={consPatient}
                  onChange={(e) => setConsPatient(e.target.value)}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
              </div>`;

const replaceStr = `              <div className="col-span-2">
                <div className="flex justify-between items-end mb-1">
                  <label className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 block">Nom et prénom(s) (2) *</label>
                  {consPatient.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery(consPatient.trim())}
                      className="text-[10px] text-teal-600 font-bold hover:text-teal-700 hover:underline flex items-center gap-1"
                      title="Chercher dans l'historique"
                    >
                      <Search className="w-3 h-3" />
                      Historique
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  list="consult-patients-list"
                  placeholder="Rechercher ou saisir un patient..."
                  value={consPatient}
                  onChange={(e) => {
                     setConsPatient(e.target.value);
                     const match = knownPatientProfiles.find(p => p.patient === e.target.value);
                     if (match) {
                        setConsAge(match.age ? match.age.toString() : "");
                        setConsSexe(match.sexe);
                        if (match.contact) setConsContact(match.contact);
                        if (match.profession) setConsProfession(match.profession);
                        if (match.femmeEnceinte !== undefined) setConsFemmeEnceinte(match.femmeEnceinte);
                     }
                  }}
                  className="w-full text-xs border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:bg-white focus:outline-none"
                />
                <datalist id="consult-patients-list">
                  {knownPatientProfiles.map((p, idx) => (
                    <option key={idx} value={p.patient} />
                  ))}
                </datalist>
              </div>`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/components/TabConsultation.tsx', code);
