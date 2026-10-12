# @weapp-core/logger

## 3.1.9

### Patch Changes

- chore(deps): 合并本轮 catalog、生产依赖和构建工具链升级，联动所有受影响可发布包及脚手架，保持现有公开 peer 范围和各包声明的最低运行环境。

  - 同步 Vite、Rolldown、Babel、Oxc、Devframe、Sass、Tailwind 引擎、AI/MCP SDK、CLI 依赖及工作区锁文件；脚手架模板 catalog、React SWC 和生成 AI 指引随构建基线更新。
  - Rust Oxc/N-API 适配新版解析结果与箭头函数 AST，保留批量分析、嵌套函数边界及可选 native 回退。
  - 对齐 React 19.3 / reconciler 0.34 所需异步提交 hook，修复 `startTransition` 因缺失宿主方法而失败。
  - 适配新版 Vite 样式客户端，防止 DOM 客户端进入小程序 stateful HMR 产物；迁移 Vite/Rolldown 生命周期补丁并接入上游 macOS 原生 watch 修复，减少连续保存和拓扑更新丢失事件。
  - 适配上游 stateful ESM 图及内联 helper，在原生输出 hook 保留宿主 CommonJS 格式、sourcemap 和完整 runtime 契约。
  - 更新 uview-plus 与兼容矩阵，保留 `u-flex` / `up-flex` 自动导入、组件交互及 `u-video` 覆盖；条码 nextTick 补丁因上游已修复而移除。
  - 更新 repoctl 并移除上游已实现的发布补丁，保留 catalog 消费者、共享 constants 依赖和固定版本组的联动发布。

## 3.1.8

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：dependencies.glass-easel-template-compiler
  - @weapp-vite/ast：dependencies.@oxc-project/types
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser
  - @weapp-vite/mcp：dependencies.@modelcontextprotocol/server、devDependencies.@modelcontextprotocol/client
  - @weapp-vite/tailwindcss：dependencies.@weapp-tailwindcss/engine
  - weapp-ide-cli：dependencies.@modelcontextprotocol/server
  - weapp-vite：dependencies.@weapp-tailwindcss/engine
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

- 新增微信、支付宝、抖音、小红书、京东、百度统一构建上传与预览命令，支持按需安装官方工具、环境变量凭据、显式多目标串行执行和只构建的 dry-run。预览调用各平台官方 preview 接口并返回二维码图片或预览链接，不以普通上传代替预览；两种操作均不包含提审或正式发布。

  顶层 `wv upload` 默认提供六端 SDK 构建上传，同时保留原有微信 IDE 上传参数与行为：`wv upload --project ./dist --version 1.2.3 --desc "release"` 和 `wv upload -p ./dist -v 1.2.3 -d "release"` 均可原样执行。旧顶层语法每次只警告一次未来移除，为迁移预留时间；稳定的显式 `wv ide upload` 不弃用、不警告。顶层 `wv preview` 仍走 SDK，不在旧语法兼容范围内；IDE 预览继续使用 `wv ide preview`。

  旧上传按明确参数标记分流：`--version/-v`、`--project`、`--appid`、`--ext-appid`、`--info-output/-i`；`-p` 仅在有旧标记时表示 IDE 项目目录，否则表示原生平台，不猜测路径是否存在或值是否像平台名。`--desc` 共用，`-d` 仅在旧调用中表示说明，原生仍为 debug。参数支持分开与等号形式，必填值不是标记，仅在选项位置遇到 `--` 后停止分流扫描。混用旧标记与 SDK 的 `--platform`、`--uv`、`--bump`、`--git-desc`、`--dry-run`（含其 `--no-*` 形式）在 IDE、编译或版本修改前报错，不静默忽略 SDK 选项。

  迁移 SDK 时需从源码项目根安装 `miniprogram-ci`、配置 AppID、上传私钥与 IP 白名单，再执行 `wv build --upload -p weapp --uv 1.2.3 --desc "release"`；不复用 IDE 登录，不把旧 `--project` 产物目录作为 SDK root。只需保留 IDE 行为时增加 `ide` 命名空间即可。`wv upload --help` 保持 SDK 帮助；`wv help upload` 保留旧 IDE 帮助并警告未来弃用，`wv ide help upload` 不警告。同步脚手架使用指引。

  SDK 上传无需手工指定 `--project`，自动依据配置和本轮写出目录定位；旧示例中的 `./dist` 只是 IDE 工程路径，不是默认值，省略旧定位参数时仍保持透传、不补固定目录。

  支持通过 `weapp.upload.version` 与 `weapp.upload.desc` 配置 SDK 上传默认参数，命令行参数优先，不影响旧 IDE 上传。版本和说明保留字符串语义，避免纯数字、前导零或空白参数被错误转换。构建时只有显式指定 `wv build --upload` 才启用上传，复用本次构建结果，不会重复编译；本次全部目标构建及小程序产物校验成功后才上传。独立 SDK `wv upload` 仍可显式构建上传。普通构建、开发重建、预览及 SDK dry-run 不会触发上传；dry-run 不适用于 IDE 上传。

  新增仅由 CLI 显式启用的 `--bump patch|minor|major` 与 `--git-desc`，用于 SDK `wv upload` 和 `wv build --upload`，不适用于 IDE 上传。本地升版与最新 Git 提交标题在首次配置求值、编译前准备一次，批量六端共用结果；生成值覆盖上传配置默认值，分别与显式 `--uv`、`--desc` 互斥。普通构建、开发与预览不启用这些操作。

  CLI 根据解析后的命令身份限制预启动 MCP，避免 `--mode`、`--config` 等全局参数写在 `build` / `upload` 前时提前求值配置，保证自动元数据仍先于首次配置求值。

  升版仅处理命令根目录的业务 `package.json`，由 npm 标准版本更新同步适用的 npm 锁文件，不向父目录查找、不修改外层 workspace 根包；禁用生命周期钩子，不自动提交、打标签或推送。Git 读取失败、无效版本与参数冲突在文件变更前报错；升版完成后构建或上传失败不自动回滚，重试应去掉 `--bump` 并复用原版本。dry-run 只计算预计元数据，不执行 npm version、不修改版本或锁文件，构建代码导入 package.json 时仍读取原始版本。

  本地自动版本文档改用内置命令，不再要求额外辅助脚本或依赖；保留 CI 显式注入版本与说明、无需修改业务版本文件的工作流。

  新增 `weapp.multiPlatform.projectConfigs`：在一份 Vite 配置中用对象展开复用公共字段、按 `mode` 选择各端 AppID，无需维护六套原生项目 JSON。构建器原生生成项目配置到 `app.json` 所在目录，保留原生文件配置方式；缺少目标配置、混用配置来源或手动覆盖生成目录字段时明确报错。

  统一项目配置按平台提供原生字段和嵌套设置的 TypeScript 智能提示，同时允许未来新增的原生参数与字符串取值，避免扩展配置因字段尚未收录而报类型错误。公开 `MultiPlatformProjectConfigs` 支持独立映射的 `satisfies` 检查与扩展字段推导；单平台原生 JSON、各端独立目录和统一配置三种入口均保留。

  SDK 上传与预览仅接受本轮打包器实际写出的应用目录。统一配置模式会跟随 `--outDir` 和 Vite 插件最终写出目录；原生文件模式仍校验声明目录与实际产物一致，两种方式均拒绝禁用写盘后误用旧产物。

  补充六端 AppID、微信私钥路径、支付宝 JSON 身份密钥路径和各平台 Token 的本地环境文件与 CI Secrets 配置示例，说明环境优先级、路径基准和密钥防泄漏要求。

  修复日志包颜色工具导出声明泄漏 `picocolors/types` 内部路径的问题，NodeNext 类型检查使用正式包入口，无需额外配置依赖安装目录映射。

