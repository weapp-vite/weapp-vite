---
title: "@weapp-vite/mcp"
description: "@weapp-vite/mcp 是 weapp-vite 官方 MCP 服务实现，面向 AI 助手提供源码检索、命令执行与文档资源能力。"
keywords:
  - Weapp-vite
  - packages
  - mcp
  - "@weapp-vite/mcp"
  - ai
  - sdk
---

# @weapp-vite/mcp

`@weapp-vite/mcp` 是 `weapp-vite` 官方维护的 MCP 服务实现，目标是把 `weapp-vite / wevu / wevu-compiler` 的关键研发能力暴露给 AI 助手。

在当前版本中，`weapp-vite` 已集成该能力。大多数场景下，你不需要单独使用此包，而是直接通过 `wv mcp` 启动。

当前服务端基于 MCP TypeScript SDK v2：`stdio` 与 `streamable-http` 均支持
`2026-07-28` 协议版本，并兼容 2025-era 客户端。HTTP 入口默认校验 `Host` 与
`Origin`，推荐使用 `127.0.0.1` 本地监听。

## 推荐使用方式

```bash
wv mcp init codex
wv mcp init claude-code
wv mcp init cursor
```

`init` 会生成并写入对应客户端配置。当前支持的客户端名称是：

- `codex`
- `claude-code`
- `cursor`

如果你只想预览配置，不直接写入：

```bash
wv mcp print codex
```

写入完成后，建议执行：

```bash
wv mcp doctor codex
```

如果你已经启动了 `streamable-http` MCP 服务，也可以直接生成 HTTP 配置。未传 `--url` 时，CLI 会尝试从当前 workspace 的 `weapp.mcp` 配置推导地址：

```bash
wv mcp init codex --transport http
wv mcp init claude-code --transport http
wv mcp init cursor --transport http
wv mcp init codex --transport http --url http://127.0.0.1:3088/mcp
```

仍然需要手动起服务时：

```bash
wv mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp
```

## 何时使用

1. 你要让 AI 助手直接读取 `weapp-vite` 仓库源码与文档。
2. 你要让 AI 在受限命令白名单下完成“修改 + 验证”闭环。
3. 你要基于官方 MCP 能力扩展团队内部 AI 工作流。

## 安装

```bash
pnpm add @weapp-vite/mcp
```

## 启动方式

不在仓库目录执行时，可选追加 `--workspace-root <repo-root>`。

当前默认写入位置：

1. `Codex`: `~/.codex/config.toml`
2. `Claude Code`: 项目根目录 `.mcp.json`
3. `Cursor`: 项目根目录 `.cursor/mcp.json`

如果你只想单独运行包本身：

```bash
pnpm --filter @weapp-vite/mcp start
```

## Dashboard 实时只读接入（独立入口）

`wv dev --ui` / `wv build --ui` 可通过 DevFrame MCP 读取当前 Dashboard。它不替换 `wv mcp`，不改变本页其余工具、Resources、Prompts、REST 或微信 IDE 会话；`wv mcp init` 仍连接原有服务。

```bash
pnpm add -D @weapp-vite/dashboard devframe@1.1.0 @devframes/agentic@1.1.0
```

启动 `wv dev --ui` / `wv build --ui` 后，Dashboard 自动在同一端口开放本机只读 MCP，无需生成令牌或配置认证环境变量。

MCP 客户端在项目目录通过 stdio 执行 `pnpm exec devframe connect`。支持 `mcpServers` 的客户端配置示例：

```json
{
  "mcpServers": {
    "weapp-dashboard": {
      "command": "pnpm",
      "args": ["exec", "devframe", "connect"]
    }
  }
}
```

先调用 `devframe_connect_list-instances` 选择项目及端口，再通过 `devframe_connect_call-tool` 调用：

