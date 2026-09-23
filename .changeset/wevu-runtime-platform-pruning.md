---
"@weapp-core/shared": patch
"@wevu/web-apis": patch
"@wevu/compiler": patch
"@weapp-vite/web": patch
"wevu": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

根据六类小程序与 Web 构建目标自动裁剪 Wevu 宿主适配，移除未使用的首航路由与 JSX island 实现，并避免 SFC 子组件注册重新引入完整兼容工厂。保留动态公开 API 和跨平台 adapter 行为，补充七端体积门禁与真实消费回归，同步脚手架随包指引。
