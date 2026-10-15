# 2026-10-15 全仓依赖兼容升级

本轮基于 `origin/main` 的 `2c2d8a6ccedbc96e4f1a7e9593fc6c83424f3cb6` 执行，采用最新兼容稳定版策略。本地提交 `7f23da247` 已另存备份，不重放到升级分支。本文件记录依赖差异、兼容选择和实际验证结果；未执行或失败的验收单独列出。

## 统计口径与版本变化

扫描范围为 239 份自有、受 Git 跟踪的 `package.json`，包含根清单和 238 份嵌套清单；另有 1 份 `upstream` 第三方快照清单保留原样。registry 查询覆盖 270 个外部依赖名称和 pnpm，共 271 个名称。清单范围包含 workspace、嵌套 fixture 与独立 npm runner，Rust 和 CI 工具另行核对。

61 个候选中，53 个实际升级，8 个保留。53 个升级项中，52 个采用本轮查询到的最新稳定版，p-queue 采用兼容版 9.3.5。最终改动涉及 26 份 npm 清单中的 73 处声明，以及 workspace 中的 13 处 catalog 声明，共 86 处；生成 catalog 的重复记录、锁文件、Rust 与 Actions 不重复计入。升级前后保留精确版本、`^`、`~` 和 catalog 的既有管理方式。

| 依赖 | 升级前声明 | 升级后声明 |
| --- | --- | --- |
| @ai-sdk/anthropic | `4.0.78` | `4.0.79` |
| @ai-sdk/openai | `4.0.91` | `4.0.93` |
| @ai-sdk/openai-compatible | `3.0.67` | `3.0.68` |
| @devframes/agentic | `1.2.3` | `1.2.5` |
| @devframes/hub | `1.2.3` | `1.2.5` |
| @devframes/hub-ui | `1.2.3` | `1.2.5` |
| @icebreakers/eslint-config | `^8.0.8` | `^8.0.9` |
| @iconify-json/logos | `^1.2.15` | `^1.2.16` |
| @iconify-json/vscode-icons | `^1.2.87` | `^1.2.89` |
| @json-render/core | `0.21.0` | `0.21.1` |
| @oxc-node/cli | `^0.1.6` | `^0.1.7` |
| @oxc-node/core | `^0.1.6` | `^0.1.7` |
| @oxc-project/types | `^0.153.0` | `^0.154.0` |
| @remotion/bundler | `4.0.534` | `4.0.535` |
| @remotion/cli | `4.0.534` | `4.0.535` |
| @remotion/renderer | `4.0.534` | `4.0.535` |
| @swc/core | `1.16.13` / `^1.16.13` | `1.16.18` / `^1.16.18` |
| @tanstack/vue-query | `^5.104.1` | `^5.104.2` |
| @typescript-eslint/parser | `^8.71.1` | `^8.71.2` |
| @vercel/detect-agent | `^1.2.6` | `^1.2.7` |
| @vitest/browser-playwright | `5.0.3` | `5.0.4` |
| @vitest/coverage-v8 | `~5.0.3` | `~5.0.4` |
| @vue/compiler-core | `^3.5.43` | `^3.5.44` |
| @vue/compiler-dom | `^3.5.43` | `^3.5.44` |
| @vue/reactivity | `^3.5.43` | `^3.5.44` |
| @vue/runtime-core | `^3.5.43` | `^3.5.44` |
| @vue/shared | `^3.5.43` | `^3.5.44` |
| ai | `7.0.137` | `7.0.140` |
| cac | `^7.0.1` | `^7.1.0` |
| camelcase | `^9.0.0` | `^10.0.0` |
| devframe | `1.2.3` | `1.2.5` |
| dotenv | `^18.0.7` | `^18.0.8` |
| execa | `10.1.0` / `^10.1.0` | `10.1.1` / `^10.1.1` |
| happy-dom | `^20.14.6` | `^21.0.1` |
| mermaid | `^12.1.0` | `^12.2.0` |
| oxc-parser | `^0.153.0` | `^0.154.0` |
| p-queue | `^9.3.3` | `^9.3.5` |
| pinia | `4.0.3` | `4.1.0` |
| playwright | `1.64.0` / `^1.64.0` | `1.64.1` / `^1.64.1` |
| postcss | `^8.5.29` | `^8.5.30` |
| react | `19.3.0` | `19.3.1` |
| react-dom | `19.3.0` | `19.3.1` |
| remotion | `4.0.534` | `4.0.535` |
| repoctl | `5.10.2` | `5.10.3` |
| rolldown | `1.2.13` | `1.2.14` |
| rolldown-plugin-dts | `0.28.7` | `0.28.8` |
| rollup | `^4.64.5` | `^4.64.6` |
| turbo | `^2.11.7` | `^2.11.8` |
| vitest | `5.0.3` / `^5.0.3` / `~5.0.3` | `5.0.4` / `^5.0.4` / `~5.0.4` |
| vue | `^3.5.43` | `^3.5.44` |
| weapp-tailwindcss | `5.6.0` / `^5.6.0` | `5.6.2` / `^5.6.2` |
| wrangler | `^4.149.0` | `^4.151.0` |
| zod | `4.6.5` / `^4.6.5` | `4.6.7` / `^4.6.7` |

