/**
 * スロットマシンのメインロジック
 */

class SlotMachine {
    constructor() {
        // 基本パラメータ
        this.reels = [
            { position: 0, isSpinning: false, stopPosition: null, animationId: null, startTime: null, speed: 0 },
            { position: 0, isSpinning: false, stopPosition: null, animationId: null, startTime: null, speed: 0 },
            { position: 0, isSpinning: false, stopPosition: null, animationId: null, startTime: null, speed: 0 }
        ];

        // ゲーム状態
        this.credit = 1000; // 初期クレジット
        this.bet = 3; // 毎回3枚ベット
        this.gameState = 'ready'; // ready, bet_placed, spinning, bonus
        this.bonusType = null; // BIG, REG
        this.bonusGamesRemaining = 0;
        this.currentSetting = 1; // 設定1-6
        this.isAT = false; // アシストタイム状態
        this.atGamesRemaining = 0;

        // 統計データ
        this.totalGames = 0;
        this.bigCount = 0;
        this.regCount = 0;
        this.coinDifference = 0;

        // 現在の成立役
        this.currentWin = null;

        // リール回転の物理パラメータ
        this.spinSpeed = 50; // リールの回転スピード（大きくすると速くなる）
        this.reelStopDelay = 80; // ボタン押下からリール停止までの遅延（ミリ秒）
        
        // 目押し難易度（1.0 = 標準、0.5 = 簡単（引き込み強）、2.0 = 難しい（引き込み弱））
        this.stopDifficulty = 1.0;

        // リール内部データ（ランダムな値で初期化）
        this.internalPositions = [
            Math.floor(Math.random() * REEL_LAYOUTS[0].length),
            Math.floor(Math.random() * REEL_LAYOUTS[1].length),
            Math.floor(Math.random() * REEL_LAYOUTS[2].length)
        ];
    }

    /**
     * BETボタン処理
     */
    placeBet() {
        // ゲーム状態がready以外の場合は処理しない
        if (this.gameState !== 'ready') {
            console.log('ゲーム状態が ready ではないためBETできません: ' + this.gameState);
            return false;
        }

        // クレジットチェック
        if (this.credit < this.bet && !this.currentWin?.isReplay) {
            console.log('クレジットが不足しています');
            return false;
        }

        // クレジット減算（リプレイの場合は減算しない）
        if (!this.currentWin?.isReplay) {
            this.credit -= this.bet;
            this.coinDifference -= this.bet;
        }

        // ゲーム状態を「リール始動待機状態」に変更
        this.gameState = 'bet_placed';
        console.log('ベットが完了しました。レバーを引いてください');

        return true;
    }

    /**
     * レバー操作処理
     */
    pullLever() {
        // ゲーム状態がbet_placedでない場合は処理しない
        if (this.gameState !== 'bet_placed') {
            console.log('ベットされていないためレバーを引けません');
            return false;
        }

        // リールの状態をチェック
        const anyReelSpinning = this.reels.some(reel => reel.isSpinning);

        // すべてのリールが停止していることを確認
        if (anyReelSpinning) {
            console.warn('リールが回転中です。停止処理を強制実行します。');
            this.reels.forEach((reel, index) => {
                if (reel.isSpinning) {
                    cancelAnimationFrame(reel.animationId);
                    reel.isSpinning = false;
                }
            });
        }

        // 役抽選
        this.determineWinningCombination();

        // ゲームカウント増加
        this.totalGames++;

        // リール回転開始
        this.startReels();

        this.gameState = 'spinning';

        // リプレイ成立している場合は次のゲームのためにリセット
        if (this.currentWin?.isReplay) {
            this.currentWin = null;
        }

        console.log('レバーが引かれました。リールが回転します');
        return true;
    }

