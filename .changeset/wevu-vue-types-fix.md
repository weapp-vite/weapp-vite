---
"wevu": patch
---

修复 wevu 无 Vue 依赖时的类型入口，补齐 DefineComponent 默认 props 推导与 ComponentPublicInstance 形态，确保 Volar 能正确解析 SFC props。