初始脚本的 55 项统计包含后来回退的 DevTools/Kit，最终统计以当前 diff 为准。本地最终统计证据为 `.tmp/deps-20261015/final-summary.json`；该临时目录不作为发布文件。

## 兼容选择与保留项

DevTools/Kit 0.8.0 的 API、运行契约和公开类型验证本身通过。回退原因是 Vite 8.3.4 声明可选 peer `@vitejs/devtools: ^0.7.1`，0.8.0 不满足宿主的公开兼容范围。因此保持 Vite 8.3.4 及现有补丁，DevTools/Kit 选择最高兼容稳定版 0.7.6，weapp-vite 的可选 Kit peer 也保持 `^0.7.6`。没有通过放宽 Vite peer、忽略规则或 override 隐藏冲突。

新增的 Kit 集成回归使用真实 Kit context 和官方 adapter，验证静态资源挂载、RPC 状态更新、宿主 generation 更替，以及只释放当前 generation 的幂等关闭。它覆盖依赖交互契约，不使用版本号断言替代行为验证。devframe 与三个 `@devframes/*` 配套包统一到 1.2.5。

| 保留项 | 当前基线 | 原因 |
| --- | --- | --- |
| @vitejs/devtools、@vitejs/devtools-kit | 0.7.6 | 满足 Vite 8.3.4 的 DevTools peer 范围 |
| TypeScript | 6.0.3 | 本轮不引入 7.x 编译器迁移；历史 5.6.1-rc、5.9.3 fixture 保留 |
| pixelmatch | 7.2.0 | 保留截图比较算法、差异像素及门限语义 |
| @types/adm-zip | ^0.5.8 | 0.6.0 是已弃用的 stub，不作为类型包升级目标 |
| miniprogram-api-typings | catalog ^5.2.3 | 正常使用方已是最新；历史 fixture 的 ^2.8.3-1、既有 peer 范围和 latest 哨兵保留 |
| vitepress | 2.0.0-alpha.20 | 保留已采用的预发布基线，不降回 1.6.4 |
| vite-tsconfig-paths | ^7.0.0-alpha.3 | 保留已采用的预发布基线，不降回 6.1.1 |
| p-queue 的 10.x 迁移 | 本轮升至 ^9.3.5 | 事件接口和取消语义迁移另行处理 |

所有清单的 peer、engines、packageManager、scripts 和其他非依赖元数据均与升级前一致。Node 最低要求仍为 `^22.18.0 || ^24.11.0 || >=26.0.0`，脚手架仍为 `^22.22.2 || ^24.15.0 || >=26.0.0`，pnpm 保持 12.11.2。构建批准名单与固定性能环境未修改；升级候选的声明 engines 没有与这些 Node 下限冲突。

