---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

为静态对象形式的 `defineOptions({ ... })` 增加直接内联快路径，避免常见 SFC 编译场景创建临时 bundle 执行，降低 Vue SFC 与模板组件元信息解析开销。
