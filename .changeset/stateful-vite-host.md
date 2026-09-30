---
"weapp-vite": patch
"create-weapp-vite": patch
---

标准 Vite 插件接入实验性微信 stateful 开发模式，复用宿主配套引擎、配置重启与关闭生命周期；独立 CLI 保留原有入口。补充原生 Vite/Vite+ 发布包消费验证与状态保持回归，并保留宿主日志级别和原生 watch 就绪信号。

独立 CLI 的 stateful 快照复用本轮已加载的配置，保留双配置合并规则，避免模板更新反复执行用户配置中的副作用。
