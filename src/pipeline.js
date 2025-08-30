import { UI } from './ui.js';
import { parseDetectionsToCanvasSpace } from './util/math.js';
import { Perf } from './util/perf.js';

/*
策略：
- DOM 不旋转。视频与 overlay 始终铺满屏幕（object-fit: cover）
- 应用模式决定采样方向：
  - portrait: 将视频采样并“校正到竖向内部基准”，Worker 以竖向帧识别
  - landscape: 将视频采样并“校正到横向内部基准”，Worker 以横向帧识别
- 映射回 UI：worker 返回的 frameSize 是内部基准尺寸；统一映射到 overlay 像素
*/
export function createPipeline({ backend='tfjs', modelPath='./model/tfjs/model.json', targetFps=8, getAppMode=()=> 'portrait', onDetections, onFps }) {
  const worker = new Worker(new URL('./worker/worker.js', import.meta.url), { type: 'module' });
  let running = false;
  let offscreen;
  let lastTick = 0;
  const interval = 1000 / targetFps;
  const perf = new Perf(30);

  worker.postMessage({ type: 'init', backend, modelPath });

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'preds') {
      const overlay = UI.getOverlayEl();
      const mapped = (msg.items || []).map(it => {
        const mappedBox = parseDetectionsToCanvasSpace(it.bbox, msg.frameSize, { w: overlay.width, h: overlay.height });
        return { ...it, bboxCanvas: mappedBox };
      });
      onDetections?.(mapped, msg.diag);
      if (onFps) {
        const now = performance.now();
        const dt = now - (lastTick || now);
        if (dt > 0) { perf.push(1000/dt); onFps(perf.avg()); }
      }
    } else if (msg.type === 'error') {
      console.error('[worker] error', msg.message);
    }
  };

  async function start() {
    if (running) return;
    const video = UI.getVideoEl();
    if (!video.videoWidth || !video.videoHeight) {
      await new Promise(res => video.addEventListener('loadedmetadata', res, { once: true }));
    }

    running = true;

    const loop = async (ts) => {
      if (!running) return;
      if (!lastTick) lastTick = ts;
      if (ts - lastTick >= interval) {
        lastTick = ts;

        const mode = getAppMode() === 'landscape' ? 'landscape' : 'portrait';
        const vw = video.videoWidth, vh = video.videoHeight;

        // 内部基准尺寸：竖向用 640xH，横向用 960xH'
        const baseW = mode === 'landscape' ? 960 : 640;
        const baseH = Math.round((vh / vw) * baseW);

        // 为当前模式准备 offscreen
        if (!offscreen || offscreen.width !== baseW || offscreen.height !== baseH) {
          offscreen = new OffscreenCanvas(baseW, baseH);
        }
        const ctx = offscreen.getContext('2d', { willReadFrequently: true });
        ctx.save();
        ctx.clearRect(0,0,baseW,baseH);

        // 将视频画面以 cover 策略缩放剪裁后绘制到内部基准方向
        // 1) 计算 cover 的源裁剪区域
        const destW = baseW, destH = baseH;
        const videoAspect = vw / vh;
        const destAspect = destW / destH;
        let sx, sy, sw, sh;
        if (videoAspect > destAspect) {
          // 视频更宽，裁左右
          sh = vh;
          sw = Math.round(vh * destAspect);
          sx = Math.round((vw - sw) / 2);
          sy = 0;
        } else {
          // 视频更高，裁上下
          sw = vw;
          sh = Math.round(vw / destAspect);
          sx = 0;
          sy = Math.round((vh - sh) / 2);
        }

        // 2) 按“应用模式”在内部基准方向上绘制
        if (mode === 'portrait') {
          // 竖向：直接绘制为 baseW x baseH
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, destW, destH);
        } else {
          // 横向：将内部基准视口变为“横向认知”，方法一：旋转90度
          // 这里我们采用：先将目标画布视为横向宽度 destW，且我们需要横向内容
          // 简单做法：旋转画布坐标系 90°，把长边对齐 X 轴
          ctx.translate(destW/2, destH/2);
          ctx.rotate(Math.PI/2); // 顺时针90°
          // 旋转后，再绘制到 -destH/2..+destH/2 与 -destW/2..+destW/2 区域
          // 但为了不改变帧尺寸，仍将画面“塞入”原 destW x destH 的像素栅格
          ctx.drawImage(video, sx, sy, sw, sh, -destH/2, -destW/2, destH, destW);
        }

        ctx.restore();

        try {
          const bitmap = await createImageBitmap(offscreen);
          worker.postMessage({
            type: 'frame',
            bitmap,
            width: offscreen.width,
            height: offscreen.height,
            mode, // portrait/landscape，供 worker 做方向一致性检查
            timestamp: performance.now()
          }, [bitmap]);
        } catch (err) {
          const imgData = ctx.getImageData(0,0,offscreen.width,offscreen.height);
          worker.postMessage({
            type:'frame-rgb',
            data: imgData.data.buffer,
            width: offscreen.width,
            height: offscreen.height,
            mode,
            timestamp: performance.now()
          }, [imgData.data.buffer]);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function stop() { running = false; }

  return { start, stop, get running() { return running; } };
}
