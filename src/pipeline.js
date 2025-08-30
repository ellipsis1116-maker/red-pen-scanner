import { UI } from './ui.js';
import { parseDetectionsToCanvasSpace } from './util/math.js';
import { Perf } from './util/perf.js';

/*
关键变化：
- 不旋转像素，不旋转视频；视频始终 cover 填满屏幕
- 采样时使用 cover 裁剪策略，从 video 抽取与 overlay 尺寸相同的视图
- 将 frameSize = overlay 像素尺寸，bbox 映射简单线性比例
- 横/竖模式仅通过 'mode' 传给 worker，用于方向一致性过滤；不改变像素
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

        // 目标采样尺寸 = overlay 尺寸（旋转后的视觉容器大小）
        const overlay = UI.getOverlayEl();
        const dw = overlay.width, dh = overlay.height;
        if (!dw || !dh) { requestAnimationFrame(loop); return; }

        if (!offscreen || offscreen.width !== dw || offscreen.height !== dh) {
          offscreen = new OffscreenCanvas(dw, dh);
        }
        const ctx = offscreen.getContext('2d', { willReadFrequently: true });
        ctx.save();
        ctx.clearRect(0,0,dw,dh);

        // 计算 cover 裁剪区域（从 video 抽取到 dw x dh）
        const videoAspect = vw / vh;
        const destAspect = dw / dh;
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
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh);
        ctx.restore();

        try {
          const bitmap = await createImageBitmap(offscreen);
          worker.postMessage({
            type: 'frame',
            bitmap,
            width: dw,
            height: dh,
            mode, // portrait/landscape
            timestamp: performance.now()
          }, [bitmap]);
        } catch (err) {
          const imgData = ctx.getImageData(0,0,dw,dh);
          worker.postMessage({
            type:'frame-rgb',
            data: imgData.data.buffer,
            width: dw,
            height: dh,
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
