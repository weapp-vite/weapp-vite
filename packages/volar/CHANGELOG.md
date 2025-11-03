# @weapp-vite/volar

## 0.0.2

### Patch Changes

- [`40c5dec`](https://github.com/weapp-vite/weapp-vite/commit/40c5dec63f8d1320d56849c7b1132fc33b788e98) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 增强 `<config>` 区块体验：插件在开发与构建结束时清理生成文件，支持将编译产物输出到自定义目录（如 `.wevu/`），并为 Volar 提供基于 `@weapp-core/schematics` 的类型提示支持。

  新增示例展示 `<config lang="ts">` / `<config lang="js">`，并在编译阶段自动解析 TS/JS 导出的配置对象。

  执行 TS/JS `<config>` 时改用 `rolldown-require`，与 rolldown 构建保持一致。

## 0.0.1

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade
