---
"weapp-vite": patch
"wevu": patch
"@wevu/compiler": patch
"@weapp-core/constants": patch
"create-weapp-vite": patch
---

修复 `scopedSlotsCompiler: 'augmented'` 下默认插槽中的运行时绑定表达式无法调用宿主 `setup` 方法的问题。增强 scoped slot 生成的 `__wv_bind_*` 现在会从宿主 proxy 读取函数和值，WXML 仍保留序列化快照用于模板渲染。
