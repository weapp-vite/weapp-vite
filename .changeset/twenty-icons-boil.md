---
"weapp-vite": patch
"create-weapp-vite": patch
---

收紧开发态 HMR 默认日志的单行长度：压缩 `dirty/pending/emitted` 统计、简写原因摘要，并把滚动趋势缩减为 `avg/max`，减少频繁热更新时的终端噪音。
