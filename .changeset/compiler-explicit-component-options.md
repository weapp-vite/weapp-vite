---
"@wevu/compiler": patch
---

修复 Vue SFC 中显式 `defineOptions` 被全局组件默认值覆盖的问题，保留组件样式隔离与全局类选项的覆盖顺序，并输出可静态确认的组件样式选项供构建流程判断页面样式依赖。
