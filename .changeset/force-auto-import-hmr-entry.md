---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式下新增自动导入 Vue SFC 组件时，页面 `usingComponents` 已更新但组件自身模板产物可能未在同轮 HMR 中输出的问题。
