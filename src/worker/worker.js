import { segmentRed } from './color.js';
import { findComponents } from './cc.js';
import { buildChains, composeStrings } from './group.js';
import { prepareROIs } from './preprocess.js';
import { loadTFJSModel, inferTFJS, hasModel } from './model-tfjs.js';
import { estimateQuality } from './quality.js';

let modelReady = false;
let frameSize = { w: 0, h: 0 };

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      await loadTFJSModel(msg.modelPath); // 若找不到模型会保持占位模式
      modelReady = true;
      self.postMessage({ type: 'ready' });
      return;
    }
    if (msg.type === 'frame') {
      frameSize = { w: msg.width, h: msg.height };
      const t0 = performance.now();

      const { mask, width, height } = await segmentRed(msg.bitmap);
      const comps = findComponents(mask, width, height);
      const chains = buildChains(comps);

      const { input, metas } = await prepareROIs(msg.bitmap, chains, { inputSize: 32 });

      const preds = await inferTFJS(input); // 若无模型则给出占位预测
      const items = composeStrings(chains, preds, metas);

      const diag = estimateQuality(mask, width, height);
      diag.fpsStage = true;

      self.postMessage({ type:'preds', items, diag, frameSize });
      msg.bitmap.close?.();
      // 释放内存
      return;
    }
  } catch (err) {
    self.postMessage({ type:'error', message: String(err?.message || err) });
  }
};