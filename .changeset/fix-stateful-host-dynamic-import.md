---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 stateful HMR 的 CommonJS 宿主分块中残留动态 import 导致加载失败的问题，保持异步加载、模块缓存、共享状态及异常拒绝语义。
