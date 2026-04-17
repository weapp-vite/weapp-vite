---
'@weapp-vite/volar': minor
---

增强 Volar 插件对 `defineOptions` 模板上下文的类型推断，补齐 `properties`、`data`、`computed` 与 `methods` 的常见声明写法支持，包括原生小程序风格的 `data: { ... }`、常见 getter/函数式 `computed`，以及保留参数与返回类型的方法签名，让 `.vue` 模板中的字段补全、事件处理器与方法调用获得更准确的类型体验。
