---
"@weapp-vite/ast-native": patch
"@wevu/compiler": major
---

将模板与 JSX 的 `warnings` 升级为带 code、severity 和 loc 的结构化 `diagnostics`，并支持完整 SFC 源码定位。同步补充 Vue 语义对齐与 fuzz 回归，移除无稳定收益的 native SFC 接入，优化诊断热路径和编译器分发体积。
