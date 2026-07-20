---
title: CLI 命令参考
description: weapp-vite CLI 命令参考，覆盖 dev、build、analyze、prepare、mcp、ide logs、generate，以及 screenshot/compare 等 weapp-ide-cli 透传规则。
keywords:
  - guide
  - cli
  - commands
  - weapp-vite
  - weapp-ide-cli
---

# CLI 命令参考

本文汇总 `weapp-vite` 在当前版本可用的命令与参数，优先覆盖日常开发、构建、支持文件预生成、AI 协作与 IDE 自动化场景。

> 需要调用微信开发者工具能力（`preview/upload/automator/config/screenshot/compare` 等）时，`weapp-vite` 会在未命中自身命令后自动透传到 `weapp-ide-cli`。

> `wv` 是 `weapp-vite` 的简写。下文统一使用 `wv` 作为命令示例。

## 命令格式

```bash
wv [全局参数] <command> [command options]
```

默认命令是 `dev`，也就是：

```bash
wv
```

等价于：

```bash
wv dev
```

## 全局参数

| 参数                     | 说明                                        |
| ------------------------ | ------------------------------------------- |
| `-c, --config <file>`    | 指定配置文件                                |
| `--base <path>`          | 公共基础路径（默认 `/`）                    |
| `-l, --logLevel <level>` | 日志级别：`info/warn/error/silent`          |
| `--clearScreen`          | 控制是否清屏输出                            |
| `-d, --debug [feat]`     | 启用调试日志（可选调试分组）                |
| `-f, --filter <filter>`  | 过滤调试日志                                |
| `-m, --mode <mode>`      | 运行模式（如 `development` / `production`） |

## 原生命令

### 1) `dev` / `serve`（默认命令）

用于本地开发与监听构建。

```bash
wv dev [root]
wv serve [root]
wv [root]
```

参数：

| 参数                        | 说明                                       |
| --------------------------- | ------------------------------------------ |
| `--skipNpm`                 | 跳过 npm 构建                              |
| `-o, --open`                | 构建后尝试打开 IDE                         |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `h5` \| `quickapp`）  |
| `--quickapp-e2e`            | QuickApp 场景启用官方 toolkit E2E 注入     |
| `--project-config <path>`   | 小程序 `project.config.json` 路径          |
| `--host [host]`             | Web dev server host（`h5` 场景）           |
| `--analyze`                 | 启动分包分析仪表盘（实验特性，小程序场景） |
| `--scope <scope>`           | 局部构建范围，例如 `main,packages/order`   |

补充说明：

- 当目标平台为 `weapp` 且启用了 `weapp.forwardConsole` 时，`wv dev --open` 会在打开微信开发者工具后，自动尝试把小程序 `console` 日志桥接到当前终端。
- 默认配置是 `enabled: 'auto'`，也就是仅在检测到 AI 终端时自动启用。
- `--scope` 会只保留主包和指定分包进入开发构建，适合日常只调试某几个业务分包。产物 `app.json.subPackages` 也只包含参与 scope 的分包。
- `quickapp` 会进入独立后端，不创建小程序 `CompilerContext`；需要项目安装 `hap-toolkit@2.1.0`。

### 2) `build`

用于生产构建（支持 watch）。

```bash
wv build [root]
```

参数：

| 参数                        | 说明                                           |
| --------------------------- | ---------------------------------------------- |
| `--target <target>`         | 构建目标（默认 `modules`）                     |
| `--outDir <dir>`            | 输出目录（默认 `dist`）                        |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `h5` \| `quickapp`）      |
| `--quickapp-e2e`            | QuickApp 场景启用官方 toolkit E2E 注入         |
| `--project-config <path>`   | 小程序 `project.config.json` 路径              |
| `--sourcemap [output]`      | 产出 sourcemap（`true/inline/hidden`）         |
| `--minify [minifier]`       | 代码压缩开关或压缩器（`false/terser/esbuild`） |
| `--emptyOutDir`             | 当 outDir 在 root 外时强制清空                 |
| `-w, --watch`               | 监听并增量重建                                 |
| `--skipNpm`                 | 跳过 npm 构建                                  |
| `-o, --open`                | 构建后尝试打开 IDE                             |
| `--analyze`                 | 输出分包分析仪表盘（小程序场景）               |
| `--scope <scope>`           | 局部构建范围，例如 `main,packages/order`       |

