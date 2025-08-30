export function estimateQuality(mask, w, h) {
  let red = 0;
  for (let i=0;i<mask.length;i++) if (mask[i]) red++;
  const redRatio = red / (w*h);
  const suggestions = [];
  if (redRatio < 0.001) suggestions.push('移动设备靠近试卷');
  if (redRatio < 0.0003) suggestions.push('光线不足，请打开闪光灯');
  return { redRatio, suggestions };
}
