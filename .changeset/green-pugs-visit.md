---
'create-weapp-vite': patch
'weapp-vite': patch
---

修复 `app.prelude.ts` 中 `import.meta.filename` 未被静态替换的问题，并补齐 `appPrelude.mode: "inline"` 的构建与 DevTools 运行时回归用例。现在 `app.prelude.ts` 会沿用常规脚本的 `import.meta` 编译行为，在多次页面 `reLaunch` 场景下也只会通过内置 guard 执行一次。
