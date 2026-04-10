---
"weapp-vite": patch
"create-weapp-vite": patch
---

新增 `app.prelude` 约定文件支持，并提供 `weapp.appPrelude` 配置项。默认 `mode: 'inline'` 会把 `src/app.prelude.ts` 等脚本内联注入到每个 JS chunk 最前面执行；也支持 `mode: 'entry'` 只注入到 `app/page/component` 入口 chunk，用于在执行时机与产物体积之间做取舍。
