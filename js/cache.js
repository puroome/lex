const createDbStore = (dbName, storeName) => ({
    db: null,
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                console.warn('IndexedDB not supported, caching disabled.');
                return resolve();
            }
            const request = indexedDB.open(dbName, 1);
            request.onupgradeneeded = event => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName);
                }
            };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => { console.error(`IndexedDB error (${dbName}):`, event.target.error); reject(event.target.error); };
        });
    },
    get(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve(null);
            try {
                const transaction = this.db.transaction([storeName], 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = event => { console.error(`IndexedDB get error (${dbName}):`, event.target.error); reject(event.target.error); };
            } catch (error) {
                reject(error);
            }
        });
    },
    save(key, data) {
        if (!this.db) return;
        try {
            const transaction = this.db.transaction([storeName], 'readwrite');
            transaction.objectStore(storeName).put(data, key);
        } catch (e) {
            console.error(`IndexedDB save error (${dbName}):`, e);
        }
    },
    clear() {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve();
            try {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const request = transaction.objectStore(storeName).clear();
                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            } catch (error) {
                reject(error);
            }
        });
    }
});

export const cache = {
    audio: createDbStore('ttsAudioCacheDB', 'audioStore'),
    translation: createDbStore('translationCacheDB', 'translationStore'),
    
    async init() {
        await this.audio.init();
        await this.translation.init();
    },

    async clearAll() {
        await this.audio.clear();
        await this.translation.clear();
    }
};
