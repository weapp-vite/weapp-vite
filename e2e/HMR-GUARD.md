# HMR Guard Suite

这组测试用于保护 `weapp-vite` 的开发态热更新体验，重点关注“编辑后是否正确更新”和“更新范围是否异常放大”。

## Windows 本地前置

Windows 上先运行 `pnpm e2e:build-tools` 显式构建私用进程检查器，再运行 HMR、E2E 或复用 dev controller 的性能脚本。非 Windows 平台无需该产物。此命令保留原 30 秒编译预算，失败直接报告；测试运行时只校验源码、编译参数、协议、可执行文件 SHA 及 CI 来源，不会编译或预热。

CI 在当前构建 job 生成检查器并随冻结 artifact 传递；consumer 使用 `pnpm e2e:build-tools -- --check` 仅校验。缺失、过期或来源不符时在 dev 子进程启动前失败，并提示重新显式构建。清理保留独立总期限，超时取消当前持有的检查器并等待原生 close 与输出排空；身份未确认时保持失败及登记，不放宽后代终止权限。

## 入口

全量 HMR 护栏：

```bash
pnpm run e2e:hmr:guard
```

本地快速 smoke：

```bash
pnpm run e2e:hmr:guard:smoke
```

查看分组包含了哪些文件：

```bash
pnpm run e2e:hmr:guard:config
```

这个命令会打印 suite manifest，而不是直接执行测试。

## 稳定验收与实验诊断

微信目标的 `auto` 在热重载开启且能力满足时使用状态保持模式，`stateful-experimental` 显式请求该模式，`classic` 保持完整重载。安全脚本更新保留实例；模板、样式、配置、拓扑和不兼容注册在当前 dev 会话内切换并保持 classic，重启后重新检测。正式 `pnpm test:hmr`、`pnpm e2e:hmr:build`、`pnpm e2e:hmr:headless`、`pnpm e2e:ide:hmr` 和 `pnpm e2e:hmr:acceptance` 验证版本化支持清单；完整功能验收使用 `pnpm e2e:ide:full:exhaustive`。范围内仍要求原有更新、事件、DOM 和源码恢复断言全部通过。

状态保持身份、事务交付和在线 stateful→classic 交接纳入正式支持清单；旧 `:diagnostic` 入口保留兼容。完整发布仍须以新 runtime、实际页面数据、DOM、样式和后续交互验收，文件写出和重连不能替代完成。产品 classic 日志只报告 `output-published` / `runtime-unconfirmed`，不提供完整重载的自动 runtime ACK。构建和 headless 通过也不能代替真实 IDE 自动刷新验收。

## 覆盖范围

- `e2e/ci/hmr-modify.test.ts`
  验证页面与组件在模板、脚本、样式、JSON、SFC 修改后的输出更新。
- `e2e/ci/hmr-layouts.test.ts`
  验证 layouts 页面及 `src/layouts/default|admin` 在模板、脚本、样式、JSON 修改后的输出更新。
- `e2e/ci/hmr-layout-shared-template-wxs.test.ts`
  验证 layout 引用的共享 template/include/WXS 变更后，layout 及共享产物会一起增量更新。
- `e2e/ci/hmr-rename.test.ts`
  验证编辑器常见 rename-save 流程不会打挂 dev 过程。
- `e2e/ci/hmr-shared-template-wxs.test.ts`
  验证页面与 SFC 共享 template/include/WXS 依赖变更时，所有 importer 都会同步更新。
- `e2e/ci/hmr-shared-runtime-deps.test.ts`
  验证共享运行时脚本在 rename-save 与连续快速保存后，`common.js` 及多个 importer 仍保持一致，不会出现共享导出丢失。
- `e2e/ci/hmr-rapid.test.ts`
  验证连续快速保存后最终产物收敛到最后一次修改。
- `e2e/ci/hmr-add.test.ts`
  验证新增页面/组件文件时 dev 过程稳定。
- `e2e/ci/hmr-delete.test.ts`
  验证删除页面/组件文件时 dev 过程稳定。
- `e2e/ci/hmr-app-config.test.ts`
  验证 `app.json` 的 window/pages 更新能在 dev 下生效。
- `e2e/ci/hmr-package-scripts.test.ts`
  验证 `e2e-apps` 与 `apps` 代表项目通过 package `dev` 脚本启动后，原生页面与 Vue SFC 的 dev-watch 热更新仍能写入产物。
