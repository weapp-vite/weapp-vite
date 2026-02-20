---
'@wevu/compiler': patch
wevu: patch
---

修复 `defineProps` 布尔类型在模板调用表达式（如 `String(bool)`）中的运行时绑定结果为 `undefined` 的问题（#300）。编译器现在会对模板运行时绑定标识符增加 `__wevuProps` 回退读取逻辑；运行时则预置并复用响应式 `__wevuProps` 容器，确保计算属性首次求值即可建立正确依赖并在 props 变更时稳定更新。

同时补充对应的编译回归测试与运行时同步测试，覆盖 `script setup` 的 props 解构场景。
