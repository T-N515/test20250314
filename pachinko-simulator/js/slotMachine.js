/**
 * スロットマシンのメインロジック
 */

class SlotMachine {
    constructor() {
        // 基本パラメータ
        this.reels = [
            { position: 0, isSpinning: false, stopPosition: null, animationId: null },
            { position: 0, isSpinning: false, stopPosition: null, animationId: null },
            { position: 0, isSpinning: false, stopPosition: null, animationId: null }
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
        console.log('レバーが引かれました。リールが回転します');
        return true;
    }
    
    /**
     * ゲーム開始（従来の互換性のため残す、内部的にplaceBetとpullLeverを呼び出す）
     */
    startGame() {
        // 既存のゲームが進行中なら中断
        if (this.gameState === 'spinning') {
            console.log('リールが回転中のためゲームを開始できません');
            return false;
        }
        
        // BETが未実行の場合は実行
        if (this.gameState === 'ready') {
            if (!this.placeBet()) {
                return false;
            }
        }
        
        // レバーを引く
        return this.pullLever();
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
            reel.isSpinning = true;
            reel.stopPosition = null;
            // 内部位置をランダムに設定
            this.internalPositions[index] = Math.floor(Math.random() * REEL_LAYOUTS[index].length);
            this.spinReel(index);
        });
    }
    
    /**
     * リール回転アニメーション
     */
    spinReel(reelIndex) {
        const reel = this.reels[reelIndex];
        if (!reel.isSpinning) return;
        
        // リール位置の更新
        reel.position += this.spinSpeed / 30; // フレームレートで調整
        
        // リールが一周したら位置をリセット
        const reelHeight = REEL_LAYOUTS[reelIndex].length * SYMBOL_HEIGHT;
        if (reel.position >= reelHeight) {
            reel.position = 0;
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
        
        // 停止位置の決定
        const stopPosition = this.determineStopPosition(reelIndex);
        this.reels[reelIndex].stopPosition = stopPosition;
        
        // 実際のリール停止は遅延を入れる
        setTimeout(() => {
            // アニメーションを停止
            cancelAnimationFrame(this.reels[reelIndex].animationId);
            this.reels[reelIndex].isSpinning = false;
            
            // 位置を停止位置に設定（シンボルが中央に表示されるように調整）
            this.internalPositions[reelIndex] = stopPosition;
            // 中段に表示されるように位置を調整（1シンボル分上にずらす）
            this.reels[reelIndex].position = stopPosition * SYMBOL_HEIGHT - SYMBOL_HEIGHT;
            
            // すべてのリールが停止したか確認
            if (this.allReelsStopped()) {
                // 結果を評価するが、UIとの連携は行わない（UIはmain.jsで処理）
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
     */
    determineStopPosition(reelIndex) {
        // 成立役と停止リールに応じて制御位置を決定
        
        // ハズレの場合
        if (!this.currentWin) {
            // ランダムな位置を返す
            return Math.floor(Math.random() * REEL_LAYOUTS[reelIndex].length);
        }
        
        // ボーナス当選中はリーチ目になるようにスイカを狙わせる
        if (this.bonusType && this.currentWin === WINNING_COMBINATIONS.REACH) {
            if (reelIndex === 0) {
                // 左リール上段にスイカが停止する位置を探す
                for (let i = 0; i < REEL_LAYOUTS[0].length; i++) {
                    if (REEL_LAYOUTS[0][i] === SYMBOLS.WATERMELON) {
                        return i;
                    }
                }
            } else if (reelIndex === 1) {
                // 中リール中段にスイカが停止する位置を探す
                for (let i = 0; i < REEL_LAYOUTS[1].length; i++) {
                    if (REEL_LAYOUTS[1][i] === SYMBOLS.WATERMELON) {
                        return i;
                    }
                }
            } else {
                // 右リール上段にスイカが停止する位置を探す
                for (let i = 0; i < REEL_LAYOUTS[2].length; i++) {
                    if (REEL_LAYOUTS[2][i] === SYMBOLS.WATERMELON) {
                        return i;
                    }
                }
            }
        }
        
        // チェリー確定役は左リール中段にチェリーが停止するように制御
        if (this.currentWin === WINNING_COMBINATIONS.CHERRY_GUARANTEE && reelIndex === 0) {
            for (let i = 0; i < REEL_LAYOUTS[0].length; i++) {
                if (REEL_LAYOUTS[0][i] === SYMBOLS.CHERRY) {
                    return i;
                }
            }
        }
        
        // 通常のチェリーは左リールのみ制御
        if (this.currentWin === WINNING_COMBINATIONS.CHERRY && reelIndex === 0) {
            for (let i = 0; i < REEL_LAYOUTS[0].length; i++) {
                if (REEL_LAYOUTS[0][i] === SYMBOLS.CHERRY) {
                    return i;
                }
            }
        }
        
        // その他の役は期待する図柄が揃うように制御
        if (this.currentWin.symbols[reelIndex] !== null) {
            const targetSymbol = this.currentWin.symbols[reelIndex];
            
            // 目標のシンボルを探す
            for (let i = 0; i < REEL_LAYOUTS[reelIndex].length; i++) {
                if (REEL_LAYOUTS[reelIndex][i] === targetSymbol) {
                    return i;
                }
            }
        }
        
        // それ以外はランダム
        return Math.floor(Math.random() * REEL_LAYOUTS[reelIndex].length);
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
            
            return true;
        } catch (error) {
            // エラーが発生した場合でもゲーム状態をリセット
            console.error('結果評価中にエラーが発生しました:', error);
            this.gameState = 'ready';
            console.log('エラー発生のためゲーム状態を強制的に ready にリセットしました');
            return false;
        }
    }
    
    /**
     * 停止したシンボルを取得
     */
    getStoppedSymbols() {
        const symbols = [];
        
        for (let i = 0; i < 3; i++) {
            const reelPos = this.internalPositions[i];
            const reelLayout = REEL_LAYOUTS[i];
            
            // 3つの位置（上中下）のシンボルを取得
            symbols.push([
                reelLayout[(reelPos - 1 + reelLayout.length) % reelLayout.length], // 上段
                reelLayout[reelPos], // 中段
                reelLayout[(reelPos + 1) % reelLayout.length] // 下段
            ]);
        }
        
        return symbols;
    }
    
    /**
     * 役の判定と払い出し処理
     */
    evaluateWin(stoppedSymbols) {
        let payout = 0;
        
        // チェリー確定役（左リール中段チェリー）
        if (stoppedSymbols[0][1] === SYMBOLS.CHERRY) {
            payout = WINNING_COMBINATIONS.CHERRY_GUARANTEE.payout;
            console.log('チェリー確定役成立！');
        }
        // リーチ目役
        else if (stoppedSymbols[0][0] === SYMBOLS.WATERMELON && 
                 stoppedSymbols[1][1] === SYMBOLS.WATERMELON && 
                 stoppedSymbols[2][0] === SYMBOLS.WATERMELON) {
            console.log('リーチ目役成立！');
        }
        // 通常のチェリー（左リールのみ）
        else if (stoppedSymbols[0][0] === SYMBOLS.CHERRY || 
                 stoppedSymbols[0][2] === SYMBOLS.CHERRY) {
            payout = WINNING_COMBINATIONS.CHERRY.payout;
            console.log('チェリー成立！');
        }
        // その他の役
        else {
            // 中段で判定
            const middleRow = [stoppedSymbols[0][1], stoppedSymbols[1][1], stoppedSymbols[2][1]];
            
            // リプレイ
            if (middleRow.every(symbol => symbol === SYMBOLS.REPLAY)) {
                console.log('リプレイ成立！');
                this.currentWin = WINNING_COMBINATIONS.REPLAY;
                return;
            }
            
            // ベル
            if (middleRow.every(symbol => symbol === SYMBOLS.BELL)) {
                payout = this.bonusType ? WINNING_COMBINATIONS.BELL.bonusPayout : WINNING_COMBINATIONS.BELL.payout;
                console.log('ベル成立！ 払出' + payout + '枚');
            }
            
            // スイカ
            if (middleRow.every(symbol => symbol === SYMBOLS.WATERMELON)) {
                payout = WINNING_COMBINATIONS.WATERMELON.payout;
                console.log('スイカ成立！ 払出' + payout + '枚');
            }
        }
        
        // 払い出し処理
        this.credit += payout;
        this.coinDifference += payout;
        
        // ボーナス中にBAR揃い判定（低確率でAT突入）
        if (this.bonusType && stoppedSymbols[0][1] === SYMBOLS.BAR && 
            stoppedSymbols[1][1] === SYMBOLS.BAR && 
            stoppedSymbols[2][1] === SYMBOLS.BAR) {
            
            if (Math.random() < 0.1) {  // 10%の確率でAT突入
                this.isAT = true;
                this.atGamesRemaining = 30 + Math.floor(Math.random() * 91);  // 30-120回転
                console.log('AT突入！ ' + this.atGamesRemaining + 'G');
            }
        }
        
        // 次のゲームのための初期化
        this.currentWin = this.currentWin?.isReplay ? this.currentWin : null;
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
        // リールの回転を強制停止
        this.reels.forEach((reel, index) => {
            if (reel.isSpinning) {
                cancelAnimationFrame(reel.animationId);
                reel.isSpinning = false;
                reel.stopPosition = null;
            }
        });
        
        // ゲーム状態をリセット
        this.gameState = 'ready';
        
        // リール位置をリセット
        this.reels.forEach((reel, index) => {
            reel.position = 0;
        });
        
        // 内部位置もリセット
        this.internalPositions = [
            Math.floor(Math.random() * REEL_LAYOUTS[0].length),
            Math.floor(Math.random() * REEL_LAYOUTS[1].length),
            Math.floor(Math.random() * REEL_LAYOUTS[2].length)
        ];
        
        console.log('ゲーム状態を強制的にリセットしました');
        return true;
    }
} 