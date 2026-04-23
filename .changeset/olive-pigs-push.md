---
"weapp-vite": patch
"create-weapp-vite": patch
---

补充开发态 HMR 日志分层开关：新增 `weapp.hmr.logLevel`，支持 `default`、`concise`、`verbose` 三档输出。默认仅展示总耗时，简洁与详细诊断只在显式开启时输出。
