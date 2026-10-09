# weapp-vite MCP 集成使用指南

## 1. 能力概览

`weapp-vite` 现在内置了对 `weapp-vite/mcp` 的集成，支持直接通过 `weapp-vite mcp` 启动 MCP Server（`stdio` 传输）。

当前服务端已升级到 MCP TypeScript SDK v2。`stdio` 通过 `serveStdio`、HTTP 通过
`createMcpHandler` 显式协商 `2026-07-28` 协议版本，同时保留对 2025-era 客户端的兼容。

如果你是在其他仓库里通过 npm 依赖使用 `weapp-vite`，建议先让 AI 读取本地随包文档目录：

- `node_modules/weapp-vite/dist/docs/index.md`
- `node_modules/weapp-vite/dist/docs/README.md`
- `node_modules/weapp-vite/dist/docs/mcp.md`

这样可以优先命中与当前安装版本一致的本地说明，而不是依赖可能过期的外部网页或模型记忆。

这个 MCP Server 主要面向 AI 编程助手，暴露了 `weapp-vite / wevu / wevu-compiler` 的关键研发能力：

1. 工作区能力目录（版本、脚本、文档）
2. 源码文件列表、按行读取、全文检索
3. 包级脚本执行（`pnpm run`）
4. `weapp-vite` CLI 调用
5. 仓库级受限命令执行（`pnpm/node/git/rg`）
6. 面向改造和排障的标准 Prompt 模板

### Dashboard 证据查询与对象调查（DevFrame）

`wv dev --ui` / `wv build --ui` 可通过 DevFrame MCP 查询**当前运行中的 Dashboard**，并领取、回传对象调查。这与下文的 `wv mcp` 是两个入口：现有工具、Resources、Prompts、REST 和微信 IDE 会话保持不变，`wv mcp init` 不会改为连接 Dashboard。

在项目中安装面板及可选的 stdio 连接器：

```bash
pnpm add -D @weapp-vite/dashboard devframe@1.2.0 @devframes/agentic@1.2.0
```

启动 `wv dev --ui` / `wv build --ui` 后，Dashboard 自动开放本机 scoped MCP，无需生成令牌或配置认证环境变量。浏览器仍使用终端提供的 OTP magic link；MCP 不需要先完成浏览器授权。

默认 `standalone` 与 `--ui-host hub` 都发布同一 Dashboard 范围的 MCP 发现记录，端点为 `/__weapp-vite/__mcp`。Hub 的 `/__devframes/__mcp` 聚合入口仍关闭：该端点不继承宿主其他插件的工具、Resources 或 shared-state，也不授予文件修改或命令执行权限。`--no-mcp` 控制的是原有 CLI MCP 服务，不关闭随 UI 启动的 Dashboard scoped MCP。

在项目目录启动 stdio 连接器：

```bash
pnpm exec devframe connect
```

支持 `mcpServers` 配置的客户端可使用：

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

先调用 `devframe_connect_list-instances`，按项目与端口选择实例，再用 `devframe_connect_call-tool` 调用工具。实例只在真实监听后注册；关闭或重启时移除本实例的旧记录。若注册目录不可写，上游会输出诊断，可改用 `devframe connect --port <port> --base /__weapp-vite/` 显式探测终端 UI 地址中的端口。

