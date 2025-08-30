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

    if (msg.type === 'frame') {
      const { mask, width, height } = await segmentRed(msg.bitmap);
      const comps = findComponents(mask, width, height);
      const chains = buildChains(comps, { frameW: width, frameH: height });
      const { input, metas } = await prepareROIs(msg.bitmap, chains, { inputSize: 32 });
      const preds = await inferTFJS(input);
      const items = composeStrings(chains, preds, metas, { frameW: width, frameH: height });
      const diag = estimateQuality(mask, width, height);
      self.postMessage({ type:'preds', items, diag, frameSize: { w: width, h: height } });
      msg.bitmap.close?.();
      return;
    }

    if (msg.type === 'frame-rgb') {
      const { mask, width, height } = segmentRedFromRGBA(msg.data, msg.width, msg.height);
      const comps = findComponents(mask, width, height);
      const chains = buildChains(comps, { frameW: width, frameH: height });
      const { input, metas } = await prepareROIsFromRGBA(msg.data, width, height, chains, { inputSize: 32 });
      const preds = await inferTFJS(input);
      const items = composeStrings(chains, preds, metas, { frameW: width, frameH: height });
      const diag = estimateQuality(mask, width, height);
      self.postMessage({ type:'preds', items, diag, frameSize: { w: width, h: height } });
      return;
    }
  } catch (err) {
    self.postMessage({ type:'error', message: String(err?.message || err) });
  }
};
