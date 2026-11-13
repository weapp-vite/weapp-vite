# 2026-11-13 全仓依赖评估与升级

基线为 `0d9cace894e5a075f0f2803f6920629ea1200f6a`，从最新 `origin/main` 创建独立工作树。评估覆盖 277 份自有 npm 清单、286 个外部包名、catalog、脚手架内置 catalog、独立小程序 CI runner、Rust 与 GitHub Actions。34 个 npm 候选中接受 29 个，另 5 个保留现有版本。

目标 npm 元数据冻结于 2026-11-13 03:11 UTC，清单评估完成于 03:19 UTC；来源为 npm 官方 registry 的精确版本元数据与 tarball，integrity 随锁文件固定。验证期间不追逐新发布。历史复现 fixture、第三方 upstream、公开 peer/Node 最低支持范围和既有预发布基线保留。

## 接受的升级

| 依赖组 | 冻结目标 |
| --- | --- |
| AI SDK | ai 7.0.171、@ai-sdk/anthropic 4.0.103、@ai-sdk/openai 4.0.116、@ai-sdk/openai-compatible 3.0.91 |
| Babel | core、generator、parser、traverse、types、plugin-transform-modules-commonjs 均为 8.1.2 |
| 检查与构建 | @icebreakers/eslint-config 8.0.18、postcss-selector-parser 7.2.1、rolldown-plugin-dts 0.30.2、turbo 2.11.11 |
| Vue 插件 | @vitejs/plugin-vue 6.0.11，迁移 Oxc 上下文补丁 |
| 工具 | hono 4.13.18、memfs 4.80.1、prettier 3.10.1 |
| 测试与通信 | miniprogram-simulate 1.7.0、ws 8.23.0 |
| 视频工具 | remotion、@remotion/bundler、@remotion/cli、@remotion/renderer 均为 4.0.543 |
| 网站 | @iconify-json/logos 1.2.20、@iconify-json/vscode-icons 1.2.98、vitepress-plugin-group-icons 1.8.2、wrangler 4.161.0 |
| VS Code 类型 | @types/vscode 1.146.0 |
| 固定工具链 | Node 26.13.1、Rust 1.100.0 |

保留精确版本、`^`、`~` 与 catalog 引用形式，同步生成 catalog 和脚手架数据。Prettier 仅更新依赖，未执行格式化。独立 runner 保留 miniprogram-ci 2.1.31，只刷新其允许范围内的间接依赖，并验证独立冻结安装。

Node 默认版本改为 26.13.1。修正 major selector 中 `24` 跟随默认版本的绑定，22/24/26 各自解析对应主版本；注入默认 28 的回归验证它们不会随默认值漂移。支持计划补齐 `latest-26`，共最低版与最新版六个逻辑角色，完整版本相同时复用实际执行，汇总仍逐角色检查。同步当前候选拓扑与 legacy matrix 清单，保留历史基线遥测。明确固定为 Node 24 的 artifact builder 和身份标签继续配对，不把它们改成默认 selector。

## 保留项与引擎候选

| 项目 | 决策依据 |
| --- | --- |
| TypeScript 6.0.3 | 7.0.2 根入口缺少现有 Volar、类型生成链使用的 Compiler API；不放宽类型契约换取升级。 |
| local-pkg 1.2.1 | 2.0.0 官方声明仍引用未定义的 `Args`。 |
| Vite 8.3.5 / Rolldown 1.2.16 | 8.3.8 / 1.2.19 隔离组合未通过 Web optimizer 关闭清理契约。最新 Rolldown 1.3.2 又超出 Vite 8.3.8 的官方 `~1.2.18` 范围。 |
| Vite+ 1.5.0 | 1.6.0 的真实内置引擎为 Vite 8.3.7 / Rolldown 1.2.18，同样未通过 Web optimizer 契约。 |
| pnpm / repoctl / Bun | 12.18.0 / 6.6.1 / 1.4.4 已为冻结时稳定版。 |
| Cargo 与 Actions | 12 个 Cargo 直接依赖均无适用更新；10 组 Actions 的固定 SHA 与官方最新稳定 tag 对应提交一致。 |
| 预发布基线 | VitePress 2.0.0-alpha.20 与 vite-tsconfig-paths 7.0.0-alpha.3 按既有基线保留。 |

两个引擎候选分别安装并核对实际入口，保留原六项完整产品断言。两者均通过 hooks、resolver、mini-optimizer，在 web-optimizer 的扫描取消/关闭后留下 `deps_temp_*`，随后 polling、ready 未执行；candidate fixture 与 scope 清理均确认完成。失败即拒绝候选，未继续资源压力验收，也未将旧版本豁免迁移到新版本。

保留组合继续按既有精确版本例外运行必需契约，Vite 报告为 `accepted-with-waivers`；这不表示 Web optimizer 临时缓存和连续构建资源增长已修复。新候选也没有获得任何新豁免。

## 补丁核对

- plugin-vue 6.0.11 上游仍未补传 Oxc 的 Vite config/watcher，原差分迁移到新版本并核对实际安装代码。
- Chokidar 6.0.0 的异步监听、目录恢复与关闭补丁继续需要；29 项公开行为契约通过。
- Vite 8.3.5 的内置 ready 计数补丁继续需要；Rolldown 没有补丁。
- repoctl 6.6.1 已有上游 YAML block collection 等修复，本轮没有恢复已移除的 monorepo 补丁；修正补丁维护文档的过期描述。

三份保留补丁沿用上游发行结构以便审查，不拆分第三方发行文件。自有测试文件仅同步既有矩阵断言，不增加职责；超过 300 行的文件保留原边界。

## 安全与 peer 差异

