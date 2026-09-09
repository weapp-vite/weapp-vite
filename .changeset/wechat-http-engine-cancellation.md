---
"weapp-ide-cli": patch
---

为开发者工具 HTTP 命令和 engine build 增加可选 AbortSignal，取消时停止请求、轮询等待和 CLI 回退，取消或超时终止 CLI 时同步清理其子进程树，等待正在执行的请求或子进程结束后返回，并保留原始取消原因以便调用方准确处理超时与重试。
