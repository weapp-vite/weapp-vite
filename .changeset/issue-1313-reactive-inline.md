---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(wevu): 修复模板内联事件错误读取 reactive 对象的 `.value`，恢复独立区域的展开和收起，并保留 ref 赋值与作用域插槽事件行为。
