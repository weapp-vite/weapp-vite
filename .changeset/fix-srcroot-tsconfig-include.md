---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `weapp.srcRoot` 使用非默认目录时，托管 `tsconfig.app.json` 仍固定包含 `../src/**/*` 的问题，避免小程序源码文件向上解析到错误的工作区 tsconfig 后导致 `wv dev/build` 报错。
