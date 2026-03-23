---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 layout 文件热更新导致共享 `common.js` 被错误裁剪的问题。现在当 `src/layouts/**` 发生更新时，`weapp-vite` 会对当前已解析入口执行更完整的失效传播，避免只重编译 layout 入口而产出残缺 `common.js`。同时调整 wevu 的临时配置执行目录策略，避免在热更新期间因临时目录竞争导致编译失败，最终修复微信开发者工具里 `require_common.defineStore is not a function` 这一类报错。
