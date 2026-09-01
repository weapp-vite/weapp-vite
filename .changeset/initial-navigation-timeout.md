---
'wevu': patch
'@weapp-core/constants': patch
'create-weapp-vite': patch
---

修复首屏异步路由守卫长期等待、异常和页面卸载后的迟到回调问题。首屏导航默认改为 `eager`，页面先挂载渲染；需要在守卫完成前阻止挂载时，可通过 `initialNavigationMode: 'blocking'` 显式开启，并使用 `initialNavigationTimeout` 防止永久等待。统一清理导航状态，避免页面假死、元素缺失和实例泄漏。
