---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 的页面布局解析路径：对 `src/layouts` 的扫描结果增加缓存，并在 layout 文件变更时自动失效。这样多页面项目在热更新与构建阶段不再为每个页面重复遍历布局目录，同时保持 layout 变更后的刷新行为正确。
