import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineDB extends DBSchema {
  offlineActions: {
    key: string;
    value: {
      id: string;
      actionType: string;
      payload: any;
      timestamp: number;
      status: 'pending' | 'processing' | 'failed';
    };
    indexes: { 'by-status': string };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

export const initOfflineDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>('dg-offline-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('offlineActions')) {
          const store = db.createObjectStore('offlineActions', {
            keyPath: 'id',
          });
          store.createIndex('by-status', 'status');
        }
      },
    });
  }
  return dbPromise;
};

export const addOfflineAction = async (actionType: string, payload: any) => {
  const db = await initOfflineDB();
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 11);
  await db.add('offlineActions', {
    id,
    actionType,
    payload,
    timestamp: Date.now(),
    status: 'pending',
  });
  
  window.dispatchEvent(new Event('offline-action-added'));
  if (navigator.onLine) {
    processOfflineQueue();
  }
};

export const getPendingActionsCount = async () => {
    try {
        const db = await initOfflineDB();
        const actions = await db.getAllFromIndex('offlineActions', 'by-status', 'pending');
        return actions.length;
    } catch (e) {
        console.error("Failed to get pending actions count", e);
        return 0;
    }
}

export const processOfflineQueue = async (actionHandlers?: Record<string, (payload: any) => Promise<void>>) => {
  if (!navigator.onLine) return;

  try {
    const db = await initOfflineDB();
    const actions = await db.getAllFromIndex('offlineActions', 'by-status', 'pending');

    actions.sort((a, b) => a.timestamp - b.timestamp);

    for (const action of actions) {
      try {
        action.status = 'processing';
        await db.put('offlineActions', action);
        
        if (actionHandlers && actionHandlers[action.actionType]) {
            await actionHandlers[action.actionType](action.payload);
        } else {
            console.log(`Processing offline action ${action.actionType}`, action.payload);
            await new Promise(res => setTimeout(res, 300));
        }
        
        await db.delete('offlineActions', action.id);
      } catch (err) {
        console.error(`Failed to process offline action ${action.id}:`, err);
        action.status = 'pending';
        await db.put('offlineActions', action);
      }
    }
    
    // Dispatch custom event when sync completes
    window.dispatchEvent(new Event('offline-sync-completed'));
  } catch (e) {
      console.error("Failed to process offline queue", e);
  }
};
