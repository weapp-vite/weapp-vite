---
'@wevu/compiler': patch
---

修复 wevu 把 `(a ?? []).length` 这类表达式编成非法 WXML `(expr).length` 的问题，改为回退到 JS runtime binding。
