# 2026-10-11 全仓依赖兼容升级

按已确认的最新兼容稳定版策略执行，评估覆盖 236 份自有 npm 清单、269 个外部依赖，以及 Rust、包管理器和 GitHub Actions。版本依据本轮官方 npm registry、crates.io 和工具发布元数据。保留公开 peer 范围、各包最低运行环境、历史兼容 fixture 和 latest 哨兵。

## 版本变化

共调整 28 个 npm 依赖名称、36 处直接声明，涉及 11 份 npm manifest 或 catalog。@vitejs/plugin-vue 6.0.10 是评估中确认的兼容补丁；初始化 fixture 的 weapp-tailwindcss 对齐工作区既有 5.6.0。应用、模板通过 catalog 消费更新，并运行现有 workspace、weapi 和脚手架同步脚本。

| 依赖 | 升级前声明 | 升级后声明 |
| --- | --- | --- |
| @ai-sdk/anthropic | 4.0.76 | 4.0.78 |
| @ai-sdk/openai | 4.0.89 | 4.0.91 |
| @ai-sdk/openai-compatible | 3.0.66 | 3.0.67 |
| @iconify-json/vscode-icons | ^1.2.86 | ^1.2.87 |
| @oxc-node/cli | ^0.1.4 | ^0.1.6 |
| @oxc-node/core | ^0.1.4 | ^0.1.6 |
| @types/lodash | ^4.17.25 | ^4.17.26 |
| @types/node | ^26.6.4 | ^26.6.5 |
| @types/react-reconciler | 0.33.1 | 0.34.0 |
| @vercel/detect-agent | ^1.2.5 | ^1.2.6 |
| @vitejs/plugin-vue | ^6.0.9 | ^6.0.10 |
| @vue/language-core | ^3.3.12 | ^3.3.13 |
| @vue/language-plugin-pug | ^3.3.12 | ^3.3.13 |
| ai | 7.0.133 | 7.0.137 |
| dotenv | ^18.0.6 | ^18.0.7 |
| express | ^5.2.1 | ^5.3.0 |
| happy-dom | ^20.14.5 | ^20.14.6 |
| prettier | ^3.9.9 | ^3.9.10 |
| repoctl | 5.10.0 | 5.10.1 |
| rolldown-plugin-dts | 0.28.6 | 0.28.7 |
| rollup | ^4.64.2 | ^4.64.5 |
| tsdown | 0.23.0 | 0.23.1 |
| vite-plugin-inspect | ^12.0.2 | ^12.1.0 |
| vue-echarts | ^8.3.1 | ^8.3.2 |
| vue-tsc | ^3.3.12 | ^3.3.13 |
| weapp-tailwindcss | ^5.5.12 | ^5.6.0 |
| why-is-node-running | ^3.2.2 | ^3.2.3 |
| wrangler | ^4.148.0 | ^4.149.0 |

根 packageManager 从 pnpm 12.10.1 更新到 12.11.2；教程 CI 的 Bun 从 1.4.2 更新到 1.4.3；Rust serde_json 从 1.0.151 更新到 1.0.152，并同步 Cargo.lock。固定 Rust 1.99.0 和 Node 最低运行要求保持原样。9 个 GitHub Actions 的官方稳定版本及完整 SHA 已核查，无需修改。CONTRIBUTING.md 同步现有 tsdown、repoctl 基线。

## 保留项与补丁

- TypeScript 保持 6.0.3。历史 fixture 的 5.6.1-rc、5.9.3 解析集合也保持原样。Volar 和 React renderer 类型通过正式 package typecheck 与公开类型检查验证。
- pixelmatch 保持 7.2.0，避免改变截图比较算法及 diffPixels、diffRatio 和门限语义。
- 保留 VitePress 2.0.0-alpha.20、vite-tsconfig-paths 7.0.0-alpha.3 的既有预发布基线；不降级到旧稳定主线。
- Vite 8.3.4、Rolldown 1.2.13、Vue 3.5.43、React 19.3.0 已为评估时的稳定版本。Vite/Rolldown 补丁保持原样，Rolldown 单版本检查通过。
- 将 @icebreakers/monorepo 补丁从 5.10.0 迁移至 5.10.1，保留两个发布说明分类修复：显式 change intent 的类型优先，正文提及依赖版本时不覆盖修复摘要。5.10.1 已包含发布 PR 去重更新行为，因此删除第三个重复补丁；现有分类和 GitHub PR 回归验证保留。
- Prettier 只升级声明，格式校验使用 ESLint。没有新增跨范围 override、peer 忽略或审计忽略项。

后续已在上游修复并发布 5.10.2，本仓库升级后移除了剩余补丁，详见 [上游修复与补丁移除报告](./2026-10-11-repoctl-upstream-fix.md)。

完成范围内解析刷新、dedupe 和冻结安装后，共 174 个外部包的版本集合变化；独立 npm runner 有 2 个间接包更新，miniprogram-ci 保持 2.1.31。详见 [解析版本清单](./2026-10-11-dependency-resolved-versions.md)。

## 验证结果

本地环境为 macOS ARM64、Node 26.10.0、pnpm 12.11.2。依赖安装后先验证包级类型、公开类型和定向回归，重建当前包产物后验证下游。下表只将实际完成的检查计为通过。

