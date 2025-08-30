import { iou } from './util/math.js';

export class Score {
  constructor() {
    this.items = []; // {text, bbox, conf, t}
    this.gridSize = 48; // 空间去重网格
    this.timeWindow = 5000; // ms
  }

  reset() { this.items = []; }

  addDetections(list) {
    const now = performance.now();
    // 过期清理
    this.items = this.items.filter(it => now - it.t < this.timeWindow);

    for (const d of list) {
      // 查重（同区域同文本）
      let merged = false;
      for (const it of this.items) {
        if (this._sameText(d.text, it.text) && iou(d.bbox, it.bbox) > 0.5) {
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
    return Math.round(sum * 10) / 10; // 保留到0.1
  }

  getBreakdown() {
    return this.items.map(it => ({ text: it.text, bbox: it.bbox, conf: it.conf }));
  }

  _parseNumber(s) {
    // 支持 "12", "4", "15.5", "0.5", "3.5"
    const m = String(s).match(/^(\d+)(?:\.(\d))?$/);
    if (!m) return NaN;
    const intp = parseInt(m[1],10);
    const frac = m[2] ? parseInt(m[2],10) : 0;
    if (m[2] && frac !== 5 && frac !== 0) return NaN; // 只允许 .5
    return intp + (frac === 5 ? 0.5 : 0);
  }

  _sameText(a,b){ return a===b; }
}