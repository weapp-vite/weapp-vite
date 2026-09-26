---
title: CLI 命令参考
description: weapp-vite CLI 命令参考，覆盖 dev、build、六端 upload/preview、analyze、prepare、mcp、ide logs、generate，以及 screenshot/compare 等 weapp-ide-cli 透传规则。
keywords:
  - guide
  - cli
  - commands
  - weapp-vite
  - weapp-ide-cli
---

# CLI 命令参考

本文汇总 `weapp-vite` 在当前版本可用的命令与参数，优先覆盖日常开发、构建、支持文件预生成、AI 协作与 IDE 自动化场景。

> 微信开发者工具命令可通过 `wv ide <command>` 调用。`wv upload`、`wv preview` 是六端构建上传和预览的原生命令；原有微信 IDE 上传、预览请使用 `wv ide upload`、`wv ide preview`。

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
| `-p, --platform <platform>` | 目标平台（`weapp` \| `web`）               |
| `--project-config <path>`   | 小程序 `project.config.json` 路径          |
| `--host [host]`             | Web dev server host（`web` 场景）          |
| `--analyze`                 | 启动分包分析仪表盘（实验特性，小程序场景） |
| `--scope <scope>`           | 局部构建范围，例如 `main,packages/order`   |

补充说明：

- 当目标平台为 `weapp` 且启用了 `weapp.forwardConsole` 时，`wv dev --open` 会在打开微信开发者工具后，自动尝试把小程序 `console` 日志桥接到当前终端。
- 默认配置是 `enabled: 'auto'`，也就是仅在检测到 AI 终端时自动启用。
- `--scope` 会只保留主包和指定分包进入开发构建，适合日常只调试某几个业务分包。产物 `app.json.subPackages` 也只包含参与 scope 的分包。

### 2) `build`

用于生产构建（支持 watch）。普通 `build` 不上传；只有显式传入 `--upload` 才使用上传默认参数，并在构建成功后上传。

```bash
wv build [root]
```

参数：

| 参数                        | 说明                                                     |
| --------------------------- | -------------------------------------------------------- |
| `--target <target>`         | 构建目标（默认 `modules`）                               |
| `--outDir <dir>`            | 输出目录（默认 `dist`）                                  |
| `-p, --platform <platform>` | 小程序平台、`web`，或 `all`（小程序 + Web）              |
| `--project-config <path>`   | 小程序 `project.config.json` 路径                        |
| `--sourcemap [output]`      | 产出 sourcemap（`true/inline/hidden`）                   |
| `--minify [minifier]`       | 代码压缩开关或压缩器（`false/terser/esbuild`）           |
| `--emptyOutDir`             | 当 outDir 在 root 外时强制清空                           |
| `-w, --watch`               | 监听并增量重建                                           |
| `--skipNpm`                 | 跳过 npm 构建                                            |
| `-o, --open`                | 构建后尝试打开 IDE                                       |
| `--analyze`                 | 输出分包分析仪表盘（小程序场景）                         |
| `--scope <scope>`           | 局部构建范围，例如 `main,packages/order`                 |
| `--upload`                  | 本次构建成功后上传小程序，不重复构建                     |
| `--uv <version>`            | 上传版本，仅与 `--upload` 一起使用                       |
| `--desc <text>`             | 上传说明，仅与 `--upload` 一起使用                       |
| `--dry-run`                 | 上传演练，仅与 `--upload` 一起使用；不校验凭据或调用 SDK |

显式上传示例：

```bash
wv build --upload --dry-run
wv build --upload -p weapp --uv 1.2.3 --desc "更新首页"
```

`--watch --upload`、仅构建 Web 的 `-p web --upload` 都会报错。`build -p all --upload` 保持“小程序 + Web”的构建语义：等待两个后端都成功，再校验并上传本次小程序产物，不上传 Web，也不是依次上传六个平台。六端批量上传请使用下文的 `wv upload -p all`。

