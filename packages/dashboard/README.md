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

Dashboard 通过挂载在 `/__weapp-vite/` 下的 Devframe 1.1 bridge 连接 CLI（[上游更新日志](https://github.com/devframes/devframe/releases/tag/v1.1.0)、[1.0 迁移说明](https://github.com/devframes/devframe/blob/v1.1.0/docs/content/7.migrations/0.migration-1.0.md)）：

- Analyze 数据通过带 revision、SHA-256 描述符和固定页上限的只读 RPC 分页获取
- revision 与最近运行事件通过服务端单向通知同步；WebSocket 断开后会重连并重新查询权威状态
- Dashboard 不创建可由客户端回写的业务 shared state，并拒绝通用 shared-state set/patch
- 源码读取保留当前报告 allowlist、符号链接和读取竞态防护；产物文本来自当前分析 revision 的只读快照，不回退到实时 `dist`
- 单文件上限为 2 MiB，当前 revision 的产物保留预算按原始字节计为 32 MiB；超限明确报错，不读取其他 revision 或磁盘上的替代内容
- Devframe 显式启用 OTP 与 loopback Origin 门禁；终端会输出可直接打开的 magic link
- 页面不再依赖 HTML 全局变量、业务 SSE 或 Vite HMR 作为业务数据通道
- bridge 保持 `mcp: false`，不加载可选的 `@devframes/agentic`；仓库现有 MCP 服务不经由这个 bridge 提供

从 1.0.0 升级到 1.1.0 无需改写当前 `initDevframe`、`connectDevframe`、scoped RPC 和 OTP 调用。新版 `devframe connect --base` 用于 MCP connector 的非根路径探测，不是 Dashboard 的 `base` / `baseURL` 配置替代品；当前 bridge 仍禁用 MCP。Hub 的 Windows 进程清理、面板主题与快捷键修复属于上游 Hub 层，不代表当前独立工作台新增了这些能力。

微信开发者工具继续负责模拟器、原生调试和真机能力；Dashboard 是构建、HMR、包体、诊断和自动化状态的伴随 DevTools。

## 体积地图工作台

- 图表与节点详情同屏显示；窄屏时详情排在图表下方。可点击图块，也可用详情列表搜索、逐级选择小节点；面包屑和列表支持键盘操作。
- “显示”控制节点范围，“着色”独立选择所属分包、模块来源、重复打包或构建增量。换色不会改变当前筛选范围和图块面积；图例说明当前颜色含义。
- “查重复”同时启用重复筛选和重复着色。重复按同一个模块 ID 出现在不同包中判断，不把同包多次引用、同名路径或多个 query 变体合并成跨包重复。
- “看增长”使用当前选中的基线或上次构建，只显示增长部分。增量比较同一包、文件、模块位置的已记录产物字节；缺失体积标为未知，新增单独标记，不用原始源码体积替代。没有比较快照时入口禁用；已删除节点不出现在当前产物图中。
- 详情区保留完整路径、模块 ID、所属包、实际产物大小和已记录模块贡献。模块贡献不等于独立文件大小；缺失贡献时图块可能使用原始模块体积估算，详情会明确区分。
- 引用与被引用来自报告中的静态 / 动态 import；模块的跨包位置不是源码级依赖图。无法唯一定位的引用仅展示文本，点击当前筛选之外的已知产物会先恢复全部范围。
- “查看源码与产物”复用只读源码对比，支持所有报告产物，不受概览 Top Files 数量限制；从模块进入时选择对应源码。第三方依赖不提供工作区源码入口，生成文件或已移除的源码仍可能返回明确的“文件不存在”提示，不回退到其他文件。
- 当前体积地图的选择会随报告更新按节点身份保留；节点移除时回到所属包，包被移除时恢复全部范围。

## 面向 App 与小程序的演进边界

当前页面仍是单项目构建工作台，不是跨设备调试器。`runtimeEvents` 记录的是 CLI/build/HMR/diagnostic 事件，不是被调试应用的 console 或 network 流；前后端也尚未建立 target identity、能力协商和多会话生命周期协议。

源码对比使用与当前报告同一次生成过程采集的产物文本。完整分析从 `analyzeSubpackages` 的 `write: false` 构建输出捕获 chunk/asset；开发模式 fallback 则在扫描 `dist` 生成报告时保存本次读到的同一份字节，并丢弃失败分析的部分捕获。静态 `analyze`、`build --ui`、`dev --ui` 和 fallback 都随报告提交对应快照，不会为界面补写 bundle。

文件请求携带当前显示的 revision，报告更新会拒绝旧请求与过期异步响应；即使文件路径未变，对比面板也会重新读取。产物只保留当前报告对应的快照，不写入历史 JSON，也不证明目标设备正在运行的构建版本；源码仍读取工作区当前文件，不承诺历史源码快照。这条一致性链路不替代下述 target identity 和运行时 adapter。

| 目标 | 当前可复用部分 | 尚缺的边界 |
| --- | --- | --- |
| 真实微信 IDE | `@weapp-vite/devtools-runtime` 与 MCP 中的 automator 会话、页面数据/WXML 和 console 读取 | Dashboard 只读 adapter、按 target 隔离的日志、显式 detach |
| Node headless / browser simulator | `mpcore` 的逻辑快照、页面操作和浏览器预览 | 各 provider 的能力声明与事件适配；不能把模拟结果当作真实 IDE 布局或宿主行为 |
| 桌面 DevTools App 外壳 | 当前 Web Dashboard 与本地 CLI bridge | 桌面打包、进程所有权、安全 IPC、导航及权限隔离 |
| 原生 iOS/Android App | Dashboard 展示层与 Devframe 连接层 | 原生 runtime/debugger adapter、设备发现、会话管理和平台能力协议 |

Web/H5 backend 和 Donut 的多端小程序配置不等于已有通用原生 App 调试目标。桌面外壳也不会自动获得原生调试能力。

如果“App/小程序版本”指工作台本身运行在手机或小程序中，当前依赖浏览器 DOM 的 Dashboard 不能直接作为小程序原生页面运行。需要另行设计 WebView 或原生 UI 容器，以及设备到开发机的连接和鉴权；当前 loopback-only bridge 不提供远程设备接入，不能靠放开监听地址替代安全设计。

推荐先落地一条只读链路：**真实微信 IDE attach → 当前页 route/data/WXML → 按会话隔离的 console → detach**。由 `packages/devtools-runtime` 持有窄的 target contract 和 adapter，Dashboard 只消费能力声明和结构化结果；随后再分别接入 headless、browser 和原生 App adapter。不在第一步暴露 `setData`、任意宿主 API、页面方法调用或任意路径写入。

多 target/Hub 化之前需要明确以下边界：

- 协议携带 target identity、协议版本、capabilities 和会话状态；构建 revision 与运行时事件序列分开，文件读取继续受 target/project allowlist 约束。
- 当前独立 bridge 覆盖了 Devframe 通用 shared-state set/patch 并拒绝写入。这是单工具的只读策略，不能原样放进共享 Hub，否则会阻止其他 Devframe 的 shared-state 写入；需要隔离 bridge 或改为本工具范围内的权限边界。
- 工作台直接依赖已升级至 Devframe 1.1；`@vitejs/devtools-kit` 的传递依赖仍使用自己的 Devframe/Hub 0.8。当前 bridge 独立运行，不强制覆盖上游 peer 版本；未来接入其 Hub 前需要先统一兼容契约。
- 复用 automator 时区分释放引用与真正断开连接；日志订阅、缓存和清理必须归属具体 target。当前 MCP 日志池不是多 target 隔离协议，不能直接用作统一事件流。

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
