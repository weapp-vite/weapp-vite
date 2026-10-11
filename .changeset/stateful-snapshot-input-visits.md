---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复 Stateful HMR 快照扫描根目录与显式依赖重叠时并发重复读取和散列同一文件的问题。仅在单次采集内共享访问与物理文件读取，下一轮重新读取，保留符号链接改向、目录变化、失败恢复与发布交接校验。