局部构建示例：

```bash
wv dev --scope main,packages/order
wv build --scope packages/order
wv build --scope main,packages/order --analyze
```

语义说明：

- `main` 表示主包。
- `packages/order` 这类值匹配 `app.json.subPackages[].root` / `subpackages[].root`。
- CLI `--scope` 的优先级高于配置文件中的 `weapp.buildScope`。
- 不传 `--scope` 时保持完整构建行为。
- 传入 `--scope packages/order` 时默认仍包含主包，因此最终产物会包含主包页面和 `packages/order` 分包。
- 生成的 `app.json` 会同步裁剪 `subPackages` 与 `preloadRule`，未参与 scope 的分包不会被注册到本次产物。

### 3) `analyze`

分析小程序分包产物映射、组件依赖链路、预算与增量归因，或输出 Web 静态分析结果。

```bash
wv analyze [root]
```

参数：

| 参数                        | 说明                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `--hmr-profile [file]`      | 分析 HMR JSONL profile，省略值时优先读取 `weapp.hmr.profileJson`，否则回退默认路径 |
| `--json`                    | 输出 JSON 结果（stdout）                                                           |
| `--markdown`                | 输出完整 Markdown 报告                                                             |
| `--report <type>`           | 输出指定报告类型，当前支持 `pr`                                                    |
| `--budget-check`            | 检查 analyze 预算，超限时返回非 0 退出码                                           |
| `--output <file>`           | 将分析结果写入文件，格式随 `--json` / `--markdown` / `--report pr` 决定            |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `h5`）                                                        |
| `--project-config <path>`   | 小程序 `project.config.json` 路径                                                  |

小程序模式下，JSON 结果会包含 `components` 字段，用于展示组件被哪些页面递归引用、组件所属主包/分包、总使用次数，以及主包组件跨分包使用时的优化建议。默认终端摘要会展示组件建议数量和前几条高优先级建议，完整列表可通过 `--json` 或 `--output` 查看。

`weapp.analyze.budgets` 可覆盖默认总包、主包、普通分包、独立分包预算与预警比例。配合 `--budget-check` 时，预算超限会让命令返回非 0 退出码，适合 CI 阻断。`weapp.analyze.history` 默认会写入 `.weapp-vite/analyze-history`，Markdown / PR 报告会基于上一份快照输出增量归因。

常用示例：

```bash
wv analyze --json --output reports/analyze.json
wv analyze --markdown --output reports/analyze.md
wv analyze --report pr --output reports/analyze-pr.md
wv analyze --budget-check
wv analyze --hmr-profile .tmp/weapp-vite-hmr-profile.jsonl --json
wv analyze --platform h5 --json
```

> [!TIP]
> HMR profile 需要先在 `weapp.hmr.profileJson` 中开启，或通过 `--hmr-profile <file>` 指向已有 JSONL 文件。Web 平台当前只做 `weapp.web` 与 `executionMode` 静态分析，不提供小程序分包体积和 dashboard。

### 4) `open`

打开 IDE（微信或支付宝场景由平台决定）。

```bash
wv open [root]
```

参数：

| 参数                        | 说明                                    |
| --------------------------- | --------------------------------------- |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `h5` \| `alipay`） |

说明：

- 当目标平台为 `weapp` 时，`wv open` 会先复用 `weapp-ide-cli` 的底层能力，自动尝试预热微信开发者工具安全设置。
- 若你通过 `weapp config set autoTrustProject true` 开启了默认项目信任，未显式传 `--trust-project` 时也会按该策略执行。

### 5) `close`

关闭微信开发者工具。

```bash
wv close
```

说明：

- 这是 `weapp-vite` 原生命令，不会透传到 `weapp-ide-cli`。
- 适合在自动化或本地排障后清理 DevTools 会话。

### 6) `ide logs`

持续监听微信开发者工具里的小程序日志，并转发到当前终端。

```bash
wv ide logs [root]
```

参数：

| 参数                        | 说明                               |
| --------------------------- | ---------------------------------- |
| `-o, --open`                | 先打开微信开发者工具，再附加日志桥 |
| `-p, --platform <platform>` | 目标平台（当前仅支持 `weapp`）     |
| `--project-config <path>`   | 小程序 `project.config.json` 路径  |

说明：