    /**
     * 役抽選
     */
    determineWinningCombination() {
        // ボーナス中
        if (this.bonusType) {
            // ボーナス中はベル確定
            this.currentWin = WINNING_COMBINATIONS.BELL;
            return;
        }

        // 確定役（1/8192で発生するフリーズ確定役）
        if (Math.random() < 1/8192) {
            this.currentWin = WINNING_COMBINATIONS.CHERRY_GUARANTEE;
            this.bonusType = 'BIG';
            this.bonusGamesRemaining = 70; // BIGボーナスは70G
            this.bigCount++;
            return;
        }

        // リーチ目役（1/6532で発生）
        if (Math.random() < 1/6532) {
            this.currentWin = WINNING_COMBINATIONS.REACH;
            // ボーナス抽選（BIG:REG = 4:6）
            if (Math.random() < 0.4) {
                this.bonusType = 'BIG';
                this.bonusGamesRemaining = 70;
                this.bigCount++;
            } else {
                this.bonusType = 'REG';
                this.bonusGamesRemaining = 20;
                this.regCount++;
            }
            return;
        }

        // 通常抽選
        const setting = this.currentSetting - 1; // 0-indexed

        // ボーナス抽選
        if (Math.random() < BONUS_PROBABILITIES[setting].BIG) {
            this.bonusType = 'BIG';
            this.bonusGamesRemaining = 70;
            this.bigCount++;
            // 小役も同時当選させる
            this.determineRegularWin();
            return;
        }

        if (Math.random() < BONUS_PROBABILITIES[setting].REG) {
            this.bonusType = 'REG';
            this.bonusGamesRemaining = 20;
            this.regCount++;
            // 小役も同時当選させる
            this.determineRegularWin();
            return;
        }

        // 小役抽選
        this.determineRegularWin();
    }

    /**
     * 小役抽選
     */
    determineRegularWin() {
        const rand = Math.random();
        const setting = this.currentSetting - 1; // 0-indexed

        // ATモード中はリプレイとベルの確率が上昇
        if (this.isAT) {
            if (rand < 0.4) {
                this.currentWin = WINNING_COMBINATIONS.REPLAY;
            } else if (rand < 0.7) {
                this.currentWin = WINNING_COMBINATIONS.BELL;
            } else if (rand < 0.85) {
                this.currentWin = WINNING_COMBINATIONS.WATERMELON;
                // スイカからのボーナス抽選
                this.checkBonusFromSymbol('WATERMELON', setting);
            } else {
                this.currentWin = WINNING_COMBINATIONS.CHERRY;
                // チェリーからのボーナス抽選
                this.checkBonusFromSymbol('CHERRY', setting);
            }
        } else {
            // 通常時
            if (rand < 0.2) {
                this.currentWin = WINNING_COMBINATIONS.REPLAY;
            } else if (rand < 0.35) {
                this.currentWin = WINNING_COMBINATIONS.BELL;
            } else if (rand < 0.45) {
                this.currentWin = WINNING_COMBINATIONS.WATERMELON;
                // スイカからのボーナス抽選
                this.checkBonusFromSymbol('WATERMELON', setting);
            } else if (rand < 0.55) {
                this.currentWin = WINNING_COMBINATIONS.CHERRY;
                // チェリーからのボーナス抽選
                this.checkBonusFromSymbol('CHERRY', setting);
            } else {
                // はずれ
                this.currentWin = null;
            }
        }
    }

    /**
     * チェリー/スイカからのボーナス抽選
     */
    checkBonusFromSymbol(symbol, setting) {
        const bonusProb = BONUS_FROM_SYMBOL[setting][symbol];

        if (Math.random() < bonusProb.BIG) {
            this.bonusType = 'BIG';
            this.bonusGamesRemaining = 70;
            this.bigCount++;
        } else if (Math.random() < bonusProb.REG) {
            this.bonusType = 'REG';
            this.bonusGamesRemaining = 20;
            this.regCount++;
        }
    }

    /**
     * リール回転開始
     */
    startReels() {
        this.reels.forEach((reel, index) => {
            // リール状態のリセット
            reel.isSpinning = true;
            reel.stopPosition = null;
            reel.startTime = null;
            reel.speed = this.spinSpeed;
            
            // 回転開始時に少しずつタイミングをずらす（より自然な動き用）
            const startDelay = index * 100; // 各リール100msずつ遅延
            
            setTimeout(() => {
                // 内部位置をランダムに設定（範囲内に確実に収める）
                const reelLength = REEL_LAYOUTS[index].length;
                this.internalPositions[index] = Math.floor(Math.random() * reelLength);
                
                // 位置を初期化
                reel.position = this.internalPositions[index] * SYMBOL_HEIGHT;
                
                // 回転開始
                this.spinReel(index);
                
                console.log(`リール${index}回転開始: 内部位置=${this.internalPositions[index]}, 表示位置=${reel.position}px`);
            }, startDelay);
        });
    }

