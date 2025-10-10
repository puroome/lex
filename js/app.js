import { api } from './api.js';
import { ui } from './ui.js';
import { learningMode } from './learning-mode.js';
import { quizMode } from './quiz-mode.js';
import { dashboard } from './dashboard.js';
import { cache } from './cache.js';

const app = {
    state: {
        currentVoiceSet: 'UK',
        isSpeaking: false,
        audioContext: null,
        translateDebounceTimeout: null,
        wordList: [],
        isWordListReady: false,
        longPressTimer: null,
    },
    elements: {
        selectionScreen: document.getElementById('selection-screen'),
        homeBtn: document.getElementById('home-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        clearCacheBtn: document.getElementById('clear-cache-btn'), // 캐시 삭제 버튼 추가
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
    async init() {
        try {
            await cache.init();
        } catch (e) {
            console.error("캐시를 초기화할 수 없습니다.", e);
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
            dashboard.showLoading();
            try {
                await api.loadWordList(true); // Always get fresh data for dashboard
                dashboard.render();
            } catch (e) {
                 dashboard.showError(`통계 데이터를 불러오는데 실패했습니다: ${e.message}`);
            }
        });

        this.elements.selectMistakesBtn.addEventListener('click', async () => {
            this.showToast('오답 노트를 불러오는 중...');
            try {
                await api.loadWordList(true);
                const mistakeWords = this.state.wordList
                    .filter(word => word.incorrect === 1)
                    .sort((a, b) => {
                        const dateA = a.lastIncorrect ? new Date(a.lastIncorrect) : new Date(0);
                        const dateB = b.lastIncorrect ? new Date(b.lastIncorrect) : new Date(0);
                        return dateB - dateA;
                    })
                    .map(wordObj => wordObj.word);

                if (mistakeWords.length === 0) {
                    this.showToast('오답 노트에 단어가 없습니다.', true);
                    return;
                }
                this.navigateTo('mistakeReview', { mistakeWords });
            } catch (e) {
                this.showToast(`오답 노트 로딩 실패: ${e.message}`, true);
            }
        });

        this.elements.homeBtn.addEventListener('click', () => this.navigateTo('selection'));
        
        this.elements.refreshBtn.addEventListener('click', () => {
            ui.showConfirmModal(
                '데이터 새로고침',
                'Sheet에서 자료를 다시 불러옵니다.<br>계속하시겠습니까?',
                () => this.forceReload()
            );
        });

        this.elements.clearCacheBtn.addEventListener('click', () => {
            ui.showConfirmModal(
                '캐시 삭제',
                '저장된 발음 및 번역 데이터를 삭제합니다.<br>계속하시겠습니까?',
                async () => {
                    try {
                        await cache.clearAll();
                        this.showToast('모든 캐시 데이터가 삭제되었습니다.');
                    } catch (error) {
                        this.showToast('캐시 삭제에 실패했습니다.', true);
                        console.error('Failed to clear caches:', error);
                    }
                }
            );
        });

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
        if (history.state?.mode === mode && mode !== 'learning') return;

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
        this.elements.ttsToggleBtn.classList.add('hidden');
        learningMode.elements.fixedButtons.classList.add('hidden');

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
            learningMode.elements.appContainer.classList.add('hidden');
            learningMode.elements.loader.classList.add('hidden');
            learningMode.elements.startScreen.classList.remove('hidden');
            if (options.suggestions && options.title) {
                learningMode.displaySuggestions(options.suggestions.vocab, options.suggestions.explanation, options.title);
            } else {
                learningMode.resetStartScreen();
            }
        } else if (mode === 'dashboard') {
            this.elements.homeBtn.classList.remove('hidden');
            this.elements.dashboardContainer.classList.remove('hidden');
        } else if (mode === 'mistakeReview') {
            const mistakeWords = options.mistakeWords;
            if (!mistakeWords || mistakeWords.length === 0) {
                this.showToast('오답 노트에 단어가 없습니다.', true);
                this.navigateTo('selection');
                return;
            }
            showCommonButtons();
            this.elements.learningModeContainer.classList.remove('hidden');
            learningMode.startMistakeReview(mistakeWords);
        } else { // 'selection' 모드
            this.elements.selectionScreen.classList.remove('hidden');
            quizMode.reset();
            learningMode.reset();
        }
    },
    async forceReload() {
        const isSelectionScreen = !this.elements.selectionScreen.classList.contains('hidden');
        if (!isSelectionScreen) {
            this.showToast('새로고침은 모드 선택 화면에서만 가능합니다.', true);
            return;
        }
        
        const elementsToDisable = [
            this.elements.refreshBtn,
            this.elements.clearCacheBtn,
            this.elements.selectDashboardBtn,
            this.elements.selectMistakesBtn,
        ];
        const elementsToStyle = [
             this.elements.sheetLink,
             this.elements.selectLearningBtn,
             this.elements.selectQuizBtn,
        ];

        elementsToDisable.forEach(el => { if(el) el.disabled = true; });
        elementsToStyle.forEach(el => { if(el) el.classList.add('pointer-events-none', 'opacity-50'); });
        
        const refreshIcon = this.elements.refreshBtn.querySelector('svg');
        if (refreshIcon) refreshIcon.classList.add('animate-spin');

        try {
            await api.loadWordList(true);
            this.showToast('데이터를 성공적으로 새로고침했습니다!');
        } catch(e) {
            this.showToast('데이터 새로고침에 실패했습니다: ' + e.message, true);
        } finally {
            elementsToDisable.forEach(el => { if(el) el.disabled = false; });
            elementsToStyle.forEach(el => { if(el) el.classList.remove('pointer-events-none', 'opacity-50'); });
            if (refreshIcon) refreshIcon.classList.remove('animate-spin');
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
        selectionDiv.innerHTML = `<div class="p-8 text-center"><h1 class="text-3xl font-bold text-red-600 mb-4">앱 시작 실패</h1><p class="text-gray-700 mb-6">데이터를 불러오는 중 문제가 발생했습니다. <br>네트워크 연결을 확인하고 잠시 후 페이지를 새로고침 해주세요.</p><div class="bg-red-50 text-red-700 p-4 rounded-lg text-left text-sm break-all"><p class="font-semibold">오류 정보:</p><p>${message}</p></div></div>`;
        selectionDiv.classList.remove('hidden');
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
        const wordList = this.state.wordList;
        const lowerCaseWord = word.toLowerCase();
        const exactMatchIndex = wordList.findIndex(item => item.word.toLowerCase() === lowerCaseWord);
        if (exactMatchIndex !== -1) {
            this.navigateTo('learning');
            setTimeout(() => {
                learningMode.state.isMistakeMode = false;
                learningMode.state.currentWordList = this.state.wordList;
                learningMode.state.currentIndex = exactMatchIndex;
                learningMode.launchApp();
            }, 50);
            ui.hideWordContextMenu();
            return;
        }
        
        app.navigateTo('learning');
        setTimeout(() => learningMode.startSearch(word), 50);
        ui.hideWordContextMenu();
    },
};

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = app;
    app.init();
});

