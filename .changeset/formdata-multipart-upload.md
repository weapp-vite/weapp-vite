---
"@wevu/web-apis": patch
---

修复 fetch 通过小程序 request 桥发送 FormData 时不支持 multipart body 的问题，支持 Blob/File 文件字段上传并保留文件名与内容类型。
