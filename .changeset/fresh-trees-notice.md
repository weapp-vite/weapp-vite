---
'@wevu/web-apis': patch
'weapp-vite': patch
'create-weapp-vite': patch
---

修复手动调用 `installRequestGlobals()` / `installAbortGlobals()` 时的请求全局兼容链路。现在 `weapp-vite` 会为这类显式安装场景补充被动本地绑定，`@wevu/web-apis` 也会同步更新内部实际全局映射，使同模块里的 `fetch`、`URL`、`AbortController` 等自由变量在小程序产物中能够正确读取到已安装的 polyfill，而不会再出现手动安装后仍为 `undefined` 的情况。
