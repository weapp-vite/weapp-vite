---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 dev watch 中自动导入组件已存在于 `usingComponents` 时没有参与强制 emit 的问题，避免新增 Vue SFC 组件在部分平台下只更新引用配置但漏写组件产物。
