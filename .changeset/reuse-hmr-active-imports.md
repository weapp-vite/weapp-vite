---
"weapp-vite": patch
"create-weapp-vite": patch
---

复用开发态 HMR 裁剪阶段收集的 active entry import 图，减少 shared chunk rewrite 前的重复 bundle 扫描。
