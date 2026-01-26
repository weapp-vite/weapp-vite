---
"wevu": minor
"weapp-vite": patch
"create-weapp-vite": patch
---

新增组件选项 `setupLifecycle`（`created` / `attached`），并将默认执行时机改为 `attached`，以便 setup 拿到外部传入的 props；同时 weapp-vite 类型对齐该配置。
