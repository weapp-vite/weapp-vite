---
'weapp-ide-cli': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

在 `weapp-ide-cli` 中整理并导出了完整命令目录（官方 CLI、automator、config、minidev），新增 `isWeappIdeTopLevelCommand` 判断函数。`weapp-vite` 的 IDE 透传逻辑改为基于该目录判断，仅在命令未被 `weapp-vite` 自身注册且命中 `weapp-ide-cli` 命令目录时才透传执行。
