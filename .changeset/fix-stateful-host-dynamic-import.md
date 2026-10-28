---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(weapp-vite): 修复 stateful HMR 的 CommonJS 宿主分块中残留动态 import 导致加载失败的问题，保持异步加载、模块缓存、共享状态及异常拒绝语义。

修复 classic HMR 完整入口重扫期间跨阶段保存应用配置后，已撤销页面仍残留产物的问题。页面和组件统一由 buildStart 的最新可达图注册，保留独立分包、插件及首次构建的入口边界。
