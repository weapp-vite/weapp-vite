---
"weapp-vite": patch
---

fix(weapp-vite): 将 package imports 的 query/hash 兼容处理内置到发布包，在主构建、子构建与 Web 路径自动接入，保留精确映射、条件、自定义解析器和 external 语义。

使用官方 Vite/Rolldown，隔离连续构建中的自有插件钩子容器，并在编译插件关闭后释放会话引用。
