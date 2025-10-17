// ================================================================
// 1. Firebase SDK & 초기화
// ================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAX-cFBU45qFZTAtLYPTolSzqqLTfEvjP0",
    authDomain: "word-91148.firebaseapp.com",
    databaseURL: "https://word-91148-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "word-91148",
    storageBucket: "word-91148.appspot.com",
    messagingSenderId: "53576845185",
    appId: "1:53576845185:web:f519aa3ec751e12cb88a80"
};

const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const database = getDatabase(appFirebase);

// ================================================================
// App Main Controller
// ================================================================
const app = {
    config: {
        TTS_API_KEY: "AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA",
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxtkBmzSHFOOwIOrjkbxXsHAKIBkimjuUjVOWEoUEi0vgxKclHlo4PTGnSTUSF29Ydg/exec"
    },
    state: {
        currentVoiceSet: 'UK', isSpeaking: false, audioContext: null, translateDebounceTimeout: null, 
        wordList: [], isWordListReady: false, longPressTimer: null, isInitialized: false,
    },
    elements: {
        loginScreen: document.getElementById('login-screen'),
        loginBtn: document.getElementById('login-btn'),
        loginError: document.getElementById('login-error'),
        appContainer: document.getElementById('app-container'),
        selectionScreen: document.getElementById('selection-screen'),
        homeBtn: document.getElementById('home-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        ttsToggleBtn: document.getElementById('tts-toggle-btn'),
        ttsToggleText: document.getElementById('tts-toggle-text'),
        quizModeContainer: document.getElementById('quiz-mode-container'),
        learningModeContainer: document.getElementById('learning-mode-container'),
        dashboardContainer: document.getElementById('dashboard-container'),
        translationTooltip: document.getElementById('translation-tooltip'),
        imeWarning: document.getElementById('ime-warning'),
        noSampleMessage: document.getElementById('no-sample-message'),
        sheetLink: document.getElementById('sheet-link'),
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
    },
    init() {
        this.elements.loginBtn.addEventListener('click', this.handleGoogleLogin);

        onAuthStateChanged(auth, user => {
            if (this.state.isInitialized && user?.email === 'puroome@gmail.com') return;

            if (user) {
                if (user.email === 'puroome@gmail.com') {
                    // [수정됨] 앱을 바로 보여주지 않고, 초기화 함수를 먼저 호출
                    if (!this.state.isInitialized) {
                        this.initializeMainApp();
                        this.state.isInitialized = true;
                    }
                } else {
                    this.showLoginError(`'${user.email}' 계정은 접근 권한이 없습니다.`);
                    signOut(auth);
                }
            } else {
                this.showLogin();
                this.state.isInitialized = false;
            }
        });
    },
    handleGoogleLogin() {
        const provider = new GoogleAuthProvider();
        app.elements.loginError.textContent = '로그인 창을 확인해주세요...';
        signInWithPopup(auth, provider).catch(error => {
            console.error("Google 로그인 실패:", error);
            let msg = "로그인에 실패했습니다.";
            if (error.code === 'auth/popup-closed-by-user') msg = "로그인 창이 닫혔습니다.";
            else if (error.code === 'auth/popup-blocked') msg = "팝업이 차단되었습니다. 팝업을 허용해주세요.";
            app.elements.loginError.textContent = msg;
        });
    },
    showLogin() {
        this.elements.loginScreen.classList.remove('hidden');
        this.elements.appContainer.classList.add('hidden');
        // 로그인 화면이 다시 보일 때, 버튼과 에러 메시지를 초기 상태로 복원
        this.elements.loginBtn.style.display = 'flex';
        this.elements.loginError.textContent = '';
    },
    showApp() {
        this.elements.loginScreen.classList.add('hidden');
        this.elements.appContainer.classList.remove('hidden');
    },
    showLoginError(message) {
        this.elements.loginError.textContent = message;
    },
    async initializeMainApp() {
        // [수정됨] 데이터 로딩 중임을 사용자에게 명확히 보여줌
        this.elements.loginError.textContent = '사용자 확인 완료. 데이터를 불러오는 중...';
        this.elements.loginBtn.style.display = 'none'; // 로그인 버튼 숨기기

        try {
            await audioCache.init();
            await translationDBCache.init();
            
            this.bindGlobalEvents();
            await api.loadWordList(); // 데이터를 모두 불러올 때까지 기다림

            // 모든 로딩이 끝나면 앱 화면으로 전환
            this.showApp(); 

            quizMode.init();
            learningMode.init();
            dashboard.init();

            const initialMode = window.location.hash.replace('#', '') || 'selection';
            history.replaceState({ mode: initialMode, options: {} }, '', window.location.href);
            this._renderMode(initialMode);

        } catch (error) {
            // api.loadWordList 내부에서 showFatalError를 호출하므로, 여기서는 별도 처리 불필요
            console.error("앱 초기화 실패:", error);
            // 실패 시 로그인 버튼을 다시 보여줄 수 있음
            this.showLogin();
            this.showLoginError('앱 초기화에 실패했습니다. 새로고침 해주세요.');
        }
    },
    bindGlobalEvents() {
        document.getElementById('select-quiz-btn').addEventListener('click', () => this.navigateTo('quiz'));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.navigateTo('learning'));
        document.getElementById('select-dashboard-btn').addEventListener('click', async () => {
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
        document.getElementById('select-mistakes-btn').addEventListener('click', async () => {
            app.showToast('오답 노트를 불러오는 중...');
            try {
                await api.loadWordList(true);
                const mistakeWords = app.state.wordList.filter(word => word.incorrect === 1).sort((a, b) => (new Date(b.lastIncorrect) || 0) - (new Date(a.lastIncorrect) || 0)).map(wordObj => wordObj.word);
                if (mistakeWords.length === 0) { app.showToast('오답 노트에 단어가 없습니다.', true); return; }
                this.navigateTo('mistakeReview', { mistakeWords });
            } catch (e) { app.showToast(`오답 노트 로딩 실패: ${e.message}`, true); }
        });
        this.elements.homeBtn.addEventListener('click', () => this.navigateTo('selection'));
        this.elements.refreshBtn.addEventListener('click', () => this.forceReload());
        this.elements.ttsToggleBtn.addEventListener('click', this.toggleVoiceSet.bind(this));
        document.body.addEventListener('click', () => { if (!this.state.audioContext) { this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)(); } }, { once: true });
        document.addEventListener('click', (e) => { if (!this.elements.wordContextMenu.contains(e.target)) { ui.hideWordContextMenu(); } });
        window.addEventListener('popstate', (e) => { this._renderMode(e.state?.mode || 'selection', e.state?.options || {}); });
        document.addEventListener('contextmenu', (e) => {
            const isInteractive = e.target.closest('.interactive-word, #word-display, #word-context-menu');
            if (!isInteractive) { e.preventDefault(); }
        });
    },
    navigateTo(mode, options = {}) {
        if (history.state?.mode === mode && mode !== 'learning') return;
        const newPath = (mode === 'selection') ? window.location.pathname + window.location.search : `#${mode}`;
        history.pushState({ mode, options }, '', newPath);
        this._renderMode(mode, options);
    },
    _renderMode(mode, options = {}) {
        [this.elements.selectionScreen, this.elements.quizModeContainer, this.elements.learningModeContainer, this.elements.dashboardContainer, this.elements.homeBtn, this.elements.ttsToggleBtn].forEach(el => el.classList.add('hidden'));
        learningMode.elements.fixedButtons.classList.add('hidden');
        const showCommonButtons = () => { this.elements.homeBtn.classList.remove('hidden'); this.elements.ttsToggleBtn.classList.remove('hidden'); };

        switch (mode) {
            case 'quiz': showCommonButtons(); this.elements.quizModeContainer.classList.remove('hidden'); quizMode.reset(); break;
            case 'learning':
                showCommonButtons(); this.elements.learningModeContainer.classList.remove('hidden');
                learningMode.elements.appContainer.classList.add('hidden');
                learningMode.elements.loader.classList.add('hidden');
                learningMode.elements.startScreen.classList.remove('hidden');
                if (options.suggestions && options.title) { learningMode.displaySuggestions(options.suggestions.vocab, options.suggestions.explanation, options.title); }
                else { learningMode.resetStartScreen(); }
                break;
            case 'dashboard': this.elements.homeBtn.classList.remove('hidden'); this.elements.dashboardContainer.classList.remove('hidden'); break;
            case 'mistakeReview':
                if (!options.mistakeWords || options.mistakeWords.length === 0) { app.showToast('오답 노트에 단어가 없습니다.', true); this.navigateTo('selection'); return; }
                showCommonButtons(); this.elements.learningModeContainer.classList.remove('hidden');
                learningMode.startMistakeReview(options.mistakeWords);
                break;
            default: this.elements.selectionScreen.classList.remove('hidden'); quizMode.reset(); learningMode.reset();
        }
    },
    async forceReload() {
        const isSelectionScreen = !this.elements.selectionScreen.classList.contains('hidden');
        if (!isSelectionScreen) { this.showToast('새로고침은 모드 선택 화면에서만 가능합니다.', true); return; }
        
        const elements = [this.elements.refreshBtn, this.elements.selectDashboardBtn, this.elements.selectMistakesBtn, this.elements.sheetLink, this.elements.selectLearningBtn, this.elements.selectQuizBtn];
        elements.forEach(el => el.classList.add('pointer-events-none', 'opacity-50'));
        const refreshIcon = this.elements.refreshBtn.querySelector('svg');
        if (refreshIcon) refreshIcon.classList.add('animate-spin');

        try { await api.loadWordList(true); this.showToast('데이터를 성공적으로 새로고침했습니다!'); }
        catch (e) { this.showToast('데이터 새로고침에 실패했습니다: ' + e.message, true); }
        finally { elements.forEach(el => el.classList.remove('pointer-events-none', 'opacity-50')); if (refreshIcon) refreshIcon.classList.remove('animate-spin'); }
    },
    showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `fixed top-20 left-1/2 -translate-x-1/2 text-white py-2 px-5 rounded-lg shadow-xl z-[200] text-lg font-semibold ${isError ? 'bg-red-500' : 'bg-green-500'}`;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2500);
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
        selectionDiv.innerHTML = `<div class="p-8 text-center"><h1 class="text-3xl font-bold text-red-600 mb-4">앱 시작 실패</h1><p class="text-gray-700 mb-6">데이터 로딩 중 문제가 발생했습니다.<br>Firebase DB에 'vocabulary' 데이터가 있는지 확인해주세요.</p><div class="bg-red-50 text-red-700 p-4 rounded-lg text-left text-sm break-all"><p class="font-semibold">오류:</p><p>${message}</p></div></div>`;
        this.showApp();
        this._renderMode('selection');
    },
    showImeWarning() {
        this.elements.imeWarning.classList.remove('hidden');
        clearTimeout(this.imeWarningTimeout);
        this.imeWarningTimeout = setTimeout(() => { this.elements.imeWarning.classList.add('hidden'); }, 2000);
    },
    showNoSampleMessage() {
        const msgEl = this.elements.noSampleMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => { msgEl.classList.add('opacity-0'); setTimeout(() => msgEl.classList.add('hidden'), 500); }, 1500);
    },
    searchWordInLearningMode(word) {
        if (!word) return;
        const { wordList } = this.state;
        const lowerCaseWord = word.toLowerCase();
        const exactMatchIndex = wordList.findIndex(item => item.word.toLowerCase() === lowerCaseWord);
        if (exactMatchIndex !== -1) {
            this.navigateTo('learning');
            setTimeout(() => {
                learningMode.state.isMistakeMode = false;
                learningMode.state.currentWordList = app.state.wordList;
                learningMode.state.currentIndex = exactMatchIndex;
                learningMode.launchApp();
            }, 50);
            ui.hideWordContextMenu();
            return;
        }
        const searchRegex = new RegExp(`\\b${lowerCaseWord}\\b`, 'i');
        const explanationMatches = wordList.map((item, index) => ({ word: item.word, index })).filter((_, index) => wordList[index].explanation?.replace(/\[.*?\]/g, '').match(searchRegex));
        const levenshteinSuggestions = wordList.map((item, index) => ({ word: item.word, index, distance: utils.levenshteinDistance(lowerCaseWord, item.word.toLowerCase()) })).sort((a, b) => a.distance - b.distance).slice(0, 5);
        if (explanationMatches.length > 0 || levenshteinSuggestions.length > 0) {
            this.navigateTo('learning', { suggestions: { vocab: levenshteinSuggestions, explanation: explanationMatches }, title: `'<strong>${word}</strong>' 관련 단어를 찾았습니다.` });
        } else {
            this.navigateTo('learning', { suggestions: { vocab: [], explanation: [] }, title: `입력하신 단어를 찾을 수 없습니다.<br>혹시 이 단어를 찾으시나요?` });
        }
        ui.hideWordContextMenu();
    },
};

