---
"wevu": patch
"create-weapp-vite": patch
---

放宽 `wevu` 组件与应用的 `data` 类型签名，使其同时支持对象字面量与函数返回对象两种写法。现在 `defineComponent({ data: { ... } })` 与 `createApp({ data: { ... } })` 都会被正确接受并初始化，更贴近微信原生 `Component` / `App` 的使用方式，同时保留原有函数写法的兼容性。
