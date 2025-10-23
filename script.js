let firebaseApp, database, auth, db;
let initializeApp, getDatabase, ref, get, update, set;
let getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup;
let getFirestore, doc, getDoc, setDoc, updateDoc, writeBatch; // Added writeBatch

const app = {
    config: {
        TTS_API_KEY: "AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA",
        DEFINITION_API_KEY: "02d1892d-8fb1-4e2d-bc43-4ddd4a47eab3",
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzyBM33LzFsAe-mES_0Qw5B8w0ZPyYTDm4K_nLif5y2bXMpiQbD1LX5TTIDA4qX_Rnp/exec",
        ALLOWED_USER_EMAIL: "puroome@gmail.com",
    },
    state: {
        isAppStarted: false,
        userId: null,
        currentVoiceSet: 'UK',
        isSpeaking: false,
        audioContext: null,
        wordList: [],
        currentProgress: {},
        isWordListReady: false,
        longPressTimer: null,
        translationTimer: null,
        favorites: [], // 즐겨찾기 목록은 utils.getFavoriteWords로 관리 예정
        LOCAL_STORAGE_KEYS: {
            TTS_VOICE: 'student_ttsVoice',
            LAST_INDEX: 'student_lastIndex_main',
            UNSYNCED_TIME: 'student_unsyncedTime_main',
            UNSYNCED_QUIZ: 'student_unsyncedQuizStats_main',
            // [수정] 통합 progress 업데이트 키
            UNSYNCED_PROGRESS_UPDATES: 'student_unsyncedProgress_main'
        }
    },
    elements: {
        loginScreen: document.getElementById('login-screen'),
        googleLoginBtn: document.getElementById('google-login-btn'),
        loginError: document.getElementById('login-error'),
        logoutBtn: document.getElementById('logout-btn'),
        appWrapper: document.getElementById('app-wrapper'),
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
        selectFavoritesBtn: document.getElementById('select-favorites-btn'),
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
        db = getFirestore(firebaseApp);
        // Assign imported functions needed later
        writeBatch = window.firebaseSDK.writeBatch;


        onAuthStateChanged(auth, async (user) => {
            if (user && user.email === this.config.ALLOWED_USER_EMAIL) {
                this.state.userId = user.uid;
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    displayName: user.displayName,
                    email: user.email
                }, { merge: true });

                this.elements.loginScreen.classList.add('hidden');
                this.elements.appWrapper.classList.remove('hidden');
                if (!this.state.isAppStarted) {
                    await this.startApp();
                }
            } else {
                this.elements.loginScreen.classList.remove('hidden');
                this.elements.appWrapper.classList.add('hidden');
                if (user) {
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
            const savedVoice = localStorage.getItem(this.state.LOCAL_STORAGE_KEYS.TTS_VOICE);
            if (savedVoice) {
                this.state.currentVoiceSet = savedVoice;
                this.elements.ttsToggleText.textContent = savedVoice;
                this.elements.ttsToggleBtn.classList.toggle('bg-indigo-700', savedVoice === 'UK');
                this.elements.ttsToggleBtn.classList.toggle('hover:bg-indigo-800', savedVoice === 'UK');
                this.elements.ttsToggleBtn.classList.toggle('bg-red-500', savedVoice === 'US');
                this.elements.ttsToggleBtn.classList.toggle('hover:bg-red-600', savedVoice === 'US');
            }
        } catch (e) {
            console.error("Error reading TTS settings from localStorage", e);
        }

        try {
            await audioCache.init();
            await translationCache.init();
            await imageDBCache.init();
        } catch (e) {
            console.error("Cache initialization failed.", e);
        }
        this.bindGlobalEvents();
        studyTracker.init();

        // [수정] 동기화 로직은 그대로 둡니다.
        await this.syncOfflineData();

        try {
            await api.loadWordList();
            await api.loadUserProgress();
        } catch (e) {
            return;
        }

        this.loadInitialImages();
        quizMode.init();
        learningMode.init();
        dashboard.init();

        quizMode.preloadAllQuizTypes();

        const initialMode = window.location.hash.replace('#', '') || 'selection';
        history.replaceState({ mode: initialMode, options: {} }, '', window.location.href);
        this._renderMode(initialMode);
    },
    async syncOfflineData() {
        if (!app.state.userId) return;

        try {
            const timeKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME;
            const quizKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ;
            // [수정] 통합 progress 키 사용
            const progressKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES;

            const timeToSync = parseInt(localStorage.getItem(timeKey) || '0');
            if (timeToSync > 0) {
                await api.updateStudyTime(timeToSync);
                localStorage.removeItem(timeKey);
            }

            const statsToSync = JSON.parse(localStorage.getItem(quizKey) || 'null');
            if (statsToSync) {
                await api.syncQuizHistory(statsToSync);
                localStorage.removeItem(quizKey);
            }

            // [수정] 통합 progress 데이터 동기화
            const progressToSync = JSON.parse(localStorage.getItem(progressKey) || 'null');
             if (progressToSync && Object.keys(progressToSync).length > 0) {
                 await api.syncProgressUpdates(progressToSync);
                 localStorage.removeItem(progressKey);
             }

        } catch (error) {
            console.error("Offline data sync failed:", error);
        }
    },
    bindGlobalEvents() {
        this.elements.selectQuizBtn.addEventListener('click', () => this.navigateTo('quiz'));
        this.elements.selectLearningBtn.addEventListener('click', () => this.navigateTo('learning'));
        this.elements.selectDashboardBtn.addEventListener('click', () => this.navigateTo('dashboard'));
        this.elements.selectFavoritesBtn.addEventListener('click', () => this.navigateTo('favorites'));

        this.elements.selectMistakesBtn.addEventListener('click', async () => {
            const allWords = app.state.wordList;
            // [수정] utils.getWordStatus가 LocalStorage를 반영하므로 변경 불필요
            const mistakeWords = allWords
                .filter(wordObj => utils.getWordStatus(wordObj.word) === 'review')
                .map(wordObj => wordObj.word);

            if (mistakeWords.length === 0) {
                app.showToast('오답 노트에 단어가 없습니다.', true);
                return;
            }
            this.navigateTo('mistakeReview', { mistakeWords });
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
            this.syncOfflineData(); // Sync when navigating back/forward
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

        window.addEventListener('beforeunload', (e) => {
             studyTracker.stopAndSave();
             // Attempt synchronous sync (might not always work)
             this.syncOfflineDataSync();
        });
    },
    syncOfflineDataSync() {
         if (!app.state.userId) return;
         // Note: Complex async operations like Firestore writes are unreliable in beforeunload.
         // This is a best-effort attempt. The main sync happens on app start.
         const timeKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME;
         const quizKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ;
         // [수정] 새 progress 키 사용
         const progressKey = this.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES;

         const timeToSync = localStorage.getItem(timeKey);
         const statsToSync = localStorage.getItem(quizKey);
         const progressToSync = localStorage.getItem(progressKey);

         if (timeToSync || statsToSync || progressToSync) {
            // We can't reliably wait for Firebase here. The sync on next load is the main mechanism.
            // We could try a synchronous Beacon API call if backend supports it, but Firestore SDK is async.
         }
    },
    async loadInitialImages() {
        const imageSelectors = [
            '#select-learning-btn img', '#select-quiz-btn img',
            '#start-meaning-quiz-btn img', '#start-blank-quiz-btn img', '#start-definition-quiz-btn img'
        ];
        for (const selector of imageSelectors) {
            const img = document.querySelector(selector);
            if (img && img.src) {
                img.src = await imageDBCache.loadImage(img.src);
            }
        }
    },
    navigateTo(mode, options = {}) {
        if (history.state?.mode !== mode) { // Sync if changing modes
            this.syncOfflineData();
        }

        if (history.state?.mode === mode && !['learning', 'mistakeReview', 'favorites'].includes(mode)) return;


        const newPath = mode === 'selection'
            ? window.location.pathname + window.location.search
            : `#${mode}`;

        history.pushState({ mode, options }, '', newPath);
        this._renderMode(mode, options);
    },
    _renderMode(mode, options = {}) {
        studyTracker.stopAndSave();
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

        if (mode === 'quiz' || mode === 'learning' || mode === 'mistakeReview' || mode === 'favorites') {
             studyTracker.start();
        }

        if (mode === 'quiz') {
            showCommonButtons();
            this.elements.quizModeContainer.classList.remove('hidden');
            quizMode.reset();
        } else if (mode === 'learning') {
            showCommonButtons();
            this.elements.learningModeContainer.classList.remove('hidden');
            if (options.startIndex !== undefined && options.startIndex > -1) {
                learningMode.state.isMistakeMode = false;
                learningMode.state.isFavoriteMode = false;
                learningMode.state.currentWordList = app.state.wordList;
                learningMode.state.currentIndex = options.startIndex;
                learningMode.launchApp();
            } else {
                this.elements.learningModeContainer.querySelector('#learning-start-screen').classList.remove('hidden');
                learningMode.resetStartScreen();
            }
        } else if (mode === 'mistakeReview') {
            showCommonButtons();
            this.elements.learningModeContainer.classList.remove('hidden');
            learningMode.startMistakeReview(options.mistakeWords);
        } else if (mode === 'favorites') {
            showCommonButtons();
            this.elements.learningModeContainer.classList.remove('hidden');
            learningMode.startFavoriteMode();
        } else if (mode === 'dashboard') {
            this.elements.homeBtn.classList.remove('hidden');
            this.elements.dashboardContainer.classList.remove('hidden');
            dashboard.render();
        } else {
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
            await api.loadUserProgress();
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

            try {
                localStorage.setItem(this.state.LOCAL_STORAGE_KEYS.TTS_VOICE, this.state.currentVoiceSet);
            } catch (e) {
                console.error("Error saving TTS settings to localStorage", e);
            }
        }, 250);
    },
    showFatalError(message) {
        const selectionDiv = this.elements.selectionScreen;
        selectionDiv.innerHTML = `<div class="p-8 text-center"><h1 class="text-3xl font-bold text-red-600 mb-4">앱 시작 실패</h1><p class="text-gray-700 mb-6">Firebase에서 데이터를 불러오는 중 문제가 발생했습니다. <br>네트워크 연결을 확인하고 잠시 후 페이지를 새로고침 해주세요.</p><div class="bg-red-50 text-red-700 p-4 rounded-lg text-left text-sm break-all"><p class="font-semibold">오류 정보:</p><p>${message}</p></div></div>`;
        this.elements.appWrapper.classList.remove('hidden');
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
        this.navigateTo('learning');
        setTimeout(() => {
            learningMode.elements.startWordInput.value = word;
            learningMode.start();
            ui.hideWordContextMenu();
        }, 10);
    },
};

const studyTracker = {
    sessionSeconds: 0,
    lastActivityTimestamp: 0,
    timerInterval: null,
    saveInterval: null,
    INACTIVITY_LIMIT: 30000,

    init() {
    },
    start() {
        if (this.timerInterval) return;
        this.lastActivityTimestamp = Date.now();
        this.sessionSeconds = 0;

        this.timerInterval = setInterval(() => {
            if (document.hidden) return;

            const now = Date.now();
            if (now - this.lastActivityTimestamp < this.INACTIVITY_LIMIT) {
                this.sessionSeconds++;
            }
        }, 1000);

        this.saveInterval = setInterval(() => {
            if (this.sessionSeconds > 0) {
                try {
                    const currentLocalTime = parseInt(localStorage.getItem(app.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME) || '0');
                    localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME, currentLocalTime + this.sessionSeconds);
                    this.sessionSeconds = 0;
                } catch (e) {
                    console.error("Error saving study time to localStorage", e);
                }
            }
        }, 10000);

        ['click', 'keydown', 'touchstart'].forEach(event =>
            document.body.addEventListener(event, this.recordActivity, true));
    },

    stopAndSave() {
        if (!this.timerInterval) return;

        clearInterval(this.timerInterval);
        clearInterval(this.saveInterval);
        this.timerInterval = null;
        this.saveInterval = null;

        try {
            if (this.sessionSeconds > 0) {
                const currentLocalTime = parseInt(localStorage.getItem(app.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME) || '0');
                localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.UNSYNCED_TIME, currentLocalTime + this.sessionSeconds);
            }
        } catch (e) {
            console.error("Error saving remaining study time to localStorage", e);
        }

        this.sessionSeconds = 0;

        ['click', 'keydown', 'touchstart'].forEach(event =>
            document.body.removeEventListener(event, this.recordActivity, true));
    },

    recordActivity() {
        studyTracker.lastActivityTimestamp = Date.now();
    }
};

