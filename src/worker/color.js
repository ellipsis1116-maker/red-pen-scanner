// 更严格的红色分割阈值与稍加强的形态学，减少误检

export async function segmentRed(bitmap) {
  const w = bitmap.width, h = bitmap.height;
  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0,0,w,h);
  return segmentRedCore(img.data, w, h);
}

export function segmentRedFromRGBA(buffer, w, h) {
  const data = new Uint8ClampedArray(buffer);
  return segmentRedCore(data, w, h);
}

function segmentRedCore(data, w, h) {
  const mask = new Uint8Array(w*h);

  // 先简单的通道拉伸，弱白平衡
  let rmax=1,gmax=1,bmax=1;
  for (let i=0;i<data.length;i+=4){ rmax=Math.max(rmax, data[i]); gmax=Math.max(gmax, data[i+1]); bmax=Math.max(bmax, data[i+2]); }
  const rg = 255 / rmax, gg = 255 / gmax, bg = 255 / bmax;

  for (let i=0, p=0; i<data.length; i+=4, p++) {
    const r = Math.min(255, data[i]*rg)/255;
    const g = Math.min(255, data[i+1]*gg)/255;
    const b = Math.min(255, data[i+2]*bg)/255;

    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const v = max;
    const d = max - min;
    let hdeg = 0, s = max === 0 ? 0 : d / max;
    if (d !== 0) {
      switch(max){
        case r: hdeg = 60 * (((g-b)/d) % 6); break;
        case g: hdeg = 60 * ((b-r)/d + 2); break;
        case b: hdeg = 60 * ((r-g)/d + 4); break;
      }
      if (hdeg < 0) hdeg += 360;
    }
    // 更窄的“红”范围 + 更高饱和/亮度阈值
    const inRedHue = (hdeg <= 15 || hdeg >= 345) || (hdeg >= 170 && hdeg <= 190);
    mask[p] = (inRedHue && s > 0.55 && v > 0.45) ? 255 : 0;
  }

  // 形态学：开(去噪) + 闭(连通)，稍加强一次
  const t1 = new Uint8Array(w*h);
  const t2 = new Uint8Array(w*h);
  erode(mask, t1, w, h);
  dilate(t1, t2, w, h);
  dilate(t2, t1, w, h);
  erode(t1, mask, w, h);

  return { mask, width: w, height: h };
}

function erode(src, dst, w, h) {
  for (let y=1; y<h-1; y++){
    for (let x=1; x<w-1; x++){
      let keep = 255;
      for (let dy=-1; dy<=1; dy++){
        for (let dx=-1; dx<=1; dx++){
          if (src[(y+dy)*w + (x+dx)] === 0) { keep = 0; dx=2; dy=2; break; }
        }
      }
      dst[y*w+x] = keep;
    }
  }
  for (let x=0; x<w; x++){ dst[x]=0; dst[(h-1)*w + x]=0; }
  for (let y=0; y<h; y++){ dst[y*w]=0; dst[y*w+(w-1)]=0; }
}
function dilate(src, dst, w, h) {
  for (let y=1; y<h-1; y++){
    for (let x=1; x<w-1; x++){
      let val = 0;
      for (let dy=-1; dy<=1; dy++){
        for (let dx=-1; dx<=1; dx++){
          if (src[(y+dy)*w + (x+dx)] === 255) { val = 255; dx=2; dy=2; break; }
        }
      }
      dst[y*w+x] = val;
    }
  }
  for (let x=0; x<w; x++){ dst[x]=0; dst[(h-1)*w + x]=0; }
  for (let y=0; y<h; y++){ dst[y*w]=0; dst[y*w+(w-1)]=0; }
}
