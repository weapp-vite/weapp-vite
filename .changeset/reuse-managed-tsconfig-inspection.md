---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化 support files 同步时的 managed tsconfig 写入流程，复用 inspection 阶段已读取的文件内容，避免写入前重复读取同一批支持文件。
