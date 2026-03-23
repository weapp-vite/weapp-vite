---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 的页面滚动性能诊断路径：当页面脚本中不包含 `onPageScroll` 提示时，不再进入 `collectOnPageScrollPerformanceWarnings()` 的 AST 分析流程。这样可以减少普通页面在热更新与构建阶段的无效性能诊断开销，同时保留真正使用 `onPageScroll` 场景下的诊断行为。