| 工具 | 输入 | 结果 |
| --- | --- | --- |
| `weapp-vite_get-dashboard-state` | `{}` | 当前 sessionId、revision、报告描述符、调查状态与最近事件 |
| `weapp-vite_get-analyze-summary` | `{ "arg0": { "revision": 0 } }` | 包、文件、模块、已知字节总量及预算状态汇总 |
| `weapp-vite_query-analyze-packages` | `{ "arg0": { "revision": 0, "budgetStatus": "exceeded" } }` | 按包类型、名称、预算状态筛选，按体积、名称或预算比例排序 |
| `weapp-vite_query-analyze-artifacts` | `{ "arg0": { "revision": 0, "limit": 10 } }` | 最大产物；也可按 `packageId`、`moduleId`、类型和路径定位 |
| `weapp-vite_query-analyze-modules` | `{ "arg0": { "revision": 0, "duplicateOnly": true, "sortBy": "estimatedSavingBytes" } }` | 模块体积、跨包重复估算及独立分包边界提示 |
| `weapp-vite_compare-analyze-builds` | `{ "arg0": { "revision": 0, "scope": "file" } }` | 包、文件或模块的新增、删除、增长、缩小及构建总量差异 |
| `weapp-vite_query-runtime-events` | `{ "arg0": { "kind": "hmr", "limit": 10 } }` | 最近事件、HMR profile 和窗口保留／丢弃计数 |
| `weapp-vite_read-dashboard-file` | `{ "arg0": { "kind": "artifact", "path": "app.js", "revision": 0, "range": { "offset": 0, "limit": 4096 } } }` | 报告内源码或当前构建产物的有界文本片段 |
| `weapp-vite_get-analyze-page` | `{ "arg0": { "target": "current", "index": 0, "revision": 0 } }` | 全量导出用的 JSON 文本页，不是常规诊断的必经步骤 |
| `weapp-vite_list-investigations` | `{}` | 当前宿主会话的调查列表及列表版本，不含领取令牌 |
| `weapp-vite_get-investigation` | `{ "arg0": { "id": "<任务 UUID>" } }` | 单个调查的权威状态、任务版本及报告绑定 |
| `weapp-vite_claim-investigation` | `arg0`：`id`、`version`、`agentName` | 领取任务；仅本次响应返回私有 `claimToken` |
| `weapp-vite_propose-investigation` | `arg0`：`id`、`version`、`claimToken`、`proposal` | 回传精确路径、变更说明、检查与风险；服务端生成提案 ID |
| `weapp-vite_start-investigation` | `arg0`：`id`、`version`、`claimToken` | 消费浏览器对当前提案的授权，记录开始；不启动进程 |
| `weapp-vite_complete-investigation` | `arg0`：`id`、`version`、`claimToken`、`receipt` | 回传外部执行结果；不自动标记验证通过 |

示例 revision、路径和 ID 必须来自当前状态与查询结果。参数使用 DevFrame 原生的位置参数包装 `arg0`，结果提供对象型 `structuredContent`。推荐先取状态和摘要，再查询包／产物／模块，最后按需读取文件片段；无需下载整份报告自行排序或比较。

- 摘要和目录查询的 `target` 默认为 `current`，也可读 `previous` 的报告元数据；结果携带 `revision` 与 `reportHash`。列表默认 `offset: 0`、`limit: 20`，最多 100 项，返回匹配 `total` 和 `nextOffset`，末页为 `null`。报告更新后旧 revision 与过期异步读取会被拒绝，须重新取状态，不能混用跨版本页面。
- 包与产物的模块归属来自报告的模块使用记录，包含没有 chunk 贡献列表的资源源码。模块查询支持 `packageId`、`artifact`、`sourceType`、`query`，包与产物条件必须命中同一处归属。用返回的模块 `id` 查询产物可定位构建位置，不代表已经取得源码 importer 因果链。
- 模块 `bytes` 沿用共享分析的最大已知单份体积口径；缺失贡献时可使用原始体积估算。`estimatedSavingBytes` 不是保证可删除的字节，`hasIndependentPackage` 提示可能必须保留隔离。未记录大小的产物返回 `size: null`，摘要与包行的 `unmeasuredFiles` 标明未计入字节总量的文件。
- 预算复用构建侧的文件去重、分包 `packageBytes` 覆盖与 `runtimeBytes` 限额。摘要分别返回 `totalBudget`、`runtimeBudget`（未配置时为 `null`）和仅统计包的 `packageBudgets`；缺失体积或运行时归因时状态为 `unknown`，包查询支持 `budgetStatus: "unknown"`。`measurement` 区分 `file-bytes`、`upper-bound` 与 `unavailable`；运行时混合 chunk 的文件上界不是精确运行时代码量。摘要及包行的预算对象不附带全量 `files` 数组，须通过产物查询继续定位。
- 比较的 `scope` 为 `package`、`file` 或 `module`，可筛选 `packageId`、`change`、`query`。包筛选在模块归并前生效，`totals` 始终表示整个构建的产物总量。模块差异基于已记录的模块体积贡献并按来源身份归并；资源文件变化可用 `file` 查询。模块与文件增量不能相加。没有上次报告时返回 `available: false`、`totals: null`，不假造零基线。
- 比较中的缺失测量不视为零：对应 `currentBytes`／`previousBytes` 与 `deltaBytes` 返回 `null`，仍存在但不可判断增减的行标为 `change: "unmeasured"`（两边都缺失时也返回）。新增／删除保留成员变化，哪怕字节为零或未知。`totals.currentUnmeasuredFiles`／`previousUnmeasuredFiles` 标明完整性；任一文件未测量时，该侧总量和总增量为 `null`。列表先按已知增量绝对值排序，再列出未测量行。
- 事件支持 `kind`、`level`、精确 `source`、文本 `query` 和含时区的 ISO `since`／`until`（包含边界），按 ISO `occurredAt` 记录时间筛选，不比较本地化显示时间。事件独立于构建 revision；最多保留 24 条，`total` 是当前窗口的匹配数，`retention` 返回容量、保留数、实际丢弃数和最早保留时间。它不是持久历史，也不是小程序 console/network。
- 文件 `range` 使用零起始 UTF-16 码元偏移，`limit` 为 1–16384；返回 `totalCharacters` 与可继续读取的 `nextOffset`。`size` 仍是完整文件的 UTF-8 字节数。EOF 偏移返回空片段，超出 EOF 拒绝；省略 `range` 保留页面所需的全文读取。片段读取不会绕过单文件 2 MiB、报告 allowlist、根目录和符号链接限制。
- 源码是受限的实时磁盘读取；产物只来自当前分析快照，不回退到实时 `dist`，也不提供上一快照的文件内容。只有确需导出完整报告时才按描述符 `pages` 依次拼接 JSON 文本页。

