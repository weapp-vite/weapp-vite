---
'@wevu/compiler': patch
---

修复模板表达式在 `v-for` 场景下错误优先读取 `__wevuProps` 导致 `:class` 不响应更新的问题；新增 issue #302 的编译与运行时 e2e 用例，覆盖点击切换后 class 与状态同步更新的行为。