- `e2e/ci/auto-routes-hmr.test.ts`
  验证 auto-routes 在 dev 下维护 `typed-router`、`app.json`、`app.js`，并对已有页面修改保持增量更新。
- `e2e/ci/auto-import-vue-sfc.test.ts`
  验证 auto-import 维护 `usingComponents`，并对单页改动保持增量更新。
- `e2e/ci/style-import-vue.test.ts`
  验证 Vue SFC 内 `@import` / `style src` 引入的样式依赖在 dev watch 下更新后，目标 wxss 会同步热更新。
- `e2e/ci/hmr-shared-chunks-auto.test.ts`
  验证 `hmr.sharedChunks = 'auto'` 下的直接 entry 更新与共享依赖扩散路径。
- `e2e/ci/wevu-runtime.hmr.test.ts`
  验证 wevu 运行时 HMR 的页面级行为。

## 分组策略

- `e2e:hmr:guard`
  串行执行稳定子集：`hmr-modify`、`hmr-html-template`、`hmr-layouts`、`hmr-layout-shared-template-wxs`、`hmr-shared-template-wxs`、`hmr-rename`、`hmr-shared-runtime-deps`、`hmr-rapid`、`hmr-add`、`hmr-delete`、`hmr-app-config`、`hmr-package-scripts`、`issue-340-comment.hmr`、`style-import-vue`、`wevu-runtime.hmr`。
- `e2e:hmr:guard:smoke`
  串行执行本地高频回归子集：`auto-import-vue-sfc`、`auto-routes-hmr`、`hmr-rename`、`hmr-rapid`。
- `e2e:hmr:guard:auto-import-vue-sfc`
  单独执行 `auto-import-vue-sfc`。这个用例对前序 dev-watch 状态更敏感，独立运行可以避免 Windows 下的串行污染假红。
- `e2e:hmr:guard:auto-routes-hmr`
  单独执行 `auto-routes-hmr`。这个用例会同时触发路由拓扑与 app 级联更新，保持独立运行更稳定。
- `e2e:hmr:guard:shared-chunks-auto`
  单独执行 `hmr-shared-chunks-auto`。这个用例对命令入口和进程清理顺序更敏感，不并入主串行 suite。
- `e2e/vitest.e2e.hmr-guard.config.ts`
  保留完整 include 清单，便于查看和按需单独调用，但不建议直接把整组 dev-watch 用例塞进同一个 Vitest 进程运行。

## 运行建议

- 改动 `packages/weapp-vite/src/plugins/core/**`、`packages/weapp-vite/src/plugins/hooks/useLoadEntry/**`、`packages/weapp-vite/src/plugins/autoRoutes.ts`、auto-import 或 watcher 相关逻辑后，至少运行 `pnpm run e2e:hmr:guard:smoke`。
- 如果改动涉及 dev watch、HMR 发射范围、共享 chunk、`usingComponents`、路由生成或 `app.json` 同步，运行 `pnpm run e2e:hmr:guard`。
- 若先修改了 `packages/weapp-vite/src/**`，在跑 app/template/e2e 之前先执行：

```bash
pnpm --filter weapp-vite build
```

## 维护原则

- 对结构性变更场景，优先验证“最终行为正确”和“dev 过程不崩”。
- 对单页直接编辑场景，优先补日志级断言，防止退化成全量 HMR。
- 新增 HMR 回归时，先决定它属于稳定子集、smoke 子集，还是像 `auto-import-vue-sfc` / `shared-chunks-auto` 一样必须作为特例独立运行；然后更新 `e2e/scripts/hmr-guard-manifest.ts`，让入口、清单和文档保持同源。
- `pnpm e2e:ci` 会显式串行执行 `hmr-guard:full`、`hmr-guard:auto-import-vue-sfc`、`hmr-guard:auto-routes-hmr`、`hmr-guard:shared-chunks-auto`；若新增 HMR case 没被这四条入口覆盖，应视为 CI 漏挂。
- 完整 CI workflow 会把常规小程序 E2E 与 HMR guard 拆成独立 job：常规 job 使用 `ci-full:classic` 清单，HMR job 使用 `pnpm e2e:ci:hmr`，后者调用 `pnpm e2e:hmr:build` 的版本化支持清单。两者没有重复文件，并集与 `pnpm e2e:ci` 的完整清单一致，保留跨平台覆盖。旧 `e2e:ci:hmr:core` 和 `e2e:ci:hmr:all` 保留为诊断兼容入口。
- `e2e:hmr:guard` 与 `e2e:hmr:guard:smoke` 由 `e2e/scripts/run-hmr-guard-suite.ts` 统一驱动，采用“单文件 `vitest run` 串行 + 每段前显式 cleanup”的方式执行；不要把整组 HMR dev-watch 用例直接塞进同一个 Vitest 进程，否则不同文件的清理逻辑容易互相污染。