证据查询复用同一份报告与读取边界；预算、重复分析和比较由浏览器安全的 `weapp-vite/dashboard/analyze` 纯计算入口统一提供，UI、MCP 与 Markdown 报告不另建分析服务。该入口导出 `createAnalyzeBudgetCheck`、`createDuplicateModuleInsights`、`createAnalyzeComparison` 及对应类型。新增的四个调查动作只写任务元数据；MCP 不提供通用 shared-state、任意文件写入或命令执行。

直接使用 Streamable HTTP 时，地址为 `http://127.0.0.1:<port>/__weapp-vite/__mcp`，不需要 `Authorization`，但必须发送规范 loopback `Origin`，例如 `http://127.0.0.1:<port>`。MCP 协议请求（POST / GET / DELETE）缺少或携带不合法的 Origin，或 socket 对端非 loopback / 无法识别时返回 403；`Forwarded` / `X-Forwarded-For` 等请求头不能替代真实连接对端。OPTIONS 预检由 Vite 原生 CORS 处理，可能返回空的 204；它不执行 MCP 工具，也不放宽后续协议请求的门禁。

该模式信任同机进程，不区分本机用户。不要通过代理、隧道或端口转发对外发布 Dashboard：本机代理会使远端请求表现为本机连接。共享机器上需要身份隔离时，应使用具有相应认证策略的宿主，而不是将独立 Dashboard 当作用户级权限边界。

嵌入 Vite DevTools 时，同一份定义可由宿主的 MCP 暴露，但认证、Origin、共享状态和发现策略仍由宿主配置持有；独立 Dashboard 的本机策略不会打开或收窄共享宿主的 MCP。

#### 调查、授权与复验

1. 在 Dashboard「对象检查」中选择真实包、产物或模块落点，创建并编辑调查。提交绑定 `{ sessionId, revision, reportHash }`、目标和问题；后续浏览其他对象不会改绑草稿。仅有模块落点但没有对应真实产物时，不提供调查提交或内容读取。
2. 外部客户端先取得状态与任务，再用当前 `id`、`version` 领取。保存领取响应中的 `claimToken`，不要写入共享上下文；它不会出现在列表、状态通知或复制文本中。`agentName` 是自报名称，不是认证身份或在线心跳。
3. 使用证据查询调查，再回传 `proposal: { summary, changes: [{ path, description }], checks, risks }`。至少列出一项变更与一项检查；提议的检查不是已执行结果。浏览器展示路径、风险和服务端生成的提案 ID，用户勾选并明确授权该提案；替换提案、报告变化或任务版本变化后不能沿用旧确认。
4. 客户端重新读取任务版本，再调用 `start-investigation`。成功仅记录本次提案的执行意图；文件和命令权限仍须由外部工作区单独授予。真正执行发生在外部，Dashboard 不运行命令，也不会因为复制上下文或提交任务而启动 Agent。
5. 执行后回传 `receipt: { outcome, summary, changedFiles, checks: [{ command, outcome, summary }] }`。顶层 `outcome` 为 `completed` 或 `failed`，检查结果为 `passed`、`failed` 或 `not-run`。浏览器将这些内容标为 Agent 自报，不把它们当作独立验证。
6. 回报完成后，在同一宿主生成更新报告，实际检查对象和行为，再由浏览器提交复验摘要与明确确认。原报告、缺少摘要或未确认时不能复验。对象已从新报告删除时，复验测量为 `null`，不把缺失当作零字节；新报告本身也不证明修复或节省量。

