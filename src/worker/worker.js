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

      // 连通域与链
      let comps = findComponents(mask, width, height);

      // 方向一致性过滤：
      // - portrait 模式：偏“竖直字符”优先（高>=宽，或链整体更“垂直”）
      // - landscape 模式：偏“横向字符”优先（宽>=高，或链整体更“水平”）
      const mode = msg.mode === 'landscape' ? 'landscape' : 'portrait';
      const filtered = comps.filter(c => {
        const ar = c.w / c.h;
        if (mode === 'portrait') return (ar <= 1.2); // 更窄/更高
        return (ar >= 0.8); // 更扁/更宽
      });

      const chains = buildChains(filtered, { frameW: width, frameH: height });

      // 若整组链与模式矛盾（例如链强水平却处于 portrait），可进一步过滤
      const chains2 = chains.filter(chain => {
        const bbox = unionBoxes(chain);
        const ar = bbox.w / bbox.h;
        return mode === 'portrait' ? (ar <= 1.2) : (ar >= 0.8);
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

// 小工具：求并框
function unionBoxes(boxes) {
  let minx=Infinity, miny=Infinity, maxx=-Infinity, maxy=-Infinity;
  for (const b of boxes){ minx=Math.min(minx,b.x); miny=Math.min(miny,b.y); maxx=Math.max(maxx,b.x+b.w); maxy=Math.max(maxy,b.y+b.h); }
  return { x:minx, y:miny, w:maxx-minx, h:maxy-miny };
}
