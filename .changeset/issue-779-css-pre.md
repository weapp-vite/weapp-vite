---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 CSS `pre` 插件处理结果未传递到 Tailwind 与小程序样式 sidecar 输出的问题，样式生成现在优先使用 Vite 管线中的内存内容。
