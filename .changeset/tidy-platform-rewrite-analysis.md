---
"weapp-vite": patch
"create-weapp-vite": patch
---

复用 npm 产物重写时取得的平台 API 分析结果，避免开发构建与 HMR 对没有宿主 API 调用的脚本重复解析，同时保留转义标识符、可选访问和局部绑定的正确处理。
