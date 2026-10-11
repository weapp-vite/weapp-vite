---
"weapp-vite": patch
"create-weapp-vite": patch
---

修正 Stateful HMR profile 在异步失效处理后重新生成源事件身份和时间的问题，贯穿保留原始接收事件，使失效处理耗时计入源通知到批次的阶段，并保持既有 JSONL schema 和未携带事件的内部通知兼容。