版本、说明的优先级与[上传配置](#上传配置与触发时机)一致；私钥、Token 和 AppID 的设置见[上传工具与凭据](#上传工具与凭据)。`--dry-run` 仍执行本次构建与产物校验，但不验证凭据、不加载上传 SDK。

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
- 生成的 `app.json` 会同步裁剪 `subPackages`、`preloadRule`、`tabBar` 与失效的 `entryPagePath`，未参与 scope 的页面和分包不会被派生配置继续引用。

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
| `--glass-easel-check`       | 检查 glass-easel 配置、模板与 SelectorQuery，必须修复项返回非 0 退出码             |
| `--preload`                 | 扫描静态跨分包跳转、实际分包体积与共享 2 MB 额度（仅微信小程序）                   |
| `--output <file>`           | 将分析结果写入文件，格式随 `--json` / `--markdown` / `--report pr` 决定            |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `web`）                                                       |
| `--project-config <path>`   | 小程序 `project.config.json` 路径                                                  |

小程序模式下，JSON 结果会包含 `components` 字段，用于展示组件被哪些页面递归引用、组件所属主包/分包、总使用次数，以及主包组件跨分包使用时的优化建议。默认终端摘要会展示组件建议数量和前几条高优先级建议，完整列表可通过 `--json` 或 `--output` 查看。

`weapp.analyze.budgets` 可覆盖默认总包、主包、普通分包、独立分包预算与预警比例。配合 `--budget-check` 时，预算超限会让命令返回非 0 退出码，适合 CI 阻断。`weapp.analyze.history` 默认会写入 `.weapp-vite/analyze-history`，Markdown / PR 报告会基于上一份快照输出增量归因。

常用示例：

```bash
wv analyze --json --output reports/analyze.json
wv analyze --markdown --output reports/analyze.md
wv analyze --report pr --output reports/analyze-pr.md
wv analyze --budget-check
wv analyze --glass-easel-check --json
wv analyze --hmr-profile .tmp/weapp-vite-hmr-profile.jsonl --json
wv analyze --preload --json --output reports/preload.json
wv analyze --platform web --json
```

> [!TIP]
> HMR profile 需要先在 `weapp.hmr.profileJson` 中开启，或通过 `--hmr-profile <file>` 指向已有 JSONL 文件。`--preload` 会分析静态模板、Vue SFC、可证明来源的路由调用和实际分包体积，不会修改源码；额度按触发页所属包聚合，动态路由、业务守卫和真实访问频率仍需人工复核。Web 平台当前只做 `weapp.web` 与 `executionMode` 静态分析，不提供小程序分包体积和 dashboard。

`--glass-easel-check` 的 JSON 结果位于 `glassEasel` 节点。WebView glass-easel 默认不启用，只有显式配置 `glassEaselWebview: true` 后才进入迁移检查；`componentFramework: "glass-easel"` 单独存在保持低版本回退。工具只自动归一化兼容两套组件框架的 `wx-if` / `wx-for`；循环内 `<include>`、旧式属性转义和数字开头选择器只诊断，不做有语义风险的改写。

### 4) `open`

打开 IDE（微信或支付宝场景由平台决定）。

```bash
wv open [root]
```

参数：

| 参数                             | 说明                                                |
| -------------------------------- | --------------------------------------------------- |
| `-p, --platform <platform>`      | 目标平台（`weapp` \| `web` \| `alipay`）            |
| `--ide-open-strategy <strategy>` | DevTools 打开策略（`cli` 默认，或显式 `automator`） |

说明：

- 当目标平台为 `weapp` 时，`wv open` 默认先调用官方 CLI 打开项目，再连接已打开的 automator；automator 失败不会阻止项目打开。
- `--ide-open-strategy automator` 仅用于兼容旧版 DevTools 或调试 automator-first 流程。
- 若你通过 `weapp config set autoTrustProject true` 开启了默认项目信任，未显式传 `--trust-project` 时也会按该策略执行。

如果打开、MCP 或截图仍不可用，先执行：

```bash
wv ide doctor
wv ide doctor --json
wv ide doctor --strict
```

doctor 会检查 CLI 路径、服务端口、登录状态、已打开项目的 automator websocket 和 `Tool.getInfo`；不会自动启动或关闭微信开发者工具。

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
- 当前仅支持微信小程序平台，不支持 `alipay` / `web`。
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

### `upload`：构建并上传六端小程序

```bash
# 京东、百度分别构建并上传
wv upload --platform jd --uv 1.2.3 --desc "更新首页"
wv upload --platform swan --mode production

# 按指定顺序处理多个目标；all 显式选择六个平台
wv upload --platform jd,swan
wv upload --platform all

# 仅构建并检查产物目录，不校验上传凭据、不调用上传工具
wv upload --platform all --dry-run
```

`upload [root]` 从源码项目根目录执行，复用目标平台的生产构建和项目配置解析。每个目标构建完成后才上传，不复用旧产物；多个目标串行执行，首次失败即停止，已经上传的目标不会自动撤回。未指定平台时使用项目配置；启用 `weapp.multiPlatform` 的项目仍需显式选择平台。`web` 不支持小程序上传。

| 参数                        | 说明                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `-p, --platform <platform>` | `weapp`、`alipay`、`tt`、`xhs`、`jd`、`swan`；支持逗号分隔或 `all`                                 |
| `--uv <version>`            | 覆盖 `weapp.upload.version`，未配置时读取 `package.json.version`；`--version/-v` 仍是 CLI 版本查询 |
| `--desc <text>`             | 覆盖 `weapp.upload.desc`；默认使用项目名称与版本                                                   |
| `--project-config <path>`   | 使用指定项目配置；文件名须是目标平台的标准名称                                                     |
| `--dry-run`                 | 只构建并检查 SDK 读取的代码目录与本次产物一致、`app.json` 存在                                     |
| `-m, --mode <mode>`         | 默认 `production`，同时选择构建配置和 `.env` 模式                                                  |
| `-c, --config <file>`       | 指定 Vite 配置                                                                                     |

#### 上传配置与触发时机

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    upload: {
      version: '1.2.3',
      desc: '更新首页',
    },
  },
})
```

`weapp.upload` 只提供 `wv build --upload` 和独立 `wv upload` 的默认参数，**不是构建完成自动上传的开关**，也不支持 `appid`、`identityKeyPath`、`token`、`privateKeyPath` 等凭据字段。版本优先级为 `--uv` > `weapp.upload.version` > `package.json.version`；说明优先级为 `--desc` > `weapp.upload.desc` > 项目名称与最终版本。CLI 按字符串读取版本与说明（例如 `001` 不会转成数字）；之后去除首尾空白，显式空版本报错，空说明使用自动生成的说明。

| 操作                             | 是否上传                                         |
| -------------------------------- | ------------------------------------------------ |
| 仅添加 `weapp.upload` 配置       | 否                                               |
| `wv build` / `wv dev` / HMR 重建 | 否，即使 mode 是 `production`，也不启用上传参数  |
| `wv build --upload -p weapp`     | 是，复用本次构建，产物校验通过后调用平台工具     |
| `wv build --upload -p all`       | 是，等小程序与 Web 构建都成功后，只上传小程序    |
| `wv build --upload --dry-run`    | 否，不校验凭据、不调用平台工具                   |
| `wv upload -p weapp`             | 是，仅在本次构建成功、产物校验通过后调用平台工具 |
| `wv upload -p all --dry-run`     | 否，不校验凭据、不调用平台工具                   |
| `wv preview`                     | 否，仅生成预览，不使用 `weapp.upload` 的默认参数 |

上传是有外部副作用的操作，不挂在 Vite `closeBundle` 或文件监听回调中，避免普通构建、HMR、分析构建重复上传。在 CI 中把 `wv build --upload` 放在测试通过后的显式步骤，它直接复用本次构建；独立 `wv upload` 则自行构建后上传，无需先串联一次 `wv build`。在 `build` 上单独传 `--uv`、`--desc` 或 `--dry-run` 而不传 `--upload` 会报错。

配置文件仍会正常加载与合并；上传开关不控制配置文件代码或 JavaScript getter 的求值时机。不要在配置求值期间执行上传等外部副作用。

#### 上传工具与凭据

官方工具按目标安装到使用 `weapp-vite` 的项目中，不会给所有用户默认安装六套 SDK：

| 平台            | 安装命令                        | 必需凭据或元数据                                                                                |
| --------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| 微信 `weapp`    | `pnpm add -D miniprogram-ci`    | `WEAPP_CI_PRIVATE_KEY_PATH`：代码上传私钥文件                                                   |
| 支付宝 `alipay` | `pnpm add -D minidev`           | `ALIPAY_IDENTITY_KEY_PATH`：开放平台 JSON 身份密钥文件                                          |
| 抖音 `tt`       | `pnpm add -D tt-ide-cli`        | `TT_UPLOAD_TOKEN`                                                                               |
| 小红书 `xhs`    | `pnpm add -D xhs-mp-cli`        | `XHS_UPLOAD_TOKEN`                                                                              |
| 京东 `jd`       | `pnpm add -D jd-miniprogram-ci` | `JD_PRIVATE_KEY`：代码上传密钥内容，不是文件路径                                                |
| 百度 `swan`     | `pnpm add -D swan-toolkit`      | `SWAN_UPLOAD_TOKEN`：官方 CLI 登录 Token（BDUSS）；`SWAN_MIN_VERSION`：平台支持的最低基础库版本 |

##### 1. 设置 AppID 与凭据文件

先从对应平台的小程序管理后台取得自己的 AppID，填写到**源码侧**目标项目配置中：微信、抖音、小红书、京东使用 `project.config.json`，支付宝使用 `mini.project.json`，百度使用 `project.swan.json`。建议统一填写小写 `appid`；抖音、小红书、百度会校验生成配置中的 `appid`，不能只配置 `appId`。启用 `weapp.multiPlatform` 时默认修改 `config/<平台>/` 下的配置，不要修改生成的 `dist` 配置。

例如，将微信项目配置中已有的 `appid` 改为自己的值；以下只是字段片段，`wx0123456789abcdef` 是虚构示例，不可直接用于上传：

```json
{
  "appid": "wx0123456789abcdef"
}
```

- **微信 `privateKeyPath`**：在微信公众平台为目标小程序生成并下载**代码上传密钥**，保存为项目根目录的 `.keys/weapp-upload.key`，用 `WEAPP_CI_PRIVATE_KEY_PATH` 指向它。它不是 `AppSecret`，不能互相替代；还需配置上传机器的 IP 白名单。可选 `WEAPP_CI_ROBOT` 为 `1` 到 `30`。
- **支付宝 `identityKeyPath`**：从支付宝开放平台获取供 minidev 使用的 **JSON 身份密钥文件**，原样保存为 `.keys/alipay-identity.json`，用 `ALIPAY_IDENTITY_KEY_PATH` 指向它。文件必须包含 `alipay.authentication`，不是 PEM/RSA 应用私钥；不要自行拼装 JSON。获取方式参见 [minidev 官方文档](https://opendocs.alipay.com/mini/02q17h)。
- **抖音 / 小红书 `token`**：取得目标小程序的官方 CI 上传 Token，分别将 Token **内容**填入 `TT_UPLOAD_TOKEN` / `XHS_UPLOAD_TOKEN`，不是 Token 文件路径，也不是业务接口的 access token。
- **京东 `privateKey`**：将官方代码上传密钥的**完整内容**填入 `JD_PRIVATE_KEY`；不提供 `privateKeyPath`，不能填 `.keys/xxx.key` 这样的路径。
- **百度 `token`**：通过官方 CLI 的登录流程取得 BDUSS Token，填入 `SWAN_UPLOAD_TOKEN`；同时将项目所需的最低基础库版本填入 `SWAN_MIN_VERSION`，上传和预览都必填，不能用应用发布版本代替。

##### 2. 创建本地环境文件

默认在源码项目根目录创建 `.env.production.local`，只保留需要的平台。下面所有 AppID、Token、密钥内容都是**示例占位值**，必须替换；两个密钥文件需要按上一步实际保存：

```dotenv
# 微信：AppID 默认来自项目配置，以下覆盖项可省略
WEAPP_CI_APPID=wx0123456789abcdef
WEAPP_CI_PRIVATE_KEY_PATH=.keys/weapp-upload.key
WEAPP_CI_ROBOT=1

