# @weapp-vite/dashboard

`@weapp-vite/dashboard` 是 `weapp-vite` 调试 UI 的可选前端包。

它负责承载 `weapp-vite --ui` 的前端可视化界面，本身不直接参与小程序构建；只有当用户显式安装这个包后，`weapp-vite analyze`、`weapp-vite build --ui`、`weapp-vite dev --ui` 才会自动发现并启动页面。

未安装时，`weapp-vite` 会：

- 提示对应包管理器的安装命令
- 自动降级为仅输出文本或 JSON 分析结果
- 不再因为缺少 dashboard 资源而报错中断

## 安装

按当前项目使用的包管理器安装即可：

```bash
pnpm add -D @weapp-vite/dashboard
```

```bash
npm install -D @weapp-vite/dashboard
```

```bash
yarn add -D @weapp-vite/dashboard
```

```bash
bun add -d @weapp-vite/dashboard
```

## 使用方式

安装后，直接使用 `weapp-vite` 主包的分析命令：

```bash
weapp-vite analyze
```

或在构建/开发时启用分析：

```bash
weapp-vite build --ui
weapp-vite dev --ui

# 兼容旧参数
weapp-vite build --analyze
weapp-vite dev --analyze
```

`weapp-vite` 会在运行时检查当前项目中是否安装了 `@weapp-vite/dashboard`。如果存在，就读取本包 `dist/` 中的静态资源并启动本地 DevTools 页面。

