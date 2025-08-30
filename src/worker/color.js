// HSV 分割红色，双峰 H 合并，简单 3x3 形态学开闭
export async function segmentRed(bitmap) {
  const w = bitmap.width, h = bitmap.height;
  const off = new OffscreenCanvas(w, h);
  const ctx = off.getContext('2d', { willReadFrequently:true });
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0,0,w,h);
  const data = img.data;
  const mask = new Uint8Array(w*h);

  // HSV 阈值
  // 两段红：H in [0,10] U [170,180], S>0.45, V>0.35
  for (let i=0, p=0; i<data.length; i+=4, p++) {
    const r = data[i]/255, g = data[i+1]/255, b = data[i+2]/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    const v = max;
    const d = max - min;
    let hdeg = 0, s = max === 0 ? 0 : d / max;
    if (d === 0) { hdeg = 0; }
    else {
      switch(max){
        case r: hdeg = 60 * (((g-b)/d) % 6); break;
        case g: hdeg = 60 * ((b-r)/d + 2); break;
        case b: hdeg = 60 * ((r-g)/d + 4); break;
      }
      if (hdeg < 0) hdeg += 360;
    }
    const inRed = (hdeg <= 10 || hdeg >= 350) || (hdeg >= 170 && hdeg <= 190);
    if (inRed && s > 0.45 && v > 0.35) {
      mask[p] = 255;
    } else mask[p] = 0;
  }

  // 形态学开闭（3x3）
  const out = new Uint8Array(w*h);
  erode(mask, out, w, h);
  dilate(out, mask, w, h);
  dilate(mask, out, w, h);
  erode(out, mask, w, h);

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
  // 边界复制
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