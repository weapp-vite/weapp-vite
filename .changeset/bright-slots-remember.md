---
"@wevu/compiler": patch
"weapp-vite": patch
"weapp-ide-cli": patch
"wevu": patch
"create-weapp-vite": patch
---

修复 wevu 在 performance 模式下 scoped slot 与默认 slot 首屏同步失败的问题，确保插槽 owner 与静态 slot 元数据在真实小程序运行时稳定传递，并避免 prop-backed 插槽组件触发运行时循环更新；同时增强微信开发者工具 IDE e2e 的模拟器启动失败恢复能力，在 DevTools 内部缓存状态损坏时自动清理并重试。Vue SFC 模板编译现在会将静态对象字面量 prop 直接输出为小程序 WXML 对象表达式，减少不必要的运行时 computed/setData。
