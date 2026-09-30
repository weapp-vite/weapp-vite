---
"weapp-vite": minor
"create-weapp-vite": patch
---

新增实验性标准 Vite 小程序生产构建插件 `weapp-vite/vite`，支持顶层 weapp 配置和微信原生/Wevu Vue 构建，保留 wv 兼容入口。分离宿主配置加载、隔离构建会话与路由宏上下文，适配 Vite+ core 配套 Rolldown 导出并对未开放的开发模式和高级目标明确报错。
