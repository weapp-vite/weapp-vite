---
"wevu": patch
"@wevu/web-apis": patch
"@weapp-core/constants": patch
"create-weapp-vite": patch
---

修复抖音等小程序模块缺少 globalThis 或仅提供顶层宿主绑定时的 router 初始化与微任务调度，统一宿主解析并保留独立分包的 router 隔离；同时修复支付宝页面在 setup 和后续生命周期中丢失路由 query 的问题。