    /**
     * リール回転アニメーション
     */
    spinReel(reelIndex) {
        const reel = this.reels[reelIndex];
        if (!reel.isSpinning) return;

        // リール情報を取得
        const reelLayout = REEL_LAYOUTS[reelIndex];
        const reelLength = reelLayout.length;
        const reelHeight = reelLength * SYMBOL_HEIGHT;

        // 時間経過による速度変化（回転開始から時間が経つと少し遅くなる）
        if (!reel.startTime) {
            reel.startTime = Date.now();
            reel.speed = this.spinSpeed;
        } else {
            const elapsedTime = Date.now() - reel.startTime;
            
            // 回転開始から2秒後くらいから徐々に速度低下（引き込み準備）
            if (elapsedTime > 2000) {
                // 最大20%減速（なめらかに減速）
                const speedReduction = Math.min(0.2, (elapsedTime - 2000) / 5000);
                reel.speed = this.spinSpeed * (1 - speedReduction);
            }
        }

        // リール位置の更新
        reel.position += reel.speed / 30; // フレームレートで調整

        // リールが一周したら位置をリセット（無限ループのため）
        if (reel.position >= reelHeight) {
            // 完全にリセットせず、余りの位置を計算することで連続的な回転を維持
            reel.position = reel.position % reelHeight;
            
            // 内部位置も更新
            this.internalPositions[reelIndex] = Math.floor(reel.position / SYMBOL_HEIGHT) % reelLength;
            
            // デバッグログ
            console.log(`リール${reelIndex}一周完了: 新しい位置=${reel.position.toFixed(2)}px, 内部位置=${this.internalPositions[reelIndex]}`);
        }

        // 次のアニメーションフレームのリクエスト
        reel.animationId = requestAnimationFrame(() => this.spinReel(reelIndex));
    }

    /**
     * リール停止
     */
    stopReel(reelIndex) {
        // リールが回転していない場合でも、ゲーム状態がspinningであれば停止処理を行う
        if (!this.reels[reelIndex].isSpinning) {
            console.warn(`リール${reelIndex}は既に停止しています`);

            // すべてのリールが停止したか確認
            if (this.allReelsStopped() && this.gameState === 'spinning') {
                // ゲーム状態をreadyに戻す
                console.log('すべてのリールが停止済みです。結果を評価します。');
                this.evaluateResult();
            }

            return false;
        }

        // ゲーム状態がspinningでなくても、リールが回転している場合は停止させる
        if (this.gameState !== 'spinning') {
            console.warn('ゲーム状態が spinning ではありませんが、リールを停止します');
        }

        // 成立役に応じた停止位置を決定
        const reelLength = REEL_LAYOUTS[reelIndex].length;
        
        // 停止ボタンのタイミングを記録（デバッグ用）
        const rawPosition = this.reels[reelIndex].position;
        const currentPosition = Math.floor(rawPosition / SYMBOL_HEIGHT) % reelLength;
        console.log(`リール${reelIndex}停止ボタン押下: 生の位置=${rawPosition.toFixed(2)}px, コマ位置=${currentPosition}, symbolHeight=${SYMBOL_HEIGHT}`);
        
        // 成立役に基づいた停止位置の決定（タイミングは考慮しない）
        const stopPosition = this.determineStopPosition(reelIndex, currentPosition);
        
        // 範囲チェック（念のため）
        const validatedStopPosition = (stopPosition + reelLength) % reelLength;
        this.reels[reelIndex].stopPosition = validatedStopPosition;
        
        // デバッグ情報
        console.log(`リール${reelIndex}停止位置確定: 停止位置=${validatedStopPosition}, 図柄=${this.getSymbolName(REEL_LAYOUTS[reelIndex][validatedStopPosition])}`);

        // リールの停止アニメーション開始
        setTimeout(() => {
            // アニメーションを停止
            cancelAnimationFrame(this.reels[reelIndex].animationId);
            this.reels[reelIndex].isSpinning = false;

            // 内部位置を確定した停止位置に設定
            this.internalPositions[reelIndex] = validatedStopPosition;
            
            // 表示位置も正確に調整（シンボルの高さの倍数）
            this.reels[reelIndex].position = validatedStopPosition * SYMBOL_HEIGHT;
            
            // デバッグ情報（実際の表示位置とシンボル名を含める）
            console.log(`リール${reelIndex}を停止完了: 内部位置=${validatedStopPosition}, 表示位置=${this.reels[reelIndex].position}px, シンボル=${this.getSymbolName(REEL_LAYOUTS[reelIndex][validatedStopPosition])}`);

            // すべてのリールが停止したか確認
            if (this.allReelsStopped()) {
                // 結果を評価する
                this.evaluateResult();
                
                // ゲーム状態が変更されていない場合は明示的に更新
                if (this.gameState !== 'ready') {
                    this.gameState = 'ready';
                    console.log('ゲーム状態を強制的に ready に更新しました');
                }
            }
        }, this.reelStopDelay);

        return true;
    }

