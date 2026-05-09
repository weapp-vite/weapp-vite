---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复普通具名插槽在增强 scoped slot 父级传入时，宿主组件未声明对应 generic 导致微信开发者工具提示 `generic "wx-scoped-slots-*" is not defined` 的问题。编译器现在会为可增强的具名 slot outlet 同步声明受 owner id 保护的 generic fallback，同时保留原生 slot 投影兼容性。
