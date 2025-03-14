/**
 * パチスロWebシミュレーター メイン処理
 */

// グローバル変数
let slotMachine;
let slotDatabase;
let slumpGraph;
let reelElements = [];
let reelInnerElements = [];
let isInitialized = false;

// DOM要素
let creditDisplay;
let gameCountDisplay;
let bigCountDisplay;
let regCountDisplay;
let currentSettingDisplay;
let betButton;
let leverButton;
let stopButtons = [];
let settingsButton;
let settingsModal;
let settingButtons = [];
let resetDataButton;
let closeSettingsButton;

// リールの描画が必要なフレームかどうかを判定するための変数
let lastRenderTime = 0;
const RENDER_INTERVAL = 16; // 描画間隔（約60FPS）

// グラフ更新の制御
let lastGraphUpdateTime = 0;
const GRAPH_UPDATE_INTERVAL = 5000; // グラフの更新間隔（ミリ秒）
let pendingGraphUpdate = false;

/**
 * リールアニメーション用の変数
 */
let animationActive = false;
let animationFrameId = null;

// シンボルの高さ（CSS内の設定と同期する必要あり）
// 名前空間の衝突を避けるためにwindowオブジェクトのプロパティとして定義
window.SYMBOL_HEIGHT = 50;

/**
 * 初期化
 */
