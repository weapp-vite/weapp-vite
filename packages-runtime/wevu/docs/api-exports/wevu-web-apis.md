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
6. `EventSourcePolyfill`
7. `FilePolyfill`
8. `FormDataPolyfill`
9. `HeadersPolyfill`
10. `ReadableStreamPolyfill`
11. `RequestGlobalsEventTarget`
12. `RequestPolyfill`
13. `ResponsePolyfill`
14. `TextDecoderPolyfill`
15. `TextDecoderStreamPolyfill`
16. `TextEncoderPolyfill`
17. `TransformStreamPolyfill`
18. `URLPolyfill`
19. `URLSearchParamsPolyfill`
20. `WebSocketPolyfill`
21. `WritableStreamPolyfill`
22. `XMLHttpRequestPolyfill`
23. `atobPolyfill`
24. `btoaPolyfill`
25. `cryptoPolyfill`
26. `fetch`
27. `getMiniProgramNetworkDefaults`
28. `installAbortGlobals`
29. `installRequestGlobals`
30. `installWebRuntimeGlobals`
31. `performancePolyfill`
32. `queueMicrotaskPolyfill`
33. `resetMiniProgramNetworkDefaults`
34. `setMiniProgramNetworkDefaults`

## 说明

该入口透传 `@wevu/web-apis`。由于声明文件使用 `export *` 透传，类型统计只展示入口声明中能直接提取到的名称；完整类型面以 `@wevu/web-apis` 包为准。