## 3.1.7

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, magic-string, rolldown, sass, sass-embedded, tdesign-miniprogram。命名 catalog 变更键：tdesign-miniprogram-fixed(tdesign-miniprogram)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli

## 3.1.6

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：tsx, weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：oxc-parser。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：weapp-tailwindcss。命名 catalog 变更键：weapp-tailwindcss-fixed(weapp-tailwindcss)。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/glass-easel-web-adapter：devDependencies.tsx

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast：dependencies.@oxc-project/types

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/eslint：devDependencies.@typescript-eslint/parser

## 3.1.5

### Patch Changes

- 升级 weapp-tailwindcss 至 5.5.6，同步工作区默认依赖、固定版本回归环境及脚手架模板映射，使新建项目与仓库验证使用一致的 Tailwind 集成版本。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@babel/core, @babel/generator, @babel/parser, @babel/traverse, @babel/types, @types/node, eslint, lru-cache。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  涉及包：
  - @weapp-vite/ast-native：devDependencies.@napi-rs/cli
  - weapp-vite：dependencies.@babel/preset-env
  - create-weapp-vite：基于 weapp-vite / wevu 的依赖升级联动更新脚手架模板

## 3.1.4

### Patch Changes

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 基于 pnpm-workspace.yaml 中 catalog 版本变更，自动补充发布记录。
  默认 catalog 变更键：@icebreakers/eslint-config, @icebreakers/stylelint-config, @vue/compiler-core, @vue/compiler-dom, vue。命名 catalog 变更键：无。

- 自动补充依赖升级发布记录。
  `pnpm up:pkg` 改为按次追加 changeset，不再覆盖或删除既有自动生成文件。本文件为当前发布周期内全部可发布包补上 patch，覆盖仓库级依赖与 catalog 刷新。

## 3.1.3

### Patch Changes

- 统一可发布包的 npm SEO 元数据、公开发布配置与入口一致性检查，提升 npm 搜索与发布可靠性。

## 3.1.2

### Patch Changes

- 修复终端染色工具导出声明引用 picocolors 内部类型子路径的问题，使 NodeNext 消费者可以通过公开入口正确解析颜色工具类型。