创建、取消、授权和复验只向浏览器 RPC 开放，不列入 Agent 工具，猜测工具名也不能调用。所有已有任务变更使用 `id`／`version` 比较并更新；冲突后重新取权威状态，不盲目重放变更。调查变更有独立版本，不递增构建 revision。

报告更新会将尚未开始执行的提交、领取、提案或授权置为 `stale`，撤销旧领取与授权；执行中及已有回报保留原报告绑定。取消只停止接受本任务的后续回报，不能终止外部进程或撤销文件修改。任务保存在宿主会话内，最多 32 项；最旧已结束记录可能被移除，活动任务占满时拒绝新增，不是持久审计库。

「浏览器授权」是协议入口与明确确认的区分，不是不可伪造的人类身份或操作系统权限隔离。同机进程的信任边界仍适用。报告 hash 固定报告内容，不固定实时源码；原始产物、Gzip、Brotli、模块归因和源码字节必须分开解释，不能相加或推导虚假的优化收益。


## 2. 快速接入客户端

如果你的目标不是“研究 MCP 地址”，而是尽快让 AI 工具开始可用，推荐直接使用下面这组命令：

### 2.1 直接生成客户端配置（推荐）

当前版本优先支持：

1. `Codex`
2. `Claude Code`
3. `Cursor`

推荐命令：

```bash
wv mcp init codex
wv mcp init claude-code
wv mcp init cursor
```

行为说明：

1. 先预览将写入的配置片段。
2. 再询问是否写入客户端配置文件。
3. 写入后提示执行 `wv mcp doctor <client>` 做检查。

只想打印配置、不写入文件时：

```bash
wv mcp print codex
wv mcp print claude-code
wv mcp print cursor
```

检查配置是否已经可用：

```bash
wv mcp doctor codex
wv mcp doctor claude-code
wv mcp doctor cursor
```

默认情况下，`init/print` 会生成“由 AI 客户端直接拉起 `wv mcp`”的命令型配置。

### 2.2 HTTP 模式接入

如果你已经通过 `pnpm dev`、`wv dev` 或手动 `wv mcp --transport streamable-http` 启动了 MCP HTTP 服务，也可以直接生成 HTTP 配置：

```bash
wv mcp init codex --transport http
wv mcp init claude-code --transport http
wv mcp init cursor --transport http
```

如果自动探测到的地址不是你要的，可以显式指定：

```bash
wv mcp init codex --transport http --url http://127.0.0.1:3088/mcp
```

### 2.3 配置文件落点

当前默认写入位置：

1. `Codex`: `~/.codex/config.toml`
2. `Claude Code`: 项目根目录 `.mcp.json`
3. `Cursor`: 项目根目录 `.cursor/mcp.json`

`Codex` 使用受管区块写入，避免覆盖用户其他 MCP 配置；`Claude Code` 和 `Cursor` 则按项目维度写入，更适合跟仓库一起协作。

## 3. 启动方式

### 3.0 CLI 自动启动（默认关闭）

默认情况下，`weapp-vite` 不会在 CLI 启动时自动拉起 MCP 服务。
如果你希望开发命令执行时自动拉起本地 MCP HTTP 服务（`streamable-http`），可在 `vite.config.ts` 显式开启：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: {
      enabled: true,
      autoStart: true,
    },
  },
})
```

默认地址：

- `http://127.0.0.1:3088/mcp`

完全关闭 MCP：

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    mcp: false,
  },
})
```

### 3.1 CLI 启动

在 monorepo 根目录或任意子目录执行：

```bash
weapp-vite mcp
```

可选指定工作区根路径：

```bash
weapp-vite mcp --workspace-root <repo-root>
```

以 HTTP 方式手动启动：

```bash
weapp-vite mcp --transport streamable-http --host 127.0.0.1 --port 3088 --endpoint /mcp
```

说明：

1. 不传 `--workspace-root` 时，会从当前目录向上自动定位 `pnpm-workspace.yaml`。
2. `--transport stdio` 通过标准输入输出通信，不会启动 HTTP 端口。
3. `--transport streamable-http` 会启动本地 HTTP 服务，可供支持 URL 连接的 MCP Client 使用。
4. HTTP 模式默认校验 `Host` 与 `Origin`，用于阻止本地服务的 DNS rebinding；推荐保持监听在 `127.0.0.1`。

### 3.2 程序化启动

`weapp-vite` 暴露了 `weapp-vite/mcp` 子路径，可直接在 Node 脚本中使用。

```ts
import { startWeappViteMcpServer } from 'weapp-vite/mcp'

