---
"@weapp-core/constants": patch
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `scopedSlotsCompiler: 'augmented'` 下插槽内容中的 `__wv_bind_*` 计算属性无法调用宿主 `setup` 方法的问题。增强 scoped slot 运行时现在会保留宿主 proxy 引用，编译出的 JS 计算表达式优先读取该 proxy，从而让 `func(text)` 这类插槽表达式可以正常得到 `987654321`，同时仍保留序列化快照用于 WXML 数据渲染。
