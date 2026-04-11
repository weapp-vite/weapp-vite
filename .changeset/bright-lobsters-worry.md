---
'create-weapp-vite': patch
'weapp-vite': patch
---

调整 `weapp.appPrelude` 的默认模式为 `entry`，避免项目在未显式配置时默认采用 `inline` 内联注入。现在默认行为会仅对应用、页面和组件入口 chunk 注入 prelude；如需原先的全量内联效果，仍可显式配置 `weapp.appPrelude.mode = "inline"`。
