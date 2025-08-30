import { iou } from './util/math.js';

export class Score {
  constructor() {
    this.items = []; // {text, bbox, conf, t}
    this.timeWindow = 5000; // ms
  }
  reset() { this.items = []; }

  addDetections(list) {
    const now = performance.now();
    this.items = this.items.filter(it => now - it.t < this.timeWindow);
    for (const d of list) {
      let merged = false;
      for (const it of this.items) {
        if (d.text === it.text && iou(d.bbox, it.bbox) > 0.5) {
          if (d.conf > it.conf) { it.conf = d.conf; it.bbox = d.bbox; it.t = now; }
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
    return Math.round(sum * 10) / 10;
  }

  getBreakdown() {
    return this.items.map(it => ({ text: it.text, bbox: it.bbox, conf: it.conf }));
  }

  _parseNumber(s) {
    const m = String(s).match(/^(\d+)(?:\.(\d))?$/);
    if (!m) return NaN;
    const intp = parseInt(m[1],10);
    const frac = m[2] ? parseInt(m[2],10) : 0;
    if (m[2] && frac !== 5 && frac !== 0) return NaN; // 仅允许 .5
    return intp + (frac === 5 ? 0.5 : 0);
  }
}
