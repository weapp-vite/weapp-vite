---
'weapp-vite': patch
'wevu': patch
'create-weapp-vite': patch
---

修复小程序请求兼容主路径：优先通过 `weapp-vite` 编译期按需向入口产物注入 `AbortController` / `AbortSignal`，并把 `wevu` 中原本默认执行的 runtime 中止控制器安装降级为显式 fallback。同时让 `weapp-vite` 的 request globals runtime 直接桥接小程序原生 `request`，使 `fetch` / `XMLHttpRequest` 兼容不再依赖 `wevu/fetch` 才能工作。
