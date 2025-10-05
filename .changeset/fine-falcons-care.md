---
"weapp-vite": minor
---

- 重构：移除 Inversify 容器，改由运行时 Vite 插件在编译上下文中注册共享服务
- 新增：从 `@weapp-vite/context` 导出新的运行时服务接口，并在 CLI 与上下文初始化流程中接入
- 清理：删除依赖装饰器与 Inversify 的旧版 IoC/Chokidar 测试与样例
