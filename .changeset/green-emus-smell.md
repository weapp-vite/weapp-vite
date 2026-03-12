---
'create-weapp-vite': patch
'rolldown-require': patch
'weapp-vite': patch
---

将 `rolldown-require` 的 `rolldown` peer 依赖最低版本提升到 `1.0.0-rc.9`，并为 `weapp-vite` 增加安装时的真实 rolldown 版本检查与运行时版本判断修复，避免工作区继续解析旧的 `1.0.0-rc.3`，同时同步 `create-weapp-vite` 的模板依赖目录版本。
