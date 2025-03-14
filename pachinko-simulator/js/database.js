/**
 * IndexedDBを使用したデータ永続化
 */

class SlotDatabase {
    constructor() {
        this.db = null;
        this.dbName = 'pachinkoSimulatorDB';
        this.dbVersion = 1;
        this.storeName = 'slotData';
        this.historyStoreName = 'gameHistory';
    }
    
    /**
     * データベース接続を初期化
     */
    async init() {
        if (this.db) return this.db;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = (event) => {
                console.error('データベースエラー:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('データベース接続成功');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // スロットデータストアの作成
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                    console.log('スロットデータストア作成');
                }
                
                // ゲーム履歴ストアの作成（スランプグラフ用）
                if (!db.objectStoreNames.contains(this.historyStoreName)) {
                    const historyStore = db.createObjectStore(this.historyStoreName, { keyPath: 'gameNumber' });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('ゲーム履歴ストア作成');
                }
            };
        });
    }
    
    /**
     * スロットデータを保存
     */
    async saveSlotData(slotMachine) {
        await this.init();
        
        const data = {
            id: 'slotData',
            credit: slotMachine.credit,
            currentSetting: slotMachine.currentSetting,
            totalGames: slotMachine.totalGames,
            bigCount: slotMachine.bigCount,
            regCount: slotMachine.regCount,
            coinDifference: slotMachine.coinDifference,
            isAT: slotMachine.isAT,
            atGamesRemaining: slotMachine.atGamesRemaining,
            bonusType: slotMachine.bonusType,
            bonusGamesRemaining: slotMachine.bonusGamesRemaining,
            timestamp: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(data);
            
            request.onerror = (event) => {
                console.error('データ保存エラー:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = () => {
                console.log('スロットデータ保存成功');
                resolve();
            };
        });
    }
    
    /**
     * スロットデータをロード
     */
    async loadSlotData() {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get('slotData');
            
            request.onerror = (event) => {
                console.error('データ読み込みエラー:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = (event) => {
                if (event.target.result) {
                    console.log('スロットデータ読み込み成功');
                    resolve(event.target.result);
                } else {
                    console.log('保存されたデータがありません');
                    resolve(null);
                }
            };
        });
    }
    
    /**
     * ゲーム履歴を保存（スランプグラフ用）
     */
    async saveGameHistory(slotMachine) {
        await this.init();
        
        const data = {
            gameNumber: slotMachine.totalGames,
            credit: slotMachine.credit,
            coinDifference: slotMachine.coinDifference,
            bigCount: slotMachine.bigCount,
            regCount: slotMachine.regCount,
            setting: slotMachine.currentSetting,
            timestamp: Date.now()
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.historyStoreName], 'readwrite');
            const store = transaction.objectStore(this.historyStoreName);
            const request = store.put(data);
            
            request.onerror = (event) => {
                console.error('履歴保存エラー:', event.target.error);
                reject(event.target.error);
            };
            
            request.onsuccess = () => {
                console.log('ゲーム履歴保存成功');
                
                // 古いデータの削除処理を追加（データベースの肥大化を防止するため）
                this.cleanupOldHistory(slotMachine.totalGames, 500);
                
                resolve();
            };
        });
    }
    
    /**
     * 古いゲーム履歴を削除する
     */
    async cleanupOldHistory(currentGameNumber, keepCount) {
        if (currentGameNumber <= keepCount) return;
        
        const deletePoint = currentGameNumber - keepCount;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction([this.historyStoreName], 'readwrite');
            const store = transaction.objectStore(this.historyStoreName);
            
            // deletePoint以下のゲーム番号のデータを削除
            const keyRange = IDBKeyRange.upperBound(deletePoint);
            const request = store.delete(keyRange);
            
            request.onsuccess = () => {
                console.log(`ゲーム番号 ${deletePoint} 以下の古い履歴を削除しました`);
                resolve();
            };
            
            transaction.oncomplete = () => {
                resolve();
            };
        });
    }
    
    /**
     * ゲーム履歴を取得（スランプグラフ用）
     */
    async getGameHistory(limit = 300) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            // インデックス範囲を使用して効率的に最新データを取得
            const transaction = this.db.transaction([this.historyStoreName], 'readonly');
            const store = transaction.objectStore(this.historyStoreName);
            
            // 方法1: ゲーム番号の降順でカーソルを開く
            // 全てのレコード数を取得
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
                const totalRecords = countRequest.result;
                
                if (totalRecords === 0) {
                    resolve([]);
                    return;
                }
                
                // 取得するデータ量を調整（多すぎるデータは間引く）
                const actualLimit = Math.min(limit, totalRecords);
                const skipFactor = totalRecords > limit ? Math.floor(totalRecords / limit) : 1;
                
                // 取得すべきレコードのゲーム番号を算出
                const results = [];
                let counter = 0;
                
                // カーソルを開いてデータを収集
                const cursorRequest = store.openCursor(null, 'prev');
                
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    
                    if (cursor) {
                        // データの間引き
                        if (counter % skipFactor === 0 && results.length < actualLimit) {
                            results.push(cursor.value);
                        }
                        
                        counter++;
                        cursor.continue();
                    } else {
                        // 古い順にソートして返す
                        results.sort((a, b) => a.gameNumber - b.gameNumber);
                        console.log(`${results.length}件のゲーム履歴を読み込み（全${totalRecords}件から間引き）`);
                        resolve(results);
                    }
                };
            };
            
            countRequest.onerror = (event) => {
                console.error('履歴カウントエラー:', event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    /**
     * すべてのデータをリセット
     */
    async resetAllData() {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName, this.historyStoreName], 'readwrite');
            const slotStore = transaction.objectStore(this.storeName);
            const historyStore = transaction.objectStore(this.historyStoreName);
            
            // スロットデータの削除
            const slotClearRequest = slotStore.clear();
            slotClearRequest.onerror = (event) => {
                console.error('データ削除エラー:', event.target.error);
                reject(event.target.error);
            };
            
            // 履歴データの削除
            const historyClearRequest = historyStore.clear();
            historyClearRequest.onerror = (event) => {
                console.error('履歴削除エラー:', event.target.error);
                reject(event.target.error);
            };
            
            transaction.oncomplete = () => {
                console.log('すべてのデータをリセットしました');
                resolve();
            };
        });
    }
} 