    /**
     * 停止位置の決定
     * @param {number} reelIndex - リールのインデックス
     * @param {number} currentPosition - ボタンを押した時のリール位置
     */
    determineStopPosition(reelIndex, currentPosition = 0) {
        // 成立役と停止リールに応じて制御位置を決定
        const reelLayout = REEL_LAYOUTS[reelIndex];
        const reelLength = reelLayout.length;
        
        // 現在位置が確実にリール範囲内になるよう修正
        currentPosition = ((currentPosition % reelLength) + reelLength) % reelLength;
        
        console.log(`リール${reelIndex}停止位置決定開始: 現在位置=${currentPosition}, 成立役=${this.currentWin ? this.getSymbolName(this.currentWin.symbols[reelIndex]) : 'なし'}`);
        
        // 成立役を最優先で実現する
        // デフォルトの停止位置（見つからない場合のフォールバック）
        let targetPosition = -1;
        
        // 成立役がある場合は、その役に応じた停止位置を決定
        if (this.currentWin) {
            // その他の役は中段に期待する図柄が揃うように制御
            if (this.currentWin.symbols[reelIndex] !== null) {
                const targetSymbol = this.currentWin.symbols[reelIndex];
                
                // チェリー確定役は左リール中段に
                if (this.currentWin === WINNING_COMBINATIONS.CHERRY_GUARANTEE && reelIndex === 0) {
                    targetPosition = this.findSymbolPositionForRow(reelIndex, SYMBOLS.CHERRY, 1);
                    console.log(`チェリー確定役: リール${reelIndex}中段にチェリーを配置 位置=${targetPosition}`);
                }
                // 通常のチェリーは左リールの上か下に
                else if (this.currentWin === WINNING_COMBINATIONS.CHERRY && reelIndex === 0) {
                    // 上段または下段に停止するように
                    const row = Math.random() < 0.5 ? 0 : 2;
                    targetPosition = this.findSymbolPositionForRow(reelIndex, SYMBOLS.CHERRY, row);
                    console.log(`チェリー役: リール${reelIndex}の${row === 0 ? '上段' : '下段'}にチェリーを配置 位置=${targetPosition}`);
                }
                // リーチ目役の特殊制御
                else if (this.currentWin === WINNING_COMBINATIONS.REACH) {
                    if (reelIndex === 0) {
                        // 左リール上段にスイカ
                        targetPosition = this.findSymbolPositionForRow(reelIndex, SYMBOLS.WATERMELON, 0);
                    } else if (reelIndex === 1) {
                        // 中リール中段にスイカ
                        targetPosition = this.findSymbolPositionForRow(reelIndex, SYMBOLS.WATERMELON, 1);
                    } else {
                        // 右リール上段にスイカ
                        targetPosition = this.findSymbolPositionForRow(reelIndex, SYMBOLS.WATERMELON, 0);
                    }
                    console.log(`リーチ目役: リール${reelIndex}の${reelIndex === 1 ? '中段' : '上段'}にスイカを配置 位置=${targetPosition}`);
                }
                // 通常の成立役
                else {
                    // 中段に期待する図柄が揃うように
                    targetPosition = this.findSymbolPositionForRow(reelIndex, targetSymbol, 1);
                    console.log(`通常役成立: リール${reelIndex}中段に${this.getSymbolName(targetSymbol)}を配置 位置=${targetPosition}`);
                }
                
                // 対象のシンボルが見つからなかった場合
                if (targetPosition === -1) {
                    console.warn(`リール${reelIndex}で${this.getSymbolName(targetSymbol)}図柄の停止位置が見つかりませんでした`);
                    
                    // 代替策：対象のシンボルをリール上に直接探す
                    for (let i = 0; i < reelLength; i++) {
                        if (reelLayout[i] === targetSymbol) {
                            targetPosition = i;
                            console.log(`代替位置を見つけました: リール${reelIndex}の位置${i}に${this.getSymbolName(targetSymbol)}が存在します`);
                            break;
                        }
                    }
                }
            }
        }
        // ハズレの場合でも揃ったマスにならないよう調整
        else {
            // 適切な停止位置を探す（各図柄がきれいに収まるように）
            // 既に停止しているリールがある場合は、それらとかぶらないように配置
            let suitablePosition = -1;
            
            // 既に停止しているリールがあれば、その中段シンボルを取得
            const stoppedSymbols = [];
            for (let i = 0; i < reelIndex; i++) {
                if (!this.reels[i].isSpinning) {
                    const midSymbol = this.getStoppedMiddleSymbol(i);
                    if (midSymbol !== -1) {
                        stoppedSymbols.push(midSymbol);
                    }
                }
            }
            
            // ハズレらしい停止位置を探す（前のリールの中段シンボルと異なるものを中段に持ってくる）
            for (let pos = 0; pos < reelLength; pos++) {
                const symbolAtPos = reelLayout[pos];
                
                // 既に停止したリールの中段シンボルと異なるかチェック
                if (stoppedSymbols.length === 0 || !stoppedSymbols.includes(symbolAtPos)) {
                    suitablePosition = pos;
                    break;
                }
            }
            
            // 適切な位置が見つからない場合はランダムに選択
            if (suitablePosition === -1) {
                suitablePosition = Math.floor(Math.random() * reelLength);
            }
            
            targetPosition = suitablePosition;
            console.log(`リール${reelIndex}: ハズレ役でシンボル ${this.getSymbolName(reelLayout[targetPosition])} を中段に配置`);
        }
        
        // 目標位置が見つからなかった場合、適切な位置に停止
        if (targetPosition === -1) {
            console.warn(`リール${reelIndex}の目標位置が見つかりませんでした。適切な位置を探します。`);
            // いずれかのシンボルが中段に来るように位置を調整
            targetPosition = Math.floor(Math.random() * reelLength);
        }
        
        console.log(`リール${reelIndex}最終停止位置決定: 位置=${targetPosition}, 図柄=${this.getSymbolName(reelLayout[targetPosition])}`);
        return targetPosition;
    }
    