## 3.1.1

### Patch Changes

- 🐛 **将仓库内原先使用 `tsup` 的发布包统一迁移到 `tsdown` 构建链路，并按现有产物约定保留对应的 ESM/CJS 输出后缀、声明文件生成与多入口导出结构。其中 `@weapp-vite/web` 额外改为由 `tsdown` 负责 JavaScript 产物、`tsc --emitDeclarationOnly` 负责类型声明，以规避当前 `rolldown-plugin-dts` 在该包上的类型生成异常，确保迁移后各包的发布结果与现有消费方式保持兼容。** [`d49d790`](https://github.com/weapp-vite/weapp-vite/commit/d49d79011253552daf088695bb52d158816dfec8) by @sonofmagic

## 3.1.0

### Minor Changes

- ✨ **feat: 统一 CLI 终端染色入口到 logger colors。** [`f7f936f`](https://github.com/weapp-vite/weapp-vite/commit/f7f936f1884cf0e588764132bf7f280d5d22bf41) by @sonofmagic
  - `@weapp-core/logger` 新增 `colors` 导出（基于 `picocolors`），作为统一终端染色能力。
  - 对齐 `packages/*/src/logger.ts` 适配层，统一通过本地 `logger` 入口透传 `colors`。
  - 后续 CLI 代码可统一使用 `from '../logger'`（或 `@weapp-core/logger`）进行染色，避免分散依赖与手写 ANSI。
  - 本次发布包含 `weapp-vite`，同步 bump `create-weapp-vite` 以保持脚手架依赖一致性。

## 3.0.3

### Patch Changes

- 🐛 **完善中文 JSDoc 与类型提示，提升 dts 智能提示体验。** [`f2d613f`](https://github.com/weapp-vite/weapp-vite/commit/f2d613fcdafd5de6bd145619f03d12b0b465688f) by @sonofmagic

## 3.0.2

### Patch Changes

- 🐛 **新增 multiPlatform 多平台配置支持，允许按平台加载 `project.config` 并支持 `--project-config` 覆盖路径。** [`763e936`](https://github.com/weapp-vite/weapp-vite/commit/763e9366831f17042592230d7f0d09af9df53373) by @sonofmagic
  - 补充 `LoggerConfig`/`WeappWebConfig` 的 JSDoc 示例，提升 IDE 提示体验。 避免 rolldown-require 在配置 `codeSplitting` 时触发 `inlineDynamicImports` 的警告。

## 3.0.1

### Patch Changes

- 🐛 **新增日志配置能力：支持全局 `logger.level` 与按 tag 的 `logger.tags` 过滤，并在 weapp-vite 配置中暴露 `weapp.logger`（npm 日志改由 tag 控制）。** [`13703f5`](https://github.com/weapp-vite/weapp-vite/commit/13703f5ca6010df78f5d08a2a9d4dbed4c5ccea4) by @sonofmagic

## 3.0.0

### Major Changes

- 🚀 **改为纯 ESM 产物，移除 CJS 导出，并将 Node 引擎版本提升至 ^20.19.0 || >=22.12.0。** [`eeca173`](https://github.com/weapp-vite/weapp-vite/commit/eeca1733e3074d878560abdb5b3378021dc02eda) by @sonofmagic
  - `vite.config.ts` 等配置请统一使用 ESM 写法，避免 `__dirname`/`require` 这类 CJS 语法。
  - `loadConfigFromFile` 在遇到 CJS 写法导致加载失败时，应提示：`XXX` 为 CJS 格式，需要改为 ESM 写法（可参考 `import.meta.dirname` 等用法）。

## 2.0.0

### Major Changes

- [`32738e9`](https://github.com/weapp-vite/weapp-vite/commit/32738e92712d650cdc7651c63114464170d159a4) Thanks [@sonofmagic](https://github.com/sonofmagic)! - 更多详情见:

  https://vite.icebreaker.top/migration/v5.htm

## 1.0.4

### Patch Changes

- [`e8d9e03`](https://github.com/weapp-vite/weapp-vite/commit/e8d9e03b9508eabde1a43245eecd3408a757413b) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.0.3

### Patch Changes

- [`c70141a`](https://github.com/weapp-vite/weapp-vite/commit/c70141ab30b16b74e34055f2d6aff9f61332da81) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore(deps): upgrade

## 1.0.2

### Patch Changes

- [`0af89c5`](https://github.com/weapp-vite/weapp-vite/commit/0af89c5837046dfca548d62427adba9b4afc2d6a) Thanks [@sonofmagic](https://github.com/sonofmagic)! - chore: upgrade deps

## 1.0.1

### Patch Changes

- f7a2d5d: fix: watcher do not close error

## 1.0.0

### Major Changes

- 36f5a7c: release major version

### Patch Changes

- f22c535: chore: compact for `weapp-vite`

## 1.0.0-alpha.1

### Major Changes

- 36f5a7c: release major version

## 0.0.1-alpha.0

### Patch Changes

- 792f50c: chore: compact for `weapp-vite`
