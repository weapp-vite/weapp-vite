# 2026-11-08 全仓依赖升级

基线为 `868b4bfc5e96f960bd4e0c07a7fa8a00376bcf9d`。评估覆盖 274 份 npm 清单、285 个外部包名，以及工作区、应用、模板、网站、扩展、独立 CI runner、Cargo 与 Actions；执行前重新查询官方版本并冻结候选。本轮仅处理新增或恶化的回归。

交付前快进同步主线 `3b8620fc3c36cb242142570f7fbb4fa2fdb7da6d` 的 classic HMR 修复，未覆盖该提交；重新构建 weapp-vite 并验证对应回归。

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
| repoctl 6.4.0 / Stylelint 17.16.0 / 样式配置 5.1.5 | 联合候选 6.4.1 / 18 / 6 在隔离项目、TypeScript 6.0.3 和严格 peer 安装下失败：recess-order、SCSS 与 recommended 配置尚不全部接受 Stylelint 18。repoctl 6.4.1 也未包含现行发布恢复、发布 PR 与安全错误处理补丁的完整语义，保留原补丁链。 |
| ESLint 配置 8.0.12 | 8.0.13 直接依赖样式配置 6，后者及 recommended 19 / standard 41 要求 Stylelint 18；独立严格 peer 安装确认无法与现行 Stylelint 17 共存，因此与样式工具链一并保留。 |
| 工具链与 Actions | Node、pnpm、Rust、Bun、12 个 Cargo 直接依赖和 12 个 Actions 引用未发现适用新增目标。固定工具链与教程兼容下限保持原用途。 |
| 历史和外部内容 | 历史 fixture、外部 upstream、性能基线及公开 peer 最低版本不按 latest 改写。 |

Stylelint 联合候选在严格 peer 门禁即失败，因此没有将未经兼容证明的配置带入工作区，也没有声称候选 CSS、SCSS、Vue 或 WXSS 规则验收通过。

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

## 未完成的本地 runtime 验收

依赖契约与 headless 标准 runner 均在业务场景开始前被机器串行门禁拒绝：`Runtime busy: an E2E command scope has unfinished cleanup`。旧任务 owner 已停止，但清理 scope 未完成且不属于本轮，保留其租约与 journal，未删除、接管或另设 state 目录绕过。Computer Use 应用清单确认微信开发者工具未运行，未为检查退出而启动它；受管租约未取得，不能执行宿主恢复或新开测试窗口。

正式完整 IDE 验收要求提交推送后在同步、干净的根 `main` 串行运行并冻结源码。此处不将 headless、构建或类型检查写成真实 IDE 通过，最终交付应注明实际运行结果与主线 CI 状态。

本轮手写源码均未超过 300 行；API 清单分片为生成代码，沿用现有生成器的分片边界。
