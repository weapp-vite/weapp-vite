---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC HMR 的 Tailwind content 判定：当脚本或样式更新不改变模板内容和动态 class 相关脚本字符串候选时，不再刷新 app.wxss 与相关样式产物；`hmr.touchAppWxss: auto` 也只在 Tailwind/style dirty reason 下触碰 app 样式入口，减少纯脚本 HMR 输出影响面并降低样式更新延迟。
