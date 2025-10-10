import { api } from './api.js';
import { ui } from './ui.js';
import { utils } from './utils.js';

export const learningMode = {
    state: {
        app: null,
        currentIndex: 0,
        touchstartX: 0,
        touchstartY: 0,
        isMistakeMode: false,
        currentWordList: [],
    },
    elements: {},
    init(app) {
        this.state.app = app;
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
            backContent: document.getElementById('learning-back-content')
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.startSearch());
        this.elements.startWordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startSearch(); });
        this.elements.startWordInput.addEventListener('input', (e) => {
            const originalValue = e.target.value;
            const sanitizedValue = originalValue.replace(/[^a-zA-Z\s'-]/g, '');
            if (originalValue !== sanitizedValue) this.state.app.showImeWarning();
            e.target.value = sanitizedValue;
        });
        this.elements.backToStartBtn.addEventListener('click', () => this.resetStartScreen());
        this.elements.nextBtn.addEventListener('click', () => this.navigate(1));
        this.elements.prevBtn.addEventListener('click', () => this.navigate(-1));
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip());

        this.elements.wordDisplay.addEventListener('click', () => {
            const word = this.state.currentWordList[this.state.currentIndex]?.word;
            if (word) {
                api.speak(word, 'word');
                ui.copyToClipboard(word);
            }
        });

        this.elements.wordDisplay.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const wordData = this.state.currentWordList[this.state.currentIndex];
            if (wordData) {
                ui.showWordContextMenu(e, wordData.word, { hideAppSearch: true });
            }
        });

        let wordDisplayTouchMove = false;
        this.elements.wordDisplay.addEventListener('touchstart', (e) => {
            wordDisplayTouchMove = false;
            clearTimeout(this.state.app.state.longPressTimer);
            this.state.app.state.longPressTimer = setTimeout(() => {
                const wordData = this.state.currentWordList[this.state.currentIndex];
                if (!wordDisplayTouchMove && wordData) {
                    ui.showWordContextMenu(e, wordData.word, { hideAppSearch: true });
                }
            }, 700);
        }, { passive: true });
        this.elements.wordDisplay.addEventListener('touchmove', () => { wordDisplayTouchMove = true; clearTimeout(this.state.app.state.longPressTimer); });
        this.elements.wordDisplay.addEventListener('touchend', () => { clearTimeout(this.state.app.state.longPressTimer); });

        document.addEventListener('mousedown', this.handleMiddleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    },
    async startSearch(startWord = null) {
        this.state.isMistakeMode = false;
        this.state.currentWordList = this.state.app.state.wordList;

        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        if (!this.state.app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
            await this.waitForWordList();
        }
        
        startWord = startWord !== null ? startWord : this.elements.startWordInput.value.trim();
        const wordList = this.state.currentWordList;
        if (wordList.length === 0) {
            this.showError("학습할 단어가 없습니다.");
            return;
        }

        if (!startWord) {
            this.elements.loaderText.textContent = "마지막 학습 위치를 불러오는 중...";
            try {
                const data = await api.fetchFromGoogleSheet('getLastLearnedIndex');
                this.state.currentIndex = (data.index >= 0 && data.index < wordList.length) ? data.index : 0;
                this.launchApp();
            } catch (e) {
                console.error("마지막 학습 위치 로딩 실패:", e);
                this.state.app.showToast("마지막 학습 위치를 불러오는데 실패했습니다. 처음부터 시작합니다.", true);
                this.state.currentIndex = 0;
                this.launchApp();
            }
            return;
        }
    
        const lowerCaseStartWord = startWord.toLowerCase();
    
        const exactMatchIndex = wordList.findIndex(item => item.word.toLowerCase() === lowerCaseStartWord);
        if (exactMatchIndex !== -1) {
            this.state.currentIndex = exactMatchIndex;
            this.launchApp();
            return;
        }
    
        const searchRegex = new RegExp(`\\b${lowerCaseStartWord}\\b`, 'i');
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
            distance: utils.levenshteinDistance(lowerCaseStartWord, item.word.toLowerCase())
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .filter(s => s.distance < s.word.length / 2 + 1);
    
        if (levenshteinSuggestions.length > 0 || explanationMatches.length > 0) {
            this.displaySuggestions(levenshteinSuggestions, explanationMatches, `<strong>'${startWord}'</strong> 관련 단어를 찾았습니다.`);
        } else {
            this.displaySuggestions([], [], `<strong>'${startWord}'</strong>에 대한 검색 결과가 없습니다.`);
        }
    },
    async waitForWordList() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if(this.state.app.state.isWordListReady) { clearInterval(interval); resolve(); }
            }, 100);
        });
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
        this.displayWord(this.state.currentIndex);
    },
    reset() {
        this.elements.startScreen.classList.remove('hidden');
        this.elements.appContainer.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.fixedButtons.classList.add('hidden');
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
        if (!this.state.isMistakeMode) {
            api.fetchFromGoogleSheet('setLastLearnedIndex', { index: index })
               .catch(err => console.error("백그라운드 학습 위치 저장 실패:", err));
        }

        this.elements.cardBack.classList.remove('is-slid-up');
        const wordData = this.state.currentWordList[index];
        if (!wordData) return;
        
        const pronText = wordData.pronunciation ? `<span class="pronunciation-inline">${wordData.pronunciation}</span>` : '';
        this.elements.wordDisplay.innerHTML = `${wordData.word} ${pronText}`;
        ui.adjustFontSize(this.elements.wordDisplay);
        
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>');
        ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation);
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim());
        
        this.elements.sampleBtnImg.src = {
            'manual': 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png',
            'ai': 'https://images.icon-icons.com/1055/PNG/128/3-search-cat_icon-icons.com_76679.png',
            'none': 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png'
        }[wordData.sampleSource] || 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png';
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
            if (wordData.sampleSource === 'none') {
                this.state.app.showNoSampleMessage();
                return;
            }
            this.elements.backTitle.textContent = wordData.word;
            ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent);
            this.elements.cardBack.classList.add('is-slid-up');
            this.elements.sampleBtnImg.src = 'https://images.icon-icons.com/1055/PNG/128/5-remove-cat_icon-icons.com_76681.png';
        } else {
            this.elements.cardBack.classList.remove('is-slid-up');
            this.displayWord(this.state.currentIndex);
        }
    },
    async startMistakeReview(mistakeWords) {
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        this.state.isMistakeMode = true;
        const wordMap = new Map(this.state.app.state.wordList.map(wordObj => [wordObj.word, wordObj]));
        this.state.currentWordList = mistakeWords.map(word => wordMap.get(word)).filter(Boolean);
        this.state.currentIndex = 0;
        
        if (this.state.currentWordList.length === 0) {
            this.showError("오답 노트를 불러올 수 없습니다.");
            setTimeout(() => this.state.app.navigateTo('selection'), 2000);
            return;
        }
        this.launchApp();
    },
    isLearningModeActive() {
        return !this.elements.appContainer.classList.contains('hidden');
    },
    handleMiddleClick(e) { if (this.isLearningModeActive() && e.button === 1) { e.preventDefault(); this.elements.sampleBtn.click(); } },
    handleKeyDown(e) {
        if (!this.isLearningModeActive() || document.activeElement.tagName.match(/INPUT|TEXTAREA/)) return;
        if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); this.navigate(e.key === 'ArrowLeft' ? -1 : 1); } 
        else if (e.key === 'Enter') { e.preventDefault(); this.handleFlip(); } 
        else if (e.key === ' ') {
            e.preventDefault();
            if (!this.elements.cardBack.classList.contains('is-slid-up')) {
                api.speak(this.state.currentWordList[this.state.currentIndex]?.word, 'word');
            }
        }
    },
    handleTouchStart(e) {
        if (!this.isLearningModeActive() || e.target.closest('#word-display')) return;
        this.state.touchstartX = e.changedTouches[0].screenX;
        this.state.touchstartY = e.changedTouches[0].screenY;
    },
    handleTouchEnd(e) {
        if (!this.isLearningModeActive() || this.state.touchstartX === 0 || e.target.closest('button, a, input, [onclick], .interactive-word')) {
             this.state.touchstartX = this.state.touchstartY = 0;
             return;
        }
        const deltaX = e.changedTouches[0].screenX - this.state.touchstartX;
        const deltaY = e.changedTouches[0].screenY - this.state.touchstartY;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) this.navigate(deltaX > 0 ? -1 : 1); 
        else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50 && !e.target.closest('#learning-app-container')) {
            if (deltaY < 0) this.navigate(1);
        }
        this.state.touchstartX = this.state.touchstartY = 0;
    }
};
