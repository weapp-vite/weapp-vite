---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化模板输出归一化前的 marker 检查，避免普通小写模板在 build/HMR 生成阶段额外创建 lowercase 字符串。
