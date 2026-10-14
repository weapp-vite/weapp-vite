---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): 同一次入口加载共享原生 layout 伴随文件的发现结果，减少重复文件查询；后续重建仍重新发现文件，并保持源码快照及依赖登记边界。
