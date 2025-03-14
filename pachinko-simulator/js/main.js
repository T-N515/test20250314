/**
 * パチスロWebシミュレーター メイン処理
 */

// グローバル変数
let slotMachine;
let slotDatabase;
let slumpGraph;
let reelElements = [];
let isInitialized = false;

// DOM要素
let creditDisplay;
let gameCountDisplay;
let bigCountDisplay;
let regCountDisplay;
let currentSettingDisplay;
let startButton;
let stopButtons = [];
let settingsButton;
let settingsModal;
let settingButtons = [];
let resetDataButton;
let closeSettingsButton;

// リールの描画が必要なフレームかどうかを判定するための変数
let lastRenderTime = 0;
const RENDER_INTERVAL = 1000 / 60; // 60fps

// グラフ更新の制御
let lastGraphUpdateTime = 0;
const GRAPH_UPDATE_INTERVAL = 5000; // グラフの更新間隔（ミリ秒）
let pendingGraphUpdate = false;

/**
 * 初期化
 */
async function init() {
    if (isInitialized) return;
    
    // DOM要素の取得
    creditDisplay = document.getElementById('credit');
    gameCountDisplay = document.getElementById('game-count');
    bigCountDisplay = document.getElementById('big-count');
    regCountDisplay = document.getElementById('reg-count');
    currentSettingDisplay = document.getElementById('current-setting');
    startButton = document.getElementById('start-button');
    stopButtons = [
        document.getElementById('stop-button-0'),
        document.getElementById('stop-button-1'),
        document.getElementById('stop-button-2')
    ];
    settingsButton = document.getElementById('settings-button');
    settingsModal = document.getElementById('settings-modal');
    settingButtons = document.querySelectorAll('.setting-button');
    resetDataButton = document.getElementById('reset-data-button');
    closeSettingsButton = document.getElementById('close-settings');
    
    // リール要素の取得
    reelElements = [
        document.getElementById('reel0').querySelector('.reel-inner'),
        document.getElementById('reel1').querySelector('.reel-inner'),
        document.getElementById('reel2').querySelector('.reel-inner')
    ];
    
    // クラスのインスタンス化
    slotMachine = new SlotMachine();
    slotDatabase = new SlotDatabase();
    slumpGraph = new SlumpGraph('slump-graph');
    
    // データのロード
    await loadData();
    
    // リールのスタイル設定
    updateReelStyles();
    
    // イベントリスナーの設定
    setupEventListeners();
    
    // UIの更新
    updateUI();
    
    // アニメーションの開始
    requestAnimationFrame(renderLoop);
    
    isInitialized = true;
    console.log('パチスロシミュレーター初期化完了');
}

/**
 * 保存データのロード
 */