- 该命令是常驻进程，按 `Ctrl+C` 退出。
- 当前仅支持微信小程序平台，不支持 `alipay` / `h5`。
- 若你只想在开发时自动附加，而不是手动执行此命令，可直接使用 `wv dev --open` 并配合 `weapp.forwardConsole`。

示例：

```bash
wv ide logs
wv ide logs --open
wv ide logs ./dist/dev -p weapp
```

### 7) `ide setup`

只预热微信开发者工具本地配置，不立即打开 IDE。

```bash
wv ide setup [root]
```

适用场景：

- 想先把 DevTools 安全设置和项目信任状态写好，再手动打开 IDE
- 在自动化脚本里提前准备环境，但不希望立即拉起窗口

示例：

```bash
wv ide setup .
wv ide setup ./dist/dev
```

### 8) `ide info` / `ide test-accounts` / `ide ticket*`

读取当前已打开 DevTools 会话的信息，优先复用已打开的 automator 会话。

```bash
wv ide info [root]
wv ide test-accounts [root]
wv ide ticket [root]
wv ide ticket:set [root] --ticket <value>
wv ide ticket:refresh [root]
```

参数：

| 参数                        | 说明                                               |
| --------------------------- | -------------------------------------------------- |
| `-o, --open`                | 先打开微信开发者工具，再执行信息查询或 ticket 操作 |
| `-p, --platform <platform>` | 目标平台（当前仅支持 `weapp`）                     |
| `--project-config <path>`   | 小程序 `project.config.json` 路径                  |
| `--ticket <value>`          | `ide ticket:set` 需要设置的新 ticket               |

说明：

- `ide info` 返回当前 DevTools `Tool.getInfo` 的结果。
- `ide test-accounts` 返回当前 DevTools 可用的测试账号列表。
- `ide ticket` / `ide ticket:set` / `ide ticket:refresh` 会直接操作当前 DevTools 会话里的 ticket。
- 这些命令不是日志桥接常驻进程，执行完成后会直接退出。

示例：

```bash
wv ide info
wv ide test-accounts --open
wv ide ticket
wv ide ticket:set --ticket your-ticket
wv ide ticket:refresh
```

### 9) `npm`（含别名）

调用 IDE 的 npm 构建能力。

```bash
wv npm
wv build:npm
wv build-npm
```

### 10) `generate` / `g`

生成 app / page / component 文件骨架。

```bash
wv generate [filepath]
wv g [filepath]
```

参数：

| 参数                | 说明             |
| ------------------- | ---------------- |
| `-a, --app`         | 按 app 模板生成  |
| `-p, --page`        | 按 page 模板生成 |
| `-n, --name <name>` | 指定文件名       |

### 11) `init`

初始化项目配置。

```bash
wv init
```

### 12) `prepare`

预生成 `.weapp-vite` 下的支持文件，包括托管 `tsconfig`、自动路由类型、自动导入组件清单与类型等。

```bash
wv prepare [root]
```

适用场景：

- CI 或编辑器启动前，想先把 `.weapp-vite` 支持文件生成出来；
- 老项目尚未跑过 `dev/build`，但希望编辑器先拿到类型文件；
- 团队希望把自动路由、自动导入组件相关产物纳入显式预热流程。

### 13) `mcp`

启动 `weapp-vite` MCP 服务，或管理 AI 客户端的 MCP 配置。

```bash
wv mcp
wv mcp init codex
wv mcp print claude-code
wv mcp doctor cursor
```

参数：

| 参数                      | 说明                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `--transport <type>`      | 服务端支持 `stdio` / `streamable-http`；客户端配置支持 `command` / `http` 语义别名 |
| `--host <host>`           | HTTP 模式监听地址                                                                  |
| `--port <port>`           | HTTP 模式端口                                                                      |
| `--endpoint <path>`       | HTTP 模式 endpoint（默认 `/mcp`）                                                  |
| `--unref`                 | HTTP 模式下 `unref` server（不阻塞进程退出）                                       |
| `--url <url>`             | 为 `mcp init/print --transport http` 显式指定 HTTP MCP 地址                        |
| `--workspace-root <path>` | 指定 workspace 根目录（默认当前工作目录）                                          |
| `-y, --yes`               | `mcp init` 写入配置时跳过确认                                                      |

示例：

