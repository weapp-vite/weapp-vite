---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复状态化 HMR 刷新时页面样式被旧编译资产覆盖并导致缺失依赖文件的问题，同时处理宿主并发替换样式文件的恢复竞态。
