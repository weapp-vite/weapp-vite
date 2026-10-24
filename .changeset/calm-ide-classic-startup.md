---
"weapp-vite": patch
"create-weapp-vite": patch
---

fix(hmr): 微信开发启动时使用可靠的 classic 更新模式。

微信开发者工具尚未提供可确认的状态保持 HMR 到完整重载的交接能力时，在开发启动阶段统一选择 classic，避免先安装状态保持运行时后无法可靠退出。保留 `auto`、`classic` 和 `stateful-experimental` 配置名称，并记录用户请求模式、实际模式和能力降级原因。
