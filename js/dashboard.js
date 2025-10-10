import { api } from './api.js';

export const dashboard = {
    elements: {
        container: document.getElementById('dashboard-container'),
        content: document.getElementById('dashboard-content'),
    },
    state: {
        app: null,
        dashboardData: null,
        currentPeriod: 'sevenDays', // 'sevenDays' or 'thirtyDays'
    },
    init(app) {
        this.state.app = app;
    },
    showLoading() {
        this.elements.content.innerHTML = `<div class="text-center p-10"><div class="loader mx-auto"></div><p class="mt-4 text-gray-600">최신 통계를 불러오는 중...</p></div>`;
    },
    showError(message) {
        this.elements.content.innerHTML = `<div class="p-8 text-center text-red-600">${message}</div>`;
    },
    async render() {
        try {
            this.state.dashboardData = await api.fetchFromGoogleSheet('getDashboardData');
            this.renderContent();
        } catch (e) {
            this.showError(`통계 데이터를 불러오는데 실패했습니다: ${e.message}`);
        }
    },
    renderContent() {
        const wordList = this.state.app.state.wordList;
        const totalWords = wordList.length;

        const stages = [
            { name: '새 단어', count: 0, color: 'bg-gray-400' },
            { name: '학습 중', count: 0, color: 'bg-blue-500' },
            { name: '익숙함', count: 0, color: 'bg-yellow-500' },
            { name: '학습 완료', count: 0, color: 'bg-green-500' }
        ];

        wordList.forEach(word => {
            const { srsMeaning, srsBlank, srsDefinition } = word;
            if (srsMeaning === null && srsBlank === null && srsDefinition === null) {
                stages[0].count++; return;
            }
            const score = (srsMeaning === 1 ? 1 : 0) + (srsBlank === 1 ? 1 : 0) + (srsDefinition === 1 ? 1 : 0);
            if (score === 3) stages[3].count++;
            else if (score === 2) stages[2].count++;
            else stages[1].count++;
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
        stages.forEach(stage => {
            const percentage = totalWords > 0 ? ((stage.count / totalWords) * 100).toFixed(1) : 0;
            contentHTML += `
                <div class="w-full">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-base font-semibold text-gray-700">${stage.name}</span>
                        <span class="text-sm font-medium text-gray-500">${stage.count}개 (${percentage}%)</span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-4">
                        <div class="${stage.color} h-4 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        });
        contentHTML += `</div></div>`;
        
        // 최근 학습 활동 섹션 추가
        contentHTML += this.renderActivitySection();

        this.elements.content.innerHTML = contentHTML;
        this.bindActivityEvents();
    },
    renderActivitySection() {
        const data = this.state.dashboardData[this.state.currentPeriod];
        const periodText = this.state.currentPeriod === 'sevenDays' ? '최근 7일' : '최근 30일';
        const totalQuizzes = data.correct + data.incorrect;
        const accuracy = totalQuizzes > 0 ? ((data.correct / totalQuizzes) * 100).toFixed(1) : '0.0';

        const createBar = (label, value, maxValue, colorClass) => {
            const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
            return `
                <div class="flex items-center mb-2">
                    <div class="w-28 text-sm text-gray-600">${label}</div>
                    <div class="flex-1 bg-gray-200 rounded-full h-5">
                        <div class="${colorClass} h-5 rounded-full text-white text-xs flex items-center justify-end pr-2" style="width: ${width}%">${value}</div>
                    </div>
                </div>`;
        };
        
        const maxVal = Math.max(data.newWords, totalQuizzes);

        return `
            <div class="mt-8">
                <div class="flex justify-between items-center mb-4">
                     <h2 class="text-xl font-bold text-gray-700">최근 학습 활동</h2>
                     <div class="flex border border-gray-300 rounded-lg p-0.5">
                        <button id="btn-7-days" class="px-3 py-1 text-sm rounded-md ${this.state.currentPeriod === 'sevenDays' ? 'bg-blue-500 text-white' : 'text-gray-600'}">7일</button>
                        <button id="btn-30-days" class="px-3 py-1 text-sm rounded-md ${this.state.currentPeriod === 'thirtyDays' ? 'bg-blue-500 text-white' : 'text-gray-600'}">30일</button>
                     </div>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg shadow-inner">
                    ${createBar('새로 학습한 단어', data.newWords, maxVal, 'bg-green-500')}
                    ${createBar('푼 퀴즈 개수', totalQuizzes, maxVal, 'bg-blue-500')}
                    <div class="mt-4 text-center text-gray-700">
                        <p>퀴즈 정답률: <span class="font-bold">${accuracy}%</span> <span class="text-sm">(${data.correct} / ${totalQuizzes})</span></p>
                    </div>
                </div>
            </div>
        `;
    },
    bindActivityEvents() {
        document.getElementById('btn-7-days')?.addEventListener('click', () => {
            this.state.currentPeriod = 'sevenDays';
            this.renderContent();
        });
        document.getElementById('btn-30-days')?.addEventListener('click', () => {
            this.state.currentPeriod = 'thirtyDays';
            this.renderContent();
        });
    }
};