# 支付宝：AppID 覆盖项可省略；身份文件必须是官方 JSON
ALIPAY_APP_ID=2021000000000000
ALIPAY_IDENTITY_KEY_PATH=.keys/alipay-identity.json

# 抖音 / 小红书：AppID 可省略；如设置，须与生成项目配置一致
TT_APP_ID=tt0123456789abcdef
TT_UPLOAD_TOKEN=replace-with-douyin-upload-token
XHS_APP_ID=replace-with-xhs-app-id
XHS_UPLOAD_TOKEN=replace-with-xhs-upload-token

# 京东：替换为完整密钥内容，不是文件路径
JD_PRIVATE_KEY="replace-with-jd-upload-key-contents"

# 百度：3.100.0 仅为格式示例，按项目实际最低基础库版本设置
SWAN_UPLOAD_TOKEN=replace-with-official-cli-bduss
SWAN_MIN_VERSION=3.100.0
```

AppID 默认来自目标项目配置；`WEAPP_CI_APPID` / `ALIPAY_APP_ID` 可覆盖上传使用的 AppID，必须与各自密钥的授权应用对应。`TT_APP_ID` / `XHS_APP_ID` 不能用来切换到另一个应用：必须与生成的 `project.config.json` 中 `appid` 完全一致，否则拒绝上传。京东、百度不提供 AppID 环境变量覆盖项。

`build --upload`、`upload`、`preview` 默认使用 `production` mode；`--mode test` 改为读取 `.env.test` / `.env.test.local` 等文件。加载顺序为 `.env` → `.env.local` → `.env.<mode>` → `.env.<mode>.local`，后者覆盖前者，支持变量展开，**已存在的进程环境变量优先级最高**。环境文件目录由 Vite `root` 与 `envDir` 决定，`envDir` 相对于 `root` 解析；顶层配置 `envDir: false` 时只读取进程环境，不加载这些文件。

两个密钥文件的相对路径始终以**源码项目根目录**（命令的 `[root]`，省略时为当前目录）为基准，不相对于 `.env` 所在目录、Vite `root` 或构建输出目录。不要为凭据加 `VITE_` 前缀，也不要将它们写进 `weapp.upload` 或客户端代码。

将以下规则加入项目 `.gitignore`，并把 `.keys/` 放在源码/静态资源目录之外；不要把密钥复制进构建产物：

```text
.env.local
.env.*.local
.keys/
```

然后先执行 `wv build --upload -p weapp --dry-run` 检查构建与产物路径。确认配置后去掉 `--dry-run` 才会真实上传；dry-run 不校验上述凭据、不调用平台工具，不能证明密钥有效。

##### 3. 在 CI 中注入 Secrets

以 GitHub Actions 的抖音上传步骤为例：在仓库或受保护环境的 Secrets 中保存 `TT_UPLOAD_TOKEN`，AppID 继续从已配置好的目标项目读取。以下步骤放在依赖安装、测试通过之后，仅允许可信发布任务运行，不向不可信 PR 暴露 Secrets：

```yaml
- name: 构建并上传抖音开发版本
  env:
    TT_UPLOAD_TOKEN: ${{ secrets.TT_UPLOAD_TOKEN }}
  run: pnpm exec wv build --upload -p tt --uv 1.2.3 --desc "CI 构建"
