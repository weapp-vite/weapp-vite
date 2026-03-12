---
'weapp-vite': patch
'create-weapp-vite': patch
---

为 `weapp-vite build` 增加主包与分包体积报告，并支持在包体积超过默认 2 MB 阈值时输出告警，便于在构建结束后直接发现包体积风险。
