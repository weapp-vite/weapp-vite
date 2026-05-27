---
"@wevu/compiler": patch
"create-weapp-vite": patch
---

修复 `toRefs(props)` 解构出的 props 绑定未被识别为 props 派生字段的问题，避免组件把大 props 误当成本地 setup 状态回写；同时将 TDesign retail 模板默认切回 WebView 渲染，提升微信开发者工具预览和 IDE e2e 的稳定性。
