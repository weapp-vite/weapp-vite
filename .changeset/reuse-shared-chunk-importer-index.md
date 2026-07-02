---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化分包 shared chunk 复制与跨分包依赖本地化流程，复用同一份 importer 索引并在重写 import 后增量同步，减少 build/HMR 生成阶段重复扫描。
