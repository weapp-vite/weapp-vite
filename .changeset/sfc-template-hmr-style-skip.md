---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC 模板热更新的脏文件判定，模板内容变化时不再刷新未变更的样式产物，减少小程序开发模式下不必要的 wxss/acss 写入。