async function init() {
    if (isInitialized) return;
    
    console.log('パチンコシミュレーター初期化開始');

    // DOM要素の取得（各要素の取得結果をログ出力）
    try {
        creditDisplay = document.getElementById('credit');
        gameCountDisplay = document.getElementById('game-count');
        bigCountDisplay = document.getElementById('big-count');
        regCountDisplay = document.getElementById('reg-count');
        currentSettingDisplay = document.getElementById('current-setting');
        betButton = document.getElementById('bet-button');
        leverButton = document.getElementById('lever-button');
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
        
        // 重要なボタン要素の存在確認
        if (!betButton) console.error('BETボタンが見つかりません！');
        if (!leverButton) console.error('レバーボタンが見つかりません！');
        stopButtons.forEach((btn, i) => {
            if (!btn) console.error(`ストップボタン${i}が見つかりません！`);
        });
        
        console.log('ボタン要素の取得結果:', {
            betButton: !!betButton,
            leverButton: !!leverButton,
            stopButtons: stopButtons.map(btn => !!btn),
            settingsButton: !!settingsButton
        });
        
        // リール要素の取得（HTML構造に合わせてIDを修正）
        reelElements = [
            document.getElementById('reel0'),
            document.getElementById('reel1'),
            document.getElementById('reel2')
        ];
        
        console.log('リール要素の取得結果:', reelElements.map(el => !!el));
        
        // リール内部要素の取得
        reelInnerElements = [];
        for (let i = 0; i < 3; i++) {
            if (reelElements[i]) {
                // reel内部のreel-inner要素を取得（クラスセレクタで取得）
                const innerEl = reelElements[i].querySelector('.reel-inner');
                if (innerEl) {
                    // IDを設定（後の参照用）
                    innerEl.id = `reel-inner-${i}`;
                    reelInnerElements.push(innerEl);
                } else {
                    console.error(`リール${i}の内部要素が見つかりません`);
                }
            } else {
                console.error(`リール${i}の要素が見つかりません`);
            }
        }
        
        console.log('リール内部要素の取得結果:', reelInnerElements.map(el => !!el));

        // クラスのインスタンス化
        slotMachine = new SlotMachine();
        slotDatabase = new SlotDatabase();
        slumpGraph = new SlumpGraph('slump-graph');
        
        console.log('クラスのインスタンス化完了');

        // データのロード
        await loadData();
        console.log('データのロード完了');

        // リールのスタイル設定
        updateReelStyles();
        console.log('リールスタイル設定完了');

        // リールの初期化（HTMLにリール内容を追加）
        initializeReels();
        console.log('リール初期化完了');

        // イベントリスナーの設定
        setupEventListeners();
        console.log('イベントリスナー設定完了');

        // UIの更新
        updateUI();
        console.log('UI更新完了');

        // アニメーションの開始
        requestAnimationFrame(renderLoop);
        console.log('アニメーションループ開始');

        isInitialized = true;
        console.log('パチンコシミュレーター初期化完了');
    } catch (error) {
        console.error('初期化中にエラーが発生しました:', error);
    }
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
    console.log('イベントリスナーを設定します...');
    
    // BETボタン
    if (betButton) {
        betButton.addEventListener('click', () => {
            console.log('BETボタンがクリックされました。現在のゲーム状態:', slotMachine.gameState);

            // ベット処理
            const betPlaced = slotMachine.placeBet();
            if (betPlaced) {
                // UIの更新
                updateUI();
                // レバーボタンを有効化
                leverButton.disabled = false;
                // BETボタンを無効化
                betButton.disabled = true;
                
                // ログ出力
                writeLog('ベットしました。レバーを引いてください。');
            } else {
                console.error('ベットできませんでした。状態:', slotMachine.gameState, '残りクレジット:', slotMachine.credit);
            }
        });
    } else {
        console.error('BETボタン要素が見つかりません');
    }

    // レバーボタン
    if (leverButton) {
        leverButton.addEventListener('click', () => {
            console.log('レバーボタンがクリックされました。現在のゲーム状態:', slotMachine.gameState);

            // レバー操作処理
            const leverPulled = slotMachine.pullLever();
            if (leverPulled) {
                // UIの更新
                updateUI();
                // ストップボタンを有効化
                disableStopButtons(false);
                // レバーボタンを無効化
                leverButton.disabled = true;
                
                // リールアニメーション開始
                startReelAnimation();
                
                // ログ出力
                writeLog('レバーを引きました。回転開始！');
            } else {
                console.error('レバーを引けませんでした。状態:', slotMachine.gameState);
            }
        });
    } else {
        console.error('レバーボタン要素が見つかりません');
    }

    // ストップボタン
    stopButtons.forEach((button, index) => {
        if (button) {
            button.addEventListener('click', () => {
                console.log(`ストップボタン ${index} がクリックされました。現在の状態:`,
                           slotMachine.gameState,
                           `リール${index}の回転状態:`,
                           slotMachine.reels[index].isSpinning);

                // リール停止処理
                const stopped = slotMachine.stopReel(index);

                // リールの表示を即座に更新（位置の同期）
                if (stopped || !slotMachine.reels[index].isSpinning) {
                    // 少し遅延を入れて確実に停止処理後に実行
                    setTimeout(() => {
                        // 内部位置を取得して表示を同期
                        const internalPosition = slotMachine.internalPositions[index];
                        const position = Math.floor(internalPosition) * window.SYMBOL_HEIGHT;
                        
                        // 表示を更新
                        updateReelDisplay(index, position);
                        console.log(`リール${index}停止後の表示同期: 内部位置=${internalPosition}, 表示位置=${position}px`);
                        
                        // 直後にstopReelAnimationを呼び出して全体の位置調整
                        if (slotMachine.allReelsStopped()) {
                            stopReelAnimation();
                        }
                    }, slotMachine.reelStopDelay + 50); // リール停止の遅延よりも少し長めに設定
                }

                // ボタンを無効化
                if (stopped || !slotMachine.reels[index].isSpinning) {
                    button.disabled = true;
                }

                // ログ出力
                writeLog(`リール${index + 1}を停止しました`);

                // すべてのリールが停止したか確認
                if (slotMachine.allReelsStopped()) {
                    console.log('すべてのリールが停止しました。ゲーム状態:', slotMachine.gameState);

                    // データの保存
                    saveGameData();

                    // 成立役に応じたアクション
                    if (slotMachine.bonusType && !slotMachine.currentWin?.isReplay) {
                        // ボーナス当選時の表示
                        const bonusType = slotMachine.bonusType;
                        writeLog(`【当選】${bonusType}ボーナス！ ${bonusType === 'BIG' ? '70G' : '20G'}`);
                    }

                    // リプレイ成立時は自動的に次のゲームを開始
                    if (slotMachine.currentWin?.isReplay) {
                        writeLog('リプレイ成立！次のゲームを自動開始します');
                        setTimeout(() => {
                            // 自動的にレバーを引く
                            if (leverButton && !leverButton.disabled) {
                                leverButton.click();
                            }
                        }, 1000);
                    } else {
                        // リプレイではない場合はBETボタンを有効化
                        enableBetButton();
                    }

                    // グラフの更新
                    updateGraphWithLatestData();
                }
            });
        } else {
            console.error(`ストップボタン ${index} の要素が見つかりません`);
        }
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
        // スペースでBETまたはレバー操作
        if (event.code === 'Space') {
            event.preventDefault();
            // ゲーム状態に応じてボタン操作
            if (slotMachine.gameState === 'ready' && !betButton.disabled) {
                betButton.click();
            } else if (slotMachine.gameState === 'bet_placed' && !leverButton.disabled) {
                leverButton.click();
            }
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
    
    console.log('イベントリスナー設定完了');
}

/**
 * UIの更新
 */
function updateUI() {
    console.log('UI更新開始...');
    
    if (!creditDisplay || !gameCountDisplay || !bigCountDisplay || !regCountDisplay) {
        console.error('表示要素が見つかりません。UI更新をスキップします。');
        return;
    }
    
    // クレジット表示の更新
    creditDisplay.textContent = slotMachine.credit;
    console.log('クレジット表示更新:', slotMachine.credit);

    // ゲームカウント表示の更新
    gameCountDisplay.textContent = slotMachine.totalGames;
    bigCountDisplay.textContent = slotMachine.bigCount;
    regCountDisplay.textContent = slotMachine.regCount;
    console.log('ゲームカウント更新:', slotMachine.totalGames);

    // 設定表示の更新
    if (currentSettingDisplay) {
        currentSettingDisplay.textContent = slotMachine.currentSetting;
    }

    // ボタンの状態更新
    updateButtonStates();

    // ボーナス時の演出
    if (slotMachine.bonusType) {
        document.body.classList.add('bonus-active');
        document.body.classList.toggle('big-bonus', slotMachine.bonusType === 'BIG');
        document.body.classList.toggle('reg-bonus', slotMachine.bonusType === 'REG');
    } else {
        document.body.classList.remove('bonus-active', 'big-bonus', 'reg-bonus');
    }

    // AT中の演出
    document.body.classList.toggle('at-active', slotMachine.isAT);
    
    console.log('UI更新完了');
}

/**
 * ボタンの状態更新
 */
function updateButtonStates() {
    console.log('ボタン状態更新処理: 現在のゲーム状態=', slotMachine.gameState);
    
    // ボタン要素の存在チェック
    if (!betButton || !leverButton || stopButtons.some(btn => !btn)) {
        console.error('一部のボタン要素が見つかりません。ボタン状態を更新できません。');
        console.log('ボタン状態:', {
            betButton: betButton,
            leverButton: leverButton,
            stopButtons: stopButtons
        });
        return;
    }
    
    // 以前の状態を記録（デバッグ用）
    const prevStates = {
        bet: betButton.disabled,
        lever: leverButton.disabled,
        stops: stopButtons.map(btn => btn.disabled)
    };

    // ゲーム状態に基づいてボタンの有効/無効を設定
    switch (slotMachine.gameState) {
        case 'ready':
            // ready状態ではBETボタンのみ有効
            setButtonState(betButton, false);
            setButtonState(leverButton, true);
            disableStopButtons(true);
            break;

        case 'bet_placed':
            // bet_placed状態ではレバーボタンのみ有効
            setButtonState(betButton, true);
            setButtonState(leverButton, false);
            disableStopButtons(true);
            break;

        case 'spinning':
            // spinning状態ではストップボタンのみ有効
            setButtonState(betButton, true);
            setButtonState(leverButton, true);
            disableStopButtons(false);
            break;

        default:
            // その他の状態（ボーナスなど）
            setButtonState(betButton, true);
            setButtonState(leverButton, true);
            disableStopButtons(true);
    }
    
    // 変更後の状態を記録（デバッグ用）
    const newStates = {
        bet: betButton.disabled,
        lever: leverButton.disabled,
        stops: stopButtons.map(btn => btn.disabled)
    };
    
    // 状態が変わったボタンのみログ出力
    if (prevStates.bet !== newStates.bet) {
        console.log(`BETボタン状態変更: ${prevStates.bet ? '無効→有効' : '有効→無効'}`);
    }
    if (prevStates.lever !== newStates.lever) {
        console.log(`レバーボタン状態変更: ${prevStates.lever ? '無効→有効' : '有効→無効'}`);
    }
    for (let i = 0; i < stopButtons.length; i++) {
        if (prevStates.stops[i] !== newStates.stops[i]) {
            console.log(`ストップボタン${i}状態変更: ${prevStates.stops[i] ? '無効→有効' : '有効→無効'}`);
        }
    }
}

/**
 * ボタンの有効/無効状態を設定（より信頼性の高い方法）
 */
function setButtonState(button, disabled) {
    if (!button) {
        console.error('ボタン要素がnullです。状態を設定できません。');
        return;
    }
    
    try {
        if (disabled) {
            button.disabled = true;
            button.setAttribute('disabled', 'disabled');
            button.classList.add('disabled');
        } else {
            button.disabled = false;
            button.removeAttribute('disabled');
            button.classList.remove('disabled');
            
            // iOS Safariでのボタン無効化問題対策
            button.style.pointerEvents = 'auto';
            button.style.opacity = '1';
        }
    } catch (error) {
        console.error('ボタン状態設定中にエラーが発生しました:', error);
    }
}

/**
 * ストップボタンの有効/無効化
 */
function disableStopButtons(disabled) {
    stopButtons.forEach((button, index) => {
        // リールが回転中でない場合は常に無効化
        const shouldDisable = disabled || !slotMachine.reels[index].isSpinning;
        setButtonState(button, shouldDisable);

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

    // スロットマシンが初期化されていない場合はスキップ
    if (!slotMachine) return;

    // リールの位置を更新
    slotMachine.reels.forEach((reel, index) => {
        if (reel.isSpinning) {
            // updateReelDisplay関数を使用して位置を更新（一貫性のため）
            updateReelDisplay(index, reel.position);
        }
    });

    // 定期的にゲーム状態をチェック（フリーズ対策）
    if (timestamp % 1000 < 20) { // 約1秒ごとにチェック
        checkGameState();
    }
}

/**
 * ゲーム状態をチェックして必要に応じてリセット
 */
function checkGameState() {
    const allStopped = slotMachine.allReelsStopped();

    // すべてのリールが停止しているのにゲーム状態がspinningのまま
    if (allStopped && slotMachine.gameState === 'spinning') {
        console.warn('不整合を検出: リールは停止しているがゲーム状態がspinningです。状態をリセットします。');
        resetGameState();
    }

    // ボタンの状態チェック
    if (allStopped && (slotMachine.gameState === 'ready' || slotMachine.gameState === 'bet_placed')) {
        // ボタンが無効化されている場合は強制的に有効化
        if (betButton.disabled && slotMachine.gameState === 'ready') {
            console.warn('不整合を検出: ゲーム準備完了状態なのにBETボタンが無効化されています。ボタン状態をリセットします。');
            enableBetButton();
            updateUI(); // UIを更新して確実に変更を反映
        } else if (leverButton.disabled && slotMachine.gameState === 'bet_placed') {
            console.warn('不整合を検出: ベット済み状態なのにレバーボタンが無効化されています。ボタン状態をリセットします。');
            setButtonState(leverButton, false);
            updateUI(); // UIを更新して確実に変更を反映
        }
    }

    // ストップボタン状態の不整合チェック
    if (slotMachine.gameState === 'spinning') {
        let inconsistencyFound = false;
        slotMachine.reels.forEach((reel, index) => {
            if (reel.isSpinning && stopButtons[index].disabled) {
                console.warn(`不整合を検出: リール${index}は回転中なのにストップボタンが無効化されています。`);
                stopButtons[index].disabled = false;
                inconsistencyFound = true;
            }
        });

        if (inconsistencyFound) {
            updateUI();
        }
    }
}

/**
 * ゲーム状態を強制的にリセット
 */
function resetGameState() {
    // リールの回転を強制停止
    slotMachine.reels.forEach((reel, index) => {
        if (reel.isSpinning) {
            cancelAnimationFrame(reel.animationId);
            reel.isSpinning = false;
        }
    });

    // ゲーム状態をリセット
    slotMachine.gameState = 'ready';

    // ボタン状態をリセット
    enableBetButton();
    disableStopButtons(true);

    // UIを更新
    updateUI();

    console.log('ゲーム状態を強制リセットしました');
}

/**
 * BETボタンの有効化
 */
function enableBetButton() {
    if (!betButton) {
        console.error('BETボタン要素が見つかりません');
        return;
    }

    console.log('BETボタンを有効化します。前の状態:', betButton.disabled);

    try {
        // BETボタンのスタイルとプロパティをリセット
        betButton.style.opacity = '1';
        betButton.style.pointerEvents = 'auto';
        betButton.style.backgroundColor = '#4CAF50';
        betButton.style.cursor = 'pointer';
        
        // 直接disabled属性を設定
        betButton.disabled = false;
        betButton.removeAttribute('disabled');
        betButton.classList.remove('disabled');
        
        // DOM更新を強制
        betButton.offsetHeight;
        
        // イベントの再登録（念のため）
        betButton.onclick = function(event) {
            console.log('BETボタンがクリックされました');
            
            // 現在の状態をデバッグ出力
            console.debug('クリック時のボタン状態:', {
                disabled: betButton.disabled,
                hasAttribute: betButton.hasAttribute('disabled'),
                classList: betButton.className,
                style: {
                    opacity: betButton.style.opacity,
                    pointerEvents: betButton.style.pointerEvents,
                    backgroundColor: betButton.style.backgroundColor,
                    cursor: betButton.style.cursor
                }
            });
            
            // イベントの伝播を停止
            event.stopPropagation();
            
            // ベット処理
            const betPlaced = slotMachine.placeBet();
            if (betPlaced) {
                // UIの更新
                updateUI();
                writeLog('ベットしました。レバーを引いてください。');
            } else {
                console.error('ベットできませんでした。状態:', slotMachine.gameState, '残りクレジット:', slotMachine.credit);
            }
        };
        
        console.log('BETボタンの有効化完了。現在の状態:', {
            disabled: betButton.disabled,
            hasAttribute: betButton.hasAttribute('disabled'),
            classList: betButton.className
        });
    } catch (error) {
        console.error('BETボタンの有効化中にエラーが発生しました:', error);
    }

    // 連続して複数回有効化を試みる（ブラウザのレンダリングサイクルの問題対策）
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            try {
                betButton.disabled = false;
                betButton.removeAttribute('disabled');
                betButton.classList.remove('disabled');
                console.log(`[${i}] BETボタンを強制的に有効化しました。現在の状態:`, betButton.disabled);
            } catch (error) {
                console.error(`[${i}] BETボタン強制有効化中にエラー:`, error);
            }
        }, i * 100); // 100ms間隔で3回実行
    }
}

// DOMContentLoaded イベントでアプリケーションを初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded イベント発火: 初期化を開始します');
    
    // 必要なグローバル変数が定義されているか確認（必須の定数）
    if (typeof SYMBOLS === 'undefined') {
        console.error('エラー: SYMBOLS変数が定義されていません。reelData.jsが正しく読み込まれていない可能性があります。');
    }
    
    if (typeof REEL_LAYOUTS === 'undefined') {
        console.error('エラー: REEL_LAYOUTS変数が定義されていません。reelData.jsが正しく読み込まれていない可能性があります。');
    }
    
    if (typeof WINNING_COMBINATIONS === 'undefined') {
        console.error('エラー: WINNING_COMBINATIONS変数が定義されていません。reelData.jsが正しく読み込まれていない可能性があります。');
    }
    
    // 初期化を実行（少し遅延させてDOMの準備を確実にする）
    setTimeout(function() {
        try {
            init();
            console.log('init関数の呼び出しが成功しました');
        } catch (error) {
            console.error('init関数の呼び出し中にエラーが発生しました:', error);
        }
    }, 100);
});