const audioCache = {
    db: null, dbName: 'ttsAudioCacheDB', storeName: 'audioStore',
    init() { return new Promise((resolve) => { if (!('indexedDB' in window)) { console.warn('IndexedDB not supported'); return resolve(); } const r = indexedDB.open(this.dbName, 1); r.onupgradeneeded = e => { e.target.result.createObjectStore(this.storeName); }; r.onsuccess = e => { this.db = e.target.result; resolve(); }; r.onerror = e => { console.error("DB error:", e.target.error); resolve(); }; }); },
    getAudio(key) { return new Promise((resolve) => { if (!this.db) return resolve(null); this.db.transaction([this.storeName]).objectStore(this.storeName).get(key).onsuccess = e => resolve(e.target.result); }); },
    saveAudio(key, data) { if (this.db) try { this.db.transaction([this.storeName], 'readwrite').objectStore(this.storeName).put(data, key); } catch (e) { console.error("DB save error", e); } }
};

const translationDBCache = {
    db: null, dbName: 'translationCacheDB', storeName: 'translationStore',
    init() { return new Promise((resolve) => { if (!('indexedDB' in window)) { console.warn('IndexedDB not supported'); return resolve(); } const r = indexedDB.open(this.dbName, 1); r.onupgradeneeded = e => { e.target.result.createObjectStore(this.storeName); }; r.onsuccess = e => { this.db = e.target.result; resolve(); }; r.onerror = e => { console.error("DB error:", e.target.error); resolve(); }; }); },
    get(key) { return new Promise((resolve) => { if (!this.db) return resolve(null); this.db.transaction([this.storeName]).objectStore(this.storeName).get(key).onsuccess = e => resolve(e.target.result); }); },
    save(key, data) { if (this.db) try { this.db.transaction([this.storeName], 'readwrite').objectStore(this.storeName).put(data, key); } catch (e) { console.error("DB save error", e); } }
};