`@modelcontextprotocol/node` 允许范围内的 `@hono/node-server` 从 2.1.5 刷新为 2.1.8，不添加 override。原依赖路径为 weapp-vite、@weapp-vite/mcp、@weapp-agent/mini-program → @modelcontextprotocol/node → @hono/node-server。消除以下两条 moderate 通告：

- [GHSA-qv5m-9pm6-hqp3](https://github.com/advisories/GHSA-qv5m-9pm6-hqp3)：异步 WebSocket upgrade 的 ECONNRESET 可使进程崩溃。
- [GHSA-jpvv-r467-5p4w](https://github.com/advisories/GHSA-jpvv-r467-5p4w)：反斜线请求路径解析造成代理路径访问控制绕过。

| 审计范围 | 升级前 | 升级后 | 差异 |
| --- | --- | --- | --- |
| 工作区 pnpm advisory | low 8 / moderate 25 / high 18 / critical 8 | low 8 / moderate 23 / high 18 / critical 8 | 59 → 57，无新增通告 |
| 独立 runner npm 受影响包 | low 1 / moderate 15 / high 19 / critical 40 | low 1 / moderate 15 / high 19 / critical 40 | 均为 75，通告与依赖路径未变 |

两种统计口径不同。剩余审计结果继续非零，不宣称漏洞清零；没有强制跨越父依赖范围、关闭审计或弱化安全断言。peer 警告集合未变，仅安装输出中 @devframes/plugin-messages 的排列位置变化。逐项比较现存 advisory 后，仅 minimatch 的 peer 解析路径出现重排：仍为 10.2.3 的 1 条路径与 10.2.6 的 121 条路径，受影响版本和路径数量未增加；完整前后路径保存在本轮本地审计证据。

## 验证记录

- `pnpm install --frozen-lockfile` 通过；独立 runner `npm ci --ignore-scripts --no-audit --prefix tools/miniprogram-ci-runner` 通过。
- `pnpm build:pkgs` 50/50、`pnpm build:apps` 80/80（含模板）、`pnpm build:docs` 全部通过。
- 12 个相关包 typecheck 通过，覆盖编译器、AI agent、Dashboard、automator、VS Code、脚手架与视频工具。
- `pnpm test:dependency-contracts` 串行复验通过：Vite 既定必需清单、Rolldown 7 项与 Chokidar 29 项；保留上述精确版本豁免。首轮误与构建重叠导致 dist 文件暂时缺失，重建后复验，原失败证据保留。

- 全量 `pnpm test` 执行 2,741 文件：26,393 项通过、20 项既定跳过，唯一失败为 Node 支持矩阵的旧五角色断言；同步六角色后，5 文件 43 项相关测试全部通过。未改动的成功用例复用原证据，不把首次全量非零写成首次即通过。
- `pnpm test:types` 88/88 任务通过；全仓 `pnpm exec eslint .` 通过，自有应用、模板、包及网站 854 份样式文件 Stylelint 通过。
- Rust 1.100.0 release 构建和 9 文件 183 项 native correctness 通过；工具链本身已安装并核验，rustup 安装末尾的可选自身更新因 rustup-init 路径失败，不影响已验证工具链。
- catalog 与脚手架生成一致性、Rolldown 单版本、npm 元数据/入口、发布依赖协议、联动 changeset 与 frontmatter 检查通过。独立 runner CLI 加载与帮助命令通过。
- 完整 headless suite 115/115 task、290 case、1,384 checkpoint 全部通过，无跳过、阻塞或未执行 task，报告为 `coverage: complete`、`acceptance: passed`；耗时约 19 分 19 秒，资源收尾通过。
- VS Code 扩展 `build` 与 `smoke:dist` 通过；Remotion 使用真实 `src/index.tsx` 完成打包验证，未执行视频渲染或发布。
- 真实 IDE `ide-smoke` 6/6 task 通过，覆盖编译、原生与 wevu 模板、启动生命周期、自动路由、ESM/CJS 页面导航及布局切换。实际 IDE 为 Stable 2.02.2609250，与当轮官方查询一致；实际基础库按 fixture 为 3.16.3 或 3.17.2。
- 六个 IDE task 的 scope 与宿主收尾均成功，登记端口均释放，所选安装进程树均归零；受管启动意图的保守重叠上界为 1。原生窗口峰值未采样，不以该上界代替原生窗口峰值；收尾边界的安装进程 RSS 合计采样为 2,712–3,872 MiB，仅为边界采样，不能代表持续峰值。
- 核心真实 IDE HMR 专项通过：通过正式 DevTools Vitest 配置单独运行 `e2e/ide/wevu-runtime.core-hmr.test.ts`，保留 `WEAPP_VITE_E2E_DOM_ACCEPTANCE=1`、机器串行租约、单窗口预算与宿主归属检查。1/1 完整场景、18/18 严格 DOM checkpoint 通过，覆盖原生页、Vue SFC、布局的 template/script/style 变更、共享 store 及恢复，退出码 0。正常退出宿主和全局清理成功，运行后未发现本任务 E2E、watcher 或所选 IDE 进程残留。

全仓正式全面真实 IDE 验收要求在干净且同步的根 `main` 工作树运行，本次候选工作树仅做专项验证，未运行该全面验收；也未执行完整 HMR suite 的其他专项。两个被拒绝的新引擎在首个必需契约失败后停止，后续契约不记为通过。安全审计仍有既存通告，详见前表。

交付限本地 `chore(deps)` 提交，不推送、创建 PR 或发布；本轮未运行远端 CI 或 Windows/Linux 矩阵。中文 changeset 同步发布包、catalog 与脚手架联动；生成的 IDE 报告已归档到本地任务证据，提交中仅保留本记录和有意变更。
