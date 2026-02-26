---
title: 加载流程与缓存策略
description: 本文梳理 bundleRequire 在内部如何打包、落盘与加载，并介绍缓存相关的实用配置。
keywords:
  - 调试
  - packages
  - rolldown
  - require
  - 加载流程与缓存策略
  - 本文梳理
  - bundlerequire
  - 在内部如何打包
---

# 加载流程与缓存策略

> 语言： [English](/packages/rolldown-require/cache) | 中文

本文梳理 `bundleRequire` 在内部如何打包、落盘与加载，并介绍缓存相关的实用配置。

## 整体流程

1. **解析入口**：根据 `filepath` 与 `cwd` 生成绝对路径，并用后缀/`package.json.type` 推断 `format`（可手动覆盖）。
2. **rolldown 打包**：
   - 固定 `platform: 'node'`、`inlineDynamicImports: true`、`treeshake: false`，保证生成单入口产物并完整收集依赖。
   - 注入 `__dirname`/`__filename`/`import.meta.url`，让运行时代码感知源文件真实路径。
   - 通过 `externalize-deps` 插件外部化大部分 `node_modules` 依赖，同时保留 JSON 内联；尊重 `module-sync` 条件导出。
3. **执行临时产物**：
   - ESM：写入临时 `.mjs`/`.cjs` 或 data URL，再用 `import()` 加载。
   - CJS：通过 `_require.extensions` 临时钩子编译源文件。
4. **结果返回**：提供 `mod` 与 `dependencies`（包含入口以外的打包依赖）便于监听或调试。

## 外部化与解析

- 解析行为与 Vite/rolldown 对齐：使用相同的主字段优先级与 `tsconfig` 路径解析（若未禁用）。
- Node 内置与 `node:`/`npm:` 命名空间依赖会被直接标记为 external。
- 若依赖处于入口目录下的嵌套 `node_modules` 中，为保证临时产物可执行，会自动内联而非 external。
- JSON 资源暂不外部化，始终交给 rolldown 处理。

## 临时产物控制

- 默认写入最近的 `node_modules/.rolldown-require`，找不到时退回系统临时目录；文件名会包含随机哈希，避免并发冲突。
- 通过 `getOutputFile` 可自定义写入路径；`preserveTemporaryFile` 设为 `true` 时不会自动清理，便于直接查看产物。
- 若所有落盘尝试失败且目标为 ESM，会回退到 `data:` URL 写入。

## 缓存策略

缓存默认关闭。`cache: true` 或传入对象即可开启，包含持久化与进程内缓存：

- **缓存位置**：默认选择最近的 `node_modules/.rolldown-require-cache`，否则使用 `os.tmpdir()/rolldown-require-cache`。可通过 `cache.dir` 指定。
- **缓存键**：入口路径、`mtime`/`size`、`format`、`tsconfig` 路径、Node 版本以及 `rolldownOptions` 摘要共同决定。
- **有效性校验**：在命中缓存后，会逐个比对入口与依赖的 `mtime`/`size`；任意文件变化即视为失效。
- **内存缓存**：默认开启（`cache.memory !== false`），命中后直接返回已加载模块，避免额外的文件系统读写。
- **重置与事件**：
  - `cache.reset: true` 会在写入前清理旧的 code/meta 文件。
  - `cache.onEvent` 可获取 `hit`/`miss`/`store`/`skip-invalid` 事件，`skip-invalid` 的 `reason` 可能是 `missing-entry`、`format-mismatch`、`stale-deps` 等。

示例：记录缓存事件并自定义目录

```ts
await bundleRequire({
  filepath: './config/vite.config.ts',
  cache: {
    enabled: true,
    dir: './.cache/rolldown-require',
    onEvent: (e) => {
      console.log(`[cache] ${e.type}`, e)
    },
  },
})
```

## 调试建议

- 监听 `dependencies`，在文件变更后决定是否重新调用 `bundleRequire`。
- 配合 `preserveTemporaryFile: true` 检查生成的临时代码，或在缓存目录里直接比对 `*.code.mjs/cjs`。
- 若需要排查缓存误命中，可临时设置 `cache.reset: true` 或直接关闭缓存。
- 当入口后缀与 `package.json.type` 不匹配时，手动传入 `format` 可以避免 Node/rolldown 解析差异。
