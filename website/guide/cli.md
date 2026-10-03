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

> 微信开发者工具命令可通过 `wv ide <command>` 调用。`wv upload` 默认提供六端 SDK 构建上传，也保留带明确旧参数的微信 IDE 上传语法，原参数不变，但会提示未来弃用；详见[旧上传兼容与迁移](#legacy-upload)。`wv preview` 仍是 SDK 预览，微信 IDE 预览使用 `wv ide preview`。

> `wv` 是 `weapp-vite` 的简写。下文统一使用 `wv` 作为命令示例。

## Doctor 分层检查

`wv doctor` / `runDoctor`（来自 `weapp-vite/doctor`）共享只读事实检查引擎，分别记录 project/source/artifact/runtime 覆盖。默认读取项目 JSON 和 `src`，不执行配置、不启动 IDE、不上传数据或修改代码。其他源码目录须显式传入 `--source`；构建模式会使用实际编译源码目录。

```sh
wv doctor --format json
wv doctor --build --targets weapp,alipay,swan,tt,xhs
wv doctor --artifact dist --platform weapp --format sarif
wv doctor --runtime --platform weapp
```

`--build` 明确允许执行配置/插件，在独立子进程中通过正常编译器生成 `.weapp-vite/doctor` 下的最终产物，再读取快照。构建日志走 stderr，不污染 JSON/SARIF。报告包含实际相对目录、文件摘要和预算。与 `--artifact` 互斥，后者标记新鲜度未验证、缺失编译预算时 incomplete。

`--runtime` 只连接已打开的微信 DevTools 项目并读取 Tool.getInfo 与当前页面，不启动 IDE、不切换路由；已有非默认 automator 会话可使用 `--runtime-port <port>`。这不代表应用功能已经通过 E2E。其他宿主无探针、连接失败或未打开项目均为 incomplete。


宿主分层证据会保留 CLI 可执行条件、指定服务监听、登录查询与登录状态、项目连接、工具信息、当前页面以及本次连接释放的独立结果。`passed`、`failed`、`unknown`、`not-run` 分开记录；部分失败仍保留成功阶段、实际 IDE/SDK 版本和脱敏证据，退出码为 2。TCP 可达只证明有监听，不证明它属于所选 IDE；Tool.getInfo/页面快照也不证明完整应用功能已通过。

- `--runtime-cli <path>`：只读检查显式选择的 CLI，不执行、不回退其他安装。
- `--runtime-service-port <port>`：连接指定回环 TCP 端口检查监听，仅释放本次 socket。
- `--runtime-login`：单独允许执行原生 islogin，需要同时传入 `--runtime-cli`；原生 CLI 可能启动 IDE。没有此开关不会查询或推断登录状态。

上述选项都需要 `--runtime`。JSON/SARIF 中的 `runtime.<target>.bundle` 包含框架/Node 版本、可取得的 IDE/基础库版本、配置选择摘要、最后成功阶段、有限的固定分类事件及通用复现命令。未知版本省略，终端显示 unknown；不保存原始 Tool.getInfo、CLI 输出、凭据、绝对路径或页面查询参数，不自动上传。`not-run` 不代表检查通过；旧的自定义 runtime adapter 仍可使用原证据结构。

连接和页面/工具 RPC 有界等待，迟到连接只断开自身 websocket，迟到 RPC 不会改写已返回的报告。完整操作层的总 deadline、分类重试和跨进程取消由相应操作层负责；此探针不替代 #1141 的完整工作。

退出码：0 为请求范围完整且无错误；1 为发现门禁错误；2 为未完成或执行失败（优先于 1）。未请求的层标为 not-requested。

复用平台注册表、ESLint 兼容规则和包体预算。非微信平台不使用微信 API 基线；尚无完整 API 目录时相应层 incomplete。HarmonyOS 等设备系统不作为编译目标别名。源码风险与产物诊断分离；动态引用、外部插件、自定义 npm 输出等事实不足的范围不判定通过。

产物检查包含页面/组件文件与引用、静态脚本/模板/样式依赖、独立分包边界、worker 目录和预算。诊断包含稳定 ruleId、location、evidence、responsibility、fingerprint、suggestion。无法确定责任时保留 unknown；confirmed 仅指当前静态契约的确定违反，不代表已确认框架 bug。报告只保留产物字节数与摘要，不附带完整源码。工具不会自动发布报告或创建 issue。

```ts
import { formatDoctorReport, runDoctor } from 'weapp-vite/doctor'

const report = await runDoctor({ cwd: '.', build: true, targets: ['weapp'] })
const json = formatDoctorReport(report, 'json')
```

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

以上是原生命令的参数语义；在已识别的旧微信 IDE 上传中，`-d` 仍表示上传说明，不是调试开关。

## 原生命令

### 1) `dev` / `serve`（默认命令）

用于本地开发与监听构建。

```bash
wv dev [root]
wv serve [root]
wv [root]
```

参数：

| 参数                        | 说明                                     |
| --------------------------- | ---------------------------------------- |
| `--skipNpm`                 | 跳过 npm 构建                            |
| `-o, --open`                | 构建后尝试打开 IDE                       |
| `-p, --platform <platform>` | 目标平台（`weapp` \| `web`）             |
| `--project-config <path>`   | 小程序 `project.config.json` 路径        |
| `--host [host]`             | Web dev server host（`web` 场景）        |
| `--ui`                      | 启动 Devframe Dashboard（小程序场景）    |
| `--analyze`                 | `--ui` 的兼容参数                        |
| `--scope <scope>`           | 局部构建范围，例如 `main,packages/order` |

补充说明：

- 当目标平台为 `weapp` 且启用了 `weapp.forwardConsole` 时，`wv dev --open` 会在打开微信开发者工具后，自动尝试把小程序 `console` 日志桥接到当前终端。
- 默认配置是 `enabled: 'auto'`，也就是仅在检测到 AI 终端时自动启用。
- `--scope` 会只保留主包和指定分包进入开发构建，适合日常只调试某几个业务分包。产物 `app.json.subPackages` 也只包含参与 scope 的分包。
- `--ui` 仅监听 `127.0.0.1`，终端会输出带一次性 OTP 的 magic link；Dashboard 通过分页只读 RPC 获取 Analyze 数据，并在连接中断后自动重连。

#### Dashboard MCP

运行 `wv dev --ui` / `wv build --ui` 后，Dashboard 自动在同一端口开放本机只读 MCP，并在实际监听后发布实例记录，无需配置令牌或认证环境变量。

页面与工具共用当前 revision、运行事件和受限文件读取；提供摘要／预算、包与产物／模块检索、重复分析、前后构建比较及文件片段，常规诊断无需先拼接全量报告。事件窗口保留 24 条并报告丢弃数，不是持久历史。不提供通用 shared-state 工具或命令执行。MCP 校验真实 loopback 连接对端与规范 loopback Origin，浏览器仍使用 OTP magic link。本机模式信任同机进程，不区分本机用户，请勿通过代理、隧道或端口转发对外发布。连接器配置与查询用法见 [Dashboard 实时只读接入](/packages/mcp#dashboard-实时只读接入独立入口)。现有 `wv mcp`、REST 与微信 IDE 自动化入口保持不变。


#### Dashboard 嵌入 Vite DevTools

`--ui` 保持独立工作台模式，页面与 RPC 共同挂载在 `/__weapp-vite/`。需要复用现有 Vite DevTools 宿主时，使用 Node 入口 `weapp-vite/dashboard` 创建报告控制器，再通过 `weapp-vite/dashboard/vite` 的 `createAnalyzeDashboardPlugin` 挂载同一份定义和面板。

接入方提供已完成的报告、当前产物快照与明确的源码根目录；可选 `@weapp-vite/dashboard` 提供原生构建资源。宿主持有认证、Origin、MCP 和服务生命周期，Dashboard 不覆盖共享宿主的全局 shared-state 写入。适配器只在开发模式启用，不把报告或客户端脚本注入生产小程序。

自定义面板目录与 Vite 应用 `base` 独立；页面导航与复制视图链接会保留实际挂载前缀，复制链接不会携带认证 fragment。完整用法见 [包内嵌入接口文档](https://github.com/weapp-vite/weapp-vite/tree/main/packages/weapp-vite#dashboard-嵌入-vite-devtools)；该说明也随 `weapp-vite/dist/docs/README.md` 发布。

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
| `--ui`                      | 构建后启动 Devframe Dashboard（小程序场景）              |
| `--analyze`                 | `--ui` 的兼容参数                                        |
| `--scope <scope>`           | 局部构建范围，例如 `main,packages/order`                 |
| `--upload`                  | 本次构建成功后上传小程序，不重复构建                     |
| `--uv <version>`            | 上传版本，仅与 `--upload` 一起使用                       |
| `--desc <text>`             | 上传说明，仅与 `--upload` 一起使用                       |
| `--bump <release>`          | 本地升版：`patch` / `minor` / `major`；仅与 `--upload` 一起使用，与 `--uv` 冲突 |
| `--git-desc`                | 使用最新 Git 提交标题；仅与 `--upload` 一起使用，与 `--desc` 冲突 |
| `--dry-run`                 | 上传演练，仅与 `--upload` 一起使用；不校验凭据或调用 SDK |

显式上传示例：

```bash
wv build --upload --dry-run
wv build --upload -p weapp --uv 1.2.3 --desc "更新首页"
wv build --upload -p xhs --mode test --bump patch --git-desc --dry-run
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

打开项目、刷新索引或截图重试失败时，CLI 会保留现有开发者工具窗口，只重试目标项目连接；不会自动退出整个应用或按进程名终止宿主。`--no-open-recovery` 可禁用打开后的自动重试。需要真正关闭窗口时，请在 IDE 中明确选择目标项目；`wv close` 失败会返回非零退出码，不会升级为系统级退出。

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

`wv ide doctor` 会检查 CLI 路径、服务端口配置、原生 `islogin` 查询、已打开项目的 automator websocket 和 `Tool.getInfo`。原生 CLI 查询可能拉起 IDE；需要不执行项目配置、不启动 IDE 的静态诊断时，使用上面的 `wv doctor`。

连接失败不会删除持久化 automator 会话记录；失败不能证明记录过期，也不授予诊断命令清理其他操作的权限。若连接成功但 `Tool.getInfo` 失败，报告保留 `automator: ok`，单独将 `tool` 标为 warning，并释放本次连接；该结果不证明登录失效。

登录诊断仅在原生响应明确包含 `login: true/false` 时确认状态。CLI 退出成功但没有明确结果、查询超时或执行失败均标为 unknown，不再误报已登录或未登录。

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

从项目配置、AppID 和凭据开始的完整操作步骤见[小程序上传与预览指南](./upload.md)。可直接选择[小红书](./upload/xhs.md)、[抖音](./upload/tt.md)、[微信](./upload/weapp.md)、[支付宝](./upload/alipay.md)、[京东](./upload/jd.md)或[百度](./upload/swan.md)；[淘宝目前不支持](./upload/alipay.md#taobao)，不能用支付宝目标代替。

多个平台推荐在一份 `weapp.multiPlatform.projectConfigs` 中集中配置 AppID，不需要分别维护六份原生 JSON，见[统一项目配置](./upload.md#batch)。可复制的 `.env.test` / `.env.production`、不同 AppID 以及自动版本/提交说明见[上传环境与自动版本](./upload/environments.md)。

本节的构建、凭据、配置默认值与 SDK 专属选项均针对 SDK 入口，不适用于[兼容的旧微信 IDE 上传](#legacy-upload)。

```bash
# 京东、百度分别构建并上传
wv upload --platform jd --uv 1.2.3 --desc "更新首页"
wv upload --platform swan --mode production

# 按指定顺序处理多个目标；all 显式选择六个平台
wv upload --platform jd,swan
wv upload --platform all

# 仅构建并检查产物目录，不校验上传凭据、不调用上传工具
wv upload --platform all --dry-run

# 内置本地自动版本；整批只升版一次
wv upload -p xhs,tt --mode test --bump patch --git-desc
```

`upload [root]` 从源码项目根目录执行，复用目标平台的生产构建和项目配置解析。每个目标构建完成后才上传，不复用旧产物；多个目标串行执行，首次失败即停止，已经上传的目标不会自动撤回。未指定平台时使用项目配置；启用 `weapp.multiPlatform` 的项目仍需显式选择平台。`web` 不支持小程序上传。

| 参数                        | 说明                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `-p, --platform <platform>` | `weapp`、`alipay`、`tt`、`xhs`、`jd`、`swan`；支持逗号分隔或 `all`                                 |
| `--uv <version>`            | 覆盖 `weapp.upload.version`，未配置时读取 `package.json.version`；SDK 上传不用旧 IDE 的 `--version/-v` |
| `--desc <text>`             | 覆盖 `weapp.upload.desc`；默认使用项目名称与版本                                                   |
| `--bump <release>`          | `patch` / `minor` / `major`；递增命令根目录业务版本，与显式 `--uv` 冲突 |
| `--git-desc`                | 最新 Git 提交的 subject 作为说明，与显式 `--desc` 冲突 |
| `--project-config <path>`   | 使用指定项目配置；文件名须是目标平台的标准名称                                                     |
| `--dry-run`                 | 只构建并检查 SDK 读取的代码目录与本次产物一致、`app.json` 存在                                     |
| `--json`                    | stdout 输出单个结构化汇总，日志和进度进入 stderr；失败退出码非零 |
| `--timeout <seconds>`       | 每个平台 SDK worker 的本地超时，不含构建；正数秒，精度不超过毫秒，默认不增加超时 |
| `-m, --mode <mode>`         | 默认 `production`，同时选择构建配置和 `.env` 模式                                                  |
| `-c, --config <file>`       | 指定 Vite 配置                                                                                     |

报告保留前序成功和后续未执行目标；SDK 开始后超时或中断会标记远端结果未确认，不自动重试。官方进度不等于上传完成。完整字段、六端可选结果及取消边界见[结果、进度与本地超时](./upload.md#report)。`--json` / `--timeout` 仅支持独立 `upload`，不适用于 `build --upload` 或 `preview`。

#### 上传配置与触发时机

通常无需配置此项：版本默认来自 `package.json.version`，说明自动生成 `项目名@版本`。以下仅展示需要固定覆盖时的可选配置，不是每次上传前必填的步骤。

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

`weapp.upload` 只提供 `wv build --upload` 和 SDK `wv upload` 的默认参数，不影响旧 IDE 上传，**不是构建完成自动上传的开关**，也不支持 `appid`、`identityKeyPath`、`token`、`privateKeyPath` 等凭据字段。版本优先级为 CLI `--uv` 或 `--bump` 生成值 > `weapp.upload.version` > `package.json.version`；说明优先级为 CLI `--desc` 或 `--git-desc` 生成值 > `weapp.upload.desc` > 项目名称与最终版本。CLI 按字符串读取版本与说明（例如 `001` 不会转成数字）；之后去除首尾空白，显式空版本报错，空说明使用自动生成的说明。

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

上传是有外部副作用的操作，不挂在 Vite `closeBundle` 或文件监听回调中，避免普通构建、HMR、分析构建重复上传。在 CI 中把 `wv build --upload` 放在测试通过后的显式步骤，它直接复用本次构建；独立 `wv upload` 则自行构建后上传，无需先串联一次 `wv build`。在 `build` 上单独传 `--uv`、`--desc`、`--bump`、`--git-desc` 或 `--dry-run` 而不传 `--upload` 会报错。

配置文件仍会正常加载与合并；上传开关不控制配置文件代码或 JavaScript getter 的求值时机。不要在配置求值期间执行上传等外部副作用。

#### 本地自动版本与 Git 说明

不传 `--bump` / `--git-desc` 就不执行自动升版、Git 读取或 npm 版本操作。这两个选项仅属于 CLI，不可放入 `weapp.upload`；`preview` 不接受它们。可独立启用：真实 `--bump patch|minor|major` 要求本机 npm，`--git-desc` 才要求 Git 可执行且仓库已有提交。前者与显式 `--uv` 冲突，后者与显式 `--desc` 冲突，生成值可覆盖配置默认值。

版本只取命令 `[root]` 直接包含的 `package.json`，不向父目录查找；省略 root 时为当前目录，与 Vite `root` / `envDir` 无关。首次编译器初始化与配置求值前准备一次版本和 Git subject，多平台整批共用。真实升版由 npm 标准操作完成，`--prefix`、工作目录均限定到应用根，并使用 `--no-git-tag-version --ignore-scripts --workspaces=false`：不修改外层 workspace 根包，不运行生命周期钩子、不 commit/tag/push。

`--dry-run` 只计算预计版本和说明，不运行 npm、不修改版本或锁文件；仍会构建，直接导入 `package.json` 的代码读到原始源版本。参数冲突、无效 release / 当前版本、Git 失败在修改文件前报错；升版完成后构建或上传失败不回滚。重试仅选择未完成的平台，去掉 `--bump`，并复用上一批版本与说明。可复制命令与完整边界见[本地自动版本](./upload/environments.md#local-version)；CI 仍可直接传 `--uv` / `--desc`，无需改写版本文件。

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

各平台的源项目配置、AppID、凭据获取步骤和完整 `.env.production.local` 示例统一在[分平台操作指南](./upload.md)维护。首次使用建议按对应平台页面依次执行 dry-run、上传、预览，不要直接把六套示例凭据复制到项目里。

- [环境优先级、密钥相对路径与 Git 忽略规则](./upload.md#environment)
- [多平台目录、批量顺序、两个 `all` 的区别和失败重试](./upload.md#batch)
- [CI Token 注入、私钥文件创建与清理](./upload.md#ci)
- [版本限制、目录校验、凭据错误和上传后的发布步骤](./upload.md#troubleshooting)

上传只产生开发版本，不自动提审或正式上线；组件库与独立插件不支持。dry-run 不验证凭据或官方平台受理，不能代替 IDE/真机验收。抖音 Token 本地存储、百度 BDUSS 子进程参数可见性、京东共享临时包并发限制见各平台指南；请使用可信隔离的 runner。

#### 旧微信 IDE 上传兼容与迁移 {#legacy-upload}

常规 SDK 上传直接使用 `wv upload -p weapp`，不需要 `--project`，会按项目配置和本轮实际输出自动定位。下文 `./dist` 只是旧脚本的 IDE 工程目录示例，不是默认值；工程根应含 `project.config.json`。旧入口省略定位参数时保持透传，不注入固定 `dist` 路径。

以下旧命令**仍可原样执行**，沿用已登录的微信开发者工具、原始参数和退出行为，不额外触发 weapp-vite 构建：

```bash
# 原有长参数
wv upload --project ./dist --version 1.2.3 --desc "release"

# 原有短参数：-p 是 IDE 项目目录，-v 是上传版本，-d 是上传说明
wv upload -p ./dist -v 1.2.3 -d "release"

# 等号形式同样保留
wv upload --project=./dist --version=1.2.3 --desc="release"
```

有效的旧上传仍需 `--version/-v`、`--desc/-d`，以及 `--project/-p` 或 `--appid`。顶层旧语法每次调用只警告一次：**未来将移除，请预留迁移时间**，当前不会强制改写脚本。两种迁移方向并不等价：

- **保留 IDE 行为**：仅增加 `ide` 命名空间，例如 `wv ide upload -p ./dist -v 1.2.3 -d "release"`。这是稳定的显式入口，**不弃用、不产生上述警告**，仍依赖 IDE 登录，不额外构建。
- **迁移到 SDK 构建上传**：先回到包含 `package.json`、Vite 配置和源码的项目根，安装 `miniprogram-ci`，配置 AppID、代码上传私钥和 IP 白名单，再执行：

  ```bash
  wv build --upload -p weapp --uv 1.2.3 --desc "release"
  ```

  该命令重新构建，不复用 IDE 登录凭据。版本参数改为 `--uv`；**不要把旧 `--project` 指向的 `dist` 产物目录直接作为 SDK 命令的 `[root]`**。准备步骤见[微信上传指南](./upload/weapp.md)。

分流只看明确的参数标记，不猜测目录或平台：

- 旧 IDE 标记：`--version/-v`、`--project`、`--appid`、`--ext-appid`、`--info-output/-i`。
- SDK 标记：长参数 `--platform`、`--uv`、`--bump`、`--git-desc`、`--dry-run`、`--json`、`--timeout`。它们与旧标记混用时，在 IDE、编译器或版本文件产生副作用前报错；即使使用其 `--no-*` 形式也不能混入旧调用。SDK 专属选项不会在 IDE 上传中被静默忽略。
- `-p` 单独不是旧标记：带旧标记时仍是 IDE 项目目录，否则是原生平台参数；不根据值是否像平台名或路径是否存在决定后端。`--desc` 两边共用；`-d` 仅在旧调用中是说明，在原生命令中仍是全局 debug。
- 必填选项值只作为数据，不识别成方言标记；支持分开和 `=` 形式。仅在选项位置遇到 `--` 才停止扫描，例如 `--desc "--"` 中的 `--` 仍是说明；可选的 `--debug` 不会吞掉后续选项。

帮助入口也有区分：`wv upload --help` 查看 SDK 帮助；`wv help upload` 保留旧 IDE 帮助并提示未来弃用；`wv ide help upload` 查看显式 IDE 帮助，不产生弃用警告。查询工具自身版本使用 `wv --version`。

### `preview`：构建并生成六端预览

```bash
wv preview -p tt --mode test
wv preview -p xhs --mode production
wv preview -p jd,swan --mode test
wv preview -p all --dry-run
```

`preview [root]` 使用与 `upload` 相同的六个平台、项目根目录、生产构建、平台工具及凭据。每个目标先构建，再调用官方 **preview** 接口，不调用开发版本上传、提审或正式发布；多目标串行处理，首次失败停止。

支持 `-p/--platform`、`--project-config`、`--desc`、`--dry-run` 以及全局 `-m/--mode`、`-c/--config`。默认 mode 为 `production`；`--mode test` 选择 `.env.test` 和 `.env.test.local` 等环境配置，并不改变生产构建方式。预览不要求上传版本，也不接收 `--uv`、`--bump` 或 `--git-desc`。

| 平台               | 返回结果                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| 微信               | SDK 生成的本地二维码图片，保存到 `.weapp-vite/preview/` 下本次任务的独立文件 |
| 支付宝、京东       | 官方二维码图片 URL                                                           |
| 抖音、小红书、百度 | 官方扫码目标 / 预览链接，不是二维码图片 URL                                  |

CLI 打印对应链接或图片路径，不自动打开浏览器或修改剪贴板。百度预览也必须配置 `SWAN_MIN_VERSION`；若官方工具同时返回低版本与默认基础库两种预览码，此入口返回默认版本的预览链接。微信私钥和 IP 白名单、抖音本地 Token 存储、百度 Token 参数可见性等限制与上传相同。

只有官方调用成功并返回有效预览结果才报告完成。`--dry-run` 不调用远端服务、不生成二维码；预览有效期、扫码者权限以及目标宿主可用性由平台决定，不能用 dry-run 代替真机验收。

旧微信预览脚本 `wv preview --project ...` 应迁移为 `wv ide preview --project ...`。该显式入口继续使用已登录的微信开发者工具，不额外构建；`wv alipay preview` 也保留为原有 minidev 透传入口。

## `weapp-ide-cli` 透传规则

一般情况下，当命令不是 `weapp-vite` 原生命令且命中 `weapp-ide-cli` 顶层 catalog 时，CLI 才透传执行。明确的兼容例外是[旧微信 IDE 顶层上传和 `help upload`](#legacy-upload)：它们继续走原有 IDE 分发，不改写原始参数。

以下内建命令通常优先执行；`upload` 按上述方言规则区分，其他命令不会被 IDE 透传覆盖：

- `dev`
- `serve`
- `build`
- `upload`（旧 IDE 参数调用除外）
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
