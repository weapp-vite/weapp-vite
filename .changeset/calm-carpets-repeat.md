---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `injectWeapi.replaceWx` 注入时代码仍依赖 `Function(...)` 动态执行的问题，改为仅使用静态宿主全局同步与源码重写方案，避免在小程序宿主中因 `Function` 不可用而导致 `wx` / `my` 替换逻辑失效。
