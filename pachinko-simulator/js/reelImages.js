/**
 * リールシンボル画像のBase64エンコード
 * （実際のプロジェクトでは、実際の画像ファイルを使用することを推奨します）
 */

// リール画像がロードできない場合のフォールバック用
function createReelImageData() {
    // Canvas要素を作成してシンボルを描画
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // 6種類のシンボル（ベル、リプレイ、スイカ、チェリー、BAR、7）
    const symbolHeight = 50;
    const symbolWidth = 100;
    canvas.width = symbolWidth;
    canvas.height = symbolHeight * 6;
    
    // 背景を塗りつぶし
    ctx.fillStyle = '#333';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // シンボルの色と形を描画
    const drawSymbols = [
        // ベル
        function drawBell() {
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(symbolWidth/2, symbolHeight*0.4, symbolHeight*0.25, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#cc9900';
            ctx.beginPath();
            ctx.moveTo(symbolWidth*0.3, symbolHeight*0.6);
            ctx.lineTo(symbolWidth*0.7, symbolHeight*0.6);
            ctx.lineTo(symbolWidth*0.6, symbolHeight*0.9);
            ctx.lineTo(symbolWidth*0.4, symbolHeight*0.9);
            ctx.closePath();
            ctx.fill();
        },
        // リプレイ
        function drawReplay() {
            ctx.fillStyle = '#3366ff';
            ctx.beginPath();
            ctx.arc(symbolWidth/2, symbolHeight/2, symbolHeight*0.35, 0, Math.PI*1.8);
            ctx.lineTo(symbolWidth*0.65, symbolHeight*0.35);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('RE', symbolWidth/2, symbolHeight/2);
        },
        // スイカ
        function drawWatermelon() {
            ctx.fillStyle = '#22aa22';
            ctx.beginPath();
            ctx.arc(symbolWidth/2, symbolHeight/2, symbolHeight*0.35, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#dd0000';
            ctx.beginPath();
            ctx.arc(symbolWidth/2, symbolHeight/2, symbolHeight*0.27, 0, Math.PI*2);
            ctx.fill();
            
            // スイカの縞模様
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 3;
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(symbolWidth*0.3, symbolHeight*(0.3 + i*0.08));
                ctx.lineTo(symbolWidth*0.7, symbolHeight*(0.3 + i*0.08));
                ctx.stroke();
            }
        },
        // チェリー
        function drawCherry() {
            // 茎
            ctx.fillStyle = 'brown';
            ctx.beginPath();
            ctx.moveTo(symbolWidth*0.5, symbolHeight*0.2);
            ctx.lineTo(symbolWidth*0.5, symbolHeight*0.5);
            ctx.lineTo(symbolWidth*0.55, symbolHeight*0.5);
            ctx.lineTo(symbolWidth*0.55, symbolHeight*0.2);
            ctx.closePath();
            ctx.fill();
            
            // 左側の実
            ctx.fillStyle = '#cc0000';
            ctx.beginPath();
            ctx.arc(symbolWidth*0.4, symbolHeight*0.65, symbolHeight*0.2, 0, Math.PI*2);
            ctx.fill();
            
            // 右側の実
            ctx.beginPath();
            ctx.arc(symbolWidth*0.6, symbolHeight*0.65, symbolHeight*0.2, 0, Math.PI*2);
            ctx.fill();
            
            // ハイライト
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(symbolWidth*0.45, symbolHeight*0.6, symbolHeight*0.05, 0, Math.PI*2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(symbolWidth*0.65, symbolHeight*0.6, symbolHeight*0.05, 0, Math.PI*2);
            ctx.fill();
        },
        // BAR
        function drawBar() {
            ctx.fillStyle = 'black';
            ctx.fillRect(symbolWidth*0.2, symbolHeight*0.3, symbolWidth*0.6, symbolHeight*0.4);
            ctx.strokeStyle = 'gold';
            ctx.lineWidth = 2;
            ctx.strokeRect(symbolWidth*0.2, symbolHeight*0.3, symbolWidth*0.6, symbolHeight*0.4);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('BAR', symbolWidth/2, symbolHeight/2);
        },
        // 7
        function drawSeven() {
            ctx.fillStyle = '#ff3333';
            ctx.beginPath();
            ctx.arc(symbolWidth/2, symbolHeight/2, symbolHeight*0.35, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('7', symbolWidth/2, symbolHeight/2);
        }
    ];
    
    // 各シンボルを描画
    for (let i = 0; i < drawSymbols.length; i++) {
        ctx.save();
        ctx.translate(0, i * symbolHeight);
        drawSymbols[i]();
        ctx.restore();
    }
    
    // Base64エンコードしたデータURLを返す
    return canvas.toDataURL('image/png');
}

// 画像ロード時にリールの背景画像として設定
function loadReelImages() {
    const reelImageData = createReelImageData();
    const reelElements = document.querySelectorAll('.reel-inner');
    
    reelElements.forEach(element => {
        element.style.backgroundImage = `url(${reelImageData})`;
        element.style.backgroundSize = '100% auto';
    });
} 