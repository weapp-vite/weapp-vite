---
"weapp-vite": patch
"create-weapp-vite": patch
---

让独立 CLI 的生产构建与标准 Vite 插件共用独立编译会话及配置初始化逻辑，避免 CLI 主构建切换全局活动上下文。关闭等待已启动的配置、编译、npm 和 worker 任务，并在部分失败后释放所有自有资源，保留原始构建错误。
