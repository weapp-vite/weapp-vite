---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 Wevu runtime require 重写逻辑，同一输出文件内只扫描一次 bare `wevu` 是否引用内部 runtime 导出，减少重复正则分配和替换回调开销。
