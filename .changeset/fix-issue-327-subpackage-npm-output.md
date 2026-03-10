---
'weapp-vite': patch
'create-weapp-vite': patch
---

修复 issue #327：补齐 `weapp.npm.mainPackage.dependencies` 与 `weapp.npm.subPackages.<root>.dependencies` 在分包场景下的依赖分配能力。现在可以显式让主包不输出 `miniprogram_npm`，再按分包根目录分别声明应落入各自分包的 npm 依赖，避免依赖串包或主包残留产物；同时补上主包禁用 npm 输出时的缓存兜底逻辑，即使缓存标记未失效但缓存目录已经不存在，也会自动重新构建分包依赖，避免构建阶段因为缺失缓存目录而直接报错。此次改动同步补充了对应单测与 `github-issues` e2e 回归用例。
