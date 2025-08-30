import { segmentRed, segmentRedFromRGBA } from './color.js';
import { findComponents } from './cc.js';
import { buildChains, composeStrings } from './group.js';
import { prepareROIs, prepareROIsFromRGBA } from './preprocess.js';
import { loadTFJSModel, inferTFJS } from './model-tfjs.js';
import { estimateQuality } from './quality.js';

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await loadTFJSModel(msg.modelPath);
      self.postMessage({ type: 'ready' });
      return;
    }

    if (msg.type === 'frame' || msg.type === 'frame-rgb') {
      const isRGB = msg.type === 'frame-rgb';
      const seg = isRGB ? segmentRedFromRGBA(msg.data, msg.width, msg.height)
                        : await segmentRed(msg.bitmap);
      const { mask, width, height } = seg;

      const mode = msg.mode === 'landscape' ? 'landscape' : 'portrait';

      let comps = findComponents(mask, width, height);

      // 方向一致性过滤：portrait偏窄高，landscape偏扁宽
      const filtered = comps.filter(c => {
        const ar = c.w / c.h;
        return mode === 'portrait' ? (ar <= 1.1) : (ar >= 0.9);
      });

      const chains = buildChains(filtered, { frameW: width, frameH: height });

      const chains2 = chains.filter(chain => {
        const bbox = unionBoxes(chain);
        const ar = bbox.w / bbox.h;
        return mode === 'portrait' ? (ar <= 1.1) : (ar >= 0.9);
      });

      const rois = isRGB
        ? await prepareROIsFromRGBA(isRGB ? msg.data : null, width, height, chains2, { inputSize: 32 })
        : await prepareROIs(msg.bitmap, chains2, { inputSize: 32 });

      const preds = await inferTFJS(rois.input);
      const items = composeStrings(chains2, preds, rois.metas, { frameW: width, frameH: height });

      const diag = estimateQuality(mask, width, height);
      self.postMessage({ type:'preds', items, diag, frameSize: { w: width, h: height } });

      if (!isRGB) msg.bitmap.close?.();
      return;
    }
  } catch (err) {
    self.postMessage({ type:'error', message: String(err?.message || err) });
  }
};

function unionBoxes(boxes) {
  let minx=Infinity, miny=Infinity, maxx=-Infinity, maxy=-Infinity;
  for (const b of boxes){ minx=Math.min(minx,b.x); miny=Math.min(miny,b.y); maxx=Math.max(maxx,b.x+b.w); maxy=Math.max(maxy,b.y+b.h); }
  return { x:minx, y:miny, w:maxx-minx, h:maxy-miny };
}
