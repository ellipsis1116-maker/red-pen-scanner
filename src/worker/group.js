// 将组件按行聚类，左右排序，拼接数字串；小数点按规则插入
const CLASSES = ['0','1','2','3','4','5','6','7','8','9','dot'];

export function buildChains(comps) {
  if (!comps.length) return [];
  // 基于 y 中心的聚类（行）
  const sorted = comps.slice().sort((a,b)=> (a.y + a.h/2) - (b.y + b.h/2));
  const lines = [];
  const thresh = 0.6; // 同行阈值：中心y距离 < 0.6*平均高度
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
  // 行内按 x 排序，构建 chain
  const chains = [];
  for (const line of lines) {
    line.items.sort((a,b)=>a.x - b.x);
    // 相邻合并为同串：间距 < 1.2*平均宽度
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
        chains.push(chain); chain = [cur];
      }
    }
    if (chain.length) chains.push(chain);
  }
  return chains;
}

export function composeStrings(chains, preds, metas) {
  const items = [];
  // preds 为按 metas 顺序的 char 预测
  // 先把每个 box 对应的预测映射回 chain
  const byId = new Map(); // key: meta.id -> {char, conf}
  preds.forEach(p => byId.set(p.id, { char: p.char, conf: p.prob }));

  for (const chain of chains) {
    // 生成文本，处理 dot
    let text = '';
    let parts = [];
    let dots = [];
    let confs = [];
    for (const box of chain) {
      const id = metas.find(m => m.box === box)?.id;
      const pr = id != null ? byId.get(id) : null;
      let ch = pr?.char || '?';
      let cf = pr?.conf ?? 0.5;

      // 若形状很小，尝试视为 dot
      const isSmall = box.h < 0.45 * avgHeight(chain);
      if (isSmall && ch === '?') { ch = 'dot'; cf = 0.6; }

      if (ch === 'dot') {
        dots.push({ box, conf: cf });
      } else if (ch >= '0' && ch <= '9') {
        parts.push({ ch, box, conf: cf });
        confs.push(cf);
      }
    }
    // 将 dot 插入到最近数字之间（简单策略：若存在，插在中间）
    let composed = '';
    if (parts.length) {
      // 先纯数字
      composed = parts.map(p=>p.ch).join('');
      // 如果有 dot，就在合适位置插入一处小数点（靠近中间或最右侧）
      if (dots.length) {
        const insertPos = Math.min(parts.length-1, Math.max(1, Math.round(parts.length-0.7)));
        composed = composed.slice(0, insertPos) + '.' + composed.slice(insertPos);
      }
    } else if (dots.length) {
      // 只有点，忽略
      continue;
    } else {
      continue;
    }

    const bbox = unionBoxes(chain);
    const conf = confs.length ? Math.min(...confs) : 0.5;
    items.push({ text: composed, bbox, conf, parts });
  }
  return items;
}

function avgHeight(chain){ return chain.reduce((s,b)=>s+b.h,0)/chain.length; }
function unionBoxes(boxes) {
  let minx=Infinity, miny=Infinity, maxx=-Infinity, maxy=-Infinity;
  for (const b of boxes){ minx=Math.min(minx,b.x); miny=Math.min(miny,b.y); maxx=Math.max(maxx,b.x+b.w); maxy=Math.max(maxy,b.y+b.h); }
  return { x:minx, y:miny, w:maxx-minx, h:maxy-miny };
}