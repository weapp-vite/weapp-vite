---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 `weapp.tsconfigPaths` 在 Vite 8 下的默认行为：自动探测或显式传入 `true` 时，改为优先启用原生 `resolve.tsconfigPaths`，不再默认注入 `vite-tsconfig-paths` 插件，从而避免构建时出现对应的提示信息。仅当传入对象形式的高级选项时，才继续回退到 `vite-tsconfig-paths` 以兼容多 `tsconfig`、`exclude` 等定制能力。
