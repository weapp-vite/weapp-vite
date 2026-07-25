---
"@weapp-vite/web": patch
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Web 运行时原生页面调用 `setPageLayout()` 时缺少当前页面实例的问题，并补齐 Web 页面布局扫描、动态布局切换与布局组件渲染。
