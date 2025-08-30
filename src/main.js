import { UI } from './ui.js';
import { initCamera } from './camera.js';
import { createPipeline } from './pipeline.js';
import { Score } from './score.js';

let pipeline = null;
let scoring = null;

// 应用构图模式：'portrait' | 'landscape'
let appMode = 'portrait'; // 默认竖屏应用模式

async function boot() {
  UI.init(appMode);
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
    getAppMode: () => appMode, // 由UI控制应用构图模式
    onDetections: (items, diag) => {
      // 注意：items 的 bbox 已映射到当前屏幕坐标，无需再考虑旋转
      scoring.addDetections(items);
      UI.updateScore(scoring.getTotal());
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
    appMode = appMode === 'portrait' ? 'landscape' : 'portrait';
    orientBtn.textContent = appMode === 'landscape' ? '竖' : '横';
    UI.applyMode(appMode);
    UI.toast(`已切换为${appMode === 'landscape' ? '横屏' : '竖屏'}模式`);
  };

  resetBtn.onclick = () => {
    scoring.reset();
    UI.updateScore(0);
    UI.toast('已重置');
  };
}

boot();
