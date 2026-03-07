---
'@wevu/api': patch
---

改进 weapi 的网络请求兼容行为：新增默认超时与 `__wxConfig.networkTimeout` 读取、请求级 `timeout` 优先级处理、`referer` 头过滤、`request/uploadFile/downloadFile` 并发上限（10）与 `connectSocket` 并发上限（5），并补充前后台切换下的 `fail interrupted` 语义与回归测试。
