```markdown
# 红笔分数识别 - Demo

说明：
- 这是一个最小可运行的前端 Demo，用于从后置摄像头的视频流中提取红色笔迹并识别数字（包括小数点），并计算总分。
- 所有处理都在浏览器端完成，不会上传图片到服务器。

运行：
1. 将本仓库推到 GitHub，打开仓库设置 -> Pages，启用 Pages（选择 main 分支 / 根目录），访问 username.github.io/repo 即可（HTTPS 自动生效）。
2. 本地测试：在本机上运行时，localhost 被视为安全上下文，getUserMedia 可以工作。如果在局域网手机测试，请使用 GitHub Pages 或部署到支持 HTTPS 的托管（Vercel/Netlify）.

改进建议：
- 使用 OpenCV.js 做透视变换（warpPerspective）以校正拍摄角度（推荐）。
- 如果 Tesseract 识别错误率高，可以训练一个小的 tfjs CNN 来识别单个字符/数字（对你的题卡数字字体做微调）。
- 改进红色提取（HSV 空间更鲁棒），并做形态学去噪（膨胀/腐蚀）。
```