// バックアップとして、loadイベントでも初期化を試みる
window.addEventListener('load', function() {
    console.log('load イベント発火: 初期化状態をチェックします');
    if (!isInitialized) {
        console.warn('DOMContentLoadedでの初期化が完了していないようです。再度初期化を試みます。');
        try {
            init();
            console.log('loadイベントによる初期化が成功しました');
        } catch (error) {
            console.error('loadイベントによる初期化中にエラーが発生しました:', error);
        }
    }
});

/**
 * リールの初期化（HTMLに内容を追加）
 */
function initializeReels() {
    console.log('リールの初期化を開始します...');
    
    // リールのスタイルを先に設定
    document.documentElement.style.setProperty('--symbol-height', `${window.SYMBOL_HEIGHT}px`);
    
    for (let i = 0; i < 3; i++) {
        if (!reelElements[i]) {
            console.error(`リール${i}の要素が見つかりません`);
            continue;
        }
        
        // 内部要素がなければ作成
        if (!reelInnerElements[i]) {
            console.log(`リール${i}の内部要素が見つからないため作成します`);
            const innerEl = document.createElement('div');
            innerEl.classList.add('reel-inner');
            innerEl.id = `reel-inner-${i}`;
            reelElements[i].innerHTML = ''; // 既存の内容をクリア
            reelElements[i].appendChild(innerEl);
            reelInnerElements[i] = innerEl;
        }
        
        // リールレイアウトからシンボルを取得
        let symbols = [];
        
        // リールレイアウトがある場合は使用
        if (typeof REEL_LAYOUTS !== 'undefined' && REEL_LAYOUTS[i]) {
            // 無限ループのために十分な数のシンボルを用意（21個）
            const layout = REEL_LAYOUTS[i];
            const repeatedSymbols = [];
            while (repeatedSymbols.length < 21) {
                repeatedSymbols.push(...layout);
            }
            symbols = repeatedSymbols.slice(0, 21);
        } else {
            // ダミーシンボルを作成
            console.warn(`リール${i}のレイアウトが定義されていないのでダミーシンボルを使用します`);
            const symbolTypes = [0, 1, 2, 3, 4, 5]; // 0=ベル, 1=リプレイ, ...
            symbols = Array.from({ length: 21 }, (_, j) => symbolTypes[j % symbolTypes.length]);
        }
        
        // リールの内部要素をクリア
        reelInnerElements[i].innerHTML = '';
        
        // リールの高さを設定（シンボル数 × シンボル高さ）
        const reelHeight = symbols.length * window.SYMBOL_HEIGHT;
        reelInnerElements[i].style.height = `${reelHeight}px`;
        console.log(`リール${i}の高さを設定: ${reelHeight}px`);
        
        // シンボル要素の追加
        symbols.forEach((symbolType, j) => {
            const symbolElement = document.createElement('div');
            symbolElement.classList.add('symbol');
            
            // シンボルクラスの追加
            const symbolClass = getSymbolClassName(symbolType);
            if (symbolClass) {
                symbolElement.classList.add(symbolClass);
            }
            
            // シンボルの高さと幅を固定
            symbolElement.style.height = `${window.SYMBOL_HEIGHT}px`;
            symbolElement.style.width = '100%';
            
            // 絶対位置指定
            symbolElement.style.position = 'absolute';
            symbolElement.style.top = `${j * window.SYMBOL_HEIGHT}px`;
            
            // シンボル内に図柄名を表示
            symbolElement.textContent = getSymbolDisplayName(symbolType);
            
            // 境界線を追加して視認性向上
            symbolElement.style.border = '2px solid #333';
            symbolElement.style.boxSizing = 'border-box';
            
            // シンボル要素をリール内部に追加
            reelInnerElements[i].appendChild(symbolElement);
        });
        
        // リールの可視エリア設定（3シンボル分の高さ）
        reelElements[i].style.height = `${window.SYMBOL_HEIGHT * 3}px`;
        reelElements[i].style.overflow = 'hidden';
        
        // 3×3のグリッドマーカーを追加
        const gridOverlay = document.createElement('div');
        gridOverlay.classList.add('reel-grid');
        
        // 上中下段のグリッドセルを作成
        for (let row = 0; row < 3; row++) {
            const gridCell = document.createElement('div');
            gridCell.classList.add('grid-cell');
            
            // 中段のセルには特別なクラスを追加
            if (row === 1) {
                gridCell.classList.add('center');
            }
            
            gridOverlay.appendChild(gridCell);
        }
        
        // グリッドをリールに追加
        reelElements[i].appendChild(gridOverlay);
        
        console.log(`リール${i}の初期化完了`);
    }
    
    console.log('すべてのリールの初期化が完了しました');
}

