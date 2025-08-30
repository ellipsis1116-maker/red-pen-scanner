export const UI = (() => {
  let video, overlay, rotateWrap, rotateInner, hudEl, ctx, statusEl, fpsEl, totalEl, toastEl;

  function init(defaultMode='portrait') {
    video = document.getElementById('video');
    overlay = document.getElementById('overlay');
    rotateWrap = document.getElementById('rotate-wrap');
    rotateInner = document.getElementById('rotate-inner');
    hudEl = document.getElementById('hud');
    ctx = overlay.getContext('2d');
    statusEl = document.getElementById('statusText');
    fpsEl = document.getElementById('fpsText');
    totalEl = document.getElementById('totalScore');
    toastEl = document.getElementById('toast');

    applyMode(defaultMode);
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function applyMode(mode) {
    rotateWrap.classList.remove('mode-portrait', 'mode-landscape');
    rotateWrap.classList.add(mode === 'landscape' ? 'mode-landscape' : 'mode-portrait');
    requestAnimationFrame(resizeCanvas);
  }

  function resizeCanvas() {
    // 根据旋转后的容器尺寸设置 canvas 像素大小
    const rect = rotateInner.getBoundingClientRect();
    overlay.width = Math.max(1, Math.round(rect.width));
    overlay.height = Math.max(1, Math.round(rect.height));
  }

  function setStatus(text) { statusEl.textContent = text; }
  function setFPS(fps) { fpsEl.textContent = `FPS: ${fps.toFixed(1)}`; }
  function updateScore(total) { totalEl.textContent = Number(total).toString(); }

  function toast(msg, ms=1200) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(()=>toastEl.classList.remove('show'), ms);
  }

  function drawOverlays(items, diag) {
    const w = overlay.width, h = overlay.height;
    ctx.clearRect(0,0,w,h);
    if (diag?.redRatio != null) {
      ctx.fillStyle = 'rgba(255,82,82,0.2)';
      ctx.fillRect(0, 0, Math.min(w*diag.redRatio*5, w), 4);
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

  return { init, applyMode, setStatus, setFPS, updateScore, toast, drawOverlays, getVideoEl, getOverlayEl };
})();
