---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复作用域插槽出口带默认兜底内容时会被编译器忽略的问题；现在 `<slot :foo="bar">fallback</slot>` 会根据父级插槽存在元数据正确切换作用域插槽投影与 fallback 渲染。
