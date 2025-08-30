# 红笔分数采集助手（Web）

- 打开 index.html（需HTTPS，GitHub Pages可用）
- 首次加载建议联网以从 CDN 加载 TF.js（也可改为本地 tf.min.js）
- 若放置真实模型：将 TF.js 模型导出到 model/tfjs/model.json，并上传权重bin
- 运行后：点击“开始识别”，允许相机。红色提示将显示5秒。
- 默认每秒约8帧进行解析。可在 src/pipeline.js targetFps 调整。

目录说明
- src/main.js 启动与按钮事件
- src/ui.js UI与绘制overlay
- src/camera.js 相机权限、切换、torch
- src/pipeline.js 主线程与Worker通信、帧采样
- src/score.js 去重与合计
- src/worker/* 颜色分割、连通域、分组、预处理、模型推理、质量评估
