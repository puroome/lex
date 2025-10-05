// ================================================================
// App Main Controller
// ================================================================
const app = {
    config: {
        TTS_API_KEY: "AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA",
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxtkBmzSHFOOwIOrjkbxXsHAKIBkimjuUjVOWEoUEi0vgxKclHlo4PTGnSTUSF29Ydg/exec"
    },
    state: {
        currentVoiceSet: 'UK',
        isSpeaking: false,
        audioContext: null,
        translationCache: {},
        hideTooltipTimeout: null, // Renamed from tooltipTimeout
        translateDebounceTimeout: null, // For debouncing translation
        wordList: [],
        isWordListReady: false,
    },
    elements: {
        selectionScreen: document.getElementById('selection-screen'),
        homeBtn: document.getElementById('home-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        ttsToggleBtn: document.getElementById('tts-toggle-btn'),
        ttsToggleText: document.getElementById('tts-toggle-text'),
        quizModeContainer: document.getElementById('quiz-mode-container'),
        learningModeContainer: document.getElementById('learning-mode-container'),
        translationTooltip: document.getElementById('translation-tooltip'),
        imeWarning: document.getElementById('ime-warning'),
        noSampleMessage: document.getElementById('no-sample-message'),
        sheetLink: document.getElementById('sheet-link'),
    },
    init() {
        this.bindGlobalEvents();
        api.loadWordList();
        quizMode.init();
        learningMode.init();
    },
    bindGlobalEvents() {
        document.getElementById('select-quiz-btn').addEventListener('click', () => this.changeMode('quiz'));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.changeMode('learning'));
        this.elements.homeBtn.addEventListener('click', () => this.changeMode('selection'));
        this.elements.refreshBtn.addEventListener('click', () => this.forceReload());
        this.elements.ttsToggleBtn.addEventListener('click', this.toggleVoiceSet.bind(this));
        document.body.addEventListener('click', () => {
            if (!this.state.audioContext) {
                this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
    },
    changeMode(mode) {
        // 모든 버튼을 기본적으로 숨김 처리
        this.elements.selectionScreen.classList.add('hidden');
        this.elements.quizModeContainer.classList.add('hidden');
        this.elements.learningModeContainer.classList.add('hidden');
        this.elements.homeBtn.classList.add('hidden');
        this.elements.refreshBtn.classList.add('hidden');
        this.elements.ttsToggleBtn.classList.add('hidden');
        learningMode.elements.fixedButtons.classList.add('hidden');

        if (mode === 'quiz') {
            this.elements.quizModeContainer.classList.remove('hidden');
            this.elements.homeBtn.classList.remove('hidden');
            this.elements.ttsToggleBtn.classList.remove('hidden');
            quizMode.start();
        } else if (mode === 'learning') {
            this.elements.learningModeContainer.classList.remove('hidden');
            this.elements.homeBtn.classList.remove('hidden');
            this.elements.ttsToggleBtn.classList.remove('hidden');
            // 학습 모드 시작 화면에서만 새로고침 버튼 표시
            this.elements.refreshBtn.classList.remove('hidden'); 
            learningMode.resetStartScreen();
        } else { // 'selection' 모드
            this.elements.selectionScreen.classList.remove('hidden');
            quizMode.reset();
            learningMode.reset();
        }
    },
    async forceReload() {
        const isLearningStartScreen = !learningMode.elements.startScreen.classList.contains('hidden');

        if (!isLearningStartScreen) {
            this.showToast('데이터 새로고침은 학습 모드 시작 화면에서만 가능합니다.', true);
            return;
        }
        
        // --- 비활성화할 요소 목록 ---
        const elementsToDisable = [
            learningMode.elements.startWordInput,
            learningMode.elements.startBtn,
            this.elements.homeBtn,
            this.elements.ttsToggleBtn,
            this.elements.refreshBtn,
        ];
        const sheetLink = this.elements.sheetLink;

        // --- 요소 비활성화 및 사용자 피드백 ---
        elementsToDisable.forEach(el => { el.disabled = true; });
        sheetLink.classList.add('pointer-events-none', 'opacity-50');

        const originalBtnText = learningMode.elements.startBtn.textContent;
        learningMode.elements.startBtn.textContent = '새로고침 중...';

        try {
            await api.loadWordList(true); // 캐시 무시하고 강제 새로고침
            this.showToast('데이터를 성공적으로 새로고침했습니다!');
        } catch(e) {
            this.showToast('데이터 새로고침에 실패했습니다: ' + e.message, true);
        } finally {
            // --- 요소 다시 활성화 ---
            elementsToDisable.forEach(el => { el.disabled = false; });
            sheetLink.classList.remove('pointer-events-none', 'opacity-50');
            learningMode.elements.startBtn.textContent = originalBtnText;
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
    }
};

// ================================================================
// API Module
// ================================================================
const api = {
    async loadWordList(force = false) {
        if (force) {
            localStorage.removeItem('wordListCache');
            app.state.isWordListReady = false;
        }

        if (!force) {
            try {
                const cachedData = localStorage.getItem('wordListCache');
                if (cachedData) {
                    const { timestamp, words } = JSON.parse(cachedData);
                    if (Date.now() - timestamp < 86400000) { // 24 hours
                        app.state.wordList = words;
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
            const data = await this.fetchFromGoogleSheet('getWords', { forceRefresh: force });
            if(data.error) throw new Error(data.message);
            app.state.wordList = data.words;
            app.state.isWordListReady = true;
            const cachePayload = { timestamp: Date.now(), words: data.words };
            try {
                localStorage.setItem('wordListCache', JSON.stringify(cachePayload));
            } catch (e) {
                console.error("localStorage 저장 실패:", e);
            }
        } catch (error) {
            console.error("단어 목록 로딩 실패:", error);
            if (!app.state.isWordListReady) {
                app.showFatalError(error.message);
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
        const TTS_URL = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${app.config.TTS_API_KEY}`;
        try {
            const response = await fetch(TTS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: { text: processedText }, voice: voiceConfig, audioConfig: { audioEncoding: 'MP3' } })
            });
            if (!response.ok) throw new Error(`TTS API Error: ${(await response.json()).error.message}`);
            const data = await response.json();
            const byteCharacters = atob(data.audioContent);
            const byteArray = new Uint8Array(byteCharacters.length).map((_, i) => byteCharacters.charCodeAt(i));
            const audioBuffer = await app.state.audioContext.decodeAudioData(byteArray.buffer);
            const source = app.state.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(app.state.audioContext.destination);
            source.start(0);
            source.onended = () => { app.state.isSpeaking = false; };
        } catch (error) {
            console.error('TTS 재생에 실패했습니다:', error);
            app.state.isSpeaking = false;
        }
    },
    async fetchFromGoogleSheet(action, params = {}) {
        const url = new URL(app.config.SCRIPT_URL);
        url.searchParams.append('action', action);
        for (const key in params) {
            if (params[key]) {
                url.searchParams.append(key, params[key]);
            }
        }
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.message);
        return data;
    },
    async translateText(text) {
        if (app.state.translationCache[text]) return app.state.translationCache[text];
        try {
            const data = await this.fetchFromGoogleSheet('translateText', { text });
            if (data.success) {
                app.state.translationCache[text] = data.translatedText;
                return data.translatedText;
            }
            return '번역 실패';
        } catch (error) {
            console.error('Translation fetch error:', error);
            return '번역 오류';
        }
    }
};

// ================================================================
// UI Module
// ================================================================
const ui = {
    adjustFontSize(element) {
        element.style.fontSize = '';
        let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const container = element.parentElement;
        const containerStyle = window.getComputedStyle(container);
        const containerWidth = container.clientWidth - parseFloat(containerStyle.paddingLeft) - parseFloat(containerStyle.paddingRight);
        const minFontSize = 16;
        while (element.scrollWidth > containerWidth && currentFontSize > minFontSize) {
            element.style.fontSize = `${--currentFontSize}px`;
        }
    },
    async copyToClipboard(text) {
        if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(text); } 
            catch (err) { console.error('클립보드 복사 실패:', err); }
        }
    },
    renderInteractiveText(targetElement, text) {
        targetElement.innerHTML = '';
        if (!text || !text.trim()) return;
        const regex = /(\[.*?\])|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g;
        text.split('\n').forEach(line => {
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
                    span.className = 'interactive-word cursor-pointer hover:bg-yellow-200 p-1 rounded-sm transition-colors';
                    span.title = '클릭하여 듣기 및 복사';
                    span.onclick = (e) => { 
                        api.speak(englishPhrase, 'word'); 
                        this.copyToClipboard(englishPhrase);
                        e.currentTarget.classList.add('word-clicked');
                        setTimeout(() => e.currentTarget.classList.remove('word-clicked'), 300);
                    };
                    targetElement.appendChild(span);
                } else if (nonClickable) {
                    targetElement.appendChild(document.createTextNode(nonClickable));
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) {
                targetElement.appendChild(document.createTextNode(line.substring(lastIndex)));
            }
            targetElement.appendChild(document.createElement('br'));
        });
        if (targetElement.lastChild && targetElement.lastChild.tagName === 'BR') {
            targetElement.removeChild(targetElement.lastChild);
        }
    },
    handleSentenceMouseOver(event, sentence) {
        clearTimeout(app.state.translateDebounceTimeout);
        
        app.state.translateDebounceTimeout = setTimeout(async () => {
            const tooltip = app.elements.translationTooltip;
            const targetElement = event.currentTarget;
            const rect = targetElement.getBoundingClientRect();
            const tooltipLeft = rect.left + window.scrollX;
            const tooltipTop = rect.bottom + window.scrollY + 5;

            Object.assign(tooltip.style, {
                left: `${tooltipLeft}px`,
                top: `${tooltipTop}px`,
                transform: 'none' 
            });

            tooltip.textContent = '번역 중...';
            tooltip.classList.remove('hidden');
            
            const translatedText = await api.translateText(sentence);
            tooltip.textContent = translatedText;
        }, 1000); // 1초 디바운스
    },
    handleSentenceMouseOut() {
        clearTimeout(app.state.translateDebounceTimeout);
        app.elements.translationTooltip.classList.add('hidden');
    },
    displaySentences(sentences, containerElement) {
        containerElement.innerHTML = '';
        sentences.filter(s => s.trim()).forEach(sentence => {
            const p = document.createElement('p');
            p.innerHTML = sentence.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
            p.className = 'p-2 rounded transition-colors cursor-pointer hover:bg-gray-200 sample-sentence';
            p.onclick = () => api.speak(p.textContent, 'sample');
            p.addEventListener('mouseover', (e) => this.handleSentenceMouseOver(e, p.textContent));
            p.addEventListener('mouseout', this.handleSentenceMouseOut);
            containerElement.appendChild(p);
        });
    }
};

// ================================================================
// Utility Module
// ================================================================
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
    }
};

// ================================================================
// Quiz Mode Module
// ================================================================
const quizMode = {
    state: {
        currentQuiz: {},
        quizBatch: [],
        isFetching: false,
        isFinished: false,
        flippedContentType: null
    },
    elements: {},
    init() {
        this.elements = {
            loader: document.getElementById('quiz-loader'),
            loaderText: document.getElementById('quiz-loader-text'),
            contentContainer: document.getElementById('quiz-content-container'),
            cardFront: document.getElementById('quiz-card-front'),
            cardBack: document.getElementById('quiz-card-back'),
            word: document.getElementById('quiz-word'),
            pronunciation: document.getElementById('quiz-pronunciation'),
            choices: document.getElementById('quiz-choices'),
            backTitle: document.getElementById('quiz-back-title'),
            backContent: document.getElementById('quiz-back-content'),
            passBtn: document.getElementById('quiz-pass-btn'),
            sampleBtn: document.getElementById('quiz-sample-btn'),
            explanationBtn: document.getElementById('quiz-explanation-btn'),
            finishedScreen: document.getElementById('quiz-finished-screen'),
            finishedMessage: document.getElementById('quiz-finished-message')
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.passBtn.addEventListener('click', () => this.displayNextQuiz());
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip('sample'));
        this.elements.explanationBtn.addEventListener('click', () => this.handleFlip('explanation'));
        this.elements.word.addEventListener('click', (e) => {
            const word = this.elements.word.textContent;
            api.speak(word, 'word');
            ui.copyToClipboard(word);
            e.currentTarget.classList.add('word-clicked');
            setTimeout(() => e.currentTarget.classList.remove('word-clicked'), 300);
        });
        document.addEventListener('keydown', (e) => {
            const isQuizModeActive = !this.elements.contentContainer.classList.contains('hidden') && !this.elements.choices.classList.contains('disabled');
            if (!isQuizModeActive) return;
            const choiceIndex = parseInt(e.key) - 1;
            if (choiceIndex >= 0 && choiceIndex < 5 && this.elements.choices.children[choiceIndex]) {
                e.preventDefault();
                this.elements.choices.children[choiceIndex].click();
            }
        });
    },
    async start() {
        this.reset();
        if (!app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
            await this.waitForWordList();
        }
        await this.fetchQuizBatch();
        this.displayNextQuiz();
    },
    async waitForWordList() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if(app.state.isWordListReady) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    },
    reset() {
        this.state.quizBatch = [];
        this.state.isFetching = false;
        this.state.isFinished = false;
        this.showLoader(true);
        this.elements.loader.querySelector('.loader').style.display = 'block';
        this.elements.loaderText.textContent = "퀴즈 데이터를 불러오는 중...";
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.add('hidden');
    },
    async fetchQuizBatch() {
        if (this.state.isFetching || this.state.isFinished) return;
        this.state.isFetching = true;
        try {
            const data = await api.fetchFromGoogleSheet('getQuiz');
            if (data.finished) {
                this.state.isFinished = true;
                if (this.state.quizBatch.length === 0) {
                    this.showFinishedScreen(data.message || "모든 단어 학습을 완료했습니다!");
                }
                return;
            }
            this.state.quizBatch.push(...data.quizzes);
        } catch (error) {
            console.error("퀴즈 묶음 가져오기 실패:", error);
            this.showError(error.message);
        } finally {
            this.state.isFetching = false;
        }
    },
    showError(message) {
        this.elements.loader.querySelector('.loader').style.display = 'none';
        this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">퀴즈를 가져올 수 없습니다.</p><p class="text-sm text-gray-600 mt-2 break-all">${message}</p>`;
    },
    displayNextQuiz() {
        if (!this.state.isFetching && this.state.quizBatch.length <= 3) {
            this.fetchQuizBatch();
        }
        if (this.state.quizBatch.length === 0) {
            if(this.state.isFetching) {
                this.elements.loaderText.textContent = "다음 퀴즈를 준비 중입니다...";
                this.showLoader(true);
                const checker = setInterval(() => {
                    if(this.state.quizBatch.length > 0) {
                        clearInterval(checker);
                        this.displayNextQuiz();
                    }
                }, 100)
            } 
            else if (this.state.isFinished) {
                this.showFinishedScreen("모든 단어 학습을 완료했습니다!");
            }
            return;
        }
        const nextQuiz = this.state.quizBatch.shift();
        this.state.currentQuiz = nextQuiz;
        this.showLoader(false);
        this.renderQuiz(nextQuiz.question, nextQuiz.choices);
    },
    renderQuiz(question, choices) {
        this.elements.cardFront.classList.remove('hidden');
        this.elements.cardBack.classList.add('hidden');
        this.state.flippedContentType = null;
        this.elements.word.textContent = question.word;
        ui.adjustFontSize(this.elements.word);
        this.elements.pronunciation.textContent = question.pronunciation || '';
        this.elements.choices.innerHTML = '';
        choices.forEach((choice, index) => {
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer flex items-start transition-all';
            li.innerHTML = `<span class="font-bold mr-3">${index + 1}.</span> <span>${choice}</span>`;
            li.onclick = () => this.checkAnswer(li, choice);
            this.elements.choices.appendChild(li);
        });
        this.elements.choices.classList.remove('disabled');
        this.elements.passBtn.style.display = 'block';
        this.elements.passBtn.disabled = false;
        const hasSample = question.sample && question.sample.trim() !== '';
        this.elements.sampleBtn.textContent = '예문';
        this.elements.sampleBtn.classList.toggle('bg-purple-500', hasSample);
        this.elements.sampleBtn.classList.toggle('hover:bg-purple-600', hasSample);
        this.elements.sampleBtn.classList.toggle('bg-gray-400', !hasSample);
        this.elements.sampleBtn.classList.toggle('cursor-not-allowed', !hasSample);
        this.elements.sampleBtn.style.display = 'block';
        this.elements.explanationBtn.textContent = '보충자료';
        this.elements.explanationBtn.style.display = (question.explanation && question.explanation.trim()) ? 'block' : 'none';
    },
    checkAnswer(selectedLi, selectedChoice) {
        this.elements.choices.classList.add('disabled');
        this.elements.passBtn.disabled = true;
        
        // Show submitting state
        selectedLi.classList.add('submitting');

        const isCorrect = selectedChoice === this.state.currentQuiz.answer;
        
        setTimeout(() => {
            selectedLi.classList.remove('submitting');
            selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');
            
            if (isCorrect) {
                api.fetchFromGoogleSheet('updateStatus', { word: this.state.currentQuiz.question.word });
            } else {
                const correctAnswerEl = Array.from(this.elements.choices.children).find(li => li.querySelector('span:last-child').textContent === this.state.currentQuiz.answer);
                correctAnswerEl?.classList.add('correct');
            }
            setTimeout(() => this.displayNextQuiz(), 1200); // Slightly adjusted timing
        }, 300); // Short delay to show submitting state
    },
    showLoader(isLoading) {
        this.elements.loader.classList.toggle('hidden', !isLoading);
        this.elements.contentContainer.classList.toggle('hidden', isLoading);
        this.elements.finishedScreen.classList.add('hidden');
    },
    showFinishedScreen(message) {
        this.showLoader(false);
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.remove('hidden');
        this.elements.finishedMessage.textContent = message;
    },
    async handleFlip(type) {
        const question = this.state.currentQuiz.question;
        if (type === 'sample' && (!question.sample || !question.sample.trim())) {
            app.showNoSampleMessage();
            return;
        }

        const isFrontVisible = !this.elements.cardFront.classList.contains('hidden');
        this.elements.explanationBtn.textContent = '보충자료';
        this.elements.sampleBtn.textContent = '예문';

        if (isFrontVisible) {
            const frontHeight = this.elements.cardFront.offsetHeight;
            this.elements.cardBack.style.minHeight = `${frontHeight}px`;
            this.updateBackContent(type);
            this.elements.cardFront.classList.add('hidden');
            this.elements.cardBack.classList.remove('hidden');
            this.state.flippedContentType = type;
            (type === 'sample' ? this.elements.sampleBtn : this.elements.explanationBtn).textContent = 'BACK';
        } else {
            if (this.state.flippedContentType === type) {
                this.elements.cardFront.classList.remove('hidden');
                this.elements.cardBack.classList.add('hidden');
                this.elements.cardBack.style.minHeight = '';
                this.state.flippedContentType = null;
            } else {
                this.updateBackContent(type);
                this.state.flippedContentType = type;
                (type === 'sample' ? this.elements.sampleBtn : this.elements.explanationBtn).textContent = 'BACK';
            }
        }
    },
    updateBackContent(type) {
        const { word, sample, explanation } = this.state.currentQuiz.question;
        this.elements.backTitle.textContent = word;
        this.elements.backContent.innerHTML = '';
        if (type === 'sample') {
            ui.displaySentences(sample.split('\n'), this.elements.backContent);
        } else {
            ui.renderInteractiveText(this.elements.backContent, explanation);
        }
    }
};

// ================================================================
// Learning Mode Module
// ================================================================
const learningMode = {
    state: {
        currentIndex: 0,
        touchstartX: 0,
        touchstartY: 0,
        lastWheelTime: 0,
    },
    elements: {},
    init() {
        this.elements = {
            startScreen: document.getElementById('learning-start-screen'),
            startInputContainer: document.getElementById('learning-start-input-container'),
            startWordInput: document.getElementById('learning-start-word-input'),
            startBtn: document.getElementById('learning-start-btn'),
            suggestionsContainer: document.getElementById('learning-suggestions-container'),
            suggestionsList: document.getElementById('learning-suggestions-list'),
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
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.startWordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.start(); });
        this.elements.startWordInput.addEventListener('input', (e) => {
            const originalValue = e.target.value;
            const sanitizedValue = originalValue.replace(/[^a-zA-Z\s'-]/g, '');
            if (originalValue !== sanitizedValue) app.showImeWarning();
            e.target.value = sanitizedValue;
        });
        this.elements.backToStartBtn.addEventListener('click', () => this.resetStartScreen());
        this.elements.nextBtn.addEventListener('click', () => this.navigate(1));
        this.elements.prevBtn.addEventListener('click', () => this.navigate(-1));
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip());
        this.elements.wordDisplay.addEventListener('click', (e) => {
            const word = app.state.wordList[this.state.currentIndex]?.word;
            if (word) {
                api.speak(word, 'word');
                ui.copyToClipboard(word);
                e.currentTarget.classList.add('word-clicked');
                setTimeout(() => e.currentTarget.classList.remove('word-clicked'), 300);
            }
        });
        document.addEventListener('mousedown', this.handleMiddleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    },
    async start() {
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        if (!app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
            await this.waitForWordList();
        }
        const startWord = this.elements.startWordInput.value.trim();
        const wordList = app.state.wordList;
        if (wordList.length === 0) {
            this.showError("학습할 단어가 없습니다.");
            return;
        }
        let startIndex = 0;
        if (startWord) {
            const lowerCaseStartWord = startWord.toLowerCase();
            const exactMatchIndex = wordList.findIndex(item => item.word.toLowerCase() === lowerCaseStartWord);
            if (exactMatchIndex !== -1) {
                startIndex = exactMatchIndex;
            } else {
                const suggestions = wordList.map((item, index) => ({
                    word: item.word,
                    index,
                    distance: utils.levenshteinDistance(lowerCaseStartWord, item.word.toLowerCase())
                })).sort((a, b) => a.distance - b.distance).slice(0, 5);
                this.elements.loader.classList.add('hidden');
                this.elements.startScreen.classList.remove('hidden');
                this.displaySuggestions(suggestions);
                return;
            }
        }
        this.state.currentIndex = startIndex;
        this.launchApp();
    },
    async waitForWordList() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if(app.state.isWordListReady) {
                    clearInterval(interval);
                    resolve();
                }
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
        // 학습 앱이 시작되면 새로고침 버튼을 숨김
        app.elements.refreshBtn.classList.add('hidden');
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
    displaySuggestions(suggestions) {
        this.elements.startInputContainer.classList.add('hidden');
        this.elements.suggestionsList.innerHTML = '';
        suggestions.forEach(({ word, index }) => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left bg-gray-100 hover:bg-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors';
            btn.textContent = word;
            btn.onclick = () => {
                this.state.currentIndex = index;
                this.launchApp();
            };
            this.elements.suggestionsList.appendChild(btn);
        });
        this.elements.suggestionsContainer.classList.remove('hidden');
    },
    displayWord(index) {
        this.elements.cardBack.classList.remove('is-slid-up');
        const wordData = app.state.wordList[index];
        if (!wordData) return;
        
        const wordText = wordData.word;
        const pronText = wordData.pronunciation ? `<span class="pronunciation-inline">${wordData.pronunciation}</span>` : '';
        this.elements.wordDisplay.innerHTML = `${wordText} ${pronText}`;
        
        ui.adjustFontSize(this.elements.wordDisplay);
        
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>');
        ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation);
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim());
        
        switch(wordData.sampleSource) {
            case 'manual':
                this.elements.sampleBtnImg.src = 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png';
                break;
            case 'ai':
                this.elements.sampleBtnImg.src = 'https://images.icon-icons.com/1055/PNG/128/3-search-cat_icon-icons.com_76679.png';
                break;
            case 'none':
            default:
                this.elements.sampleBtnImg.src = 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png';
                break;
        }
    },
    navigate(direction) {
        const len = app.state.wordList.length;
        if (len === 0) return;
        this.state.currentIndex = (this.state.currentIndex + direction + len) % len;
        this.displayWord(this.state.currentIndex);
    },
    async handleFlip() {
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = app.state.wordList[this.state.currentIndex];

        if (!isBackVisible) {
            if (wordData.sampleSource === 'none') {
                app.showNoSampleMessage();
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
    isLearningModeActive() {
        return !this.elements.appContainer.classList.contains('hidden');
    },
    handleMiddleClick(e) {
        if (this.isLearningModeActive() && e.button === 1) {
            e.preventDefault();
            this.elements.sampleBtn.click();
        }
    },
    handleKeyDown(e) {
        if (!this.isLearningModeActive() || document.activeElement.tagName.match(/INPUT|TEXTAREA/)) return;
        const keyMap = { 'ArrowLeft': -1, 'ArrowRight': 1 };
        if (keyMap[e.key] !== undefined) {
            e.preventDefault();
            this.navigate(keyMap[e.key]);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.handleFlip();
        } else if (e.key === ' ') {
            e.preventDefault();
            if (!this.elements.cardBack.classList.contains('is-slid-up')) {
                api.speak(this.elements.wordDisplay.textContent, 'word');
            }
        }
    },
    handleTouchStart(e) {
        if (!this.isLearningModeActive()) return;
        this.state.touchstartX = e.changedTouches[0].screenX;
        this.state.touchstartY = e.changedTouches[0].screenY;
    },
    handleTouchEnd(e) {
        if (!this.isLearningModeActive() || this.state.touchstartX === 0) return;
        if (e.target.closest('button, a, input, [onclick]')) {
             this.state.touchstartX = this.state.touchstartY = 0;
             return;
        }
        const deltaX = e.changedTouches[0].screenX - this.state.touchstartX;
        const deltaY = e.changedTouches[0].screenY - this.state.touchstartY;
        
        // 수평 스와이프 (좌/우) 로 이전/다음 단어 이동
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            this.navigate(deltaX > 0 ? -1 : 1);
        } 
        // 수직 스와이프 (위) 이고, 앱 화면 바깥쪽일 경우 다음 단어로 이동
        else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
            if (!e.target.closest('#learning-app-container')) {
                if (deltaY < 0) { // 위로 스와이프
                    this.navigate(1); // 다음 단어로 이동
                }
            }
        }
        this.state.touchstartX = this.state.touchstartY = 0;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
