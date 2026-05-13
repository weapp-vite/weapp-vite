---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复小程序 dev/HMR 场景下 runtime vendor chunk 在全量构建和增量构建之间拓扑漂移的问题，避免页面入口引用到缺少导出的旧 shared chunk。