const imageDBCache = {
    db: null, dbName: 'imageCacheDB', storeName: 'imageStore',
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB for images not supported.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = e => e.target.result.createObjectStore(this.storeName);
            request.onsuccess = e => { this.db = e.target.result; resolve(); };
            request.onerror = e => reject(e.target.error);
        });
    },
    async loadImage(url) {
        if (!this.db || !url) return url;
        const cachedBlob = await this.getImage(url);
        if (cachedBlob) return URL.createObjectURL(cachedBlob);

        try {
            const response = await fetch(url);
            if (!response.ok) return url;
            const blob = await response.blob();
            this.saveImage(url, blob);
            return URL.createObjectURL(blob);
        } catch (e) {
            return url;
        }
    },
    getImage: key => new Promise((resolve) => {
        if (!imageDBCache.db) return resolve(null);
        const request = imageDBCache.db.transaction([imageDBCache.storeName]).objectStore(imageDBCache.storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    }),
    saveImage: (key, blob) => {
        if (!imageDBCache.db) return;
        try { imageDBCache.db.transaction([imageDBCache.storeName], 'readwrite').objectStore(imageDBCache.storeName).put(blob, key); }
        catch (e) { console.error("Failed to save image to IndexedDB", e); }
    }
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

                    const now = new Date();
                    const lastMonday = new Date(now);

                    const todayDay = now.getDay();
                    const diff = todayDay === 0 ? 6 : todayDay - 1;
                    lastMonday.setDate(now.getDate() - diff);
                    lastMonday.setHours(0, 0, 0, 0);

                    if (timestamp >= lastMonday.getTime()) {
                        app.state.wordList = words.sort((a, b) => a.index - b.index);
                        app.state.isWordListReady = true;
                    }
                }
            } catch (e) {
                localStorage.removeItem('wordListCache');
            }
        }

        if (app.state.isWordListReady && !force) return;

        try {
            const dbRef = ref(database, '/vocabulary');
            const snapshot = await get(dbRef);
            const data = snapshot.val();
            if (!data) throw new Error("Firebase에 단어 데이터가 없습니다.");

            const wordsArray = Object.values(data).sort((a, b) => a.index - b.index);

            app.state.wordList = wordsArray;
            app.state.isWordListReady = true;

            const cachePayload = { timestamp: Date.now(), words: wordsArray };
            localStorage.setItem('wordListCache', JSON.stringify(cachePayload));
        } catch (error) {
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
            return "번역 오류";
        }
    },
     async updateWordStatus(word, quizType, result) {
         if (!app.state.userId || !word || !quizType) return;

         // 1. UI 즉각 반영을 위해 로컬 state(RAM) 업데이트
         if (!app.state.currentProgress[word]) app.state.currentProgress[word] = {};
         app.state.currentProgress[word][quizType] = result;

         // 2. [수정] LocalStorage(브라우저)에 변경 사항 저장 (나중에 동기화됨)
         utils.addProgressUpdateToLocalSync(word, quizType, result);

         // 3. 퀴즈 통계 저장은 별도로 처리 (기존 로직 유지)
         api.saveQuizHistoryToLocal(quizType, result === 'correct');

         // Update wordList state (for mistake review feature, reflecting local state)
         // Let getWordStatus handle the combined state logic
     },
    async loadUserProgress() {
        if (!app.state.userId) return;
        const progressRef = doc(db, 'users', app.state.userId, 'progress', 'main');
        try {
            const docSnap = await getDoc(progressRef);
            app.state.currentProgress = docSnap.exists() ? docSnap.data() : {};
        } catch (error) {
            app.state.currentProgress = {};
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
            return null;
        }
    },
    async loadFavorites() {
        if (!app.state.userId) return [];
        // [수정] 즐겨찾기 목록은 utils.getFavoriteWords로 관리
        return utils.getFavoriteWords();
    },
    async toggleFavorite(word) {
        if (!app.state.userId) return false;

        // [수정] 즐겨찾기 상태를 로컬(RAM)과 로컬스토리지에서 확인
        const isCurrentlyFavorite = utils.isFavorite(word);
        const newFavoriteStatus = !isCurrentlyFavorite;

        // 1. UI 즉각 반영 위해 로컬 state(RAM) 업데이트
        if (!app.state.currentProgress[word]) app.state.currentProgress[word] = {};
        app.state.currentProgress[word].favorite = newFavoriteStatus;

        // 2. [수정] LocalStorage(브라우저)에 변경 사항 저장 (나중에 동기화됨)
        utils.addProgressUpdateToLocalSync(word, 'favorite', newFavoriteStatus);

        // 3. 즉시 상태 반환
        return newFavoriteStatus;
    },
    async updateStudyTime(seconds) {
        if (!app.state.userId || seconds < 1) return;
        const today = new Date().toISOString().slice(0, 10);
        const historyRef = doc(db, 'users', app.state.userId, 'history', 'study');

        try {
            const docSnap = await getDoc(historyRef);
            const currentSeconds = (docSnap.exists() && docSnap.data()[today]) ? docSnap.data()[today] : 0;
            // [수정] word 앱은 학년 구분이 없으므로 바로 저장
            await setDoc(historyRef, { [today]: currentSeconds + seconds }, { merge: true });
        } catch (error) {
            console.error("Failed to update study time:", error);
            throw error;
        }
    },
    async getStudyHistory(days) {
        if (!app.state.userId) return {};
        const historyRef = doc(db, 'users', app.state.userId, 'history', 'study');
        const docSnap = await getDoc(historyRef);
        return docSnap.exists() ? docSnap.data() : {};
    },
    async getQuizHistory() {
        if (!app.state.userId) return {};
        const historyRef = doc(db, 'users', app.state.userId, 'history', 'quiz');
        const docSnap = await getDoc(historyRef);
        return docSnap.exists() ? docSnap.data() : {};
    },
    saveQuizHistoryToLocal(quizType, isCorrect) {
        try {
            const stats = JSON.parse(localStorage.getItem(app.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ) || '{}');
            if (!stats[quizType]) {
                stats[quizType] = { total: 0, correct: 0 };
            }
            stats[quizType].total += 1;
            if (isCorrect) {
                stats[quizType].correct += 1;
            }
            localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.UNSYNCED_QUIZ, JSON.stringify(stats));
        } catch (e) {
            console.error("Error saving quiz stats to localStorage", e);
        }
    },
    async syncQuizHistory(statsToSync) {
        if (!app.state.userId || !statsToSync) return;
        const today = new Date().toISOString().slice(0, 10);
        const historyRef = doc(db, 'users', app.state.userId, 'history', 'quiz');

        try {
            const docSnap = await getDoc(historyRef);
            const data = docSnap.exists() ? docSnap.data() : {};

            // [수정] word 앱은 학년 구분이 없으므로 바로 todayData 사용
            const todayData = data[today] || {};

            for (const type in statsToSync) {
                if (statsToSync.hasOwnProperty(type)) {
                    const typeStats = todayData[type] || { correct: 0, total: 0 };
                    typeStats.total += statsToSync[type].total;
                    typeStats.correct += statsToSync[type].correct;
                    todayData[type] = typeStats;
                }
            }

            await setDoc(historyRef, { [today]: todayData }, { merge: true });
        } catch(e) {
            console.error("Failed to sync quiz history:", e);
            throw e;
        }
    },
    // [수정] syncIncorrectStatus 대신 통합 progress 업데이트 함수 사용
    async syncProgressUpdates(progressToSync) {
         if (!app.state.userId || !progressToSync || Object.keys(progressToSync).length === 0) return;
         // [수정] word 앱은 'main' progress 사용
         const progressRef = doc(db, 'users', app.state.userId, 'progress', 'main');

         try {
             // setDoc with merge: true handles nested object updates correctly
             await setDoc(progressRef, progressToSync, { merge: true });
         } catch (error) {
             console.error("Firebase progress sync failed:", error);
             throw error; // Re-throw to prevent localStorage clear if sync fails
         }
     }
};

