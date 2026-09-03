---
'@weapp-core/shared': patch
'@wevu/web-apis': patch
'wevu': patch
'@mpcore/simulator': patch
'@weapp-vite/eslint': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 Wevu 首屏异步导航对宿主 `queueMicrotask` 和现代内建的隐式依赖，收紧 headless simulator 的 AppService 全局边界，并新增仅作用于小程序运行时代码的 ESLint API 门禁、模板配置与真实 DevTools 验证规范。
