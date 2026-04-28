---
"weapp-vite": patch
"create-weapp-vite": patch
---

修复开发态 HMR 在直接修改单个入口时误沿 source shared chunk importers 扩散的问题。直接入口更新现在默认只刷新自身，真实共享源码、layout 或 auto-routes 变更仍会通过 dependency dirty 路径扩散到相关入口，从而降低大型示例和模板的热更新 pending/emitted fanout。
