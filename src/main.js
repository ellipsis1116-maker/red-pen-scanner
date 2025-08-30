import { UI } from './ui.js';
import { initCamera } from './camera.js';
import { createPipeline } from './pipeline.js';
import { Score } from './score.js';

let pipeline = null;
let scoring = null;

// 横竖模式：'landscape' | 'portrait'，按钮文字：横/竖
let orient = 'landscape';

async function boot() {
  UI.init();
  UI.setStatus('准备中...');
  scoring = new Score();

  const stream = await initCamera({ facingMode: 'environment', width: 1280, height: 720 }).catch(err => {
    UI.toast('相机权限被拒绝或不可用');
    console.error(err);
    throw err;
  });

  pipeline = await createPipeline({
    backend: 'tfjs',
    modelPath: './model/tfjs/model.json',
    targetFps: 8,
    getOrient: () => orient, // 由 UI 控制横竖
    onDetections: (items, diag) => {
      scoring.addDetections(items);
      const total = scoring.getTotal();
      UI.updateScore(total);
      UI.drawOverlays(items, diag);
      if (diag?.suggestions?.length) UI.setStatus(diag.suggestions.join(' | '));
    },
    onFps: (fps) => UI.setFPS(fps),
  });

  UI.setStatus('就绪');

  const startBtn = document.getElementById('startBtn');
  const orientBtn = document.getElementById('orientBtn');
  const resetBtn = document.getElementById('resetBtn');

  startBtn.onclick = async () => {
    if (!pipeline.running) {
      await pipeline.start(stream);
      UI.toast('开始识别');
    }
  };

  orientBtn.onclick = () => {
    orient = orient === 'landscape' ? 'portrait' : 'landscape';
    orientBtn.textContent = orient === 'landscape' ? '横' : '竖';
    UI.applyOrientation(orient);
  };

  resetBtn.onclick = () => {
    scoring.reset();
    UI.updateScore(0);
    UI.toast('已重置');
  };
}

boot();
