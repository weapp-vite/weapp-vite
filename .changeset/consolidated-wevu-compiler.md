---
'@wevu/compiler': patch
---

整合 wevu compiler 相关 changeset。

## 变更摘要
1. **cool-rings-double.md**：修复 `<script setup>` 中 `defineOptions({ behaviors: [...] })` 的编译兼容性：当 `behaviors` 依赖原生 `Behavior()` 返回值且构建环境不存在全局 `Behavior` 时，不再在 `defineOptions` 内联阶段抛错，而是回退为保留原始 `defineOptions` 表达式继续编译。补充了内联单测与 `compileVueFile` 端到端测试，覆盖内建行为字符串与原生 `Behavior` 导入两类场景。
