/**
 * リールデータとシンボル情報の定義
 */

// シンボルの種類
const SYMBOLS = {
    BELL: 0,
    REPLAY: 1,
    WATERMELON: 2, // スイカ
    CHERRY: 3,
    BAR: 4,
    SEVEN: 5
};

// 各リールのシンボル配置（各リール20コマ）
const REEL_LAYOUTS = [
    // 左リール
    [
        SYMBOLS.BELL, SYMBOLS.REPLAY, SYMBOLS.WATERMELON, SYMBOLS.CHERRY, SYMBOLS.BAR,
        SYMBOLS.REPLAY, SYMBOLS.BELL, SYMBOLS.REPLAY, SYMBOLS.WATERMELON, SYMBOLS.SEVEN,
        SYMBOLS.BELL, SYMBOLS.REPLAY, SYMBOLS.WATERMELON, SYMBOLS.CHERRY, SYMBOLS.BAR,
        SYMBOLS.REPLAY, SYMBOLS.BELL, SYMBOLS.REPLAY, SYMBOLS.WATERMELON, SYMBOLS.SEVEN
    ],
    // 中リール
    [
        SYMBOLS.REPLAY, SYMBOLS.WATERMELON, SYMBOLS.CHERRY, SYMBOLS.BELL, SYMBOLS.REPLAY,
        SYMBOLS.BELL, SYMBOLS.REPLAY, SYMBOLS.WATERMELON, SYMBOLS.SEVEN, SYMBOLS.REPLAY,
        SYMBOLS.BELL, SYMBOLS.BAR, SYMBOLS.CHERRY, SYMBOLS.BELL, SYMBOLS.REPLAY,
        SYMBOLS.BELL, SYMBOLS.REPLAY, SYMBOLS.WATERMELON, SYMBOLS.SEVEN, SYMBOLS.REPLAY
    ],
    // 右リール
    [
        SYMBOLS.WATERMELON, SYMBOLS.CHERRY, SYMBOLS.BELL, SYMBOLS.REPLAY, SYMBOLS.BELL,
        SYMBOLS.WATERMELON, SYMBOLS.SEVEN, SYMBOLS.REPLAY, SYMBOLS.BELL, SYMBOLS.REPLAY,
        SYMBOLS.WATERMELON, SYMBOLS.CHERRY, SYMBOLS.BAR, SYMBOLS.REPLAY, SYMBOLS.BELL,
        SYMBOLS.WATERMELON, SYMBOLS.SEVEN, SYMBOLS.REPLAY, SYMBOLS.BELL, SYMBOLS.REPLAY
    ]
];

// 成立役の定義と払い出し枚数
const WINNING_COMBINATIONS = {
    // リプレイ
    REPLAY: {
        symbols: [SYMBOLS.REPLAY, SYMBOLS.REPLAY, SYMBOLS.REPLAY],
        payout: 0, // 自動的に再プレイされる
        isReplay: true
    },
    // ベル
    BELL: {
        symbols: [SYMBOLS.BELL, SYMBOLS.BELL, SYMBOLS.BELL],
        payout: 5, // 通常時は5枚、ボーナス中は11枚に変更
        bonusPayout: 11
    },
    // スイカ
    WATERMELON: {
        symbols: [SYMBOLS.WATERMELON, SYMBOLS.WATERMELON, SYMBOLS.WATERMELON],
        payout: 10
    },
    // チェリー（左リールのみ）
    CHERRY: {
        symbols: [SYMBOLS.CHERRY, null, null], // 左リールのみチェリー
        payout: 2
    },
    // チェリー確定役（左リール中段チェリー）
    CHERRY_GUARANTEE: {
        symbols: [SYMBOLS.CHERRY, null, null], // 特殊条件で判定
        payout: 2,
        isBigBonus: true // 確定でBIGボーナス
    },
    // リーチ目役
    REACH: {
        symbols: [SYMBOLS.WATERMELON, SYMBOLS.WATERMELON, SYMBOLS.WATERMELON], // 特殊位置で判定
        payout: 0,
        isBonus: true // ボーナス確定
    }
};

// 設定別ボーナス確率
const BONUS_PROBABILITIES = [
    // 設定1
    {
        BIG: 1/300,
        REG: 1/400
    },
    // 設定2
    {
        BIG: 1/280,
        REG: 1/380
    },
    // 設定3
    {
        BIG: 1/260,
        REG: 1/360
    },
    // 設定4
    {
        BIG: 1/240,
        REG: 1/340
    },
    // 設定5
    {
        BIG: 1/220,
        REG: 1/320
    },
    // 設定6
    {
        BIG: 1/200,
        REG: 1/300
    }
];

// チェリー、スイカからのボーナス抽選確率（設定別）
const BONUS_FROM_SYMBOL = [
    // 設定1
    {
        CHERRY: { BIG: 1/250, REG: 1/350 },
        WATERMELON: { BIG: 1/200, REG: 1/300 }
    },
    // 設定2
    {
        CHERRY: { BIG: 1/230, REG: 1/330 },
        WATERMELON: { BIG: 1/180, REG: 1/280 }
    },
    // 設定3
    {
        CHERRY: { BIG: 1/210, REG: 1/310 },
        WATERMELON: { BIG: 1/160, REG: 1/260 }
    },
    // 設定4
    {
        CHERRY: { BIG: 1/190, REG: 1/290 },
        WATERMELON: { BIG: 1/140, REG: 1/240 }
    },
    // 設定5
    {
        CHERRY: { BIG: 1/170, REG: 1/270 },
        WATERMELON: { BIG: 1/120, REG: 1/220 }
    },
    // 設定6
    {
        CHERRY: { BIG: 1/150, REG: 1/250 },
        WATERMELON: { BIG: 1/100, REG: 1/200 }
    }
];

// シンボルの高さ（ピクセル）- CSSと合わせる
const SYMBOL_HEIGHT = 50; 