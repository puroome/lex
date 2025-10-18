// ================================================================
// API Service & Cache Controller
// ================================================================
import { app } from './main.js';

let database, ref, get, update, set;
document.addEventListener('firebaseSDKLoaded', () => {
    ({ getDatabase, ref, get, update, set } = window.firebaseSDK);
    database = getDatabase();
});

const audioCache = {
    db: null, dbName: 'ttsAudioCacheDB', storeName: 'audioStore',
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB not supported, TTS caching disabled.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(this.storeName)) { db.createObjectStore(this.storeName); } };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => { console.error("IndexedDB error:", event.target.error); reject(event.target.error); };
        });
    },
    getAudio(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve(null);
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => { console.error("IndexedDB get error:", event.target.error); reject(event.target.error); };
        });
    },
    saveAudio(key, audioData) {
        if (!this.db) return;
        try { const transaction = this.db.transaction([this.storeName], 'readwrite'); transaction.objectStore(this.storeName).put(audioData, key); } 
        catch (e) { console.error("IndexedDB save error:", e); }
    }
};

const translationCache = {
    db: null, dbName: 'translationCacheDB', storeName: 'translations',
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB not supported, translation caching disabled.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName); };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => { console.error("IndexedDB error for translation cache:", event.target.error); reject(event.target.error); };
        });
    },
    get(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) return resolve(null);
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => { console.error("IndexedDB get error:", event.target.error); reject(event.target.error); };
        });
    },
    save(key, data) {
        if (!this.db) return;
        try { const transaction = this.db.transaction([this.storeName], 'readwrite'); transaction.objectStore(this.storeName).put(data, key); } 
        catch (e) { console.error("IndexedDB save error:", e); }
    }
};

