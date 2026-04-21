---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 `defineConfig` 回调中解构 `env` 参数时的类型推导问题，并收敛多处测试的临时目录与 fixture 隔离方式，避免 `pnpm test` 在并发执行下出现超时或共享目录冲突。
