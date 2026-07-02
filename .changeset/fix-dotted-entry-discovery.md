---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复带点号的入口 basename 探测逻辑，避免在没有 `app.prelude.*` 文件时把 `app.ts` 误识别为 app prelude，从而减少不必要的 prelude 注入、分包 prelude 输出和 app 入口 HMR 影响范围。
