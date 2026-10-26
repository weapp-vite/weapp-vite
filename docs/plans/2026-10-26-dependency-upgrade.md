# 全仓依赖升级与迁移记录（2026-10-26）

本轮以 `b27108dc65bea33b6611ab903d3d346991873845` 为基线，覆盖 246 份自有 npm 清单、嵌套 fixture、独立 npm runner、Rust crate、pnpm 及 GitHub Actions。npm 版本查询冻结于 `2026-10-25T16:53:41.067Z`，后续安装沿用这一批版本，不随执行期间 registry 变化继续追新。

## 开发环境与兼容范围

根开发环境使用 Node.js 24.22.1 LTS、pnpm 12.15.0。受影响发布包及生成项目要求 `^22.23.4 || ^24.22.1 || >=26.12.1`；启动检查、普通消费者 CI 最低版本和当前文档同步。Vite+ 仍仅支持 Node 24/26，因此其范围为 `^24.22.1 || >=26.12.1`。显式固定的性能目标及历史报告保留原有版本，不重新采样冻结性能证据。

Bun 按 `process.versions.bun` 识别为独立运行时。Bun 1.4.2 和 1.4.4 的 `process.versions.node` 均为兼容标识 26.3.0，不能据此套用真实 Node.js 的最低版本检查。CLI 与 Tailwind 插件只对真实 Node 应用上述 engines 范围，仍在依赖导入前拒绝不支持的 Node；prepare 容错和其他命令的原始错误传播不变。本轮没有新增 Bun 最低版本承诺。

TypeScript 编译器保持 catalog 6.0.3，历史 TypeScript fixture 保持原版；Vue、Volar、ESLint 等相关工具照常升级并通过现有编译器验证。第三方 Dimina upstream 快照、历史 benchmark、专用旧版复现 fixture 不改。现有预发布依赖不降级，弃用的类型 stub 不视为升级目标；`fixtures/ts-base` 的 `miniprogram-api-typings ^2.8.3-1` 保留历史基线。

## 调用方需要迁移的行为

### 构建队列

`context.buildService.queue` 与 `context.runtimeState.build.queue` 继续公开同一队列实例，但 p-queue 10 使用 EventTarget。原来的 `queue.on('completed', listener)` 迁移为：

```ts
function listener(event: CustomEvent<unknown>) {
  console.log(event.detail)
}
queue.addEventListener('completed', listener)
queue.removeEventListener('completed', listener)
```

一次性订阅使用 `{ once: true }`；错误事件同样从 `event.detail` 读取值。事件 detail 的公开类型为 unknown，调用方应先缩窄。`queue.add()` 仍返回任务结果的 Promise；`queue.clear()` 会以 AbortError 拒绝尚未执行的任务，调用方须处理这些 Promise。任务结果或错误值为 `undefined` 时，`CustomEvent.detail` 为 `null`。`clear()` 不中止正在执行的任务，也不会为被移除任务触发 `error` 事件；须处理 `add()` / `addAll()` 及其派生 Promise 的拒绝。新单测覆盖显式 start、reset 保留实例与监听、清空后的下一轮构建；tsd 同时覆盖两个公开入口并拒绝旧 `.on()`。

### 截图比较