| 工具 | 用途 |
| --- | --- |
| `weapp-vite_get-dashboard-state` | 无参数；取得后续查询所需的 revision |
| `weapp-vite_get-analyze-summary` | 包体总量、预算与缺失体积数据的汇总 |
| `weapp-vite_query-analyze-packages` | 按包类型、名称、预算状态查询和排序 |
| `weapp-vite_query-analyze-artifacts` | 最大产物、包内文件、指定模块的产物位置 |
| `weapp-vite_query-analyze-modules` | 按来源、包、产物筛选模块，检查跨包重复与隔离边界 |
| `weapp-vite_compare-analyze-builds` | 包／文件／模块的新增、删除、增长和缩小 |
| `weapp-vite_query-runtime-events` | 最近事件的类型、级别、来源、文本和 ISO 时间筛选 |
| `weapp-vite_read-dashboard-file` | 受限源码或当前产物的文本片段，也保留全文读取 |
| `weapp-vite_get-analyze-page` | 仅在需要全量导出时拼接报告 JSON 文本页 |

常规诊断按“状态 → 摘要 → 定位 → 比较／文件片段”进行，不需要先取完整报告。输入统一使用 `arg0`，例如：

```json
{ "arg0": { "revision": 0, "duplicateOnly": true, "sortBy": "estimatedSavingBytes", "limit": 10 } }
```

这是模块查询示例；revision 必须替换成当前值。摘要和目录查询支持 `target: "previous"`；列表默认 20 项、最多 100 项，以 `offset`／`nextOffset` 分页，返回匹配总数和报告 hash。旧 revision 及过期异步读取会被拒绝，不能拼接不同版本的结果。

比较请求使用 `scope: "package" | "file" | "module"`，可按包和变更类型筛选。包筛选在模块归并前生效，`totals` 仍是整个构建的产物总量。没有上次快照时返回 `available: false`、`totals: null`。模块差异按已记录的贡献和来源身份计算，不能与文件差异相加。

缺失体积不是零：比较行对应的 `currentBytes`／`previousBytes`／`deltaBytes` 为 `null`，无法判断增减的现存成员标为 `change: "unmeasured"`；新增／删除仍保留成员变化，包括零字节。`totals` 包含 `currentUnmeasuredFiles`／`previousUnmeasuredFiles`；测量不完整的一侧总量及总增量为 `null`。已知变化先按绝对增量排序，未测量行排在其后。

重复模块的节省量是估算；`hasIndependentPackage` 表示可能必须保留独立分包隔离。模块归属包含资源源码；构建位置不是完整源码引用因果链。未记录产物体积时 `size` 为 `null`，摘要／包行通过 `unmeasuredFiles` 标明缺失数据。

文件示例：`{ "arg0": { "kind": "artifact", "path": "app.js", "revision": 0, "range": { "offset": 0, "limit": 4096 } } }`。范围使用零起始 UTF-16 码元，最多 16384，返回 `totalCharacters` 和 `nextOffset`；`size` 保持完整文件 UTF-8 字节数。省略范围可读全文，但不会绕过 2 MiB、allowlist、根目录与符号链接限制。源码来自受限实时读取，产物来自当前快照，不回退到实时 `dist`，不提供上一快照文件内容。

事件按 ISO `occurredAt` 筛选，`since`／`until` 包含边界且需携带时区；它独立于构建 revision，只保留最近 24 条。`retention` 明确返回实际丢弃数和最早保留时间，不能把它当作持久历史或小程序 console/network。

结果提供对象型 `structuredContent`。页面、MCP 和 Markdown 报告复用 `weapp-vite/dashboard/analyze` 的预算、重复分析与构建比较计算；该浏览器安全入口不启动服务。

独立端点为 `http://127.0.0.1:<port>/__weapp-vite/__mcp`。直接 HTTP 客户端不需要 `Authorization`，但必须提供规范 loopback `Origin`。MCP 协议请求（POST / GET / DELETE）的 Origin 缺失 / 不合法，或实际 socket 对端非 loopback / 无法识别时返回 403；不信任转发头提供的地址。OPTIONS 预检由 Vite 原生 CORS 处理，可能返回空的 204，不执行 MCP 工具或放宽后续请求的门禁。浏览器仍通过 OTP 授权，独立 MCP 不开放通用 shared-state 工具、命令或写入能力。

本机模式信任同机进程，不区分本机用户。不要通过代理、隧道或端口转发对外发布 Dashboard；本机代理会使远端请求表现为本机连接。需要用户身份隔离时，应选择具有相应认证策略的宿主。

实例只在真实监听后注册；关闭 / 重启清理旧记录。若注册目录不可写，可按上游诊断使用 `devframe connect --port <port> --base /__weapp-vite/` 显式探测。嵌入 Vite DevTools 时，仍由宿主决定 MCP、认证与发现策略。

