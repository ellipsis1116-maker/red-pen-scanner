export function iou(a, b) {
  const ix = Math.max(a.x, b.x);
  const iy = Math.max(a.y, b.y);
  const ax = Math.min(a.x + a.w, b.x + b.w);
  const ay = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, ax - ix);
  const ih = Math.max(0, ay - iy);
  const inter = iw * ih;
  const ua = a.w * a.h + b.w * b.h - inter;
  return ua <= 0 ? 0 : inter / ua;
}

export function parseDetectionsToCanvasSpace(bbox, frameSize, canvasSize) {
  const scaleX = canvasSize.w / frameSize.w;
  const scaleY = canvasSize.h / frameSize.h;
  return {
    x: bbox.x * scaleX,
    y: bbox.y * scaleY,
    w: bbox.w * scaleX,
    h: bbox.h * scaleY,
  };
}
