---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 classic 开发构建在外部样式修改过程中读取不同源码版本，导致 CSS 变量恢复时脚本未同步发布的问题。分类与编译共用当前批次的 SFC 及外部块快照，构建期间继续发生的修改会重新排队分析。
