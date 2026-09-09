---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Tailwind 编译器读取磁盘原文而遗漏前置插件内存修改的问题。保留外链样式请求身份，将前置转换后的 CSS 交给 Core 编译器，并同步样式来源与热更新失效，避免 `@apply`、`@theme` 等构建指令泄漏到微信 WXSS。

保留 Vue 外链样式的 scoped 与预处理流程，并隔离同源样式在不同组件中的转换结果，避免共享入口覆盖组件作用域。
