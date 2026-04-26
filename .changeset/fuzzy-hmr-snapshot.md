---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发模式 HMR 在 6.15.15 中因额外 snapshot build 导致的回退：普通 watcher 结束后不再补跑全量 snapshot，直接 sidecar 更新改为标记对应入口并交给主 watcher 增量写盘，仅在新增、删除或无法定位入口时保留全量 snapshot 兜底。
