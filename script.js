// ================================================================
// App Main Controller
// 앱의 전반적인 상태와 초기화를 관리합니다.
// ================================================================
const app = {
    // 설정 및 상수
    config: {
        // [보안 경고!] API 키는 클라이언트 측 코드에 절대 노출하면 안 됩니다.
        // 이 키들은 Google Apps Script와 같은 서버 측으로 옮겨야 합니다.
        // 여기서는 예시로 남겨두지만, 실제 배포 시에는 반드시 제거하고 서버를 통해 요청하세요.
        TTS_API_KEY: "AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA",
        GEMINI_API_KEY: "AIzaSyDIt_o6s4AzF-yit1cfNnqfbudukelrkwk",
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxtkBmzSHFOOwIOrjkbxXsHAKIBkimjuUjVOWEoUEi0vgxKclHlo4PTGnSTUSF29Ydg/exec"
    },
    // 앱 상태
    state: {
        currentVoiceSet: 'UK',
        isSpeaking: false,
        audioContext: null,
        translationCache: {},
        tooltipTimeout: null
    },
    // DOM 요소 캐싱
    elements: {
        selectionScreen: document.getElementById('selection-screen'),
        homeBtn: document.getElementById('home-btn'),
        ttsToggleBtn: document.getElementById('tts-toggle-btn'),
        ttsToggleText: document.getElementById('tts-toggle-text'),
        quizModeContainer: document.getElementById('quiz-mode-container'),
        learningModeContainer: document.getElementById('learning-mode-container'),
        translationTooltip: document.getElementById('translation-tooltip'),
        aiIndicator: document.getElementById('ai-indicator'),
        imeWarning: document.getElementById('ime-warning')
    },
    // 앱 초기화
    init() {
        this.bindGlobalEvents();
        quizMode.init();
        learningMode.init();
    },
    // 전역 이벤트 리스너 바인딩
    bindGlobalEvents() {
        // 모드 선택
        document.getElementById('select-quiz-btn').addEventListener('click', () => this.changeMode('quiz'));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.changeMode('learning'));

        // 홈 버튼
        this.elements.homeBtn.addEventListener('click', () => this.changeMode('selection'));

        // TTS 음성 변경
        this.elements.ttsToggleBtn.addEventListener('click', this.toggleVoiceSet.bind(this));

        // 오디오 컨텍스트 초기화 (사용자 인터랙션 시)
        document.body.addEventListener('click', () => {
            if (!this.state.audioContext) {
                this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
        
        // 툴팁 위치 조정을 위한 마우스 이벤트
        document.addEventListener('mousemove', (e) => {
            if (!this.elements.translationTooltip.classList.contains('hidden')) {
                Object.assign(this.elements.translationTooltip.style, { left: `${e.pageX + 15}px`, top: `${e.pageY + 15}px` });
            }
        });
    },
    // 앱 모드 변경 관리
    changeMode(mode) {
        // 모든 모드 숨기기
        this.elements.selectionScreen.classList.add('hidden');
        this.elements.quizModeContainer.classList.add('hidden');
        this.elements.learningModeContainer.classList.add('hidden');
        this.elements.homeBtn.classList.add('hidden');
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
            learningMode.resetStartScreen();
        } else { // 'selection' 모드 (홈)
            this.elements.selectionScreen.classList.remove('hidden');
            quizMode.reset();
            learningMode.reset();
        }
    },
    // TTS 음성 토글
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
    // 로딩 인디케이터 표시/숨기기
    showAiIndicator(show) {
        this.elements.aiIndicator.classList.toggle('hidden', !show);
    },
    // 한글 입력 경고
    showImeWarning() {
        this.elements.imeWarning.classList.remove('hidden');
        clearTimeout(this.imeWarningTimeout);
        this.imeWarningTimeout = setTimeout(() => {
            this.elements.imeWarning.classList.add('hidden');
        }, 2000);
    },
};

// ================================================================
// API Module
// 모든 외부 API 통신을 담당합니다.
// ================================================================
const api = {
    // [중요] 아래 함수들은 클라이언트에서 직접 API 키를 사용합니다.
    // 실제 서비스에서는 SCRIPT_URL을 통해 서버(Google Apps Script)에서 대신 호출하도록 변경해야 합니다.
    async speak(text, contentType = 'word') {
        const voiceSets = {
            'UK': { 'word': { languageCode: 'en-GB', name: 'en-GB-Wavenet-D', ssmlGender: 'MALE' }, 'sample': { languageCode: 'en-GB', name: 'en-GB-Journey-D', ssmlGender: 'MALE' } },
            'US': { 'word': { languageCode: 'en-US', name: 'en-US-Wavenet-F', ssmlGender: 'FEMALE' }, 'sample': { languageCode: 'en-US', name: 'en-US-Journey-F', ssmlGender: 'FEMALE' } }
        };
        if (!text || !text.trim() || app.state.isSpeaking) return;
        if (app.state.audioContext.state === 'suspended') app.state.audioContext.resume();
        app.state.isSpeaking = true;

        const processedText = text.replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');
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
    async generateSampleFromAI(word) {
        const prompt = `Create five simple, natural, and distinct example sentences for the English word "${word}". If the word has multiple common meanings or can be used as different parts of speech (e.g., noun, verb), please provide sentences that demonstrate these different uses. Each sentence must be on a new line. Do not add any extra text, numbers, or bullet points.`;
        const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${app.config.GEMINI_API_KEY}`;
        try {
            const response = await fetch(GEMINI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                return data.candidates[0].content.parts[0].text.trim().split('\n').filter(s => s);
            }
            throw new Error("AI가 문장을 생성하지 못했습니다.");
        } catch (error) {
            console.error('Gemini API Error:', error);
            throw error;
        }
    },
    async fetchFromGoogleSheet(action, params = {}) {
        const url = new URL(app.config.SCRIPT_URL);
        url.searchParams.append('action', action);
        for (const key in params) {
            url.searchParams.append(key, params[key]);
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
// 공통 UI 관련 함수들을 관리합니다.
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
                    span.className = 'cursor-pointer hover:bg-yellow-200 p-1 rounded-sm transition-colors';
                    span.title = '클릭하여 듣기 및 복사';
                    span.onclick = () => { api.speak(englishPhrase, 'word'); this.copyToClipboard(englishPhrase); };
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
    async handleSentenceMouseOver(event, sentence) {
        clearTimeout(app.state.tooltipTimeout);
        const tooltip = app.elements.translationTooltip;
        Object.assign(tooltip.style, { left: `${event.pageX + 15}px`, top: `${event.pageY + 15}px` });
        tooltip.textContent = '번역 중...';
        tooltip.classList.remove('hidden');
        const translatedText = await api.translateText(sentence);
        tooltip.textContent = translatedText;
    },
    handleSentenceMouseOut() {
        app.state.tooltipTimeout = setTimeout(() => app.elements.translationTooltip.classList.add('hidden'), 300);
    },
    // [개선] 중복되던 예문 표시 함수를 하나로 통합
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
// 순수 헬퍼 함수들을 관리합니다.
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
// 퀴즈 모드 관련 모든 로직과 상태를 관리합니다.
// ================================================================
const quizMode = {
    state: {
        currentQuiz: {},
        preloadedQuizzes: [],
        isPreloading: false,
        shouldPreload: true,
        flippedContentType: null
    },
    config: {
        MAX_PRELOADED: 100
    },
    elements: {},
    init() {
        // 퀴즈 모드에서 사용할 DOM 요소를 한 번만 찾아서 캐싱합니다.
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
        this.elements.passBtn.addEventListener('click', () => this.loadAndDisplayQuiz());
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip('sample'));
        this.elements.explanationBtn.addEventListener('click', () => this.handleFlip('explanation'));
        this.elements.word.addEventListener('click', () => {
            const word = this.elements.word.textContent;
            api.speak(word, 'word');
            ui.copyToClipboard(word);
        });

        // 키보드 단축키 (숫자 1-5)
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
        try {
            const firstQuiz = await api.fetchFromGoogleSheet('getQuiz');
            if (firstQuiz.finished) {
                this.showFinishedScreen(firstQuiz.message);
                return;
            }
            this.state.preloadedQuizzes.push(firstQuiz);
            this.preloadManager();
            this.loadAndDisplayQuiz();
        } catch (error) {
            this.elements.loader.querySelector('.loader').style.display = 'none';
            this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">퀴즈를 시작할 수 없습니다.</p><p class="text-sm text-gray-600 mt-2 break-all">${error.message}</p>`;
        }
    },
    reset() {
        this.state.preloadedQuizzes = [];
        this.state.isPreloading = false;
        this.state.shouldPreload = true;
        this.showLoader(true);
        this.elements.loader.querySelector('.loader').style.display = 'block';
        this.elements.loaderText.textContent = "퀴즈 데이터를 불러오는 중...";
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.add('hidden');
    },
    async preloadManager() {
        if (this.state.isPreloading) return;
        this.state.isPreloading = true;
        while (this.state.shouldPreload && this.state.preloadedQuizzes.length < this.config.MAX_PRELOADED) {
            try {
                const data = await api.fetchFromGoogleSheet('getQuiz');
                if (data.finished) {
                    this.state.shouldPreload = false;
                    break;
                }
                this.state.preloadedQuizzes.push(data);
            } catch (error) {
                console.error("Background preloading failed:", error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        this.state.isPreloading = false;
    },
    async getNextQuiz() {
        if (this.state.preloadedQuizzes.length === 0) {
            this.elements.loaderText.textContent = "다음 퀴즈를 준비 중입니다...";
            this.showLoader(true);
            while (this.state.preloadedQuizzes.length === 0 && this.state.shouldPreload) {
                await new Promise(r => setTimeout(r, 100));
            }
            if (this.state.preloadedQuizzes.length === 0) return null;
        }
        return this.state.preloadedQuizzes.shift();
    },
    async loadAndDisplayQuiz() {
        const data = await this.getNextQuiz();
        if (this.state.shouldPreload && !this.state.isPreloading) {
            this.preloadManager();
        }
        if (!data) {
            this.showFinishedScreen("모든 단어 학습을 완료했습니다!");
            return;
        }
        this.state.currentQuiz = data;
        this.showLoader(false);
        this.displayQuiz(data.question, data.choices);
    },
    displayQuiz(question, choices) {
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
        this.elements.sampleBtn.textContent = hasSample ? '예문' : '예문 (AI)';
        this.elements.sampleBtn.classList.toggle('bg-purple-300', !hasSample);
        this.elements.sampleBtn.classList.toggle('hover:bg-purple-400', !hasSample);
        this.elements.sampleBtn.style.display = 'block';

        this.elements.explanationBtn.textContent = '보충자료';
        this.elements.explanationBtn.style.display = (question.explanation && question.explanation.trim()) ? 'block' : 'none';
    },
    checkAnswer(selectedLi, selectedChoice) {
        this.elements.choices.classList.add('disabled');
        this.elements.passBtn.disabled = true;
        const isCorrect = selectedChoice === this.state.currentQuiz.answer;
        selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (isCorrect) {
            api.fetchFromGoogleSheet('updateStatus', { word: this.state.currentQuiz.question.word });
        } else {
            const correctAnswerEl = Array.from(this.elements.choices.children).find(li => li.querySelector('span:last-child').textContent === this.state.currentQuiz.answer);
            correctAnswerEl?.classList.add('correct');
        }
        setTimeout(() => this.loadAndDisplayQuiz(), 1500);
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
        const isFrontVisible = !this.elements.cardFront.classList.contains('hidden');
        const hasSample = this.state.currentQuiz.question.sample && this.state.currentQuiz.question.sample.trim();
        this.elements.sampleBtn.textContent = hasSample ? '예문' : '예문 (AI)';
        this.elements.explanationBtn.textContent = '보충자료';

        if (isFrontVisible) {
            const frontHeight = this.elements.cardFront.offsetHeight;
            this.elements.cardBack.style.minHeight = `${frontHeight}px`;
            await this.updateBackContent(type);
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
                await this.updateBackContent(type);
                this.state.flippedContentType = type;
                (type === 'sample' ? this.elements.sampleBtn : this.elements.explanationBtn).textContent = 'BACK';
            }
        }
    },
    async updateBackContent(type) {
        const { word, sample, explanation } = this.state.currentQuiz.question;
        this.elements.backTitle.textContent = word;
        this.elements.backContent.innerHTML = '';
        if (type === 'sample') {
            if (sample && sample.trim()) {
                ui.displaySentences(sample.split('\n'), this.elements.backContent);
            } else {
                this.elements.passBtn.disabled = true;
                app.showAiIndicator(true);
                try {
                    const samples = await api.generateSampleFromAI(word);
                    ui.displaySentences(samples, this.elements.backContent);
                } catch (error) {
                    this.elements.backContent.innerHTML = `<p class="text-red-500 text-center">${error.message}</p>`;
                } finally {
                    app.showAiIndicator(false);
                    this.elements.passBtn.disabled = false;
                }
            }
        } else { // explanation
            ui.renderInteractiveText(this.elements.backContent, explanation);
        }
    }
};

// ================================================================
// Learning Mode Module
// 학습 모드 관련 모든 로직과 상태를 관리합니다.
// ================================================================
const learningMode = {
    state: {
        wordList: [],
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
            pronunciationDisplay: document.getElementById('pronunciation'),
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
        
        this.elements.wordDisplay.addEventListener('click', () => {
            const word = this.state.wordList[this.state.currentIndex]?.word;
            if (word) {
                api.speak(word, 'word');
                ui.copyToClipboard(word);
            }
        });
        
        // --- 제스처 및 단축키 이벤트 ---
        document.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('mousedown', this.handleMiddleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    },
    async start() {
        const startWord = this.elements.startWordInput.value.trim();
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        try {
            const data = await api.fetchFromGoogleSheet('getWords');
            this.state.wordList = data.words;
            if (this.state.wordList.length === 0) throw new Error("학습할 단어가 없습니다.");
            
            let startIndex = 0;
            if (startWord) {
                const lowerCaseStartWord = startWord.toLowerCase();
                const exactMatchIndex = this.state.wordList.findIndex(item => item.word.toLowerCase() === lowerCaseStartWord);
                if (exactMatchIndex !== -1) {
                    startIndex = exactMatchIndex;
                } else {
                    const suggestions = this.state.wordList.map((item, index) => ({
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
        } catch (error) {
            this.elements.loader.querySelector('.loader').style.display = 'none';
            this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">오류 발생</p><p class="text-sm text-gray-600 mt-2 break-all">${error.message}</p>`;
        }
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
        this.elements.cardBack.classList.remove('is-slid-up'); // 예문 카드 초기화
        const wordData = this.state.wordList[index];
        if (!wordData) return;
        this.elements.wordDisplay.textContent = wordData.word;
        ui.adjustFontSize(this.elements.wordDisplay);
        this.elements.pronunciationDisplay.textContent = wordData.pronunciation || '';
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>');
        ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation);
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim());
        
        const hasSample = wordData.sample && wordData.sample.trim();
        this.elements.sampleBtnImg.src = hasSample ? 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png' : 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png';
    },
    navigate(direction) {
        const len = this.state.wordList.length;
        if (len === 0) return;
        this.state.currentIndex = (this.state.currentIndex + direction + len) % len;
        this.displayWord(this.state.currentIndex);
    },
    async handleFlip() {
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = this.state.wordList[this.state.currentIndex];

        if (!isBackVisible) { // 뒷면 표시
            this.elements.backTitle.textContent = wordData.word;
            this.elements.backContent.innerHTML = '';
            const sampleText = wordData.sample;
            if (sampleText && sampleText.trim()) {
                ui.displaySentences(sampleText.split('\n'), this.elements.backContent);
            } else {
                this.elements.prevBtn.disabled = this.elements.nextBtn.disabled = true;
                app.showAiIndicator(true);
                try {
                    const samples = await api.generateSampleFromAI(wordData.word);
                    ui.displaySentences(samples, this.elements.backContent);
                } catch (error) {
                    this.elements.backContent.innerHTML = `<p class="text-red-500 text-center">${error.message}</p>`;
                } finally {
                    app.showAiIndicator(false);
                    this.elements.prevBtn.disabled = this.elements.nextBtn.disabled = false;
                }
            }
            this.elements.cardBack.classList.add('is-slid-up');
            this.elements.sampleBtnImg.src = 'https://images.icon-icons.com/1055/PNG/128/5-remove-cat_icon-icons.com_76681.png';
        } else { // 앞면 표시
            this.elements.cardBack.classList.remove('is-slid-up');
            const hasSample = wordData.sample && wordData.sample.trim();
            this.elements.sampleBtnImg.src = hasSample ? 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png' : 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png';
        }
    },
    // --- 이벤트 핸들러들 ---
    isLearningModeActive() {
        return !this.elements.appContainer.classList.contains('hidden');
    },
    handleWheel(e) {
        if (!this.isLearningModeActive()) return;
        const now = new Date().getTime();
        if (now - this.state.lastWheelTime < 250) {
            e.preventDefault();
            return;
        }
        this.state.lastWheelTime = now;
        if (e.target.closest('.overflow-y-auto')) return;
        e.preventDefault();
        this.navigate(e.deltaY < 0 ? -1 : 1);
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
            this.elements.sampleBtn.click();
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
        const touchendX = e.changedTouches[0].screenX;
        const touchendY = e.changedTouches[0].screenY;
        const deltaX = touchendX - this.state.touchstartX;
        const deltaY = touchendY - this.state.touchstartY;

        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            this.navigate(deltaX > 0 ? -1 : 1);
        }
        this.state.touchstartX = this.state.touchstartY = 0;
    }
};

// 앱 실행
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
