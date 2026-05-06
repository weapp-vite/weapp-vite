---
"@wevu/api": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复支付宝小程序 worker 环境中 `window`、`self`、`global` 同时存在但缺少 `globalThis` 时，weapi 网络策略和 wpi 注入读取宿主配置或平台 API 可能命中错误全局根对象的问题。
