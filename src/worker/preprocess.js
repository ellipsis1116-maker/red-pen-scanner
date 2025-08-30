// ImageBitmap 版本
export async function prepareROIs(bitmap, chains, { inputSize=32 } = {}) {
  const w = bitmap.width, h = bitmap.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  return prepareFromCanvas(canvas, chains, inputSize);
}

// RGBA 降级版本
export async function prepareROIsFromRGBA(buffer, w, h, chains, { inputSize=32 } = {}) {
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = new ImageData(new Uint8ClampedArray(buffer), w, h);
  ctx.putImageData(imgData, 0, 0);
  return prepareFromCanvas(canvas, chains, inputSize);
}

async function prepareFromCanvas(canvas, chains, inputSize) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const metas = [];
  const tensors = [];
  let id = 0;

  for (const chain of chains) {
    for (const box of chain) {
      const { x,y } = box;
      const cw = Math.max(1, box.w);
      const ch = Math.max(1, box.h);

      const tmp = new OffscreenCanvas(inputSize, inputSize);
      const tctx = tmp.getContext('2d', { willReadFrequently:true });
      tctx.imageSmoothingEnabled = true;
      tctx.drawImage(canvas, x, y, cw, ch, 0, 0, inputSize, inputSize);
      const im = tctx.getImageData(0,0,inputSize,inputSize).data;

      const gray = new Float32Array(inputSize * inputSize);
      for (let i=0, p=0; i<im.length; i+=4, p++){
        const r = im[i], g = im[i+1], b = im[i+2];
        const gr = (0.6*r + 0.3*g + 0.1*b)/255;
        gray[p] = (1 - gr);
      }

      tensors.push(gray);
      metas.push({ id: id++, box, chain });
    }
  }

  const N = tensors.length;
  const input = { data: tensors, N, H: inputSize, W: inputSize, C: 1 };
  return { input, metas };
}
