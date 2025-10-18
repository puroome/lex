// ================================================================
// UI Controller & Utilities
// ================================================================
import { app } from './main.js';
import { api } from './api.js';
import { learningMode } from './learning.js';

export const ui = {
    elements: {
        wordContextMenu: document.getElementById('word-context-menu'),
        searchAppContextBtn: document.getElementById('search-app-context-btn'),
        searchDaumContextBtn: document.getElementById('search-daum-context-btn'),
        searchNaverContextBtn: document.getElementById('search-naver-context-btn'),
        searchEtymContextBtn: document.getElementById('search-etym-context-btn'),
        searchLongmanContextBtn: document.getElementById('search-longman-context-btn'),
        translationTooltip: document.getElementById('translation-tooltip'),
        noSampleMessage: document.getElementById('no-sample-message'),
    },
    async copyToClipboard(text) {
        if (navigator.clipboard) {
            try { await navigator.clipboard.writeText(text); } 
            catch (err) { console.error('클립보드 복사 실패:', err); }
        }
    },
    createInteractiveFragment(text, isForSampleSentence = false) {
        const fragment = document.createDocumentFragment();
        if (!text || !text.trim()) return fragment;
    
        const parts = text.split(/([a-zA-Z0-9'-]+)/g);
        
        parts.forEach(part => {
            if (/([a-zA-Z0-9'-]+)/.test(part) && learningMode.nonInteractiveWords && !learningMode.nonInteractiveWords.has(part.toLowerCase())) {
                 const span = document.createElement('span');
                span.textContent = part;
                span.className = 'interactive-word';
                span.onclick = (e) => {
                    if (isForSampleSentence) e.stopPropagation();
                    clearTimeout(app.state.longPressTimer);
                    api.speak(part, 'word');
                    this.copyToClipboard(part);
                };
                span.oncontextmenu = (e) => {
                    e.preventDefault();
                    if (isForSampleSentence) e.stopPropagation();
                    this.showWordContextMenu(e, part);
                };
                 let touchMove = false;
                span.addEventListener('touchstart', (e) => {
                    if (isForSampleSentence) e.stopPropagation();
                    touchMove = false;
                    clearTimeout(app.state.longPressTimer);
                    app.state.longPressTimer = setTimeout(() => { if (!touchMove) { this.showWordContextMenu(e, part); } }, 700);
                }, { passive: true });
                span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); });
                span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });
                fragment.appendChild(span);
            } else {
                fragment.appendChild(document.createTextNode(part));
            }
        });
        return fragment;
    },
    renderExplanationText(targetElement, text) {
        targetElement.innerHTML = '';
        if (!text || !text.trim()) return;
        const regex = /(\[.*?\])|([a-zA-Z0-9'-]+(?:[\s'-]*[a-zA-Z0-9'-]+)*)/g;
        text.split('\n').forEach((line, lineIndex, lineArr) => {
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
                    span.className = 'interactive-word';
                    span.onclick = () => {
                        clearTimeout(app.state.longPressTimer);
                        api.speak(englishPhrase, 'word');
                        this.copyToClipboard(englishPhrase);
                    };
                    span.oncontextmenu = (e) => { e.preventDefault(); this.showWordContextMenu(e, englishPhrase); };
                    let touchMove = false;
                    span.addEventListener('touchstart', (e) => {
                        touchMove = false;
                        clearTimeout(app.state.longPressTimer);
                        app.state.longPressTimer = setTimeout(() => { if (!touchMove) this.showWordContextMenu(e, englishPhrase); }, 700);
                    }, { passive: true });
                    span.addEventListener('touchmove', () => { touchMove = true; clearTimeout(app.state.longPressTimer); });
                    span.addEventListener('touchend', () => { clearTimeout(app.state.longPressTimer); });
                    targetElement.appendChild(span);
                } else if (nonClickable) {
                    targetElement.appendChild(document.createTextNode(nonClickable));
                }
                lastIndex = regex.lastIndex;
            }
            if (lastIndex < line.length) {
                targetElement.appendChild(document.createTextNode(line.substring(lastIndex)));
            }
            if (lineIndex < lineArr.length - 1) {
                targetElement.appendChild(document.createElement('br'));
            }
        });
    },
    displaySentences(sentences, containerElement) {
        containerElement.innerHTML = '';
        sentences.filter(s => s && s.trim()).forEach(sentence => {
            const p = document.createElement('p');
            p.className = 'p-2 rounded transition-colors cursor-pointer hover:bg-gray-200';
            
            p.onclick = (e) => {
                if (e.target === p) {
                    api.speak(p.textContent, 'sample');
                }
            };

            p.addEventListener('mouseenter', (e) => {
                clearTimeout(app.state.translationTimer);
                app.state.translationTimer = setTimeout(async () => {
                    const translatedText = await api.translate(p.textContent);
                    this.showTranslationTooltip(translatedText, e);
                }, 1000);
            });

            p.addEventListener('mouseleave', () => {
                clearTimeout(app.state.translationTimer);
                this.hideTranslationTooltip();
            });
            
            const sentenceParts = sentence.split(/(\*.*?\*)/g);
            sentenceParts.forEach(part => {
                if (part.startsWith('*') && part.endsWith('*')) {
                    const strong = document.createElement('strong');
                    strong.appendChild(this.createInteractiveFragment(part.slice(1, -1), true));
                    p.appendChild(strong);
                } else if (part) {
                    p.appendChild(this.createInteractiveFragment(part, true));
                }
            });
            containerElement.appendChild(p);
        });
    },
    showTranslationTooltip(text, event) {
        const tooltip = this.elements.translationTooltip;
        tooltip.textContent = text;
        tooltip.classList.remove('hidden');
        
        const rect = event.target.getBoundingClientRect();
        tooltip.style.left = `${event.clientX}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
    },
    hideTranslationTooltip() {
        this.elements.translationTooltip.classList.add('hidden');
    },
    showWordContextMenu(event, word, options = {}) {
        event.preventDefault();
        const menu = this.elements.wordContextMenu;

        this.elements.searchAppContextBtn.style.display = options.hideAppSearch ? 'none' : 'block';
        
        const touch = event.touches ? event.touches[0] : null;
        const x = touch ? touch.clientX : event.clientX;
        const y = touch ? touch.clientY : event.clientY;

        menu.style.top = `${y}px`;
        menu.style.left = `${x}px`;
        menu.classList.remove('hidden');

        const encodedWord = encodeURIComponent(word);

        this.elements.searchAppContextBtn.onclick = () => app.searchWordInLearningMode(word);
        this.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encodedWord}`); this.hideWordContextMenu(); };
        this.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`); this.hideWordContextMenu(); };
        this.elements.searchEtymContextBtn.onclick = () => { window.open(`https://www.etymonline.com/search?q=${encodedWord}`); this.hideWordContextMenu(); };
        this.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`); this.hideWordContextMenu(); };
    },
    hideWordContextMenu() {
        this.elements.wordContextMenu.classList.add('hidden');
    },
    showNoSampleMessage() {
        const msgEl = this.elements.noSampleMessage;
        msgEl.classList.remove('hidden', 'opacity-0');
        setTimeout(() => {
            msgEl.classList.add('opacity-0');
            setTimeout(() => msgEl.classList.add('hidden'), 500);
        }, 1500);
    },
    utils: {
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
    }
};
