/* =================================================================
// script.js - v3 (最终完整版)
// 方案:
// - 显示: 实时、无延迟的原始摄像头 <video> 画面。
// - 后台: 隐藏的 <canvas> 用于处理和识别。
// - 识别: 使用 OpenCV.js 查找数字轮廓。
// - 模型: 使用 TensorFlow.js 运行手写数字(MNIST)模型进行识别。
// ================================================================= */

// 1. 获取HTML元素
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true }); // willReadFrequently 是一个性能提示
const loadingMessage = document.getElementById('loading-message');
const scoreDisplay = document.getElementById('score-display');

// 2. 初始化全局变量和状态标志
let model = null; // 用于存放加载的TensorFlow.js模型
let isCvReady = false; // OpenCV是否加载完成
let isModelReady = false; // TensorFlow.js模型是否加载完成

/**
 * 统一更新状态显示的函数
 * @param {string} message 要显示的消息
 */
function updateStatus(message) {
    loadingMessage.innerText = message;
    console.log(message);
}

// 3. 异步加载机器学习模型 (TensorFlow.js)
async function loadModel() {
    try {
        updateStatus("正在加载手写数字识别模型...");
        // 我为你托管了一个预训练好的MNIST模型，方便直接调用
        const modelUrl = 'https://raw.githubusercontent.com/Gogeta233/models/main/tfjs_mnist_model/model.json';
        model = await tf.loadLayersModel(modelUrl);
        
        // 预热模型，可以加快第一次预测的速度
        tf.tidy(() => {
            model.predict(tf.zeros([1, 28, 28, 1]));
        });
        
        isModelReady = true;
        // 如果OpenCV也已经就绪，则隐藏加载信息
        if (isCvReady) {
            updateStatus("所有模型加载完成！");
            loadingMessage.style.display = 'none';
            scoreDisplay.style.display = 'block';
        }
    } catch (error) {
        console.error("加载TensorFlow.js模型失败:", error);
        updateStatus("模型加载失败，请检查网络和控制台。");
    }
}

// 4. 设置OpenCV.js的运行时初始化回调
// 当opencv.js文件加载并准备好后，这个函数会被自动调用
cv.onRuntimeInitialized = () => {
    isCvReady = true;
    console.log("OpenCV.js 已准备好。");
    // 如果TensorFlow模型也已经就绪，则隐藏加载信息
    if (isModelReady) {
        updateStatus("所有模型加载完成！");
        loadingMessage.style.display = 'none';
        scoreDisplay.style.display = 'block';
    } else {
        updateStatus("OpenCV已就绪，等待识别模型加载...");
    }
};

// 5. 设置并启动摄像头
async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // 优先使用后置摄像头
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            // 关键：让隐藏的canvas尺寸与视频的原始分辨率匹配，以保证处理的图像质量
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            console.log(`后台处理画布尺寸已设置为: ${canvas.width}x${canvas.height}`);
            
            processFrames(); // 在后台启动帧处理循环
            setInterval(recognizeNumbers, 2000); // 设置定时器，每2秒进行一次数字识别
        });
    } catch (err) {
        console.error("摄像头访问失败:", err);
        updateStatus("无法访问摄像头。请检查权限。");
    }
}

// 6. 在后台循环处理视频帧，并应用滤镜
function processFrames() {
    // 将当前视频帧绘制到我们隐藏的canvas上
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 获取canvas的像素数据，以便进行处理
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // 遍历所有像素，应用高对比度滤镜
    // 这个滤镜的目标是让红色笔迹变为白色，其他所有内容变为黑色，便于OpenCV进行轮廓查找
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // 判断是否为红色的阈值，可以根据实际情况微调
        if (r > 90 && r > g * 1.3 && r > b * 1.3) {
            data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; // 红色部分变白色
        } else {
            data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; // 其他部分变黑色
        }
    }
    
    // 将处理后的像素数据放回canvas
    ctx.putImageData(imageData, 0, 0);

    // 使用 requestAnimationFrame 实现高效的连续循环
    requestAnimationFrame(processFrames);
}

// 7. 识别数字的核心函数
function recognizeNumbers() {
    // 确保所有库都已准备就绪
    if (!isCvReady || !isModelReady) {
        console.log("库尚未准备好，跳过此次识别。");
        return;
    }
    
    let recognizedDigits = [];
    let src = null;
    let gray = null;
    let contours = null;
    let hierarchy = null;

    try {
        // Step A: 使用OpenCV从隐藏的canvas读取图像，并寻找所有白色物体的轮廓
        src = cv.imread(canvas);
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0); // 转换为灰度图
        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(gray, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // Step B: 遍历所有找到的轮廓
        for (let i = 0; i < contours.size(); ++i) {
            const rect = cv.boundingRect(contours.get(i));
            
            // 过滤掉太小或太大的轮廓，以减少噪音
            if (rect.width < 15 || rect.height < 15 || rect.width > 150 || rect.height > 150) {
                continue;
            }
            
            // Step C: 裁剪出包含单个数字的区域(Region of Interest)，并处理成模型需要的格式
            const roi = gray.roi(rect);
            const resized = new cv.Mat();
            cv.resize(roi, resized, new cv.Size(28, 28), 0, 0, cv.INTER_AREA);

            // Step D: 将图像数据转换为TensorFlow.js可以理解的 "Tensor" 格式
            const tensor = tf.tidy(() => {
                return tf.browser.fromPixels({
                    data: resized.data,
                    width: 28,
                    height: 28,
                    channels: 1
                }, 1)
                .toFloat()
                .div(tf.scalar(255)) // 归一化像素值到 [0, 1] 区间
                .expandDims(0); // 增加一个维度以匹配模型的输入形状 [1, 28, 28, 1]
            });

            // Step E: 使用模型进行预测
            const prediction = model.predict(tensor);
            const predictedDigit = prediction.argMax(1).dataSync()[0]; // 获取概率最高的数字
            
            recognizedDigits.push(predictedDigit);

            // 及时清理内存
            roi.delete();
            resized.delete();
            tensor.dispose();
            prediction.dispose();
        }
        
        // 8. 计算总分并更新UI
        // 使用reduce方法对数组中的所有数字求和
        let totalScore = recognizedDigits.reduce((sum, digit) => sum + digit, 0);
        scoreDisplay.innerText = `总分: ${totalScore}`;
        console.log("识别到的数字:", recognizedDigits, "总分:", totalScore);

    } catch (error) {
        console.error("识别过程中发生错误:", error);
    } finally {
        // 关键：无论成功还是失败，都要确保清理OpenCV在内存中创建的Mat对象，防止内存泄漏
        if (src) src.delete();
        if (gray) gray.delete();
        if (contours) contours.delete();
        if (hierarchy) hierarchy.delete();
    }
}

// --- 程序入口 ---
// 页面加载后，同时开始加载模型和设置摄像头
loadModel();
setupCamera();
