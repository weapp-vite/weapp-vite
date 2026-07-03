---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC HMR 的 Tailwind content 判定：Tailwind signature 只跟踪模板里的 class / :class / v-bind 相关片段和必要脚本字符串候选，普通模板文本、纯脚本或样式更新不再刷新 app.wxss 与相关样式产物；`hmr.touchAppWxss: auto` 也不再为共享 CSS importer 额外触碰 app 样式入口，减少无关 HMR 输出影响面并降低更新延迟。
