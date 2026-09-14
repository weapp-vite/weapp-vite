---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Vue SFC 模板内联事件中对象与数组解构赋值未写回组件状态的问题，支持别名、默认值、剩余元素、局部遮蔽和顶层 ref 目标，并保留 setup let 访问器的闭包写入语义。
