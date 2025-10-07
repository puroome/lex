// ================================================================
// App Main Controller
// ================================================================
const app = {
    config: {
        TTS_API_KEY: "AIzaSyAJmQBGY4H9DVMlhMtvAAVMi_4N7__DfKA",
        SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxtkBmzSHFOOwIOrjkbxXsHAKIBkimjuUjVOWEoUEi0vgxKclHlo4PTGnSTUSF29Ydg/exec",
        // SRS Level 8 is considered "learned"
        SRS_LEVEL_LEARNED: 8,
        // SRS intervals in days for each level (0 to 7)
        SRS_INTERVALS: [0, 1, 2, 4, 8, 16, 30, 60] 
    },
    state: {
        currentVoiceSet: 'UK',
        isSpeaking: false,
        audioContext: null,
        translateDebounceTimeout: null,
        wordList: [],
        isWordListReady: false,
        longPressTimer: null,
        srsChartInstance: null,
    },
    elements: {
        selectionScreen: document.getElementById('selection-screen'),
        homeBtn: document.getElementById('home-btn'),
        refreshBtn: document.getElementById('refresh-btn'),
        ttsToggleBtn: document.getElementById('tts-toggle-btn'),
        ttsToggleText: document.getElementById('tts-toggle-text'),
        quizModeContainer: document.getElementById('quiz-mode-container'),
        learningModeContainer: document.getElementById('learning-mode-container'),
        statsScreen: document.getElementById('stats-screen'),
        notesScreen: document.getElementById('notes-screen'),
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
            console.error("캐시 초기화 실패.", e);
        }
        this.bindGlobalEvents();
        api.loadWordList(); 
        quizMode.init();
        learningMode.init();
        statsMode.init();
        notesMode.init();

        const initialMode = window.location.hash.replace('#', '') || 'selection';
        history.replaceState({ mode: initialMode, options: {} }, '', window.location.href);
        this._renderMode(initialMode);
    },
    bindGlobalEvents() {
        document.getElementById('select-learning-btn').addEventListener('click', () => this.navigateTo('learning'));
        document.getElementById('select-quiz-btn').addEventListener('click', () => this.navigateTo('quiz'));
        document.getElementById('select-stats-btn').addEventListener('click', () => this.navigateTo('stats'));
        document.getElementById('select-notes-btn').addEventListener('click', () => this.navigateTo('notes'));

        this.elements.homeBtn.addEventListener('click', () => this.navigateTo('selection'));
        this.elements.refreshBtn.addEventListener('click', () => this.forceReload());
        this.elements.ttsToggleBtn.addEventListener('click', this.toggleVoiceSet.bind(this));
        
        document.body.addEventListener('click', () => {
            if (!this.state.audioContext) {
                this.state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }, { once: true });
        
        document.addEventListener('click', (e) => {
            if (this.elements.wordContextMenu && !this.elements.wordContextMenu.contains(e.target)) {
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
        if (history.state?.mode === mode && JSON.stringify(history.state?.options) === JSON.stringify(options)) return;
        const newPath = mode === 'selection' ? window.location.pathname + window.location.search : `#${mode}`;
        history.pushState({ mode, options }, '', newPath);
        this._renderMode(mode, options);
    },
    _renderMode(mode, options = {}) {
        [this.elements.selectionScreen, this.elements.quizModeContainer, this.elements.learningModeContainer, this.elements.statsScreen, this.elements.notesScreen].forEach(el => el.classList.add('hidden'));
        [this.elements.homeBtn, this.elements.refreshBtn, this.elements.ttsToggleBtn].forEach(el => el.classList.add('hidden'));
        learningMode.elements.fixedButtons.classList.add('hidden');

        const showTopButtons = () => {
            this.elements.homeBtn.classList.remove('hidden');
            this.elements.ttsToggleBtn.classList.remove('hidden');
        };

        switch(mode) {
            case 'quiz':
                this.elements.quizModeContainer.classList.remove('hidden');
                showTopButtons();
                quizMode.start();
                break;
            case 'learning':
                this.elements.learningModeContainer.classList.remove('hidden');
                showTopButtons();
                this.elements.refreshBtn.classList.remove('hidden');
                learningMode.start(options);
                break;
            case 'stats':
                this.elements.statsScreen.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                statsMode.show();
                break;
            case 'notes':
                this.elements.notesScreen.classList.remove('hidden');
                this.elements.homeBtn.classList.remove('hidden');
                notesMode.show();
                break;
            default: // selection
                this.elements.selectionScreen.classList.remove('hidden');
                this.elements.refreshBtn.classList.remove('hidden');
                quizMode.reset();
                learningMode.reset();
                break;
        }
    },
    async forceReload() {
        this.showToast('데이터 새로고침 중...');
        try {
            await api.loadWordList(true); // force reload
            this.showToast('데이터를 성공적으로 새로고침했습니다!');
            // If in a mode that depends on wordList, refresh it
            if (history.state?.mode === 'stats') statsMode.show();
            if (history.state?.mode === 'notes') notesMode.show();
            if (history.state?.mode === 'quiz') quizMode.start();
        } catch(e) {
            this.showToast('데이터 새로고침에 실패했습니다: ' + e.message, true);
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
            this.navigateTo('learning', { startIndex: exactMatchIndex });
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

// ================================================================
// Audio & Translation Cache Modules (IndexedDB)
// ================================================================
const audioCache = {
    db: null, dbName: 'ttsAudioCacheDB', storeName: 'audioStore',
    init() { /* same as before */ }, getAudio(key) { /* same as before */ }, saveAudio(key, audioData) { /* same as before */ }
};
const translationDBCache = {
    db: null, dbName: 'translationCacheDB', storeName: 'translationStore',
    init() { /* same as before */ }, get(key) { /* same as before */ }, save(key, data) { /* same as before */ }
};
(async () => {
    try {
        // Implementations for audioCache
        audioCache.init = function() { return new Promise((resolve, reject) => { if (!('indexedDB' in window)) { console.warn('IndexedDB not supported'); return resolve(); } const request = indexedDB.open(this.dbName, 1); request.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName); }; request.onsuccess = e => { this.db = e.target.result; resolve(); }; request.onerror = e => { console.error("IndexedDB error:", e.target.error); reject(e.target.error); }; }); };
        audioCache.getAudio = function(key) { return new Promise((resolve, reject) => { if (!this.db) return resolve(null); const request = this.db.transaction([this.storeName], 'readonly').objectStore(this.storeName).get(key); request.onsuccess = () => resolve(request.result); request.onerror = e => { console.error("IndexedDB get error:", e.target.error); reject(e.target.error); }; }); };
        audioCache.saveAudio = function(key, audioData) { if (!this.db) return; try { this.db.transaction([this.storeName], 'readwrite').objectStore(this.storeName).put(audioData, key); } catch (e) { console.error("IndexedDB save error:", e); } };
        // Implementations for translationDBCache
        translationDBCache.init = function() { return new Promise((resolve, reject) => { if (!('indexedDB' in window)) { console.warn('IndexedDB not supported'); return resolve(); } const request = indexedDB.open(this.dbName, 1); request.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName); }; request.onsuccess = e => { this.db = e.target.result; resolve(); }; request.onerror = e => { console.error("IndexedDB error:", e.target.error); reject(e.target.error); }; }); };
        translationDBCache.get = function(key) { return new Promise((resolve, reject) => { if (!this.db) return resolve(null); const request = this.db.transaction([this.storeName], 'readonly').objectStore(this.storeName).get(key); request.onsuccess = () => resolve(request.result); request.onerror = e => { console.error("IndexedDB get error:", e.target.error); reject(e.target.error); }; }); };
        translationDBCache.save = function(key, data) { if (!this.db) return; try { this.db.transaction([this.storeName], 'readwrite').objectStore(this.storeName).put(data, key); } catch (e) { console.error("IndexedDB save error:", e); } };
    } catch (e) { console.error("Failed to initialize cache modules:", e); }
})();


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
                    if (Date.now() - timestamp < 3600000) { // 1 hour cache
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
            throw error;
        }
    },
    async updateWordStats(word, isCorrect) {
        const wordObj = app.state.wordList.find(w => w.word === word);
        if (wordObj) {
            if (isCorrect) {
                wordObj.srsLevel = Math.min(app.config.SRS_LEVEL_LEARNED, wordObj.srsLevel + 1);
                wordObj.correctCount++;
            } else {
                wordObj.srsLevel = Math.max(0, wordObj.srsLevel - 1);
                wordObj.incorrectCount++;
            }
            wordObj.lastReviewed = new Date().toISOString();
             try {
                localStorage.setItem('wordListCache', JSON.stringify({ timestamp: Date.now(), words: app.state.wordList }));
            } catch (e) { console.error("스탯 업데이트 후 캐시 저장 실패:", e); }
        }

        try {
            const res = await this.fetchFromGoogleSheet('updateWordStats', { word, isCorrect: isCorrect.toString() });
            if (!res.success) throw new Error(res.message);
        } catch (error) {
            console.error(`'${word}' 상태 동기화 실패:`, error);
            app.showToast(`'${word}' 상태 동기화 실패`, true);
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
            console.error('TTS 재생 또는 캐싱 실패:', error);
            app.state.isSpeaking = false;
        }
    },
    async fetchFromGoogleSheet(action, params = {}) {
        const url = new URL(app.config.SCRIPT_URL);
        url.searchParams.append('action', action);
        for (const key in params) {
            if (params[key] !== undefined) {
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
            console.error('번역 fetch 오류:', error);
            return '번역 오류';
        }
    }
};

// ================================================================
// UI Module
// ================================================================
const ui = {
    adjustFontSize(element) { /* same as before */ },
    async copyToClipboard(text) { /* same as before */ },
    renderInteractiveText(targetElement, text) { /* same as before */ },
    handleSentenceMouseOver(event, sentence) { /* same as before */ },
    handleSentenceMouseOut() { /* same as before */ },
    displaySentences(sentences, containerElement) { /* same as before */ },
    showWordContextMenu(event, word, options = {}) { /* same as before */ },
    hideWordContextMenu() { /* same as before */ }
};
(async () => {
    try {
        ui.adjustFontSize = function(element) { element.style.fontSize = ''; let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize); const container = element.parentElement; const containerStyle = window.getComputedStyle(container); const containerWidth = container.clientWidth - parseFloat(containerStyle.paddingLeft) - parseFloat(containerStyle.paddingRight); const minFontSize = 16; while (element.scrollWidth > containerWidth && currentFontSize > minFontSize) { element.style.fontSize = `${--currentFontSize}px`; } };
        ui.copyToClipboard = async function(text) { if (navigator.clipboard) { try { await navigator.clipboard.writeText(text); } catch (err) { console.error('클립보드 복사 실패:', err); } } };
        ui.renderInteractiveText = function(targetElement, text) { targetElement.innerHTML = ''; if (!text || !text.trim()) return; const regex = /(\[.*?\])|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g; text.split('\n').forEach(line => { let lastIndex = 0; let match; while ((match = regex.exec(line))) { if (match.index > lastIndex) { targetElement.appendChild(document.createTextNode(line.substring(lastIndex, match.index))); } const [_, nonClickable, englishPhrase] = match; if (englishPhrase) { const span = document.createElement('span'); span.textContent = englishPhrase; span.className = 'cursor-pointer hover:bg-yellow-200 p-1 rounded-sm transition-colors interactive-word'; span.onclick = () => { clearTimeout(app.state.longPressTimer); api.speak(englishPhrase, 'word'); this.copyToClipboard(englishPhrase); }; span.oncontextmenu = (e) => { e.preventDefault(); this.showWordContextMenu(e, englishPhrase); }; let touchMove = false; span.addEventListener('touchstart', (e) => { touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) { this.showWordContextMenu(e, englishPhrase); } }, 700); }); span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); }); span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); }); targetElement.appendChild(span); } else if (nonClickable) { targetElement.appendChild(document.createTextNode(nonClickable)); } lastIndex = regex.lastIndex; } if (lastIndex < line.length) { targetElement.appendChild(document.createTextNode(line.substring(lastIndex))); } targetElement.appendChild(document.createElement('br')); }); if (targetElement.lastChild && targetElement.lastChild.tagName === 'BR') { targetElement.removeChild(targetElement.lastChild); } };
        ui.handleSentenceMouseOver = function(event, sentence) { clearTimeout(app.state.translateDebounceTimeout); app.state.translateDebounceTimeout = setTimeout(async () => { const tooltip = app.elements.translationTooltip; const targetRect = event.target.getBoundingClientRect(); Object.assign(tooltip.style, { left: `${targetRect.left + window.scrollX}px`, top: `${targetRect.bottom + window.scrollY + 5}px` }); tooltip.textContent = '번역 중...'; tooltip.classList.remove('hidden'); const translatedText = await api.translateText(sentence); tooltip.textContent = translatedText; }, 1000); };
        ui.handleSentenceMouseOut = function() { clearTimeout(app.state.translateDebounceTimeout); app.elements.translationTooltip.classList.add('hidden'); };
        ui.displaySentences = function(sentences, containerElement) { containerElement.innerHTML = ''; sentences.filter(s => s.trim()).forEach(sentence => { const p = document.createElement('p'); p.className = 'p-2 rounded transition-colors cursor-pointer hover:bg-gray-200 sample-sentence'; p.onclick = () => api.speak(p.textContent, 'sample'); p.addEventListener('mouseover', (e) => { if (e.target.classList.contains('interactive-word')) { this.handleSentenceMouseOut(); return; } this.handleSentenceMouseOver(e, p.textContent); }); p.addEventListener('mouseout', this.handleSentenceMouseOut); const processTextInto = (targetElement, text) => { const parts = text.split(/([,\s\.'])/g).filter(part => part); parts.forEach(part => { if (/[a-zA-Z]/.test(part)) { const span = document.createElement('span'); span.textContent = part; span.className = 'hover:bg-yellow-200 rounded-sm transition-colors interactive-word'; span.onclick = (e) => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); api.speak(part, 'word'); this.copyToClipboard(part); }; span.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); this.showWordContextMenu(e, part); }; let touchMove = false; span.addEventListener('touchstart', (e) => { e.stopPropagation(); touchMove = false; clearTimeout(app.state.longPressTimer); app.state.longPressTimer = setTimeout(() => { if (!touchMove) { this.showWordContextMenu(e, part); } }, 700); }, { passive: true }); span.addEventListener('touchmove', (e) => { e.stopPropagation(); touchMove = true; clearTimeout(app.state.longPressTimer); }); span.addEventListener('touchend', (e) => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); }); targetElement.appendChild(span); } else { targetElement.appendChild(document.createTextNode(part)); } }); }; const sentenceParts = sentence.split(/(\*.*?\*)/g); sentenceParts.forEach(part => { if (part.startsWith('*') && part.endsWith('*')) { const strong = document.createElement('strong'); processTextInto(strong, part.slice(1, -1)); p.appendChild(strong); } else if (part) { processTextInto(p, part); } }); containerElement.appendChild(p); }); };
        ui.showWordContextMenu = function(event, word, options = {}) { event.preventDefault(); const menu = app.elements.wordContextMenu; app.elements.searchAppContextBtn.style.display = options.hideAppSearch ? 'none' : 'block'; const touch = event.touches ? event.touches[0] : null; const x = touch ? touch.clientX : event.clientX; const y = touch ? touch.clientY : event.clientY; menu.style.top = `${y}px`; menu.style.left = `${x}px`; menu.classList.remove('hidden'); const encodedWord = encodeURIComponent(word); app.elements.searchAppContextBtn.onclick = () => { app.searchWordInLearningMode(word); }; app.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encodedWord}`, '_blank'); this.hideWordContextMenu(); }; app.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`, '_blank'); this.hideWordContextMenu(); }; app.elements.searchEtymContextBtn.onclick = () => { window.open(`https://www.etymonline.com/search?q=${encodedWord}`, '_blank'); this.hideWordContextMenu(); }; app.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`, '_blank'); this.hideWordContextMenu(); }; };
        ui.hideWordContextMenu = function() { app.elements.wordContextMenu.classList.add('hidden'); };
    } catch (e) { console.error("Failed to initialize UI module:", e); }
})();

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
    },
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
};

// ================================================================
// Quiz Mode Module
// ================================================================
const quizMode = {
    state: { currentQuiz: null, quizQueue: [], quizType: null },
    elements: {},
    init() {
        this.elements = {
            selectionScreen: document.getElementById('quiz-selection-screen'),
            wordCountInfo: document.getElementById('quiz-word-count-info'),
            startMeaningBtn: document.getElementById('start-meaning-quiz-btn'),
            startBlankBtn: document.getElementById('start-blank-quiz-btn'),
            loader: document.getElementById('quiz-loader'),
            loaderText: document.getElementById('quiz-loader-text'),
            meaningContainer: document.getElementById('meaning-quiz-container'),
            word: document.getElementById('quiz-word'),
            choices: document.getElementById('quiz-choices'),
            passBtn: document.getElementById('quiz-pass-btn'),
            blankContainer: document.getElementById('blank-quiz-container'),
            blankSentence: document.getElementById('blank-quiz-sentence'),
            blankInput: document.getElementById('blank-quiz-input'),
            blankFeedback: document.getElementById('blank-quiz-feedback'),
            blankPassBtn: document.getElementById('blank-quiz-pass-btn'),
            blankSubmitBtn: document.getElementById('blank-quiz-submit-btn'),
            finishedScreen: document.getElementById('quiz-finished-screen'),
            finishedMessage: document.getElementById('quiz-finished-message'),
        };
        this.bindEvents();
    },
    bindEvents() {
        this.elements.startMeaningBtn.addEventListener('click', () => this.startQuiz('meaning'));
        this.elements.startBlankBtn.addEventListener('click', () => this.startQuiz('blank'));
        this.elements.passBtn.addEventListener('click', () => this.handlePass());
        this.elements.blankPassBtn.addEventListener('click', () => this.handlePass());
        this.elements.blankSubmitBtn.addEventListener('click', () => this.checkBlankAnswer());
        this.elements.blankInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.checkBlankAnswer(); });
        this.elements.word.addEventListener('click', () => { if(this.state.currentQuiz) api.speak(this.state.currentQuiz.word, 'word'); });
    },
    async start() {
        this.reset();
        if (!app.state.isWordListReady) {
            this.elements.loader.classList.remove('hidden');
            await this.waitForWordList();
            this.elements.loader.classList.add('hidden');
        }
        this.prepareReviewQueue();
        this.elements.selectionScreen.classList.remove('hidden');
    },
    async waitForWordList() { return new Promise(resolve => { const i = setInterval(() => { if (app.state.isWordListReady) { clearInterval(i); resolve(); } }, 100); }); },
    reset() {
        this.state.quizQueue = [];
        this.state.quizType = null;
        this.elements.selectionScreen.classList.add('hidden');
        this.elements.meaningContainer.classList.add('hidden');
        this.elements.blankContainer.classList.add('hidden');
        this.elements.finishedScreen.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
    },
    prepareReviewQueue() {
        const now = new Date();
        const wordsForReview = app.state.wordList.filter(word => {
            if (word.srsLevel >= app.config.SRS_LEVEL_LEARNED) return false;
            if (!word.lastReviewed) return true;
            const lastReviewedDate = new Date(word.lastReviewed);
            const intervalDays = app.config.SRS_INTERVALS[word.srsLevel];
            const dueDate = new Date(lastReviewedDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);
            return now >= dueDate;
        });
        this.elements.wordCountInfo.textContent = `오늘 복습할 단어: ${wordsForReview.length}개`;
        this.state.quizQueue = utils.shuffleArray(wordsForReview);
        this.elements.startBlankBtn.disabled = !wordsForReview.some(w => w.sample);
    },
    startQuiz(type) {
        this.state.quizType = type;
        this.elements.selectionScreen.classList.add('hidden');
        if (this.state.quizQueue.length === 0) {
            this.showFinishedScreen("오늘 복습할 단어가 없습니다!");
            return;
        }
        if (type === 'blank' && !this.state.quizQueue.some(w => w.sample)) {
            this.showFinishedScreen("예문이 있는 복습 단어가 없습니다!");
            return;
        }
        this.displayNextQuiz();
    },
    displayNextQuiz() {
        if (this.state.quizQueue.length === 0) {
            this.showFinishedScreen("오늘의 퀴즈를 모두 완료했습니다!");
            return;
        }
        let nextWord = this.state.quizQueue.shift();
        if(this.state.quizType === 'blank' && !nextWord.sample) {
            // 예문 없는 단어는 통과 처리하고 다음 문제로
            api.updateWordStats(nextWord.word, true);
            this.displayNextQuiz();
            return;
        }
        this.state.currentQuiz = nextWord;
        this.state.quizType === 'meaning' ? this.renderMeaningQuiz() : this.renderBlankQuiz();
    },
    renderMeaningQuiz() {
        this.elements.meaningContainer.classList.remove('hidden');
        this.elements.word.textContent = this.state.currentQuiz.word;
        ui.adjustFontSize(this.elements.word);
        
        const correctAnswer = this.state.currentQuiz.meaning;
        const wrongAnswers = utils.shuffleArray(app.state.wordList.filter(w => w.meaning !== correctAnswer)).slice(0, 3).map(w => w.meaning);
        const choices = utils.shuffleArray([correctAnswer, ...wrongAnswers]);
        
        this.elements.choices.innerHTML = '';
        choices.forEach(choice => {
            const li = document.createElement('li');
            li.className = 'choice-item border-2 border-gray-300 p-4 rounded-lg cursor-pointer transition-all';
            li.textContent = choice;
            li.onclick = () => this.checkMeaningAnswer(li, choice === correctAnswer);
            this.elements.choices.appendChild(li);
        });
    },
    renderBlankQuiz() {
        this.elements.blankContainer.classList.remove('hidden');
        this.elements.blankInput.value = '';
        this.elements.blankFeedback.innerHTML = '';
        this.elements.blankInput.disabled = false;
        this.elements.blankSubmitBtn.disabled = false;
        
        const sentence = this.state.currentQuiz.sample.split('\n')[0]; // Use first line of sample
        const wordToBlank = this.state.currentQuiz.word;
        const blankedSentence = sentence.replace(new RegExp(`\\b${wordToBlank}\\b`, 'gi'), `<span class="blank">${'_'.repeat(wordToBlank.length)}</span>`);
        this.elements.blankSentence.innerHTML = blankedSentence;
        this.elements.blankInput.focus();
    },
    checkMeaningAnswer(li, isCorrect) {
        this.elements.choices.classList.add('disabled');
        li.classList.add(isCorrect ? 'correct' : 'incorrect');
        if (!isCorrect) {
            const correctLi = Array.from(this.elements.choices.children).find(el => el.textContent === this.state.currentQuiz.meaning);
            correctLi?.classList.add('correct');
        }
        api.updateWordStats(this.state.currentQuiz.word, isCorrect);
        setTimeout(() => {
            this.elements.meaningContainer.classList.add('hidden');
            this.elements.choices.classList.remove('disabled');
            this.displayNextQuiz();
        }, 1500);
    },
    checkBlankAnswer() {
        const userAnswer = this.elements.blankInput.value.trim();
        const correctAnswer = this.state.currentQuiz.word;
        const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
        
        this.elements.blankInput.disabled = true;
        this.elements.blankSubmitBtn.disabled = true;

        const feedbackEl = this.elements.blankFeedback;
        if (isCorrect) {
            feedbackEl.innerHTML = `<p class="text-green-600 font-bold text-lg">정답!</p>`;
        } else {
            feedbackEl.innerHTML = `<p class="text-red-600 font-bold text-lg">오답</p><p class="text-gray-700">정답: ${correctAnswer}</p>`;
        }
        
        api.updateWordStats(correctAnswer, isCorrect);
        setTimeout(() => {
            this.elements.blankContainer.classList.add('hidden');
            this.displayNextQuiz();
        }, 2000);
    },
    handlePass() {
        api.updateWordStats(this.state.currentQuiz.word, false);
        this.elements.meaningContainer.classList.add('hidden');
        this.elements.blankContainer.classList.add('hidden');
        this.displayNextQuiz();
    },
    showFinishedScreen(message) {
        this.reset();
        this.elements.finishedScreen.classList.remove('hidden');
        this.elements.finishedMessage.textContent = message;
    }
};

// ================================================================
// Stats Mode Module
// ================================================================
const statsMode = {
    elements: {},
    init() {
        this.elements = {
            totalWords: document.getElementById('stats-total-words'),
            learnedWords: document.getElementById('stats-learned-words'),
            chartCanvas: document.getElementById('srs-chart'),
        };
    },
    async show() {
        if (!app.state.isWordListReady) {
            await quizMode.waitForWordList();
        }
        this.renderStats();
    },
    renderStats() {
        const wordList = app.state.wordList;
        if (wordList.length === 0) return;

        const total = wordList.length;
        const learned = wordList.filter(w => w.srsLevel >= app.config.SRS_LEVEL_LEARNED).length;

        this.elements.totalWords.textContent = total;
        this.elements.learnedWords.textContent = `${learned} (${Math.round((learned/total)*100)}%)`;

        const srsCounts = Array(app.config.SRS_LEVEL_LEARNED + 1).fill(0);
        wordList.forEach(w => {
            const level = Math.min(w.srsLevel, app.config.SRS_LEVEL_LEARNED);
            srsCounts[level]++;
        });
        
        const chartData = {
            labels: srsCounts.map((_, i) => i === app.config.SRS_LEVEL_LEARNED ? '완료' : `Lv ${i}`),
            datasets: [{
                label: '단어 수',
                data: srsCounts,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        };

        if (app.state.srsChartInstance) app.state.srsChartInstance.destroy();
        app.state.srsChartInstance = new Chart(this.elements.chartCanvas, {
            type: 'bar', data: chartData,
            options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }
};

// ================================================================
// Incorrect Notes Mode Module
// ================================================================
const notesMode = {
    elements: {},
    init() { this.elements = { listContainer: document.getElementById('notes-list') }; },
    async show() {
        if (!app.state.isWordListReady) await quizMode.waitForWordList();
        this.renderNotes();
    },
    renderNotes() {
        this.elements.listContainer.innerHTML = '';
        const incorrectWords = app.state.wordList
            .filter(w => w.incorrectCount > 0)
            .sort((a, b) => b.incorrectCount - a.incorrectCount);

        if (incorrectWords.length === 0) {
            this.elements.listContainer.innerHTML = `<p class="text-gray-500 text-center py-8">오답 기록이 없습니다.</p>`;
            return;
        }

        incorrectWords.forEach(word => {
            const item = document.createElement('div');
            item.className = 'flex justify-between items-center bg-red-50 p-3 rounded-lg cursor-pointer hover:bg-red-100 transition-colors';
            item.innerHTML = `
                <div>
                    <p class="font-bold text-lg text-red-800">${word.word}</p>
                    <p class="text-sm text-gray-600">${word.meaning.split('\n')[0]}</p>
                </div>
                <div class="text-right flex-shrink-0 ml-4">
                     <p class="text-sm text-red-600">오답: <span class="font-semibold">${word.incorrectCount}</span>회</p>
                     <p class="text-sm text-gray-500">레벨: ${word.srsLevel}</p>
                </div>`;
            item.onclick = () => app.navigateTo('learning', { startIndex: app.state.wordList.findIndex(w => w.word === word.word) });
            this.elements.listContainer.appendChild(item);
        });
    }
};

// ================================================================
// Learning Mode Module
// ================================================================
const learningMode = {
    state: { currentIndex: 0, touchstartX: 0, touchstartY: 0 },
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
    bindEvents() { /* same as before, simplified */ },
    async start(options = {}) {
        this.elements.appContainer.classList.add('hidden');
        this.elements.loader.classList.add('hidden');
        this.elements.startScreen.classList.remove('hidden');

        if (options.suggestions) {
            this.displaySuggestions(options.suggestions, options.title);
        } else if (options.startIndex !== undefined) {
            this.state.currentIndex = options.startIndex;
            this.launchApp();
        } else {
            this.resetStartScreen();
        }
    },
    async startFromInput() {
        this.elements.startScreen.classList.add('hidden');
        this.elements.loader.classList.remove('hidden');
        if (!app.state.isWordListReady) await this.waitForWordList();
        this.elements.loader.classList.add('hidden');

        const startWord = this.elements.startWordInput.value.trim();
        app.searchWordInLearningMode(startWord || app.state.wordList[0]?.word);
    },
    launchApp() {
        this.elements.startScreen.classList.add('hidden');
        this.elements.appContainer.classList.remove('hidden');
        this.elements.fixedButtons.classList.remove('hidden');
        this.displayWord(this.state.currentIndex);
    },
    reset() {
        this.elements.startScreen.classList.remove('hidden');
        this.elements.appContainer.classList.add('hidden');
        this.elements.fixedButtons.classList.add('hidden');
        this.resetStartScreen();
    },
    resetStartScreen() { /* same as before */ },
    displaySuggestions(suggestions, title) { /* same as before */ },
    displayWord(index) { /* same as before */ },
    navigate(direction) { /* same as before */ },
    async handleFlip() { /* same as before */ },
    isLearningModeActive() { return !this.elements.appContainer.classList.contains('hidden'); },
    // ... rest of event handlers
};
(async () => {
    try {
        learningMode.bindEvents = function() {
            this.elements.startBtn.addEventListener('click', () => this.startFromInput());
            this.elements.startWordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.startFromInput(); });
            this.elements.startWordInput.addEventListener('input', (e) => { const originalValue = e.target.value; const sanitizedValue = originalValue.replace(/[^a-zA-Z\s'-]/g, ''); if (originalValue !== sanitizedValue) app.showImeWarning(); e.target.value = sanitizedValue; });
            this.elements.backToStartBtn.addEventListener('click', () => this.resetStartScreen());
            this.elements.nextBtn.addEventListener('click', () => this.navigate(1));
            this.elements.prevBtn.addEventListener('click', () => this.navigate(-1));
            this.elements.sampleBtn.addEventListener('click', () => this.handleFlip());
            this.elements.wordDisplay.addEventListener('click', () => { const word = app.state.wordList[this.state.currentIndex]?.word; if (word) { api.speak(word, 'word'); ui.copyToClipboard(word); } });
            this.elements.wordDisplay.addEventListener('contextmenu', (e) => { e.preventDefault(); const wordData = app.state.wordList[this.state.currentIndex]; if (wordData) ui.showWordContextMenu(e, wordData.word, { hideAppSearch: true }); });
            // Add other event listeners...
        };
        learningMode.resetStartScreen = function() { this.elements.startInputContainer.classList.remove('hidden'); this.elements.suggestionsContainer.classList.add('hidden'); this.elements.startWordInput.value = ''; this.elements.startWordInput.focus(); };
        learningMode.displaySuggestions = function(suggestions, title) { this.elements.loader.classList.add('hidden'); this.elements.startScreen.classList.remove('hidden'); this.elements.startInputContainer.classList.add('hidden'); this.elements.suggestionsTitle.innerHTML = title; this.elements.suggestionsList.innerHTML = ''; suggestions.forEach(({ word, index }) => { const btn = document.createElement('button'); btn.className = 'w-full text-left bg-gray-100 hover:bg-gray-200 font-semibold py-3 px-4 rounded-lg transition-colors'; btn.textContent = word; btn.onclick = () => { this.state.currentIndex = index; this.launchApp(); }; this.elements.suggestionsList.appendChild(btn); }); this.elements.suggestionsContainer.classList.remove('hidden'); };
        learningMode.displayWord = function(index) { this.elements.cardBack.classList.remove('is-slid-up'); const wordData = app.state.wordList[index]; if (!wordData) return; const wordText = wordData.word; const pronText = wordData.pronunciation ? `<span class="pronunciation-inline">${wordData.pronunciation}</span>` : ''; this.elements.wordDisplay.innerHTML = `${wordText} ${pronText}`; ui.adjustFontSize(this.elements.wordDisplay); this.elements.meaningDisplay.innerHTML = wordData.meaning.replace(/\n/g, '<br>'); ui.renderInteractiveText(this.elements.explanationDisplay, wordData.explanation); this.elements.explanationContainer.classList.toggle('hidden', !wordData.explanation || !wordData.explanation.trim()); switch(wordData.sampleSource) { case 'manual': this.elements.sampleBtnImg.src = 'https://i.imgur.com/8Yv4aF2.png'; break; case 'ai': this.elements.sampleBtnImg.src = 'https://i.imgur.com/T0fUfH7.png'; break; default: this.elements.sampleBtnImg.src = 'https://i.imgur.com/kY9N2F4.png'; break; }};
        learningMode.navigate = function(direction) { const len = app.state.wordList.length; if (len === 0) return; this.state.currentIndex = (this.state.currentIndex + direction + len) % len; this.displayWord(this.state.currentIndex); };
        learningMode.handleFlip = async function() { const isBackVisible = this.elements.cardBack.classList.contains('is-slid-up'); const wordData = app.state.wordList[this.state.currentIndex]; if (!isBackVisible) { if (wordData.sampleSource === 'none') { app.showNoSampleMessage(); return; } this.elements.backTitle.textContent = wordData.word; ui.displaySentences(wordData.sample.split('\n'), this.elements.backContent); this.elements.cardBack.classList.add('is-slid-up'); this.elements.sampleBtnImg.src = 'https://i.imgur.com/I2a1w2E.png'; } else { this.elements.cardBack.classList.remove('is-slid-up'); this.displayWord(this.state.currentIndex); }};
        learningMode.waitForWordList = async function() { return new Promise(resolve => { const i = setInterval(() => { if (app.state.isWordListReady) { clearInterval(i); resolve(); } }, 100); }); };
    } catch(e) { console.error("Failed to initialize learningMode module:", e); }
})();

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
