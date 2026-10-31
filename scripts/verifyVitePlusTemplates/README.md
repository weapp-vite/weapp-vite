# Vite+ 模板消费验收

入口为 `node scripts/verify-vite-plus-templates.mjs`。先构建并打包候选，再传入已经冻结的 tarball；脚本不会构建仓库源码，也不会使用仓库软链接依赖替代真实安装。

| 环境变量 | 作用 |
| --- | --- |
| `CREATE_WEAPP_VITE_TARBALL` | 必填，候选 `create-weapp-vite` 的 `.tgz` 路径 |
| `CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS` | 必填，包名到绝对 `.tgz` 路径的 JSON 对象；必须包含 `@weapp-vite/language-service`、`@weapp-vite/oxlint`、`@weapp-vite/oxfmt`、`@weapp-vite/eslint`，其他受影响的本地依赖候选也放入同一对象 |
| `CREATE_WEAPP_VITE_SOURCE_COMMIT` | 候选完整 Git commit；不提供时报告保持未知 |
| `CREATE_WEAPP_VITE_TARBALL_SHA256` | 可选，校验脚手架 tarball 的预期 SHA-256 |
| `VITE_PLUS_TEMPLATE_REPORT_DIR` | 报告父目录，默认 `.tmp/current-run/templates-vite-plus/consumers`；每次创建独立 `run-*` 子目录 |
| `VITE_PLUS_TEMPLATE_CASES` | 可选，逗号分隔的精确 case id；不提供时运行完整矩阵 |
| `VITE_PLUS_TEMPLATE_REGISTRY` | 安装源，默认 npm 官方源 |
| `VITE_PLUS_TEMPLATE_TIMEOUT_MS` | 单阶段超时，默认 600000 毫秒 |
| `VITE_PLUS_TEMPLATE_KEEP_WORKSPACE` | 显式设为 `1` 时保留临时消费者目录并打印路径；默认清理 |
| `CREATE_WEAPP_VITE_PNPM_VERSION` | 沿用 smoke 的 pnpm 版本选择，默认 `12` |

完整矩阵共十项：`pnpm/default`、`pnpm/wevu`、`pnpm/tailwindcss`、`pnpm/tdesign`、`pnpm/wevu-tdesign`、`pnpm/vant`、`pnpm/react`、`npm/default`、`pnpm/platforms`、`pnpm/workspace`。筛选只影响本次执行集合，报告仍保留完整矩阵，`fullMatrix: false` 不能作为十项全部通过的证据。

候选映射须覆盖本轮改动的传递依赖闭包。语言内核依赖 `@weapp-core/shared` 与 `@weapp-vite/ast`；其中有改动的包须先构建并提供 tarball，避免安装已发布旧包来验证新接口。构建验证同样需要本轮 `weapp-vite`、`@wevu/compiler` 等受影响包的候选。未改动的依赖可按清单中的正式发布版本安装；本地 workspace 链接不能代替 tarball。

各项目均通过候选脚手架实际生成，严格安装后依次执行 `lint`、`format:check`、`check`、可用时的 `lint:vue`、`stylelint`、`build`。安装阶段通过临时 overrides 消费本地候选；安装完成后恢复原始生成的 package/workspace 文件字节，再检查格式，不用自动修复掩盖模板问题。报告核对实际安装版本、lockfile tarball integrity 与 node_modules 链接归属。

恢复生成文件后，pnpm 质量命令使用 `verifyDepsBeforeRun: false`，保持已核验的候选安装，避免自动安装根据恢复后的版本声明重新解析依赖。安装阶段仍执行严格 peer、engine 和生命周期检查；脚手架自身的安装也覆盖同一候选依赖闭包。

workspace 用例先让脚手架生成一份独立项目，从中取得当前依赖与安装策略，再在父 workspace 生成真实成员；核对创建过程未改父文件。成员自身的 lint/fmt 分别通过后，添加专用探针证明 `vp check` 会使用根 lint/fmt 策略。探针无论成功或失败都会恢复。

`pnpm/platforms` 创建多平台模板，额外验证九种模板语言及其原生样式、脚本模块的组合 CLI：WXML、AXML、TTML、SWAN、JXML、XHSML、QML、KSML、TYML。用例检查文本空白保护、格式化后检查通过、非法输入拒绝部分写入、Stylelint 和公开类型。QQ、快手、涂鸦在此只验语言支持，不作为构建目标。

同一用例构建微信、支付宝、抖音、百度、京东、小红书六个模板目标，并通过安装后的公开插件入口构建六个独立原生子项目。原生用例核对外置及内联原生脚本的字节保留、TypeScript/普通 JavaScript 编译、间接依赖与循环引用、平台模块输出及百度 Filter；输出标签、扩展名和文件存在性均使用独立宿主契约断言。

每个命令阶段保存独立日志和退出结果。脚本不会启动 IDE、浏览器或 dev watcher；它证明安装、代码质量和生产构建契约，不能替代目标 runtime E2E。

定向契约测试不运行安装或消费进程：

```bash
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/verifyVitePlusTemplates/consumer.test.ts scripts/verifyVitePlusTemplates/nativeBuilds.test.ts
```

## 独立 Oxlint 公开类型消费

使用同一份 `CREATE_WEAPP_VITE_DEPENDENCY_TARBALLS`，运行 `node scripts/verify-oxlint-public-types.mjs`。此入口安装 `@weapp-vite/oxlint`、其候选依赖及 TypeScript；映射包含语言内核时，同时安装候选 `@weapp-vite/language-service` 并编译其根导出。禁用自动 peer 安装，不安装 ESLint 或 Vite+。系统临时目录与仓库隔离，使用 `types: []`、`skipLibCheck: false` 编译全部预设和 `@weapp-vite/oxlint/plugin`，并拒绝任何解析到临时消费者之外的声明文件。

该隔离入口证明无需运行时 ESLint/Vite+ 的公开类型闭包；`@weapp-vite/language-service/project`、`@weapp-vite/oxfmt/languages` 和 `@weapp-vite/oxfmt/project` 则在 `pnpm/platforms` 的实际安装项目中配套 Vite+ 验证，不把两类消费边界混作同一项结果。

TypeScript 默认固定为当前安装版本，可用 `OXLINT_PUBLIC_TYPES_TYPESCRIPT_VERSION` 显式选择。报告默认写入 `.tmp/current-run/templates-vite-plus/public-types/run-*`，可通过 `OXLINT_PUBLIC_TYPES_REPORT_DIR` 指定父目录。每阶段保留日志，成功或失败均清理本次临时消费者。

对应契约测试实际运行 TypeScript，覆盖未声明的传递类型依赖、外部声明泄漏和清理；不安装依赖：

```bash
pnpm exec vitest run --config scripts/vitest.config.mjs scripts/verifyVitePlusTemplates/publicTypes.test.ts
```
