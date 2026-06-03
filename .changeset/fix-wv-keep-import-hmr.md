---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 样式在 HMR 重建时可能跳过 `@wv-keep-import` 后处理的问题，确保产物稳定输出为 `@import`。
