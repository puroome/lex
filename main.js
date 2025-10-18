// ================================================================
// App Main Controller
// ================================================================
import { api } from './api.js';
import { ui } from './ui.js';
import { quizMode } from './quiz.js';
import { learningMode } from './learning.js';
import { dashboard } from './dashboard.js';

// 전역 변수 선언
let firebaseApp, database, auth;
let initializeApp, getDatabase, ref, get, update, set;
let getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup;

export const app = {
    config: {
        TTS_API_KEY: "AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA",
        DEFINITION_API_KEY: "02d1892d-8fb1-4e2d-bc43-4ddd4a47eab3",
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzyBM33LzFsAe-mES_0Qw5B8w0ZPyYTDm4K_nLif5y2bXMpiQbD1LX5TTIDA4qX_Rnp/exec",
        ALLOWED_USER_EMAIL: "puroome@gmail.com",
    },
    state: {
        isAppStarted: false,
        currentVoiceSet: 'UK',
        isSpeaking: false,
        audioContext: null,
        wordList: [],
        isWordListReady: false,
        longPressTimer: null,
        translationTimer: null,
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
        selectLearningBtn: document.getElementById('select-learning-btn'),
        selectQuizBtn: document.getElementById('select-quiz-btn'),
        selectDashboardBtn: document.getElementById('select-dashboard-btn'),
        selectMistakesBtn: document.getElementById('select-mistakes-btn'),
        progressBarContainer: document.getElementById('progress-bar-container'),
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
                this.elements.loginScreen.classList.add('hidden');
                this.elements.appWrapper.classList.remove('hidden');
                if (!this.state.isAppStarted) {
                    this.startApp();
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
            await api.audioCache.init();
            await api.translationCache.init();
        } catch (e) {
            console.error("오디오 또는 번역 캐시를 초기화할 수 없습니다.", e);
        }
        this.bindGlobalEvents();
        api.loadWordList();
        quizMode.init(this);
        learningMode.init(this);
        dashboard.init(this);

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
            if (!ui.elements.wordContextMenu.contains(e.target)) {
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
            this.elements.learningModeContainer.querySelector('#learning-start-screen').classList.remove('hidden');
            learningMode.resetStartScreen();
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
    searchWordInLearningMode(word) {
        if (!word) return;
        const wordList = this.state.wordList;
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
        const explanationMatches = wordList
            .map((item, index) => ({ word: item.word, index }))
            .filter((_, index) => {
                if (!wordList[index].explanation) return false;
                const cleanedExplanation = wordList[index].explanation.replace(/\[.*?\]/g, '');
                return searchRegex.test(cleanedExplanation);
            });

        const levenshteinSuggestions = wordList.map((item, index) => ({
            word: item.word,
            index,
            distance: ui.utils.levenshteinDistance(lowerCaseWord, item.word.toLowerCase())
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);

        if (explanationMatches.length > 0 || levenshteinSuggestions.length > 0) {
            const title = `'<strong>${word}</strong>' 관련 단어를 찾았습니다.`;
            this.navigateTo('learning', { 
                suggestions: {
                    vocab: levenshteinSuggestions,
                    explanation: explanationMatches
                }, 
                title: title 
            });
            ui.hideWordContextMenu();
            return;
        }
        
        const title = `입력하신 단어를 찾을 수 없습니다.<br>혹시 이 단어를 찾으시나요?`;
        this.navigateTo('learning', { suggestions: { vocab: [], explanation: [] }, title: title });
        ui.hideWordContextMenu();
    },
};

// Firebase SDK 로드 후 앱 초기화
document.addEventListener('firebaseSDKLoaded', () => {
    ({ 
        initializeApp, getDatabase, ref, get, update, set, 
        getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup
    } = window.firebaseSDK);
    app.init();
});