const api = {
    async loadWordList(force = false) {
        if (force) { sessionStorage.removeItem('wordListCache'); app.state.isWordListReady = false; }
        const cachedData = sessionStorage.getItem('wordListCache');
        if (!force && cachedData) {
            try { app.state.wordList = JSON.parse(cachedData); app.state.isWordListReady = true; return; }
            catch (e) { sessionStorage.removeItem('wordListCache'); }
        }
        try {
            const snapshot = await get(ref(database, 'vocabulary'));
            if (!snapshot.exists()) throw new Error("Firebase에 'vocabulary' 데이터가 없습니다.");
            app.state.wordList = Object.values(snapshot.val());
            app.state.isWordListReady = true;
            try { sessionStorage.setItem('wordListCache', JSON.stringify(app.state.wordList)); }
            catch (e) { console.error("Session storage save failed", e); }
        } catch (error) {
            console.error("Firebase 단어 목록 로딩 실패:", error);
            app.showFatalError(error.message);
            throw error;
        }
    },
    async speak(text, contentType = 'word') {
        const voiceSets = {
            'UK': { 'word': { languageCode: 'en-GB', name: 'en-GB-Wavenet-D' }, 'sample': { languageCode: 'en-GB', name: 'en-GB-Journey-D' } },
            'US': { 'word': { languageCode: 'en-US', name: 'en-US-Wavenet-F' }, 'sample': { languageCode: 'en-US', name: 'en-US-Journey-F' } }
        };
        if (!text || !text.trim() || app.state.isSpeaking || !app.state.audioContext) return;
        if (app.state.audioContext.state === 'suspended') app.state.audioContext.resume();
        app.state.isSpeaking = true;
        const processedText = text.replace(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)\s*/u, '').replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');
        const voiceConfig = voiceSets[app.state.currentVoiceSet][contentType];
        const cacheKey = `${processedText}|${voiceConfig.languageCode}|${voiceConfig.name}`;
        const playAudio = async (buffer) => {
            const audioBuffer = await app.state.audioContext.decodeAudioData(buffer.slice(0));
            const source = app.state.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(app.state.audioContext.destination);
            source.start(0);
            source.onended = () => { app.state.isSpeaking = false; };
        };
        try {
            const cachedAudio = await audioCache.getAudio(cacheKey);
            if (cachedAudio) { await playAudio(cachedAudio); return; }
            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${app.config.TTS_API_KEY}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: { text: processedText }, voice: voiceConfig, audioConfig: { audioEncoding: 'MP3' } })
            });
            if (!response.ok) throw new Error(`TTS API Error: ${(await response.json()).error.message}`);
            const data = await response.json();
            const byteCharacters = atob(data.audioContent);
            const byteArray = new Uint8Array(byteCharacters.length).map((_, i) => byteCharacters.charCodeAt(i));
            const audioArrayBuffer = byteArray.buffer;
            audioCache.saveAudio(cacheKey, audioArrayBuffer);
            await playAudio(audioArrayBuffer);
        } catch (error) { console.error('TTS 실패:', error); app.state.isSpeaking = false; }
    },
    async fetchFromGoogleSheet(action, params = {}) {
        const url = new URL(app.config.SCRIPT_URL);
        url.searchParams.append('action', action);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) url.searchParams.append(key, value);
        });
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.message);
        return data;
    },
    async updateSRSData(word, isCorrect, quizType) {
        try {
            const response = await this.fetchFromGoogleSheet('updateSRSData', { word, isCorrect, quizType });
            if (response.success && response.updatedWord) {
                const wordIndex = app.state.wordList.findIndex(w => w.word === word);
                if (wordIndex > -1) { Object.assign(app.state.wordList[wordIndex], response.updatedWord); }
                sessionStorage.setItem('wordListCache', JSON.stringify(app.state.wordList));
                document.dispatchEvent(new CustomEvent('wordListUpdated'));
            }
        } catch (error) { console.error('SRS 업데이트 실패:', error); app.showToast('학습 상태 업데이트 실패.', true); }
    },
    async translateText(text) {
        const cacheKey = `translation_${text}`;
        try {
            const cached = await translationDBCache.get(cacheKey);
            if (cached) return cached;
            const data = await this.fetchFromGoogleSheet('translateText', { text });
            if (data.success) { translationDBCache.save(cacheKey, data.translatedText); return data.translatedText; }
            throw new Error(data.message);
        } catch (error) { console.error('번역 실패:', error); return "번역 실패"; }
    }
};

