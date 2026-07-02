---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 app 入口加载阶段的侧边配置发现流程，将 sitemap/theme 等 app side JSON 与 `app.miniapp.json` / `project.miniapp.json` 检测并行执行，减少构建与 app 入口 HMR 中不必要的串行文件探测等待。