async function loadData() {
    try {
        // スロットデータのロード
        const savedData = await slotDatabase.loadSlotData();
        if (savedData) {
            slotMachine.credit = savedData.credit;
            slotMachine.currentSetting = savedData.currentSetting;
            slotMachine.totalGames = savedData.totalGames;
            slotMachine.bigCount = savedData.bigCount;
            slotMachine.regCount = savedData.regCount;
            slotMachine.coinDifference = savedData.coinDifference;
            slotMachine.isAT = savedData.isAT;
            slotMachine.atGamesRemaining = savedData.atGamesRemaining;
            slotMachine.bonusType = savedData.bonusType;
            slotMachine.bonusGamesRemaining = savedData.bonusGamesRemaining;
            
            console.log('保存データをロードしました');
        }
        
        // グラフ初期化（まずは空のグラフを表示）
        slumpGraph.init();
        
        // ゲーム履歴のロードとグラフの描画（非同期で処理してUIブロッキングを防止）
        setTimeout(async () => {
            try {
                // 一度だけグラフ更新を実行
                if (pendingGraphUpdate !== 'updating') {
                    pendingGraphUpdate = 'updating';
                    const historyData = await slotDatabase.getGameHistory();
                    if (historyData && historyData.length > 0) {
                        slumpGraph.updateGraph(historyData);
                        slumpGraph.addBonusMarkers(historyData);
                    }
                    pendingGraphUpdate = false;
                    lastGraphUpdateTime = Date.now();
                }
            } catch (error) {
                console.error('グラフデータ読み込みエラー:', error);
                pendingGraphUpdate = false;
            }
        }, 200); // 少し長めの遅延で他の処理が完了するのを待つ
    } catch (error) {
        console.error('データロードエラー:', error);
        slumpGraph.init();
    }
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
    // スタートボタン
    startButton.addEventListener('click', () => {
        // ゲーム状態をコンソールに出力してデバッグ
        console.log('スタートボタンがクリックされました。現在のゲーム状態:', slotMachine.gameState);
        
        // ゲームの開始を試みる
        const started = slotMachine.startGame();
        if (started) {
            // UIの更新
            updateUI();
            // ストップボタンを有効化
            disableStopButtons(false);
            // スタートボタンを無効化
            startButton.disabled = true;
        } else {
            console.error('ゲームを開始できませんでした。状態:', slotMachine.gameState, '残りクレジット:', slotMachine.credit);
            
            // エラーの場合、ゲーム状態をリセットして再試行できるようにする
            if (slotMachine.credit >= slotMachine.bet || slotMachine.currentWin?.isReplay) {
                // ゲーム状態を強制的にリセット
                slotMachine.gameState = 'ready';
                // すべてのリールが停止しているか確認
                const allStopped = slotMachine.allReelsStopped();
                if (!allStopped) {
                    // リールが回転中の場合、強制的に停止
                    slotMachine.reels.forEach((reel, index) => {
                        if (reel.isSpinning) {
                            cancelAnimationFrame(reel.animationId);
                            reel.isSpinning = false;
                        }
                    });
                }
            }
            // UIの更新
            updateUI();
        }
    });
    
    // ストップボタン
    stopButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            console.log(`ストップボタン ${index} がクリックされました。現在の状態:`, 
                        slotMachine.gameState, 
                        `リール${index}の回転状態:`, 
                        slotMachine.reels[index].isSpinning);
            
            // リール停止処理
            const stopped = slotMachine.stopReel(index);
            
            // ボタンを無効化
            if (stopped || !slotMachine.reels[index].isSpinning) {
                button.disabled = true;
            }
            
            // すべてのリールが停止したか確認
            if (slotMachine.allReelsStopped()) {
                console.log('すべてのリールが停止しました。ゲーム状態:', slotMachine.gameState);
                
                // データの保存
                saveGameData();
                
                // スタートボタンを有効化（ゲーム状態に関わらず）
                startButton.disabled = false;
                
                // ゲーム状態の確認と修正
                if (slotMachine.gameState !== 'ready') {
                    console.warn('ゲーム状態が ready ではありません。強制的に ready に設定します。');
                    slotMachine.gameState = 'ready';
                }
                
                // UIの更新
                updateUI();
            }
        });
    });
    
    // 設定ボタン
    settingsButton.addEventListener('click', () => {
        // 現在の設定をハイライト
        settingButtons.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.setting) === slotMachine.currentSetting);
        });
        
        // モーダルを表示
        settingsModal.style.display = 'flex';
    });
    
    // 設定選択ボタン
    settingButtons.forEach(button => {
        button.addEventListener('click', () => {
            const setting = parseInt(button.dataset.setting);
            slotMachine.changeSetting(setting);
            
            // ボタンのハイライト
            settingButtons.forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.dataset.setting) === setting);
            });
            
            // UIの更新
            updateUI();
            
            // データの保存
            slotDatabase.saveSlotData(slotMachine);
        });
    });
    
    // データリセットボタン
    resetDataButton.addEventListener('click', async () => {
        if (confirm('すべてのゲームデータをリセットしますか？')) {
            await slotDatabase.resetAllData();
            slotMachine.resetData();
            slotMachine.credit = 1000; // 初期クレジットをリセット
            updateUI();
            
            // グラフのリセット
            slumpGraph.reset();
            
            settingsModal.style.display = 'none';
        }
    });
    
    // モーダルを閉じるボタン
    closeSettingsButton.addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    
    // モーダル外をクリックして閉じる
    settingsModal.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });
    
    // キーボードショートカット
    document.addEventListener('keydown', (event) => {
        // スペースでスタート
        if (event.code === 'Space' && !startButton.disabled) {
            event.preventDefault();
            startButton.click();
        }
        
        // 1,2,3キーでストップボタン
        if (event.code === 'Digit1' && !stopButtons[0].disabled) {
            stopButtons[0].click();
        }
        if (event.code === 'Digit2' && !stopButtons[1].disabled) {
            stopButtons[1].click();
        }
        if (event.code === 'Digit3' && !stopButtons[2].disabled) {
            stopButtons[2].click();
        }
        
        // Rキーでリセット（エラー発生時の緊急対応用）
        if (event.code === 'KeyR' && event.ctrlKey) {
            event.preventDefault();
            console.log('強制リセットが実行されました');
            
            // スロットマシンの状態をリセット
            slotMachine.forceReset();
            
            // ボタン状態の更新
            disableStopButtons(true);
            startButton.disabled = false;
            
            // UIの更新
            updateUI();
            
            // 警告表示
            alert('ゲーム状態をリセットしました。スタートボタンを押して再開してください。');
        }
    });
    
    // ウィンドウリサイズ時
    window.addEventListener('resize', () => {
        if (slumpGraph) {
            slumpGraph.resize();
        }
    });
    
    // ページが再表示されたときのイベントリスナー
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && pendingGraphUpdate === true) {
            updateGraphWithLatestData();
        }
    });
}

