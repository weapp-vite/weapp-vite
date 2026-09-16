---
'@wevu/web-apis': minor
---

补齐 Request/Response 的字节、JSON 与 Blob 读取接口，修正 Body 单次消费、Blob UTF-8 长度与二进制快照，新增 Blob 切片并完善 Headers 回调契约。非空 body 读取或发送后再次读取、克隆会报错，需要重复读取时请在消费前调用 clone。
