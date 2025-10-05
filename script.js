// ================================================================
// App Main Controller
// ================================================================
const app = {
    config: {
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbzmcgauS6eUd2QAncKzX_kQ1K1b7x7xn2k6s1JWwf-FxmrbIt-_9-eAvNrFkr5eDdwr0w/exec",
        sheetLinks: {
            '1y': 'https://docs.google.com/spreadsheets/d/1r7fWUV1ea9CU-s2iSOwLKexEe2_7L8oUKhK0n1DpDUM/edit?usp=sharing',
            '2y': 'https://docs.google.com/spreadsheets/d/1Xydj0im3Cqq9JhjN8IezZ-7DBp1-DV703cCIb3ORdc8/edit?usp=sharing',
            '3y': 'https://docs.google.com/spreadsheets/d/1Z_n9IshFSC5cBBW6IkZNfQsLb2BBrp9QeOlsGsCkn2Y/edit?usp=sharing'
        },
        backgroundImages: [
            'https://i.imgur.com/EvyV4x7.jpeg', 'https://i.imgur.com/xsnT8kO.jpeg',
            'https://i.imgur.com/6gZtYDb.jpeg', 'https://i.imgur.com/SUVavHy.jpeg',
            'https://i.imgur.com/JPAS1Cd.jpeg', 'https://i.imgur.com/Zv6jaCy.jpeg',
            'https://i.imgur.com/ciQJtXo.jpeg', 'https://i.imgur.com/Gf3WIPZ.jpeg',
            'https://i.imgur.com/LWQcDqg.jpeg', 'https://i.imgur.com/PBj5fpV.jpeg',
            'https://i.imgur.com/zh67pPT.jpeg', 'https://i.imgur.com/k634cYs.jpeg',
            'https://i.imgur.com/7KkgrB7.jpeg', 'https://i.imgur.com/alzwny5.jpeg',
            'https://i.imgur.com/yUD82Tz.jpeg', 'https://i.imgur.com/45Lwias.jpeg',
            'https://i.imgur.com/FalU86P.jpeg', 'https://i.imgur.com/NHCqHZd.jpeg',
            'https://i.imgur.com/W1jMwGn.jpeg', 'https://i.imgur.com/yYwMN6q.jpeg',
            'https://i.imgur.com/k8yhWVh.jpeg', 'https://i.imgur.com/cjtzRMf.jpeg',
            'https://i.imgur.com/0nzdeg7.jpeg', 'https://i.imgur.com/Nv1c6o5.jpeg',
            'https://i.imgur.com/VIZD0qs.jpeg', 'https://i.imgur.com/26HvkAH.jpeg',
            'https://i.imgur.com/fuA0knu.jpeg', 'https://i.imgur.com/ig4y2TO.jpeg',
            'https://i.imgur.com/ixv60Wf.jpeg', 'https://i.imgur.com/pANKqmX.jpeg',
            'https://i.imgur.com/HFcG7SI.jpeg'
        ]
    },
    state: {
        selectedSheet: '',
        translationCache: {},
        tooltipTimeout: null,
        debouncedTranslate: null,
    },
    elements: {},
    init() {
        this.elements = {
            mainScreens: document.querySelectorAll('.main-screen'),
            gradeSelectionScreen: document.getElementById('grade-selection-screen'),
            selectionScreen: document.getElementById('selection-screen'),
            selectionTitle: document.getElementById('selection-title'),
            sheetLink: document.getElementById('sheet-link'),
            authorCredit: document.getElementById('author-credit'),
            quizModeContainer: document.getElementById('quiz-mode-container'),
            learningModeContainer: document.getElementById('learning-mode-container'),
            homeBtn: document.getElementById('home-btn'),
            backToGradeSelectionBtn: document.getElementById('back-to-grade-selection-btn'),
            refreshBtn: document.getElementById('refresh-btn'),
            translationTooltip: document.getElementById('translation-tooltip'),
            imeWarning: document.getElementById('ime-warning'),
            noSampleMessage: document.getElementById('no-sample-message'),
            refreshSuccessMessage: document.getElementById('refresh-success-message'),
            confirmationModal: document.getElementById('confirmation-modal'),
            confirmYesBtn: document.getElementById('confirm-yes-btn'),
            confirmNoBtn: document.getElementById('confirm-no-btn'),
            practiceModeContainer: document.getElementById('practice-mode-container'),
        };
        this.state.debouncedTranslate = this.debounce(ui.handleSentenceMouseOver, 300);
        this.preloadImages();
        this.setBackgroundImage();
        this.bindGlobalEvents();
        quizMode.init();
        learningMode.init();
    },
    bindGlobalEvents() {
        document.querySelectorAll('.grade-select-card img.group').forEach(img => {
            img.addEventListener('click', () => {
                const card = img.closest('.grade-select-card');
                this.state.selectedSheet = card.dataset.sheet;
                this.elements.selectionTitle.textContent = `${img.alt} 어휘`;
                this.elements.sheetLink.href = this.config.sheetLinks[this.state.selectedSheet];
                this.elements.sheetLink.classList.remove('hidden');
                this.elements.backToGradeSelectionBtn.classList.remove('hidden');
                this.showModeSelection();
                this.setBackgroundImage();
            });
        });

        document.getElementById('select-quiz-btn').addEventListener('click', () => this.changeMode('quiz'));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.changeMode('learning'));

        this.elements.homeBtn.addEventListener('click', () => this.showModeSelection());
        this.elements.backToGradeSelectionBtn.addEventListener('click', () => this.showGradeSelection());
        
        this.elements.refreshBtn.addEventListener('click', () => this.elements.confirmationModal.classList.remove('hidden'));
        this.elements.confirmNoBtn.addEventListener('click', () => this.elements.confirmationModal.classList.add('hidden'));
        this.elements.confirmYesBtn.addEventListener('click', () => {
            this.elements.confirmationModal.classList.add('hidden');
            this.forceRefreshData();
        });
    },
    changeMode(mode) {
        this.elements.mainScreens.forEach(screen => screen.classList.add('hidden'));
        this.elements.homeBtn.classList.remove('hidden');
        this.elements.practiceModeContainer.classList.add('hidden');

        if (mode === 'quiz') {
            this.elements.refreshBtn.classList.add('hidden');
            this.elements.quizModeContainer.classList.remove('hidden');
            this.elements.practiceModeContainer.classList.remove('hidden');
            quizMode.start();
        } else if (mode === 'learning') {
            this.elements.refreshBtn.classList.remove('hidden');
            this.elements.learningModeContainer.classList.remove('hidden');
            learningMode.resetStartScreen();
        }
    },
    showModeSelection() {
        this.elements.mainScreens.forEach(screen => screen.classList.add('hidden'));
        this.elements.selectionScreen.classList.remove('hidden');
        this.elements.homeBtn.classList.remove('hidden');
        this.elements.refreshBtn.classList.add('hidden');
        this.elements.practiceModeContainer.classList.add('hidden');
        quizMode.reset();
        learningMode.reset();
    },
    showGradeSelection() {
        this.elements.mainScreens.forEach(screen => screen.classList.add('hidden'));
        this.elements.gradeSelectionScreen.classList.remove('hidden');
        this.elements.homeBtn.classList.add('hidden');
        this.elements.backToGradeSelectionBtn.classList.add('hidden');
        this.elements.sheetLink.classList.add('hidden');
        this.state.selectedSheet = '';
    },
    async forceRefreshData() {
        const sheet = this.state.selectedSheet;
        if (!sheet) return;

        learningMode.elements.startBtn.textContent = '새로고침 중...';
        learningMode.elements.startBtn.disabled = true;
        learningMode.elements.startWordInput.disabled = true;
        this.elements.homeBtn.disabled = true;
        this.elements.refreshBtn.disabled = true;
        this.elements.backToGradeSelectionBtn.disabled = true;

        localStorage.removeItem(`wordListCache_${sheet}`);
        
        try {
            const data = await api.fetchFromGoogleSheet('getWords', { force_refresh: 'true' });
            if (data.words) {
                const cachePayload = { timestamp: Date.now(), words: data.words };
                localStorage.setItem(`wordListCache_${sheet}`, JSON.stringify(cachePayload));
                if(learningMode.state.isWordListReady) {
                    learningMode.state.wordList = data.words;
                }
            }
            this.showRefreshSuccessMessage();
        } catch(err) {
            console.error("Error during data refresh:", err);
            alert("데이터 새로고침에 실패했습니다.");
        } finally {
            learningMode.elements.startBtn.textContent = '학습 시작';
            learningMode.elements.startBtn.disabled = false;
            learningMode.elements.startWordInput.disabled = false;
            this.elements.homeBtn.disabled = false;
            this.elements.refreshBtn.disabled = false;
            this.elements.backToGradeSelectionBtn.disabled = false;
        }
    },
    showRefreshSuccessMessage() {
        const msgEl = this.elements.refreshSuccessMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500);
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
    setBackgroundImage() {
        if (this.config.backgroundImages.length === 0) return;
        const randomIndex = Math.floor(Math.random() * this.config.backgroundImages.length);
        const imageUrl = this.config.backgroundImages[randomIndex];
        document.documentElement.style.setProperty('--bg-image', `url('${imageUrl}')`);
    },
    preloadImages() {
        this.config.backgroundImages.forEach(src => {
            const img = new Image();
            img.src = src;
        });
    },
    debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
};

