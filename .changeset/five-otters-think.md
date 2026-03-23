---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 的页面布局规划解析：当页面源码中既不包含 `definePageMeta()` 也不包含 `setPageLayout()` 提示时，`resolvePageLayoutPlan()` 不再额外做源码 AST 解析，而是直接进入默认 layout / routeRules 分支。这可以减少大量普通页面在热更新与构建阶段的布局元信息解析开销，同时保持默认布局行为不变。
