---
"@wevu/web-apis": patch
"wevu": patch
---

修复小程序宿主返回的 ArrayBuffer 放入 Blob/File 后被 FormData multipart 序列化为 `[object ArrayBuffer]` 的问题，确保文件上传保持原始二进制内容。
