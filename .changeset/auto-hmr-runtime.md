---
"weapp-vite": patch
"create-weapp-vite": patch
"@weapp-core/constants": patch
"@wevu/web-apis": patch
"@weapp-vite/miniprogram-automator": patch
---

微信小程序开发模式默认根据开发者工具的热重载设置自动选择 HMR 运行时，并在启动时显示当前模式与切换方法；同时确保 Web API 网络默认值在分包和共享 chunk 的多份运行时实例之间保持一致，并避免截图协议超时后在同一 DevTools 连接上继续叠加请求。
