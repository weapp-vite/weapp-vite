---
'weapp-vite': patch
'create-weapp-vite': patch
---

优化 npm 构建产物 sourcemap 处理：当依赖打包入口存在 sourcemap（`sourceMappingURL` 指向的文件或同名 `.map`）时，`weapp-vite` 会将其同步复制到对应的 `miniprogram_npm/<dep>/index.js.map`。在命中缓存跳过重打包时，若仅缺失该 map 文件也会自动补齐，便于小程序端调试定位。
