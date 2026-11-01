---
"@weapp-vite/react": patch
"vite-plugin-performance": patch
---

fix(types): 补全 React 运行时公开声明需要的 React 类型依赖，并为性能插件声明 Vite peer 依赖，使隔离安装后的 TypeScript 消费者能够解析完整的公开类型。
