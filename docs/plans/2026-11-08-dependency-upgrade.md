# 2026-11-08 全仓依赖升级

基线为 `868b4bfc5e96f960bd4e0c07a7fa8a00376bcf9d`。评估覆盖 274 份 npm 清单、285 个外部包名，以及工作区、应用、模板、网站、扩展、独立 CI runner、Cargo 与 Actions；执行前重新查询官方版本并冻结候选。本轮仅处理新增或恶化的回归。

交付前快进同步主线 `3b8620fc3c36cb242142570f7fbb4fa2fdb7da6d` 的 classic HMR 修复，未覆盖该提交；重新构建 weapp-vite 并验证对应回归。

共享工具链正式发布后，继续快进同步 `d3b5ae5c97f00d46572aad175cd131cca4c2ea7c` 的 simulator 文件文本断言修正，再进行本轮最终升级。

版本冻结于 2026-11-07 19:13 UTC。验收末次查询时，AI SDK 又发布了 `ai@7.0.165`、`@ai-sdk/openai@4.0.111`、`@ai-sdk/anthropic@4.0.99` 和 `@ai-sdk/openai-compatible@3.0.87`；它们晚于本轮冻结查询，本轮保留已冻结并验证的版本，不在验收期间追逐持续发布。

## 接受的升级

| 依赖 | 原版本 | 目标版本 |
| --- | --- | --- |
| weapp-tailwindcss | 5.7.1 | 5.7.2 |
| @weapp-tailwindcss/engine | 0.1.7 | 0.1.8 |
| miniprogram-api-typings | 5.2.3 | 5.3.1 |
| sass-embedded | 1.107.1 | 1.108.1 |
| hono | 4.13.16 | 4.13.17 |
| supertest | 7.3.1 | 7.3.2 |
| repoctl / @icebreakers/monorepo | 6.4.0 | 6.4.4 |
| @icebreakers/eslint-config | 8.0.12 | 8.0.15 |
| @icebreakers/stylelint-config | 5.1.5 | 6.0.1 |
| stylelint | 17.16.0 | 18.0.0 |

保留 catalog、精确版本、`^`、`~` 与公开 peer 下限的声明形式。同步锁文件、脚手架内置 catalog、现行 vite-native fixture 的 Tailwind 4.3.5 / weapp-tailwindcss 5.7.2，以及中文 changeset。

官方 `sass-embedded-win32-x64@1.108.1` tarball 的 SHA-512 与 registry 一致，已恢复 1.108.0 缺少的 `sass.bat` 和 `sass.snapshot`，因此移除旧 `<1.108.0` 临时限制。真实 Windows 执行结果由主线矩阵验证，文件存在性不能替代运行验收。

## 类型兼容

重建 `@weapp-core/types` 后同步验证消费声明，避免使用旧平台类型快照。typings 5.3.1 补充的可空宿主查找返回值由滚动恢复类型接受，运行时已有的空值终止逻辑保持一致。编译配置同步 `dynamicSlots`、`dataDeepCopy`、`propertyPassingDeepCopy` 和 `propertyEarlyInit`；生命周期 `error` 参数按上游声明为 `unknown`，通过类型收窄后使用。

微信 API 清单从 495 增至 501，新增 `copyRealname`、`getStoreTraceId`、`openPhotoTopicView`、`requestAutomaticRepayment`、`saveMediaToPhotosAlbum`、`verifyHKPaymentPassword`。新增 tsd 覆盖 Promise 结果、回调、必填参数和非法媒体类型；同步支持矩阵。生成 API 分片遵循现有生成器，不清理历史遗留分片。

## 保留的版本与范围

| 项目 | 决策与原因 |
| --- | --- |
| TypeScript 6.0.3 | 按用户选择保留，不迁移新版编译器。 |
| Vite 8.3.5 | 沿用已有生命周期兼容边界；8.3.6 的 web optimizer 关闭后临时缓存问题仍未解决，历史验收例外不扩展到新版本。 |
| Rolldown 1.2.16 | 1.3.0 超出 Vite 8.3.6 官方 `~1.2.16` 配对范围；保持单版本。 |
| local-pkg 1.2.1 | 2.0.0 官方声明仍引用未声明的 `Args`，不放宽类型检查。 |
| 工具链与 Actions | Node、pnpm、Rust、Bun、12 个 Cargo 直接依赖和 12 个 Actions 引用未发现适用新增目标。固定工具链与教程兼容下限保持原用途。 |
| 历史和外部内容 | 历史 fixture、外部 upstream、性能基线及公开 peer 最低版本不按 latest 改写。 |

## 共享工具链上游发布