/**
 * UIの更新
 */
function updateUI() {
    // クレジット表示
    creditDisplay.textContent = slotMachine.credit;
    
    // ゲームカウント、ボーナスカウント
    gameCountDisplay.textContent = slotMachine.totalGames;
    bigCountDisplay.textContent = slotMachine.bigCount;
    regCountDisplay.textContent = slotMachine.regCount;
    
    // 設定表示
    currentSettingDisplay.textContent = slotMachine.currentSetting;
    
    // ボーナス中の表示
    if (slotMachine.bonusType) {
        document.body.classList.add('bonus-mode');
        document.body.classList.add(slotMachine.bonusType.toLowerCase());
    } else {
        document.body.classList.remove('bonus-mode', 'big', 'reg');
    }
    
    // AT中の表示
    if (slotMachine.isAT) {
        document.body.classList.add('at-mode');
    } else {
        document.body.classList.remove('at-mode');
    }
}

/**
 * ストップボタンの有効/無効化
 */
function disableStopButtons(disabled) {
    stopButtons.forEach((button, index) => {
        // リールが回転中でない場合は常に無効化
        const shouldDisable = disabled || !slotMachine.reels[index].isSpinning;
        button.disabled = shouldDisable;
        
        // デバッグ用
        if (disabled) {
            console.log(`ストップボタン ${index} を無効化しました`);
        } else if (!shouldDisable) {
            console.log(`ストップボタン ${index} を有効化しました`);
        }
    });
}

/**
 * リールスタイルの設定
 */
function updateReelStyles() {
    // グローバル変数として定義
    window.SYMBOL_HEIGHT = 50; // シンボルの高さ
    
    const mockReelImage = new Image();
    mockReelImage.src = 'images/reel-symbols.png';
    mockReelImage.onload = () => {
        // リール画像のサイズに基づいて高さを調整
        const symbolHeight = mockReelImage.height / 6; // 6種類のシンボル
        
        // CSSの変数を更新
        document.documentElement.style.setProperty('--symbol-height', `${symbolHeight}px`);
        window.SYMBOL_HEIGHT = symbolHeight;
    };
    
    // リール画像が読み込めない場合のフォールバック
    mockReelImage.onerror = () => {
        console.warn('リール画像の読み込みに失敗しました。デフォルトの設定を使用します。');
        createDummyReelImage();
    };
}

/**
 * ゲームデータの保存
 */