/**
 * ダミーのリール画像を作成する関数
 */
function createDummyReelImage(reelIndex, symbols = []) {
    console.log(`リール${reelIndex}のダミー画像を作成します`);
    
    // シンボル高さのデフォルト値設定
    if (typeof window.SYMBOL_HEIGHT === 'undefined') {
        window.SYMBOL_HEIGHT = 50;
        console.log('SYMBOL_HEIGHT未定義のため、デフォルト値50pxを使用します');
    }
    
    // 無限ループ表示のため、十分な数のシンボルを用意
    // 最低でも21個のシンボルがあると滑らかなループになる
    if (symbols.length < 21) {
        // リールレイアウトがある場合はそこから取得
        if (typeof REEL_LAYOUTS !== 'undefined' && REEL_LAYOUTS[reelIndex]) {
            const layout = REEL_LAYOUTS[reelIndex];
            
            // リールレイアウトを繰り返して必要な数まで増やす
            const repeatedLayout = [];
            while (repeatedLayout.length < 21) {
                repeatedLayout.push(...layout);
            }
            
            // 必要な数だけ切り出す
            symbols = repeatedLayout.slice(0, 21);
            console.log(`リール${reelIndex}のレイアウトから${symbols.length}個のシンボルを生成しました`);
        } else {
            // ダミーシンボル生成
            console.warn(`リール${reelIndex}のレイアウトが見つからないためダミーシンボルを生成します`);
            if (typeof SYMBOLS === 'undefined') {
                // SYMBOLSが定義されていない場合はダミー値を使用
                symbols = Array.from({ length: 21 }, (_, i) => i % 6);
            } else {
                const symbolTypes = [
                    SYMBOLS.SEVEN, 
                    SYMBOLS.BAR, 
                    SYMBOLS.BELL, 
                    SYMBOLS.CHERRY, 
                    SYMBOLS.WATERMELON, 
                    SYMBOLS.REPLAY
                ];
                symbols = Array.from({ length: 21 }, (_, i) => symbolTypes[i % symbolTypes.length]);
            }
            console.log(`リール${reelIndex}用に${symbols.length}個のダミーシンボルを生成しました`);
        }
    }
    
    return symbols;
}

