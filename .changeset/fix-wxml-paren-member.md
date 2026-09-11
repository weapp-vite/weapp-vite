---
'@wevu/compiler': patch
---

修复 wevu 把 `(a ?? []).length` 这类表达式编成非法 WXML `(expr).length` 的问题。Vue 模板和 JSX 现在都会把括号后的成员访问回退到 JS runtime binding。
