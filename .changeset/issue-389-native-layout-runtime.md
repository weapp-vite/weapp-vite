---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生 `Page()` 通过 `weapp-vite/runtime` 调用 `setPageLayout()` 时的运行时导出链路，避免仅为原生 layout 切换而额外命中 `wevu` 的 page-layout 运行时代码；同时补充 `github-issues` 的 issue #389 复现页与定向回归测试。