    /**
     * 既に停止しているリールの中段シンボルを取得
     */
    getStoppedMiddleSymbol(reelIndex) {
        if (reelIndex >= 0 && reelIndex < 3 && !this.reels[reelIndex].isSpinning) {
            const validatedPos = ((this.internalPositions[reelIndex] % REEL_LAYOUTS[reelIndex].length) + REEL_LAYOUTS[reelIndex].length) % REEL_LAYOUTS[reelIndex].length;
            return REEL_LAYOUTS[reelIndex][validatedPos];
        }
        return -1;
    }
    
    /**
     * 特定の図柄が特定の段に表示される停止位置を探す
     * @param {number} reelIndex - リールのインデックス
     * @param {number} symbolType - 図柄の種類
     * @param {number} row - 段位置（0=上段、1=中段、2=下段）
     * @returns {number} 停止位置（見つからない場合は-1）
     */
    findSymbolPositionForRow(reelIndex, symbolType, row) {
        const reelLayout = REEL_LAYOUTS[reelIndex];
        const reelLength = reelLayout.length;
        
        // 各位置をチェック
        for (let i = 0; i < reelLength; i++) {
            // 指定された段に指定された図柄が来る位置を計算
            let checkPos;
            if (row === 0) { // 上段
                checkPos = (i + 1) % reelLength; // 中段位置から1コマ上
            } else if (row === 1) { // 中段
                checkPos = i; // 中段位置そのまま
            } else { // 下段
                checkPos = (i + reelLength - 1) % reelLength; // 中段位置から1コマ下
            }
            
            // 目的の図柄が見つかった場合
            if (reelLayout[checkPos] === symbolType) {
                // 確認用ログ
                console.log(`リール${reelIndex}の${row}段(${row === 0 ? '上段' : row === 1 ? '中段' : '下段'})に${symbolType}(${this.getSymbolName(symbolType)})が来る停止位置: ${i}`);
                
                // この位置で停止すると指定の図柄が指定の段に表示される
                return i;
            }
        }
        
        console.warn(`リール${reelIndex}の${row}段に${symbolType}(${this.getSymbolName(symbolType)})が来る位置が見つかりませんでした`);
        return -1; // 見つからなかった
    }

    /**
     * シンボルIDから名前を取得（デバッグ用）
     */
    getSymbolName(symbolId) {
        switch (symbolId) {
            case SYMBOLS.BELL: return 'ベル';
            case SYMBOLS.REPLAY: return 'リプレイ';
            case SYMBOLS.WATERMELON: return 'スイカ';
            case SYMBOLS.CHERRY: return 'チェリー';
            case SYMBOLS.BAR: return 'BAR';
            case SYMBOLS.SEVEN: return '7';
            default: return '不明';
        }
    }

    /**
     * 全リール停止後の処理
     */
    allReelsStopped() {
        return this.reels.every(reel => !reel.isSpinning);
    }

