---
"@weapp-core/init": patch
---

## createProject 同步 wevu 版本

在创建项目并更新 `weapp-vite` 版本的同时，如果模板的 `dependencies` 或 `devDependencies` 中存在 `wevu`，则会一并将其版本更新为当前仓库的 `wevu` 版本，避免版本不一致。

