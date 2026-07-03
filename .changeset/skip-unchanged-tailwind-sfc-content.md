---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Vue SFC HMR 的 Tailwind content 判定：Tailwind signature 会跳过普通模板文本，同时保留模板 class-like 属性/绑定；模板存在动态 class-like 绑定时保留脚本字符串，其他脚本侧场景保守跟踪调用表达式里的字符串候选，覆盖 class 工具别名和跨文件封装场景。无关模板文本、普通脚本或样式更新不再刷新 app.wxss 与相关样式产物，`hmr.touchAppWxss: auto` 也不再为共享 CSS importer 额外触碰 app 样式入口，减少无关 HMR 输出影响面并降低更新延迟。
