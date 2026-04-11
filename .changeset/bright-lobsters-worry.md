---
'create-weapp-vite': patch
'weapp-vite': patch
---

调整 `weapp.appPrelude` 的默认模式为 `require`，避免项目在未显式配置时默认采用 `inline` 或多入口内联注入。现在默认行为会为主包与独立分包产出独立的 `app.prelude.js`，入口 chunk 仅保留 `require()` 调用；如需原先的内联效果，仍可显式配置 `weapp.appPrelude.mode = "inline"` 或 `weapp.appPrelude.mode = "entry"`。
