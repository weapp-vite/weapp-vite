---
"weapp-vite": minor
"create-weapp-vite": patch
---

补齐 HMR profile 的版本、会话、构建与多文件批次来源，固定发布样本后再异步写入，避免下一轮构建污染记录。失败、未知版本与缺失阶段不再被统计为成功或零耗时，保留旧 JSONL 读取兼容，并明确残差估算口径。
