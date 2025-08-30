import { UI } from './ui.js';
import { initCamera, switchCamera, tryTorch } from './camera.js';
import { createPipeline } from './pipeline.js';
import { Score } from './score.js';

let pipeline = null;
let scoring = null;
let torchOn = false;
let rotateMode = 0; // 0,1,2,3 => 0/90/180/270 deg

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
    getRotateMode: () => rotateMode, // 新增：由 UI 控制旋转角度
    onDetections: (items, diag) => {
      scoring.addDetections(items);
      const total = scoring.getTotal();
      UI.updateScore(total);
      UI.updateBreakdown(scoring.getBreakdown());
      UI.drawOverlays(items, diag);
      if (diag?.suggestions?.length) UI.setStatus(diag.suggestions.join(' | '));
    },
    onFps: (fps) => UI.setFPS(fps),
  });

  UI.setStatus('就绪');
  UI.showFlashHint(5000);

  const startBtn = document.getElementById('startBtn');
  const switchBtn = document.getElementById('switchBtn');
  const rotateBtn = document.getElementById('rotateBtn');
  const torchBtn = document.getElementById('torchBtn');
  const resetBtn = document.getElementById('resetBtn');

  startBtn.onclick = async () => {
    if (!pipeline.running) {
      await pipeline.start(stream);
      UI.toast('开始识别');
    }
  };
  switchBtn.onclick = async () => {
    const newStream = await switchCamera();
    await pipeline.replaceStream(newStream);
    UI.toast('已切换相机');
  };
  rotateBtn.onclick = () => {
    rotateMode = (rotateMode + 1) % 4;
    UI.toast(`旋转至 ${rotateMode*90}°`);
  };
  torchBtn.onclick = async () => {
    torchOn = !torchOn;
    const ok = await tryTorch(torchOn);
    if (!ok) {
      UI.toast('设备或浏览器不支持手电筒');
      torchOn = false;
    } else {
      UI.toast(torchOn ? '手电筒已开' : '手电筒已关');
    }
  };
  resetBtn.onclick = () => {
    scoring.reset();
    UI.updateScore(0);
    UI.updateBreakdown([]);
    UI.toast('已重置');
  };
}

boot();
