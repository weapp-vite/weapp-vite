---
"weapp-vite": patch
---

修复 Vue 模板编译器的 TS 类型问题：调整 `lru-cache` 缓存的值类型以兼容 `lru-cache@11` 的泛型约束（不再使用 `null` 作为缓存值）。