await startWeappViteMcpServer({
  workspaceRoot: process.cwd(),
})
```

如果你需要自定义生命周期，继续通过 `weapp-vite/mcp` 即可：

```ts
import { startStdioServer } from 'weapp-vite/mcp'

await startStdioServer({
  workspaceRoot: process.cwd(),
})
```

如果你需要手动控制 `stdio` / `streamable-http` 两种 transport，也可以直接调用：

```ts
import { startWeappViteMcpServer } from 'weapp-vite/mcp'

const handle = await startWeappViteMcpServer({
  workspaceRoot: process.cwd(),
  transport: 'streamable-http',
  host: '127.0.0.1',
  port: 3088,
  endpoint: '/mcp',
})

await handle.close?.()
```

## 4. 客户端接入示例

以下是通用的 MCP Client `stdio` 配置示例。通常优先使用 `wv mcp init <client>` 自动生成，不再建议手写：

```json
{
  "mcpServers": {
    "weapp-vite": {
      "command": "weapp-vite",
      "args": [
        "mcp",
        "--workspace-root",
        "<repo-root>"
      ]
    }
  }
}
```

如果你是仓库开发者，也可以直接指向本地脚本命令（例如 `pnpm` 脚本）来启动同一服务。

## 5. 可用 Tools

1. `workspace_catalog`
2. `list_source_files`
3. `read_source_file`
4. `search_source_code`
5. `run_package_script`
6. `run_weapp_vite_cli`
7. `run_repo_command`
8. `take_weapp_screenshot`
9. `compare_weapp_screenshot`
10. `weapp_devtools_connect`
11. `weapp_devtools_route`
12. `weapp_devtools_active_page`
13. `weapp_devtools_page_stack`
14. `weapp_devtools_capture`
15. `weapp_devtools_host_api`
16. `weapp_devtools_console`
17. `weapp_runtime_find_node` / `weapp_runtime_find_nodes` / `weapp_runtime_wait_node`
18. `weapp_runtime_wait`
19. `weapp_runtime_page_state` / `weapp_runtime_update_page_state` / `weapp_runtime_invoke_page`
20. `weapp_runtime_tap_node` / `weapp_runtime_input_node`
21. `weapp_runtime_component_state` / `weapp_runtime_update_component_state` / `weapp_runtime_invoke_component`
22. `weapp_runtime_find_child` / `weapp_runtime_find_children`
23. `weapp_runtime_node_markup` / `weapp_runtime_node_styles` / `weapp_runtime_node_attrs` / `weapp_runtime_scroll_node` / `weapp_runtime_measure_node`
24. `weapp_runtime_find_node_by_xpath` / `weapp_runtime_find_nodes_by_xpath`

建议使用顺序：

1. 先调用 `workspace_catalog` 获取可操作包与脚本。
2. 再用 `search_source_code` / `read_source_file` 做定位。
3. 最后用 `run_package_script` 或 `run_repo_command` 做验证。

## 6. 可用 Resources

1. `weapp-vite://workspace/catalog`
2. `weapp-vite://docs/{package}/README.md`
3. `weapp-vite://docs/{package}/CHANGELOG.md`
4. `weapp-vite://source/{package}?path={path}`

`{package}` 目前支持：

1. `weapp-vite`
2. `wevu`
3. `wevu-compiler`

## 7. 可用 Prompts

1. `plan-weapp-vite-change`
2. `debug-wevu-runtime`
3. `inspect-mini-program-page`
4. `recover-mini-program-connection`

典型用途：

1. 需求改造前先生成实施计划。
2. `wevu` 生命周期或响应式问题排查时快速建立诊断框架。

## 8. 安全边界与限制

MCP 服务端做了以下约束：

