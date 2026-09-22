---
"@weapp-core/shared": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复抖音原生多端模板中 PascalCase 组件标签与 usingComponents 注册名不一致导致组件不显示的问题，在平台描述中统一启用标签归一化，保持自闭合和嵌套标签一致。
