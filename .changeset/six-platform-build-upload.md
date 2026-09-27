---
"weapp-vite": minor
"create-weapp-vite": patch
"@weapp-core/logger": patch
---

新增微信、支付宝、抖音、小红书、京东、百度统一构建上传与预览命令，支持按需安装官方工具、环境变量凭据、显式多目标串行执行和只构建的 dry-run。预览调用各平台官方 preview 接口并返回二维码图片或预览链接，不以普通上传代替预览；两种操作均不包含提审或正式发布。

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
