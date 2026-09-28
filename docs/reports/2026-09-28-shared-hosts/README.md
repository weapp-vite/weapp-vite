# HMR / Tailwind 双宿主拆分验证

基线：`af7030aa44c179a6a768470874b20b55365dc6b1`（已合入 #1090 的 main）。本报告描述未发布的实验接入，不宣称性能获得提升。

## 实现与边界

- `@weapp-vite/hmr` 提取编译协作、固定输入、资产提交与交付内核，保留每个 client、序号、重复 filename、其他补丁元数据和独立 sourcemap。
- `@weapp-vite/tailwindcss` 使用 `weapp-tailwindcss/core`，宿主提供预处理、模块图、样式策略、监听及原生 emit/write。
- weapp-vite 的配置与 prepareHmr 类型兼容。Taro 沿用现有 RxJS 调度入口、PatchJournal、React Refresh、运行时模式和页面生命周期；每个原始编译回调分别封存样式投影。
- Taro 适配以固定源码版本和补丁交付，`integrations/shared-hmr-tailwind/prepare.mjs` 已从全新 clone 执行成功。补丁不包含本地 tarball override。
- 仓库外系统临时目录的独立安装及原生构建通过，完整 weapp-vite 明确无法解析。宿主通过 override 对齐 Vite 与 Taro 的 Rolldown 1.2.9；weapp-vite 继续使用 1.2.10。公共包不依赖或创建引擎。

## 已修复的公共边界

1. 上游 core 的前缀预检漏掉显式快照候选，协议相对 URL 被误转义，JS 换行被模板规则删除。最小复现先失败，修复提交至 [weapp-tailwindcss #1250](https://github.com/sonofmagic/weapp-tailwindcss/pull/1250)，294 项 JS 回归、构建及 tsd 通过。实验安装使用此源码构建及配套 PostCSS 包。
2. Rolldown native sourcemap 的不可枚举 getter 被对象展开丢失。现在显式读取映射字段，并保留重复 filename 各自的映射。
3. 资产状态保护已经转交给宿主 chunk 的同名文件，避免错误删除；部分写出失败仍触发可靠性失效和后续恢复。
4. mpcore 销毁后，已排队 Promise 再注册计时任务会向外泄漏异常。内核取消已销毁 realm 的新任务，外部页面句柄仍严格失效；先失败回归、kernel、浏览器回归和公开类型测试通过。
5. automator 接受纯主包应用省略可选 subPackages 字段，仍拒绝错误类型和缺失页面产物；两项针对性启动契约通过。

## 最终验证

| 观察面 | 结果 |
| --- | --- |
| 共享包与 weapp-vite 定向单测 | 72 项通过；资产所有权子集 53 项通过 |
| Taro 宿主、样式与真实 DevEngine | 146 项通过；最终批次边界的 20 项复跑通过 |
| 类型、构建、ESLint、stylelint | 两新包、weapp-vite、mpcore 和相关适配通过；网站构建通过 |
| 微信/支付宝/抖音生产构建 | 三目标通过，检查页面文件、转义 CSS/JS 和 sourcemap |
| Taro headless | 两场景、6 个 DOM 检查点通过 |
| Taro 真实微信 | 两场景、6 个 DOM 检查点通过：可见颜色、状态、事件更新与恢复；真实 startup/applied 回报；零运行时错误 |
| weapp-vite #1081 headless | 通过，覆盖类名增删、扫描来源、主题、JS-only 不重写样式与映射 |
| weapp-vite headless 状态保持 | 六场景通过：监听排除、计算/事件、三种模板往返、Wevu 脚本与 store |
| weapp-vite 微信脚本状态保持 | 原生连续编辑恢复及 Wevu local/store 恢复通过；最终资产内核变更后原生场景再次通过 |
| DOM 清单 | 114 tasks、302 cases、0 missing，使用生成脚本更新 |
| 独立安装 | 仓库外真实 tarball 安装与原生构建通过；完整 weapp-vite 不可解析 |

## 保留的失败与归因修正

weapp-vite 拆分版本和未拆分 main 在 #1081 首次颜色更新均失败：初始粉色正常，更新后新颜色计算为透明。既有原生对照见 [宿主样式交付报告](../2026-09-25-wxml-performance/followup/issue1081-native-style-delivery.md)。该观察针对当前 weapp-vite 更新路径，拆包没有修复它，也不能推广为所有宿主 HMR 的限制。

早期 Taro 子进程继承了 Vitest 的 `NODE_ENV=test`，导致仅在 development 执行的缓存初始化被关闭，同时干扰真实样式验收。最终复用仓库 `createDevProcessEnv`，保持原有 Taro 生命周期后，真实微信完整两场景通过。临时缓存传递/页面描述符改动全部撤回，未进入最终适配补丁。历史失败及中间实验保留在归档中，不能用于宣称修复了 Taro 产品或宿主缺陷。

独立安装还发现全新解析会令 Vite 选择比 Taro 更新的 Rolldown；验证保留 Taro 的版本拒绝机制，并由宿主显式固定版本。没有让公共包引入另一份引擎或绕开版本检查。

## 维护与发布

共享包按协议、批次、资产和编译控制器拆分。宿主既有大型 session、dev-host 与样式插件仍保留单实例闭包，避免拆文件时产生第二个监听/交付所有者；公共状态已经移入独立包。

这是未发布的实验版本。正式 npm 依赖必须包含上游 core 修复；#1081/#1082 保持开放。支付宝、抖音只验产物，不承诺其运行时 HMR。已有完整重同步路径仍为完整重同步，Nightly 与既有性能结果不改写。

脱敏日志及 DOM 报告见 `evidence.json.gz`，原始日志 SHA-256 随归档保留。


解压后 2495643 bytes，SHA-256 `5fcabcf0a8d2e3d532e6e89cf49e2f34a67a1a2826965d16a6a083f1141b88b8`。

公开 sourcemap 开关及转换结果类型已补回归：关闭映射时不生成/消费映射，代码与映射字段在转换后拓宽，其他元数据保留原类型。相关 13 项内核测试和公开 tsd 通过。


## CI 准备流程补充

首个 PR HEAD 的三系统新增宿主 job 均在 Taro 依赖准备阶段报 `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`，尚未进入用例。原因是临时 clone 注入本地 tarball 后，CI 默认启用了冻结安装。修正仅对这些生成的验证目录使用 `--no-frozen-lockfile`；主仓库与固定上游基线继续冻结安装。

冷环境还要求在打包前显式构建 Taro 插件本身，准备脚本已包含该步骤。以 `CI=true` 在新 clone 中完成准备、类型检查和仓库外独立安装/原生构建，均通过。该调整不修改产品或放宽运行时断言。
