---
"create-weapp-vite": patch
---

调整 `create-weapp-vite` 的模板选择顺序，按常用场景优先展示默认、Wevu 与 UI 集成模板；同时更新插件模板为 `src + pluginRoot` 结构，并将各模板的 ESLint 生成目录忽略统一收敛到 `eslint.config.js`。