## Bundler、Rust 与 CI 工具

Rolldown 从 1.2.13 升至 1.2.14，保留单版本 override。补丁仅将目标改为新版本对应的 bundle 文件名，修复逻辑原样迁移，持久化仍由 bundler 原生 emit/write 负责。Vite 保持 8.3.4，补丁内容不变。workspace 默认和命名 catalog 与脚手架生成 catalog 完全一致；按 override 解析后，锁文件的 importer 声明也与清单一致。

Rolldown 1.2.14 包含官方 [#11142](https://github.com/rolldown/rolldown/pull/11142) 的重复 native close 修复：并发及后续 `close()` 不再重复执行 `closeBundle`，并发调用等待首次关闭结算。首次关闭失败时，首个调用保留完整插件错误，并发及后续调用完成等待，不重试 native close，也不重复传播首错。相应生命周期契约已迁移，新增并发 barrier、hook 单次执行和首错归属断言；关闭后引用释放继续由已有的独立 `retention` 契约验证。

首次依赖契约执行的 Vite 16 项检查通过，Rolldown 的 `hooks`、`escaped` 通过后在 `closing` 失败；原契约仍要求重复执行关闭 hook，与上述官方语义变化冲突。首次失败日志 `dependency-contracts.log` 保留，没有将其改写为成功。后续四项局部诊断用于定位问题；迁移后重新执行完整契约，Vite 16 项检查与 Rolldown 的 `hooks`、`escaped`、`closing`、`failures`、`failFast`、`retention`、`watching`、`scanning` 八组全部通过，证据为 `dependency-contracts-final.log` 和 `rolldown-final-contracts.json`。

npm 自有 Oxc parser/types 与 Rust 七个直接 Oxc crate 同步到 0.154.0。Cargo.lock 共更新 14 个 Oxc crate，serde_json 从 1.0.152 更新到 1.0.154，其他 crate 不变；没有 Rust 源码 API 适配。weapp-tailwindcss 的上游链路仍带有 Oxc 0.153.0，这是父包约束内的传递依赖，没有强制跨范围覆盖。native 的可选加载、显式启用、批量调用边界和 JS fallback 保留。

15 处 pnpm/action-setup 引用从 tag object `d9184bf108216479bc5a137cc391f4d7b14c870b` 改为真实 commit `ea17c68df8912ef543352723c149a84f56e3d413`，覆盖 14 个 workflow 和 1 个复合 action，版本注释仍为 v6.1.0。[官方 tag ref](https://api.github.com/repos/pnpm/action-setup/git/ref/tags/v6.1.0) 指向 annotated tag，[tag 元数据](https://api.github.com/repos/pnpm/action-setup/git/tags/d9184bf108216479bc5a137cc391f4d7b14c870b) 解引用到该 commit，GitHub 签名验证有效。逐文件比较确认只有 SHA 替换，Node 与性能配置未变。

独立 `tools/miniprogram-ci-runner` 的官方稳定 latest 仍为 miniprogram-ci 2.1.31，未采用 alpha、beta 或 gamma 标签。原范围内刷新 caniuse-lite 1.0.30001815 → 1.0.30001816、electron-to-chromium 1.5.452 → 1.5.456、postcss 8.5.29 → 8.5.30；独立 npm 锁文件不并入 pnpm workspace。安装使用 `--ignore-scripts`，未执行预览、上传或远程发布。

## 审计差异与既有 peer 限制

最终审计使用当前回退后的锁文件重新运行 `pnpm audit --json`，结果保存在 `.tmp/deps-20261015/audit-final.json`。pnpm 的 advisory 集合升级前后均为 47 项，没有新增或消除 advisory。解析依赖总数从 2838 变为 2827；这属于依赖图调整，不代表安全问题已经修复。

| 审计范围 | low | moderate | high | critical | 合计 |
| --- | --- | --- | --- | --- | --- |
| pnpm 升级前 | 5 | 18 | 17 | 7 | 47 |
| pnpm 最终锁文件 | 5 | 18 | 17 | 7 | 47 |
| 独立 npm runner 升级前 | 1 | 27 | 17 | 41 | 86 |
| 独立 npm runner 升级后 | 1 | 27 | 17 | 41 | 86 |

pnpm 数量为 advisory 数；npm 还会计入受影响的父包，两者不能直接横向比较。剩余告警来自既有上游约束，代表性依赖链见[前轮审计记录](./2026-10-11-dependency-audit.md)。独立 runner 的官方 SDK 固定了旧 Babel、request、COS 与压缩解包依赖，本轮不做未验证的跨范围替换，也没有新增审计忽略项。

严格 npm 消费者安装另报告 audited 562 packages、10 high。该结果只来自 `npm install` 文本输出，未为临时消费者采集 `npm audit --json` 或 advisory 明细，因此不与上表的工作区和独立 runner 结果合并，也不据此判断新增、消除或重复的漏洞。

工作区仍有以下既有 peer 冲突；它们不因本轮成功安装而自动获得兼容性结论。Mermaid 已从 12.1.0 更新为 12.2.0，但插件对 12.x 的 peer 限制在升级前已存在。

| 使用方与上游包 | 上游要求 | 最终工作区版本 |
| --- | --- | --- |
| apps/socket-io-chat → graphql-request 7.4.0 | GraphQL 14–16 | GraphQL 17.0.2 |
| website → vitepress-plugin-mermaid 2.0.17 | Mermaid 10 或 11 | Mermaid 12.2.0 |
| website → vitepress-plugin-mermaid 2.0.17 | VitePress 1.x | VitePress 2.0.0-alpha.20 |

## 已有验证证据

本地环境为 macOS ARM64、Node 26.10.0、pnpm 12.11.2，Rust 使用固定的 1.99.0。下表记录已有结果及其限制；任务数可能包含构建、prepare 等依赖任务，不等于独立测试 suite 数。

| 验证范围 | 已完成结果 | 本地证据 |
| --- | --- | --- |
| 冻结安装 | 最终锁文件冻结安装通过 | frozen-install-final.log |
| 核心包构建 | 46/46 个任务通过 | build-core.log |
| 包级 typecheck | 重建后 44/44 个任务通过 | typecheck-rebuilt.log |
| 公开类型 | 77/77 个任务通过，43 个有效缓存命中 | public-types.log |
| 全仓单测 | 1763 个文件、16807 项测试通过；13 个文件、20 项测试跳过 | unit-final.log |
| 应用、模板及网站构建 | 77/77 个任务通过，28 个缓存命中；网站页面生成完成 | build-apps-website.log |
| 严格消费者安装 | pnpm 10.33.4、固定 pnpm 12.11.2、npm 11.19.1 的 strict peer 安装及真实构建语义检查均通过 | consumer-validation-summary.json、consumer-pnpm.log、consumer-pnpm12.log、consumer-npm.log |
| Agent CLI 打包 | 固定 pnpm 12.11.2 打包通过 | agent-cli-pack.log |
| DevTools/Kit 定向验证 | 46 项运行契约测试及 tsd 通过；最终采用兼容 0.7.6 | Kit 集成测试与公开类型检查 |
| Rolldown 单版本 | 锁文件与发布包声明仅解析到 1.2.14 | rolldown-final.log |
| Vite/Rolldown 完整依赖契约 | Vite 16 项检查、Rolldown 八组契约全部通过，覆盖生成/写入、watch、关闭与引用释放 | dependency-contracts-final.log、rolldown-final-contracts.json |
| 契约相关定向单测 | 3 个文件、49 项测试通过 | 主执行任务的定向单测输出 |
| HMR smoke | 6/6 个 task、30 项测试通过 | hmr-smoke.log |
| headless gate | 6/6 个 task、14 项测试通过 | headless-gate.log |
| headless 定向 runtime | 4 个文件、7 项测试通过：Tailwind #998/#1081 各 1 项、React 3 项、分包 2 项 | headless-targeted.log |
| 定向构建 E2E | 2 个文件、7 项测试通过；另定向 issue #769 的 1 项通过，同文件 98 项未选 | targeted-build-e2e.log |
| Rust 构建和格式 | release --locked 构建、cargo fmt --check、native lint 通过 | native-validation-summary.json |
| Rust 单测 | 17 项通过 | native-cargo-test.log |
| native correctness | 8 个 suite、154 项通过，驱动完成 29 个构建任务 | native-correctness-run.log |
| native fallback | 3 个 suite、94 项通过，ast-native typecheck 通过 | native-validation-summary.json |
| native profile | 固定 6 份 fixture、40 轮、10 对预热，共 480 次测量 | native-default-export-profile、native-validation-summary.json |
| 独立 npm runner | npm ci --ignore-scripts、语法检查和 Project/preview/upload 公共 API 导入通过 | auxiliary-verification.json、runner-summary.json |
| Promo 与 Dimina 类型检查 | 两个包的纯类型检查通过；Promo timeline 9/9 通过 | promo-video-typecheck.log、dimina-playground-typecheck.log、promo-timeline.log |
| Remotion 单帧渲染 | 新 bundle、composition 选择和 1920×1080 单帧渲染通过；原 harness 清理失败，后续领域恢复完成 | remotion-smoke.log、remotion-smoke/summary.json、remotion-cleanup.log |
| Dimina 独立构建 | 缺少准备好的 SDK，未执行独立构建 | dimina-sdk-check.log |
| Web runtime E2E | 17 个文件、122 项测试通过；Playwright 1.64.1、Chromium 156.0.8078.4（revision 1248） | web-e2e.log |
| 网站浏览器测试 | 7/7 通过，覆盖导航、搜索、Mermaid 与代码复制 | website-demo-e2e.log |
| TanStack Vue Query headless demo | 1/1 通过，覆盖 pending、切换 tab、query key 轮换和渲染状态；不含真实 HTTP/refetch | website-demo-e2e.log |
| 最终静态依赖审查 | 无候选遗漏、无 peer/Node 元数据误改、catalog 与锁文件一致 | final-summary.json |

表中日志位于 `.tmp/deps-20261015`，不提交到仓库。native profile 测量真实 dist 的 warm compileVueFile 入口，native 相对 Babel 的 wall P50 变化因 fixture 不同为 -10.19% 至 +3.51%，P95 为 -17.62% 至 +17.73%，不能据此宣称整体构建、HMR、runtime 或跨版本加速；没有扩大 native 覆盖范围。

三个严格消费者均验证了 Babel 8.0.7 的 TypeScript 转 CommonJS、Vue JSX、MCP Node adapter 初始化，以及 TypeScript 6.0.3 的 default/native/advanced 三种继承 alias 构建和 CSS 颜色转换。npm 11.19.1 提示 esbuild 0.28.2 与 @swc/core 1.16.18 的两个 postinstall 尚未被 `allowScripts` 覆盖；验证脚本设置 `npm_config_ignore_scripts=false`，没有修改审批规则。日志本身不足以判断两个脚本是否实际执行，其执行状态未单独验证；不能将安装和后续语义检查通过写成 postinstall 已获审批或已执行。

Remotion 4.0.535 与 React/DOM 19.3.1 使用现有 Chromium 156.0.8078.4 完成 `PromoLandscape` 第 30 帧渲染，图片尺寸、可见内容及人工检查正常，未执行视频编码。原 harness 在 `browser.close()` 后仍观察到两个登记后代 PID，清理断言失败并以 exit 1 结束。随后独立核验全部十个登记 PID 及原 owner 均已退出，经正式机器租约 API 完成失效 owner 的领域恢复并释放租约；保留原始失败与恢复证据，未 kill 进程，手动 DevTools 实例保持原样。单帧渲染成功与资源恢复完成分别记录，不将原 harness 记为全流程通过。

Dimina 的 SDK 缓存、ready marker 与 source 均缺失，预检报告 missing or stale SDK。本轮未启动 setup 或下载 SDK，也未执行独立构建；纯类型检查通过不能替代该构建。

Vue Query 的真实 HTTP headless 用例首次执行有 1 项失败、6 项未选，日志可观察到页面状态为“失败”，未捕获并保留该次底层 request 的原始错误。源码检查确定本次运行未配置承接真实 HTTP 的 transport；模拟器 `wx.request` 仅匹配 request mock，不会向该真实服务发送网络请求，未匹配 mock 的分支会失败。这是依据执行配置和源码分支作出的解释，不冒充首次运行已捕获该底层错误，也不将该用例记为通过。

离线对照 @tanstack/vue-query 及 query-core 的 5.104.1、5.104.2，Vue adapter 的运行逻辑未变；官方 tarball 完整性与源代码对照未发现不兼容证据，因此保留 5.104.2。该结果不替代真实请求链路；Vue Query demo headless 的 1 项和 Stable 真实 HTTP 的 1 项均通过；后者完整覆盖 tab 切换、refetch、query key 轮换、最终 DOM、请求 URL 与请求次数，其他 6 项未选。

## Stable IDE 局部结果与基线对照

2026-10-15 查询[官方渠道配置](https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json)，最新 Stable 为 2.02.2608080。本轮显式选择 `wechatwebdevtools.app` 的 CLI，预检、启动、连接和退出均使用同一安装；各用例实际连接的 IDE 也为 2.02.2608080，没有切换安装、RC 或 nightly。下表列出的基础库版本来自实际 runtime。

| 局部场景 | 实际基础库 | 升级后结果 | 证据 |
| --- | --- | --- | --- |
| React runtime | 3.17.4 | 3 项通过 | stable-remaining.log |
| 分包 runtime | 3.17.2 | 2 项通过 | stable-independent.log |
| Vue Query 真实 HTTP | 3.17.4 | 选中 1 项通过，6 项未选；覆盖 tab、refetch、query key、请求 URL/次数和最终 DOM | stable-independent.log |
| #998 Tailwind 普通 CSS 更新 | 3.17.3 | 失败：样式变蓝，但点击计数从 1 重置为 0 | stable-focus.log |
| #1081 Tailwind utility 批量替换 | 3.17.3 | 失败：预期背景 `rgb(219, 234, 254)`，实际为透明 `rgba(0, 0, 0, 0)` | stable-independent.log |

为区分依赖回归与既有失败，从本轮升级前的 `2c2d8a6ccedbc96e4f1a7e9593fc6c83424f3cb6` 创建干净的临时 worktree，冻结安装并重建全部 46 个核心任务后，使用原始测试、同一 Stable 安装和相同基础库 3.17.3 串行重跑 #998、#1081。两项均在相同 checkpoint 出现相同失败；基线依赖仍为 Rolldown 1.2.13、weapp-tailwindcss 5.6.0、Vue 3.5.43、Vitest 5.0.3。对照表明这两项失败在升级前已经存在，不能归因于本轮版本升级，也不能将它们计为通过。保留升级版本、原始断言和失败证据，没有通过跳过或放宽规则消除失败。

对 #998 的原生日志分析还记录了 `src/ordinary.css` 事件后 AppService 重启、旧 WebView 销毁并创建新 WebView。早先保留 marker 的诊断采样发生在重启之前，不能用于证明后续页面状态保留。该观察说明发生了宿主重编译，但尚不足以确定唯一根因；本轮不宣称这两个历史场景已修复。基线原始日志与 DOM/screenshot 报告已封存到 `stable-baseline.log`、`baseline-results.json` 和 `baseline-evidence`。

全部 IDE 运行持有正式机器串行租约，保持一个受管项目窗口的默认预算，各任务完成受管资源清理后才进入下一项。执行前的空闲宿主样本为 7 个进程、RSS 合计 339.88 MiB，系统 free pages 为 2321.88 MiB；这只是启动前样本，不代表执行期间峰值或系统可用内存总量。未保留逐 task 的完整 RSS/窗口峰值采样，不据此宣称内存验收通过。最终领域核验确认所选安装进程数为 0、宿主为 cold，机器租约可重新取得并正常释放；非激活应用清单也确认 IDE 已退出，证据为 `stable-final-state.json`。没有全局 kill、删除用户缓存或更改登录设置。

官方 suite 的筛选运行报告为 partial；即使 React 的选中 task 通过，完整 runner 仍因未执行其余任务返回非零。这里仅记录选中用例的实际结果，不将筛选结果、后续直接 Vitest 局部运行或 headless 成功当作正式 IDE gate 通过。

## 最终验收边界

| 验收范围 | 最终状态 |
| --- | --- |
| 本地构建、类型、单测、依赖契约、HMR、headless 与 Web | 构建、类型、单测、契约、HMR、headless gate/demo 与 Web 通过；真实 HTTP headless 的 1 项失败另行保留 |
| Stable IDE 局部验证 | 6 项通过；2 项失败且在升级前基线复现，未完成全量 runtime 验收 |
| 正式全量 IDE 验收 | 未执行；依仓库约束在合并后的干净 `main == origin/main` 主工作树重建后运行 |
| Windows/Linux/macOS CI 矩阵 | 后续已按授权提交 PR 并启动远端矩阵；各次运行结果与最终提交核验见 PR，旧提交通过不能替代最终提交通过 |
| Dimina 独立构建 | 本地缺少 SDK；后续 PR 首轮 CI 的 Linux、macOS、Windows 独立构建全部通过 |
| 范围审查与本地提交 | 清理生成报告及 app 类型噪音，保留 Husky/lint-staged 和发布一致性门禁 |

## Changeset 与交付边界

使用现有依赖升级和 catalog 生成器，以本轮升级前的 `2c2d8a6ccedbc96e4f1a7e9593fc6c83424f3cb6` 为 base，各自产生中文 patch intent。两份 frontmatter 都覆盖同一组 42 个可发布包，已合并为一份 `.changeset/dependency-upgrade-20261015-101137.md`，保留默认及命名 catalog 的变更摘要，包含 `weapp-vite`、`wevu` 和 `create-weapp-vite` 联动，避免为同一批升级保留重复意图。既有 changeset 未修改。

初轮交付为本地 `chore(deps)` 提交；用户随后授权推送、提交 PR、修复 CI 并在通过后合并，未授权发布。原始日志、截图与基线对照保留在忽略的临时证据目录，生成报告和临时 worktree 不进入提交。

## PR 与 CI 跟进

升级提交已进入 [PR #1229](https://github.com/weapp-vite/weapp-vite/pull/1229)，通过可信 `main` 上的手动 PR 工作流运行 14 项检查。每项均核对 `pr-context` 中的 PR head、base 和实际 checkout SHA；普通任务使用冻结 merge ref，性能 smoke 和 runtime size 使用冻结 head。最终验收以 PR 最后提交对应的工作流和状态为准。

首轮 Ubuntu Node 22 覆盖率单测暴露 Tailwind 测试中的顺序假设：两个 CSS root 并行生成，记录按完成顺序追加，原测试却用首条记录识别要删除的第一个物理入口。CI 恰好先完成另一个入口，因此错误地要求删除另一个 root；其他核心平台任务已通过。现在根据 `request.sourceOptions.cssEntries` 与待删除文件路径识别 root，并参数化覆盖删除两个入口，保留移除、内存准备、重新创建、输出及清理断言。旧选择逻辑在本地两个场景中稳定出现一过一败；修复后完整文件 12 项通过，路径范围 ESLint 与差异检查通过。没有修改产品的并行生成行为、添加等待或放宽断言。

正式全量 IDE 验收仍未执行，需在合并后的干净主工作树重建后运行；本报告中的历史 Stable 失败与环境边界不因远端 CI 通过而改写。
