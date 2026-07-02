---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC HMR 的 Tailwind content 判定：当脚本或样式更新不改变模板内容和脚本字符串候选时，不再刷新 app.wxss 与相关样式产物，减少 HMR 输出影响面并降低样式更新延迟。
