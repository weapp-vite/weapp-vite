---
"weapp-vite": patch
"create-weapp-vite": patch
---

状态保持 HMR 的固定输入快照先核对本批源码归属，避免对未固定的依赖重复查询原生入口及真实路径；保留组件伴随资产、空源码与已删除输入的原有语义。
