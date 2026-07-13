---
'@wevu/compiler': patch
'create-weapp-vite': patch
'weapp-vite': patch
---

优化 Vue SFC 页面配置热更新：仅修改 JSON 宏或 `<json>` 时复用已编译的脚本、模板与样式结果，避免重复执行完整 Vue 编译，并在混合变更或缓存不可用时自动回退。
