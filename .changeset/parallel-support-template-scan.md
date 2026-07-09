---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 support files 同步中的模板标签扫描，`.vue` 与 `.wxml` 文件改为并发读取和解析，减少构建启动阶段的串行等待。
