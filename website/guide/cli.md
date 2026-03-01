---
title: CLI 命令参考
description: Weapp-vite CLI 命令参考，包含全局参数、原生命令、别名、常用示例，以及 weapp-ide-cli 透传规则。
keywords:
  - guide
  - cli
  - commands
  - weapp-vite
  - weapp-ide-cli
---

# CLI 命令参考

本文汇总 `weapp-vite` 在当前版本可用的命令与参数，优先覆盖日常开发最常用场景。

> 需要调用微信开发者工具能力（`preview/upload/automator/config` 等）时，`weapp-vite` 会在未命中自身命令后自动透传到 `weapp-ide-cli`。

## 命令格式

```bash
weapp-vite [全局参数] <command> [command options]
```

默认命令是 `dev`，也就是：

```bash
weapp-vite
```

等价于：

```bash
weapp-vite dev
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
weapp-vite dev [root]
weapp-vite serve [root]
weapp-vite [root]
```

参数：

| 参数                        | 说明                                       |
| --------------------------- | ------------------------------------------ |
| `--skipNpm`                 | 跳过 npm 构建                              |
| `-o, --open`                | 构建后尝试打开 IDE                         |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `h5`）                |
| `--project-config <path>`   | 小程序 `project.config.json` 路径          |
| `--host [host]`             | Web dev server host（`h5` 场景）           |
| `--analyze`                 | 启动分包分析仪表盘（实验特性，小程序场景） |

### 2) `build`

用于生产构建（支持 watch）。

```bash
weapp-vite build [root]
```

参数：

| 参数                        | 说明                                           |
| --------------------------- | ---------------------------------------------- |
| `--target <target>`         | 构建目标（默认 `modules`）                     |
| `--outDir <dir>`            | 输出目录（默认 `dist`）                        |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `h5`）                    |
| `--project-config <path>`   | 小程序 `project.config.json` 路径              |
| `--sourcemap [output]`      | 产出 sourcemap（`true/inline/hidden`）         |
| `--minify [minifier]`       | 代码压缩开关或压缩器（`false/terser/esbuild`） |
| `--emptyOutDir`             | 当 outDir 在 root 外时强制清空                 |
| `-w, --watch`               | 监听并增量重建                                 |
| `--skipNpm`                 | 跳过 npm 构建                                  |
| `-o, --open`                | 构建后尝试打开 IDE                             |
| `--analyze`                 | 输出分包分析仪表盘（小程序场景）               |

### 3) `analyze`

分析小程序分包产物映射，或输出 Web 静态分析结果。

```bash
weapp-vite analyze [root]
```

参数：

| 参数                        | 说明                              |
| --------------------------- | --------------------------------- |
| `--json`                    | 输出 JSON 结果（stdout）          |
| `--output <file>`           | 将分析结果写入文件                |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `h5`）       |
| `--project-config <path>`   | 小程序 `project.config.json` 路径 |

### 4) `open`

打开 IDE（微信或支付宝场景由平台决定）。

```bash
weapp-vite open [root]
```

参数：

| 参数                        | 说明                                    |
| --------------------------- | --------------------------------------- |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `h5` \| `alipay`） |

### 5) `npm`（含别名）

调用 IDE 的 npm 构建能力。

```bash
weapp-vite npm
weapp-vite build:npm
weapp-vite build-npm
```

### 6) `generate` / `g`

生成 app / page / component 文件骨架。

```bash
weapp-vite generate [filepath]
weapp-vite g [filepath]
```

参数：

| 参数                | 说明             |
| ------------------- | ---------------- |
| `-a, --app`         | 按 app 模板生成  |
| `-p, --page`        | 按 page 模板生成 |
| `-n, --name <name>` | 指定文件名       |

### 7) `init`

初始化项目配置。

```bash
weapp-vite init
```

### 8) `mcp`

启动 `weapp-vite` MCP 服务（用于 AI 助手接入）。

```bash
weapp-vite mcp
```

参数：

| 参数                      | 说明                                                   |
| ------------------------- | ------------------------------------------------------ |
| `--transport <type>`      | 传输类型：`stdio` \| `streamable-http`（默认 `stdio`） |
| `--host <host>`           | HTTP 模式监听地址                                      |
| `--port <port>`           | HTTP 模式端口                                          |
| `--endpoint <path>`       | HTTP 模式 endpoint（默认 `/mcp`）                      |
| `--unref`                 | HTTP 模式下 `unref` server（不阻塞进程退出）           |
| `--workspace-root <path>` | 指定 workspace 根目录（默认从当前目录自动向上定位）    |

示例：

```bash
weapp-vite mcp --workspace-root /absolute/path/to/weapp-vite
weapp-vite mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp
```

## `weapp-ide-cli` 透传规则

当你输入的命令不是 `weapp-vite` 原生命令时，CLI 会判断是否属于 `weapp-ide-cli` 顶层命令。若命中，则直接透传执行。

`weapp-vite` 内建命令优先级更高（不会被透传覆盖）：

- `dev`
- `serve`
- `build`
- `analyze`
- `init`
- `open`
- `npm`
- `build:npm`
- `build-npm`
- `generate`
- `g`
- `mcp`

你也可以显式使用命名空间透传：

```bash
weapp-vite ide preview --project ./dist -q terminal
weapp-vite ide upload --project ./dist -v 1.0.0 -d "ci upload"
```

完整 IDE 命令列表请参考：

- [/packages/weapp-ide-cli](/packages/weapp-ide-cli)

## 常用示例

```bash
# 小程序开发
weapp-vite dev -p weapp

# Web 开发（指定 host）
weapp-vite dev -p h5 --host 0.0.0.0

# 小程序生产构建（不压缩 + 产出 sourcemap）
weapp-vite build -p weapp --minify false --sourcemap

# 输出分析 JSON 到文件
weapp-vite analyze -p weapp --output ./reports/analyze.json

# 透传微信预览命令
weapp-vite preview --project ./dist -q terminal
```
