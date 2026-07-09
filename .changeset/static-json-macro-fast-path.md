---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

为静态 JSON 宏增加对象字面量快路径，常见的 `definePageJson({ ... })` / `defineComponentJson({ ... })` 不再需要临时 bundle 执行，降低 Vue SFC 与 JSX 编译中的宏解析开销。