const ui = {
    async copyToClipboard(text) {
        if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(text); }
            catch (err) { }
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
                    if (learningMode.nonInteractiveWords && !learningMode.nonInteractiveWords.has(englishPhrase.toLowerCase())) {
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
                    }
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

            p.addEventListener('mouseenter', (e) => {
                clearTimeout(app.state.translationTimer);
                app.state.translationTimer = setTimeout(() => {
                    showTranslation(e);
                }, 1000);
            });

            p.addEventListener('mouseleave', () => {
                clearTimeout(app.state.translationTimer);
                this.hideTranslationTooltip();
            });

            const sentenceContent = document.createElement('span');
            sentenceContent.className = 'sentence-content-area';
            sentenceContent.style.cursor = 'text';

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
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
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
    _getProgressRef() {
        if (!app.state.userId) return null;
        // [수정] word 앱은 'main' 사용
        return doc(db, 'users', app.state.userId, 'progress', 'main');
    },
    // [추가] 통합 progress 업데이트 저장 함수
    addProgressUpdateToLocalSync(word, key, value) {
        try {
            const localKey = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES;
            const unsynced = JSON.parse(localStorage.getItem(localKey) || '{}');
            if (!unsynced[word]) {
                unsynced[word] = {};
            }
            unsynced[word][key] = value;
            localStorage.setItem(localKey, JSON.stringify(unsynced));
        } catch (e) {
            console.error("Error adding progress update to localStorage sync", e);
        }
    },
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
    },
    formatSeconds(totalSeconds) {
        if (totalSeconds < 60) return `${Math.floor(totalSeconds)}초`;
        const d = Math.floor(totalSeconds / 86400);
        const h = Math.floor((totalSeconds % 86400) / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        let result = '';
        if (d > 0) result += `${d}d `;
        if (h > 0) result += `${h}h `;
        if (m > 0) result += `${m}m`;
        return result.trim() || '0s';
    },
    getWordStatus(word) {
        // [수정] LocalStorage의 최신 변경 사항 가져오기
        let localStatus = {};
        try {
            const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES;
            const unsynced = JSON.parse(localStorage.getItem(key) || '{}');
            if (unsynced[word]) {
                localStatus = unsynced[word];
            }
        } catch(e) {}

        // [수정] 서버 상태에 로컬 변경 사항을 덮어씌워 최신 상태 반영
        const progress = { ...app.state.currentProgress[word], ...localStatus };

        if (Object.keys(progress).length === 0) return 'unseen';

        const statuses = ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION'].map(type => progress[type] || 'unseen');
        if (statuses.includes('incorrect')) return 'review';
        if (statuses.every(s => s === 'correct')) return 'learned';
        if (statuses.some(s => s === 'correct')) return 'learning';
        return 'unseen';
    },
    // [추가] 즐겨찾기 상태 확인 함수 (LocalStorage 포함)
    isFavorite(word) {
        let isFav = app.state.currentProgress[word]?.favorite || false;
        try {
            const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES;
            const unsynced = JSON.parse(localStorage.getItem(key) || '{}');
            if (unsynced[word] && unsynced[word].favorite !== undefined) {
                isFav = unsynced[word].favorite;
            }
        } catch (e) {}
        return isFav;
    },
    // [추가] 즐겨찾기 목록 가져오기 함수 (LocalStorage 포함)
    getFavoriteWords() {
        let localUpdates = {};
        try {
            const key = app.state.LOCAL_STORAGE_KEYS.UNSYNCED_PROGRESS_UPDATES;
            localUpdates = JSON.parse(localStorage.getItem(key) || '{}');
        } catch (e) {}

        const allProgress = app.state.currentProgress;
        const combinedKeys = new Set([...Object.keys(allProgress), ...Object.keys(localUpdates)]);

        const favoriteWords = [];
        combinedKeys.forEach(word => {
            const serverState = allProgress[word] || {};
            const localState = localUpdates[word] || {};
            const combinedState = { ...serverState, ...localState };

            if (combinedState.favorite) {
                favoriteWords.push({ word: word, time: combinedState.favoritedAt || 0 });
            }
        });

        return favoriteWords.sort((a, b) => b.time - a.time).map(item => item.word);
    }
};

