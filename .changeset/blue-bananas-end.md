---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 的页面级 Vue transform 后处理：当页面脚本中不包含任何页面生命周期 hook 提示时，不再进入 `injectWevuPageFeaturesInJsWithViteResolver()` 的 AST 与模块依赖分析流程。这样可以减少普通页面在热更新与构建阶段的无效页面特性注入开销，同时保持真正使用页面 hook 的场景行为不变。