export const api = {
    audioCache,
    translationCache,

    async loadWordList(force = false) {
        if (force) {
            localStorage.removeItem('wordListCache');
            app.state.isWordListReady = false;
        }

        if (!app.state.isWordListReady) {
            try {
                const cachedData = localStorage.getItem('wordListCache');
                // 24시간 자동 캐싱 시간 체크 로직 삭제
                if (cachedData) {
                    const { words } = JSON.parse(cachedData);
                    app.state.wordList = words.sort((a, b) => a.index - b.index);
                    app.state.isWordListReady = true;
                }
            } catch (e) {
                console.error("캐시 로딩 실패:", e);
                localStorage.removeItem('wordListCache');
            }
        }
        
        // 캐시가 없거나 force=true일 경우에만 Firebase에서 데이터 로드
        if (!app.state.isWordListReady) {
            try {
                const dbRef = ref(database, '/vocabulary');
                const snapshot = await get(dbRef);
                const data = snapshot.val();
                if (!data) throw new Error("Firebase에 단어 데이터가 없습니다.");

                const wordsArray = Object.values(data).sort((a, b) => a.index - b.index);
                app.state.wordList = wordsArray;
                app.state.isWordListReady = true;

                // 타임스탬프 없이 단어 데이터만 저장
                localStorage.setItem('wordListCache', JSON.stringify({ words: wordsArray }));
            } catch (error) {
                console.error("Firebase에서 단어 목록 로딩 실패:", error);
                if (!app.state.isWordListReady) app.showFatalError(error.message);
                throw error;
            }
        }
    },

    async speak(text, contentType = 'word') {
        const voiceSets = {
            'UK': { 'word': { languageCode: 'en-GB', name: 'en-GB-Wavenet-D', ssmlGender: 'MALE' }, 'sample': { languageCode: 'en-GB', name: 'en-GB-Journey-D', ssmlGender: 'MALE' } },
            'US': { 'word': { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' }, 'sample': { languageCode: 'en-US', name: 'en-US-Journey-F', ssmlGender: 'FEMALE' } }
        };

        if (!text || !text.trim() || app.state.isSpeaking) return;
        if (app.state.audioContext.state === 'suspended') app.state.audioContext.resume();
        
        app.state.isSpeaking = true;
        const textWithoutEmoji = text.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, '');
        const processedText = textWithoutEmoji.replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');
        const voiceConfig = voiceSets[app.state.currentVoiceSet][contentType];
        
        const cacheKey = `${processedText}|${voiceConfig.languageCode}|${voiceConfig.name}`;

        const playAudio = async (audioArrayBuffer) => {
            const audioBuffer = await app.state.audioContext.decodeAudioData(audioArrayBuffer);
            const source = app.state.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(app.state.audioContext.destination);
            source.start(0);
            source.onended = () => { app.state.isSpeaking = false; };
        };

        try {
            const cachedAudio = await audioCache.getAudio(cacheKey);
            if (cachedAudio) {
                await playAudio(cachedAudio.slice(0)); 
                return;
            }

            const TTS_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${app.config.TTS_API_KEY}`;
            const response = await fetch(TTS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: { text: processedText }, voice: voiceConfig, audioConfig: { audioEncoding: 'MP3' } })
            });
            if (!response.ok) throw new Error(`TTS API Error: ${(await response.json()).error.message}`);
            
            const data = await response.json();
            const byteCharacters = atob(data.audioContent);
            const byteArray = new Uint8Array(byteCharacters.length).map((_, i) => byteCharacters.charCodeAt(i));
            const audioArrayBuffer = byteArray.buffer;
            
            audioCache.saveAudio(cacheKey, audioArrayBuffer.slice(0)); 
            
            await playAudio(audioArrayBuffer);

        } catch (error) {
            console.error('TTS 재생 또는 캐싱에 실패했습니다:', error);
            app.state.isSpeaking = false;
        }
    },
    async translate(text) {
        try {
            const cached = await translationCache.get(text);
            if (cached) {
                return cached;
            }
        } catch (e) {
            console.error("번역 캐시 조회 실패:", e);
        }

        if (!app.config.SCRIPT_URL || app.config.SCRIPT_URL === "여기에_배포된_APPS_SCRIPT_URL을_붙여넣으세요") {
            return "번역 스크립트 URL이 설정되지 않았습니다.";
        }

        const url = new URL(app.config.SCRIPT_URL);
        url.searchParams.append('action', 'translate');
        url.searchParams.append('text', text);

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            if (data.success) {
                const translatedText = data.translatedText;
                translationCache.save(text, translatedText);
                return translatedText;
            } else {
                throw new Error(data.message || '번역 실패');
            }
        } catch (error) {
            console.error('Translation failed:', error);
            return "번역 오류";
        }
    },
    async updateSRSData(word, isCorrect, quizType) {
        try {
            const safeKey = word.replace(/[.#$\[\]\/]/g, '_');
            const updates = {};
            const dbRef = ref(database);

            const srsKey = {
                'MULTIPLE_CHOICE_MEANING': 'srsMeaning',
                'FILL_IN_THE_BLANK': 'srsBlank',
                'MULTIPLE_CHOICE_DEFINITION': 'srsDefinition'
            }[quizType];

            if (srsKey) {
                updates[`/vocabulary/${safeKey}/${srsKey}`] = isCorrect ? 1 : 0;
            }

            if (!isCorrect) {
                 updates[`/vocabulary/${safeKey}/incorrect`] = 1;
                 updates[`/vocabulary/${safeKey}/lastIncorrect`] = new Date().toISOString();
            }
            
            await update(dbRef, updates);
            
            const wordIndex = app.state.wordList.findIndex(w => w.word === word);
            if(wordIndex !== -1) {
                if (srsKey) app.state.wordList[wordIndex][srsKey] = isCorrect ? 1 : 0;
                if (!isCorrect) {
                     app.state.wordList[wordIndex].incorrect = 1;
                     app.state.wordList[wordIndex].lastIncorrect = new Date().toISOString();
                }
                localStorage.setItem('wordListCache', JSON.stringify({ words: app.state.wordList }));
                document.dispatchEvent(new CustomEvent('wordListUpdated'));
            }

        } catch (error) {
            console.error('Firebase SRS 데이터 업데이트 실패:', error);
            app.showToast('학습 상태 업데이트에 실패했습니다.', true);
        }
    },
    async getLastLearnedIndex() {
        try {
            const snapshot = await get(ref(database, '/userState/lastLearnedIndex'));
            return snapshot.val() || 0;
        } catch (error) {
            console.error("Firebase에서 마지막 학습 위치 로딩 실패:", error);
            return 0;
        }
    },
    async setLastLearnedIndex(index) {
        try {
            await set(ref(database, '/userState/lastLearnedIndex'), index);
        } catch (error) {
            console.error("Firebase에 마지막 학습 위치 저장 실패:", error);
        }
    },
     async fetchDefinition(word) {
        const apiKey = app.config.DEFINITION_API_KEY;
        const url = `https://dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(word)}?key=${apiKey}`;
        
        try {
            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            if (Array.isArray(data) && data.length > 0) {
                const firstResult = data[0];
                if (typeof firstResult === 'object' && firstResult !== null && firstResult.shortdef && Array.isArray(firstResult.shortdef) && firstResult.shortdef.length > 0) {
                    return firstResult.shortdef[0];
                }
            }
            return null;
        } catch (e) {
            console.error(`Merriam-Webster API 호출 실패 for "${word}": ${e.message}`);
            return null;
        }
    }
};
