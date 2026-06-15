---
"@wevu/web-apis": patch
"wevu": patch
"create-weapp-vite": patch
---

修复小程序宿主返回的 ArrayBuffer 放入 Blob/File 后被 FormData multipart 序列化为 `[object ArrayBuffer]` 的问题，并补齐 ArrayBuffer、ArrayBufferView、Blob、File 与 Blob-like 对象作为 fetch body 时的二进制保真处理。
