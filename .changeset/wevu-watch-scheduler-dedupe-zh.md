---
"wevu": patch
"create-weapp-vite": patch
---

修复 watch/watchEffect 在同一微任务内重复触发的问题，确保调度去重生效。
