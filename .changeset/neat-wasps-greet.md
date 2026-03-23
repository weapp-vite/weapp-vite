---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 在入口装载阶段对 Vue layout 的 scriptless 判定。现在同一个 layout 文件在多页面共享时，会复用首次读取与 `parseSfc` 的判定结果，而不再为每个页面重复读取和解析该 layout，从而减少 `weapp-vite:pre` 阶段的重复工作。
