---
"@weapp-vite/miniprogram-automator": patch
---

为小程序自动化请求补充单次调用级 timeout，并修复请求定时器没有使用自定义 timeout 的问题。页面读取和路由切换现在可以按调用场景配置更短的探测超时与重试策略，避免微信开发者工具 App 页面协议异常时长时间阻塞 IDE e2e。
