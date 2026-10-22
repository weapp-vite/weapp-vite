---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(demo): 移除原生演示应用中没有对应页面源码的历史路由及首页入口，避免 classic 完整发布后微信 IDE 因页面文件缺失而无法加载。
