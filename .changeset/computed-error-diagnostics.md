---
"@wevu/compiler": patch
---

为模板运行时 computed 绑定补充错误日志，当调用表达式、class/style 或 v-for 数据源在小程序运行时求值失败时，通过 `console.error` 输出绑定名、原始表达式和异常对象，避免关闭作用域插槽后迁移遗漏的 computed 被静默吞掉。
