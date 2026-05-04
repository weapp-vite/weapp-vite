# wevu/web-apis 类型导出清单

- 子路径: `./web-apis`
- 类型入口: `./dist/web-apis.d.mts`
- 运行时入口: `./dist/web-apis.mjs`
- 类型导出总数: **2**
- 仅类型导出数（推断）: **0**
- 运行时同名导出数: **2**

## 类型导出（入口声明）

1. `installRequestGlobals`
2. `installWebRuntimeGlobals`

## 运行时导出

1. `AbortControllerPolyfill`
2. `AbortSignalPolyfill`
3. `BlobPolyfill`
4. `CustomEventPolyfill`
5. `EventPolyfill`
6. `FormDataPolyfill`
7. `HeadersPolyfill`
8. `RequestGlobalsEventTarget`
9. `RequestPolyfill`
10. `ResponsePolyfill`
11. `TextDecoderPolyfill`
12. `TextEncoderPolyfill`
13. `URLPolyfill`
14. `URLSearchParamsPolyfill`
15. `WebSocketPolyfill`
16. `XMLHttpRequestPolyfill`
17. `atobPolyfill`
18. `btoaPolyfill`
19. `cryptoPolyfill`
20. `fetch`
21. `getMiniProgramNetworkDefaults`
22. `installAbortGlobals`
23. `installRequestGlobals`
24. `installWebRuntimeGlobals`
25. `performancePolyfill`
26. `queueMicrotaskPolyfill`
27. `resetMiniProgramNetworkDefaults`
28. `setMiniProgramNetworkDefaults`

## 说明

该入口透传 `@wevu/web-apis`。由于声明文件使用 `export *` 透传，类型统计只展示入口声明中能直接提取到的名称；完整类型面以 `@wevu/web-apis` 包为准。
