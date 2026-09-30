---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复仅由 `componentGenerics.default` 引用的组件未进入构建入口和增量依赖图，导致默认组件产物缺失的问题。构建失败时等待 npm、worker 等并行任务结束，避免调用方清理临时目录后仍有后台写入或未处理拒绝。同步脚手架版本以获取修复后的构建链。
