export const UI = (() => {
  let video, overlay, ctx, statusEl, fpsEl, totalEl, toastEl, viewportEl;

  function init() {
    viewportEl = document.getElementById('viewport');
    video = document.getElementById('video');
    overlay = document.getElementById('overlay');
    ctx = overlay.getContext('2d');
    statusEl = document.getElementById('statusText');
    fpsEl = document.getElementById('fpsText');
    totalEl = document.getElementById('totalScore');
    toastEl = document.getElementById('toast');

    applyOrientation('landscape'); // 默认横
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function applyOrientation(mode) {
    viewportEl.classList.remove('landscape', 'portrait');
    viewportEl.classList.add(mode === 'portrait' ? 'portrait' : 'landscape');
    // 旋转的是 viewport 容器，overlay 的 CSS 尺寸不变，但视觉会跟随旋转
    // 保证 overlay 像素尺寸和 CSS 尺寸同步
    requestAnimationFrame(resizeCanvas);
  }

  function resizeCanvas() {
    overlay.width = overlay.clientWidth;
    overlay.height = overlay.clientHeight;
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

  return { init, applyOrientation, setStatus, setFPS, updateScore, toast, drawOverlays, getVideoEl, getOverlayEl };
})();
