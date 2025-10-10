import { api } from './api.js';

export const ui = {
    adjustFontSize(element) {
        element.style.fontSize = '';
        let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const container = element.parentElement;
        if(!container) return;
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
        text.split('\n').forEach(line => {
            const fragment = document.createDocumentFragment();
            const parts = line.split(/(\[.*?\]|[a-zA-Z0-9'-]+)/g);
            parts.forEach(part => {
                if (/[a-zA-Z]/.test(part) && !/\[.*?\]/.test(part)) {
                    const span = this.createInteractiveWordSpan(part);
                    fragment.appendChild(span);
                } else {
                    fragment.appendChild(document.createTextNode(part));
                }
            });
            targetElement.appendChild(fragment);
            targetElement.appendChild(document.createElement('br'));
        });
        if (targetElement.lastChild && targetElement.lastChild.tagName === 'BR') {
            targetElement.removeChild(targetElement.lastChild);
        }
    },
    createInteractiveWordSpan(word) {
        const span = document.createElement('span');
        span.textContent = word;
        span.className = 'cursor-pointer hover:bg-yellow-200 p-1 rounded-sm transition-colors interactive-word';

        span.onclick = (e) => {
            e.stopPropagation();
            clearTimeout(app.state.longPressTimer);
            api.speak(word, 'word');
            this.copyToClipboard(word);
        };

        span.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showWordContextMenu(e, word);
        };

        let touchMove = false;
        span.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            touchMove = false;
            clearTimeout(app.state.longPressTimer);
            app.state.longPressTimer = setTimeout(() => {
                if (!touchMove) this.showWordContextMenu(e, word);
            }, 700);
        }, { passive: true });
        span.addEventListener('touchmove', (e) => { e.stopPropagation(); touchMove = true; clearTimeout(app.state.longPressTimer); });
        span.addEventListener('touchend', (e) => { e.stopPropagation(); clearTimeout(app.state.longPressTimer); });
        
        return span;
    },
    handleSentenceMouseOver(event, sentence) {
        clearTimeout(app.state.translateDebounceTimeout);
        app.state.translateDebounceTimeout = setTimeout(async () => {
            const tooltip = app.elements.translationTooltip;
            const targetRect = event.target.getBoundingClientRect();
            tooltip.style.left = `${targetRect.left + window.scrollX}px`;
            tooltip.style.top = `${targetRect.bottom + window.scrollY + 5}px`;
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
        sentences.filter(s => s && s.trim()).forEach(sentence => {
            const p = document.createElement('p');
            p.className = 'p-2 rounded transition-colors cursor-pointer hover:bg-gray-200 sample-sentence';
            
            const processTextInto = (targetElement, text) => {
                 const parts = text.split(/([a-zA-Z0-9'-]+)/g);
                 parts.forEach(part => {
                    if (/[a-zA-Z]/.test(part)) {
                        targetElement.appendChild(this.createInteractiveWordSpan(part));
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

            p.onclick = (e) => {
                if(e.target.classList.contains('interactive-word')) return;
                api.speak(p.textContent, 'sample');
            };
            p.addEventListener('mouseover', (e) => {
                if (e.target.classList.contains('interactive-word')) { this.handleSentenceMouseOut(); return; }
                this.handleSentenceMouseOver(e, p.textContent);
            });
            p.addEventListener('mouseout', this.handleSentenceMouseOut.bind(this));
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
        app.elements.searchAppContextBtn.onclick = () => app.searchWordInLearningMode(word);
        app.elements.searchDaumContextBtn.onclick = () => { window.open(`https://dic.daum.net/search.do?q=${encodedWord}`); this.hideWordContextMenu(); };
        app.elements.searchNaverContextBtn.onclick = () => { window.open(`https://en.dict.naver.com/#/search?query=${encodedWord}`); this.hideWordContextMenu(); };
        app.elements.searchEtymContextBtn.onclick = () => { window.open(`https://www.etymonline.com/search?q=${encodedWord}`); this.hideWordContextMenu(); };
        app.elements.searchLongmanContextBtn.onclick = () => { window.open(`https://www.ldoceonline.com/dictionary/${encodedWord}`); this.hideWordContextMenu(); };
    },
    hideWordContextMenu() {
        app.elements.wordContextMenu.classList.add('hidden');
    },
    showConfirmModal(title, message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const closeBtn = document.getElementById('modal-close-btn');

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        const confirmHandler = () => {
            onConfirm();
            closeModal();
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', closeModal);
            closeBtn.removeEventListener('click', closeModal);
        };
        
        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', closeModal);
        closeBtn.addEventListener('click', closeModal);

        modal.classList.remove('hidden');
    }
};
