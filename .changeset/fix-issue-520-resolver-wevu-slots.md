---
"@wevu/compiler": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `autoImportComponents.resolvers` 命中 wevu/Vue SFC 组件时插槽元信息识别不完整的问题，确保通过 resolver 自动导入的组件在传入子组件插槽时也会生成 `vue-slots` 属性。