// ================================================================
// API & UI & Utility Modules
// ================================================================
const api = {
    async fetchFromGoogleSheet(action, params = {}) {
        const url = new URL(app.config.SCRIPT_URL);
        url.searchParams.append('action', action);
        url.searchParams.append('sheet', app.state.selectedSheet);
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
            const url = new URL(app.config.SCRIPT_URL);
            url.searchParams.append('action', 'translateText');
            url.searchParams.append('text', text);
            const response = await fetch(url);
            const data = await response.json();
            if (data.success) {
                app.state.translationCache[text] = data.translatedText;
                return data.translatedText;
            }
            return '번역 실패';
        } catch (error) {
            console.error('Translation fetch error:', error);
            return '번역 오류';
        }
    },
    speak(text) {
        if (!text || !text.trim() || !('speechSynthesis' in window)) return;
        const processedText = text.replace(/\bsb\b/g, 'somebody').replace(/\bsth\b/g, 'something');
        const utterance = new SpeechSynthesisUtterance(processedText);
        const voices = window.speechSynthesis.getVoices();
        utterance.voice = voices.find(voice => voice.lang === 'en-US') || voices.find(voice => voice.lang.startsWith('en-'));
        utterance.lang = 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    },
    async copyToClipboard(text) {
        if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(text); } 
            catch (err) { console.error('클립보드 복사 실패:', err); }
        }
    },
};

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
    renderInteractiveText(targetElement, text) {
        targetElement.innerHTML = '';
        if (!text || !text.trim()) return;
        const regex = /(\[.*?\]|\bS\+V\b)|([a-zA-Z'-]+(?:[\s'-]*[a-zA-Z'-]+)*)/g;
        text.split('\n').forEach(line => {
            let lastIndex = 0;
            let match;
            while ((match = regex.exec(line))) {
                if (match.index > lastIndex) targetElement.appendChild(document.createTextNode(line.substring(lastIndex, match.index)));
                const [_, nonClickable, englishPhrase] = match;
                if (englishPhrase) {
                    const span = document.createElement('span');
                    span.textContent = englishPhrase;
                    span.className = 'cursor-pointer hover:bg-yellow-200 p-1 rounded-sm transition-colors';
                    span.title = '클릭하여 듣기 및 복사';
                    span.onclick = () => { api.speak(englishPhrase); api.copyToClipboard(englishPhrase); };
                    targetElement.appendChild(span);
                } else if (nonClickable) {
                    targetElement.appendChild(document.createTextNode(nonClickable));
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) targetElement.appendChild(document.createTextNode(line.substring(lastIndex)));
            targetElement.appendChild(document.createElement('br'));
        });
        if (targetElement.lastChild && targetElement.lastChild.tagName === 'BR') {
            targetElement.removeChild(targetElement.lastChild);
        }
    },
    async handleSentenceMouseOver(event, sentence) {
        clearTimeout(app.state.tooltipTimeout);
        const tooltip = app.elements.translationTooltip;
        const targetRect = event.target.getBoundingClientRect();
        
        Object.assign(tooltip.style, {
            left: `${targetRect.left + window.scrollX}px`,
            top: `${targetRect.bottom + window.scrollY + 5}px`
        });

        tooltip.textContent = '번역 중...';
        tooltip.classList.remove('hidden');
        const translatedText = await api.translateText(sentence);
        tooltip.textContent = translatedText;
    },
    handleSentenceMouseOut() {
        app.state.tooltipTimeout = setTimeout(() => app.elements.translationTooltip.classList.add('hidden'), 300);
    },
    displaySentences(sentences, containerElement) {
        containerElement.innerHTML = '';
        sentences.filter(s => s.trim()).forEach(sentence => {
            const p = document.createElement('p');
            p.textContent = sentence;
            p.className = 'p-2 rounded transition-colors cursor-pointer hover:bg-gray-200 sample-sentence';
            p.onclick = () => api.speak(sentence);
            p.addEventListener('mouseover', (e) => app.state.debouncedTranslate(e, p.textContent));
            p.addEventListener('mouseout', this.handleSentenceMouseOut);
            containerElement.appendChild(p);
        });
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
    getLearnedWords() {
        const data = localStorage.getItem('vocabLearnedWords');
        if (data) {
            const parsedData = JSON.parse(data);
            return parsedData[app.state.selectedSheet] || [];
        }
        return [];
    },
    saveLearnedWord(word) {
        if (!word) return;
        const data = localStorage.getItem('vocabLearnedWords');
        let parsedData = data ? JSON.parse(data) : {};
        const sheet = app.state.selectedSheet;
        if (!parsedData[sheet]) parsedData[sheet] = [];
        if (!parsedData[sheet].includes(word)) {
            parsedData[sheet].push(word);
            localStorage.setItem('vocabLearnedWords', JSON.stringify(parsedData));
        }
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
        flippedContentType: null,
        isPracticeMode: false,
        practiceLearnedWords: [],
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
            choices: document.getElementById('quiz-choices'),
            backTitle: document.getElementById('quiz-back-title'),
            backContent: document.getElementById('quiz-back-content'),
            passBtn: document.getElementById('quiz-pass-btn'),
            sampleBtn: document.getElementById('quiz-sample-btn'),
            explanationBtn: document.getElementById('quiz-explanation-btn'),
            finishedScreen: document.getElementById('quiz-finished-screen'),
            finishedMessage: document.getElementById('quiz-finished-message'),
            practiceModeCheckbox: document.getElementById('practice-mode-checkbox'),
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.passBtn.addEventListener('click', () => this.displayNextQuiz());
        this.elements.sampleBtn.addEventListener('click', () => this.handleFlip('sample'));
        this.elements.explanationBtn.addEventListener('click', () => this.handleFlip('explanation'));
        this.elements.word.addEventListener('click', (e) => {
             api.speak(this.elements.word.textContent);
             e.currentTarget.classList.add('active-feedback');
             setTimeout(() => e.currentTarget.classList.remove('active-feedback'), 200);
        });
        this.elements.practiceModeCheckbox.addEventListener('change', (e) => {
            this.state.isPracticeMode = e.target.checked;
            this.start(); // 모드 변경 시 퀴즈 재시작
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
        await this.fetchQuizBatch();
        this.displayNextQuiz();
    },
    reset() {
        this.state.quizBatch = [];
        this.state.isFetching = false;
        this.state.isFinished = false;
        this.state.practiceLearnedWords = []; // 연습모드 기록 초기화
        // this.state.isPracticeMode 는 체크박스 상태를 따르므로 여기서 리셋하지 않음
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
            let learnedWordsForRequest = [];
            // 연습 모드가 아닐 때만 실제 학습 기록을 사용
            if (!this.state.isPracticeMode) {
                learnedWordsForRequest = utils.getLearnedWords();
            }
            // 연습 모드일 때는 서버에 learnedWords를 보내지 않거나, isPractice 플래그를 보냄
            const data = await api.fetchFromGoogleSheet('getQuizBatch', { 
                learnedWords: learnedWordsForRequest.join(','),
                isPractice: this.state.isPracticeMode
            });

            if (data.finished) {
                this.state.isFinished = true;
                if (this.state.quizBatch.length === 0) {
                    this.showFinishedScreen(data.message || "모든 단어 학습을 완료했습니다!");
                }
                return;
            }
            // 연습모드일 경우, 임시 학습 기록을 제외
            let newQuizzes = data.quizzes;
            if (this.state.isPracticeMode) {
                newQuizzes = data.quizzes.filter(q => !this.state.practiceLearnedWords.includes(q.question.word));
            }

            this.state.quizBatch.push(...newQuizzes);
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
            if (this.state.isFetching) {
                this.elements.loaderText.textContent = "다음 퀴즈를 준비 중입니다...";
                this.showLoader(true);
                const checker = setInterval(() => {
                    if (this.state.quizBatch.length > 0) {
                        clearInterval(checker);
                        this.displayNextQuiz();
                    }
                }, 100)
            } else if (this.state.isFinished) {
                this.showFinishedScreen("모든 단어 학습을 완료했습니다!");
            }
            return;
        }
        this.state.currentQuiz = this.state.quizBatch.shift();
        this.showLoader(false);
        this.renderQuiz(this.state.currentQuiz.question, this.state.currentQuiz.choices);
    },
    renderQuiz(question, choices) {
        this.elements.cardFront.classList.remove('hidden');
        this.elements.cardBack.classList.add('hidden');
        this.state.flippedContentType = null;
        this.elements.word.textContent = question.word;
        ui.adjustFontSize(this.elements.word);
        this.elements.choices.innerHTML = '';
        choices.forEach((choice, index) => {
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer flex items-start transition-all';
            li.innerHTML = `<span class="font-bold mr-3">${index + 1}.</span> <span>${choice}</span>`;
            li.onclick = () => this.checkAnswer(li, choice);
            this.elements.choices.appendChild(li);
        });
        this.elements.choices.classList.remove('disabled');
        this.elements.passBtn.disabled = false;
        this.elements.passBtn.innerHTML = 'PASS';
        this.elements.sampleBtn.style.display = (question.sample && question.sample.trim()) ? 'block' : 'none';
        this.elements.explanationBtn.style.display = (question.explanation && question.explanation.trim()) ? 'block' : 'none';
    },
    checkAnswer(selectedLi, selectedChoice) {
        this.elements.choices.classList.add('disabled');
        const originalPassText = this.elements.passBtn.textContent;
        this.elements.passBtn.disabled = true;
        this.elements.passBtn.innerHTML = `<div class="loader-small"></div>`;
        
        const isCorrect = selectedChoice === this.state.currentQuiz.answer;
        if (isCorrect) {
            selectedLi.classList.add('correct');
            if (this.state.isPracticeMode) {
                this.state.practiceLearnedWords.push(this.state.currentQuiz.question.word);
            } else {
                utils.saveLearnedWord(this.state.currentQuiz.question.word);
            }
        } else {
            selectedLi.classList.add('incorrect');
            const correctAnswerEl = Array.from(this.elements.choices.children).find(li => li.querySelector('span:last-child').textContent === this.state.currentQuiz.answer);
            correctAnswerEl?.classList.add('correct');
        }
        setTimeout(() => {
            this.elements.passBtn.innerHTML = originalPassText;
            this.displayNextQuiz()
        }, 1500);
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
    handleFlip(type) {
        const isFrontVisible = !this.elements.cardFront.classList.contains('hidden');
        if (isFrontVisible) {
            const frontHeight = this.elements.cardFront.offsetHeight;
            this.elements.cardBack.style.minHeight = `${frontHeight}px`;
            this.updateBackContent(type);
            this.elements.cardFront.classList.add('hidden');
            this.elements.cardBack.classList.remove('hidden');
            this.state.flippedContentType = type;
        } else {
            if (this.state.flippedContentType === type) {
                this.elements.cardFront.classList.remove('hidden');
                this.elements.cardBack.classList.add('hidden');
                this.state.flippedContentType = null;
            } else {
                this.updateBackContent(type);
                this.state.flippedContentType = type;
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
        wordList: [],
        isWordListReady: false,
        currentIndex: 0,
        touchstartX: 0,
        touchstartY: 0,
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
            const word = this.state.wordList[this.state.currentIndex]?.word;
            if (word) { 
                api.speak(word); 
                api.copyToClipboard(word); 
                e.currentTarget.classList.add('active-feedback');
                setTimeout(() => e.currentTarget.classList.remove('active-feedback'), 200);
            }
        });
        document.addEventListener('mousedown', this.handleMiddleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    },
    async loadWordList() {
        const sheet = app.state.selectedSheet;
        try {
            const cachedData = localStorage.getItem(`wordListCache_${sheet}`);
            if (cachedData) {
                const { timestamp, words } = JSON.parse(cachedData);
                if (Date.now() - timestamp < 86400000) {
                    this.state.wordList = words;
                    this.state.isWordListReady = true;
                    return;
                }
            }
        } catch (e) {
            console.error("캐시 로딩 실패:", e);
            localStorage.removeItem(`wordListCache_${sheet}`);
        }

        this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
        this.elements.loader.classList.remove('hidden');
        this.elements.startScreen.classList.add('hidden');

        try {
            const data = await api.fetchFromGoogleSheet('getWords');
            if(data.error) throw new Error(data.message);
            this.state.wordList = data.words;
            this.state.isWordListReady = true;
            const cachePayload = { timestamp: Date.now(), words: data.words };
            localStorage.setItem(`wordListCache_${sheet}`, JSON.stringify(cachePayload));
        } catch (error) {
            console.error("단어 목록 로딩 실패:", error);
            this.showError(error.message);
        } finally {
            this.elements.loader.classList.add('hidden');
            this.elements.startScreen.classList.remove('hidden');
        }
    },
    async start() {
        if (!this.state.isWordListReady) {
            await this.loadWordList();
            if (!this.state.isWordListReady) return;
        }
        
        this.elements.startScreen.classList.add('hidden');
        
        let startIndex = 0;
        const startWord = this.elements.startWordInput.value.trim().toLowerCase();
        
        if (startWord) {
            const exactMatchIndex = this.state.wordList.findIndex(item => item.word.toLowerCase() === startWord);
            if (exactMatchIndex !== -1) {
                startIndex = exactMatchIndex;
            } else {
                const suggestions = this.state.wordList.map((item, index) => ({
                    word: item.word,
                    index,
                    distance: utils.levenshteinDistance(startWord, item.word.toLowerCase())
                })).sort((a, b) => a.distance - b.distance).slice(0, 5);
                this.displaySuggestions(suggestions);
                return;
            }
        }
        this.state.currentIndex = startIndex;
        this.launchApp();
    },
    showError(message) {
        this.elements.loader.querySelector('.loader').style.display = 'none';
        this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">오류 발생</p><p class="text-sm text-gray-600 mt-2 break-all">${message}</p>`;
    },
    launchApp() {
        app.elements.refreshBtn.classList.add('hidden');
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.appContainer.classList.remove('hidden');
        this.elements.fixedButtons.classList.remove('hidden');
        this.displayWord(this.state.currentIndex);
    },
    reset() {
        this.elements.appContainer.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.fixedButtons.classList.add('hidden');
        this.state.wordList = [];
        this.state.isWordListReady = false;
        this.elements.startScreen.classList.remove('hidden');
        this.resetStartScreen();
    },
    resetStartScreen() {
        this.elements.startInputContainer.classList.remove('hidden');
        this.elements.suggestionsContainer.classList.add('hidden');
        this.elements.startWordInput.value = '';
        this.elements.startWordInput.focus();
        this.loadWordList();
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
        const wordData = this.state.wordList[index];
        if (!wordData) return;
        this.elements.wordDisplay.textContent = wordData.word;
        ui.adjustFontSize(this.elements.wordDisplay);
        this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>');
        ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation);
        this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim());
        
        const hasSample = wordData.sample && wordData.sample.trim() !== '';
        this.elements.sampleBtnImg.src = hasSample 
            ? 'https://images.icon-icons.com/1055/PNG/128/14-delivery-cat_icon-icons.com_76690.png'
            : 'https://images.icon-icons.com/1055/PNG/128/19-add-cat_icon-icons.com_76695.png';
    },
    navigate(direction) {
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const len = this.state.wordList.length;
        if (len === 0) return;
        
        if (isBackVisible) {
            this.handleFlip();
            setTimeout(() => {
                this.state.currentIndex = (this.state.currentIndex + direction + len) % len;
                this.displayWord(this.state.currentIndex);
            }, 300);
        } else {
            this.state.currentIndex = (this.state.currentIndex + direction + len) % len;
            this.displayWord(this.state.currentIndex);
        }
    },
    handleFlip() {
        const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up');
        const wordData = this.state.wordList[this.state.currentIndex];
        const hasSample = wordData && wordData.sample && wordData.sample.trim() !== '';

        if (!isBackVisible) {
            if (!hasSample) {
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
        const keyMap = { 'ArrowLeft': -1, 'ArrowRight': 1, 'ArrowUp': -1, 'ArrowDown': 1 };
        if (keyMap[e.key] !== undefined) {
            e.preventDefault();
            this.navigate(keyMap[e.key]);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this.handleFlip();
        } else if (e.key === ' ') {
             e.preventDefault();
            if (!this.elements.cardBack.classList.contains('is-slid-up')) {
                this.elements.wordDisplay.click();
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
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            this.navigate(deltaX > 0 ? -1 : 1);
        } 
        else if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
            if (!e.target.closest('#learning-app-container')) {
                if (deltaY < 0) {
                    this.navigate(1);
                }
            }
        }
        this.state.touchstartX = this.state.touchstartY = 0;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
