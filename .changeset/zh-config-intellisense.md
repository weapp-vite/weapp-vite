---
'@weapp-vite/plugin-wevu': patch
'@weapp-vite/volar': patch
---

增强 `<config>` 区块体验：插件在开发与构建结束时清理生成文件，支持将编译产物输出到自定义目录（如 `.wevu/`），并为 Volar 提供基于 `@weapp-core/schematics` 的类型提示支持。

新增示例展示 `<config lang="ts">` / `<config lang="js">`，并在编译阶段自动解析 TS/JS 导出的配置对象。

执行 TS/JS `<config>` 时改用 `rolldown-require`，与 rolldown 构建保持一致。