按用户要求，先在 repoctl 仓库完成 [#1153](https://github.com/icelib/repoctl/pull/1153)：将本仓库发布恢复、超长 PR 与安全错误诊断补丁迁入源代码，并修复 Stylelint 18 的严格消费兼容。该 PR 通过九组 OS/Node 矩阵、两组开发容器及全部适用原生门禁后 squash 合并。[版本 PR #1160](https://github.com/icelib/repoctl/pull/1160) 再次通过九组矩阵和原生门禁，发布源码为 `248d96857f3f841136360e093957eecb164d094c`；[文档 PR #1161](https://github.com/icelib/repoctl/pull/1161) 同步恢复目录说明。

[正式发布运行](https://github.com/icelib/repoctl/actions/runs/42425952816) 的 plan、verify、prepare、upload、confirm、finalize 六阶段全部成功。四个公开包的精确版本、latest 标签、integrity、内部依赖和 GitHub tag/release 来源均已核对。私有 mock 应用的版本传播不属于 npm 发布目标。

使用正式 npm 包在隔离项目安装 repoctl 6.4.4、两份配置、ESLint 10.14.0、Stylelint 18.0.0、TypeScript 6.0.3，严格 peer 安装通过；没有消费端 peer override 或源码 tarball 替换。CSS、SCSS、Vue、WXSS 正反例、属性排序修复、ESLint 样式桥接、原生 ESLint、repoctl 公共 API 与 CLI 均通过。

样式配置在构建时打包固定的 SCSS 插件及不兼容的预设实现，保留许可证与兼容的运行时依赖；SCSS 指令交由专用规则校验，并关闭不能理解 Sass 组合表达式的 CSS `value-no-invalid` 规则，其他单位、颜色、命名和指令规则继续验证。最初失败的严格 peer 组合已由上述正式版本解决。

本仓库移除 `@icebreakers/monorepo@6.4.0` 补丁和登记，保留发布公共行为回归；同步 bootstrap、自动 changeset、snapshot build/publish 的精确工具版本与 builder 哈希。零售模板 21 个 Vue 文件将 49 段完整静态 class 移到静态属性，保留动态表达式及动态类名前缀，适配新 ESLint 规则。已有大型 SFC 仅调整 class 声明，不增加职责，保留原组件边界。

正式版本消费后，48 项包构建、80 项应用和模板构建、319 项 class/style 编译测试、381 项脚手架测试，以及 1884 份受管样式扫描通过；脚手架源码类型、冻结安装、Rolldown 单版本、catalog 和 74 项 workflow/changeset 定向检查通过。发布消费上下文测试适配新版 bundle 的模块边界注释，20 项原有行为断言全部保留并通过。

本地发布回归另有一项升级前已存在的失败：公开类型清单将历史忽略目录 `test-d/.tmp-tsd/` 计入真实契约。工作流检查有 782 项通过、7 项既定跳过，一项基础设施 suite 被旧机器租约阻断；不把这些入口记录为全量通过。首次主线 CI 中的 Windows 发布路径断言、Bun 退出日志缺失和 HMR request 示例退出清理问题，均保留升级前对照证据；最终版本仍需核对本轮主线检查。

## 本地验证

- 升级前 Tailwind：64 项包测试及 360 项集成测试通过；wevu 源码类型检查通过。
- 升级后 Tailwind：49 文件、424 项测试通过，包含缓存、动态颜色及真实构建。
- Sass 编译、生命周期与退出、滚动恢复：10 文件、51 项测试通过。
- API：340 项测试及普通、pure、isolated 公开类型检查通过。
- wevu：源码类型检查和完整公开类型契约检查通过，包括 host 与 pure 隔离入口。
- `pnpm build:pkgs:ci`：48 项任务通过；`pnpm build:apps`：80 项任务通过，包含应用和模板。
- 网站构建及 31 项单测通过。
- 全工作区 `pnpm test:types`：88 项构建与公开类型任务全部通过；隔离基线的 wevu 公开类型检查也通过。
- 脚手架与初始化器：41 文件、445 项测试通过。
- 冻结锁文件离线安装通过；catalog、API 与脚手架同步完成，Rolldown 仅 1.2.16。
- 变更文件 ESLint 及 changeset ESLint 通过。
- ESLint 回退后重新冻结安装、同步 catalog、重建脚手架并通过 32 项版本测试；同步主线后 weapp-vite 重建、10 项 HMR 回归及 vite-native 构建通过。其余未受影响的检查复用已通过证据。
- 安全审计升级前后 advisory 集合相同，无新增或消除；既存 low 7 / moderate 23 / high 18 / critical 8，审计退出码仍为 1。

提交与推送使用仓库原生 Lefthook，不绕过提交前 lint、staged typecheck 或待推提交快照 quick 检查。最终 hooks 与远端 CI 结果随提交交付记录。

首次主线 CI 的 Node 22 / 24 Weapi 兼容检查均通过 API 测试、源码和公开类型检查，最后因兼容报告仍为 495 项而失败。补齐五份报告至 501 项；两种 Node 版本的生成结果完全一致，逐文件校验内容哈希、全量方法清单及新增接口矩阵。补充提交仅同步报告，不改变源码行为；后续检查结果随最终提交交付。

## 未完成的本地 runtime 验收

依赖契约与 headless 标准 runner 均在业务场景开始前被机器串行门禁拒绝：`Runtime busy: an E2E command scope has unfinished cleanup`。旧任务 owner 已停止，但清理 scope 未完成且不属于本轮，保留其租约与 journal，未删除、接管或另设 state 目录绕过。Computer Use 应用清单确认微信开发者工具未运行，未为检查退出而启动它；受管租约未取得，不能执行宿主恢复或新开测试窗口。

正式完整 IDE 验收要求提交推送后在同步、干净的根 `main` 串行运行并冻结源码。此处不将 headless、构建或类型检查写成真实 IDE 通过，最终交付应注明实际运行结果与主线 CI 状态。

升级提交正常推送后，已核对根工作树干净且与远端 `main` 一致，并在防休眠包装下实际启动 `pnpm e2e:ide:full`；同样被上述未完成清理的机器租约拒绝，未进入 runtime 场景，因此正式完整 IDE 最终验收未完成。

本轮手写源码均未超过 300 行；API 清单分片为生成代码，沿用现有生成器的分片边界。
