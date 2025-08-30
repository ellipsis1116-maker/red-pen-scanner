import { UI } from './ui.js';
import { parseDetectionsToCanvasSpace } from './util/math.js';
import { Perf } from './util/perf.js';

export function createPipeline({ backend='tfjs', modelPath='./model/tfjs/model.json', targetFps=8, getRotateMode=()=>0, onDetections, onFps }) {
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
    } else if (msg.type === 'ready') {
      // UI.setStatus('模型已加载'); // 占位模型也不阻塞
    } else if (msg.type === 'error') {
      console.error('[worker] error', msg.message);
      UI.setStatus('识别出错：' + msg.message);
    }
  };

  async function start() {
    if (running) return;
    const video = UI.getVideoEl();

    if (!video.videoWidth || !video.videoHeight) {
      await new Promise(res => video.addEventListener('loadedmetadata', res, { once: true }));
    }

    const isLandscape = video.videoWidth >= video.videoHeight;
    const targetW = isLandscape ? 960 : 640; // 横屏更高采样宽度
    const w = targetW;
    const h = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * w));
    offscreen = new OffscreenCanvas(w, h);
    const osctx = offscreen.getContext('2d', { willReadFrequently: true });
    running = true;

    const loop = async (ts) => {
      if (!running) return;
      if (!lastTick) lastTick = ts;
      if (ts - lastTick >= interval) {
        lastTick = ts;

        // 绘制前根据旋转角度调整
        const rot = (getRotateMode?.() || 0) % 4; // 0/1/2/3 -> 0/90/180/270
        osctx.save();
        osctx.clearRect(0,0,offscreen.width, offscreen.height);
        if (rot === 0) {
          osctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
        } else {
          // 旋转采样坐标系
          osctx.translate(offscreen.width/2, offscreen.height/2);
          osctx.rotate(rot * Math.PI/2);
          const dw = offscreen.width, dh = offscreen.height;
          osctx.drawImage(video, -dw/2, -dh/2, dw, dh);
        }
        osctx.restore();

        try {
          const bitmap = await createImageBitmap(offscreen);
          worker.postMessage({ type: 'frame', bitmap, width: offscreen.width, height: offscreen.height, rotate: rot, timestamp: performance.now() }, [bitmap]);
        } catch (err) {
          const imgData = osctx.getImageData(0,0,offscreen.width,offscreen.height);
          worker.postMessage({ type:'frame-rgb', data: imgData.data.buffer, width: offscreen.width, height: offscreen.height, rotate: rot, timestamp: performance.now() }, [imgData.data.buffer]);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  async function replaceStream(_newStream) {
    // video 已绑定新流，循环继续采样即可
  }

  function stop() { running = false; }

  return { start, stop, replaceStream, get running() { return running; } };
}