```bash
wv mcp
wv mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp
wv mcp print codex
wv mcp init codex -y
wv mcp init codex --transport http --url http://127.0.0.1:3088/mcp
wv mcp doctor codex
```

子命令说明：

- `mcp init <codex|claude-code|cursor>`：生成并写入客户端配置。
- `mcp print <codex|claude-code|cursor>`：只打印配置预览，不写入。
- `mcp doctor <codex|claude-code|cursor>`：检查客户端配置是否可用。

不在仓库目录执行时，可选追加 `--workspace-root <repo-root>`。

## `weapp-ide-cli` 透传规则

当你输入的命令不是 `weapp-vite` 原生命令时，CLI 会判断是否属于 `weapp-ide-cli` 顶层命令。若命中，则直接透传执行。

`weapp-vite` 内建命令优先级更高（不会被透传覆盖）：

- `dev`
- `serve`
- `build`
- `close`
- `analyze`
- `init`
- `open`
- `npm`
- `build:npm`
- `build-npm`
- `generate`
- `g`
- `ide`
- `prepare`
- `mcp`

你也可以显式使用命名空间透传：

```bash
wv ide preview --project ./dist -q terminal
wv ide upload --project ./dist -v 1.0.0 -d "ci upload"
```

但 `weapp-vite` 自己保留了 `wv ide logs` 这个原生命令，不会透传到 `weapp-ide-cli`。

完整 IDE 命令列表请参考：

- [/packages/weapp-ide-cli](/packages/weapp-ide-cli)

常见透传示例：

```bash
wv preview --project ./dist -q terminal
wv upload --project ./dist -v 1.0.0 -d "ci upload"
wv cache --clean compile
wv screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
wv compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json
wv cache --clean all
wv config set autoBootstrapDevtools true
wv config set autoTrustProject true
```

和 DevTools 自动预热相关的高频配置：

```bash
wv config show
wv config doctor
wv config get autoBootstrapDevtools
wv config get autoTrustProject
wv config set autoBootstrapDevtools true
wv config set autoTrustProject true
```

默认生效值：

- `autoBootstrapDevtools`: `true`
- `autoTrustProject`: `false`

高频透传命令里，和 AI 验收最相关的是下面两类：

### `wv screenshot`

```bash
wv screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
```

关键参数：

| 参数               | 说明                          |
| ------------------ | ----------------------------- |
| `--project <path>` | 小程序项目目录                |
| `--page <path>`    | 截图前先跳转页面              |
| `--output <path>`  | 截图输出路径                  |
| `--timeout <ms>`   | automator 连接超时            |
| `--json`           | JSON 输出，适合 AI / 脚本解析 |

### `wv compare`

```bash
wv compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --current-output .tmp/current.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json
```

关键参数：

| 参数                        | 说明                             |
| --------------------------- | -------------------------------- |
| `--project <path>`          | 小程序项目目录                   |
| `--baseline <path>`         | baseline 图片，必填              |
| `--page <path>`             | 对比前先跳转页面                 |
| `--current-output <path>`   | 保存当前截图                     |
| `--diff-output <path>`      | 保存 diff 图                     |
| `--threshold <number>`      | pixelmatch threshold，默认 `0.1` |
| `--max-diff-pixels <count>` | 最大允许差异像素数               |
| `--max-diff-ratio <number>` | 最大允许差异占比                 |
| `--json`                    | JSON 输出                        |

使用约束：

- `compare` 必须提供 `--baseline`
- `compare` 至少提供 `--max-diff-pixels` 或 `--max-diff-ratio` 之一
- 对比失败时命令会返回非 `0`，适合直接接 CI 或 AI 验收流程

## 常用示例

```bash
# 小程序开发
wv dev -p weapp

# Web 开发（指定 host）
wv dev -p h5 --host 0.0.0.0

# 小程序生产构建（不压缩 + 产出 sourcemap）
wv build -p weapp --minify false --sourcemap

# 输出分析 JSON 到文件
wv analyze -p weapp --output ./reports/analyze.json

# 预生成 .weapp-vite 支持文件
wv prepare

# 持续监听 DevTools console
wv ide logs --open

# 小程序截图采集
wv screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json

# 小程序截图对比
wv compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json

# 透传微信预览命令
wv preview --project ./dist -q terminal

# 清理微信开发者工具缓存
wv cache --clean compile
wv cache --clean all
```