| 验证范围 | 结果 |
| --- | --- |
| pnpm 12.11.2 frozen install、独立 runner npm ci --ignore-scripts | 通过 |
| workspace、weapi、create-weapp-vite catalog 同步和 Rolldown 单版本 | 通过 |
| 受影响包 typecheck | 45/45 个任务通过 |
| 公开类型 test:types | 77/77 个任务通过，其中 43 个有效缓存命中 |
| Volar、React renderer、AI provider、CLI 和脚手架定向单测 | 14 个文件、103 项通过 |
| repoctl 发布分类、PR 更新与发布流程回归 | 13 个文件通过，179 项通过、1 项按原配置跳过；发布输出来自 mock fixture |
| 包产物构建 | 46/46 个任务通过 |
| 应用和模板构建 | 76/76 个任务通过，其中 33 个有效缓存命中 |
| 网站构建 | 通过，包含客户端、SSR 和静态页面生成 |
| Oxc Node CLI/core 启动 smoke | 通过 |
| native correctness | Rust 1.99.0 release 构建与 55 项 JS native 测试通过 |
| Cargo 锁定测试 | release --locked --offline 通过；当前 crate 没有内置 Rust 测试 |
| 全仓单测 | 1,639 个文件、15,442 项通过；13 个文件、20 项按原配置跳过 |
| pnpm/npm 严格消费者安装和 TS6、CSS 转换语义 | 两种包管理器均通过 strict peer 与 engine 校验，三种路径解析模式零类型诊断 |
| Agent CLI 打包消费者、无模型验收与 stdio MCP | 通过，包含持久化报告及显式 skill 安装 |
| Vite/Rolldown hooks、watch、关闭和引用释放契约 | 通过，Vite 16 项检查、Rolldown 8 组契约 |
| headless gate 与 React runtime | gate 的 6/6 个任务、14 项通过；React hooks、宿主事件和互操作 3 项通过 |
| Web 浏览器 suite | 17 个文件、122 项通过，Playwright 1.64.0 配套 Chromium 156.0.8078.4 |
| 网站主题浏览器回归 | 7 项通过，覆盖 Mermaid、主题切换、导航、搜索、复制和下载 |
| 改动范围 ESLint 与发布一致性检查 | ESLint 零错误，保留 apps/vite-native 原有 lodash warning；42 个包元数据、依赖协议及 intent frontmatter 通过，提交后按升级前基线检查 catalog、create-weapp-vite、可发布包、constants 和 VS Code 联动均通过 |

包级 typecheck 包括全部相关 package，公开类型检查包括库、runtime、mpcore 与 lib-mode 消费者；任务数包含构建、prepare 等依赖任务，并非均为独立 tsd suite。固定 native profile 在 Rust 1.99.0 release 上完成，160 次测量、20 次预热：组合分析 JS 基线 5.215 ms、native 0.197 ms；直接批量调用 0.110 ms，8 份源码批量调用 0.803 ms。测量期间另一项工作树验证短暂运行，该 profile 仅用于当前正确性与性能基线记录，不作为孤立环境下的跨版本性能比较。没有扩大 native 覆盖，粗粒度批量接口、显式启用和 JS fallback 保留。

主要复现命令如下；E2E 入口依次运行，并在每次启动前检查活动进程和机器租约。真实 IDE 不在这组已运行命令中。

```sh
pnpm install --frozen-lockfile
pnpm test --maxWorkers=2
pnpm test:types --concurrency=2
pnpm test:release --maxWorkers=2
pnpm build:core --concurrency=2
pnpm build:apps --concurrency=2
pnpm --filter website-weapp-vite build
node packages/weapp-vite/scripts/verify-dependency-install.mjs pnpm
node packages/weapp-vite/scripts/verify-dependency-install.mjs npm
pnpm --filter @weapp-agent/cli test:pack
pnpm test:dependency-contracts
pnpm e2e:ide:headless:gate
WEAPP_VITE_E2E_RUNTIME_PROVIDER=headless pnpm vitest run -c e2e/vitest.e2e.headless.config.ts e2e/ide/react-runtime-spike.runtime.test.ts
pnpm e2e:web
node --import tsx e2e/scripts/run-e2e-commands.ts pnpm --filter website-weapp-vite test:browser
```

## 审计与验收限制

pnpm audit 从 48 项降至 47 项（low 5、moderate 18、high 17、critical 7）；Wrangler 上游更新消除 sharp 的一项高危告警。独立 npm runner 仍为 86 项（low 1、moderate 27、high 17、critical 41）。剩余上游约束和既有 peer 冲突见 [审计差异](./2026-10-11-dependency-audit.md)。

真实 IDE 验收未完成。2026-10-11 02:15:57（UTC+8）从 [官方版本配置](https://devtools.wxqcloud.qq.com.cn/WechatWebDev/nightly/versions/config.json) 查询 Stable 为 2.02.2608080。Computer Use 只读核验当前运行宿主为 2.02.2610092 Nightly，基础库 3.16.3，打开非本任务拥有的 stateful-hmr 项目、pages/native/index 页面，显示 STATEFUL-NATIVE-BASE、计数 0。该窗口和宿主均已保留，没有使用 Nightly 替代 Stable，也没有关闭用户项目。

AGENTS.local.md 要求真实 IDE task 在冷宿主下认领所有权；当前已有归属不明的 Nightly 项目不满足该门禁。完整真实 IDE gate 还要求根 main 工作树干净且 HEAD 等于 origin/main，本轮尚未合并的依赖改动不满足该条件。因此没有运行真实 IDE 场景，headless 和浏览器通过不能替代真实 IDE 验收。Windows/Linux 矩阵未运行，跨平台结论以实际 CI 为准；本地没有安装 Bun，教程 Bun 安装路径尚未运行。

## Change intent 与交付

本轮依赖和生成 catalog 会影响发布消费者及模板，因此沿用现有依赖升级、catalog change-intent 生成策略，合并为一份中文 patch intent，覆盖 42 个可发布包并联动 create-weapp-vite。提交类型为 chore(deps)，仅本地提交，不推送或发布。Husky 与 lint-staged 正常执行，暂存文件的 ESLint 检查通过；运行后生成的 suite 报告及 Web 支持文件变化已从提交范围清理。