```

微信和支付宝可由 CI 的安全文件功能提供密钥文件，再将对应的 `WEAPP_CI_PRIVATE_KEY_PATH` / `ALIPAY_IDENTITY_KEY_PATH` 环境变量设为其路径；京东直接把 Secret 内容注入 `JD_PRIVATE_KEY`。不要在命令行中展开或打印密钥；任务结束后销毁密钥文件和 runner 环境。

##### 平台限制

- 建议使用 `1.2.3` 这样的版本号；抖音、支付宝要求三段数字，百度接受二至四段数字。百度最低基础库版本必须由项目明确指定，不自动猜测。
- 支付宝版本各段不能有前导零，且不得超过 `2147483647`；上传说明必须少于 200 个字符。
- 工具接收的目录由构建配置推导。上传前会检查 SDK 配置的代码根目录与本次构建输出是否相同，不一致时拒绝上传；嵌套项目配置、自定义输出目录尤其需要确认此对应关系。京东适配器会进一步定位到包含 `app.json` 的目录。
- SDK 在独立进程运行，输出过滤已知凭据及 URL 用户名密码后返回；异常退出或未确认完成都视为失败，不会因 SDK 提前 `exit(0)` 报成功。取消父进程会停止上传子进程，但无法撤回平台已经接收的版本。
- **工具凭据限制**：抖音官方 SDK 会把 Token 写入自己的本地配置；百度官方 CLI 必须通过 `--token` 传递账号登录凭据 BDUSS，子进程参数可能被同机有权限的用户读取。请使用可信、隔离的 CI runner，并在任务完成后销毁其环境，不要在不可信的共享主机上执行。进程隔离不等于第三方依赖安全沙箱。
- **京东并发限制**：官方 `jd-miniprogram-ci@1.0.8` 的上传和预览共用系统临时目录中的 `jd_mini_temp.zip`。本命令会串行执行多个目标，但不能隔离其他 CLI 进程；同一机器上共享临时目录的京东上传、预览任务也应串行，避免临时包相互覆盖。

这里只上传小程序开发版本，**不自动提审、不正式上线**；体验版二维码和可用状态依各平台规则。真实上传需要有效凭据、平台权限及网络，`--dry-run` 成功不代表平台已接受版本，也不能替代目标 IDE/真机验证。组件库和独立插件不在此入口范围内。

#### 从旧微信 IDE 上传迁移

原来的 `wv upload --project ... -v ... -d ...` 改为：

```bash
wv ide upload --project ./dist -v 1.2.3 -d "release"
```

该入口仍调用已登录的微信开发者工具，不额外构建。新的 `wv upload` 不接收旧 IDE 参数，也不隐式回退到 IDE 上传。

### `preview`：构建并生成六端预览

```bash
wv preview -p tt --mode test
wv preview -p xhs --mode production
wv preview -p jd,swan --mode test
wv preview -p all --dry-run
```

`preview [root]` 使用与 `upload` 相同的六个平台、项目根目录、生产构建、平台工具及凭据。每个目标先构建，再调用官方 **preview** 接口，不调用开发版本上传、提审或正式发布；多目标串行处理，首次失败停止。

支持 `-p/--platform`、`--project-config`、`--desc`、`--dry-run` 以及全局 `-m/--mode`、`-c/--config`。默认 mode 为 `production`；`--mode test` 选择 `.env.test` 和 `.env.test.local` 等环境配置，并不改变生产构建方式。预览不要求上传版本，也不接收 `--uv`。

| 平台               | 返回结果                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| 微信               | SDK 生成的本地二维码图片，保存到 `.weapp-vite/preview/` 下本次任务的独立文件 |
| 支付宝、京东       | 官方二维码图片 URL                                                           |
| 抖音、小红书、百度 | 官方扫码目标 / 预览链接，不是二维码图片 URL                                  |

CLI 打印对应链接或图片路径，不自动打开浏览器或修改剪贴板。百度预览也必须配置 `SWAN_MIN_VERSION`；若官方工具同时返回低版本与默认基础库两种预览码，此入口返回默认版本的预览链接。微信私钥和 IP 白名单、抖音本地 Token 存储、百度 Token 参数可见性等限制与上传相同。

只有官方调用成功并返回有效预览结果才报告完成。`--dry-run` 不调用远端服务、不生成二维码；预览有效期、扫码者权限以及目标宿主可用性由平台决定，不能用 dry-run 代替真机验收。

旧微信预览脚本 `wv preview --project ...` 应迁移为 `wv ide preview --project ...`。该显式入口继续使用已登录的微信开发者工具，不额外构建；`wv alipay preview` 也保留为原有 minidev 透传入口。

## `weapp-ide-cli` 透传规则

当你输入的命令不是 `weapp-vite` 原生命令时，CLI 会判断是否属于 `weapp-ide-cli` 顶层命令。若命中，则直接透传执行。

`weapp-vite` 内建命令优先级更高（不会被透传覆盖）：

- `dev`
- `serve`
- `build`
- `upload`
- `preview`
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
wv ide preview --project ./dist -q terminal
wv ide upload --project ./dist -v 1.0.0 -d "ci upload"
wv cache --clean compile
wv screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/acceptance.png --json
wv compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json
wv cache --clean all
wv config set autoBootstrapDevtools true
wv config set autoTrustProject true
wv ide doctor --json
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
wv dev -p web --host 0.0.0.0

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
wv ide preview --project ./dist -q terminal

# 清理微信开发者工具缓存
wv cache --clean compile
wv cache --clean all
```
