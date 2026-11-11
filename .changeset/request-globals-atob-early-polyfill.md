---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复第三方依赖在模块初始化期调用 `atob` / `btoa` 时的 polyfill 注入时序问题。

引入 `stream-markdown-parser` 等依赖后，其内联的 `entities` 会在模块顶层同步调用 `atob` 解码常量。此前这类纯函数要等 Web runtime installer 在 chunk 末尾执行后才可用，模块初始化期会抛出 `atob is not initialized`。现在 `atob` / `btoa` 在 chunk 顶部即落地真实 polyfill，行为与 `@wevu/web-apis` 的实现对齐，installer 不会覆盖已可用的实现。自动注入的依赖识别同时补充了 `stream-markdown-parser`，仅依赖该包也能启用 Web runtime globals。
