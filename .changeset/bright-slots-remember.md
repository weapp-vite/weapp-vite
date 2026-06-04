---
"wevu": patch
"create-weapp-vite": patch
---

修复 wevu 在 performance 模式下 scoped slot 与默认 slot 首屏同步失败的问题，确保插槽 owner 与静态 slot 元数据在真实小程序运行时稳定传递，并避免 prop-backed 插槽组件触发运行时循环更新。
