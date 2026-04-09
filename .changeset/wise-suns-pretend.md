---
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 `app.prelude` 约定文件支持。`src/app.prelude.ts` 等脚本会在构建时产出内部 prelude chunk，并自动注入到每个 JS chunk 的最前面执行，从而稳定覆盖主包、普通分包与独立分包的运行时前置初始化场景。