## 主要能力

### Tools

| Tool                       | 作用                                       | 关键输入                                                |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `workspace_catalog`        | 输出暴露包目录、版本、脚本清单             | 无                                                      |
| `list_source_files`        | 列出包内文件（默认 `src`）                 | `packageId`、`directory`、`maxResults`                  |
| `read_source_file`         | 读取源码文件，支持行区间裁剪               | `packageId`、`filePath`、`startLine`、`endLine`         |
| `search_source_code`       | 在源码里做关键词检索                       | `query`、`packageId`、`directory`                       |
| `run_package_script`       | 在指定包目录执行 `pnpm run <script>`       | `packageId`、`script`、`args`                           |
| `run_weapp_vite_cli`       | 调用 `weapp-vite` CLI                      | `subCommand`、`projectPath`、`platform`、`args`         |
| `take_weapp_screenshot`    | 显式截图工具，封装 `wv screenshot --json`  | `projectPath`、`page`、`outputPath`                     |
| `compare_weapp_screenshot` | 显式截图对比工具，封装 `wv compare --json` | `projectPath`、`baselinePath`、`page`、`diffOutputPath` |
| `run_repo_command`         | 执行仓库级白名单命令                       | `command`、`args`、`cwdRelative`                        |

### DevTools Runtime Tools

这组工具直接复用微信开发者工具 automator 会话，适合真实小程序运行时排查。常见调用顺序是先连接，再路由、截图、查结构、读日志。若 IDE 已经打开但连接失败，先执行 `wv ide doctor --json`；默认打开链路由官方 CLI 拉起 IDE，automator 只负责连接和运行时能力。

| Tool                         | 作用                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------- |
| `weapp_devtools_connect`     | 确认 DevTools automator 会话可用，并返回当前页面与系统信息                   |
| `weapp_devtools_route`       | 执行 `navigateTo` / `redirectTo` / `reLaunch` / `switchTab` / `navigateBack` |
| `weapp_devtools_active_page` | 读取当前页面路径、查询参数、尺寸、滚动位置，可选返回页面 data                |
| `weapp_devtools_page_stack`  | 读取当前页面栈                                                               |
| `weapp_devtools_capture`     | 截取当前小程序视口，返回 base64 或保存图片                                   |
| `weapp_devtools_host_api`    | 调用 `wx.*` 宿主 API                                                         |
| `weapp_devtools_console`     | 读取 MCP 会话捕获的 console/exception 日志                                   |

### Runtime Inspection Tools

这组工具用于检查或操作当前页面、节点和组件实例。它们比纯截图更适合定位“结构在不在、状态对不对、事件有没有触发”。

| Tool                                                                                                                                                | 作用                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `weapp_runtime_find_node` / `weapp_runtime_find_nodes` / `weapp_runtime_wait_node`                                                                  | 查询或等待页面元素                          |
| `weapp_runtime_find_node_by_xpath` / `weapp_runtime_find_nodes_by_xpath`                                                                            | 通过 XPath 按文本、属性或层级关系查询元素   |
| `weapp_runtime_wait`                                                                                                                                | 在当前页面等待指定毫秒数                    |
| `weapp_runtime_page_state` / `weapp_runtime_update_page_state` / `weapp_runtime_invoke_page`                                                        | 读取页面 data、调用 `setData`、调用页面方法 |
| `weapp_runtime_tap_node` / `weapp_runtime_input_node`                                                                                               | 点击节点、向输入节点输入文本                |
| `weapp_runtime_component_state` / `weapp_runtime_update_component_state` / `weapp_runtime_invoke_component`                                         | 读取/更新组件 data、调用组件方法            |
| `weapp_runtime_find_child` / `weapp_runtime_find_children`                                                                                          | 在组件或节点内部继续查找元素                |
| `weapp_runtime_node_markup` / `weapp_runtime_node_styles` / `weapp_runtime_node_attrs` / `weapp_runtime_scroll_node` / `weapp_runtime_measure_node` | 读取节点 WXML、样式、属性、滚动或尺寸信息   |

### Resources