/**
 * シンボルのクラス名を取得
 */
function getSymbolClassName(symbolType) {
    switch (symbolType) {
        case SYMBOLS.SEVEN: return 'seven';
        case SYMBOLS.BAR: return 'bar';
        case SYMBOLS.BELL: return 'bell';
        case SYMBOLS.CHERRY: return 'cherry';
        case SYMBOLS.WATERMELON: return 'watermelon';
        case SYMBOLS.REPLAY: return 'replay';
        default: return 'blank';
    }
}

/**
 * シンボルの表示名を取得
 */
function getSymbolDisplayName(symbolType) {
    switch (symbolType) {
        case SYMBOLS.SEVEN: return '7';
        case SYMBOLS.BAR: return 'BAR';
        case SYMBOLS.BELL: return 'ベル';
        case SYMBOLS.CHERRY: return 'チェリー';
        case SYMBOLS.WATERMELON: return 'スイカ';
        case SYMBOLS.REPLAY: return 'リプレイ';
        default: return '？';
    }
}

/**
 * リール停止時の位置調整（3×3グリッドに正確に合わせる）
 */
function stopReelAnimation() {
    console.log('リールアニメーション停止処理を開始');
    
    // アニメーションフラグをOFF
    animationActive = false;
    
    if (animationFrameId) {
        // アニメーションフレームをキャンセル
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // 各リールの最終位置を調整（シンボルが3×3グリッドにぴったり合うように）
    const slot = window.slotMachine;
    if (slot) {
        for (let i = 0; i < 3; i++) {
            if (!slot.reels[i].isSpinning) {
                try {
                    // SlotMachineクラスの内部位置を取得
                    const internalPosition = slot.internalPositions[i];
                    
                    // 必ずシンボルの高さの倍数になるように位置を計算
                    const position = Math.floor(internalPosition) * window.SYMBOL_HEIGHT;
                    
                    // デバッグ情報
                    console.log(`リール${i}停止位置調整: 内部位置=${internalPosition}, 表示位置=${position}px`);
                    
                    // リールの位置を調整（シンボルが1マスに収まるように）
                    // トランジションを切って即座に位置を更新
                    const reelInner = document.getElementById(`reel-inner-${i}`);
                    if (reelInner) {
                        // トランジションを一時的に無効化して即座に位置を更新
                        reelInner.style.transition = 'none';
                        reelInner.style.transform = `translateY(-${position}px)`;
                        
                        // 強制的にリフローを発生させてトランジションなしの変更を適用
                        reelInner.offsetHeight;
                        
                        // トランジションを元に戻す
                        reelInner.style.transition = 'transform 0.05s linear';
                        
                        // グリッドマーカーの中段位置を強調表示（視覚的なフィードバック）
                        const gridCells = reelElements[i].querySelectorAll('.grid-cell');
                        if (gridCells.length >= 3) {
                            // 中段のセルを強調表示（点滅させる）
                            const middleCell = gridCells[1]; // インデックス1が中段
                            if (middleCell) {
                                middleCell.style.border = '3px solid red';
                                middleCell.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
                                
                                // 一時的な強調表示（1秒後に元に戻す）
                                setTimeout(() => {
                                    middleCell.style.border = '2px solid red';
                                    middleCell.style.boxShadow = 'none';
                                }, 1000);
                            }
                        }
                    } else {
                        console.error(`リール${i}の内部要素が見つかりません`);
                    }
                } catch (error) {
                    console.error(`リール${i}の停止位置調整中にエラーが発生しました:`, error);
                }
            }
        }
        
        // 停止している全リールの最終的な表示確認
        if (slot.allReelsStopped()) {
            try {
                // 中段に表示されているシンボルを取得して表示
                const symbols = slot.getStoppedSymbols();
                const middleRow = [symbols[0][1], symbols[1][1], symbols[2][1]];
                const symbolNames = middleRow.map(symbol => slot.getSymbolName(symbol));
                
                console.log(`全リール停止完了 - 中段図柄: ${symbolNames.join(' - ')}`);
                writeLog(`停止結果: ${symbolNames.join(' - ')}`);
            } catch (error) {
                console.error('停止シンボル取得中にエラーが発生しました:', error);
            }
        }
    }
    
    console.log('リールアニメーション停止処理を完了');
}

/**
 * シンボルの位置を更新する関数（リールの表示位置調整）
 */
function updateReelDisplay(reelIndex, position) {
    const reelInner = document.getElementById(`reel-inner-${reelIndex}`);
    if (!reelInner) {
        console.error(`リール内部要素が見つかりません: reel-inner-${reelIndex}`);
        return;
    }
    
    try {
        // 位置を正確に調整（3×3グリッド表示用）
        const adjustedPosition = -position;
        
        // 位置を更新（CSS transformを使用）
        reelInner.style.transform = `translateY(${adjustedPosition}px)`;
        
        // リールの可視領域を確保
        const parentReel = reelElements[reelIndex];
        if (parentReel) {
            // リールの高さが正しく設定されていることを確認
            if (parentReel.style.height !== `${window.SYMBOL_HEIGHT * 3}px`) {
                parentReel.style.height = `${window.SYMBOL_HEIGHT * 3}px`;
            }
            
            // オーバーフロー設定を確保
            if (parentReel.style.overflow !== 'hidden') {
                parentReel.style.overflow = 'hidden';
            }
        }
        
        // デバッグログは詳細度を下げる（あまりにも多くなるので）
        if (Math.random() < 0.01) { // 約1%の確率でログ出力
            console.log(`リール${reelIndex}表示更新: position=${position}px, adjustedPosition=${adjustedPosition}px`);
        }
    } catch (error) {
        console.error(`リール${reelIndex}の表示更新中にエラーが発生しました:`, error);
    }
}

/**
 * リールアニメーションを開始する関数
 */
function startReelAnimation() {
    // アニメーションが既に実行中の場合は何もしない
    if (animationActive) return;
    
    // アニメーションフラグをON
    animationActive = true;
    
    // アニメーションループ開始
    function updateAnimation() {
        if (!animationActive) return;
        
        // 各リールの位置を更新
        const slot = window.slotMachine;
        if (slot) {
            for (let i = 0; i < 3; i++) {
                if (slot.reels[i].isSpinning) {
                    // リールの位置を取得して表示を更新
                    updateReelDisplay(i, slot.reels[i].position);
                }
            }
        }
        
        // 次のフレームをリクエスト
        animationFrameId = requestAnimationFrame(updateAnimation);
    }
    
    // アニメーション開始
    updateAnimation();
    console.log('リールアニメーション開始');
}

/**
 * ゲームログをUIに表示する
 * @param {string} message - 表示するメッセージ
 */
function writeLog(message) {
    console.log(`ログ: ${message}`);
    
    // ログ表示エリアを取得
    const logArea = document.getElementById('game-log');
    if (!logArea) {
        console.error('ログ表示エリアが見つかりません');
        return;
    }
    
    // 新しいログ要素を作成
    const logEntry = document.createElement('div');
    logEntry.classList.add('log-entry');
    
    // 時刻を追加
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // メッセージを設定
    logEntry.innerHTML = `<span class="log-time">${timeStr}</span> ${message}`;
    
    // ログエリアに追加
    logArea.appendChild(logEntry);
    
    // スクロールを最下部に移動
    logArea.scrollTop = logArea.scrollHeight;
    
    // ログが多すぎる場合は古いものを削除
    const maxLogs = 100;
    while (logArea.children.length > maxLogs) {
        logArea.removeChild(logArea.firstChild);
    }
}