pixelmatch 8 将颜色差异切换为 OKLab/HyAB。同一对 PNG 和同一 threshold 可能产生不同结果，因此这次不放宽门限、不批量重录基线。CLI 帮助及使用文档同步算法说明。颜色边界、透明像素、反锯齿和 threshold 单测覆盖新版；蓝色 255→180 的边界样本在 threshold=0.1 下，v7 统计 0 个差异像素，v8 统计 4 个，证明算法变化可被观察。首轮真实 487 张 PNG 已在相同门限下同时调用 v7/v8，两版通过判定完全一致，尺寸无错；唯一两版均失败的是 Wot UI 的桌面裁剪组件。Wot UI 2.4.0 官方 [#198](https://github.com/wot-ui/wot-ui/pull/198) 修复宽屏下 canvas 白层遮挡，已安装裁剪器的 Vue 与 SCSS 与该修复提交逐字节一致，旧图白层边界也与源码计算吻合。独立新 server/browser context 复验后，mobile 与 desktop 均与首轮 current PNG 逐字节相同；只迁移这一张 desktop 基线，保留旧图和失败报告，其余基线及门限不变。修复及单图迁移后，完整 WebB 的 17 文件、123 项全部通过；同轮新生成的 487 张 PNG 再按原门限调用 v7/v8，两版全部通过，比较错误为 0、判定变化为 0。首轮失败与独立复验在旧基线下的预期视觉失败继续保留。

## 构建、监听与发布工具

Vite 8.3.5 和 Rolldown 1.2.15 补丁从新版官方发行源码重新生成，保留环境引用释放、关闭结算和 options snapshot 契约。Rolldown 保持全锁文件单版本。新增的 `charset` 输出字段纳入快照，在 ASCII、UTF-8、默认配置、各输出 hook 和关闭后读取中验证；公开 accessor 集合也与契约清单核对，避免下次升级遗漏字段。补丁仅在本工作区安装时应用；不能据此声称普通外部 npm 消费者获得相同的 Vite/Rolldown 补丁。

Chokidar 6 重写了 watcher backend 与生命周期。自有 watcher 配置迁移至 `backend`、`pollingInterval`、`pollingBinaryInterval`；交给 Vite 的旧 watcher 配置仍遵循 Vite 类型。原有事件、ready、共享订阅、Windows 错误身份及资源清理语义继续由依赖契约验证。补丁只修复新版源码上实际复现的问题；具体修复及发行消费边界见 `patches/README.md`。

自有 sidecar watcher 通过 `build.watch.chokidar` 配置，新字段示例如下：

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: {
    watch: {
      chokidar: {
        backend: 'polling',
        pollingInterval: 100,
        pollingBinaryInterval: 300,
      },
    },
  },
})
```

`backend` 支持 `auto`、`native`、`native-recursive`、`polling`。旧 `usePolling`、`interval`、`binaryInterval` 仍可使用，同一配置源内以新字段优先。共享解析器逐字段优先读取构建配置，再读取 `server.watch`，并用环境变量补足未配置项；Chokidar 仍保留 `CHOKIDAR_USEPOLLING` 和 `CHOKIDAR_INTERVAL` 的全局覆盖语义，设置后可能覆盖显式 backend 或 pollingInterval。`server.watch` 继续采用 Vite 内置监听器的旧字段；Rolldown 原生监听选项使用 `build.watch.watcher`。公开声明从根、`/config`、`/vite` 三入口加载，两个配置入口的完整 tsd 已验证新旧字段及原生选项边界。

真实 tarball 消费者首先发现 artifact watcher 未继承 backend；随后调用点审计补齐 WXML watcher 的构建配置优先级与旧别名归一化。artifact 保存初始配置的 primitive 快照，WXML 复用共享解析器并保留 `depth: 0`、ignored、ready 与清理语义。artifact 相关 33 项、WXML 相关 25 项测试及 owning typecheck/build 均通过；真实消费者 5 项通过，Windows 专项在 macOS 不适用。WXML 有限 depth 没有复现 recursive backend 问题，不把它与 artifact 首错混为一谈。


目录重命名的 unlink/add 分批到达时，首轮完整扫描可能已包含新路径；旧回执只登记当前事件路径，会再次 reload。Web 发布现在统一复制 accepted scan 的完整路由签名和源码指纹，精确比较完整集合，支持空路由集合；虚拟模块初始化、native HMR、sidecar 共用该回执。两条在途旧宿主 load/native HMR 还会在登记前复核宿主身份，避免跨宿主消费回执。原实现的 3 个重复 reload 负例及中间实现的 2 个宿主竞态负例均保留，最终 81 项定向测试、typecheck、ESLint 与构建通过；使用重建后的发行入口，完整 WebB 中 issue #1029 的三个浏览器用例通过。原 Web 严格 reload 次数断言和 Service 公开接口不变；这些结果不替代后续小程序 HMR 或真实 IDE 验收。

repoctl 升至 6.1.0，保留仓库自定义 Husky、lint-staged 和发布流程。没有运行模板覆盖式迁移。发布回归在隔离进程中调用公开 API，不访问真实发布端点。Vitest 默认 development condition 会选中依赖的 TypeScript 源码；发布测试配置在最终 SSR resolve 阶段限定 node condition，以使用发行导出。

完整单测还发现 Vitest 5.0.5 的模块磁盘缓存未指定 UTF-8 编码，Buffer 流入字符串错误格式化路径后掩盖原始异常。最小补丁只补充读取编码；启动失败回归显式启用模块缓存，冷、暖两次都保留原始 global setup 错误和严格验收报告。

DevTools 0.8.0 原依赖范围允许 devframe 1.2.6。本轮将锁文件中的 devframe 与 10 个 @devframes 配套条目一并解析至 1.2.6，消除混装 1.2.5/1.2.6 的 peer 冲突；没有新增强制跨范围 override。

## 冻结的直接 npm 版本变更

共升级 62 种非 TypeScript 外部依赖；原有精确版本、`^`、`~`、catalog 管理方式保留。表中同名多个声明合并展示，传递依赖随父包和锁文件解析。另将 pnpm 12.11.2 升为 12.15.0。

| 依赖 | 升级前声明 | 升级后声明 |
| --- | --- | --- |
| @ai-sdk/anthropic | 4.0.82 | 4.0.88 |
| @ai-sdk/openai | 4.0.96 | 4.0.102 |
| @ai-sdk/openai-compatible | 3.0.71 | 3.0.78 |
| @babel/core | ^8.0.7 | ^8.0.9 |
| @babel/parser | ^8.0.7 | ^8.0.8 |
| @babel/types | ^8.0.6 | ^8.0.8 |
| @commitlint/cli | ^21.2.3 | ^21.2.4 |
| @devframes/agentic | 1.2.5 | 1.2.6 |
| @devframes/hub | 1.2.5 | 1.2.6 |
| @devframes/hub-ui | 1.2.5 | 1.2.6 |
| @icebreakers/eslint-config | 8.0.9 | 8.0.11 |
| @icebreakers/stylelint-config | 5.1.3 | 5.1.5 |
| @iconify-json/logos | ^1.2.16 | ^1.2.17 |
| @iconify-json/vscode-icons | ^1.2.90 | ^1.2.93 |
| @iconify/vue | ^5.0.3 | ^5.0.4 |
| @inquirer/prompts | ^8.7.3 | ^8.7.4 |
| @json-render/core | 0.21.1 | 0.21.3 |
| @modelcontextprotocol/client | ^2.3.1 | ^2.4.0 |
| @modelcontextprotocol/node | ^2.1.1 | ^2.1.2 |
| @modelcontextprotocol/server | ^2.3.1 | ^2.4.0 |
| @napi-rs/cli | ^3.10.8 | ^3.10.9 |
| @oxc-node/cli | ^0.1.7 | ^1.0.1 |
| @oxc-node/core | ^0.1.7 | ^1.0.1 |
| @oxc-project/types | ^0.154.0 | ^0.155.0 |
| @remotion/bundler | 4.0.536 | 4.0.538 |
| @remotion/cli | 4.0.536 | 4.0.538 |
| @remotion/renderer | 4.0.536 | 4.0.538 |
| @rollup/pluginutils | ^5.4.0 | ^5.5.1 |
| @swc/core | 1.16.18 / ^1.16.18 | 1.16.20 / ^1.16.20 |
| @tanstack/vue-query | ^5.104.3 | ^5.104.5 |
| @types/lodash | ^4.17.26 | ^4.17.27 |
| @types/react-reconciler | 0.34.0 | 0.34.1 |
| @typescript-eslint/parser | ^8.71.2 | ^8.72.0 |
| @volar/language-service | ^2.4.28 | ^2.4.30 |
| @volar/typescript | ^2.4.28 | ^2.4.30 |
| @wot-ui/ui | 2.3.2 | 2.4.0 |
| ai | 7.0.143 | 7.0.153 |
| chokidar | ^5.0.0 | ^6.0.0 |
| devframe | 1.2.5 | 1.2.6 |
| dotenv | ^18.0.8 | ^18.0.9 |
| es-toolkit | ^1.52.0 | ^1.53.0 |
| execa | ^10.1.1 / 10.1.1 | ^10.2.1 / 10.2.1 |
| happy-dom | ^21.0.3 | ^21.0.4 |
| hono | ^4.13.13 | ^4.13.14 |
| oxc-parser | ^0.154.0 | ^0.155.0 |
| p-queue | ^9.3.5 | ^10.0.0 |
| pixelmatch | ^7.2.0 | ^8.0.0 |
| pkg-types | ^2.3.3 | ^2.4.0 |
| postcss | ^8.5.30 | ^8.5.31 |
| postcss-selector-parser | ^7.1.6 | ^7.1.7 |
| remotion | 4.0.536 | 4.0.538 |
| repoctl | 5.10.3 | 6.1.0 |
| rolldown | 1.2.14 | 1.2.15 |
| rollup | ^4.64.8 | ^4.65.0 |
| sass | ^1.105.2 | ^1.106.1 |
| sass-embedded | ^1.105.2 | ^1.106.1 |
| tsdown | 0.23.1 | 0.23.2 |
| turbo | ^2.11.9 | ^2.11.10 |
| vite | 8.3.4 | 8.3.5 |
| vite-plus | 1.0.0 | 1.4.0 |
| wrangler | ^4.151.1 | ^4.152.0 |
| zustand | ^5.0.15 | ^5.0.16 |

## Native、独立 runner 与 Actions

JS/Rust Oxc 对齐 0.155.0，napi 3.15.0、napi-derive 3.6.13、Rust 1.99.1，其余直接 crate 按同一轮 crates.io 稳定版查询升级。native 保持可选依赖、显式启用和 JS fallback，未增加跨语言调用次数。correctness 与真实 SFC profile 使用重建后的发行入口，结果在下方记录。

直接 crate 的冻结版本如下；Rust 工具链从 1.99.0 升至 1.99.1，Cargo.lock 共更新 31 个条目。

| crate | 升级前 | 冻结后 |
| --- | --- | --- |
| napi | 3.14.2 | 3.15.0 |
| napi-derive | 3.6.12 | 3.6.13 |
| napi-build | 2.6.0 | 2.6.0 |
| oxc_allocator | 0.154.0 | 0.155.0 |
| oxc_ast | 0.154.0 | 0.155.0 |
| oxc_ast_visit | 0.154.0 | 0.155.0 |
| oxc_parser | 0.154.0 | 0.155.0 |
| oxc_semantic | 0.154.0 | 0.155.0 |
| oxc_span | 0.154.0 | 0.155.0 |
| oxc_syntax | 0.154.0 | 0.155.0 |
| serde | 1.0.229 | 1.0.229 |
| serde_json | 1.0.154 | 1.0.154 |

独立 `tools/miniprogram-ci-runner` 更新自身 npm 锁文件，miniprogram-ci 仍为执行时最新稳定版 2.1.31；npm ci 安装及 Project/preview/upload 公开 API 导入成功。2026-10-25 18:11 UTC 重新查询九个外部 GitHub Actions 的 latest stable release，并逐一解析 tag 对应提交；全部与仓库固定 SHA 相同，本次保留这些引用。

## 验证记录

原始日志保存在本任务 `.tmp/current-run/dependency-upgrade-20261026/`。该目录为本地执行证据，文档只记录可复现命令与结论；原始失败和最终结果分别保留。

| 验证 | 结果 |
| --- | --- |
| Node 24.22.1 / pnpm 12.15.0 冻结安装 | 通过，包含 lifecycle scripts；子进程通过任务 launcher 固定同一运行环境 |
| 核心包 build:pkgs 等价命令 | 45/45 通过 |
| 应用、模板、网站构建 | 77/77 通过，含依赖核心包；socket-io-chat 独立 Web/mini 两构建追加通过 |
| Node 下限、生成项目与启动检查 | 106 项通过；mpcore owning engines 追加检查 10 项通过 |
| 工作流结构契约 | 54 项通过 |
| repoctl 发布回归 | 14 文件、219 通过、1 既有跳过 |
| 公开队列、合成图像算法与 compare CLI 单测 | 最终 29 项通过，含 13 项图像边界；WebB 同轮 487 图双算法全部通过，比较错误及判定变化均为 0 |
| queue 公开 tsd | 通过 |
| 全包 typecheck | 44/44 通过；Volar 测试宿主适配后 59 项单测通过 |
| Chokidar 资源观察单测 | 39 项通过，路径单测 4 项通过 |
| Chokidar 自有 watcher 与真实安装包 | artifact 相关 33 项、WXML 相关 25 项通过；真实 tarball 消费者 5 通过、1 Windows 不适用；两个公开配置 fixture 全量 tsd 通过 |
| 完整依赖 contracts | Vite 18 项、Rolldown 8 组、完整 Chokidar 29/29 通过；ignoreInitial 原生通知边界追加 10/10 |
| Native 构建、correctness、fallback、profile | Rust 20/20、debug/release 构建、9 导出 smoke、fallback 143 项；正式新绑定 9 套 183/183、无跳过，新增 25 项真实 addon/AST 对齐；实际 SFC profile 480 样本保持输出一致。门禁新增套件清单同步后 32 项通过，其余 57 项复用未受影响证据 |
| 全单测、包测试与全公开类型 | 全公开类型 51 条命令通过，queue 目录单独通过；watcher/autoRoutes 修复后的最终完整根单测 2,173 文件、20,388 项通过，另 13 文件、20 项既有跳过，耗时 487.98 秒；源码、未跟踪文件、Git 状态及安装元数据均无漂移 |
| 根入口遗漏的 61 份 MJS 测试 | 定向 5 文件 188 项通过；完整 61 文件 943 项通过、1 项既有跳过；源码及安装状态无漂移 |
| 六平台、headless、Web 与组件库 | 六平台 7 文件、38 项通过；headless gate 6/6 任务通过；完整 Web 首轮 121 通过、2 失败，修复与单张基线迁移后的 WebB 为 17 文件、123 项全部通过 |
| 干净提交的正式 HMR build | 提交 `6197a323`，45 个计划任务中 42 个执行通过、3 个按版本化范围记为 OOS；210 项测试通过、无失败或跳过，42 个任务清理通过，安装状态无漂移 |
| 干净提交的正式 HMR headless | 同一提交，28 个计划任务中 14 个执行通过、14 个按版本化范围记为 OOS；23 个 strict DOM case、155 个 checkpoint 完整通过，14 个任务清理通过，安装状态无漂移 |
| 其他浏览器与实际消费者 | Firefox/WebKit 2 项、Simulator Chromium 89 文件 201 项、glass-easel DOM 流程通过；网站重建及 Playwright 7 项通过，包含真实 Mermaid |
| autoRoutes 发布回执 | 定向 6 文件 81 项、ESLint、owning typecheck/build 通过；完整 WebB 中 issue #1029 的三个浏览器用例通过，严格 reload 次数断言保持 |
| 最低 Node 22.23.4 与本地 Node 24.22.1 | built CLI、AcceptanceService 和 model-free baseline 均通过；不等同于两个版本的完整消费者矩阵 |
| Bun 启动与 Node guard 契约 | CLI 两文件 39 项、Tailwind 两文件 45 项单测通过；包级 typecheck、路径 ESLint、重建通过。macOS 真实 Bun 1.4.2、1.4.4 各两文件四项 CLI/IPC 通过，源码和安装 guards 无漂移 |
| Agent CLI 实际发行消费者 | 最终实际 tarball 安装、session、legacy verify、model-free acceptance、stdio MCP 生命周期、持久化报告及显式 Skill 安装通过；不访问真实模型或发布端点 |
| Windows/macOS/Linux GitHub CI | 原生 [PR #1259](https://github.com/weapp-vite/weapp-vite/pull/1259) 尚未完成全部适用矩阵；最终以修复后 head 对应的完整 Checks 为准 |
| CI 跟进的局部 runtime | 两文件 8 个 headless case、65/65 strict checkpoint 通过，无跳过；重建 weapp-vite 后验证，源码与安装 guards 不变。Chokidar 完整真实 Darwin 29 场景再验通过、清理确认；不能替代 Windows CI 或真实 IDE |
| CI 工具与发布观察跟进 | pnpm fixture 与原四分片/telemetry 8 项、原生配置发布工具 14 项、工作流完整拓扑 16 项及改动路径 ESLint 通过；当前 candidate 补齐已有消费者 Node selector，保留历史 baseline |
| 合并后干净 main 的正式全量 IDE | 待合并后执行 |

上述 HMR 两阶段只证明各自冻结范围，完整 capability acceptance 仍为 `not-evaluated`。headless 报告的 6 个 skipped entry 均在冻结 selectedCases 之外，不计为所选 case 跳过。

首轮原生 CI 的安装和发行消费者暴露了 Node 选择遗漏：`22`、`24` 简写会使用 runner 缓存中的 22.23.3、24.21.0，低于新下限。共享 setup 及直接入口现在将 `22`、`24`、`26` 分别映射为 `^22.23.4`、`^24.22.1`、`^26.12.1`，仅为这些 major selector 开启 `check-latest`；完整 patch 原样透传。消费者仍独立验证三个精确最低版本及最新 Node 22、24，共五个 lane；Node 26 的 CI lane 保持在本 major 内，产品 `>=26.12.1` 范围不变。选择契约及相关工作流共六文件、45 项通过。活跃 Nightly/candidate workflow 的 major 24 入口同步修正，未重新采样旧性能证据；显式固定 24.18.0 的性能目标保持原样。原生 CI 每轮均核验 PR、head/base、合并候选和运行身份后独立批准，原始失败日志保留。

Windows 的 Bun CI 随后在 CLI importer 前暴露了运行时识别问题：Bun 的 Node 兼容标识被当作真实 Node 版本拒绝。修复通过独立 Bun 身份处理，保留 Node engines 与错误语义；旧实现的负向单测和原始 CI 失败日志继续保留。首轮真实 Bun 1.4.2 已通过两个 IPC case，两个 CLI case 暴露 Tailwind 插件的第二处同类检查；继续按独立身份修正，并保留 CSS 文件检查。旧 Tailwind 实现的三个负向用例失败、修后 45 项通过。重建发行入口后，macOS 上精确 Bun 1.4.2、1.4.4 各自执行完整两文件四项 CLI/IPC，全部通过；源码和安装 guards 无漂移，未留下本任务 E2E/watcher。此结果不替代原生 CI 的三 OS Bun 矩阵。既有大型 Tailwind 模块和相邻测试保留局部边界，新增逻辑仅修正运行时识别。

后续跨平台 CI 还暴露了测试观察方式与新版工具链的差异。issue #475 原来检查 Rolldown 的 region 注释，现检查实际 sourceMappingURL、原 Vue source、marker 的原始行号及对应 sourcesContent 行；env 预处理已有的文本替换不作为原 SFC 全文相等契约。Windows 的 pnpm 进程 cwd 使用系统原生 realpath 比较双方，保留 argv 与退出码断言，兼容短路径别名。对应局部验证分别通过 1 项 sourcemap E2E（其余 98 项按筛选未执行）和 11 项进程契约。

macOS alias watcher 的单次 CI 失败在本地原始用例、完整文件及同组 43 项中未复现，Windows/Linux 同组通过。目前只增加失败时的 Chokidar 6 与 Vite watcher 事件时间线，保留原始编辑、ready、超时和产物断言，未据此修改产品 backend 或路径策略；最终结果仍需新一轮 CI 核验。Windows atomic 场景的原始 artifact 则确认观察器用原生反斜杠读取 v6 已规范化的内部 Map 键，导致没有持有真实 atomic timer；修订仅同步内部观察键，不折叠大小写，旧版表示、显式 atomic 配置与事件断言保持。

后续 Windows 运行已越过缓冲超时，结构化报告显示同一 pending entry 被替换 ADD 消费、只交付一次 change，原 flush 无输出；剩余失败是观察器漏记 fixture 根目录的真实 native 通知。v6 Windows root-parent watcher 会由该通知触发目标目录重扫。现在仅补采精确 fixture 根资源，并在 reconcile 入队时绑定原通知上下文，保留原回调参数、返回值和完整因果断言，新增 scope/trigger/candidate 诊断。旧观察器下新增场景复现缺少 native 来源；修后四文件 32 项纯 mock 测试、本机 Darwin 真实文件系统 29 场景及路径 ESLint 全部通过，安装 guards 不变。真实 Windows 结果仍以新 head 的 CI 为准，不把本机分类模拟记为 Windows 实测。

Windows CSS-only 失败的写出回执证明，页面 JS 的 mtime 变化来自首次构建前入队、首屏期间完成的共享 SCSS 启动批次；实际 CSS 编辑只发布 app.js 与 WXSS，与 Linux 一致。CSS 基线移到首屏可观察检查之后、首次 CSS 编辑之前，继续严格比较完整 JS 集合、内容与 mtime。该修订不声明已消除启动重复发布。macOS startup fallback 的配置重载失败发生于完整 classic ready 之前：测试已读到 CONFIG-B 页面文件便启动新的 headless VM，其他 bundle 尚在写出；现复用已有配置发布观察器，等待该次 native 回执和其后的正式 ready，再连接 runtime，保留八阶段 DOM 与回退断言。

局部真实 IDE 首轮固定 Stable 2.02.2608080，官方查询于 2026-10-25 21:51:14 UTC 确认与 latest Stable 一致。classic 项目导入返回 `APPID_ERROR`、要求重新登录；stateful 启动返回当前能力契约规定的 `ide-classic-handoff`，旧用例只接受 `stylesheet-output`，在调用 launch 前失败。两个 case 均未执行，DOM case 与 checkpoint 均为 0，不能记为 runtime 通过。外层登记的 scope、宿主及端口清理成功，保留首错和 fixture 保留诊断；Computer Use 已确认当前仅有项目列表窗口、界面仍显示退出登录，等待正常重新登录后继续。测试同时按当前启动能力契约精确接受 `ide-classic-handoff`，连接前确认 classic 产物；初始 App/Page 标记应保持，编辑后仍要求实例替换，七个 CSS checkpoint 及 DOM/计算样式断言保留。新增 test-only helper 承载这部分契约，避免继续扩大既有超过 300 行的 E2E 文件；普通契约单测 14 项通过；同一 E2E 文件随后在 headless 下完整执行 classic 与 stateful 两个 case，17/17 个 strict DOM checkpoint 通过，无跳过，源码与安装状态不变，两份隔离 fixture 均完成清理。该定向复验不能替代真实 IDE 结果。

初次发布回归因 Vitest 选中 node_modules 内 TypeScript 源文件失败，调整测试解析条件后通过。首次 queue tsd 命令误用不受支持的 cwd 参数，改为在 owning fixture 目录执行后通过。首次 oxc CLI 命令猜错发行入口；按 package.json 的 bin 改用 dist/index.js 后版本查询及注册加载通过。这些执行错误保留原始日志，不作为产品缺陷。

pnpm 12 会在 `run` / `exec` 前核验工作区安装状态。旧测试把整个 `node_modules` 链到临时项目，真实 pnpm 自动安装会穿透链接，改写根目录 `.modules.yaml` 并删除 `.pnpm/lock.yaml`；独立临时 owner/borrower 最小复现确认了该链路。现改为自有 workspace、安装元数据、缓存与 bin，仅链接已安装的公共包入口，并显式 offline/frozen 安装。保留真实 pnpm 参数、退出、coverage 分片和阈值断言，没有全仓关闭依赖验证。完整回归用源码摘要及安装元数据 SHA/inode/mtime 监测确认无漂移；旧失败、中断和重试日志保留。

Ubuntu Node 24 CI 的全新缓存进一步暴露 pnpm 12 的环境锁：精确 packageManager 也要有冻结的解析记录，否则离线安装会查询缺失的 pnpm metadata。fixture 现在复用主锁首文档的包管理器解析及 integrity，移除所有根配置依赖与项目 importer，仍由真实 pnpm 生成独立项目锁并执行原始 offline、frozen、exec。`pmOnFail: error` 保留精确版本门禁；不使用 ignore 或补造 registry metadata。`CI=true`、空 cache/store/state 的实际执行、错误版本负控、frozen 依赖漂移拒绝和配置隔离均通过；连同原始四分片覆盖率与 telemetry 回归共 3 文件、8 项通过，根安装四项哨兵不变。新增回归纳入原 Ubuntu 24 contracts 命令，只同步当前 candidate 命令清单，历史 baseline 与性能数据不变。

监听诊断脚本同样隔离临时安装，改用正式 Node/CLI 入口。旧时间戳修改会被既有首构内容去重过滤，现以合法换行编辑全部 20 个文件；20/20 重建及文件名冲突检查通过，未修改产品去重逻辑。

安装后的补丁回归已通过 4 文件、13 项，覆盖真实 native/scan 空目录删除、七个 warning 边界、Vitest 磁盘缓存冷暖启动及构建策略。五份 JS bundle 文本快照已改为真实依赖图与 VM 执行语义，5 文件、6 项通过；非 JS 快照保留，没有使用 snapshot update。

61 份 MJS 补充测试的两个 benchmark 首错来自基线已有的测试输入与严格 DOM 验收契约不一致；现已显式传递并校验实际 provider，通过示例补齐有效 checkpoint/evidence，provider skip 使用带来源与条件的正式冻结范围。普通 skip、缺失验收证据、provider 越界和范围外错误执行仍被拒绝。第三个首错来自基线已有的候选 workflow expected 漂移；本轮还需同步已授权的 Node 版本与支持矩阵迁移，因此从既有七份 YAML 完整 jobs 刷新当前 candidate 测试契约，并保留全部精确比较和防绕过反例。`baseline-topology.json`、历史 benchmark、性能报告及固定性能 workflow 保持原样；新 candidate expected 不构成历史性能采样证据。这些修复已通过定向 5 文件 188 项与完整 61 文件 943 项复验，原始失败日志继续保留。

补充执行 `packages/weapp-vite/tsconfig.test.json` 时，整体检查返回 3620 条诊断，主要包括跨目录 rootDir、未列入项目的输入和测试 mock 类型。这不是已通过的包级 typecheck。新增 bundle helper 与五个迁移测试没有诊断；本轮改动文件上的诊断另行按修改行审阅，修正了 Chokidar 6 error 载荷从 Error 变为 unknown 后的测试收集器类型，其余未扩大到历史测试配置治理。

Oxc 0.155 的 JSStr 在孤立代理项上不能转为 Rust UTF-8 字符串。布尔预判现在按静态字符串的语法形状判断，避免把转换失败误当作动态 `require` 或平台成员；真正需要返回字符串摘要的路径继续整项 fallback。旧绑定对新增 25 项用例有 8 项预期失败，新绑定全部通过；没有扩大动态 computed 或文本预筛选范围。

最终 Native profile 使用新构建的 `compileVueFile` 发行入口，六个原始 SFC 各 40 对交替测量，共 480 样本、另 120 次预热；代码、sourcemap、warning 逐次一致，采样前后 55 项源码与产物摘要不变。五项 wall p50 降低 7.21%–10.71%，slot 的 p50 从 2.148ms 增至 2.203ms（2.56%）、p95 从 3.025ms 增至 6.065ms（100.52%），其余 p95 有升有降。先前绑定的独立 profile 原始数据保留，不以较好的单轮替换最终结果。这只覆盖当前暖编译入口，不代表完整构建、HMR、runtime 或 RSS 的统一提速。

依赖合同在 macOS 的真实文件系统执行。Windows 分类分支使用模拟平台覆盖，不能作为真实 Windows 运行通过的证据；Windows/Linux 的正式矩阵仍待 CI。

首次完整依赖验证发现 Vite 8.3.5 通配 imports 将 query 后缀错误插入文件名。补丁保留新版精确 query/hash 别名能力，同时恢复通配后缀语义；原断言及新增边界通过。Chokidar 的正式组合首轮 12 项失败来自 macOS 临时目录 /var 与 /private/var 的同路径别名，统一物理 fixture 根后完整 29 项通过。

Volar 升级后，Vue language-core 固定的旧 core 与当前 TypeScript 宿主 core 分开安装，类型扩展不会跨副本传播。测试 helper 使用宿主 LanguagePlugin 接口接入结构兼容的 Vue 插件，并显式加载 TypeScript 类型扩展，未强制覆盖上游依赖范围。

最终 peer 检查覆盖 173 个工作区项目，剩余 5 条 bad peer 分布于三个位置，missing/conflicts 均为零。根工具链两条来自 Vite+ 内部 vite alias 的独立版本号；socket-io-chat 的 GraphQL 17 / graphql-request 组合与网站 Mermaid 12 / VitePress 2 alpha 组合均已存在于基线。保留这些声明，不以越界 override 或降级隐藏提示。77-task 下游构建执行了 42 个 app/template 的 primary build；socket-io-chat 的 build:web/build:mini 已单独验证通过。实际 GraphQL 17 parse/print、graphql-request 7 和 demo HTTP 组合已通过 string query、DocumentNode、HTTP 400 错误传播三项检查；该 demo 没有完整 GraphQL schema/execution，不扩展为 server 全面验证。网站已追加重建及 7 项真实 Playwright 验收通过，包含 Mermaid 渲染、主题和导航；构建及 Mermaid mock 单测不作为该浏览器结果的替代证据。

## 发布意图与后续门禁

Chokidar 6 的组件文件删除事件可能先于页面引用更新。CSS 图阶段现在区分“本轮确认缺失的可选 sidecar”与“未登记/未预处理的必需输入”，输出阶段只消费冻结状态；同路径恢复在下一轮重新预处理。11 项定向回归及 owning typecheck 已通过，原有默认 auto watcher 的删除断言保持。该修复另用 `fix(css)` patch intent 记录，避免归入工具维护说明。

新改动较少的既有大型 Rust、CSS 和 patch 发行文件保留原有模块边界，避免将 API 迁移混入结构调整；新增 native watcher 测试支撑已独立拆到 fixture 模块。autoRoutes 装配文件原已超过 300 行，本轮减少内联回执代码，将快照与比较逻辑集中到既有 publication 目录，保留监听生命周期边界。

CI 跟进中的 legacy 构建场景、CSS runtime 与进程集成测试原已超过 300 行。本轮仅在原场景内替换映射断言、移动基线或修正目录身份比较，保留既有 suite 生命周期，未混入文件拆分；新 watcher 键转换单独收敛，配置重载复用现有发布工具。

依赖与 catalog 的重复 intent 合并为一份 changeset；Node 下限及公开行为变化使用 major，其余依赖升级使用 patch。CSS 运行时修复独立记录为 patch，发布时按最高 bump 合并。fixed 组可能按仓库既有规则联动版本。本任务不执行版本发布。

正式全量真实 IDE 验收遵循 `AGENTS.local.md`：变更合并后，从干净且与 origin/main 一致的 main 工作树运行。升级分支上的 headless、局部 IDE 和构建结果分别记录，不能代替该门禁。跨平台 GitHub CI 以 PR #1259 最终提交对应的原生 Checks 为准，每个修复提交重新通过 pr-ci-approval。