1. 文件访问限制在工作区根目录内，阻止路径越界。
2. 命令执行限制在白名单：`pnpm/node/git/rg`。
3. 命令与文件读取有输出截断与超时控制，避免上下文爆炸。
4. HTTP 入口校验本地主机 `Host` 与 `Origin`，阻止浏览器跨站访问和 DNS rebinding。

建议在 CI 或团队环境中继续加上外层沙箱策略（容器、只读挂载、命令审计）。

## 9. AI 直达工具

除了通用的 `run_weapp_vite_cli`，MCP 还提供了更适合 AI 直接命中的显式工具：

1. `take_weapp_screenshot`
   - 用于“小程序截图 / 页面快照 / runtime screenshot”语义
   - 等价于执行 `weapp-vite screenshot --json ...`
2. `compare_weapp_screenshot`
   - 用于“截图对比 / diff / baseline / 视觉回归 / 像素对比”语义
   - 等价于执行 `weapp-vite compare --json ...`

推荐让 AI 优先选择这两个显式工具，而不是先拼通用 CLI 参数。这样命中率和结果一致性会更高。

## 10. 故障排查

1. `wv mcp init <client>` 写入失败：先确认目标配置文件可写。
2. `wv mcp doctor <client>` 失败：优先看配置文件里是否已经生成 `weapp-vite-*` server 条目。
3. `weapp-vite mcp` 启动失败：确认 Node 版本符合 `^22.18.0 || ^24.11.0 || >=26.0.0`。
4. AI 看不到包内容：检查 `--workspace-root` 是否指向正确仓库根目录。
5. 命令执行失败：确认命令在白名单中，并检查子目录权限与脚本名是否存在。

## 11. 示例：AI 驱动 weapp-vite screenshot 验收

下面给一个简化版示例：只给 AI 一段提示词，让它通过 MCP 自动执行构建与截图验收。

前置条件：

1. 客户端已接入 `weapp-vite` MCP。
2. 微信开发者工具已登录，并开启「设置 -> 安全设置 -> 服务端口」。

### 11.1 可直接复制的提示词

```text
你现在连接的是 weapp-vite MCP。请帮我完成一次小程序截图验收：
1. 先阅读 node_modules/weapp-vite/dist/docs/index.md 和 node_modules/weapp-vite/dist/docs/mcp.md，确认当前版本的本地说明。
2. 构建 e2e-apps/auto-routes-define-app-json（platform=weapp）。
3. 执行 weapp-vite screenshot，参数如下：
   - project: e2e-apps/auto-routes-define-app-json/dist/build/mp-weixin
   - page: pages/home/index
   - output: .tmp/mcp-screenshot.png
   - 使用 --json 返回结果
4. 检查 .tmp/mcp-screenshot.png 是否存在：
   - 存在输出 screenshot-ok
   - 不存在输出 screenshot-missing
5. 最后汇总：执行命令、关键输出、最终结论。
```

### 11.2 期望结果

1. AI 输出 `screenshot-ok`。
2. 工作区生成 `.tmp/mcp-screenshot.png`。
3. AI 输出本次验收摘要（命令、关键日志、结论）。

## 12. 示例：AI 驱动 screenshot compare 验收

如果提示词里出现“截图对比 / baseline / diff / 视觉回归”，应优先让 AI 使用 `compare_weapp_screenshot`，或退回到 `weapp-vite compare`。

```text
你现在连接的是 weapp-vite MCP。请帮我完成一次小程序截图对比验收：
1. 先阅读 node_modules/weapp-vite/dist/docs/index.md、node_modules/weapp-vite/dist/docs/ai-workflows.md 和 node_modules/weapp-vite/dist/docs/mcp.md。
2. 构建 e2e-apps/auto-routes-define-app-json（platform=weapp）。
3. 执行截图对比：
   - projectPath: e2e-apps/auto-routes-define-app-json/dist/build/mp-weixin
   - page: pages/home/index
   - baselinePath: .screenshots/baseline/home.png
   - diffOutputPath: .tmp/mcp-home.diff.png
   - maxDiffPixels: 100
4. 如果命令通过，输出 compare-ok；如果对比失败，输出 compare-failed。
5. 最后汇总：执行命令、关键输出、最终结论。
```

## 验收任务

现有服务提供 weapp_project_inspect、weapp_acceptance_start/status/cancel/report，无需模型 Key。验收与其他运行操作按工程互斥；任务使用独立日志订阅。HTTP 请求共享任务服务，断开单次请求不会丢失任务；服务关闭保存取消结果，重启不重放交互。
