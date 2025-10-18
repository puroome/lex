// ================================================================
// Dashboard Controller
// ================================================================
import { app } from './main.js';

export const dashboard = {
    elements: {
        container: document.getElementById('dashboard-container'),
        content: document.getElementById('dashboard-content'),
    },
    init() {
        document.addEventListener('wordListUpdated', () => {
            if (!this.elements.container.classList.contains('hidden')) {
                this.render();
            }
        });
    },
    render() {
        if (!app.state.isWordListReady) {
            this.elements.content.innerHTML = `<div class="text-center p-10"><p class="text-gray-600">단어 목록을 먼저 불러와주세요.</p></div>`;
            return;
        }

        const wordList = app.state.wordList;
        const totalWords = wordList.length;
        const stages = [
            { name: '새 단어', count: 0, color: 'bg-gray-400' },
            { name: '학습 중', count: 0, color: 'bg-blue-500' },
            { name: '익숙함', count: 0, color: 'bg-yellow-500' },
            { name: '학습 완료', count: 0, color: 'bg-green-500' }
        ];
        wordList.forEach(word => {
            const { srsMeaning, srsBlank, srsDefinition } = word;
            if ((srsMeaning === null || srsMeaning === undefined) && (srsBlank === null || srsBlank === undefined) && (srsDefinition === null || srsDefinition === undefined)) {
                stages[0].count++; return;
            }
            const score = (srsMeaning === 1 ? 1 : 0) + (srsBlank === 1 ? 1 : 0) + (srsDefinition === 1 ? 1 : 0);
            if (score === 3) stages[3].count++;
            else if (score === 2) stages[2].count++;
            else stages[1].count++;
        });

        let contentHTML = `<div class="bg-gray-50 p-4 rounded-lg shadow-inner text-center"><p class="text-lg text-gray-600">총 단어 수</p><p class="text-4xl font-bold text-gray-800">${totalWords}</p></div><div><h2 class="text-xl font-bold text-gray-700 mb-3 text-center">학습 단계별 분포</h2><div class="space-y-4">`;
        stages.forEach(stage => {
            const percentage = totalWords > 0 ? ((stage.count / totalWords) * 100).toFixed(1) : 0;
            contentHTML += `<div class="w-full"><div class="flex justify-between items-center mb-1"><span class="text-base font-semibold text-gray-700">${stage.name}</span><span class="text-sm font-medium text-gray-500">${stage.count}개 (${percentage}%)</span></div><div class="w-full bg-gray-200 rounded-full h-4"><div class="${stage.color} h-4 rounded-full" style="width: ${percentage}%"></div></div></div>`;
        });
        contentHTML += `</div></div>`;
        this.elements.content.innerHTML = contentHTML;
    }
};
