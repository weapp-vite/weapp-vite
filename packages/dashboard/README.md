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

Dashboard 通过挂载在 `/__weapp-vite/` 下的 Devframe 1.0 bridge 连接 CLI（[上游迁移说明](https://github.com/devframes/devframe/blob/v1.0.0/docs/content/7.migrations/1.migration-0.10.md)）：

- Analyze 数据通过带 revision、SHA-256 描述符和固定页上限的只读 RPC 分页获取
- revision 与最近运行事件通过服务端单向通知同步；WebSocket 断开后会重连并重新查询权威状态
- Dashboard 不创建可由客户端回写的业务 shared state，并拒绝通用 shared-state set/patch
- 源码与产物内容通过按 revision 缓存的 allowlist RPC 读取，拒绝符号链接、读取竞态和超过 2 MiB 的文件
- Devframe 显式启用 OTP 与 loopback Origin 门禁；终端会输出可直接打开的 magic link
- 页面不再依赖 HTML 全局变量、业务 SSE 或 Vite HMR 作为业务数据通道
- bridge 保持 `mcp: false`，不加载可选的 `@devframes/agentic`；仓库现有 MCP 服务不经由这个 bridge 提供

微信开发者工具继续负责模拟器、原生调试和真机能力；Dashboard 是构建、HMR、包体、诊断和自动化状态的伴随 DevTools。

## 面向 App 与小程序的演进边界

当前页面仍是单项目构建工作台，不是跨设备调试器。`runtimeEvents` 记录的是 CLI/build/HMR/diagnostic 事件，不是被调试应用的 console 或 network 流；前后端也尚未建立 target identity、能力协商和多会话生命周期协议。

当前还有一个已在 `dashboard-ui-lab dev:ui` 观察到的产物一致性限制：`analyzeSubpackages` 以 `write: false` 生成分析结果，而文件读取使用实际开发构建的 `outDir`。两次构建的 chunk 划分可能不同，导致报告中的文件（例如 `weapp-vendors/common.js`）并未落在该目录，源码对比因此显示“文件不存在”。这不是 Devframe 1.0 升级引入的变化；它属于分析快照与产物内容的 ownership 缺口，不能通过放宽 allowlist、隐藏错误或手工写回 bundle 修补。

接入新 target 前，应先让每个分析 revision 持有与其报告一致的产物内容，并区分分析构建与实际运行构建的身份；源码对比必须读取对应快照，而不是按同名文件猜测当前 `dist`。在完成这条一致性链路前，不把当前页面宣称为完整的运行时 DevTools。

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
- 工作台直接依赖已升级至 Devframe 1.0；`@vitejs/devtools-kit` 的传递依赖仍使用自己的 Devframe/Hub 0.8。当前 bridge 独立运行，不强制覆盖上游 peer 版本；未来接入其 Hub 前需要先统一兼容契约。
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
