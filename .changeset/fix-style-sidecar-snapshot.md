---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复编译器拥有的样式侧车更新未沿页面快照路径传播，导致 stateful HMR 逻辑入口补丁无法应用的问题。
