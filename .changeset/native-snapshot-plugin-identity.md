---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发快照收集插件监听依赖时丢失 Vite 原生插件身份，导致 TypeScript 转换和路径别名解析失效的问题。无 JavaScript 钩子的原生插件保留原实例，其余包装保留原型和未包装属性的描述，并兼容冻结插件的钩子，确保主包与独立分包沿用完整编译链路。
