import { iou } from './util/math.js';

export class Score {
  constructor() {
    this.items = []; // {text, bbox, conf, t}
    this.timeWindow = 5000; // ms
    this.itemRange = [0, 100]; // 单项有效范围
    this.totalCap = [0, 150]; // 总分硬上限，可按试卷调整
  }
  reset() { this.items = []; }

  addDetections(list) {
    const now = performance.now();
    this.items = this.items.filter(it => now - it.t < this.timeWindow);
    for (const d of list) {
      const val = this._parseNumber(d.text);
      if (Number.isNaN(val)) continue;
      if (val < this.itemRange[0] || val > this.itemRange[1]) continue;

      let merged = false;
      for (const it of this.items) {
        if (Math.abs(val - this._parseNumber(it.text)) < 1e-6 && iou(d.bbox, it.bbox) > 0.5) {
          if (d.conf > it.conf) { it.conf = d.conf; it.bbox = d.bbox; it.t = now; it.text = d.text; }
          merged = true; break;
        }
      }
      if (!merged) this.items.push({ ...d, t: now });
    }
  }

  getTotal() {
    let sum = 0;
    for (const it of this.items) {
      const val = this._parseNumber(it.text);
      if (!Number.isNaN(val)) sum += val;
    }
    sum = Math.max(this.totalCap[0], Math.min(this.totalCap[1], sum));
    return Math.round(sum * 10) / 10;
  }

  getBreakdown() {
    return this.items.map(it => ({ text: it.text, bbox: it.bbox, conf: it.conf }));
  }

  _parseNumber(s) {
    const m = String(s).trim().match(/^(\d{1,3})(?:\.(\d))?$/);
    if (!m) return NaN;
    const intp = parseInt(m[1],10);
    const frac = m[2] ? parseInt(m[2],10) : 0;
    if (m[2] && !(frac === 5 || frac === 0)) return NaN; // 仅允许 .5
    const val = intp + (frac === 5 ? 0.5 : 0);
    return val;
  }
}
