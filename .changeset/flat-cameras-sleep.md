---
'weapp-vite': patch
'create-weapp-vite': patch
---

为 `weapp-vite` 的 npm 构建新增更直观的依赖范围配置：现在可以通过 `weapp.npm.mainPackageDependencies` 明确控制主包 `miniprogram_npm` 的输出范围，再通过 `weapp.npm.subPackages.<root>.dependencies` 显式声明各分包自己的 npm 依赖集合，让主包和分包的 npm 构建目标一眼可见。此次改动同时补齐了依赖范围变更时的缓存失效与输出目录清理，避免旧的主包或分包 `miniprogram_npm` 残留；普通分包的本地 npm 输出也不再依赖额外实验开关，只要声明 `weapp.npm.subPackages.<root>.dependencies`，就会生成对应分包的 `miniprogram_npm`，并把分包内的 JS `require` 与 JSON `usingComponents` 路径本地化到该分包目录。
