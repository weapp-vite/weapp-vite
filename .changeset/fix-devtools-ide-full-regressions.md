---
"@wevu/compiler": patch
"@weapp-vite/miniprogram-automator": patch
"@weapp-vite/mcp": patch
"weapp-vite": patch
"weapp-ide-cli": patch
"create-weapp-vite": patch
---

修复微信开发者工具真实运行时中的插件页面识别、插件路由跳转、选择器查询、WXML 读取与页面栈切换稳定性，并确保 Wevu 组件注册在默认导出前完成。IDE 自动化现在会对受限协议提供明确的降级证据，同时保留真实路由、DOM 状态和构建产物验收。
