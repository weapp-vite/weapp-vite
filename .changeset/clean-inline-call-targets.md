---
"@wevu/compiler": patch
---

修复 Vue SFC 内联事件表达式中函数调用目标被误补 `.value` 的问题，保留 `handle(count)` 这类调用里的函数目标，同时继续对 ref 参数读取和赋值目标写回 `.value`。
