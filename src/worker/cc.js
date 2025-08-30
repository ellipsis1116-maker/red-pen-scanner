export function findComponents(mask, w, h) {
  const labels = new Int32Array(w*h);
  let label = 1;
  const parent = [];
  function find(x){ while(parent[x] && parent[x] !== x) x = parent[x] = parent[parent[x]] || parent[x]; return parent[x]||x; }
  function union(a,b){ a=find(a); b=find(b); if (a!==b) parent[Math.max(a,b)] = Math.min(a,b); }

  for (let y=0; y<h; y++){
    for (let x=0; x<w; x++){
      const i = y*w+x;
      if (mask[i] === 0) { labels[i]=0; continue; }
      const up = y>0 ? labels[(y-1)*w+x] : 0;
      const left = x>0 ? labels[y*w + (x-1)] : 0;
      if (up===0 && left===0) {
        labels[i] = label;
        parent[label] = label;
        label++;
      } else if (up!==0 && left===0) {
        labels[i] = up;
      } else if (up===0 && left!==0) {
        labels[i] = left;
      } else {
        labels[i] = Math.min(up,left);
        if (up !== left) union(up,left);
      }
    }
  }
  for (let i=1; i<label; i++) parent[i] = find(i);

  const map = new Map();
  for (let y=0; y<h; y++){
    for (let x=0; x<w; x++){
      const i = y*w+x;
      const l = labels[i];
      if (l===0) continue;
      const r = parent[l] || l;
      let comp = map.get(r);
      if (!comp) {
        comp = { minx:x, miny:y, maxx:x, maxy:y, area:0 };
        map.set(r, comp);
      }
      comp.area++;
      comp.minx = Math.min(comp.minx, x);
      comp.miny = Math.min(comp.miny, y);
      comp.maxx = Math.max(comp.maxx, x);
      comp.maxy = Math.max(comp.maxy, y);
    }
  }

  const comps = [];
  map.forEach(c => {
    const w1 = c.maxx - c.minx + 1;
    const h1 = c.maxy - c.miny + 1;
    const area = w1 * h1;
    if (w1 < 3 || h1 < 3) return;
    if (area < 20) return;
    if (w1/h1 > 8 || h1/w1 > 8) return;
    comps.push({ x: c.minx, y: c.miny, w: w1, h: h1, area });
  });
  return comps;
}
