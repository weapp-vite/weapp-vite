---
"weapp-vite": patch
"create-weapp-vite": patch
---

普通 update HMR 事件跳过 emitted JSON path 集合构造，减少 watcher 阶段对 JSON emit 记录的无效遍历。
