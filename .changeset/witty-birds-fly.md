---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 npm 重打包场景 sourcemap 错位问题：对于会被 `weapp-vite` 二次打包的普通依赖，不再复制上游入口自带的 sourcemap 到 `miniprogram_npm`，避免出现 `index.js` 与 `index.js.map` 映射不一致。若需要调试 map，应通过 `weapp.npm.buildOptions` 为最终产物显式开启 `build.sourcemap` 生成。
