const fs = require('fs');
let code = fs.readFileSync('src/components/TabDocuments.tsx', 'utf8');

const leftover1 = `                ) : (
                  <div className="text-center text-stone-400 space-y-2">
                    <EyeOff className="w-8 h-8 text-stone-300 mx-auto" />
                    <p className="text-xs font-semibold">Aucun document en aperçu.</p>
                    <p className="text-[10px]">Cliquez sur un document à gauche pour l'afficher en taille réelle.</p>
                  </div>
                )}
              </div>
            </div>`;

const leftover2 = `                    ) : (
                      <div className="text-center text-stone-400 space-y-2">
                        <EyeOff className="w-8 h-8 text-stone-300 mx-auto" />
                        <p className="text-xs font-semibold">Aucun document en aperçu.</p>
                      </div>
                    )}
                  </div>
                </div>`;

code = code.replace(leftover1, '');
code = code.replace(leftover2, '');

fs.writeFileSync('src/components/TabDocuments.tsx', code);