独立 Dashboard 的页面与 Devframe 1.1 bridge 共同挂载在 `/__weapp-vite/` 下（[上游更新日志](https://github.com/devframes/devframe/releases/tag/v1.1.0)、[1.0 迁移说明](https://github.com/devframes/devframe/blob/v1.1.0/docs/content/7.migrations/0.migration-1.0.md)）：

- Analyze 数据通过带 revision、SHA-256 描述符和固定页上限的只读 RPC 分页获取
- revision 与最近运行事件通过服务端单向通知同步；WebSocket 断开后会重连并重新查询权威状态
- Dashboard 不创建可由客户端回写的业务 shared state；独立宿主额外拒绝通用 shared-state set/patch，共享宿主不会覆盖这些全局 RPC
- 源码读取保留当前报告 allowlist、符号链接和读取竞态防护；产物文本来自当前分析 revision 的只读快照，不回退到实时 `dist`
- 单文件上限为 2 MiB，当前 revision 的产物保留预算按原始字节计为 32 MiB；超限明确报错，不读取其他 revision 或磁盘上的替代内容
- 独立宿主显式启用 OTP 与 loopback Origin 门禁；终端会输出可直接打开的 magic link
- 页面不再依赖 HTML 全局变量、业务 SSE 或 Vite HMR 作为业务数据通道
- 独立宿主自动在同一端口开放本机只读 MCP，无需配置令牌；校验真实 loopback 连接对端与规范 loopback Origin，不暴露通用 shared-state 工具

前端使用 Devframe 的已有连接继承与相对元数据发现，不再写死独立 bridge 地址。路由和复制视图链接保留实际挂载前缀；复制链接仅包含页面路径与查询参数，不携带认证 fragment。`devframe connect --base` 是 MCP connector 的探测选项，不是 Dashboard 的挂载配置。

微信开发者工具继续负责模拟器、原生调试和真机能力；Dashboard 是构建、HMR、包体、诊断和自动化状态的伴随 DevTools。

### AI 读取当前 Dashboard

独立 Dashboard 的三个只读查询同时提供 DevFrame MCP schema 与 `structuredContent`：`weapp-vite_get-dashboard-state`、`weapp-vite_get-analyze-page`、`weapp-vite_read-dashboard-file`。页面与工具共用报告 revision、事件与文件读取边界，不启动另一份分析服务或 IDE 会话。

在项目中安装 `devframe@1.1.0` 与 `@devframes/agentic@1.1.0` 后，可使用 `pnpm exec devframe connect` 发现正在监听的实例，无需配置认证环境变量。直接 HTTP 地址为 `/__weapp-vite/__mcp`；浏览器仍使用 OTP 授权。关闭 / 重启清理旧实例记录。本机模式信任同机进程，不区分本机用户；不要通过代理、隧道或端口转发对外发布 Dashboard。

完整客户端配置、`arg0` 参数与分页顺序见 [MCP 使用指南](../weapp-vite/docs/mcp.md#dashboard-实时只读工具devframe)。既有 `wv mcp` / REST / 微信 IDE 自动化不受影响。嵌入 Vite DevTools 时仍由宿主决定 MCP、认证和发现策略，不能把共享宿主视为只读沙箱。


## 体积地图工作台

- 图表与节点详情同屏显示；窄屏时详情排在图表下方。可点击图块，也可用详情列表搜索、逐级选择小节点；面包屑和列表支持键盘操作。
- “显示”控制节点范围，“着色”独立选择所属分包、模块来源、重复打包或构建增量。换色不会改变当前筛选范围和图块面积；图例说明当前颜色含义。
- 工具栏下拉将标签和值放在同一个轻量触发器内；选项统一左对齐，右侧勾号标明当前选择。方向键移动、Enter 确认、Escape 取消，禁用项不会被键盘选中。
- “查重复”同时启用重复筛选和重复着色。重复按同一个模块 ID 出现在不同包中判断，不把同包多次引用、同名路径或多个 query 变体合并成跨包重复。
- “看增长”使用当前选中的基线或上次构建，只显示增长部分。增量比较同一包、文件、模块位置的已记录产物字节；缺失体积标为未知，新增单独标记，不用原始源码体积替代。没有比较快照时入口禁用；已删除节点不出现在当前产物图中。
- 详情区保留完整路径、模块 ID、所属包、实际产物大小和已记录模块贡献。模块贡献不等于独立文件大小；缺失贡献时图块可能使用原始模块体积估算，详情会明确区分。
- 详情标题在滚动时保留节点身份；子节点、跨包位置和各类引用可分别折叠，支持 Enter / Space。关闭的分组只有在相关内容实际变化时才显示“有更新”，打开后清除；同值报告、无关包更新和筛选 / 着色 / 列表搜索不会触发未读。
- 后台报告更新不会主动滚动或移动焦点。显式展开超出可视区域的分组时才调整所属滚动容器；后续切换、收起或手动滚动优先。通过详情列表导航后，焦点回到新节点标题，详情从头显示。
- 引用与被引用来自报告中的静态 / 动态 import；模块的跨包位置不是源码级依赖图。无法唯一定位的引用仅展示文本，点击当前筛选之外的已知产物会先恢复全部范围。
- “查看源码与产物”复用只读源码对比，支持所有报告产物，不受概览 Top Files 数量限制；从模块进入时选择对应源码。第三方依赖不提供工作区源码入口，生成文件或已移除的源码仍可能返回明确的“文件不存在”提示，不回退到其他文件。
- 当前体积地图的选择会随报告更新按节点身份保留；节点移除时回到所属包，包被移除时恢复全部范围。

## 宿主无关的 Devframe 核心

分层参考 [Pinia Colada 的 Devframe 定义与宿主入口](https://github.com/posva/pinia-colada/tree/2f181cbcf5e1a9a9ce06599ae14acdedc24b48d3/devtools/src)，通过 [Vite DevTools 官方适配器](https://devtools.vite.dev/kit/devtools-plugin) 挂载同一份定义，而不是另建 Dashboard、RPC 协议或多 target 框架。

| 职责 | 入口 | 边界 |
| --- | --- | --- |
| 报告生产 | 现有 analyze/build/dev 调用方 | 编译、历史持久化和产物捕获在发布前完成 |
| 共享核心 | `weapp-vite/dashboard` | 持有报告、当前产物、运行事件、revision 与 scoped 只读 RPC，不启动服务器 |
| 独立宿主 | CLI 的 `startAnalyzeDashboard` | 选择源码或静态页面，持有 Vite、OTP、退出信号与独立只读策略 |
| Vite DevTools 宿主 | `weapp-vite/dashboard/vite` | 使用 `createPluginFromDevframe`，复用现有宿主端口与传输，关闭时释放核心 |
| 前端 | `@weapp-vite/dashboard` | 同一份原生 Vite 构建的 SPA，不导入 Node 核心 |

`createAnalyzeDashboardDevframe` 返回 `definition`、`update`、`emitRuntimeEvents` 和 `dispose`。每个控制器对应一个宿主生命周期；提交后的报告与产物 Map 不得继续修改。报告更新先完成报告、产物、事件和 revision 的一致切换，再发送一次通知；事件更新不会改变报告 revision。`update` 完成不代表浏览器已经渲染完成。

`resolveDashboardClientAssets` 返回可选前端包已构建 SPA 的绝对目录，未安装或未构建时返回 `undefined`。独立开发宿主仍可选择源码入口；Vite DevTools 挂载必须提供已构建资源。接入步骤和完整 Node 端示例见 [weapp-vite 的嵌入接口](../weapp-vite/README.md#dashboard-嵌入-vite-devtools)。

Vite 适配器只在开发模式启用，不向生产构建导出报告，也不向小程序 AppService 注入客户端脚本。默认面板目录为 `/__weapp-vite/`；显式 `base` 与 Vite 应用自身的 `base` 独立。一个共享宿主中的其他插件仍可使用其合法的 shared-state、编辑或命令能力；Dashboard 的只读查询不构成插件之间的安全沙箱。

源码对比使用与当前报告同一次生成过程捕获的产物。完整分析从 `analyzeSubpackages` 的 `write: false` 输出捕获 chunk/asset；开发 fallback 在扫描产物生成报告时保存同一份字节。两者都不为界面补写 bundle。文件请求携带 revision，更新或关闭会拒绝旧请求及过期异步响应；产物只保留当前报告的快照，源码仍读取 allowlist 内的当前工作区文件。

`runtimeEvents` 仍是 CLI/build/HMR/diagnostic 事件，不是应用 console/network，也不自动 attach 微信 IDE、模拟器或原生设备。此次抽取只改变 DevTools 的宿主边界。


## 项目结构

当前目录按标准 Vite 应用方式组织：

```text
packages/dashboard
├── index.html
├── package.json
├── src
│   ├── App.vue
│   ├── env.d.ts
│   ├── main.ts
│   ├── router.ts
│   ├── style.css
│   ├── types.ts
│   ├── useTreemapData.ts
│   └── pages
│       └── index.vue
├── tsconfig.json
├── vite.config.test.ts
├── vite.shared.ts
└── vite.config.ts
```

说明：

- `src/pages/`：文件路由页面目录
- `src/router.ts`：基于 `vue-router` 的路由入口
- `src/types.ts`：仪表盘使用的分析结果类型
- `src/useTreemapData.ts`：Treemap 数据整理逻辑
- `dist/`：发布到 npm 的静态产物目录

## 技术栈

- `vite`
- `vue`
- `vue-router`
- `echarts`
- `tailwindcss`
- `weapp-tailwindcss`（Web generator）
- `devframe`

## 开发

源码构建使用的 `weapp-tailwindcss` 需要 Node.js `^22.18.0 || >=24.11.0`。发布包只包含预构建的静态资源，不会把该开发依赖带入用户运行时。

在仓库根目录执行：

```bash
pnpm --filter @weapp-vite/dashboard dev
```

该命令只适合检查空态和组件。验证真实 Devframe、Analyze 和运行事件链路时使用：

```bash
pnpm --filter dashboard-ui-lab dev:ui
```

生产构建：

```bash
pnpm --filter @weapp-vite/dashboard build
```

Tailwind 配置矩阵与构建性能对照：

```bash
pnpm benchmark:dashboard-tailwind
```

该命令使用独立 Node 进程构建相同 dashboard，比较 `@tailwindcss/vite`、完整 `weapp-tailwindcss/vite`、Generic Web 最小配置和 source candidate 消融场景。结果校验 selector、class、Iconify 图标与 CSS 变量，并报告多轮中位数；不设置固定耗时或 CSS 字节阈值。

## 发布约束

`@weapp-vite/dashboard` 与 `weapp-vite` 共享版本节奏。

仓库里的 changeset 规则已经要求：

- `weapp-vite` 发版时，`@weapp-vite/dashboard` 必须一起发版
- `@weapp-vite/dashboard` 发版时，`weapp-vite` 也必须一起发版
- 两者的 bump 类型必须一致

这样可以保证：

- 主包提示安装的版本与 dashboard 包保持一致
- CLI 的运行时发现逻辑不会因为版本漂移而出问题
- 文档与实际安装体验一致
