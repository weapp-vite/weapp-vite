---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 `weapp-vite` 在 dev/HMR 增量产物里刷新 shared chunk importer 关系时，对“当前 partial emit 缺失中间 shared chunk，但该 chunk 仍继续依赖更深层 vendor helper”的场景处理不完整的问题。现在会同时保留这类缺席 chunk 的嵌套依赖关系，避免 `computed is not a function`、`createComponent is not a function` 这类由 wevu 共享运行时 helper 丢失或未联动重编译导致的偶发报错。
