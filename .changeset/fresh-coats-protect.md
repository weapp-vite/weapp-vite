---
'@weapp-vite/vscode': patch
'create-weapp-vite': patch
---

VS Code 扩展现在会在 `weapp-vite Pages` 视图的筛选结果为空时显示明确的空状态节点，并支持直接点击清除筛选。这样在使用“仅问题页”或“仅配置漂移页”等聚焦模式时，不会再因为树视图完全空白而难以判断当前状态。
