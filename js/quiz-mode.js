import { api } from './api.js';
import { ui } from './ui.js';

export const quizMode = {
    state: {
        app: null,
        currentQuiz: {},
        quizType: null,
        quizBatch: [],
        isFetching: false,
        isFinished: false,
        allWordsLearned: false,
    },
    elements: {},
    init(app) {
        this.state.app = app;
        this.elements = {
            quizSelectionScreen: document.getElementById('quiz-selection-screen'),
            startMeaningQuizBtn: document.getElementById('start-meaning-quiz-btn'),
            startBlankQuizBtn: document.getElementById('start-blank-quiz-btn'),
            startDefinitionQuizBtn: document.getElementById('start-definition-quiz-btn'),
            loader: document.getElementById('quiz-loader'),
            loaderText: document.getElementById('quiz-loader-text'),
            contentContainer: document.getElementById('quiz-content-container'),
            cardFront: document.getElementById('quiz-card-front'),
            questionDisplay: document.getElementById('quiz-question-display'),
            choices: document.getElementById('quiz-choices'),
            finishedScreen: document.getElementById('quiz-finished-screen'),
            finishedMessage: document.getElementById('quiz-finished-message'),
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startMeaningQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_MEANING'));
        this.elements.startBlankQuizBtn.addEventListener('click', () => this.start('FILL_IN_THE_BLANK'));
        this.elements.startDefinitionQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_DEFINITION'));

        document.addEventListener('keydown', (e) => {
            const isQuizModeActive = !this.elements.contentContainer.classList.contains('hidden') && !this.elements.choices.classList.contains('disabled');
            if (!isQuizModeActive) return;

            const choiceCount = Array.from(this.elements.choices.children).filter(el => !el.textContent.includes('PASS')).length;
            
            if (e.key.toLowerCase() === 'p' || e.key === '0') {
                 e.preventDefault();
                 const passButton = Array.from(this.elements.choices.children).find(el => el.textContent.includes('PASS'));
                 if(passButton) passButton.click();
            } else {
                const choiceIndex = parseInt(e.key);
                if (choiceIndex >= 1 && choiceIndex <= choiceCount) {
                    e.preventDefault();
                    this.elements.choices.children[choiceIndex - 1].click();
                }
            }
        });
    },
    async start(quizType) {
        this.state.quizType = quizType;
        this.elements.quizSelectionScreen.classList.add('hidden');
        this.showLoader(true);
        if (!this.state.app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록 동기화 중...";
            await this.waitForWordList();
        }
        this.elements.loaderText.textContent = "퀴즈 준비 중...";
        await this.fetchQuizBatch(2);
        this.displayNextQuiz();
    },
    async waitForWordList() {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if(this.state.app.state.isWordListReady) { clearInterval(interval); resolve(); }
            }, 100);
        });
    },
    reset() {
        this.state.quizBatch = [];
        this.state.isFetching = false;
        this.state.isFinished = false;
        this.state.allWordsLearned = false;
        this.state.quizType = null;
        this.elements.quizSelectionScreen.classList.remove('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.add('hidden');
    },
    async fetchQuizBatch(batchSize) {
        if (this.state.isFetching || this.state.isFinished) return;
        this.state.isFetching = true;
        const excludeWords = this.state.quizBatch.map(q => q.question.word).join(',');
        try {
            const data = await api.fetchFromGoogleSheet('getQuizBatch', { quizType: this.state.quizType, batchSize, excludeWords });
            if (data.quizzes && data.quizzes.length > 0) this.state.quizBatch.push(...data.quizzes);
            else if (this.state.quizBatch.length === 0) {
                this.state.isFinished = true;
                this.state.allWordsLearned = data.allWordsLearned;
            }
        } catch (error) {
            console.error("퀴즈 묶음 가져오기 실패:", error);
            this.showError(error.message);
        } finally {
            this.state.isFetching = false;
        }
    },
    showError(message) {
        const loaderIcon = this.elements.loader.querySelector('.loader');
        if (loaderIcon) loaderIcon.style.display = 'none';
        this.elements.loaderText.innerHTML = `<p class="text-red-500 font-bold">퀴즈를 가져올 수 없습니다.</p><p class="text-sm text-gray-600 mt-2 break-all">${message}</p>`;
    },
    displayNextQuiz() {
        if (this.state.quizBatch.length <= 2 && !this.state.isFetching && !this.state.isFinished) {
            this.fetchQuizBatch(10);
        }

        if (this.state.quizBatch.length === 0) {
            if (this.state.isFinished) this.showFinishedScreen();
            else {
                this.showLoader(true, "다음 퀴즈를 불러오는 중...");
                setTimeout(() => {
                    if (this.state.quizBatch.length > 0) this.displayNextQuiz();
                    else { this.state.isFinished = true; this.showFinishedScreen(); }
                }, 1500);
            }
            return;
        }
        
        this.state.currentQuiz = this.state.quizBatch.shift();
        this.showLoader(false);
        this.renderQuiz(this.state.currentQuiz);
    },
    renderQuiz(quizData) {
        const { type, question, choices } = quizData;
        const questionDisplay = this.elements.questionDisplay;
        questionDisplay.innerHTML = '';
        questionDisplay.className = 'bg-green-100 p-4 rounded-lg mb-4 flex min-h-[100px]'; // Reset classes

        if (type === 'FILL_IN_THE_BLANK') {
            const p = document.createElement('p');
            p.className = 'text-xl sm:text-2xl text-left text-gray-800 leading-relaxed quiz-sentence-indent';
            ui.renderInteractiveText(p, question.sentence_with_blank.replace(/＿＿＿＿/g, '<span class="font-bold">＿＿＿＿</span>'));
            questionDisplay.appendChild(p);
        } else if (type === 'MULTIPLE_CHOICE_MEANING') {
            questionDisplay.classList.add('justify-center', 'items-center');
            questionDisplay.innerHTML = `<h1 class="text-3xl sm:text-4xl font-bold text-center text-gray-800 cursor-pointer">${question.word}</h1>`;
            const wordEl = questionDisplay.querySelector('h1');
            wordEl.addEventListener('click', () => { api.speak(question.word, 'word'); ui.copyToClipboard(question.word); });
            ui.adjustFontSize(wordEl);
        } else if (type === 'MULTIPLE_CHOICE_DEFINITION') {
            ui.displaySentences([question.definition], questionDisplay);
            const sentenceElement = questionDisplay.querySelector('.sample-sentence');
            if(sentenceElement){
                sentenceElement.classList.add('text-lg', 'sm:text-xl', 'text-left', 'text-gray-800', 'leading-relaxed');
                sentenceElement.classList.remove('p-2', 'hover:bg-gray-200');
            }
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
            const correctAnswerEl = Array.from(this.elements.choices.children).find(li => li.textContent.includes(this.state.currentQuiz.answer));
            correctAnswerEl?.classList.add('correct');
        }
        
        const word = this.state.currentQuiz.question.word;
        api.updateSRSData(word, isCorrect, this.state.quizType);
        
        setTimeout(() => this.displayNextQuiz(), 1000);
    },
    showLoader(isLoading, message = '퀴즈를 준비 중입니다...') {
        this.elements.loader.classList.toggle('hidden', !isLoading);
        this.elements.loaderText.textContent = message;
        this.elements.quizSelectionScreen.classList.add('hidden');
        this.elements.contentContainer.classList.toggle('hidden', isLoading);
        this.elements.finishedScreen.classList.add('hidden');
    },
    showFinishedScreen() {
        this.showLoader(false);
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.remove('hidden');
        this.elements.finishedMessage.innerHTML = this.state.allWordsLearned
            ? "축하합니다!<br>모든 단어 학습을 완료했습니다!"
            : "풀 수 있는 퀴즈를 모두 완료했습니다.<br>새로운 단어를 학습하거나 내일 다시 도전해 주세요.";
    },
};
