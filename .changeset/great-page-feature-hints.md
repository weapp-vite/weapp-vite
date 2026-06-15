---
"@wevu/compiler": patch
---

优化 wevu 页面特性收集的 AST 热路径：无关源码先通过统一文本预检早退，OXC 模式下复用一次 module analysis 同时覆盖 `wevu` 与 `wevu/internal-runtime`，避免内部运行时导入触发重复解析。
