---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 layout 文件热更新时的脏入口分类错误。现在当页面依赖的 layout 发生变更时，`weapp-vite` 会将相关页面按依赖更新处理，从而正确扩散到共享 chunk 的 HMR 保护逻辑，避免在微信开发者工具里出现 `require_common.defineStore is not a function` 这类由残缺 `common.js` 导致的运行时报错。
