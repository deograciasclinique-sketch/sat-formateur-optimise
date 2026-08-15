const fs = require('fs');
let code = fs.readFileSync('src/components/TabSettings.tsx', 'utf8');

const newBtn = `            <button
              type="button"
              onClick={() => {
                setNotifSupported(isNotificationSupported());
                setNotifPermission(getNotificationPermission());
              }}
              className="px-4 py-2 text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Actualiser le statut
            </button>`;

code = code.replace(`              <Send className="w-4 h-4" />
              Tester l'alerte
            </button>`, `              <Send className="w-4 h-4" />
              Tester l'alerte
            </button>
${newBtn}`);

fs.writeFileSync('src/components/TabSettings.tsx', code);
