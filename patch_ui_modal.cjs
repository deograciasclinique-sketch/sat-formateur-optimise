const fs = require('fs');
let code = fs.readFileSync('src/components/TabSettings.tsx', 'utf8');

const modalUI = `      {showTransferConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className={\`w-full max-w-md p-6 rounded-2xl shadow-2xl border \${theme === 'dark' ? 'bg-stone-900 border-stone-800' : 'bg-white border-stone-200'}\`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100">Confirmation de Migration</h3>
                <p className="text-xs text-stone-500 font-semibold">Action irréversible</p>
              </div>
            </div>
            
            <p className="text-sm text-stone-600 dark:text-stone-400 font-medium leading-relaxed mb-6">
              Êtes-vous sûr de vouloir appliquer cette nouvelle configuration ? 
              <strong> Cela va écraser vos profils utilisateurs (staff) et vos seuils actuels.</strong>
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={cancelTransferConfig}
                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={confirmTransferConfig}
                className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Confirmer l'écrasement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Self-Healing & Diagnostics Engine */}`;

code = code.replace('{/* AI Self-Healing & Diagnostics Engine */}', modalUI);
fs.writeFileSync('src/components/TabSettings.tsx', code);
