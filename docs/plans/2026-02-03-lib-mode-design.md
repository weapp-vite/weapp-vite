# Lib 模式（组件库构建）设计

## 背景与目标

weapp-vite 需要提供类似 Vite `build.lib` 的库模式，面向小程序组件库构建。要求：

- 仅在显式配置时启用，默认行为保持现状。
- 入口模式（B）：`entry` 可为单个/多个入口；按文件类型自动决定是否输出组件相关文件。
- 输出路径默认保持源码相对路径；支持 `fileName`/`outDir` 覆盖。
- 复用现有 rolldown 构建链路与 chunks 能力（默认保持当前 chunks 策略）。

## 配置设计

新增 `weapp.lib` 配置作为库模式入口（默认关闭）：

```txt
weapp:
  lib:
    entry: string | string[] | Record<string, string>
    root?: string                # 默认 weapp.srcRoot
    outDir?: string              # 覆盖 build.outDir
    preservePath?: boolean       # 默认 true
    fileName?: string | (ctx) -> string
    componentJson?: boolean | 'auto' | (ctx) -> object
```

默认行为：

- `preservePath: true` 时，JS 输出路径与 `root` 相对路径一致。
- `entry` 既可以是组件也可以是纯逻辑模块：
  - 若入口同目录存在同名或 `index` 的 `.wxml/.wxss/.json`，则作为伴随资源输出。
  - 仅存在 JS 时只输出 `*.js`。
  - `componentJson: 'auto' | true` 时，若有模板/样式但缺 JSON，则自动生成 `{"component": true}`，并可由函数扩展字段。

## 构建流程

当 `weapp.lib` 存在且 `entry` 非空时进入 lib 模式：

1. **禁用 app/pages 产物**：跳过 `app.json`、`autoRoutes`、分包等逻辑，仅处理 lib 入口与其依赖。
2. **入口注入**：在 config merge 阶段将 `build.rolldownOptions.input` 设置为入口列表，沿用 rolldown 输出链路与 chunks 配置。
3. **输出路径**：
   - 默认 `preservePath`：`entryFileNames` 按 `root` 相对路径输出。
   - 配置 `fileName` 时覆盖 JS 路径；伴随资源仍与 JS 同级输出。
4. **资源处理**：复用现有 WXML/WXSS/WXS 处理与资产复制逻辑，但限定于 lib 入口链路，避免 app/pages 被扫描。

## 错误处理与日志

- `entry` 为空或找不到文件：抛错并提示 `root/srcRoot` 与 `entry` 关系。
- `componentJson` 函数返回非对象：抛错并提示示例。
- 入口伴随资源冲突（多套候选）：抛错列出候选路径。

日志建议：

- build 阶段输出：`lib mode enabled`、入口数量、输出目录。
- 自动生成组件 JSON 时输出 debug 日志（受 logger tags 控制）。

## 测试方案

单元测试：新增 `packages/weapp-vite/src/runtime/__tests__/libMode.test.ts`。

覆盖点：

- `preservePath` 输出路径与源码一致。
- 纯 JS 入口只生成 `*.js`。
- `componentJson: auto/true` 自动生成 JSON 并合并自定义字段。
- `fileName` 覆盖 JS 输出路径。

E2E：新增 `e2e-apps/lib-mode`（真实 appid），验证构建产物与 chunks 组合，新增 `e2e:lib` 脚本。

## 兼容性与默认行为

- 默认不启用 lib 模式，保持现有构建行为与测试一致。
- lib 模式下 chunks 默认遵循现有配置（`weapp.chunks`），可与现有策略组合使用。
