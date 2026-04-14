---
"wevu": patch
"create-weapp-vite": patch
---

修复 `wevu` 在小程序 IDE 运行时中的两类稳定性问题：一是页面布局运行时错误地引用未定义常量导致布局切换失败；二是 `useNativeRouter()` / `useNativePageRouter()` 在相对路径导航与跨页面调用场景下的路径语义不稳定。同时补齐相关 `e2e:ide` 与 `e2e:ci` 回归覆盖，避免压缩别名和共享 chunk 产物路径变化再次造成误报。
