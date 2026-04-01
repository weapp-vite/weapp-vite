---
'weapp-vite': patch
'wevu': patch
'create-weapp-vite': patch
---

修复 `@tanstack/vue-query` 在小程序中依赖 `AbortController` / `AbortSignal` 时的兼容路径：优先通过 `weapp-vite` 编译期按需向入口产物注入 Abort globals，并把 `wevu` 中原本默认执行的 runtime 中止控制器安装降级为显式 fallback，避免常驻 side-effect polyfill。