## 执行顺序与环境治理

1. 先检查 DevTools、automator、dev-watch 和本地验证 server；仅释放本任务登记且仍持有的资源，保留手动实例及归属不明的进程。所有流程保留开发者登录状态，不执行注销或清除登录数据。
2. 修改 package 源码后先执行 `pnpm --filter <package> build`，再运行下游 fixture、headless 或 IDE 验证。
3. 用 `--allow-failures` 做故障发现，定位完成后用严格模式重新执行作为验收。
4. 先跑 headless/provider-compatible runtime，具备真实 IDE 基础设施时再跑 WeChat DevTools；同一 e2e-app 在一个 suite 内只启动一次 automator，通过 `miniProgram.reLaunch(...)` 切换场景。
5. macOS 长时间 IDE suite 使用 `caffeinate -dimsu -- ...`，避免休眠造成假失败。

登录态保护适用于测试准备、故障注入、诊断、恢复和 teardown：禁止向真实 IDE 发送 `logout` / `signout`、切换账号，或删除、覆盖、复制账号凭据、认证配置与登录 session。未登录和凭据失效分支只用 mock 或独立临时假数据验证。自动缓存恢复仅允许编译缓存，不调用 `cache --clean all/auth/session`。正常关闭项目或退出 IDE 进程须保留登录数据；遇到自然失效时保留错误并交由用户登录，不先清空状态再重试。现有 CLI 保护和启动重试单测必须在调用宿主前拒绝注销与账号缓存清理。

真实 DevTools 的可观察 runtime 结果是最终验收标准。模拟器、服务端口、登录、协议连接失败等宿主能力或基础设施限制必须单独记录，不得改写成产品通过；headless 只能用于缩小问题范围和保持 provider-compatible 覆盖。

## 断言边界

- 断言实际 emitted JS 中的公开 marker、最终执行结果和模块语义；扫描全部 `.js` 文件，不绑定 `common.js`、chunk hash、压缩名或内部 helper。
- alias 依赖必须进入 Rolldown/module graph，初始构建和 app/layout/page/dependency HMR 后都不能留下可执行的 `require("@/...")` 或 alias import。
- 旧 marker 必须在更新后的 emitted 输出中清除，避免 stale shared chunk 被误认为通过。
- `fetch`、`queueMicrotask`、`URL` 等能力通过 DevTools/SDK 探针记录。缺失宿主能力、服务端口、模拟器或协议连接失败单独记录为环境限制，不弱化真实 runtime 断言。
- `app-vue-hmr-alias` 的 stateful transport 场景与 classic 交接均由正式清单覆盖；headless VM 重建只证明 companion 行为，真实 IDE 必须在既有 owner 中自动刷新。

## 运行建议

- 改动 `packages/weapp-vite/src/plugins/core/**`、`packages/weapp-vite/src/plugins/hooks/useLoadEntry/**`、`packages/weapp-vite/src/plugins/autoRoutes.ts`、auto-import 或 watcher 相关逻辑后，至少运行 `pnpm run e2e:hmr:guard:smoke`。
- 如果改动涉及 dev watch、HMR 发射范围、共享 chunk、`usingComponents`、路由生成或 `app.json` 同步，运行 `pnpm run e2e:hmr:guard`。
- 若先修改了 `packages/weapp-vite/src/**`，在跑 app/template/e2e 之前执行：

```bash
pnpm --filter weapp-vite build
```

## 维护补充

- 新增或修复 issue 时，先在隔离 worktree 中用最小 fixture 复现，再同步 unit、headless 和真实 IDE（可用时）覆盖。
- 真实 DevTools 与 `mpcore` 出现差异时保留 IDE 断言，并在对应 `mpcore/packages/*` 增加等价回归；不得通过跳过或归一化有意义的行为来消除差异。