const ui = {
    adjustFontSize(element) { element.style.fontSize = ''; let fs = parseFloat(window.getComputedStyle(element).fontSize); const p = element.parentElement; const pW = p.clientWidth - parseFloat(window.getComputedStyle(p).paddingLeft) - parseFloat(window.getComputedStyle(p).paddingRight); while (element.scrollWidth > pW && fs > 16) element.style.fontSize = `${--fs}px`; },
    async copyToClipboard(text) { try { await navigator.clipboard.writeText(text); } catch (err) { console.error('Clipboard copy failed:', err); } },
    renderInteractiveText(target, text) { target.innerHTML = ''; if (!text || !text.trim()) return; const regex = /(\[.*?\])|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g; text.split('\n').forEach(line => { let lastIndex = 0, match; while ((match = regex.exec(line))) { if (match.index > lastIndex) target.appendChild(document.createTextNode(line.substring(lastIndex, match.index))); const [_, nonClickable, phrase] = match; if (phrase) { const span = document.createElement('span'); span.textContent = phrase; span.className = 'cursor-pointer hover:bg-yellow-200 p-1 rounded-sm transition-colors interactive-word'; span.onclick = () => { clearTimeout(app.state.longPressTimer); api.speak(phrase, 'word'); this.copyToClipboard(phrase); }; span.oncontextmenu = e => { e.preventDefault(); this.showWordContextMenu(e, phrase); }; let touchMove = false; span.addEventListener('touchstart', e => { touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) this.showWordContextMenu(e, phrase); }, 700); }); span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); }); span.addEventListener('touchend', () => clearTimeout(app.state.longPressTimer)); target.appendChild(span); } else if (nonClickable) { target.appendChild(document.createTextNode(nonClickable)); } lastIndex = regex.lastIndex; } if (lastIndex < line.length) target.appendChild(document.createTextNode(line.substring(lastIndex))); target.appendChild(document.createElement('br')); }); if (target.lastChild?.tagName === 'BR') target.removeChild(target.lastChild); },
    handleSentenceMouseOver(event, sentence) { clearTimeout(app.state.translateDebounceTimeout); app.state.translateDebounceTimeout = setTimeout(async () => { const tooltip = app.elements.translationTooltip; const rect = event.target.getBoundingClientRect(); Object.assign(tooltip.style, { left: `${rect.left + window.scrollX}px`, top: `${rect.bottom + window.scrollY + 5}px` }); tooltip.textContent = '번역 중...'; tooltip.classList.remove('hidden'); tooltip.textContent = await api.translateText(sentence); }, 1000); },
    handleSentenceMouseOut() { clearTimeout(app.state.translateDebounceTimeout); app.elements.translationTooltip.classList.add('hidden'); },
    displaySentences(sentences, container) { container.innerHTML = ''; sentences.filter(s => s.trim()).forEach(sentence => { const p = document.createElement('p'); p.className = 'p-2 rounded transition-colors cursor-pointer hover:bg-gray-200 sample-sentence'; p.onclick = () => api.speak(p.textContent, 'sample'); p.addEventListener('mouseover', e => { if (!e.target.classList.contains('interactive-word')) this.handleSentenceMouseOver(e, p.textContent); else this.handleSentenceMouseOut(); }); p.addEventListener('mouseout', () => this.handleSentenceMouseOut()); const process = (target, text) => { text.split(/([,\s\.'])/g).filter(Boolean).forEach(part => { if (/[a-zA-Z]/.test(part)) { const span = document.createElement('span'); span.textContent = part; span.className = 'hover:bg-yellow-200 rounded-sm transition-colors interactive-word'; span.onclick = e => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); api.speak(part, 'word'); this.copyToClipboard(part); }; span.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); this.showWordContextMenu(e, part); }; let t = false; span.addEventListener('touchstart', e => { e.stopPropagation(); t = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!t) this.showWordContextMenu(e, part); }, 700); }, { passive: true }); span.addEventListener('touchmove', e => { e.stopPropagation(); t = true; clearTimeout(app.state.longPressTimer); }); span.addEventListener('touchend', e => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); }); target.appendChild(span); } else { target.appendChild(document.createTextNode(part)); } }); }; sentence.split(/(\*.*?\*)/g).forEach(part => { if (part.startsWith('*') && part.endsWith('*')) { const strong = document.createElement('strong'); process(strong, part.slice(1, -1)); p.appendChild(strong); } else if (part) { process(p, part); } }); container.appendChild(p); }); },
    showWordContextMenu(event, word, options = {}) { event.preventDefault(); const menu = app.elements.wordContextMenu; app.elements.searchAppContextBtn.style.display = options.hideAppSearch ? 'none' : 'block'; const touch = event.touches?.[0] || event; menu.style.top = `${touch.clientY}px`; menu.style.left = `${touch.clientX}px`; menu.classList.remove('hidden'); const encoded = encodeURIComponent(word); app.elements.searchAppContextBtn.onclick = () => app.searchWordInLearningMode(word); app.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encoded}`); this.hideWordContextMenu(); }; app.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encoded}`); this.hideWordContextMenu(); }; app.elements.searchEtymContextBtn.onclick = () => { window.open(`https://www.etymonline.com/search?q=${encoded}`); this.hideWordContextMenu(); }; app.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encoded}`); this.hideWordContextMenu(); }; },
    hideWordContextMenu() { app.elements.wordContextMenu.classList.add('hidden'); }
};

const utils = {
    levenshteinDistance(a = '', b = '') { const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null)); for (let i = 0; i <= a.length; i += 1) track[0][i] = i; for (let j = 0; j <= b.length; j += 1) track[j][0] = j; for (let j = 1; j <= b.length; j += 1) for (let i = 1; i <= a.length; i += 1) { const indicator = a[i - 1] === b[j - 1] ? 0 : 1; track[j][i] = Math.min(track[j][i - 1] + 1, track[j - 1][i] + 1, track[j - 1][i - 1] + indicator); } return track[b.length][a.length]; }
};

const dashboard = {
    elements: { container: document.getElementById('dashboard-container'), content: document.getElementById('dashboard-content') },
    init() { document.addEventListener('wordListUpdated', () => { if (!this.elements.container.classList.contains('hidden')) this.render(); }); },
    async show() { if (!app.state.isWordListReady) { this.elements.content.innerHTML = `<div class="p-10 text-center"><div class="loader mx-auto"></div><p class="mt-4 text-gray-600">로딩중...</p></div>`; await new Promise(r => { const i = setInterval(() => { if (app.state.isWordListReady) { clearInterval(i); r(); } }, 100); }); } this.render(); },
    render() { const { wordList } = app.state; const total = wordList.length; const stages = [{ n: '새 단어', c: 0, cl: 'bg-gray-400' }, { n: '학습 중', c: 0, cl: 'bg-blue-500' }, { n: '익숙함', c: 0, cl: 'bg-yellow-500' }, { n: '학습 완료', c: 0, cl: 'bg-green-500' }]; wordList.forEach(w => { const s = (w.srsMeaning === 1 ? 1 : 0) + (w.srsBlank === 1 ? 1 : 0) + (w.srsDefinition === 1 ? 1 : 0); if (w.srsMeaning === null && w.srsBlank === null && w.srsDefinition === null) stages[0].c++; else if (s === 3) stages[3].c++; else if (s === 2) stages[2].c++; else stages[1].c++; }); this.elements.content.innerHTML = `<div class="p-4 text-center bg-gray-50 rounded-lg shadow-inner"><p class="text-lg text-gray-600">총 단어</p><p class="text-4xl font-bold text-gray-800">${total}</p></div><div><h2 class="mb-3 text-xl font-bold text-center text-gray-700">학습 단계</h2><div class="space-y-4">${stages.map(s => { const p = total > 0 ? (s.c / total * 100).toFixed(1) : 0; return `<div><div class="flex items-center justify-between mb-1"><span class="text-base font-semibold text-gray-700">${s.n}</span><span class="text-sm font-medium text-gray-500">${s.c}개 (${p}%)</span></div><div class="w-full h-4 bg-gray-200 rounded-full"><div class="${s.cl} h-4 rounded-full" style="width: ${p}%"></div></div></div>`; }).join('')}</div></div>`; }
};

const quizMode = {
    state: { currentQuiz: {}, quizType: null, quizBatch: [], isFetching: false, isFinished: false, allWordsLearned: false },
    elements: {},
    init() { this.elements = { quizSelectionScreen: document.getElementById('quiz-selection-screen'), startMeaningQuizBtn: document.getElementById('start-meaning-quiz-btn'), startBlankQuizBtn: document.getElementById('start-blank-quiz-btn'), startDefinitionQuizBtn: document.getElementById('start-definition-quiz-btn'), loader: document.getElementById('quiz-loader'), loaderText: document.getElementById('quiz-loader-text'), contentContainer: document.getElementById('quiz-content-container'), cardFront: document.getElementById('quiz-card-front'), questionDisplay: document.getElementById('quiz-question-display'), choices: document.getElementById('quiz-choices'), finishedScreen: document.getElementById('quiz-finished-screen'), finishedMessage: document.getElementById('quiz-finished-message'), }; this.bindEvents(); },
    bindEvents() { this.elements.startMeaningQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_MEANING')); this.elements.startBlankQuizBtn.addEventListener('click', () => this.start('FILL_IN_THE_BLANK')); this.elements.startDefinitionQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_DEFINITION')); document.addEventListener('keydown', e => { const isActive = !this.elements.contentContainer.classList.contains('hidden') && !this.elements.choices.classList.contains('disabled'); if (!isActive) return; const choiceCount = Array.from(this.elements.choices.children).filter(el => !el.textContent.includes('PASS')).length; if (e.key.toLowerCase() === 'p' || e.key === '0') { e.preventDefault(); Array.from(this.elements.choices.children).find(el => el.textContent.includes('PASS'))?.click(); } else { const idx = parseInt(e.key); if (idx >= 1 && idx <= choiceCount) { e.preventDefault(); this.elements.choices.children[idx - 1].click(); } } }); },
    async start(type) { this.state.quizType = type; this.elements.quizSelectionScreen.classList.add('hidden'); this.showLoader(true); if (!app.state.isWordListReady) { this.elements.loaderText.textContent = "단어 목록 동기화중..."; await new Promise(r => { const i = setInterval(() => { if (app.state.isWordListReady) { clearInterval(i); r(); } }, 100); }); } this.elements.loaderText.textContent = "퀴즈 준비중..."; await this.fetchQuizBatch(2); this.displayNextQuiz(); },
    reset() { Object.assign(this.state, { quizBatch: [], isFetching: false, isFinished: false, allWordsLearned: false, quizType: null }); this.elements.quizSelectionScreen.classList.remove('hidden'); ['loader', 'contentContainer', 'finishedScreen'].forEach(k => this.elements[k].classList.add('hidden')); },
    async fetchQuizBatch(size) { if (this.state.isFetching || this.state.isFinished) return; this.state.isFetching = true; try { const data = await api.fetchFromGoogleSheet('getQuizBatch', { quizType: this.state.quizType, batchSize: size, excludeWords: this.state.quizBatch.map(q => q.question.word).join(',') }); if (data.quizzes?.length) { this.state.quizBatch.push(...data.quizzes); } else if (this.state.quizBatch.length === 0) { this.state.isFinished = true; this.state.allWordsLearned = data.allWordsLearned; } } catch (error) { this.showError(error.message); } finally { this.state.isFetching = false; } },
    showError(message) { this.elements.loader.querySelector('.loader').style.display = 'none'; this.elements.loaderText.innerHTML = `<p class="font-bold text-red-500">퀴즈 로딩 실패</p><p class="mt-2 text-sm text-gray-600 break-all">${message}</p>`; },
    displayNextQuiz() { if (this.state.quizBatch.length <= 2 && !this.state.isFetching && !this.state.isFinished) this.fetchQuizBatch(10); if (this.state.quizBatch.length === 0) { if (this.state.isFinished) this.showFinishedScreen(); else { this.showLoader(true, "다음 퀴즈 로딩중..."); setTimeout(() => { if (this.state.quizBatch.length > 0) this.displayNextQuiz(); else { this.state.isFinished = true; this.showFinishedScreen(); } }, 1500); } return; } this.state.currentQuiz = this.state.quizBatch.shift(); this.showLoader(false); this.renderQuiz(this.state.currentQuiz); },
    renderQuiz(quiz) { this.elements.cardFront.classList.remove('hidden'); const { type, question, choices } = quiz; const qd = this.elements.questionDisplay; qd.innerHTML = ''; qd.className = 'bg-green-100 p-4 rounded-lg mb-4 flex min-h-[100px]'; if (type === 'FILL_IN_THE_BLANK') { const p = document.createElement('p'); p.className = 'sm:text-2xl text-xl text-left text-gray-800 leading-relaxed quiz-sentence-indent'; const process = (target, text) => { text.split(/([,\s\.'])/g).filter(Boolean).forEach(part => { if (/[a-zA-Z]/.test(part)) { const span = document.createElement('span'); span.textContent = part; span.className = 'hover:bg-yellow-200 rounded-sm transition-colors interactive-word'; span.onclick = e => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); api.speak(part, 'word'); ui.copyToClipboard(part); }; span.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); ui.showWordContextMenu(e, part); }; let t = false; span.addEventListener('touchstart', e => { e.stopPropagation(); t = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!t) ui.showWordContextMenu(e, part); }, 700); }, { passive: true }); span.addEventListener('touchmove', e => { e.stopPropagation(); t = true; clearTimeout(app.state.longPressTimer); }); span.addEventListener('touchend', e => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); }); target.appendChild(span); } else { target.appendChild(document.createTextNode(part)); } }); }; question.sentence_with_blank.split(/(\*.*?\*|＿＿＿＿)/g).forEach(part => { if (part === '＿＿＿＿') { const s = document.createElement('span'); s.style.whiteSpace = 'nowrap'; s.textContent = '＿＿＿＿'; p.appendChild(s); } else if (part?.startsWith('*') && part.endsWith('*')) { const strong = document.createElement('strong'); process(strong, part.slice(1, -1)); p.appendChild(strong); } else if (part) { process(p, part); } }); qd.appendChild(p); } else if (type === 'MULTIPLE_CHOICE_MEANING') { qd.classList.add('justify-center', 'items-center'); qd.innerHTML = `<h1 class="sm:text-4xl text-3xl font-bold text-center text-gray-800">${question.word}</h1>`; const h1 = qd.querySelector('h1'); h1.addEventListener('click', () => { api.speak(question.word, 'word'); ui.copyToClipboard(question.word); }); ui.adjustFontSize(h1); } else if (type === 'MULTIPLE_CHOICE_DEFINITION') { ui.displaySentences([question.definition], qd); qd.querySelector('.sample-sentence')?.classList.add('text-lg', 'sm:text-xl', 'text-left', 'text-gray-800', 'leading-relaxed'); } this.elements.choices.innerHTML = ''; const displayChoices = (type === 'MULTIPLE_CHOICE_MEANING') ? choices.map(c => c.split('\n')[0]) : choices; displayChoices.forEach((choice, i) => { const li = document.createElement('li'); li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer flex items-start transition-all'; li.innerHTML = `<span class="mr-3 font-bold">${i + 1}.</span> <span>${(type === 'MULTIPLE_CHOICE_MEANING') ? choices[i] : choice}</span>`; li.onclick = () => this.checkAnswer(li, choice); this.elements.choices.appendChild(li); }); const pass = document.createElement('li'); pass.className = 'choice-item border-2 border-red-500 bg-red-500 hover:bg-red-600 text-white p-4 rounded-lg cursor-pointer flex items-center justify-center transition-all font-bold text-lg'; pass.innerHTML = `<span>PASS</span>`; pass.onclick = () => this.checkAnswer(pass, 'USER_PASSED'); this.elements.choices.appendChild(pass); this.elements.choices.classList.remove('disabled'); },
    async checkAnswer(li, choice) { this.elements.choices.classList.add('disabled'); const isCorrect = choice === this.state.currentQuiz.answer; li.classList.add(isCorrect ? 'correct' : 'incorrect'); if (!isCorrect) Array.from(this.elements.choices.children).find(el => el.querySelector('span:last-child')?.textContent === this.state.currentQuiz.answer)?.classList.add('correct'); const { word } = this.state.currentQuiz.question; const idx = app.state.wordList.findIndex(w => w.word === word); if (idx > -1) { const key = { 'MULTIPLE_CHOICE_MEANING': 'srsMeaning', 'FILL_IN_THE_BLANK': 'srsBlank', 'MULTIPLE_CHOICE_DEFINITION': 'srsDefinition' }[this.state.quizType]; if (key) app.state.wordList[idx][key] = isCorrect ? 1 : 0; } api.updateSRSData(word, isCorrect, this.state.quizType).catch(e => console.error("BG update failed:", e)); setTimeout(() => this.displayNextQuiz(), 1000); },
    showLoader(isLoading, msg = '퀴즈 준비중...') { this.elements.loader.classList.toggle('hidden', !isLoading); this.elements.loaderText.textContent = msg; this.elements.contentContainer.classList.toggle('hidden', isLoading); ['quizSelectionScreen', 'finishedScreen'].forEach(k => this.elements[k].classList.add('hidden')); },
    showFinishedScreen() { this.showLoader(false); this.elements.contentContainer.classList.add('hidden'); this.elements.finishedScreen.classList.remove('hidden'); this.elements.finishedMessage.innerHTML = this.state.allWordsLearned ? "축하합니다!<br>모든 단어 학습을 완료했습니다!" : "풀 수 있는 퀴즈를 모두 완료했습니다.<br>새로운 단어를 학습하거나 내일 다시 도전해 주세요."; }
};

const learningMode = {
    state: { currentIndex: 0, touchstartX: 0, touchstartY: 0, isMistakeMode: false, currentWordList: [] },
    elements: {},
    init() { Object.assign(this.elements, { startScreen: document.getElementById('learning-start-screen'), startInputContainer: document.getElementById('learning-start-input-container'), startWordInput: document.getElementById('learning-start-word-input'), startBtn: document.getElementById('learning-start-btn'), suggestionsContainer: document.getElementById('learning-suggestions-container'), suggestionsTitle: document.getElementById('learning-suggestions-title'), suggestionsVocabList: document.getElementById('learning-suggestions-vocab-list'), suggestionsExplanationList: document.getElementById('learning-suggestions-explanation-list'), backToStartBtn: document.getElementById('learning-back-to-start-btn'), loader: document.getElementById('learning-loader'), loaderText: document.getElementById('learning-loader-text'), appContainer: document.getElementById('learning-app-container'), cardBack: document.getElementById('learning-card-back'), wordDisplay: document.getElementById('word-display'), meaningDisplay: document.getElementById('meaning-display'), explanationDisplay: document.getElementById('explanation-display'), explanationContainer: document.getElementById('explanation-container'), fixedButtons: document.getElementById('learning-fixed-buttons'), nextBtn: document.getElementById('next-btn'), prevBtn: document.getElementById('prev-btn'), sampleBtn: document.getElementById('sample-btn'), sampleBtnImg: document.getElementById('sample-btn-img'), backTitle: document.getElementById('learning-back-title'), backContent: document.getElementById('learning-back-content') }); this.bindEvents(); },
    bindEvents() { this.elements.startBtn.addEventListener('click', () => this.start()); this.elements.startWordInput.addEventListener('keydown', e => { if (e.key === 'Enter') this.start(); }); this.elements.startWordInput.addEventListener('input', e => { const val = e.target.value; const sanitized = val.replace(/[^a-zA-Z\s'-]/g, ''); if (val !== sanitized) app.showImeWarning(); e.target.value = sanitized; }); this.elements.backToStartBtn.addEventListener('click', () => this.resetStartScreen()); this.elements.nextBtn.addEventListener('click', () => this.navigate(1)); this.elements.prevBtn.addEventListener('click', () => this.navigate(-1)); this.elements.sampleBtn.addEventListener('click', () => this.handleFlip()); this.elements.wordDisplay.addEventListener('click', () => { const word = this.state.currentWordList[this.state.currentIndex]?.word; if (word) { api.speak(word, 'word'); ui.copyToClipboard(word); } }); this.elements.wordDisplay.addEventListener('contextmenu', e => { e.preventDefault(); const wordData = this.state.currentWordList[this.state.currentIndex]; if (wordData) ui.showWordContextMenu(e, wordData.word, { hideAppSearch: true }); }); let t = false; this.elements.wordDisplay.addEventListener('touchstart', e => { t = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!t) { const w = this.state.currentWordList[this.state.currentIndex]; if (w) ui.showWordContextMenu(e, w.word, { hideAppSearch: true }); } }, 700); }, { passive: true }); this.elements.wordDisplay.addEventListener('touchmove', () => { t = true; clearTimeout(app.state.longPressTimer); }); this.elements.wordDisplay.addEventListener('touchend', () => clearTimeout(app.state.longPressTimer)); document.addEventListener('mousedown', e => this.handleMiddleClick(e)); document.addEventListener('keydown', e => this.handleKeyDown(e)); document.addEventListener('touchstart', e => this.handleTouchStart(e), { passive: true }); document.addEventListener('touchend', e => this.handleTouchEnd(e)); },
    async start() { this.state.isMistakeMode = false; this.state.currentWordList = app.state.wordList; this.elements.startScreen.classList.add('hidden'); this.elements.loader.classList.remove('hidden'); if (!app.state.isWordListReady) { this.elements.loaderText.textContent = "단어 목록 동기화중..."; await new Promise(r => { const i = setInterval(() => { if (app.state.isWordListReady) { clearInterval(i); r(); } }, 100); }); } const startWord = this.elements.startWordInput.value.trim(); const { currentWordList } = this.state; if (currentWordList.length === 0) { this.showError("학습할 단어가 없습니다."); return; } if (!startWord) { this.elements.loaderText.textContent = "마지막 학습 위치 로딩중..."; try { const data = await api.fetchFromGoogleSheet('getLastLearnedIndex'); this.state.currentIndex = (data.index >= 0 && data.index < currentWordList.length) ? data.index : 0; this.launchApp(); } catch (e) { app.showToast("마지막 학습 위치 로딩 실패. 처음부터 시작합니다.", true); this.state.currentIndex = 0; this.launchApp(); } return; } const lower = startWord.toLowerCase(); const exactIdx = currentWordList.findIndex(i => i.word.toLowerCase() === lower); if (exactIdx > -1) { this.state.currentIndex = exactIdx; this.launchApp(); return; } const regex = new RegExp(`\\b${lower}\\b`, 'i'); const explanationMatches = currentWordList.map((item, index) => ({ word: item.word, index })).filter((_, i) => currentWordList[i].explanation?.replace(/\[.*?\]/g, '').match(regex)); const levenshteinSuggestions = currentWordList.map((item, index) => ({ word: item.word, index, distance: utils.levenshteinDistance(lower, item.word.toLowerCase()) })).sort((a, b) => a.distance - b.distance).slice(0, 5).filter(s => s.distance < s.word.length / 2 + 1); if (levenshteinSuggestions.length > 0 || explanationMatches.length > 0) { this.displaySuggestions(levenshteinSuggestions, explanationMatches, `<strong>${startWord}</strong> 없으니, 아래에서 확인하세요.`); } else { this.displaySuggestions([], [], `<strong>${startWord}</strong>에 대한 검색 결과가 없습니다.`); } },
    showError(message) { this.elements.loader.querySelector('.loader').style.display = 'none'; this.elements.loaderText.innerHTML = `<p class="font-bold text-red-500">오류</p><p class="mt-2 text-sm text-gray-600 break-all">${message}</p>`; },
    launchApp() { this.elements.loader.classList.add('hidden'); this.elements.appContainer.classList.remove('hidden'); this.elements.fixedButtons.classList.remove('hidden'); this.displayWord(this.state.currentIndex); },
    reset() { ['appContainer', 'loader', 'fixedButtons'].forEach(k => this.elements[k].classList.add('hidden')); this.elements.startScreen.classList.remove('hidden'); this.resetStartScreen(); },
    resetStartScreen() { this.elements.startInputContainer.classList.remove('hidden'); this.elements.suggestionsContainer.classList.add('hidden'); this.elements.startWordInput.value = ''; this.elements.startWordInput.focus(); },
    displaySuggestions(vocab, explanation, title) { this.elements.loader.classList.add('hidden'); this.elements.startScreen.classList.remove('hidden'); this.elements.startInputContainer.classList.add('hidden'); this.elements.suggestionsTitle.innerHTML = title; const populate = (listEl, suggestions) => { listEl.innerHTML = ''; if (suggestions.length === 0) { listEl.innerHTML = '<p class="p-3 text-sm text-gray-400">결과 없음</p>'; return; } suggestions.forEach(({ word, index }) => { const btn = document.createElement('button'); btn.className = 'w-full text-left bg-gray-100 hover:bg-gray-200 py-3 px-4 rounded-lg transition-colors'; btn.textContent = word; btn.onclick = () => { this.state.currentIndex = index; this.launchApp(); }; listEl.appendChild(btn); }); }; populate(this.elements.suggestionsVocabList, vocab); populate(this.elements.suggestionsExplanationList, explanation); this.elements.suggestionsContainer.classList.remove('hidden'); },
    displayWord(index) { if (!this.state.isMistakeMode) api.fetchFromGoogleSheet('setLastLearnedIndex', { index }).catch(err => console.error("학습 위치 저장 실패:", err)); this.elements.cardBack.classList.remove('is-slid-up'); const wordData = this.state.currentWordList[index]; if (!wordData) return; this.elements.wordDisplay.innerHTML = `${wordData.word} ${wordData.pronunciation ? `<span class="pronunciation-inline">${wordData.pronunciation}</span>` : ''}`; ui.adjustFontSize(this.elements.wordDisplay); this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>'); ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation); this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation?.trim()); const srcMap = { manual: 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png', ai: 'https://images.icon-icons.com/1055/PNG/128/3-search-cat_icon-icons.com_76679.png', none: 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png' }; this.elements.sampleBtnImg.src = srcMap[wordData.sampleSource] || srcMap.none; },
    navigate(dir) { const len = this.state.currentWordList.length; if (len === 0) return; this.state.currentIndex = (this.state.currentIndex + dir + len) % len; this.displayWord(this.state.currentIndex); },
    async handleFlip() { const isBack = this.elements.cardBack.classList.contains('is-slid-up'); const wordData = this.state.currentWordList[this.state.currentIndex]; if (!isBack) { if (wordData.sampleSource === 'none') { app.showNoSampleMessage(); return; } this.elements.backTitle.textContent = wordData.word; ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent); this.elements.cardBack.classList.add('is-slid-up'); this.elements.sampleBtnImg.src = 'https://images.icon-icons.com/1055/PNG/128/5-remove-cat_icon-icons.com_76681.png'; } else { this.elements.cardBack.classList.remove('is-slid-up'); this.displayWord(this.state.currentIndex); } },
    async startMistakeReview(words) { this.elements.startScreen.classList.add('hidden'); this.elements.loader.classList.remove('hidden'); this.state.isMistakeMode = true; const wordMap = new Map(app.state.wordList.map(w => [w.word, w])); this.state.currentWordList = words.map(w => wordMap.get(w)); this.state.currentIndex = 0; if (this.state.currentWordList.length === 0) { this.showError("오답 노트를 불러올 수 없습니다."); setTimeout(() => app.navigateTo('selection'), 2000); return; } this.launchApp(); },
    isLearningModeActive() { return !document.getElementById('learning-app-container').classList.contains('hidden'); },
    handleMiddleClick(e) { if (this.isLearningModeActive() && e.button === 1) { e.preventDefault(); this.elements.sampleBtn.click(); } },
    handleKeyDown(e) { if (!this.isLearningModeActive() || document.activeElement.tagName.match(/INPUT|TEXTAREA/)) return; const keyMap = { 'ArrowLeft': -1, 'ArrowRight': 1 }; if (keyMap[e.key] !== undefined) { e.preventDefault(); this.navigate(keyMap[e.key]); } else if (e.key === 'Enter') { e.preventDefault(); this.handleFlip(); } else if (e.key === ' ') { e.preventDefault(); if (!this.elements.cardBack.classList.contains('is-slid-up')) api.speak(this.elements.wordDisplay.textContent, 'word'); } },
    handleTouchStart(e) { if (!this.isLearningModeActive() || e.target.closest('#word-display')) return; this.state.touchstartX = e.changedTouches[0].screenX; this.state.touchstartY = e.changedTouches[0].screenY; },
    handleTouchEnd(e) { if (!this.isLearningModeActive() || this.state.touchstartX === 0 || e.target.closest('button, a, input, [onclick], .interactive-word')) { this.state.touchstartX = this.state.touchstartY = 0; return; } const dX = e.changedTouches[0].screenX - this.state.touchstartX, dY = e.changedTouches[0].screenY - this.state.touchstartY; if (Math.abs(dX) > Math.abs(dY) && Math.abs(dX) > 50) this.navigate(dX > 0 ? -1 : 1); else if (Math.abs(dY) > Math.abs(dX) && Math.abs(dY) > 50 && !e.target.closest('#learning-app-container') && dY < 0) this.navigate(1); this.state.touchstartX = this.state.touchstartY = 0; }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

