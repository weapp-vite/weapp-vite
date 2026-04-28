---
"weapp-vite": patch
"create-weapp-vite": patch
---

增强开发态 HMR profile 的场景关联能力，支持通过环境变量强制输出 JSONL，并在样本中记录事件 id 与相对源码路径，方便 workspace/template 审计稳定匹配每次热更新。
