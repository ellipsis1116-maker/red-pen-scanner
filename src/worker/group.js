const CLASSES = ['0','1','2','3','4','5','6','7','8','9','dot'];

export function buildChains(comps, { frameW, frameH } = {}) {
  if (!comps.length) return [];
  const sorted = comps.slice().sort((a,b)=> (a.y + a.h/2) - (b.y + b.h/2));
  const lines = [];
  const thresh = 0.6;
  for (const c of sorted) {
    let placed = false;
    for (const line of lines) {
      const avgH = line.avgH || (line.items.reduce((s,it)=>s+it.h,0)/line.items.length);
      const cy = c.y + c.h/2;
      const cy0 = line.cy || (line.items.reduce((s,it)=>s+it.y+it.h/2,0)/line.items.length);
      if (Math.abs(cy - cy0) < thresh * ((avgH + c.h)/2)) {
        line.items.push(c);
        placed = true; break;
      }
    }
    if (!placed) lines.push({ items:[c] });
  }

  const chains = [];
  for (const line of lines) {
    line.items.sort((a,b)=>a.x - b.x);
    let chain = [];
    let avgW = line.items.reduce((s,it)=>s+it.w,0)/line.items.length;
    for (let i=0;i<line.items.length;i++){
      const cur = line.items[i];
      if (!chain.length) { chain.push(cur); continue; }
      const prev = chain[chain.length-1];
      const gap = cur.x - (prev.x + prev.w);
      if (gap < 1.2 * avgW) {
        chain.push(cur);
      } else {
        if (chain.length) chains.push(chain);
        chain = [cur];
      }
    }
    if (chain.length) chains.push(chain);
  }
  return chains;
}

export function composeStrings(chains, preds, metas, { frameW, frameH } = {}) {
  const items = [];
  const byId = new Map();
  preds.forEach(p => byId.set(p.id, { char: p.char, conf: p.prob }));

  const maxChainLen = 3;
  const maxBoxAreaRatio = 0.05;
  const minCharConf = 0.6;

  for (const chain of chains) {
    const bbox = unionBoxes(chain);
    const areaRatio = (bbox.w * bbox.h) / (frameW * frameH);
    if (areaRatio > maxBoxAreaRatio) continue;

    let parts = [];
    let dots = [];
    for (const box of chain) {
      const meta = metas.find(m => m.box === box);
      const pr = meta ? byId.get(meta.id) : null;
      let ch = pr?.char || '?';
      let cf = pr?.conf ?? 0.5;
      if (cf < minCharConf) continue;

      const small = isSmallDot(box, chain);
      if (ch === 'dot' || small) {
        dots.push({ box, conf: cf });
      } else if (ch >= '0' && ch <= '9') {
        parts.push({ ch, box, conf: cf });
      }
    }

    if (parts.length > maxChainLen) {
      parts.sort((a,b)=>b.conf - a.conf);
      parts = parts.slice(0, maxChainLen).sort((a,b)=>a.box.x - b.box.x);
    }

    if (dots.length > 1) continue;
    if (dots.length === 1 && !validDot(dots[0], parts)) {
      dots = [];
    }

    let composed = '';
    if (parts.length) {
      composed = parts.map(p=>p.ch).join('');
      if (dots.length) {
        const insertPos = findDecimalInsertPos(parts);
        composed = composed.slice(0, insertPos) + '.' + composed.slice(insertPos);
      }
    } else {
      continue;
    }

    const val = parseValue(composed);
    if (val == null || val < 0 || val > 100) continue;

    const conf = parts.length ? Math.min(...parts.map(p=>p.conf)) : 0.5;
    items.push({ text: composed, bbox, conf, parts });
  }
  return items;
}

function parseValue(s) {
  const m = String(s).match(/^(\d{1,3})(?:\.(\d))?$/);
  if (!m) return null;
  const intp = parseInt(m[1],10);
  const frac = m[2] ? parseInt(m[2],10) : 0;
  if (m[2] && !(frac === 5 || frac === 0)) return null;
  return intp + (frac === 5 ? 0.5 : 0);
}

function isSmallDot(dotBox, chain) {
  const ah = avgHeight(chain);
  return dotBox.h < 0.5 * ah;
}
function validDot(dot, parts) {
  if (!parts.length) return false;
  const ah = avgHeight(parts.map(p=>p.box));
  const midY = parts.reduce((s,p)=>s+(p.box.y+p.box.h/2),0)/parts.length;
  const dotCenterY = dot.box.y + dot.box.h/2;
  return dot.box.h < 0.5*ah && dotCenterY > midY;
}
function findDecimalInsertPos(parts) {
  if (parts.length <= 1) return 1;
  return parts.length - 1;
}
function avgHeight(chain){ return chain.reduce((s,b)=>s+b.h,0)/chain.length; }
function unionBoxes(boxes) {
  let minx=Infinity, miny=Infinity, maxx=-Infinity, maxy=-Infinity;
  for (const b of boxes){ minx=Math.min(minx,b.x); miny=Math.min(miny,b.y); maxx=Math.max(maxx,b.x+b.w); maxy=Math.max(maxy,b.y+b.h); }
  return { x:minx, y:miny, w:maxx-minx, h:maxy-miny };
}
