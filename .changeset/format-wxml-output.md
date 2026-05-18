---
"@wevu/compiler": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 `weapp.vue.template.formatWxml` 配置项，支持在开发态默认格式化 Vue SFC / JSX 生成的 WXML，并在生产构建默认保持紧凑输出。该能力只做标签层级缩进，不重排文本内容，便于开发者在开发者工具中阅读和调试产物。
