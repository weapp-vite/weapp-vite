---
'weapp-vite': patch
'create-weapp-vite': patch
---

为 `weapp-vite` 的 npm 构建新增主包依赖范围控制：现在可以通过 `weapp.npm.mainPackageDependencies: false` 禁止输出主包 `miniprogram_npm`，再配合独立分包上的 `weapp.subPackages.<root>.dependencies`，让每个分包只生成自己的 npm 依赖集合。此次改动同时补齐了依赖范围变更时的缓存失效与输出目录清理，避免旧的主包或分包 `miniprogram_npm` 残留。
