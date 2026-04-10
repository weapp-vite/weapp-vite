---
"weapp-vite": minor
"create-weapp-vite": patch
---

调整 `weapp.npm` 的默认依赖分类策略：`dependencies` 与 `devDependencies` 现在都会优先进入 Vite 打包流程，只有明确的小程序包或显式命中的包才进入 npm 构建。新增 `weapp.npm.strategy` 用于在新默认的 `explicit` 模式与旧的 `legacy` 模式之间切换，并支持通过 `weapp.npm.include` 显式补充 npm 构建候选集。