| Resource                                    | 说明                         |
| ------------------------------------------- | ---------------------------- |
| `weapp-vite://workspace/catalog`            | 工作区包目录、版本、脚本索引 |
| `weapp-vite://docs/{package}/README.md`     | 暴露包的 README              |
| `weapp-vite://docs/{package}/CHANGELOG.md`  | 暴露包的 CHANGELOG           |
| `weapp-vite://source/{package}?path={path}` | 读取指定源码文件             |

### Prompts

| Prompt                            | 说明                                  |
| --------------------------------- | ------------------------------------- |
| `plan-weapp-vite-change`          | 生成 weapp-vite / wevu 改造计划提示词 |
| `debug-wevu-runtime`              | 生成 wevu runtime 排查提示词          |
| `inspect-mini-program-page`       | 连接 DevTools 并检查页面渲染状态      |
| `recover-mini-program-connection` | 恢复 DevTools automator 连接          |

## AI 友好的截图工具

为了让 AI 在自然语言里更稳定地命中 mini-program runtime 能力，`@weapp-vite/mcp` 额外提供：

- `take_weapp_screenshot`
  - 面向“截图 / 页面快照 / runtime screenshot”
- `compare_weapp_screenshot`
  - 面向“截图对比 / diff / baseline / 视觉回归 / 像素对比”

这两个工具本质上分别封装了 `wv screenshot --json` 与 `wv compare --json`，但对 AI 更容易命中，也更适合在 prompt 里直接点名。

### `take_weapp_screenshot` 输入参数

| 参数          | 说明                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| `projectPath` | 相对 workspace 根路径，通常是 `dist/build/mp-weixin` 或具体小程序项目目录 |
| `page`        | 可选；截图前先跳转到指定页面                                              |
| `outputPath`  | 可选；截图输出路径，建议写入 `.tmp/`                                      |
| `timeoutMs`   | 可选；命令超时                                                            |

### `compare_weapp_screenshot` 输入参数

| 参数                | 说明                                                                      |
| ------------------- | ------------------------------------------------------------------------- |
| `projectPath`       | 相对 workspace 根路径，通常是 `dist/build/mp-weixin` 或具体小程序项目目录 |
| `baselinePath`      | 相对 workspace 根路径的 baseline 图片路径                                 |
| `page`              | 可选；对比前先跳转页面                                                    |
| `currentOutputPath` | 可选；保存当前截图                                                        |
| `diffOutputPath`    | 可选；保存 diff 图                                                        |
| `threshold`         | 可选；pixelmatch threshold，范围 `0-1`                                    |
| `maxDiffPixels`     | 可选；最大允许差异像素数                                                  |
| `maxDiffRatio`      | 可选；最大允许差异占比，范围 `0-1`                                        |
| `timeoutMs`         | 可选；命令超时                                                            |

> **注意**：对比类工作流里，建议显式传入 `diffOutputPath`，这样 AI 在失败时能直接产出 diff 图用于复盘。

## 推荐提示词写法

如果你希望 AI 不要退化成浏览器截图，而是直接使用小程序运行时能力，建议在提示词里直接写：

```text
提到截图时优先使用 take_weapp_screenshot。
提到截图对比、baseline、diff、视觉回归时优先使用 compare_weapp_screenshot。
先读取 node_modules/weapp-vite/dist/docs/index.md 与 node_modules/weapp-vite/dist/docs/mcp.md。
```

如果项目是通过 `create-weapp-vite` 初始化的，根目录里的 `AGENTS.md` 通常也已经内置了这类 AI 意图路由规则。

## 安全约束

1. 文件读取限制在 workspace 根目录内。
2. 命令执行限制在白名单（`pnpm/node/git/rg`）。
3. 输出内容有截断与超时保护。
4. HTTP 入口校验本地主机 `Host` 与 `Origin`，阻止 DNS rebinding。

## 二次开发建议

若你要扩展能力，建议从以下文件开始：

1. `packages/mcp/src/server.ts`：工具/资源/Prompt 注册入口。
2. `packages/mcp/src/fileOps.ts`：文件读取与搜索策略。
3. `packages/mcp/src/commandOps.ts`：命令白名单与执行约束。

## 关联阅读

1. [AI 协作指南](/guide/ai)
2. [AI 学习入口](/ai)
3. [CLI 命令参考](/guide/cli)
