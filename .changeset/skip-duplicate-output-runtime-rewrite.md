---
"weapp-vite": patch
"create-weapp-vite": patch
---

优化输出 finalizer 阶段，插件入口已完成 wevu runtime rewrite 时不再在 HMR 去重阶段重复执行同一轮 runtime rewrite/stabilize bundle pass，减少生成阶段重复遍历。
