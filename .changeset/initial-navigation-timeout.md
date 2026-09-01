---
'wevu': patch
'@weapp-core/constants': patch
'create-weapp-vite': patch
---

修复首屏异步路由守卫长期等待、异常和页面卸载后的迟到回调问题，增加可配置超时并统一清理导航状态，避免页面假死、元素缺失和实例泄漏。
