// ================================================================
// App Main Controller
// ================================================================

// 전역 변수 선언 (Declare global variables)
let firebaseApp, database, auth;
let initializeApp, getDatabase, ref, get, update, set;
let getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup;

const app = {
    config: {
        TTS_API_KEY: "AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA",
        DEFINITION_API_KEY: "02d1892d-8fb1-4e2d-bc43-4ddd4a47eab3",
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzyBM33LzFsAe-mES_0Qw5B8w0ZPyYTDm4K_nLif5y2bXMpiQbD1LX5TTIDA4qX_Rnp/exec",
        ALLOWED_USER_EMAIL: "puroome@gmail.com",
    },
state: {
        isAppStarted: false,
        userId: null, // 로그인한 사용자의 고유 ID를 저장할 공간
        currentVoiceSet: 'UK',
        isSpeaking: false,
        audioContext: null,
        wordList: [],
        isWordListReady: false,
        longPressTimer: null,
        translationTimer: null,
    },
    elements: {
        // Login elements
        loginScreen: document.getElementById('login-screen'),
        googleLoginBtn: document.getElementById('google-login-btn'),
        loginError: document.getElementById('login-error'),
        logoutBtn: document.getElementById('logout-btn'),
        appWrapper: document.getElementById('app-wrapper'),
        
        // App elements
        selectionScreen: document.getElementById('selection-screen'),
        homeBtn: document.getElementById('home-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        ttsToggleBtn: document.getElementById('tts-toggle-btn'),
        ttsToggleText: document.getElementById('tts-toggle-text'),
        quizModeContainer: document.getElementById('quiz-mode-container'),
        learningModeContainer: document.getElementById('learning-mode-container'),
        dashboardContainer: document.getElementById('dashboard-container'),
        imeWarning: document.getElementById('ime-warning'),
        globalLoader: document.getElementById('global-loader'),
        noSampleMessage: document.getElementById('no-sample-message'),
        wordContextMenu: document.getElementById('word-context-menu'),
        searchAppContextBtn: document.getElementById('search-app-context-btn'),
        searchDaumContextBtn: document.getElementById('search-daum-context-btn'),
        searchNaverContextBtn: document.getElementById('search-naver-context-btn'),
        searchEtymContextBtn: document.getElementById('search-etym-context-btn'),
        searchLongmanContextBtn: document.getElementById('search-longman-context-btn'),
        selectLearningBtn: document.getElementById('select-learning-btn'),
        selectQuizBtn: document.getElementById('select-quiz-btn'),
        selectDashboardBtn: document.getElementById('select-dashboard-btn'),
        selectMistakesBtn: document.getElementById('select-mistakes-btn'),
        progressBarContainer: document.getElementById('progress-bar-container'),
        translationTooltip: document.getElementById('translation-tooltip'),
    },
    init() {
        this.initializeFirebaseAndAuth();
    },
    initializeFirebaseAndAuth() {
        const firebaseConfig = {
            apiKey: "AIzaSyAX-cFBU45qFZTAtLYPTolSzqqLTfEvjP0",
            authDomain: "word-91148.firebaseapp.com",
            databaseURL: "https://word-91148-default-rtdb.asia-southeast1.firebasedatabase.app",
            projectId: "word-91148",
            storageBucket: "word-91148.firebasestorage.app",
            messagingSenderId: "53576845185",
            appId: "1:53576845185:web:f519aa3ec751e12cb88a80"
        };
        firebaseApp = initializeApp(firebaseConfig);
        database = getDatabase(firebaseApp);
        auth = getAuth(firebaseApp);

onAuthStateChanged(auth, (user) => {
            if (user && user.email === this.config.ALLOWED_USER_EMAIL) {
                // 허용된 사용자가 로그인한 경우
                this.state.userId = user.uid; // 여기에 사용자 ID를 저장하는 코드를 추가합니다.
                this.elements.loginScreen.classList.add('hidden');
                this.elements.appWrapper.classList.remove('hidden');
                if (!this.state.isAppStarted) {
                    this.startApp();
                }
            } else {
                // 로그아웃 상태이거나 허용되지 않은 사용자인 경우
                this.elements.loginScreen.classList.remove('hidden');
                this.elements.appWrapper.classList.add('hidden');
                if (user) { // 허용되지 않은 사용자가 로그인 시도 시 자동 로그아웃
                    signOut(auth);
                }
            }
        });
        
        this.bindAuthEvents();
    },
    bindAuthEvents() {
        this.elements.googleLoginBtn.addEventListener('click', () => this.signInWithGoogle());
        this.elements.logoutBtn.addEventListener('click', () => signOut(auth));
    },
    async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        this.elements.loginError.textContent = '';
        try {
            await signInWithPopup(auth, provider);
            // onAuthStateChanged will handle the rest
        } catch (error) {
            console.error("Google Sign-In failed:", error);
            if (error.code === 'auth/popup-closed-by-user') {
                this.elements.loginError.textContent = '로그인 팝업이 닫혔습니다.';
            } else {
                this.elements.loginError.textContent = 'Google 로그인 중 오류가 발생했습니다.';
            }
        }
    },
async startApp() {
        this.state.isAppStarted = true;
        
        try {
            await audioCache.init();
            await translationCache.init();
        } catch (e) {
            console.error("오디오 또는 번역 캐시를 초기화할 수 없습니다.", e);
        }
        this.bindGlobalEvents();

        try {
            // 앱의 모든 기능이 단어 목록에 의존하므로, 가장 먼저 불러옵니다.
            await api.loadWordList();
        } catch (e) {
            // loadWordList가 이미 치명적 오류를 처리하므로, 여기서는 중단만 합니다.
            return;
        }

        quizMode.init();
        learningMode.init();
        dashboard.init();
        
        // 단어 목록이 준비되었으니, 첫 번째 영영풀이 퀴즈 예비 로딩을 시작합니다.
        quizMode.preloadNextDefinitionQuiz();

        const initialMode = window.location.hash.replace('#', '') || 'selection';
        history.replaceState({ mode: initialMode, options: {} }, '', window.location.href);
        this._renderMode(initialMode);
    },
    bindGlobalEvents() {
        this.elements.selectQuizBtn.addEventListener('click', () => this.navigateTo('quiz'));
        this.elements.selectLearningBtn.addEventListener('click', () => this.navigateTo('learning'));
        
        this.elements.selectDashboardBtn.addEventListener('click', async () => {
            this.navigateTo('dashboard');
            await new Promise(resolve => setTimeout(resolve, 10)); 
            dashboard.elements.content.innerHTML = `<div class="text-center p-10"><div class="loader mx-auto"></div><p class="mt-4 text-gray-600">최신 통계를 불러오는 중...</p></div>`;
            try {
                await api.loadWordList(true);
                dashboard.render();
            } catch (e) {
                dashboard.elements.content.innerHTML = `<div class="p-8 text-center text-red-600">통계 데이터를 불러오는데 실패했습니다: ${e.message}</div>`;
            }
        });

        this.elements.selectMistakesBtn.addEventListener('click', async () => {
            app.showToast('오답 노트를 불러오는 중...');
            try {
                await api.loadWordList(true);
                const mistakeWords = app.state.wordList
                    .filter(word => word.incorrect === 1)
                    .sort((a, b) => {
                        const dateA = a.lastIncorrect ? new Date(a.lastIncorrect) : new Date(0);
                        const dateB = b.lastIncorrect ? new Date(b.lastIncorrect) : new Date(0);
                        return dateB - dateA;
                    })
                    .map(wordObj => wordObj.word);

                if (mistakeWords.length === 0) {
                    app.showToast('오답 노트에 단어가 없습니다.', true);
                    return;
                }
                this.navigateTo('mistakeReview', { mistakeWords });
            } catch (e) {
                app.showToast(`오답 노트 로딩 실패: ${e.message}`, true);
            }
        });

        this.elements.homeBtn.addEventListener('click', () => this.navigateTo('selection'));
        this.elements.refreshBtn.addEventListener('click', () => this.forceReload());
        this.elements.ttsToggleBtn.addEventListener('click', this.toggleVoiceSet.bind(this));
        document.body.addEventListener('click', () => {
            if (!this.state.audioContext) {
                this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
        
        document.addEventListener('click', (e) => {
            if (!this.elements.wordContextMenu.contains(e.target)) {
                ui.hideWordContextMenu();
            }
        });

        window.addEventListener('popstate', (e) => {
            const mode = e.state?.mode || 'selection';
            const options = e.state?.options || {};
            this._renderMode(mode, options);
        });

        document.addEventListener('contextmenu', (e) => {
            const target = e.target;
            const isInteractiveTrigger = target.closest('.interactive-word, #word-display');
            const isCustomContextMenu = target.closest('#word-context-menu');
            if (!isInteractiveTrigger && !isCustomContextMenu) {
                e.preventDefault();
            }
        });
    },
    navigateTo(mode, options = {}) {
        if (history.state?.mode === mode && mode !== 'learning' && mode !== 'mistakeReview') return;

        const newPath = mode === 'selection' 
            ? window.location.pathname + window.location.search
            : `#${mode}`;

        history.pushState({ mode, options }, '', newPath);
        this._renderMode(mode, options);
    },
    _renderMode(mode, options = {}) {
        this.elements.selectionScreen.classList.add('hidden');
        this.elements.quizModeContainer.classList.add('hidden');
        this.elements.learningModeContainer.classList.add('hidden');
        this.elements.dashboardContainer.classList.add('hidden');
        this.elements.homeBtn.classList.add('hidden');
        this.elements.logoutBtn.classList.add('hidden');
        this.elements.ttsToggleBtn.classList.add('hidden');
        this.elements.progressBarContainer.classList.add('hidden');
        learningMode.elements.fixedButtons.classList.add('hidden');
        learningMode.elements.appContainer.classList.add('hidden');
        learningMode.elements.startScreen.classList.add('hidden');

        const showCommonButtons = () => {
            this.elements.homeBtn.classList.remove('hidden');
            this.elements.ttsToggleBtn.classList.remove('hidden');
        };

        if (mode === 'quiz') {
            showCommonButtons();
            this.elements.quizModeContainer.classList.remove('hidden');
            quizMode.reset();
} else if (mode === 'learning') {
            showCommonButtons();
            this.elements.learningModeContainer.classList.remove('hidden');

            // startIndex 옵션이 있는지 확인합니다.
            if (options.startIndex !== undefined && options.startIndex > -1) {
                // 옵션이 있으면, 바로 해당 단어의 어휘 카드를 보여줍니다.
                learningMode.state.isMistakeMode = false;
                learningMode.state.currentWordList = app.state.wordList;
                learningMode.state.currentIndex = options.startIndex;
                learningMode.launchApp();
            } else {
                // 옵션이 없으면, 기존처럼 단어 입력 화면을 보여줍니다.
                this.elements.learningModeContainer.querySelector('#learning-start-screen').classList.remove('hidden');
                learningMode.resetStartScreen();
            }
        } else if (mode === 'mistakeReview') {
            showCommonButtons();
            this.elements.learningModeContainer.classList.remove('hidden');
            const mistakeWords = options.mistakeWords;
            if (!mistakeWords || mistakeWords.length === 0) {
                app.showToast('오답 노트에 단어가 없습니다.', true);
                this.navigateTo('selection');
                return;
            }
            learningMode.startMistakeReview(mistakeWords);
        } else if (mode === 'dashboard') {
            this.elements.homeBtn.classList.remove('hidden');
            this.elements.dashboardContainer.classList.remove('hidden');
            dashboard.render();
        } else { // 'selection' 모드
            this.elements.selectionScreen.classList.remove('hidden');
            this.elements.logoutBtn.classList.remove('hidden');
            quizMode.reset();
            learningMode.reset();
        }
    },
    async forceReload() {
        this.elements.globalLoader.classList.remove('hidden');
        
        const elementsToDisable = [
            this.elements.refreshBtn, this.elements.selectDashboardBtn, this.elements.selectMistakesBtn,
            this.elements.selectLearningBtn, this.elements.selectQuizBtn
        ];

        elementsToDisable.forEach(el => el.classList.add('pointer-events-none', 'opacity-50'));
        
        try {
            await api.loadWordList(true);
            this.showToast('데이터를 성공적으로 새로고침했습니다!');
        } catch(e) {
            this.showToast('데이터 새로고침에 실패했습니다: ' + e.message, true);
        } finally {
            elementsToDisable.forEach(el => el.classList.remove('pointer-events-none', 'opacity-50'));
            this.elements.globalLoader.classList.add('hidden');
        }
    },
    showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `fixed top-20 left-1/2 -translate-x-1/2 text-white py-2 px-5 rounded-lg shadow-xl z-[200] text-lg font-semibold ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.transition = 'opacity 0.5s';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 500);
        }, 2500);
    },
    toggleVoiceSet() {
        const btn = this.elements.ttsToggleBtn;
        btn.classList.toggle('is-flipped');
        setTimeout(() => {
            this.state.currentVoiceSet = (this.state.currentVoiceSet === 'UK') ? 'US' : 'UK';
            this.elements.ttsToggleText.textContent = this.state.currentVoiceSet;
            btn.classList.toggle('bg-indigo-700', this.state.currentVoiceSet === 'UK');
            btn.classList.toggle('hover:bg-indigo-800', this.state.currentVoiceSet === 'UK');
            btn.classList.toggle('bg-red-500', this.state.currentVoiceSet === 'US');
            btn.classList.toggle('hover:bg-red-600', this.state.currentVoiceSet === 'US');
        }, 250);
    },
    showFatalError(message) {
        const selectionDiv = this.elements.selectionScreen;
        selectionDiv.innerHTML = `<div class="p-8 text-center"><h1 class="text-3xl font-bold text-red-600 mb-4">앱 시작 실패</h1><p class="text-gray-700 mb-6">Firebase에서 데이터를 불러오는 중 문제가 발생했습니다. <br>네트워크 연결을 확인하고 잠시 후 페이지를 새로고침 해주세요.</p><div class="bg-red-50 text-red-700 p-4 rounded-lg text-left text-sm break-all"><p class="font-semibold">오류 정보:</p><p>${message}</p></div></div>`;
        this.elements.appWrapper.classList.remove('hidden'); // Show wrapper to display error
        this.elements.selectionScreen.classList.remove('hidden');
        this.elements.quizModeContainer.classList.add('hidden');
        this.elements.learningModeContainer.classList.add('hidden');
    },
    showImeWarning() {
        this.elements.imeWarning.classList.remove('hidden');
        clearTimeout(this.imeWarningTimeout);
        this.imeWarningTimeout = setTimeout(() => {
            this.elements.imeWarning.classList.add('hidden');
        }, 2000);
    },
    showNoSampleMessage() {
        const msgEl = this.elements.noSampleMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500);
    },
searchWordInLearningMode(word) {
        if (!word) return;

        // 1. 학습 모드의 첫 화면(단어 입력창)으로 이동합니다.
        this.navigateTo('learning');

        // 2. 화면이 완전히 그려질 시간을 아주 잠깐 (0.01초) 줍니다.
        setTimeout(() => {
            // 3. 단어 입력창을 찾아서, 넘어온 단어를 값으로 넣어줍니다.
            learningMode.elements.startWordInput.value = word;
            
            // 4. *** 여기가 핵심입니다 ***
            // "혹시 이 단어를 찾으시나요?" 기능이 포함된 '학습 시작' 함수를 그대로 실행합니다.
            learningMode.start();
            
            // 5. 열려있던 팝업 메뉴를 닫습니다.
            ui.hideWordContextMenu();
        }, 10);
    },
};

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

// 번역 캐시 로직 추가
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


const api = {
    async loadWordList(force = false) {
        if (force) {
            localStorage.removeItem('wordListCache');
            app.state.isWordListReady = false;
        }

        if (!app.state.isWordListReady) {
            try {
                const cachedData = localStorage.getItem('wordListCache');
                if (cachedData) {
                    const { timestamp, words } = JSON.parse(cachedData);
                    if (Date.now() - timestamp < 864000000) { // 240 hours
                        // 캐시에서 불러온 데이터도 index 기준으로 정렬합니다.
                        app.state.wordList = words.sort((a, b) => a.index - b.index);
                        app.state.isWordListReady = true;
                    }
                }
            } catch (e) {
                console.error("캐시 로딩 실패:", e);
                localStorage.removeItem('wordListCache');
            }
        }
        
        if (app.state.isWordListReady && !force) return;

        try {
            const dbRef = ref(database, '/vocabulary');
            const snapshot = await get(dbRef);
            const data = snapshot.val();
            if (!data) throw new Error("Firebase에 단어 데이터가 없습니다.");

            // 중요: Firebase에서 받은 데이터를 index 기준으로 정렬합니다.
            const wordsArray = Object.values(data).sort((a, b) => a.index - b.index);
            
            app.state.wordList = wordsArray;
            app.state.isWordListReady = true;

            const cachePayload = { timestamp: Date.now(), words: wordsArray };
            localStorage.setItem('wordListCache', JSON.stringify(cachePayload));
        } catch (error) {
            console.error("Firebase에서 단어 목록 로딩 실패:", error);
            if (!app.state.isWordListReady) app.showFatalError(error.message);
            throw error;
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
                localStorage.setItem('wordListCache', JSON.stringify({ timestamp: Date.now(), words: app.state.wordList }));
                document.dispatchEvent(new CustomEvent('wordListUpdated'));
            }

        } catch (error) {
            console.error('Firebase SRS 데이터 업데이트 실패:', error);
            app.showToast('학습 상태 업데이트에 실패했습니다.', true);
        }
    },
async getLastLearnedIndex() {
        if (!app.state.userId) return 0; // 사용자 ID가 없으면 첫 단어로 시작
        try {
            const path = `/userState/${app.state.userId}/lastLearnedIndex`;
            const snapshot = await get(ref(database, path));
            return snapshot.val() || 0;
        } catch (error) {
            console.error("Firebase에서 마지막 학습 위치 로딩 실패:", error);
            return 0;
        }
    },
async setLastLearnedIndex(index) {
        if (!app.state.userId) return; // 사용자 ID가 없으면 저장하지 않음
        try {
            const path = `/userState/${app.state.userId}/lastLearnedIndex`;
            await set(ref(database, path), index);
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

const ui = {
    async copyToClipboard(text) {
        if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(text); } 
            catch (err) { console.error('클립보드 복사 실패:', err); }
        }
    },
    createInteractiveFragment(text, isForSampleSentence = false) {
        const fragment = document.createDocumentFragment();
        if (!text || !text.trim()) return fragment;
    
        const parts = text.split(/([a-zA-Z0-9'-]+)/g);
        
        parts.forEach(part => {
            if (/([a-zA-Z0-9'-]+)/.test(part) && learningMode.nonInteractiveWords && !learningMode.nonInteractiveWords.has(part.toLowerCase())) {
                 const span = document.createElement('span');
                span.textContent = part;
                span.className = 'interactive-word';
                span.onclick = (e) => {
                    if (isForSampleSentence) e.stopPropagation();
                    clearTimeout(app.state.longPressTimer);
                    api.speak(part, 'word');
                    this.copyToClipboard(part);
                };
                span.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (isForSampleSentence) e.stopPropagation();
                    this.showWordContextMenu(e, part);
                };
                 let touchMove = false;
                span.addEventListener('touchstart', (e) => {
                    if (isForSampleSentence) e.stopPropagation();
                    touchMove = false;
                    clearTimeout(app.state.longPressTimer);
                    app.state.longPressTimer = setTimeout(() => { if (!touchMove) { this.showWordContextMenu(e, part); } }, 700);
                }, { passive: true });
                span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); });
                span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });
                fragment.appendChild(span);
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        });
        return fragment;
    },
    renderExplanationText(targetElement, text) {
        targetElement.innerHTML = '';
        if (!text || !text.trim()) return;
        const regex = /(\[.*?\])|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g;
        text.split('\n').forEach((line, lineIndex, lineArr) => {
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(line))) {
                if (match.index > lastIndex) {
                    targetElement.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
                }
                const [_, nonClickable, englishPhrase] = match;
                if (englishPhrase) {
                    const span = document.createElement('span');
                    span.textContent = englishPhrase;
                    span.className = 'interactive-word';
                    span.onclick = () => {
                        clearTimeout(app.state.longPressTimer);
                        api.speak(englishPhrase, 'word');
                        this.copyToClipboard(englishPhrase);
                    };
                    span.oncontextmenu = (e) => { e.preventDefault(); this.showWordContextMenu(e, englishPhrase); };
                    let touchMove = false;
                    span.addEventListener('touchstart', (e) => {
                        touchMove = false;
                        clearTimeout(app.state.longPressTimer);
                        app.state.longPressTimer = setTimeout(() => { if (!touchMove) this.showWordContextMenu(e, englishPhrase); }, 700);
                    }, { passive: true });
                    span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); });
                    span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });
                    targetElement.appendChild(span);
                } else if (nonClickable) {
                    targetElement.appendChild(document.createTextNode(nonClickable));
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) {
                targetElement.appendChild(document.createTextNode(line.substring(lastIndex)));
            }
            if (lineIndex < lineArr.length - 1) {
                targetElement.appendChild(document.createElement('br'));
            }
        });
    },
displaySentences(sentences, containerElement) {
        containerElement.innerHTML = '';
        sentences.filter(s => s && s.trim()).forEach(sentence => {
            const p = document.createElement('p');
            p.className = 'p-2 rounded transition-colors hover:bg-gray-200 cursor-pointer';

            const showTranslation = async (event) => {
                const translatedText = await api.translate(p.textContent);
                this.showTranslationTooltip(translatedText, event);
            };

            p.onclick = (e) => {
                if (e.target.closest('.sentence-content-area')) return;
                api.speak(p.textContent, 'sample');
                showTranslation(e);
            };
            
            // p 태그(전체 영역)에 마우스를 올리면 일단 번역 타이머를 시작합니다.
            p.addEventListener('mouseenter', (e) => {
                clearTimeout(app.state.translationTimer);
                app.state.translationTimer = setTimeout(() => {
                    showTranslation(e);
                }, 1000);
            });

            // p 태그(전체 영역)에서 마우스가 벗어나면 타이머를 취소하고 툴팁을 숨깁니다.
            p.addEventListener('mouseleave', () => {
                clearTimeout(app.state.translationTimer);
                this.hideTranslationTooltip();
            });

            const sentenceContent = document.createElement('span');
            sentenceContent.className = 'sentence-content-area';
            
            // *** 핵심 수정 ***
            // 텍스트 영역(sentenceContent)에 마우스가 들어오면, p에서 시작된 타이머를 취소하고 툴팁을 숨깁니다.
            sentenceContent.addEventListener('mouseenter', () => {
                clearTimeout(app.state.translationTimer);
                this.hideTranslationTooltip();
            });

            const sentenceParts = sentence.split(/(\*.*?\*)/g);
            sentenceParts.forEach(part => {
                if (part.startsWith('*') && part.endsWith('*')) {
                    const strong = document.createElement('strong');
                    strong.appendChild(this.createInteractiveFragment(part.slice(1, -1), true));
                    sentenceContent.appendChild(strong);
                } else if (part) {
                    sentenceContent.appendChild(this.createInteractiveFragment(part, true));
                }
            });
            p.appendChild(sentenceContent);
            containerElement.appendChild(p);
        });
    },
showTranslationTooltip(text, event) {
        const tooltip = app.elements.translationTooltip;
        tooltip.textContent = text;
        tooltip.classList.remove('hidden');
        
        const rect = event.target.getBoundingClientRect();
        
        // 스크롤된 Y축의 값을 더해서 실제 페이지 내의 절대 위치를 계산합니다.
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // 툴팁의 위치를 마우스 포인터가 아닌, 문장(p 태그)의 위치를 기준으로 설정합니다.
        tooltip.style.left = `${rect.left}px`;
        tooltip.style.top = `${rect.bottom + scrollTop + 5}px`;
    },
    hideTranslationTooltip() {
        app.elements.translationTooltip.classList.add('hidden');
    },
    showWordContextMenu(event, word, options = {}) {
        event.preventDefault();
        const menu = app.elements.wordContextMenu;

        app.elements.searchAppContextBtn.style.display = options.hideAppSearch ? 'none' : 'block';
        
        const touch = event.touches ? event.touches[0] : null;
        const x = touch ? touch.clientX : event.clientX;
        const y = touch ? touch.clientY : event.clientY;

        menu.style.top = `${y}px`;
        menu.style.left = `${x}px`;
        menu.classList.remove('hidden');

        const encodedWord = encodeURIComponent(word);

        app.elements.searchAppContextBtn.onclick = () => app.searchWordInLearningMode(word);
        app.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encodedWord}`); this.hideWordContextMenu(); };
        app.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`); this.hideWordContextMenu(); };
        app.elements.searchEtymContextBtn.onclick = () => { window.open(`https://www.etymonline.com/search?q=${encodedWord}`); this.hideWordContextMenu(); };
        app.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`); this.hideWordContextMenu(); };
    },
    hideWordContextMenu() {
        app.elements.wordContextMenu.classList.add('hidden');
    }
};

const utils = {
    levenshteinDistance(a = '', b = '') {
        const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        for (let i = 0; i <= a.length; i += 1) track[0][i] = i;
        for (let j = 0; j <= b.length; j += 1) track[j][0] = j;
        for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator);
            }
        }
        return track[b.length][a.length];
    },
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};

const dashboard = {
    elements: {
        container: document.getElementById('dashboard-container'),
        content: document.getElementById('dashboard-content'),
    },
    init() {
        document.addEventListener('wordListUpdated', () => {
            if (!this.elements.container.classList.contains('hidden')) {
                this.render();
            }
        });
    },
    render() {
        if (!app.state.isWordListReady) {
            this.elements.content.innerHTML = `<div class="text-center p-10"><p class="text-gray-600">단어 목록을 먼저 불러와주세요.</p></div>`;
            return;
        }

        const wordList = app.state.wordList;
        const totalWords = wordList.length;
        const stages = [
            { name: '새 단어', count: 0, color: 'bg-gray-400' },
            { name: '학습 중', count: 0, color: 'bg-blue-500' },
            { name: '익숙함', count: 0, color: 'bg-yellow-500' },
            { name: '학습 완료', count: 0, color: 'bg-green-500' }
        ];
        wordList.forEach(word => {
            const { srsMeaning, srsBlank, srsDefinition } = word;
            if ((srsMeaning === null || srsMeaning === undefined) && (srsBlank === null || srsBlank === undefined) && (srsDefinition === null || srsDefinition === undefined)) {
                stages[0].count++; return;
            }
            const score = (srsMeaning === 1 ? 1 : 0) + (srsBlank === 1 ? 1 : 0) + (srsDefinition === 1 ? 1 : 0);
            if (score === 3) stages[3].count++;
            else if (score === 2) stages[2].count++;
            else stages[1].count++;
        });

        let contentHTML = `<div class="bg-gray-50 p-4 rounded-lg shadow-inner text-center"><p class="text-lg text-gray-600">총 단어 수</p><p class="text-4xl font-bold text-gray-800">${totalWords}</p></div><div><h2 class="text-xl font-bold text-gray-700 mb-3 text-center">학습 단계별 분포</h2><div class="space-y-4">`;
        stages.forEach(stage => {
            const percentage = totalWords > 0 ? ((stage.count / totalWords) * 100).toFixed(1) : 0;
            contentHTML += `<div class="w-full"><div class="flex justify-between items-center mb-1"><span class="text-base font-semibold text-gray-700">${stage.name}</span><span class="text-sm font-medium text-gray-500">${stage.count}개 (${percentage}%)</span></div><div class="w-full bg-gray-200 rounded-full h-4"><div class="${stage.color} h-4 rounded-full" style="width: ${percentage}%"></div></div></div>`;
        });
        contentHTML += `</div></div>`;
        this.elements.content.innerHTML = contentHTML;
    }
};

// ================================================================
// Quiz Mode Controller
// ================================================================
const quizMode = {
    state: {
        quizType: null,
        currentQuiz: null,
        sessionAnsweredInSet: 0,
        sessionCorrectInSet: 0,
        sessionMistakes: [],
        answeredWords: new Set(),
        preloadedDefinitionQuiz: null, // 미리 불러온 영영풀이 퀴즈를 저장할 공간
        preloadingDefinitionWord: null, // 현재 불러오는 중인 단어를 기록 (중복 방지)
    },
    elements: {},
    init() {
        this.elements = {
            quizSelectionScreen: document.getElementById('quiz-selection-screen'),
            startMeaningQuizBtn: document.getElementById('start-meaning-quiz-btn'),
            startBlankQuizBtn: document.getElementById('start-blank-quiz-btn'),
            startDefinitionQuizBtn: document.getElementById('start-definition-quiz-btn'),
            loader: document.getElementById('quiz-loader'),
            loaderText: document.getElementById('quiz-loader-text'),
            contentContainer: document.getElementById('quiz-content-container'),
            questionDisplay: document.getElementById('quiz-question-display'),
            choices: document.getElementById('quiz-choices'),
            modal: document.getElementById('quiz-result-modal'),
            modalScore: document.getElementById('quiz-result-score'),
            modalMistakesBtn: document.getElementById('quiz-result-mistakes-btn'),
            modalContinueBtn: document.getElementById('quiz-result-continue-btn'),
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startMeaningQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_MEANING'));
        this.elements.startBlankQuizBtn.addEventListener('click', () => this.start('FILL_IN_THE_BLANK'));
        this.elements.startDefinitionQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_DEFINITION'));
        this.elements.modalContinueBtn.addEventListener('click', () => this.continueAfterResult());
        this.elements.modalMistakesBtn.addEventListener('click', () => this.reviewSessionMistakes());

        document.addEventListener('keydown', (e) => {
            const isQuizModeActive = !this.elements.contentContainer.classList.contains('hidden') && !this.elements.choices.classList.contains('disabled');
            if (!isQuizModeActive) return;

            if (e.key >= '1' && e.key <= '4') {
                e.preventDefault();
                this.elements.choices.children[parseInt(e.key) - 1]?.click();
            } else if (e.key === 'p' || e.key === 'P' || e.key === '0') {
                e.preventDefault();
                Array.from(this.elements.choices.children).find(el => el.textContent.includes('PASS'))?.click();
            }
        });
    },
async start(quizType) {
        this.reset();
        this.state.quizType = quizType;
        this.elements.quizSelectionScreen.classList.add('hidden');
        // 단어 목록은 이미 로드되었으므로, 해당 로직을 제거하고 바로 퀴즈를 표시합니다.
        if (!app.state.isWordListReady) {
            app.showToast("단어 목록이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.", true);
            app.navigateTo('selection');
            return;
        }
        this.displayNextQuiz();
    },
    reset() {
        this.state.quizType = null;
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        this.state.answeredWords.clear();
        this.elements.quizSelectionScreen.classList.remove('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.contentContainer.classList.add('hidden');
        this.elements.modal.classList.add('hidden');
    },
    async generateSingleQuiz() {
        const allWords = app.state.wordList;
        if (allWords.length < 5) return null;

        const getCandidates = (wordList) => {
            if (this.state.quizType === 'MULTIPLE_CHOICE_MEANING') return wordList.filter(w => w.srsMeaning !== 1 && !this.state.answeredWords.has(w.word));
            if (this.state.quizType === 'FILL_IN_THE_BLANK') return wordList.filter(w => w.srsBlank !== 1 && w.sample && w.sample.trim() !== '' && !this.state.answeredWords.has(w.word));
            if (this.state.quizType === 'MULTIPLE_CHOICE_DEFINITION') return wordList.filter(w => w.srsDefinition !== 1 && !this.state.answeredWords.has(w.word));
            return [];
        };

        const reviewCandidates = utils.shuffleArray(getCandidates(allWords));
        if (reviewCandidates.length === 0) return null;

        for (const wordData of reviewCandidates) {
            let quiz = null;
            if (this.state.quizType === 'MULTIPLE_CHOICE_MEANING') quiz = this.createMeaningQuiz(wordData, allWords);
            else if (this.state.quizType === 'FILL_IN_THE_BLANK') quiz = this.createBlankQuiz(wordData, allWords);
            else if (this.state.quizType === 'MULTIPLE_CHOICE_DEFINITION') quiz = await this.createDefinitionQuiz(wordData, allWords);
            if (quiz) return quiz;
        }
        return null;
    },
async displayNextQuiz() {
        this.showLoader(true, "다음 문제 생성 중...");
        let nextQuiz = null;

        // 만약 현재 퀴즈가 영영풀이이고, 미리 불러온 퀴즈가 있다면 그것을 사용합니다.
        if (this.state.quizType === 'MULTIPLE_CHOICE_DEFINITION' && this.state.preloadedDefinitionQuiz) {
            nextQuiz = this.state.preloadedDefinitionQuiz;
            this.state.preloadedDefinitionQuiz = null; // 사용했으니 비워줍니다.
        } else {
            // 그렇지 않으면 기존처럼 즉석에서 퀴즈를 생성합니다.
            nextQuiz = await this.generateSingleQuiz();
        }
        
        if (nextQuiz) {
            this.state.currentQuiz = nextQuiz;
            this.state.answeredWords.add(nextQuiz.question.word);
            this.showLoader(false);
            this.renderQuiz(nextQuiz);

            // 현재 퀴즈가 영영풀이라면, 다음 퀴즈를 미리 불러오도록 명령합니다.
            if (this.state.quizType === 'MULTIPLE_CHOICE_DEFINITION') {
                this.preloadNextDefinitionQuiz();
            }
        } else {
            app.showToast('풀 수 있는 모든 퀴즈를 완료했습니다!', false);
            if (this.state.sessionAnsweredInSet > 0) {
                this.showSessionResultModal(true);
            } else {
                app.navigateTo('selection');
            }
        }
    },
    renderQuiz(quizData) {
        const { type, question, choices } = quizData;
        const questionDisplay = this.elements.questionDisplay;
        questionDisplay.innerHTML = '';
        questionDisplay.classList.remove('justify-center', 'items-center');

        if (type === 'FILL_IN_THE_BLANK') {
            const p = document.createElement('p');
            p.className = 'text-xl sm:text-2xl text-left text-gray-800 leading-relaxed';
            const parts = question.sentence_with_blank.split('___BLANK___');
            parts.forEach((part, index) => {
                const textParts = part.split(/(\*.*?\*)/g);
                textParts.forEach(textPart => {
                    if (textPart.startsWith('*') && textPart.endsWith('*')) {
                        const strong = document.createElement('strong');
                        strong.textContent = textPart.slice(1, -1);
                        p.appendChild(strong);
                    } else {
                        p.appendChild(document.createTextNode(textPart));
                    }
                });

                if (index < parts.length - 1) {
                    const blankSpan = document.createElement('span');
                    blankSpan.className = 'quiz-blank';
                    blankSpan.textContent = '＿＿＿＿';
                    p.appendChild(blankSpan);
                }
            });
            questionDisplay.appendChild(p);
        } else if (type === 'MULTIPLE_CHOICE_MEANING') {
            questionDisplay.classList.add('justify-center', 'items-center');
            questionDisplay.innerHTML = `<h1 id="quiz-word" class="text-3xl sm:text-4xl font-bold text-center text-gray-800 cursor-pointer">${question.word}</h1>`;
            questionDisplay.querySelector('#quiz-word').onclick = () => { api.speak(question.word, 'word'); ui.copyToClipboard(question.word); };
        } else if (type === 'MULTIPLE_CHOICE_DEFINITION') {
            questionDisplay.innerHTML = `<p class="text-lg sm:text-xl text-left text-gray-800 leading-relaxed">${question.definition}</p>`;
        }

        this.elements.choices.innerHTML = '';
        choices.forEach((choice, index) => {
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer flex items-start transition-all';
            li.innerHTML = `<span class="font-bold mr-3">${index + 1}.</span> <span>${choice}</span>`;
            li.onclick = () => this.checkAnswer(li, choice);
            this.elements.choices.appendChild(li);
        });
        
        const passLi = document.createElement('li');
        passLi.className = 'choice-item border-2 border-red-500 bg-red-500 hover:bg-red-600 text-white p-4 rounded-lg cursor-pointer flex items-center justify-center transition-all font-bold text-lg';
        passLi.innerHTML = `<span>PASS</span>`;
        passLi.onclick = () => this.checkAnswer(passLi, 'USER_PASSED');
        this.elements.choices.appendChild(passLi);

        this.elements.choices.classList.remove('disabled');
    },
    async checkAnswer(selectedLi, selectedChoice) {
        this.elements.choices.classList.add('disabled');
        const isCorrect = selectedChoice === this.state.currentQuiz.answer;
        
        selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect) {
            Array.from(this.elements.choices.children).find(li => li.textContent.includes(this.state.currentQuiz.answer))?.classList.add('correct');
            this.state.sessionMistakes.push(this.state.currentQuiz.question.word);
        }
        
        this.state.sessionAnsweredInSet++;
        if (isCorrect) this.state.sessionCorrectInSet++;

        await api.updateSRSData(this.state.currentQuiz.question.word, isCorrect, this.state.quizType);
        
        setTimeout(() => {
            if (this.state.sessionAnsweredInSet >= 10) {
                this.showSessionResultModal();
            } else {
                this.displayNextQuiz();
            }
        }, 300);
    },
    showLoader(isLoading, message = '퀴즈를 준비 중입니다...') {
        this.elements.loader.classList.toggle('hidden', !isLoading);
        this.elements.loaderText.textContent = message;
        this.elements.contentContainer.classList.toggle('hidden', isLoading);
    },
    showSessionResultModal(isFinal = false) {
        this.elements.modalScore.textContent = `${this.state.sessionAnsweredInSet}문제 중 ${this.state.sessionCorrectInSet}개 정답!`;
        this.elements.modalMistakesBtn.classList.toggle('hidden', this.state.sessionMistakes.length === 0);
        this.elements.modalContinueBtn.textContent = isFinal ? "메인으로 돌아가기" : "다음 퀴즈 계속";
        this.elements.modal.classList.remove('hidden');
    },
    continueAfterResult() {
        this.elements.modal.classList.add('hidden');
        if (this.elements.modalContinueBtn.textContent === "메인으로 돌아가기") {
            app.navigateTo('selection');
            return;
        }
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        this.displayNextQuiz();
    },
    async preloadNextDefinitionQuiz() {
        // 이미 불러온 퀴즈가 있거나, 현재 다른 퀴즈를 불러오는 중이면 실행하지 않습니다.
        if (this.state.preloadedDefinitionQuiz || this.state.preloadingDefinitionWord) {
            return;
        }

        const allWords = app.state.wordList;
        if (allWords.length < 5) return;

        // 아직 풀지 않은 영영풀이 퀴즈 후보 단어들을 찾습니다.
        const candidates = utils.shuffleArray(allWords.filter(w => 
            w.srsDefinition !== 1 && 
            !this.state.answeredWords.has(w.word)
        ));

        for (const wordData of candidates) {
            try {
                this.state.preloadingDefinitionWord = wordData.word; // "지금 이 단어 불러오는 중" 이라고 기록
                
                const quiz = await this.createDefinitionQuiz(wordData, allWords);
                
                if (quiz) {
                    this.state.preloadedDefinitionQuiz = quiz; // 성공하면 예비 퀴즈 저장소에 저장
                    this.state.preloadingDefinitionWord = null; // 기록 삭제
                    return; // 하나만 미리 불러오고 함수 종료
                }
            } catch (error) {
                // 에러 발생 시 다음 후보 단어로 계속 진행
            }
        }
        // 모든 후보를 시도했지만 실패한 경우
        this.state.preloadingDefinitionWord = null; // 기록 삭제
    },
    
    reviewSessionMistakes() {
        this.elements.modal.classList.add('hidden');
        const mistakes = [...this.state.sessionMistakes];
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        app.navigateTo('mistakeReview', { mistakeWords: mistakes });
    },
    createMeaningQuiz(correctWordData, allWordsData) {
        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.meaning !== correctWordData.meaning);
        utils.shuffleArray(candidates);
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.meaning));
        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.meaning !== correctWordData.meaning) wrongAnswers.add(randomWord.meaning);
        }
        const choices = utils.shuffleArray([correctWordData.meaning, ...Array.from(wrongAnswers)]);
        return { type: 'MULTIPLE_CHOICE_MEANING', question: { word: correctWordData.word }, choices, answer: correctWordData.meaning };
    },
createBlankQuiz(correctWordData, allWordsData) {
        if (!correctWordData.sample || correctWordData.sample.trim() === '') return null;
        
        // 예문에서 이모지와 함께 별표(*)도 모두 제거합니다.
        const firstLine = correctWordData.sample.split('\n')[0]
            .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "")
            .replace(/\*/g, '') // 별표(*)를 제거하는 코드를 추가했습니다.
            .trim();

        const placeholderRegex = new RegExp(`\\b${correctWordData.word}\\b`, 'i');
        
        if (!firstLine.match(placeholderRegex)) return null;

        const sentenceWithBlank = firstLine.replace(placeholderRegex, "___BLANK___").trim();

        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.word !== correctWordData.word);
        utils.shuffleArray(candidates);
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));
        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) wrongAnswers.add(randomWord.word);
        }
        const choices = utils.shuffleArray([correctWordData.word, ...Array.from(wrongAnswers)]);
        return { type: 'FILL_IN_THE_BLANK', question: { sentence_with_blank: sentenceWithBlank, word: correctWordData.word }, choices, answer: correctWordData.word };
    },
    async createDefinitionQuiz(correctWordData, allWordsData) {
        const definition = await api.fetchDefinition(correctWordData.word);
        if (!definition) return null;
        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.word !== correctWordData.word);
        utils.shuffleArray(candidates);
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));
        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) wrongAnswers.add(randomWord.word);
        }
        const choices = utils.shuffleArray([correctWordData.word, ...Array.from(wrongAnswers)]);
        return { type: 'MULTIPLE_CHOICE_DEFINITION', question: { definition, word: correctWordData.word }, choices, answer: correctWordData.word };
    }
};

const learningMode = {
    state: {
        currentIndex: 0,
        isMistakeMode: false,
        currentWordList: [],
        isDragging: false,
        touchStartX: 0, // 스와이프 시작 X좌표를 기록할 변수
        touchStartY: 0, // 스와이프 시작 Y좌표를 기록할 변수
    },
    nonInteractiveWords: new Set(['a', 'an', 'the', 'I', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs', 'this', 'that', 'these', 'those', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves',
                                  'something', 'anybody', 'anyone', 'anything', 'nobody', 'no one', 'nothing', 'everybody', 'everyone', 'everything', 'all', 'any', 'both', 'each', 'either', 'every', 'few', 'little', 'many', 'much', 'neither', 'none', 'one', 'other', 'several', 'some', 'about', 'above', 'across', 'after', 'against', 'along',
                                  'among', 'around', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'down', 'during', 'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'since', 'through', 'throughout', 'to', 'toward', 'under', 'underneath', 'until', 'unto',
                                  'up', 'upon', 'with', 'within', 'without', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'after', 'although', 'as', 'because', 'before', 'if', 'once', 'since', 'than', 'that', 'though', 'till', 'unless', 'until', 'when', 'whenever', 'where', 'whereas', 'wherever', 'whether', 'while', 'that', 'which', 'who', 'whom', 'whose',
                                  'when', 'where', 'why', 'what', 'whatever', 'whichever', 'whoever', 'whomever', 'who', 'whom', 'whose', 'what', 'which', 'when', 'where', 'why', 'how', 'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'done', 'can', 'could', 'may', 'might', 'must', 'shall', 
                                  'should', 'will', 'would', 'ought', 'not', 'very', 'too', 'so', 'just', 'well', 'often', 'always', 'never', 'sometimes', 'here', 'there', 'now', 'then', 'again', 'also', 'ever', 'even', 'how', 'quite', 'rather', 'soon', 'still', 'more', 'most', 'less', 'least', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'then', 'there', 'here',
                                  "don't", "didn't", "can't", "couldn't", "she's", "he's", "I'm", "you're", "they're", "we're", "it's", "that's"]),
    elements: {},
    init() {
        this.elements = {
            startScreen: document.getElementById('learning-start-screen'),
            startInputContainer: document.getElementById('learning-start-input-container'),
            startWordInput: document.getElementById('learning-start-word-input'),
            startBtn: document.getElementById('learning-start-btn'),
            suggestionsContainer: document.getElementById('learning-suggestions-container'),
            suggestionsTitle: document.getElementById('learning-suggestions-title'),
            suggestionsVocabList: document.getElementById('learning-suggestions-vocab-list'),
            suggestionsExplanationList: document.getElementById('learning-suggestions-explanation-list'),
            backToStartBtn: document.getElementById('learning-back-to-start-btn'),
            loader: document.getElementById('learning-loader'),
            loaderText: document.getElementById('learning-loader-text'),
            appContainer: document.getElementById('learning-app-container'),
            cardBack: document.getElementById('learning-card-back'),
            wordDisplay: document.getElementById('word-display'),
            meaningDisplay: document.getElementById('meaning-display'),
            explanationDisplay: document.getElementById('explanation-display'),
            explanationContainer: document.getElementById('explanation-container'),
            fixedButtons: document.getElementById('learning-fixed-buttons'),
            nextBtn: document.getElementById('next-btn'),
            prevBtn: document.getElementById('prev-btn'),
            sampleBtn: document.getElementById('sample-btn'),
            sampleBtnImg: document.getElementById('sample-btn-img'),
            backTitle: document.getElementById('learning-back-title'),
            backContent: document.getElementById('learning-back-content'),
            progressBarTrack: document.getElementById('progress-bar-track'),
            progressBarFill: document.getElementById('progress-bar-fill'),
            progressBarHandle: document.getElementById('progress-bar-handle'),
        };
        this.bindEvents();
    },
bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.start());
        // 아래 'startWordInput'의 keydown 이벤트를 수정합니다.
        this.elements.startWordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // 엔터 키의 기본 동작을 막습니다.
                e.stopPropagation(); // 이 이벤트가 다른 곳으로 전달(전파)되는 것을 막습니다.
                this.start();
            }
        });
        this.elements.startWordInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^a-zA-Z\s'-]/g, (match) => {
                if (match) app.showImeWarning();
                return '';
            });
        });
        this.elements.backToStartBtn.addEventListener('click', () => this.resetStartScreen());
        this.elements.nextBtn.addEventListener('click', () => this.navigate(1));
        this.elements.prevBtn.addEventListener('click', () => this.navigate(-1));
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip());

        this.elements.wordDisplay.addEventListener('click', () => {
            const word = this.state.currentWordList[this.state.currentIndex]?.word;
            if (word) { api.speak(word, 'word'); ui.copyToClipboard(word); }
        });
        this.elements.wordDisplay.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const wordData = this.state.currentWordList[this.state.currentIndex];
            if (wordData) ui.showWordContextMenu(e, wordData.word, { hideAppSearch: true });
        });

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
        this.elements.progressBarTrack.addEventListener('mousedown', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('mousemove', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('mouseup', this.handleProgressBarInteraction.bind(this));
        this.elements.progressBarTrack.addEventListener('touchstart', this.handleProgressBarInteraction.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleProgressBarInteraction.bind(this));
        document.addEventListener('touchend', this.handleProgressBarInteraction.bind(this));
    },
    async start() {
        this.state.isMistakeMode = false;
        this.state.currentWordList = app.state.wordList;
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        if (!app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록 동기화 중...";
            await api.loadWordList();
        }
        const startWord = this.elements.startWordInput.value.trim();
        if (this.state.currentWordList.length === 0) { this.showError("학습할 단어가 없습니다."); return; }
        if (!startWord) {
            this.elements.loaderText.textContent = "마지막 학습 위치를 불러오는 중...";
            this.state.currentIndex = await api.getLastLearnedIndex() || 0;
            this.launchApp();
            return;
        }
    
        const lowerCaseStartWord = startWord.toLowerCase();
        const exactMatchIndex = this.state.currentWordList.findIndex(item => item.word.toLowerCase() === lowerCaseStartWord);
        if (exactMatchIndex !== -1) {
            this.state.currentIndex = exactMatchIndex;
            this.launchApp();
            return;
        }
        
        const searchRegex = new RegExp(`\\b${lowerCaseStartWord}\\b`, 'i');
        const explanationMatches = this.state.currentWordList
            .map((item, index) => ({ ...item, index }))
            .filter(item => item.explanation && searchRegex.test(item.explanation.replace(/\[.*?\]/g, '')));
        const levenshteinSuggestions = this.state.currentWordList.map((item, index) => ({
            word: item.word, index, distance: utils.levenshteinDistance(lowerCaseStartWord, item.word.toLowerCase())
        })).sort((a, b) => a.distance - b.distance).slice(0, 5).filter(s => s.distance < s.word.length / 2 + 1);
        
        const title = (levenshteinSuggestions.length > 0 || explanationMatches.length > 0)
            ? `<strong>${startWord}</strong> 없으니, 아래에서 확인하세요.`
            : `<strong>${startWord}</strong>에 대한 검색 결과가 없습니다.`;
        this.displaySuggestions(levenshteinSuggestions, explanationMatches, title);
    },
    showError(message) {
        this.elements.loader.querySelector('.loader').style.display = 'none';
        this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">오류 발생</p><p class="text-sm text-gray-600 mt-2 break-all">${message}</p>`;
    },
    launchApp() {
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.appContainer.classList.remove('hidden');
        this.elements.fixedButtons.classList.remove('hidden');
        app.elements.progressBarContainer.classList.remove('hidden');
        this.displayWord(this.state.currentIndex);
    },
    reset() {
        this.elements.startScreen.classList.add('hidden');
        this.elements.appContainer.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.fixedButtons.classList.add('hidden');
        app.elements.progressBarContainer.classList.add('hidden');
        this.resetStartScreen();
    },
    resetStartScreen() {
        this.elements.startInputContainer.classList.remove('hidden');
        this.elements.suggestionsContainer.classList.add('hidden');
        this.elements.startWordInput.value = '';
        this.elements.startWordInput.focus();
    },
    displaySuggestions(vocabSuggestions, explanationSuggestions, title) {
        this.elements.loader.classList.add('hidden');
        this.elements.startScreen.classList.remove('hidden');
        this.elements.startInputContainer.classList.add('hidden');
        this.elements.suggestionsTitle.innerHTML = title;
        
        const populateList = (listElement, suggestions) => {
            listElement.innerHTML = '';
            if (suggestions.length === 0) {
                listElement.innerHTML = '<p class="text-gray-400 text-sm p-3">결과 없음</p>';
                return;
            }
            suggestions.forEach(({ word, index }) => {
                const btn = document.createElement('button');
                btn.className = 'w-full text-left bg-gray-100 hover:bg-gray-200 py-3 px-4 rounded-lg transition-colors';
                btn.textContent = word;
                btn.onclick = () => { this.state.currentIndex = index; this.launchApp(); };
                listElement.appendChild(btn);
            });
        };
        populateList(this.elements.suggestionsVocabList, vocabSuggestions);
        populateList(this.elements.suggestionsExplanationList, explanationSuggestions);
        this.elements.suggestionsContainer.classList.remove('hidden');
    },
    displayWord(index) {
        if (!this.state.isMistakeMode) this.setLastLearnedIndex(index);
        this.updateProgressBar(index);
        this.elements.cardBack.classList.remove('is-slid-up');
        const wordData = this.state.currentWordList[index];
        if (!wordData) return;
        
        this.elements.wordDisplay.innerHTML = `${wordData.word} <span class="pronunciation-inline">${wordData.pronunciation || ''}</span>`;
        
        this.adjustWordFontSize(); // 폰트 크기를 조절하는 함수를 여기서 호출합니다.
        
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>');
        ui.renderExplanationText(this.elements.explanationDisplay, wordData.explanation);
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation?.trim());
        
        const imgMap = { manual: '14-delivery-cat_icon-icons.com_76690', ai: '3-search-cat_icon-icons.com_76679' };
        const imgName = imgMap[wordData.sampleSource] || '19-add-cat_icon-icons.com_76695';
        this.elements.sampleBtnImg.src = `https://images.icon-icons.com/1055/PNG/128/${imgName}.png`;
    },
    adjustWordFontSize() {
        const wordDisplay = this.elements.wordDisplay;
        const container = wordDisplay.parentElement; // 단어를 감싸고 있는 부모 영역

        // 다음 단어를 위해 폰트 크기를 기본값으로 리셋합니다.
        wordDisplay.style.fontSize = '';
        
        // Tailwind CSS 클래스(text-3xl, sm:text-4xl)에 의해 설정된 현재 폰트 크기를 가져옵니다.
        const defaultFontSize = parseFloat(window.getComputedStyle(wordDisplay).fontSize);
        let currentFontSize = defaultFontSize;

        // 단어의 실제 너비가 컨테이너 너비보다 클 경우, 폰트가 딱 맞을 때까지 1px씩 줄여나갑니다.
        // (컨테이너 너비에서 16px을 빼서 좌우에 약간의 여백을 줍니다.)
        while (wordDisplay.scrollWidth > container.clientWidth - 16 && currentFontSize > 12) {
            currentFontSize -= 1; // 1px씩 줄입니다.
            wordDisplay.style.fontSize = `${currentFontSize}px`;
        }
    },
    navigate(direction) {
        const len = this.state.currentWordList.length;
        if (len === 0) return;
        this.state.currentIndex = (this.state.currentIndex + direction + len) % len;
        this.displayWord(this.state.currentIndex);
    },
    handleFlip() {
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = this.state.currentWordList[this.state.currentIndex];

        if (!isBackVisible) {
            if (wordData.sampleSource === 'none' || !wordData.sample) { app.showNoSampleMessage(); return; }
            this.elements.backTitle.textContent = wordData.word;
            ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent);
            this.elements.cardBack.classList.add('is-slid-up');
            this.elements.sampleBtnImg.src = 'https://images.icon-icons.com/1055/PNG/128/5-remove-cat_icon-icons.com_76681.png';
        } else {
            this.elements.cardBack.classList.remove('is-slid-up');
            this.displayWord(this.state.currentIndex);
        }
    },
    startMistakeReview(mistakeWords) {
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.state.isMistakeMode = true;
        const wordMap = new Map(app.state.wordList.map(wordObj => [wordObj.word, wordObj]));
        this.state.currentWordList = mistakeWords.map(word => wordMap.get(word)).filter(Boolean);
        this.state.currentIndex = 0;
        if (this.state.currentWordList.length === 0) {
            this.showError("오답 노트를 불러올 수 없습니다.");
            setTimeout(() => app.navigateTo('selection'), 2000);
            return;
        }
        this.launchApp();
    },
    handleKeyDown(e) {
        if (!learningMode.elements.appContainer.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') this.navigate(-1);
            else if (e.key === 'ArrowRight') this.navigate(1);
            else if (e.key === 'Enter') this.handleFlip();
        }
    },
    // --- 아래 두 함수 전체를 새로 추가해주세요 ---
    handleTouchStart(e) {
        // 학습 모드가 아닐 때는 아무것도 하지 않습니다.
        if (this.elements.appContainer.classList.contains('hidden')) return;
        
        // 터치가 시작된 지점의 X, Y 좌표를 기록합니다.
        this.state.touchStartX = e.touches[0].clientX;
        this.state.touchStartY = e.touches[0].clientY;
    },

    handleTouchEnd(e) {
        // 학습 모드가 아니거나, 터치 시작점이 기록되지 않았다면 아무것도 하지 않습니다.
        if (this.elements.appContainer.classList.contains('hidden') || this.state.touchStartX === 0) return;

        // 터치가 끝난 지점의 X, Y 좌표를 가져옵니다.
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const deltaX = touchEndX - this.state.touchStartX;
        const deltaY = touchEndY - this.state.touchStartY;
        const swipeThreshold = 50; // 최소 50픽셀 이상 움직여야 스와이프로 인식

        // 상하 스크롤이 아닌 좌우 스와이프인지 확인합니다.
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > swipeThreshold) {
                // 오른쪽으로 스와이프 -> 이전 카드
                this.navigate(-1);
            } else if (deltaX < -swipeThreshold) {
                // 왼쪽으로 스와이프 -> 다음 카드
                this.navigate(1);
            }
        }
        
        // 다음 스와이프를 위해 시작 좌표를 초기화합니다.
        this.state.touchStartX = 0;
        this.state.touchStartY = 0;
    },    
    updateProgressBar(index) {
        const total = this.state.currentWordList.length;
        if (total <= 1) {
            this.elements.progressBarFill.style.width = '100%';
            this.elements.progressBarHandle.style.left = '100%';
            return;
        }
        const percentage = (index / (total - 1)) * 100;
        this.elements.progressBarFill.style.width = `${percentage}%`;
        this.elements.progressBarHandle.style.left = `calc(${percentage}% - ${this.elements.progressBarHandle.offsetWidth / 2}px)`;
    },
    handleProgressBarInteraction(e) {
        if (learningMode.elements.appContainer.classList.contains('hidden')) return;
        
        const track = this.elements.progressBarTrack;
        const totalWords = this.state.currentWordList.length;
        if (totalWords <= 1) return;

        const handleInteraction = (clientX) => {
            const rect = track.getBoundingClientRect();
            const x = clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            const newIndex = Math.round(percentage * (totalWords - 1));
            if (newIndex !== this.state.currentIndex) {
                this.state.currentIndex = newIndex;
                this.displayWord(newIndex);
            }
        };

        switch (e.type) {
            case 'mousedown':
                this.state.isDragging = true;
                handleInteraction(e.clientX);
                break;
            case 'mousemove':
                if (this.state.isDragging) handleInteraction(e.clientX);
                break;
            case 'mouseup':
                this.state.isDragging = false;
                break;
            case 'touchstart':
                e.preventDefault();
                this.state.isDragging = true;
                handleInteraction(e.touches[0].clientX);
                break;
            case 'touchmove':
                if (this.state.isDragging) handleInteraction(e.touches[0].clientX);
                break;
            case 'touchend':
                this.state.isDragging = false;
                break;
        }
    },
};

document.addEventListener('firebaseSDKLoaded', () => {
    ({ 
        initializeApp, getDatabase, ref, get, update, set, 
        getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup
    } = window.firebaseSDK);
    app.init();
});

