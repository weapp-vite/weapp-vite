---
"weapp-vite": patch
"create-weapp-vite": patch
---

为小程序文件型热更新新增可选的 JSONL profile 输出能力，支持把单次变更的 watch 到脏标记、shared chunk 解析、emit 以及 dirty/pending 原因摘要落盘，方便持续定位开发态体感延迟到底卡在构建链路的哪一段。