    /**
     * 結果を評価
     */
    evaluateResult() {
        try {
            // 停止図柄の取得
            const stoppedSymbols = this.getStoppedSymbols();

            // 配当の評価
            this.evaluateWin(stoppedSymbols);

            // ボーナス終了チェック
            if (this.bonusType && this.bonusGamesRemaining > 0) {
                this.bonusGamesRemaining--;

                if (this.bonusGamesRemaining === 0) {
                    this.endBonus();
                }
            }

            // AT終了チェック
            if (this.isAT && this.atGamesRemaining > 0) {
                this.atGamesRemaining--;

                if (this.atGamesRemaining === 0) {
                    this.isAT = false;
                }
            }

            // ゲーム状態を更新（必ず実行する）
            this.gameState = 'ready';
            console.log('ゲーム状態を ready に更新しました');

            // リプレイでない場合はcurrentWinをリセット
            if (!this.currentWin?.isReplay) {
                this.currentWin = null;
            }

            return true;
        } catch (error) {
            // エラーが発生した場合でもゲーム状態をリセット
            console.error('結果評価中にエラーが発生しました:', error);
            this.gameState = 'ready';
            console.log('エラー発生のためゲーム状態を強制的に ready にリセットしました');
            this.currentWin = null; // エラー時も成立役をリセット
            return false;
        }
    }

    /**
     * 停止したシンボルを取得
     */
    getStoppedSymbols() {
        const symbols = [];
        const debug = [];

        for (let i = 0; i < 3; i++) {
            // 内部位置を確実に取得して範囲内に収める
            const reelPos = this.internalPositions[i];
            const reelLayout = REEL_LAYOUTS[i];
            const reelLength = reelLayout.length;

            // 確実に範囲内に収める（念のため）
            const validatedReelPos = ((reelPos % reelLength) + reelLength) % reelLength;
            
            // 表示位置と内部位置の確認
            console.log(`リール${i}の表示位置確認: 内部位置=${reelPos}, 検証済み位置=${validatedReelPos}, 生の位置=${this.reels[i].position}px`);
            
            // 上中下段それぞれの位置を計算
            const upPos = (validatedReelPos - 1 + reelLength) % reelLength;  // 上段（中段から1コマ上）
            const midPos = validatedReelPos;                                // 中段
            const downPos = (validatedReelPos + 1) % reelLength;             // 下段（中段から1コマ下）

            // 対応する図柄を取得
            const upSymbol = reelLayout[upPos];
            const midSymbol = reelLayout[midPos];
            const downSymbol = reelLayout[downPos];
            
            // 各段の図柄を配列に格納
            symbols.push([upSymbol, midSymbol, downSymbol]);

            // デバッグ情報
            debug.push({
                reel: i,
                rawPosition: this.reels[i].position,
                internalPosition: reelPos,
                validatedPosition: validatedReelPos,
                positions: { up: upPos, mid: midPos, down: downPos },
                symbols: { 
                    up: this.getSymbolName(upSymbol), 
                    mid: this.getSymbolName(midSymbol), 
                    down: this.getSymbolName(downSymbol) 
                }
            });
        }

        console.log('停止図柄詳細:', debug);
        console.log('停止図柄:', symbols.map(reel => reel.map(s => this.getSymbolName(s))));
        
        // 成立役判定のための中段の図柄も表示（見やすく）
        const middleRow = [symbols[0][1], symbols[1][1], symbols[2][1]];
        console.log(`中段図柄: ${this.getSymbolName(middleRow[0])} - ${this.getSymbolName(middleRow[1])} - ${this.getSymbolName(middleRow[2])}`);
        
        return symbols;
    }

