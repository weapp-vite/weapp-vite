---
"weapp-vite": minor
"create-weapp-vite": patch
---

feat(watch): 新增实验性的 Parcel 文件监听后端，可通过 `weapp.watch.engine` 与默认 Chokidar 对照验证自有监听的稳定性；保留原有构建发布和 Vite/Rolldown 主图监听边界。
