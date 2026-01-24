---
'wevu': patch
'rolldown-require': patch
'create-weapp-vite': patch
---

对齐 `watch`/`watchEffect` 的 `flush`/`scheduler`/`once`/`deep:number` 行为与类型，并补充 `traverse` 分支覆盖；修复 rolldown-require 的类型构建错误。
