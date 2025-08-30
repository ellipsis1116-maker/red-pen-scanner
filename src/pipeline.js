import { UI } from './ui.js';
import { getVideoEl } from './camera.js';
import { parseDetectionsToCanvasSpace } from './util/math.js';
import { Perf } from './util/perf.js';

export function createPipeline({ backend='tfjs', modelPath='./model/tfjs/model.json', targetFps=8, onDetections, onFps }) {
  const worker = new Worker('./src/worker/worker.js', { type: 'module' });
  let running = false;
  let canvas, ctx;
  let lastTick = 0;
  let interval = 1000 / targetFps;
  const perf = new Perf(30);

  worker.postMessage({ type: 'init', backend, modelPath });

  worker.onmessage = (e) => {
    const msg = e.data;
    if (msg.type === 'preds') {
      // 将 worker 坐标系映射到 overlay canvas 坐标
      const overlay = UI.getOverlayEl();
      const mapped = msg.items.map(it => {
        const mappedBox = parseDetectionsToCanvasSpace(it.bbox, msg.frameSize, { w: overlay.width, h: overlay.height });
        return { ...it, bboxCanvas: mappedBox };
      });
      onDetections?.(mapped, msg.diag);
      if (onFps && msg?.diag?.fpsStage) {
        perf.push(1000/(performance.now() - (lastTick||performance.now())));
        onFps(perf.avg());
      }
    } else if (msg.type === 'ready') {
      UI.setStatus('模型已加载');
    } else if (msg.type === 'error') {
      UI.setStatus('识别出错：' + msg.message);
    }
  };

  let offscreen;
  async function start(stream) {
    if (running) return;
    const video = getVideoEl();

    // 使用 OffscreenCanvas 采样帧
    const w = 640;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 480;
    offscreen = new OffscreenCanvas(w, h);
    const osctx = offscreen.getContext('2d', { willReadFrequently: true });
    running = true;

    const loop = async (ts) => {
      if (!running) return;
      if (!lastTick) lastTick = ts;
      if (ts - lastTick >= interval) {
        lastTick = ts;
        osctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
        const bitmap = await createImageBitmap(offscreen);
        worker.postMessage({ type: 'frame', bitmap, width: offscreen.width, height: offscreen.height, timestamp: performance.now() }, [bitmap]);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  async function replaceStream(_newStream) {
    // 不需要特别处理，video 已绑定新流，循环照常采样
  }

  function stop() { running = false; }

  return { start, stop, replaceStream, get running() { return running; } };
}