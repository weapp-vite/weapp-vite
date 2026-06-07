---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp.srcRoot` 使用非默认目录时，托管 `tsconfig.app.json` 仍固定包含 `../src/**/*` 的问题，避免小程序源码文件向上解析到错误的工作区 tsconfig 后导致 `wv dev/build` 报错。

当用户手动修改 `weapp.srcRoot` 后，若现有 `.weapp-vite/tsconfig.app.json` 的源码 include 与新配置不匹配，`wv prepare`、`wv dev` 与 `wv build` 会明确告警，并在继续运行前自动重新生成正确的 `.weapp-vite` 支持文件。
