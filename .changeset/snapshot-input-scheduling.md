---
"weapp-vite": patch
"create-weapp-vite": patch
---

perf(weapp-vite): Stateful HMR 快照复用已采集的目录清单验证缺失侧车文件，减少重复文件探测，同时保留显式外部依赖、跳过目录内依赖和构建前后输入一致性校验。
