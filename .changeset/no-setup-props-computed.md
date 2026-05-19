---
"wevu": patch
"create-weapp-vite": patch
---

修复无 `setup()` 的 Options 组件中，模板生成的 computed class/style 无法读取 props 的问题；普通组件现在也会初始化并同步 `__wevuProps`，确保 props 变化能驱动运行时绑定更新。
