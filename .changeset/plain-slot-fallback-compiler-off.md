---
"@wevu/compiler": patch
---

修复关闭 `scopedSlotsCompiler` 时，非作用域 `<slot>` 兜底内容重新退回原生 fallback 输出的问题。现在该场景也会继续基于 `vue-slots` 元信息生成显式条件分支，避免不同 compiler 配置下的普通 slot fallback 行为不一致。
