// 轻量CNN的TF.js加载与推理。
// 若 model.json 不存在或加载失败，则回退到“占位推理”（基于形状/随机），方便先跑通。
let tf = null;
let model = null;
let modelAvailable = false;

export async function loadTFJSModel(modelPath) {
  try {
    // 动态引入 tfjs
    if (!('tf' in self)) {
      importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js');
    }
    tf = self.tf;
    model = await tf.loadLayersModel(modelPath);
    // 预热
    const dummy = tf.zeros([1, 32, 32, 1]);
    model.predict(dummy).dispose();
    dummy.dispose();
    modelAvailable = true;
  } catch (err) {
    // 保持占位模式
    modelAvailable = false;
    // console.warn('TF.js 模型不可用，使用占位推理:', err);
  }
}

export function hasModel() { return modelAvailable; }

export async function inferTFJS(input) {
  // input: { data: Float32Array[], N,H,W,C }
  const N = input.N;
  if (!N) return [];

  if (!modelAvailable) {
    // 占位：简单按像素总量估计“是否像数字”，并随机一个数字；同时根据平均强度判断 dot
    const preds = [];
    for (let i=0; i<N; i++){
      const arr = input.data[i];
      let sum = 0;
      for (let k=0;k<arr.length;k++) sum += arr[k];
      const avg = sum / arr.length; // 0~1
      let char = avg < 0.03 ? 'dot' : String(((Math.random()*10)|0));
      let prob = Math.min(0.95, 0.4 + Math.random()*0.5);
      preds.push({ id: i, char, prob });
    }
    return preds;
  }

  // 真推理
  const tf = self.tf;
  const H = input.H, W = input.W;
  const data = new Float32Array(N * H * W);
  // 拼接数据
  for (let i=0;i<N;i++){
    data.set(input.data[i], i*H*W);
  }
  const x = tf.tensor4d(data, [N, H, W, 1]);
  const y = model.predict(x);
  const yArr = await y.array();
  x.dispose(); y.dispose();

  // 类别映射
  const classes = ['0','1','2','3','4','5','6','7','8','9','dot'];
  const preds = [];
  for (let i=0;i<N;i++){
    const row = yArr[i];
    let best=-1, bi=-1;
    for (let j=0;j<row.length;j++){
      if (row[j]>best){ best=row[j]; bi=j; }
    }
    preds.push({ id: i, char: classes[bi] || '0', prob: Math.max(0.01, Math.min(0.99, best)) });
  }
  return preds;
}