async function saveGameData() {
    try {
        // スロットデータの保存
        await slotDatabase.saveSlotData(slotMachine);
        
        // ゲーム履歴の保存（30ゲームおきに保存、ボーナス当選時は必ず保存）
        const shouldSaveHistory = slotMachine.totalGames % 30 === 0 || slotMachine.bonusType;
        
        if (shouldSaveHistory) {
            await slotDatabase.saveGameHistory(slotMachine);
            
            // グラフの更新（頻度を制限）
            const currentTime = Date.now();
            if (currentTime - lastGraphUpdateTime > GRAPH_UPDATE_INTERVAL) {
                lastGraphUpdateTime = currentTime;
                
                // ページが表示されている場合のみグラフを更新
                if (!document.hidden) {
                    updateGraphWithLatestData();
                } else {
                    // 非表示時は更新フラグを立てておく
                    pendingGraphUpdate = true;
                }
            }
        }
        
        updateUI();
    } catch (error) {
        console.error('データ保存エラー:', error);
    }
}

/**
 * 最新データでグラフを更新
 */
async function updateGraphWithLatestData() {
    try {
        // 既に更新中の場合は処理しない（無限ループ防止）
        if (pendingGraphUpdate === 'updating') {
            console.log('グラフ更新中のため重複更新をスキップします');
            return;
        }
        
        pendingGraphUpdate = 'updating';
        
        // グラフの更新（非同期で実行して UI のブロッキングを防ぐ）
        setTimeout(async () => {
            try {
                // データを取得
                const historyData = await slotDatabase.getGameHistory();
                
                // チャートが存在するか確認
                if (!slumpGraph.chart) {
                    slumpGraph.init();
                }
                
                if (historyData && historyData.length > 0) {
                    // グラフデータを更新
                    slumpGraph.updateGraph(historyData);
                    
                    // ボーナスマーカーを追加
                    slumpGraph.addBonusMarkers(historyData);
                    
                    // 明示的にリサイズ処理を呼び出す
                    slumpGraph.resize();
                }
                
                // 処理完了後にフラグをリセット
                pendingGraphUpdate = false;
            } catch (error) {
                console.error('グラフ更新エラー（非同期）:', error);
                pendingGraphUpdate = false;
            }
        }, 50); // 少し遅延を長めに設定
    } catch (error) {
        console.error('グラフ更新エラー:', error);
        pendingGraphUpdate = false;
    }
}

/**
 * レンダリングループ
 */
function renderLoop(timestamp) {
    requestAnimationFrame(renderLoop);
    
    // 前回のレンダリングから十分な時間が経過していない場合はスキップ
    if (timestamp - lastRenderTime < RENDER_INTERVAL) return;
    
    lastRenderTime = timestamp;
    
    // リールの位置を更新
    slotMachine.reels.forEach((reel, index) => {
        if (reel.isSpinning) {
            reelElements[index].style.transform = `translateY(-${reel.position}px)`;
        }
    });
}

// DOMContentLoaded イベントでアプリケーションを初期化
document.addEventListener('DOMContentLoaded', init);

/**
 * リール画像が読み込めない場合に使用するダミー画像
 */
function createDummyReelImage() {
    // リール要素にダミーのシンボル画像を追加する処理
    const symbols = ['🔔', '↺', '🍉', '🍒', 'BAR', '7'];
    const symbolHeight = window.SYMBOL_HEIGHT || 50;
    
    for (let i = 0; i < 3; i++) {
        const reelInner = reelElements[i];
        reelInner.style.backgroundImage = 'none';
        reelInner.innerHTML = '';
        
        // 各シンボルを20回（リールレイアウトに合わせる）
        for (let j = 0; j < REEL_LAYOUTS[i].length; j++) {
            const symbolValue = REEL_LAYOUTS[i][j];
            const symbolElement = document.createElement('div');
            symbolElement.className = 'symbol';
            symbolElement.textContent = symbols[symbolValue];
            symbolElement.style.height = `${symbolHeight}px`;
            symbolElement.style.lineHeight = `${symbolHeight}px`;
            symbolElement.style.fontSize = `${symbolHeight * 0.6}px`;
            reelInner.appendChild(symbolElement);
        }
    }
} 