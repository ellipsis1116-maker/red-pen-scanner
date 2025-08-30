// 将 chain 中每个 box 从原帧裁切、灰度化、归一化到 32x32
export async function prepareROIs(bitmap, chains, { inputSize=32 } = {}) {
  const w = bitmap.width, h = bitmap.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);

  const metas = [];
  const tensors = [];
  let id = 0;

  for (const chain of chains) {
    for (const box of chain) {
      const { x,y } = box;
      const cw = Math.max(1, box.w);
      const ch = Math.max(1, box.h);
      const patch = ctx.getImageData(x, y, cw, ch);
      const gray = new Float32Array(inputSize * inputSize);
      // 将 patch 缩放到 inputSize，并灰度化、标准化
      const tmp = new OffscreenCanvas(inputSize, inputSize);
      const tctx = tmp.getContext('2d', { willReadFrequently:true });
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(canvas, x, y, cw, ch, 0, 0, inputSize, inputSize);
      const im = tctx.getImageData(0,0,inputSize,inputSize).data;
      for (let i=0, p=0; i<im.length; i+=4, p++){
        // 灰度，强调红通道
        const r = im[i], g = im[i+1], b = im[i+2];
        const gr = (0.6*r + 0.3*g + 0.1*b)/255;
        gray[p] = (1 - gr); // 让笔迹更亮
      }
      tensors.push(gray);
      metas.push({ id: id++, box, chain });
    }
  }

  // 组装为 TF.js 期望的 [N, H, W, 1]
  const N = tensors.length;
  const input = { data: tensors, N, H: inputSize, W: inputSize, C: 1 };
  return { input, metas };
}