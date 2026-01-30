# Rolldown-Require 性能说明

## 范围

本文聚焦 `rolldown-require` 的冷启动与重建性能，并保持与 rolldown `1.0.0-rc.2` 兼容。

## Rolldown 核心行为与性能关联

- 解析缓存：`rolldown_resolver::Resolver` 维护多套解析器（import/require/new-url/css），并以真实路径为 key 缓存 `package_json`。缓存只在 bundler 关闭时清空。
- 扫描阶段缓存：`ScanStageCache` 会在增量构建中保留 module graph、resolved import 记录、barrel 状态与 AST 索引。这些缓存同样依赖 bundler 生命周期。
- 解析配置：`ResolverConfig` 会按平台与导入类型统一构建条件列表、mainFields 与扩展名。使用核心 resolver 能避免重复的 JavaScript 侧解析工作。

结论：性能提升的关键是**复用解析器并避免 JS 侧重复解析**，尤其在冷启动阶段收益最明显。

## 本次重构已做的优化（方案 A）

1. **外部化解析走 Rolldown 原生 resolver。**
   - `externalize` 插件改为调用 `this.resolve(...)`（带 `kind` 与 `skipSelf: true`），替代原来的 JS 解析流程。
   - 复用 Rust 解析缓存，减少重复解析与 CPU 开销。

2. **已解析路径优先复用，避免额外 `createRequire(...).resolve`。**
   - 外部化判断接收已解析的绝对路径，仅在必要时才回退到 `createRequire`。

3. **外部化判定与 entry 解析增加小范围缓存。**
   - 在单次构建内减少重复文件系统扫描与重复判定。

4. **保留 `module-sync` 条件。**
   - 当 `#module-sync-enabled` 为 true 时，将 `module-sync` 注入 rolldown 的 `resolve.conditionNames`，确保 Rust 侧解析逻辑一致。

这些改动优先提升冷启动，并在一定程度上降低重建成本。

## 后续可选优化（本次未实现）

- **在缓存有效时跳过 bundling**：在 cache meta 中记录依赖并先验证，再决定是否调用 bundler。
- **复用 bundler 实例** 或启用 **增量构建**（`experimental.incrementalBuild`），以复用 `ScanStageCache` 获得更大的重建收益。
- **清理未再使用的 JS 解析代码**，降低依赖面并减少安装/加载成本。

## 本次涉及的文件

- `packages/rolldown-require/src/externalize.ts`
- `packages/rolldown-require/src/bundler.ts`
