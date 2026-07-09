---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue transform 启动阶段的原生 layout 预扫描，将 fallback 页面入口的 layout 预加载改为并发执行，减少多页面项目构建时的串行文件探测与读取等待。
