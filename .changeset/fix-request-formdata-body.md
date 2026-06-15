---
"@wevu/web-apis": patch
---

修复 `RequestPolyfill` 携带 `FormData` 请求体时被字符串化的问题，确保 `fetch(new Request(...))` 与直接传入 `FormData` 一样生成 multipart 请求体和对应请求头。
