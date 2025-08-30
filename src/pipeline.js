import { UI } from './ui.js';
import { parseDetectionsToCanvasSpace } from './util/math.js';
import { Perf } from './util/perf.js';

export function createPipeline({ backend='tfjs', modelPath='./model/tfjs/model.json', targetFps=8, getOrient=()=> 'landscape', onDetections, onFps }) {
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
      UI.setStatus('识别出错：' + msg.message);
    }
  };

  async function start() {
    if (running) return;
    const video = UI.getVideoEl();

    if (!video.videoWidth || !video.videoHeight) {
      await new Promise(res => video.addEventListener('loadedmetadata', res, { once: true }));
    }

    const videoLandscape = video.videoWidth >= video.videoHeight;
    const appOrient = getOrient() === 'portrait' ? 'portrait' : 'landscape';
    const isLandscapeSample = (appOrient === 'landscape');

    // 采样分辨率：横模式更高宽度
    const targetW = isLandscapeSample ? 960 : 640;
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

        const orient = getOrient() === 'portrait' ? 'portrait' : 'landscape';
        const rotQuarter = orient === 'portrait' ? 1 : 0; // 0deg or 90deg

        osctx.save();
        osctx.clearRect(0,0,offscreen.width, offscreen.height);
        if (rotQuarter === 0) {
          osctx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
        } else {
          // 旋转采样坐标系 90°
          osctx.translate(offscreen.width/2, offscreen.height/2);
          osctx.rotate(Math.PI/2);
          const dw = offscreen.width, dh = offscreen.height;
          osctx.drawImage(video, -dw/2, -dh/2, dw, dh);
        }
        osctx.restore();

        try {
          const bitmap = await createImageBitmap(offscreen);
          worker.postMessage({ type: 'frame', bitmap, width: offscreen.width, height: offscreen.height, orient, timestamp: performance.now() }, [bitmap]);
        } catch (err) {
          const imgData = osctx.getImageData(0,0,offscreen.width,offscreen.height);
          worker.postMessage({ type:'frame-rgb', data: imgData.data.buffer, width: offscreen.width, height: offscreen.height, orient, timestamp: performance.now() }, [imgData.data.buffer]);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function stop() { running = false; }

  return { start, stop, get running() { return running; } };
}
