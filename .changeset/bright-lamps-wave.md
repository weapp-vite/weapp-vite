---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 dev 模式下自动导入新增 Vue 组件时的入口解析兜底逻辑。当解析器暂时无法返回新建组件的 resolved id，但组件文件已经实际落盘时，`weapp-vite` 现在会回退到该绝对路径继续发射组件产物，避免 `usingComponents` 已更新但组件 `wxml/json` 迟迟不生成，提升 macOS 等环境下新增 SFC 的热更新稳定性。
