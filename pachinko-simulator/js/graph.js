/**
 * スランプグラフの描画
 */

class SlumpGraph {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.chart = null;
        this.historyData = [];
        this.maxDisplayPoints = 200; // グラフに表示する最大データポイント数
        this.processedData = null; // 処理済みデータのキャッシュ
        
        // キャンバスサイズを明示的に設定
        this.canvas.height = 300;
        this.canvas.style.maxHeight = '400px';
    }
    
    /**
     * グラフの初期化
     */
    init() {
        // Chart.jsの設定
        Chart.defaults.animation.duration = 0; // アニメーションを無効化してパフォーマンス向上

        this.chart = new Chart(this.ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '差枚数',
                        data: [],
                        borderColor: '#ff6384',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1,
                        pointRadius: 0 // ポイントを非表示にしてパフォーマンス向上
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 10,
                        right: 20,
                        top: 20,
                        bottom: 10
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'ゲーム数'
                        },
                        ticks: {
                            maxTicksLimit: 10, // X軸の目盛りを減らしてパフォーマンス向上
                            callback: function(value, index, values) {
                                // 省略表示
                                return Number(value).toLocaleString();
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: '差枚数'
                        },
                        // Y軸の範囲を自動調整
                        grace: '10%', // 上下に10%の余白を追加
                        beginAtZero: false
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const dataIndex = context.dataIndex;
                                const dataPoint = this.processedData ? this.processedData[dataIndex] : null;
                                if (!dataPoint) return '';
                                
                                return [
                                    `差枚数: ${dataPoint.coinDifference}枚`,
                                    `BIG: ${dataPoint.bigCount}回`,
                                    `REG: ${dataPoint.regCount}回`,
                                    `設定: ${dataPoint.setting}`
                                ];
                            }
                        }
                    },
                    decimation: {
                        enabled: true,
                        algorithm: 'lttb' // Largest Triangle Three Buckets アルゴリズム
                    }
                },
                elements: {
                    line: {
                        borderWidth: 1.5 // 線を細くしてレンダリング負荷軽減
                    }
                }
            }
        });
        
        // ウィンドウリサイズ時にグラフサイズを調整
        window.addEventListener('resize', () => this.resize());
    }
    
    /**
     * グラフデータの更新（最適化版）
     */
    updateGraph(historyData) {
        if (!this.chart) {
            this.init();
        }
        
        if (!historyData || historyData.length === 0) {
            // データがない場合は空のグラフを表示
            this.chart.data.labels = [];
            this.chart.data.datasets[0].data = [];
            this.processedData = [];
            this.chart.update('none'); // アニメーションなしで更新
            return;
        }
        
        this.historyData = historyData;
        
        // データ量が多い場合は間引く
        this.processedData = this.downSampleData(historyData, this.maxDisplayPoints);
        
        // グラフデータの設定
        this.chart.data.labels = this.processedData.map(data => data.gameNumber);
        this.chart.data.datasets[0].data = this.processedData.map(data => data.coinDifference);
        
        // グラフの更新（アニメーションなしで高速化）
        this.chart.update('none');
    }
    
    /**
     * データの間引き処理（最適化）
     */
    downSampleData(data, maxPoints) {
        if (!data || data.length === 0) {
            return [];
        }
        
        if (data.length <= maxPoints) {
            return data;
        }
        
        // ダウンサンプリングの間隔を計算
        const skipInterval = Math.ceil(data.length / maxPoints);
        
        // 重要ポイントを保持する配列
        const result = [];
        const importantIndices = new Set();
        
        // 最初と最後のデータポイントは必ず含める
        importantIndices.add(0);
        importantIndices.add(data.length - 1);
        
        // ボーナス当選ポイントを見つけて保持（重要なポイント）
        for (let i = 1; i < data.length; i++) {
            if (data[i].bigCount > data[i-1].bigCount || 
                data[i].regCount > data[i-1].regCount) {
                importantIndices.add(i);
            }
        }
        
        // 間引きつつ、重要ポイントは保持
        for (let i = 0; i < data.length; i++) {
            if (i % skipInterval === 0 || importantIndices.has(i)) {
                result.push(data[i]);
            }
        }
        
        // 最終ポイントが含まれていなければ追加
        const lastIndex = data.length - 1;
        if (!result.includes(data[lastIndex])) {
            result.push(data[lastIndex]);
        }
        
        console.log(`グラフデータを ${data.length} → ${result.length} ポイントに間引きました`);
        return result;
    }
    
    /**
     * グラフのサイズ調整
     */
    resize() {
        if (this.chart) {
            // キャンバスの高さを再設定（スクロールバーの発生を防止）
            this.canvas.height = 300;
            this.canvas.style.maxHeight = '400px';
            
            // チャートのサイズを更新
            this.chart.resize();
            
            // 変更を反映
            this.chart.update('none');
        }
    }
    
    /**
     * ボーナス発生位置にマーカーを追加（最適化版）
     */
    addBonusMarkers(historyData) {
        if (!this.chart) return;
        
        // processedDataがない場合はupdateGraphが呼ばれていないため処理しない
        if (!this.processedData || this.processedData.length === 0) {
            if (historyData && historyData.length > 0) {
                this.updateGraph(historyData);
            } else {
                return;
            }
        }
        
        // 既存のボーナスマーカーがあれば削除
        if (this.chart.data.datasets.length > 1) {
            this.chart.data.datasets = [this.chart.data.datasets[0]];
        }
        
        // 既に間引いたデータ（processedData）を使用
        const dataToShow = this.processedData;
        
        // BIGボーナスの発生位置を見つける
        const bigData = new Array(dataToShow.length).fill(null);
        const regData = new Array(dataToShow.length).fill(null);
        
        // 既に間引いたデータでのボーナス判定（パフォーマンス向上）
        for (let i = 1; i < dataToShow.length; i++) {
            if (dataToShow[i].bigCount > dataToShow[i-1].bigCount) {
                bigData[i] = dataToShow[i].coinDifference;
            }
            if (dataToShow[i].regCount > dataToShow[i-1].regCount) {
                regData[i] = dataToShow[i].coinDifference;
            }
        }
        
        // BIGボーナスのデータセット追加
        this.chart.data.datasets.push({
            label: 'BIG',
            data: bigData,
            borderColor: 'rgba(0, 0, 0, 0)',
            backgroundColor: 'gold',
            borderWidth: 0,
            pointRadius: 4,
            pointStyle: 'circle',
            pointHoverRadius: 6,
            fill: false
        });
        
        // REGボーナスのデータセット追加
        this.chart.data.datasets.push({
            label: 'REG',
            data: regData,
            borderColor: 'rgba(0, 0, 0, 0)',
            backgroundColor: 'blue',
            borderWidth: 0,
            pointRadius: 4,
            pointStyle: 'circle',
            pointHoverRadius: 6,
            fill: false
        });
        
        // アニメーションなしで更新（パフォーマンス向上）
        this.chart.update('none');
    }
    
    /**
     * グラフのリセット・クリーンアップ
     */
    reset() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        this.historyData = [];
        this.processedData = null;
        this.init();
    }
} 