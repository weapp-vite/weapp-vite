---
'create-weapp-vite': patch
'weapp-vite': patch
'weapp-vite-lib-template': patch
---

为原生 `Page()` 页面补充 layout 运行时切换能力，并将 `setPageLayout` 从 `weapp-vite` 直接导出。`weapp-vite-lib-template` 现在也内置 `src/layouts` 与原生布局演示页，可在不使用 wevu 页面写法的前提下体验 default/admin/关闭布局三种模式。
