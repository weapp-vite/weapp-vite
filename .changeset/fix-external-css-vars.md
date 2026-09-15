---
'@wevu/compiler': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 Vue SFC 外部样式中 CSS `v-bind()` 的变量注册、模板注入与外部文件热更新，使其与内联样式保持一致。
