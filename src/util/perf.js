export class Perf {
  constructor(n=30){ this.buf=new Array(n).fill(0); this.i=0; }
  push(v){ this.buf[this.i]=v; this.i=(this.i+1)%this.buf.length; }
  avg(){ const s=this.buf.reduce((a,b)=>a+b,0); return s/this.buf.length; }
}
