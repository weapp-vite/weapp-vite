---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复原生 Page 使用原生 `layouts/*` 时仅注入 `usingComponents` 但未同步发射布局产物的问题，确保模板与业务项目在构建后都能正确生成 `dist/layouts/**` 组件文件，避免开发者工具报出布局组件缺失错误。
