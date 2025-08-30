// 1. 获取HTML元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const loadingMessage = document.getElementById('loading-message');
const scoreDisplay = document.getElementById('score-display');
const scoreElement = document.getElementById('score-display'); // 用于更新分数文本

// 2. 初始化设置
let ocrWorker = null;
let isOcrReady = false;

// 异步函数：初始化OCR Worker
async function initializeOcr() {
    try {
        // 创建一个Tesseract worker实例
        ocrWorker = await Tesseract.createWorker('eng', 1, {
            logger: m => console.log(m), // 在控制台输出进度
        });
        
        // 设置只识别数字、小数点和加号（有时手写分数会带'+'）
        await ocrWorker.setParameters({
            tessedit_char_whitelist: '0123456789.+',
        });

        console.log("OCR Worker 初始化完成。");
        isOcrReady = true;
        loadingMessage.style.display = 'none'; // 隐藏加载信息
        scoreDisplay.style.display = 'block'; // 显示分数区域
    } catch (error) {
        console.error("OCR 初始化失败:", error);
        loadingMessage.innerText = "OCR 加载失败，请刷新页面。";
    }
}


// 3. 访问摄像头
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                // 优先使用后置摄像头
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            // 根据视频尺寸设置canvas尺寸
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            // 开始处理视频帧
            processFrames();
            // 每隔2秒运行一次OCR识别
            setInterval(runOcr, 2000);
        });
    } catch (err) {
        console.error("摄像头访问失败:", err);
        alert("无法访问摄像头。请检查权限设置并刷新页面。");
    }
}

// 4. 实时处理视频帧并应用滤镜
function processFrames() {
    // 将视频当前帧绘制到canvas上
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 获取canvas的像素数据
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 遍历每一个像素点 (每4个值为一个像素 R, G, B, A)
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 核心滤镜逻辑：判断是否为红色
        // 条件：红色分量远大于绿色和蓝色分量，且红色分量达到一定阈值
        if (r > 100 && r > g * 1.5 && r > b * 1.5) {
            // 如果是红色，保留原色 (或者可以增强)
            data[i] = 255;     // R
            data[i + 1] = 0;   // G
            data[i + 2] = 0;   // B
        } else {
            // 如果不是红色，变为白色（高曝光效果）
            data[i] = 255;     // R
            data[i + 1] = 255; // G
            data[i + 2] = 255; // B
        }
    }
    
    // 将处理后的像素数据放回canvas
    ctx.putImageData(imageData, 0, 0);

    // 持续循环处理
    requestAnimationFrame(processFrames);
}

// 5. 运行OCR识别
async function runOcr() {
    if (!isOcrReady || !ocrWorker) {
        console.log("OCR尚未准备好。");
        return;
    }

    console.log("正在进行OCR识别...");
    
    // 从canvas获取图像数据进行识别
    const { data: { text } } = await ocrWorker.recognize(canvas);
    console.log("识别结果:", text);
    
    // 6. 解析结果并计算总分
    calculateScore(text);
}

// 6. 解析文本并计算分数
function calculateScore(text) {
    // 使用正则表达式找出所有数字（包括小数）
    const numbers = text.match(/(\d+\.?\d*)/g);
    
    if (!numbers) {
        console.log("未找到数字。");
        return;
    }

    let totalScore = 0;
    // 遍历找到的数字字符串，转换为数字并相加
    numbers.forEach(numStr => {
        const num = parseFloat(numStr);
        if (!isNaN(num)) {
            totalScore += num;
        }
    });

    console.log("计算出的总分:", totalScore);
    
    // 7. 更新界面上的分数
    scoreElement.innerText = `总分: ${totalScore.toFixed(1)}`; // 保留一位小数
}


// --- 程序入口 ---
initializeOcr(); // 首先开始加载OCR
setupCamera();   // 同时请求摄像头权限
