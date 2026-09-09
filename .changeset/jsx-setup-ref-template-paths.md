---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 JSX/TSX setup render 闭包中的 ref 在小程序数据解包后仍按 `value` 字段读取，导致计数、属性和循环内容为空的问题。模板与绑定清单统一使用解包后的路径，同时保留普通对象字段、循环局部变量及 JavaScript 事件闭包语义。
