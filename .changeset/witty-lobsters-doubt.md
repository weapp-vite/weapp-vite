---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp-vite` 的 Vue transform 路径：对于不包含 `<style>` 的 `.vue` 文件，不再额外做一次 SFC 预解析来收集样式块。这样可以减少无样式组件和页面在开发热更新与构建阶段的重复解析开销，同时保留带样式 SFC 的既有行为。
