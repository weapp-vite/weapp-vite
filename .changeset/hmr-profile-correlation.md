---
"weapp-vite": patch
"create-weapp-vite": patch
---

增强开发态 HMR profile 的场景关联能力，支持通过环境变量强制输出 JSONL，并在样本中记录事件 id 与相对源码路径，方便 workspace/template 审计稳定匹配每次热更新。同时修复侧车文件监听在启动初期遇到已知文件原子保存时可能漏掉恢复事件的问题，避免 package script dev 入口下的 HMR 更新偶发丢失。
