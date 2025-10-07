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
        translateDebounceTimeout: null, 
        wordList: [],
        isWordListReady: false,
        longPressTimer: null,
    },
    elements: {
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
    },
    async init() {
        try {
            await audioCache.init();
            await translationDBCache.init();
        } catch (e) {
            console.error("캐시를 초기화할 수 없습니다.", e);
        }
        this.bindGlobalEvents();
        api.loadWordList();
        quizMode.init();
        learningMode.init();
        dashboard.init();

        const initialMode = window.location.hash.replace('#', '') || 'selection';
        history.replaceState({ mode: initialMode, options: {} }, '', window.location.href);
        this._renderMode(initialMode);
    },
    bindGlobalEvents() {
        document.getElementById('select-quiz-btn').addEventListener('click', () => this.navigateTo('quiz'));
        document.getElementById('select-learning-btn').addEventListener('click', () => this.navigateTo('learning'));
        document.getElementById('select-dashboard-btn').addEventListener('click', () => this.navigateTo('dashboard'));
        document.getElementById('select-mistakes-btn').addEventListener('click', () => this.navigateTo('mistakeReview'));

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
        this.elements.refreshBtn.classList.add('hidden');
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
            this.elements.refreshBtn.classList.remove('hidden');
            this.elements.learningModeContainer.classList.remove('hidden');
            learningMode.elements.appContainer.classList.add('hidden');
            learningMode.elements.loader.classList.add('hidden');
            learningMode.elements.startScreen.classList.remove('hidden');
            if (options.suggestions && options.title) {
                learningMode.displaySuggestions(options.suggestions, options.title);
            } else {
                learningMode.resetStartScreen();
            }
        } else if (mode === 'dashboard') {
            this.elements.homeBtn.classList.remove('hidden');
            this.elements.dashboardContainer.classList.remove('hidden');
            dashboard.show();
        } else if (mode === 'mistakeReview') {
            const mistakeWords = mistakeLog.get();
            if (mistakeWords.length === 0) {
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
        const isLearningStartScreen = !learningMode.elements.startScreen.classList.contains('hidden');
        const isSelectionScreen = !this.elements.selectionScreen.classList.contains('hidden');

        if (!isLearningStartScreen && !isSelectionScreen) {
            this.showToast('새로고침은 시작 또는 학습 모드 선택 화면에서만 가능합니다.', true);
            return;
        }
        
        const elementsToDisable = [
            learningMode.elements.startWordInput,
            learningMode.elements.startBtn,
            this.elements.homeBtn,
            this.elements.ttsToggleBtn,
            this.elements.refreshBtn,
        ];
        const sheetLink = this.elements.sheetLink;
        elementsToDisable.forEach(el => { if(el) el.disabled = true; });
        sheetLink.classList.add('pointer-events-none', 'opacity-50');
        const originalBtnText = learningMode.elements.startBtn.textContent;
        learningMode.elements.startBtn.textContent = '새로고침 중...';

        try {
            await api.loadWordList(true);
            this.showToast('데이터를 성공적으로 새로고침했습니다!');
        } catch(e) {
            this.showToast('데이터 새로고침에 실패했습니다: ' + e.message, true);
        } finally {
            elementsToDisable.forEach(el => { if(el) el.disabled = false; });
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
        const explanationMatches = wordList
            .map((item, index) => ({ word: item.word, index }))
            .filter((_, index) => 
                wordList[index].explanation && 
                wordList[index].explanation.toLowerCase().includes(lowerCaseWord)
            );
        if (explanationMatches.length > 0) {
            const title = `'<strong>${word}</strong>'(이)가 설명에 포함된 단어입니다.`;
            this.navigateTo('learning', { suggestions: explanationMatches, title: title });
            ui.hideWordContextMenu();
            return;
        }
        const levenshteinSuggestions = wordList.map((item, index) => ({
            word: item.word,
            index,
            distance: utils.levenshteinDistance(lowerCaseWord, item.word.toLowerCase())
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5);
        const title = `입력하신 단어를 찾을 수 없습니다.<br>혹시 이 단어를 찾으시나요?`;
        this.navigateTo('learning', { suggestions: levenshteinSuggestions, title: title });
        ui.hideWordContextMenu();
    },
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

const translationDBCache = {
    db: null, dbName: 'translationCacheDB', storeName: 'translationStore',
    init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) { console.warn('IndexedDB not supported, translation caching disabled.'); return resolve(); }
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains(this.storeName)) { db.createObjectStore(this.storeName); } };
            request.onsuccess = event => { this.db = event.target.result; resolve(); };
            request.onerror = event => { console.error("IndexedDB error:", event.target.error); reject(event.target.error); };
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

const mistakeLog = {
    KEY: 'mistakeLog',
    get() {
        return JSON.parse(localStorage.getItem(this.KEY)) || [];
    },
    add(word) {
        const mistakes = this.get();
        if (!mistakes.includes(word)) {
            mistakes.push(word);
            localStorage.setItem(this.KEY, JSON.stringify(mistakes));
            app.showToast('오답 노트에 추가되었습니다.');
        }
    },
    remove(word) {
        let mistakes = this.get();
        const index = mistakes.indexOf(word);
        if (index > -1) {
            mistakes.splice(index, 1);
            localStorage.setItem(this.KEY, JSON.stringify(mistakes));
        }
    },
    clear() {
        localStorage.removeItem(this.KEY);
    }
};

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
        try {
            const cachedTranslation = await translationDBCache.get(text);
            if (cachedTranslation) return cachedTranslation;
            const data = await this.fetchFromGoogleSheet('translateText', { text });
            if (data.success) {
                translationDBCache.save(text, data.translatedText);
                return data.translatedText;
            }
            return '번역 실패';
        } catch (error) {
            console.error('Translation fetch error:', error);
            return '번역 오류';
        }
    },
    async updateSRSData(word, isCorrect) {
        try {
            await this.fetchFromGoogleSheet('updateSRSData', { word, isCorrect });
        } catch (error) {
            console.error('SRS 데이터 업데이트 실패:', error);
            app.showToast('학습 상태 업데이트에 실패했습니다.', true);
        }
    }
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
                    span.className = 'cursor-pointer hover:bg-yellow-200 p-1 rounded-sm transition-colors interactive-word';

                    span.onclick = () => {
                        clearTimeout(app.state.longPressTimer);
                        api.speak(englishPhrase, 'word');
                        this.copyToClipboard(englishPhrase);
                    };

                    span.oncontextmenu = (e) => {
                        e.preventDefault();
                        this.showWordContextMenu(e, englishPhrase);
                    };

                    let touchMove = false;
                    span.addEventListener('touchstart', (e) => {
                        touchMove = false;
                        clearTimeout(app.state.longPressTimer);
                        app.state.longPressTimer = setTimeout(() => {
                            if (!touchMove) {
                                this.showWordContextMenu(e, englishPhrase);
                            }
                        }, 700);
                    });
                    span.addEventListener('touchmove', () => {
                        touchMove = true;
                        clearTimeout(app.state.longPressTimer);
                    });
                    span.addEventListener('touchend', () => {
                        clearTimeout(app.state.longPressTimer);
                    });
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
            const targetRect = event.target.getBoundingClientRect();

            Object.assign(tooltip.style, {
                left: `${targetRect.left + window.scrollX}px`,
                top: `${targetRect.bottom + window.scrollY + 5}px`
            });

            tooltip.textContent = '번역 중...';
            tooltip.classList.remove('hidden');
            const translatedText = await api.translateText(sentence);
            tooltip.textContent = translatedText;
        }, 1000); 
    },
    handleSentenceMouseOut() {
        clearTimeout(app.state.translateDebounceTimeout);
        app.elements.translationTooltip.classList.add('hidden');
    },
    displaySentences(sentences, containerElement) {
        containerElement.innerHTML = '';
        sentences.filter(s => s.trim()).forEach(sentence => {
            const p = document.createElement('p');
            p.className = 'p-2 rounded transition-colors cursor-pointer hover:bg-gray-200 sample-sentence';

            p.onclick = () => api.speak(p.textContent, 'sample');
            p.addEventListener('mouseover', (e) => {
                if (e.target.classList.contains('interactive-word')) {
                    this.handleSentenceMouseOut();
                    return;
                }
                this.handleSentenceMouseOver(e, p.textContent);
            });
            p.addEventListener('mouseout', this.handleSentenceMouseOut);

            const processTextInto = (targetElement, text) => {
                const parts = text.split(/([,\s\.'])/g).filter(part => part);

                parts.forEach(part => {
                    if (/[a-zA-Z]/.test(part)) {
                        const span = document.createElement('span');
                        span.textContent = part;
                        span.className = 'hover:bg-yellow-200 rounded-sm transition-colors interactive-word';
                        
                        span.onclick = (e) => { 
                            e.stopPropagation(); 
                            clearTimeout(app.state.longPressTimer); 
                            api.speak(part, 'word'); 
                            this.copyToClipboard(part); 
                        };
                        
                        span.oncontextmenu = (e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            this.showWordContextMenu(e, part); 
                        };
                        
                        let touchMove = false;
                        span.addEventListener('touchstart', (e) => { 
                            e.stopPropagation(); 
                            touchMove = false; 
                            clearTimeout(app.state.longPressTimer); 
                            app.state.longPressTimer = setTimeout(() => { 
                                if (!touchMove) { this.showWordContextMenu(e, part); } 
                            }, 700); 
                        }, { passive: true });
                        span.addEventListener('touchmove', (e) => { e.stopPropagation(); touchMove = true; clearTimeout(app.state.longPressTimer); });
                        span.addEventListener('touchend', (e) => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); });
                        
                        targetElement.appendChild(span);
                    } else {
                        targetElement.appendChild(document.createTextNode(part));
                    }
                });
            };

            const sentenceParts = sentence.split(/(\*.*?\*)/g);
            sentenceParts.forEach(part => {
                if (part.startsWith('*') && part.endsWith('*')) {
                    const strong = document.createElement('strong');
                    processTextInto(strong, part.slice(1, -1));
                    p.appendChild(strong);
                } else if (part) {
                    processTextInto(p, part);
                }
            });

            containerElement.appendChild(p);
        });
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

        app.elements.searchAppContextBtn.onclick = () => {
            app.searchWordInLearningMode(word);
        };
        
        app.elements.searchDaumContextBtn.onclick = () => {
            window.open(`https://dic.daum.net/search.do?q=${encodedWord}`, 'daum_dictionary_window');
            this.hideWordContextMenu();
        };
        
        app.elements.searchNaverContextBtn.onclick = () => {
            window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`, 'naver_dictionary_window');
            this.hideWordContextMenu();
        };

        app.elements.searchEtymContextBtn.onclick = () => {
            window.open(`https://www.etymonline.com/search?q=${encodedWord}`, 'etymonline_window');
            this.hideWordContextMenu();
        };

        app.elements.searchLongmanContextBtn.onclick = () => {
            window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`, 'longman_dictionary_window');
            this.hideWordContextMenu();
        };
    },
    hideWordContextMenu() {
        app.elements.wordContextMenu.classList.add('hidden');
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
    }
};

const dashboard = {
    elements: {
        container: document.getElementById('dashboard-container'),
        content: document.getElementById('dashboard-content'),
    },
    init() {},
    async show() {
        if (!app.state.isWordListReady) {
            this.elements.content.innerHTML = `<div class="text-center p-10"><div class="loader mx-auto"></div><p class="mt-4 text-gray-600">단어 목록을 동기화하는 중...</p></div>`;
            await quizMode.waitForWordList();
        }
        this.render();
    },
    render() {
        const wordList = app.state.wordList;
        const totalWords = wordList.length;

        const srsLevels = [
            { name: '새 단어 (New)', min: 0, max: 0, count: 0, color: 'bg-gray-400' },
            { name: '학습 중 (Learning)', min: 1, max: 1, count: 0, color: 'bg-blue-500' },
            { name: '익숙함 (Familiar)', min: 2, max: 2, count: 0, color: 'bg-green-500' },
            { name: '암기 완료 (Mastered)', min: 3, max: Infinity, count: 0, color: 'bg-purple-600' }
        ];

        wordList.forEach(word => {
            const level = word.srsLevel || 0;
            const category = srsLevels.find(cat => level >= cat.min && level <= cat.max);
            if (category) category.count++;
        });

        let contentHTML = `
            <div class="bg-gray-50 p-4 rounded-lg shadow-inner text-center">
                <p class="text-lg text-gray-600">총 단어 수</p>
                <p class="text-4xl font-bold text-gray-800">${totalWords}</p>
            </div>
            <div>
                <h2 class="text-xl font-bold text-gray-700 mb-3 text-center">학습 단계별 분포</h2>
                <div class="space-y-4">
        `;

        srsLevels.forEach(level => {
            const percentage = totalWords > 0 ? ((level.count / totalWords) * 100).toFixed(1) : 0;
            contentHTML += `
                <div class="w-full">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-base font-semibold text-gray-700">${level.name}</span>
                        <span class="text-sm font-medium text-gray-500">${level.count}개 (${percentage}%)</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-4">
                        <div class="${level.color} h-4 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });

        contentHTML += `</div></div>`;
        this.elements.content.innerHTML = contentHTML;
    }
};


const quizMode = {
    state: {
        currentQuiz: {},
        quizBatch: [],
        isFetching: false,
        isFinished: false,
    },
    elements: {},
    init() {
        this.elements = {
            quizSelectionScreen: document.getElementById('quiz-selection-screen'),
            startMeaningQuizBtn: document.getElementById('start-meaning-quiz-btn'),
            startBlankQuizBtn: document.getElementById('start-blank-quiz-btn'),
            loader: document.getElementById('quiz-loader'),
            loaderText: document.getElementById('quiz-loader-text'),
            contentContainer: document.getElementById('quiz-content-container'),
            cardFront: document.getElementById('quiz-card-front'),
            questionDisplay: document.getElementById('quiz-question-display'),
            choices: document.getElementById('quiz-choices'),
            finishedScreen: document.getElementById('quiz-finished-screen'),
            finishedMessage: document.getElementById('quiz-finished-message')
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startMeaningQuizBtn.addEventListener('click', () => this.start('MULTIPLE_CHOICE_MEANING'));
        this.elements.startBlankQuizBtn.addEventListener('click', () => this.start('FILL_IN_THE_BLANK'));
        
        document.addEventListener('keydown', (e) => {
            const isQuizModeActive = !this.elements.contentContainer.classList.contains('hidden') && !this.elements.choices.classList.contains('disabled');
            if (!isQuizModeActive) return;
            // Allow numbers 1-4 for choices, key "0" or "p" for PASS
            if (e.key.toLowerCase() === 'p' || e.key === '0') {
                 e.preventDefault();
                 const passButton = this.elements.choices.children[0];
                 if(passButton) passButton.click();
            } else {
                const choiceIndex = parseInt(e.key); // 1-based index
                if (choiceIndex >= 1 && choiceIndex <= 4 && this.elements.choices.children[choiceIndex]) {
                    e.preventDefault();
                    this.elements.choices.children[choiceIndex].click();
                }
            }
        });
    },
    async start(quizType) {
        this.elements.quizSelectionScreen.classList.add('hidden');
        this.showLoader(true);
        if (!app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
            await this.waitForWordList();
        }
        await this.fetchQuizBatch(quizType);
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
        this.elements.quizSelectionScreen.classList.remove('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.add('hidden');
    },
    async fetchQuizBatch(quizType) {
        if (this.state.isFetching || this.state.isFinished) return;
        this.state.isFetching = true;
        try {
            const data = await api.fetchFromGoogleSheet('getQuiz', { quizType });
            if (data.finished) {
                this.state.isFinished = true;
                if (this.state.quizBatch.length === 0) {
                    this.showFinishedScreen(data.message || "오늘 복습할 단어를 모두 학습했습니다!");
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
            this.fetchQuizBatch(this.state.currentQuiz.type); // Fetch more of the same type
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
        this.renderQuiz(nextQuiz);
    },
    renderQuiz(quizData) {
        this.elements.cardFront.classList.remove('hidden');
        
        const { type, question, choices, answer } = quizData;
        const questionDisplay = this.elements.questionDisplay;
        questionDisplay.innerHTML = '';

        if (type === 'FILL_IN_THE_BLANK') {
            const sentence = question.sentence_with_blank;
            const p = document.createElement('p');
            p.className = 'text-xl sm:text-2xl text-left text-gray-800 leading-relaxed';
            let processedText = sentence.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
            processedText = processedText.replace(/＿＿＿＿/g, '<span style="white-space: nowrap;">＿＿＿＿</span>');
            p.innerHTML = processedText.replace(/\n/g, '<br>');
            questionDisplay.appendChild(p);
        } else { // MULTIPLE_CHOICE_MEANING
            questionDisplay.innerHTML = `<h1 class="text-3xl sm:text-4xl font-bold text-center text-gray-800" title="클릭하여 발음 듣기 및 복사">${question.word}</h1>`;
            const wordEl = questionDisplay.querySelector('h1');
            wordEl.addEventListener('click', () => {
                api.speak(question.word, 'word');
                ui.copyToClipboard(question.word);
            });
            ui.adjustFontSize(wordEl);
        }

        this.elements.choices.innerHTML = '';

        // "PASS" 버튼 생성
        const passLi = document.createElement('li');
        passLi.className = 'choice-item border-2 border-red-500 bg-red-500 hover:bg-red-600 text-white p-4 rounded-lg cursor-pointer flex items-center justify-center transition-all font-bold text-lg';
        passLi.innerHTML = `<span>PASS</span>`;
        passLi.onclick = () => this.checkAnswer(passLi, 'USER_PASSED', answer); // "USER_PASSED"는 정답과 절대 같을 수 없는 임의의 값
        this.elements.choices.appendChild(passLi);
        
        // 선택지 버튼들 생성
        choices.forEach((choice, index) => {
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer flex items-start transition-all';
            li.innerHTML = `<span class="font-bold mr-3">${index + 1}.</span> <span>${choice}</span>`;
            li.onclick = () => this.checkAnswer(li, choice, answer);
            this.elements.choices.appendChild(li);
        });

        this.elements.choices.classList.remove('disabled');
    },
    checkAnswer(selectedLi, selectedChoice, correctAnswer) {
        this.elements.choices.classList.add('disabled');
        
        const isCorrect = selectedChoice === correctAnswer;
        selectedLi.classList.add(isCorrect ? 'correct' : 'incorrect');
        
        const word = this.state.currentQuiz.question.word_info.word;
        api.updateSRSData(word, isCorrect);

        if (!isCorrect) {
            mistakeLog.add(word);
            // 오답일 경우 정답 선택지를 찾아서 표시
            const correctAnswerEl = Array.from(this.elements.choices.children).find(li => {
                const choiceSpan = li.querySelector('span:last-child');
                return choiceSpan && choiceSpan.textContent === correctAnswer;
            });
            correctAnswerEl?.classList.add('correct');
        } else {
            mistakeLog.remove(word);
        }
        
        setTimeout(() => this.displayNextQuiz(), 1500);
    },
    showLoader(isLoading) {
        this.elements.loader.classList.toggle('hidden', !isLoading);
        this.elements.quizSelectionScreen.classList.add('hidden');
        this.elements.contentContainer.classList.toggle('hidden', isLoading);
        this.elements.finishedScreen.classList.add('hidden');
    },
    showFinishedScreen(message) {
        this.showLoader(false);
        this.elements.contentContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.remove('hidden');
        this.elements.finishedMessage.textContent = message;
    },
};

const learningMode = {
    state: {
        currentIndex: 0,
        touchstartX: 0,
        touchstartY: 0,
        lastWheelTime: 0,
        isMistakeMode: false,
        currentWordList: [],
    },
    elements: {},
    init() {
        this.elements = {
            startScreen: document.getElementById('learning-start-screen'),
            startInputContainer: document.getElementById('learning-start-input-container'),
            startWordInput: document.getElementById('learning-start-word-input'),
            startBtn: document.getElementById('learning-start-btn'),
            suggestionsContainer: document.getElementById('learning-suggestions-container'),
            suggestionsTitle: document.getElementById('learning-suggestions-title'),
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
            clearTimeout(app.state.longPressTimer);
            app.state.longPressTimer = setTimeout(() => {
                const wordData = this.state.currentWordList[this.state.currentIndex];
                if (!wordDisplayTouchMove && wordData) {
                    ui.showWordContextMenu(e, wordData.word, { hideAppSearch: true });
                }
            }, 700);
        }, { passive: true });
        this.elements.wordDisplay.addEventListener('touchmove', () => {
            wordDisplayTouchMove = true;
            clearTimeout(app.state.longPressTimer);
        });
        this.elements.wordDisplay.addEventListener('touchend', () => {
            clearTimeout(app.state.longPressTimer);
        });

        document.addEventListener('mousedown', this.handleMiddleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    },
    async start() {
        this.state.isMistakeMode = false;
        this.state.currentWordList = app.state.wordList;

        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        if (!app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록을 동기화하는 중...";
            await this.waitForWordList();
        }
        const startWord = this.elements.startWordInput.value.trim();
        const wordList = this.state.currentWordList;
        if (wordList.length === 0) {
            this.showError("학습할 단어가 없습니다.");
            return;
        }
    
        if (!startWord) {
            this.state.currentIndex = 0;
            this.launchApp();
            return;
        }
    
        const lowerCaseStartWord = startWord.toLowerCase();
    
        const exactMatchIndex = wordList.findIndex(item => item.word.toLowerCase() === lowerCaseStartWord);
        if (exactMatchIndex !== -1) {
            this.state.currentIndex = exactMatchIndex;
            this.launchApp();
            return;
        }
    
        const explanationMatches = wordList
            .map((item, index) => ({ word: item.word, index }))
            .filter((_, index) => 
                wordList[index].explanation && 
                wordList[index].explanation.toLowerCase().includes(lowerCaseStartWord)
            );
    
        if (explanationMatches.length > 0) {
            const title = `'<strong>${startWord}</strong>'(이)가 설명에 포함된 단어입니다.`;
            this.displaySuggestions(explanationMatches, title);
            return;
        }
    
        const levenshteinSuggestions = wordList.map((item, index) => ({
            word: item.word,
            index,
            distance: utils.levenshteinDistance(lowerCaseStartWord, item.word.toLowerCase())
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 5)
        .filter(s => s.distance < s.word.length / 2 + 1);
    
        if (levenshteinSuggestions.length > 0) {
            const title = `입력하신 단어를 찾을 수 없습니다.<br>혹시 이 단어를 찾으시나요?`;
            this.displaySuggestions(levenshteinSuggestions, title);
        } else {
            const title = `'<strong>${startWord}</strong>'에 대한 검색 결과가 없습니다.`;
            this.displaySuggestions([], title);
        }
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
    displaySuggestions(suggestions, title) {
        this.elements.loader.classList.add('hidden');
        this.elements.startScreen.classList.remove('hidden');
        this.elements.startInputContainer.classList.add('hidden');
        
        this.elements.suggestionsTitle.innerHTML = title;
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
        const wordData = this.state.currentWordList[index];
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
    async startMistakeReview(mistakeWords) {
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        if (!app.state.isWordListReady) {
            this.elements.loaderText.textContent = "단어 목록 동기화 중...";
            await this.waitForWordList();
        }
        
        this.state.isMistakeMode = true;
        this.state.currentWordList = app.state.wordList.filter(wordObj => mistakeWords.includes(wordObj.word));
        this.state.currentIndex = 0;
        
        if (this.state.currentWordList.length === 0) {
            this.showError("오답 노트를 불러올 수 없습니다.");
            setTimeout(() => app.navigateTo('selection'), 2000);
            return;
        }
        
        this.launchApp();
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
        if (e.target.closest('#word-display')) return;
        this.state.touchstartX = e.changedTouches[0].screenX;
        this.state.touchstartY = e.changedTouches[0].screenY;
    },
    handleTouchEnd(e) {
        if (!this.isLearningModeActive() || this.state.touchstartX === 0) return;
        if (e.target.closest('button, a, input, [onclick], .interactive-word')) {
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