    /**
     * 役の判定と払い出し処理
     */
    evaluateWin(stoppedSymbols) {
        let payout = 0;
        let winType = 'なし';

        // 中段で揃った図柄（3リール分）
        const middleRow = [stoppedSymbols[0][1], stoppedSymbols[1][1], stoppedSymbols[2][1]];
        
        // 斜め左上から右下の図柄
        const diagonalDown = [stoppedSymbols[0][0], stoppedSymbols[1][1], stoppedSymbols[2][2]];
        
        // 斜め左下から右上の図柄
        const diagonalUp = [stoppedSymbols[0][2], stoppedSymbols[1][1], stoppedSymbols[2][0]];
        
        // 中段の図柄名（デバッグ用）
        const middleRowNames = middleRow.map(symbol => this.getSymbolName(symbol));
        const diagonalDownNames = diagonalDown.map(symbol => this.getSymbolName(symbol));
        const diagonalUpNames = diagonalUp.map(symbol => this.getSymbolName(symbol));
        
        console.log(`役判定: 中段=[${middleRowNames.join(', ')}], 斜め下=[${diagonalDownNames.join(', ')}], 斜め上=[${diagonalUpNames.join(', ')}]`);

        // チェリー確定役（左リール中段チェリー）
        if (stoppedSymbols[0][1] === SYMBOLS.CHERRY) {
            payout = WINNING_COMBINATIONS.CHERRY_GUARANTEE.payout;
            winType = 'チェリー確定役';
            console.log('チェリー確定役成立！');
        }
        // リーチ目役
        else if (stoppedSymbols[0][0] === SYMBOLS.WATERMELON &&
                 stoppedSymbols[1][1] === SYMBOLS.WATERMELON &&
                 stoppedSymbols[2][0] === SYMBOLS.WATERMELON) {
            winType = 'リーチ目役';
            console.log('リーチ目役成立！');
        }
        // 通常のチェリー（左リールの上か下にチェリー）
        else if (stoppedSymbols[0][0] === SYMBOLS.CHERRY ||
                 stoppedSymbols[0][2] === SYMBOLS.CHERRY) {
            payout = WINNING_COMBINATIONS.CHERRY.payout;
            winType = 'チェリー';
            console.log('チェリー成立！');
        }
        // その他の役
        else {
            // リプレイ
            // 中段に3つリプレイが揃う
            if (middleRow.every(symbol => symbol === SYMBOLS.REPLAY)) {
                this.currentWin = WINNING_COMBINATIONS.REPLAY;
                winType = 'リプレイ';
                console.log('リプレイ成立！');
            }
            // 斜め下がりにリプレイが揃う
            else if (diagonalDown.every(symbol => symbol === SYMBOLS.REPLAY)) {
                this.currentWin = WINNING_COMBINATIONS.REPLAY;
                winType = 'リプレイ（斜め下がり）';
                console.log('リプレイ（斜め下がり）成立！');
            }
            // 斜め上がりにリプレイが揃う
            else if (diagonalUp.every(symbol => symbol === SYMBOLS.REPLAY)) {
                this.currentWin = WINNING_COMBINATIONS.REPLAY;
                winType = 'リプレイ（斜め上がり）';
                console.log('リプレイ（斜め上がり）成立！');
            }

            // ベル
            // 中段にベルが揃う
            if (middleRow.every(symbol => symbol === SYMBOLS.BELL)) {
                payout = this.bonusType ? WINNING_COMBINATIONS.BELL.bonusPayout : WINNING_COMBINATIONS.BELL.payout;
                winType = 'ベル';
                console.log(`ベル成立！ 払出${payout}枚`);
            }
            // 斜め下がりにベルが揃う
            else if (diagonalDown.every(symbol => symbol === SYMBOLS.BELL)) {
                payout = this.bonusType ? WINNING_COMBINATIONS.BELL.bonusPayout : WINNING_COMBINATIONS.BELL.payout;
                winType = 'ベル（斜め下がり）';
                console.log(`ベル（斜め下がり）成立！ 払出${payout}枚`);
            }
            // 斜め上がりにベルが揃う
            else if (diagonalUp.every(symbol => symbol === SYMBOLS.BELL)) {
                payout = this.bonusType ? WINNING_COMBINATIONS.BELL.bonusPayout : WINNING_COMBINATIONS.BELL.payout;
                winType = 'ベル（斜め上がり）';
                console.log(`ベル（斜め上がり）成立！ 払出${payout}枚`);
            }

            // スイカ
            // 中段にスイカが揃う
            if (middleRow.every(symbol => symbol === SYMBOLS.WATERMELON)) {
                payout = WINNING_COMBINATIONS.WATERMELON.payout;
                winType = 'スイカ';
                console.log(`スイカ成立！ 払出${payout}枚`);
            }
            // 斜め下がりにスイカが揃う
            else if (diagonalDown.every(symbol => symbol === SYMBOLS.WATERMELON)) {
                payout = WINNING_COMBINATIONS.WATERMELON.payout;
                winType = 'スイカ（斜め下がり）';
                console.log(`スイカ（斜め下がり）成立！ 払出${payout}枚`);
            }
            // 斜め上がりにスイカが揃う
            else if (diagonalUp.every(symbol => symbol === SYMBOLS.WATERMELON)) {
                payout = WINNING_COMBINATIONS.WATERMELON.payout;
                winType = 'スイカ（斜め上がり）';
                console.log(`スイカ（斜め上がり）成立！ 払出${payout}枚`);
            }
            
            // 7揃い - ボーナス確定
            // 中段に7が揃う
            if (middleRow.every(symbol => symbol === SYMBOLS.SEVEN)) {
                // BIGボーナス確定
                if (!this.bonusType) {
                    this.bonusType = 'BIG';
                    this.bonusGamesRemaining = 70;
                    this.bigCount++;
                    winType = '7揃い（BIG確定）';
                    console.log('7揃い！ BIGボーナス確定！');
                }
            }
            // 斜め下がりに7が揃う
            else if (diagonalDown.every(symbol => symbol === SYMBOLS.SEVEN)) {
                // BIGボーナス確定
                if (!this.bonusType) {
                    this.bonusType = 'BIG';
                    this.bonusGamesRemaining = 70;
                    this.bigCount++;
                    winType = '7揃い（斜め下がり）（BIG確定）';
                    console.log('7揃い（斜め下がり）！ BIGボーナス確定！');
                }
            }
            // 斜め上がりに7が揃う
            else if (diagonalUp.every(symbol => symbol === SYMBOLS.SEVEN)) {
                // BIGボーナス確定
                if (!this.bonusType) {
                    this.bonusType = 'BIG';
                    this.bonusGamesRemaining = 70;
                    this.bigCount++;
                    winType = '7揃い（斜め上がり）（BIG確定）';
                    console.log('7揃い（斜め上がり）！ BIGボーナス確定！');
                }
            }
            
            // BAR揃い - REGボーナス確定
            // 中段にBARが揃う
            if (middleRow.every(symbol => symbol === SYMBOLS.BAR)) {
                // REGボーナス確定
                if (!this.bonusType) {
                    this.bonusType = 'REG';
                    this.bonusGamesRemaining = 20;
                    this.regCount++;
                    winType = 'BAR揃い（REG確定）';
                    console.log('BAR揃い！ REGボーナス確定！');
                }
            }
            // 斜め下がりにBARが揃う
            else if (diagonalDown.every(symbol => symbol === SYMBOLS.BAR)) {
                // REGボーナス確定
                if (!this.bonusType) {
                    this.bonusType = 'REG';
                    this.bonusGamesRemaining = 20;
                    this.regCount++;
                    winType = 'BAR揃い（斜め下がり）（REG確定）';
                    console.log('BAR揃い（斜め下がり）！ REGボーナス確定！');
                }
            }
            // 斜め上がりにBARが揃う
            else if (diagonalUp.every(symbol => symbol === SYMBOLS.BAR)) {
                // REGボーナス確定
                if (!this.bonusType) {
                    this.bonusType = 'REG';
                    this.bonusGamesRemaining = 20;
                    this.regCount++;
                    winType = 'BAR揃い（斜め上がり）（REG確定）';
                    console.log('BAR揃い（斜め上がり）！ REGボーナス確定！');
                }
            }
        }

        // 払い出し処理
        this.credit += payout;
        this.coinDifference += payout;
        
        console.log(`役判定結果: ${winType}, 払出: ${payout}枚`);

        // ボーナス中にBAR揃い判定（低確率でAT突入）
        if (this.bonusType && 
            ((middleRow.every(symbol => symbol === SYMBOLS.BAR)) || 
             (diagonalDown.every(symbol => symbol === SYMBOLS.BAR)) || 
             (diagonalUp.every(symbol => symbol === SYMBOLS.BAR)))) {

            if (Math.random() < 0.1) {  // 10%の確率でAT突入
                this.isAT = true;
                this.atGamesRemaining = 30 + Math.floor(Math.random() * 91);  // 30-120回転
                console.log('AT突入！ ' + this.atGamesRemaining + 'G');
            }
        }

        // リプレイでない場合は次のゲームのためにcurrentWinをリセット
        if (!this.currentWin?.isReplay) {
            this.currentWin = null;
        }
    }

    /**
     * ボーナス終了処理
     */
    endBonus() {
        this.bonusType = null;
        console.log('ボーナス終了');
    }

    /**
     * 設定変更
     */
    changeSetting(newSetting) {
        if (newSetting >= 1 && newSetting <= 6) {
            this.currentSetting = newSetting;
            return true;
        }
        return false;
    }

    /**
     * データリセット
     */
    resetData() {
        this.totalGames = 0;
        this.bigCount = 0;
        this.regCount = 0;
        this.coinDifference = 0;
    }

    /**
     * ゲーム状態の強制リセット
     * エラー発生時やゲームが応答しなくなったときに呼び出す
     */
    forceReset() {
        console.log('スロットマシンを強制リセットします');

        // リールの状態をリセット
        this.reels.forEach(reel => {
            reel.isSpinning = false;
            reel.position = 0;
        });

        // 内部位置を更新
        this.internalPositions = this.reels.map(() => 0);

        // ゲーム状態をリセット
        this.gameState = 'ready';

        // 各種フラグをリセット
        this.currentBet = 0;
        this.currentWin = null;
        this.currentBonus = null;

        console.log('強制リセット完了: 新しい状態', this.gameState);
        return true;
    }
}