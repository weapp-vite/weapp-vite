---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `defineConfig(() => ({ ... }))` 在函数式配置下丢失上下文类型的问题，避免 `weapp.platform` 等联合字面量字段被宽化为 `string` 并导致 `vite.config.ts` 类型报错。
