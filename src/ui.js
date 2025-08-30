export const UI = (() => {
  let video, overlay, ctx, statusEl, fpsEl, totalEl, breakdownEl, toastEl, hintEl;

  function init() {
    video = document.getElementById('video');
    overlay = document.getElementById('overlay');
    ctx = overlay.getContext('2d');
    statusEl = document.getElementById('statusText');
    fpsEl = document.getElementById('fpsText');
    totalEl = document.getElementById('totalScore');
    breakdownEl = document.getElementById('breakdown');
    toastEl = document.getElementById('toast');
    hintEl = document.getElementById('flashHint');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    overlay.width = overlay.clientWidth;
    overlay.height = overlay.clientHeight;
  }

  function showFlashHint(ms=5000) {
    hintEl.classList.add('show');
    setTimeout(()=>hintEl.classList.remove('show'), ms);
  }

  function setStatus(text) { statusEl.textContent = text; }
  function setFPS(fps) { fpsEl.textContent = `FPS: ${fps.toFixed(1)}`; }

  function updateScore(total) { totalEl.textContent = Number(total).toString(); }
  function updateBreakdown(items) {
    breakdownEl.innerHTML = '';
    for (const it of items) {
      const li = document.createElement('li');
      li.textContent = `${it.text} @ (${Math.round(it.bbox.x)},${Math.round(it.bbox.y)}) conf=${it.conf.toFixed(2)}`;
      breakdownEl.appendChild(li);
    }
  }

  function toast(msg, ms=1200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(()=>toastEl.classList.remove('show'), ms);
  }

  function drawOverlays(items, diag) {
    const w = overlay.width, h = overlay.height;
    ctx.clearRect(0,0,w,h);
    // 可选：根据 diag 显示质量条
    if (diag?.redRatio != null) {
      ctx.fillStyle = 'rgba(255,82,82,0.2)';
      ctx.fillRect(0, 0, Math.min(w*diag.redRatio, w), 4);
    }
    ctx.lineWidth = 2;
    ctx.font = '16px system-ui, sans-serif';
    ctx.textBaseline = 'top';

    for (const it of items) {
      ctx.strokeStyle = 'rgba(255,82,82,0.9)';
      ctx.fillStyle = 'rgba(255,82,82,0.15)';
      const { x,y,w:bw,h:bh } = it.bboxCanvas ?? it.bbox;
      ctx.fillRect(x,y,bw,bh);
      ctx.strokeRect(x,y,bw,bh);
      ctx.fillStyle = '#ff5252';
      ctx.fillText(`${it.text} (${(it.conf*100|0)}%)`, x+4, y+4);
    }
  }

  function getVideoEl() { return video; }
  function getOverlayEl() { return overlay; }

  return { init, showFlashHint, setStatus, setFPS, updateScore, updateBreakdown, toast, drawOverlays, getVideoEl, getOverlayEl };
})();