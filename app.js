const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const scanBtn = document.getElementById('scanBtn');
const intervalInput = document.getElementById('intervalInput');
const scoresListEl = document.getElementById('scoresList');
const totalScoreEl = document.getElementById('totalScore');
const logEl = document.getElementById('log');

let stream = null;
let timer = null;
let worker = null;
let scores = [];

function log(msg) {
  logEl.textContent = msg;
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();

    // 设定 canvas 尺寸与 video 匹配
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    startBtn.disabled = true;
    stopBtn.disabled = false;
    scheduleScan();
    log('摄像头启动成功');
  } catch (e) {
    console.error(e);
    log('启动摄像头失败: ' + e.message);
  }
}

function stopCamera() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  log('摄像头已停止');
}

function scheduleScan() {
  const interval = Math.max(200, Number(intervalInput.value) || 1000);
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    scanOnce();
  }, interval);
}

scanBtn.addEventListener('click', scanOnce);
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
intervalInput.addEventListener('change', scheduleScan);

async function ensureWorker() {
  if (!worker) {
    worker = Tesseract.createWorker({
      logger: m => {
        // console.log(m);
      }
    });
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    // 只识别数字和小数点
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.',
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK
    });
  }
}

function extractRedMask(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  // 生成二值图：红色保留为黑色(0), 其他为白色(255)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    // 简单阈值：r 显著大于 g 和 b
    if (r > 100 && r > g + 40 && r > b + 40) {
      // keep as black (text)
      data[i] = data[i+1] = data[i+2] = 0;
      data[i+3] = 255;
    } else {
      // white
      data[i] = data[i+1] = data[i+2] = 255;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

async function scanOnce() {
  if (!stream) {
    log('请先启动摄像头');
    return;
  }
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext('2d');
  const octx = overlay.getContext('2d');

  // 把 video 当前帧 draw 到 canvas
  ctx.drawImage(video, 0, 0, w, h);

  // 提取红色（在同一个 canvas 上改写为黑白图）
  extractRedMask(ctx, w, h);

  // 给 OCR 更高成功率，可以缩放出一份中等尺寸的图像
  const tmpCanvas = document.createElement('canvas');
  const scale = 1; // 可改为 1.5 或 2 来提升 OCR 分辨率（开销增加）
  tmpCanvas.width = Math.floor(w * scale);
  tmpCanvas.height = Math.floor(h * scale);
  const tctx = tmpCanvas.getContext('2d');
  // 把处理后的图像拷贝过去
  tctx.drawImage(canvas, 0, 0, tmpCanvas.width, tmpCanvas.height);

  // OCR
  await ensureWorker();
  log('正在识别...');
  try {
    const { data } = await worker.recognize(tmpCanvas);
    // data.text 是识别到的全文本，data.words 包含每个词和位置
    const text = data.text;
    log('识别结果: ' + text.trim());

    // 绘制 overlay（清空）
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.strokeStyle = 'lime';
    octx.lineWidth = Math.max(2, Math.round(overlay.width / 400));

    // 遍历 word，尝试解析数字
    let foundAny = false;
    for (const wobj of data.words || []) {
      const str = wobj.text.replace(/[^0-9.]/g, '').trim();
      if (!str) continue;
      // 可能多次识别到如 "."、".." 等，过滤掉不合理的
      if (!/^\d+(\.\d+)?$/.test(str)) continue;
      const val = parseFloat(str);
      if (isNaN(val)) continue;
      foundAny = true;

      // 画框（Tesseract 返回的 bbox 在识别时是基于 tmpCanvas 尺寸）
      const scaleX = overlay.width / tmpCanvas.width;
      const scaleY = overlay.height / tmpCanvas.height;
      const x = Math.round(wobj.bbox.x0 * scaleX);
      const y = Math.round(wobj.bbox.y0 * scaleY);
      const ww = Math.round((wobj.bbox.x1 - wobj.bbox.x0) * scaleX);
      const hh = Math.round((wobj.bbox.y1 - wobj.bbox.y0) * scaleY);

      octx.strokeRect(x, y, ww, hh);
      octx.fillStyle = 'lime';
      octx.font = `${12 * Math.max(1, scaleX)}px sans-serif`;
      octx.fillText(str, x, Math.max(y - 2, 12));
      // 去重/累加逻辑：简单地把识别值加入列表（你可改成更复杂的去重）
      scores.push(val);
    }

    if (foundAny) {
      updateScores();
    } else {
      log('未识别到合法数字（可能角度/曝光/阈值需要调整）');
    }
  } catch (err) {
    console.error(err);
    log('识别发生错误: ' + err.message);
  }
}

function updateScores() {
  // 简单去重：保留 0.1 差距以上的新值（避免重复多帧识别）
  const unique = [];
  for (const s of scores) {
    if (!unique.some(u => Math.abs(u - s) < 0.1)) unique.push(s);
  }
  scores = unique;
  scoresListEl.textContent = JSON.stringify(scores);
  const total = scores.reduce((a, b) => a + b, 0);
  totalScoreEl.textContent = total;
}

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (worker) worker.terminate();
  stopCamera();
});