const dashboard = {
    elements: {
        container: document.getElementById('dashboard-container'),
        content: document.getElementById('dashboard-content'),
        summary: document.getElementById('dashboard-summary'),
    },
    state: {
        studyTimeChart: null,
        quiz1Chart: null,
        quiz2Chart: null,
        quiz3Chart: null,
    },
    init() {
        document.addEventListener('wordListUpdated', () => {
            if (!this.elements.container.classList.contains('hidden')) {
                this.render();
            }
        });
    },
    destroyCharts() {
        if (this.state.studyTimeChart) this.state.studyTimeChart.destroy();
        if (this.state.quiz1Chart) this.state.quiz1Chart.destroy();
        if (this.state.quiz2Chart) this.state.quiz2Chart.destroy();
        if (this.state.quiz3Chart) this.state.quiz3Chart.destroy();
        this.state.studyTimeChart = null;
        this.state.quiz1Chart = null;
        this.state.quiz2Chart = null;
        this.state.quiz3Chart = null;
    },
    async render() {
        if (!app.state.isWordListReady) {
            this.elements.content.innerHTML = `<div class="text-center p-10"><p class="text-gray-600">단어 목록을 먼저 불러와주세요.</p></div>`;
            return;
        }

        const wordList = app.state.wordList;
        const totalWords = wordList.length;
        const stages = {
            unseen: { name: '새 단어', count: 0, color: 'bg-gray-400' },
            learning: { name: '학습 중', count: 0, color: 'bg-blue-500' },
            review: { name: '복습 필요', count: 0, color: 'bg-orange-500' },
            learned: { name: '학습 완료', count: 0, color: 'bg-green-500' }
        };

        wordList.forEach(wordObj => {
            // [수정] utils.getWordStatus가 LocalStorage를 반영하므로 변경 불필요
            const status = utils.getWordStatus(wordObj.word);
            if (stages[status]) {
                stages[status].count++;
            }
        });

        let contentHTML = `<div class="bg-gray-50 p-4 rounded-lg shadow-inner text-center"><p class="text-lg text-gray-600">총 단어 수</p><p class="text-4xl font-bold text-gray-800">${totalWords}</p></div><div><h2 class="text-xl font-bold text-gray-700 mb-3 text-center">학습 단계별 분포</h2><div class="space-y-4">`;
        Object.values(stages).forEach(stage => {
            const percentage = totalWords > 0 ? ((stage.count / totalWords) * 100).toFixed(1) : 0;
            contentHTML += `<div class="w-full"><div class="flex justify-between items-center mb-1"><span class="text-base font-semibold text-gray-700">${stage.name}</span><span class="text-sm font-medium text-gray-500">${stage.count}개 (${percentage}%)</span></div><div class="w-full bg-gray-200 rounded-full h-4"><div class="${stage.color} h-4 rounded-full" style="width: ${percentage}%"></div></div></div>`;
        });
        contentHTML += `</div></div>`;
        this.elements.content.innerHTML = contentHTML;
        await this.renderSummary();
    },
    async renderSummary() {
        this.destroyCharts();
        const studyHistory = await api.getStudyHistory();
        const quizHistory = await api.getQuizHistory();
        const today = new Date();

        const labels = [];
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().slice(0, 10);
            labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
            // [수정] word 앱은 학년 구분 없이 바로 사용
            data.push(Math.round((studyHistory[dateString] || 0) / 60));
        }
        const studyTimeCtx = document.getElementById('study-time-chart').getContext('2d');
        this.state.studyTimeChart = new Chart(studyTimeCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '학습 시간 (분)',
                    data: data,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, suggestedMax: 60 }
                },
                plugins: { legend: { display: false } }
            }
        });

        const totalQuizStats = {
            'MULTIPLE_CHOICE_MEANING': { correct: 0, total: 0 },
            'FILL_IN_THE_BLANK': { correct: 0, total: 0 },
            'MULTIPLE_CHOICE_DEFINITION': { correct: 0, total: 0 },
        };

        for (let i = 0; i < 7; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().slice(0, 10);

            // [수정] word 앱은 학년 구분 없이 바로 사용
            if (quizHistory[dateString]) {
                for (const type in totalQuizStats) {
                    if (quizHistory[dateString][type]) {
                        totalQuizStats[type].correct += quizHistory[dateString][type].correct;
                        totalQuizStats[type].total += quizHistory[dateString][type].total;
                    }
                }
            }
        }

        const createDoughnutChart = (elementId, labelId, labelText, stats) => {
            const ctx = document.getElementById(elementId).getContext('2d');
            const correct = stats.correct || 0;
            const total = stats.total || 0;
            const incorrect = total - correct;
            const accuracy = total > 0 ? ((correct / total) * 100).toFixed(0) : 0;

            const labelEl = document.getElementById(labelId);
            if (labelEl) {
                labelEl.textContent = `${labelText} (${correct}/${total})`;
            }

            return new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['정답', '오답'],
                    datasets: [{
                        data: [correct, incorrect > 0 ? incorrect : 0.0001],
                        backgroundColor: ['#34D399', '#F87171'],
                        hoverBackgroundColor: ['#10B981', '#EF4444'],
                        borderWidth: 0,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    cutout: '70%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                    }
                },
                plugins: [{
                    id: 'doughnutLabel',
                    beforeDraw: (chart) => {
                        const { ctx, width, height } = chart;
                        ctx.restore();
                        const fontSize = (height / 100).toFixed(2);
                        ctx.font = `bold ${fontSize}em sans-serif`;
                        ctx.textBaseline = 'middle';
                        const text = `${accuracy}%`;
                        const textX = Math.round((width - ctx.measureText(text).width) / 2);
                        const textY = height / 2;
                        ctx.fillStyle = '#374151';
                        ctx.fillText(text, textX, textY);
                        ctx.save();
                    }
                }]
            });
        };
        this.state.quiz1Chart = createDoughnutChart('quiz1-chart', 'quiz1-label', '영한 뜻', totalQuizStats['MULTIPLE_CHOICE_MEANING']);
        this.state.quiz2Chart = createDoughnutChart('quiz2-chart', 'quiz2-label', '빈칸 추론', totalQuizStats['FILL_IN_THE_BLANK']);
        this.state.quiz3Chart = createDoughnutChart('quiz3-chart', 'quiz3-label', '영영 풀이', totalQuizStats['MULTIPLE_CHOICE_DEFINITION']);


        const textSummaryContainer = document.getElementById('dashboard-text-summary');
        if (textSummaryContainer) {
            const getStatsForPeriod = (days) => {
                let totalSeconds = 0;
                const quizStats = {
                    'MULTIPLE_CHOICE_MEANING': { correct: 0, total: 0 },
                    'FILL_IN_THE_BLANK': { correct: 0, total: 0 },
                    'MULTIPLE_CHOICE_DEFINITION': { correct: 0, total: 0 },
                };

                for (let i = 0; i < days; i++) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const dateString = d.toISOString().slice(0, 10);
                    // [수정] word 앱은 학년 구분 없이 바로 사용
                    totalSeconds += studyHistory[dateString] || 0;
                    if (quizHistory[dateString]) {
                        for (const type in quizStats) {
                            if(quizHistory[dateString][type]) {
                                quizStats[type].correct += quizHistory[dateString][type].correct;
                                quizStats[type].total += quizHistory[dateString][type].total;
                            }
                        }
                    }
                }
                return { totalSeconds, quizStats };
            }

            const totalStudySeconds = Object.values(studyHistory).reduce((a, b) => a + b, 0);

            const quizHistoryTotal = {};
            if(quizHistory) {
                // [수정] word 앱은 학년 구분 없이 바로 처리
                Object.values(quizHistory).forEach(daily => {
                    Object.entries(daily).forEach(([type, stats]) => {
                        if (!quizHistoryTotal[type]) quizHistoryTotal[type] = { correct: 0, total: 0 };
                        quizHistoryTotal[type].correct += stats.correct;
                        quizHistoryTotal[type].total += stats.total;
                    });
                });
            }

            const stats30 = getStatsForPeriod(30);

            const createSummaryCardHTML = (title, totalSeconds, quizStats) => {
                const quizTypes = {
                    'MULTIPLE_CHOICE_MEANING': '영한 뜻',
                    'FILL_IN_THE_BLANK': '빈칸 추론',
                    'MULTIPLE_CHOICE_DEFINITION': '영영 풀이',
                };

                let quizHTML = '<div class="grid grid-cols-3 gap-1 text-center">';
                for (const type in quizTypes) {
                    const stats = quizStats[type] || { correct: 0, total: 0 };
                    const accuracy = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(0) : 0;
                    quizHTML += `
                        <div class="bg-white p-2 rounded-lg shadow-sm">
                            <p class="text-sm font-semibold text-gray-500">${quizTypes[type]}</p>
                            <p class="font-bold text-gray-800 text-xl">${accuracy}%</p>
                            <p class="text-xs text-gray-400">(${stats.correct}/${stats.total})</p>
                        </div>
                    `;
                }
                quizHTML += '</div>';

                return `
                    <div class="bg-gray-50 p-4 rounded-xl shadow-inner">
                        <h4 class="font-bold text-gray-700 mb-4 text-lg text-center">
                            ${title}
                            <span class="font-normal text-gray-500">(${utils.formatSeconds(totalSeconds)})</span>
                        </h4>
                        <div class="space-y-3">
                            ${quizHTML}
                        </div>
                    </div>
                `;
            };

            const card30Days = createSummaryCardHTML('최근 30일 기록', stats30.totalSeconds, stats30.quizStats);
            const cardTotal = createSummaryCardHTML('누적 총학습 기록', totalStudySeconds, quizHistoryTotal);

            textSummaryContainer.innerHTML = `
                <div class="space-y-6">
                    ${card30Days}
                    ${cardTotal}
                </div>
            `;
        }
    }
};

