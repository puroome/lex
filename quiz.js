// ================================================================
// Quiz Mode Controller
// ================================================================
import { app } from './main.js';
import { api } from './api.js';
import { ui } from './ui.js';

export const quizMode = {
    state: {
        quizType: null,
        currentQuiz: null,
        sessionAnsweredInSet: 0,
        sessionCorrectInSet: 0,
        sessionMistakes: [],
        answeredWords: new Set(),
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
        this.showLoader(true, "단어 목록 동기화 중...");
        if (!app.state.isWordListReady) await api.loadWordList();
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

        const reviewCandidates = ui.utils.shuffleArray(getCandidates(allWords));
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
        const nextQuiz = await this.generateSingleQuiz();
        
        if (nextQuiz) {
            this.state.currentQuiz = nextQuiz;
            this.state.answeredWords.add(nextQuiz.question.word);
            this.showLoader(false);
            this.renderQuiz(nextQuiz);
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
        }, 1200);
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
        ui.utils.shuffleArray(candidates);
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.meaning));
        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.meaning !== correctWordData.meaning) wrongAnswers.add(randomWord.meaning);
        }
        const choices = ui.utils.shuffleArray([correctWordData.meaning, ...Array.from(wrongAnswers)]);
        return { type: 'MULTIPLE_CHOICE_MEANING', question: { word: correctWordData.word }, choices, answer: correctWordData.meaning };
    },
    createBlankQuiz(correctWordData, allWordsData) {
        if (!correctWordData.sample || correctWordData.sample.trim() === '') return null;
        const firstLine = correctWordData.sample.split('\n')[0].replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "").trim();
        const placeholderRegex = new RegExp(`\\b${correctWordData.word}\\b`, 'i');
        
        if (!firstLine.match(placeholderRegex)) return null;

        const sentenceWithBlank = firstLine.replace(placeholderRegex, "___BLANK___").trim();

        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.word !== correctWordData.word);
        ui.utils.shuffleArray(candidates);
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));
        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) wrongAnswers.add(randomWord.word);
        }
        const choices = ui.utils.shuffleArray([correctWordData.word, ...Array.from(wrongAnswers)]);
        return { type: 'FILL_IN_THE_BLANK', question: { sentence_with_blank: sentenceWithBlank, word: correctWordData.word }, choices, answer: correctWordData.word };
    },
    async createDefinitionQuiz(correctWordData, allWordsData) {
        const definition = await api.fetchDefinition(correctWordData.word);
        if (!definition) return null;
        const wrongAnswers = new Set();
        let candidates = allWordsData.filter(w => w.pos === correctWordData.pos && w.word !== correctWordData.word);
        ui.utils.shuffleArray(candidates);
        candidates.slice(0, 3).forEach(w => wrongAnswers.add(w.word));
        while (wrongAnswers.size < 3) {
            const randomWord = allWordsData[Math.floor(Math.random() * allWordsData.length)];
            if (randomWord.word !== correctWordData.word) wrongAnswers.add(randomWord.word);
        }
        const choices = ui.utils.shuffleArray([correctWordData.word, ...Array.from(wrongAnswers)]);
        return { type: 'MULTIPLE_CHOICE_DEFINITION', question: { definition, word: correctWordData.word }, choices, answer: correctWordData.word };
    }
};