const quizMode = {
    state: {
        quizType: null,
        currentQuiz: null,
        sessionAnsweredInSet: 0,
        sessionCorrectInSet: 0,
        sessionMistakes: [],
        answeredWords: new Set(),
        preloadedQuizzes: {
            'MULTIPLE_CHOICE_MEANING': null,
            'FILL_IN_THE_BLANK': null,
            'MULTIPLE_CHOICE_DEFINITION': null
        },
        isPreloading: {
            'MULTIPLE_CHOICE_MEANING': false,
            'FILL_IN_THE_BLANK': false,
            'MULTIPLE_CHOICE_DEFINITION': false
        },
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
    async generateSingleQuiz(quizType) {
        const allWords = app.state.wordList;
        if (allWords.length < 5) return null;

        const getUnansweredWords = (type) => {
            return allWords.filter(wordObj => {
                // [수정] utils.getWordStatus가 LocalStorage를 반영하므로 변경 불필요
                const status = utils.getWordStatus(wordObj.word);
                return status !== 'learned' && !this.state.answeredWords.has(wordObj.word);
            });
        };


        let candidates = getUnansweredWords(quizType);

        if (quizType === 'FILL_IN_THE_BLANK') {
            candidates = candidates.filter(word => word.sample && word.sample.trim() !== '');
        }

        if (candidates.length === 0) return null;

        utils.shuffleArray(candidates);

        for (const wordData of candidates) {
            let quiz = null;
            if (quizType === 'MULTIPLE_CHOICE_MEANING') quiz = this.createMeaningQuiz(wordData, allWords);
            else if (quizType === 'FILL_IN_THE_BLANK') quiz = this.createBlankQuiz(wordData, allWords);
            else if (quizType === 'MULTIPLE_CHOICE_DEFINITION') quiz = await this.createDefinitionQuiz(wordData, allWords);
            if (quiz) return quiz;
        }
        return null;
    },
    async displayNextQuiz() {
        this.showLoader(true, "다음 문제 생성 중...");
        let nextQuiz = null;

        if (this.state.preloadedQuizzes[this.state.quizType]) {
            nextQuiz = this.state.preloadedQuizzes[this.state.quizType];
            this.state.preloadedQuizzes[this.state.quizType] = null;
        } else {
            nextQuiz = await this.generateSingleQuiz(this.state.quizType); // Pass quizType
        }

        if (nextQuiz) {
            this.state.currentQuiz = nextQuiz;
            this.state.answeredWords.add(nextQuiz.question.word);
            this.showLoader(false);
            this.renderQuiz(nextQuiz);
            this.preloadNextQuiz(this.state.quizType);
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
        const isPass = selectedChoice === 'USER_PASSED'; // Check if PASS was selected

        selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect && !isPass) { // Only add to mistakes if incorrect and not passed
            Array.from(this.elements.choices.children).find(li => li.textContent.includes(this.state.currentQuiz.answer))?.classList.add('correct');
            this.state.sessionMistakes.push(this.state.currentQuiz.question.word);
        } else if (isPass) { // If passed, show the correct answer
             Array.from(this.elements.choices.children).find(li => li.textContent.includes(this.state.currentQuiz.answer))?.classList.add('correct');
        }


        this.state.sessionAnsweredInSet++;
        if (isCorrect) this.state.sessionCorrectInSet++;

        // [수정] updateWordStatus가 LocalStorage에 저장합니다.
        // Pass는 incorrect로 처리
        await api.updateWordStatus(this.state.currentQuiz.question.word, this.state.quizType, (isCorrect && !isPass) ? 'correct' : 'incorrect');

        setTimeout(() => {
            if (this.state.sessionAnsweredInSet >= 10) {
                this.showSessionResultModal();
            } else {
                this.displayNextQuiz();
            }
        }, 600);
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
             app.syncOfflineData(); // Sync before leaving quiz mode
            app.navigateTo('selection');
            return;
        }
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
        this.displayNextQuiz();
    },
    async preloadAllQuizTypes() {
        const quizTypes = ['MULTIPLE_CHOICE_MEANING', 'FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE_DEFINITION'];
        for (const type of quizTypes) {
            this.preloadNextQuiz(type);
        }
    },
    async preloadNextQuiz(quizType) {
        if (this.state.preloadedQuizzes[quizType] || this.state.isPreloading[quizType]) {
            return;
        }

        this.state.isPreloading[quizType] = true;
        try {
            const quiz = await this.generateSingleQuiz(quizType); // Pass quizType
            if (quiz) {
                this.state.preloadedQuizzes[quizType] = quiz;
            }
        } catch (error) {
        } finally {
            this.state.isPreloading[quizType] = false;
        }
    },
    reviewSessionMistakes() {
        this.elements.modal.classList.add('hidden');
        const mistakes = [...this.state.sessionMistakes];
        this.state.sessionAnsweredInSet = 0;
        this.state.sessionCorrectInSet = 0;
        this.state.sessionMistakes = [];
         app.syncOfflineData(); // Sync before leaving quiz mode
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

        const firstLine = correctWordData.sample.split('\n')[0]
            .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "")
            .replace(/\*/g, '')
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
        isFavoriteMode: false,
        currentWordList: [],
        isDragging: false,
        touchStartX: 0,
        touchStartY: 0,
    },
    nonInteractiveWords: new Set(['a', 'an', 'the', 'I', 'me', 'my', 'mine', 'you', 'your', 'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'we', 'us', 'our', 'ours', 'they', 'them', 'their', 'theirs', 'this', 'that', 'these', 'those', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'something', 'anybody', 'anyone', 'anything', 'nobody', 'no one', 'nothing', 'everybody', 'everyone', 'everything', 'all', 'any', 'both', 'each', 'either', 'every', 'few', 'little', 'many', 'much', 'neither', 'none', 'one', 'other', 'several', 'some', 'about', 'above', 'across', 'after', 'against', 'along', 'among', 'around', 'at', 'before', 'behind', 'below', 'beneath', 'beside', 'between', 'beyond', 'by', 'down', 'during', 'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 'out', 'outside', 'over', 'past', 'since', 'through', 'throughout', 'to', 'toward', 'under', 'underneath', 'until', 'unto', 'up', 'upon', 'with', 'within', 'without', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so', 'after', 'although', 'as', 'because', 'before', 'if', 'once', 'since', 'than', 'that', 'though', 'till', 'unless', 'until', 'when', 'whenever', 'where', 'whereas', 'wherever', 'whether', 'while', 'that', 'which', 'who', 'whom', 'whose', 'when', 'where', 'why', 'what', 'whatever', 'whichever', 'whoever', 'whomever', 'who', 'whom', 'whose', 'what', 'which', 'when', 'where', 'why', 'how', 'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'done', 'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would', 'ought', 'not', 'very', 'too', 'so', 'just', 'well', 'often', 'always', 'never', 'sometimes', 'here', 'there', 'now', 'then', 'again', 'also', 'ever', 'even', 'how', 'quite', 'rather', 'soon', 'still', 'more', 'most', 'less', 'least', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'then', 'there', 'here', "don't", "didn't", "can't", "couldn't", "she's", "he's", "i'm", "you're", "they're", "we're", "it's", "that's"]),
    elements: {},
     getWordListForGrade(grade) { // Helper to get the correct word list
        return app.state.wordList || []; // word app only has one list
    },
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
            favoriteBtn: document.getElementById('favorite-btn'),
            favoriteIcon: document.getElementById('favorite-icon'),
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.startWordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
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
        this.elements.favoriteBtn.addEventListener('click', () => this.toggleFavorite());

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
        this.state.isFavoriteMode = false;
        this.state.currentWordList = app.state.wordList;
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        if (!app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록 동기화 중...";
            await api.loadWordList();
            await api.loadUserProgress();
        }
        const startWord = this.elements.startWordInput.value.trim();
        if (this.state.currentWordList.length === 0) { this.showError("학습할 단어가 없습니다."); return; }

        if (!startWord) {
            try {
                const savedIndex = parseInt(localStorage.getItem(app.state.LOCAL_STORAGE_KEYS.LAST_INDEX) || '0');
                this.state.currentIndex = savedIndex < this.state.currentWordList.length ? savedIndex : 0;
            } catch (e) {
                this.state.currentIndex = 0;
            }
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
    async displayWord(index) {
        this.updateProgressBar(index);
        this.elements.cardBack.classList.remove('is-slid-up');
        const wordData = this.state.currentWordList[index];
        if (!wordData) return;

         if (!this.state.isMistakeMode && !this.state.isFavoriteMode) {
            try {
                localStorage.setItem(app.state.LOCAL_STORAGE_KEYS.LAST_INDEX, index);
            } catch (e) {
                console.error("Error saving last index to localStorage", e);
            }
        }


        this.elements.wordDisplay.textContent = wordData.word;
        this.adjustWordFontSize();
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>');
        ui.renderExplanationText(this.elements.explanationDisplay, wordData.explanation);
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation?.trim());

        const hasSample = wordData.sample && wordData.sample.trim() !== '';
        const sampleImgUrl = 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png';
        const noSampleImgUrl = 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png';
        this.elements.sampleBtnImg.src = await imageDBCache.loadImage(hasSample ? sampleImgUrl : noSampleImgUrl);

        // [수정] utils.isFavorite 함수 사용
        this.updateFavoriteIcon(utils.isFavorite(wordData.word));
    },
    adjustWordFontSize() {
        const wordDisplay = this.elements.wordDisplay;
        const container = wordDisplay.parentElement;
        wordDisplay.style.fontSize = '';
        const defaultFontSize = parseFloat(window.getComputedStyle(wordDisplay).fontSize);
        let currentFontSize = defaultFontSize;
        while (wordDisplay.scrollWidth > container.clientWidth - 80 && currentFontSize > 12) {
            currentFontSize -= 1;
            wordDisplay.style.fontSize = `${currentFontSize}px`;
        }
    },
    navigate(direction) {
        const len = this.state.currentWordList.length;
        if (len === 0) return;
        this.state.currentIndex = (this.state.currentIndex + direction + len) % len;
        this.displayWord(this.state.currentIndex);
    },
    async handleFlip() {
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = this.state.currentWordList[this.state.currentIndex];

        if (!isBackVisible) {
            if (!wordData.sample || !wordData.sample.trim()) { app.showNoSampleMessage(); return; }
            this.elements.backTitle.textContent = wordData.word;
            ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent);
            this.elements.cardBack.classList.add('is-slid-up');
            const backImgUrl = 'https://images.icon-icons.com/1055/PNG/128/5-remove-cat_icon-icons.com_76681.png';
            this.elements.sampleBtnImg.src = await imageDBCache.loadImage(backImgUrl);
        } else {
            this.elements.cardBack.classList.remove('is-slid-up');
            this.displayWord(this.state.currentIndex);
        }
    },
    async startMistakeReview(mistakeWords) {
        this.state.isMistakeMode = true;
        this.state.isFavoriteMode = false;
        const wordMap = new Map(app.state.wordList.map(wordObj => [wordObj.word, wordObj]));
        this.state.currentWordList = mistakeWords.map(word => wordMap.get(word)).filter(Boolean);
        this.state.currentIndex = 0;
        if (this.state.currentWordList.length === 0) {
            app.showToast("오답 노트에 단어가 없습니다.", true);
            app.navigateTo('selection');
            return;
        }
        this.launchApp();
    },
    async startFavoriteMode() {
        this.state.isMistakeMode = false;
        this.state.isFavoriteMode = true;
        // [수정] utils.getFavoriteWords 사용
        const favoriteWords = utils.getFavoriteWords();
        if(favoriteWords.length === 0) {
            app.showToast("즐겨찾기에 등록된 단어가 없습니다.", true);
            app.navigateTo('selection');
            return;
        }
        const wordMap = new Map(app.state.wordList.map(wordObj => [wordObj.word, wordObj]));
        this.state.currentWordList = favoriteWords.map(word => wordMap.get(word)).filter(Boolean);
        this.state.currentIndex = 0;
        this.launchApp();
    },
    handleKeyDown(e) {
        if (!learningMode.elements.appContainer.classList.contains('hidden')) {
            if (e.key === 'ArrowLeft') this.navigate(-1);
            else if (e.key === 'ArrowRight') this.navigate(1);
            else if (e.key === 'Enter') this.handleFlip();
        }
    },
    handleTouchStart(e) {
        if (this.elements.appContainer.classList.contains('hidden')) return;
        this.state.touchStartX = e.touches[0].clientX;
        this.state.touchStartY = e.touches[0].clientY;
    },
    handleTouchEnd(e) {
        if (this.elements.appContainer.classList.contains('hidden') || this.state.touchStartX === 0) return;
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - this.state.touchStartX;
        const deltaY = touchEndY - this.state.touchStartY;
        const swipeThreshold = 50;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > swipeThreshold) {
                this.navigate(-1);
            } else if (deltaX < -swipeThreshold) {
                this.navigate(1);
            }
        }
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
    async toggleFavorite() {
        const wordData = this.state.currentWordList[this.state.currentIndex];
        if (!wordData) return;
        // [수정] api.toggleFavorite가 로컬에만 저장하고 즉시 상태 반환
        const newStatus = await api.toggleFavorite(wordData.word);
        this.updateFavoriteIcon(newStatus); // 반환된 상태로 아이콘 업데이트

        if (this.state.isFavoriteMode && !newStatus) {
            this.state.currentWordList.splice(this.state.currentIndex, 1);
            if (this.state.currentWordList.length === 0) {
                app.showToast("즐겨찾기 목록이 비었습니다.", false);
                app.navigateTo('selection');
                return;
            }
            if(this.state.currentIndex >= this.state.currentWordList.length) {
                this.state.currentIndex = this.state.currentWordList.length - 1;
            }
            this.displayWord(this.state.currentIndex);
        }
    },
    updateFavoriteIcon(isFavorite) {
        // [수정] isFavorite 인자를 직접 사용 (api.loadFavorites 제거)
        this.elements.favoriteIcon.classList.toggle('text-yellow-400', isFavorite);
        this.elements.favoriteIcon.classList.toggle('text-gray-400', !isFavorite);
        this.elements.favoriteIcon.classList.toggle('fill-current', isFavorite);
    }
};

document.addEventListener('firebaseSDKLoaded', () => {
    ({
        initializeApp, getDatabase, ref, get, update, set,
        getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
        getFirestore, doc, getDoc, setDoc, updateDoc, writeBatch // Ensure writeBatch is imported
    } = window.firebaseSDK);
    window.firebaseSDK.writeBatch = writeBatch; // Make it available globally if needed by other parts
    app.init();
});
