# weapp-vite CLI Dispatch Playbook

## 目标

统一 `weapp-vite` 与 `weapp-ide-cli` 的命令路由：

1. `weapp-vite` 原生命令通常优先；旧顶层微信 IDE `upload` 和 `help upload` 是明确保留的兼容例外。
2. 只有命中 `weapp-ide-cli` catalog 的命令才透传。
3. 未知命令不盲目透传。

## 消费项目入口

- 使用项目已安装的 `weapp-vite` CLI，例如 `pnpm exec wv --help`、`pnpm exec wv ide --help`；以当前版本帮助确认命令和参数。
- `weapp-ide-cli` 的 catalog 是 IDE 透传名单的所有者，消费项目不复制名单、不修改 dispatcher，也不导入框架内部源码。
- 显式 IDE 操作用 `wv ide <command>`；构建与 SDK 上传使用 `wv build`、`wv upload` 等原生入口。不要把 SDK 与 IDE 登录、凭据或目录规则混用。
- 排查命令路由时，保留原始参数、stdout/stderr 和退出码；先确认所用的是项目本地版本，而不是另一个全局 CLI。

## 细节

- `weapp-vite ide <args...>` 保持强制 passthrough 命名空间。
- 但 `weapp-vite ide logs` 是 `weapp-vite` 原生日志桥接命令。
- `close` 是 `weapp-vite` 原生命令，用于关闭微信开发者工具。
- `mcp init|print|doctor` 是 `weapp-vite` 原生命令，用于管理 AI 客户端配置。
- SDK `upload`、`preview` 在六端生产构建后调用官方上传、预览接口。兼容只覆盖旧顶层上传，不扩展到顶层 preview；IDE 预览继续使用 `ide preview`。
- 旧上传标记：`--version/-v`、`--project`、`--appid`、`--ext-appid`、`--info-output/-i`。SDK 标记：长参数 `--platform`、`--uv`、`--bump`、`--git-desc`、`--dry-run`、`--json`、`--timeout`，其 `--no-*` 形式也参与分流和混用判断。不要在旧 IDE 调用中忽略 SDK 专属选项。
- `-p` 单独不判定为旧方言：有旧标记时为 IDE 项目目录，否则为原生平台；禁止用路径存在性或值是否像平台名推断。`--desc` 共用，`-d` 仅在旧调用中为描述，原生仍为 debug。必填选项值只是数据，支持分开和 `=` 形式；仅在选项位置遇到 `--` 才停止扫描，`--desc "--"` 仍为说明。可选的 `--debug` 不会吞掉后续选项。
- 旧长参数 `wv upload --project ./dist --version 1.2.3 --desc "release"` 与短参数 `wv upload -p ./dist -v 1.2.3 -d "release"` 原样保留。`./dist` 仅为 IDE 工程目录示例，不是默认值；省略定位参数时保持透传，不补固定目录，由官方 CLI 处理。每次仅警告一次未来移除，给用户迁移时间。`wv ide upload -p ./dist -v 1.2.3 -d "release"` 是稳定显式入口，不弃用、不警告。SDK 的 `wv upload -p weapp` 无需 `--project`，自动定位配置及本轮产物。
- SDK 迁移不是等价替换：从源码项目根安装 `miniprogram-ci`，配置 AppID、代码上传私钥和 IP 白名单后，用 `wv build --upload -p weapp --uv 1.2.3 --desc "release"`。不复用 IDE 登录，不把旧 `--project` 产物目录当作 SDK root；IDE 调用不使用 SDK dry-run、`--bump`、`--git-desc`、`--json` 或 `--timeout`。
- `build --upload` 在本次已选构建后端全部成功后复用产物上传，不能再次调用独立 `upload` 导致重复构建；上传凭据与目录规则见 `node_modules/weapp-vite/dist/docs/upload.md`。`build -p all` 是“小程序 + Web”，不等于 `upload/preview -p all` 的六端列表；淘宝没有统一适配器。
- `--json` / `--timeout` 仅属于独立 SDK `upload`，不扩展 `build --upload` 或 `preview`。JSON 模式 stdout 只输出一次整批结果、stderr 保留日志和官方事件。超时仅覆盖 SDK worker；中断后的远端结果未确认，不实现远端取消或自动重试。
- `help <cmd>`：
  - `help upload`：保留旧 IDE help 并警告未来弃用；SDK help 使用 `upload --help`
  - 其他 native command：保留 native help
  - ide command：转发给 `weapp-ide-cli`

## 消费项目验证

- 优先用当前版本 `--help` 确认原生/IDE 命令；未知命令应报告错误，不盲目转发。
- 旧顶层 `upload` / `help upload` 会警告；显式 `ide upload` / `ide help upload` 不警告，顶层 `preview` 是 SDK 入口。
- 上传属于有远端副作用的显式任务，不作为配置或构建排障的默认检查；需要时先用 SDK `upload --dry-run` 核对配置，再按用户授权执行实际上传。
- CLI 异常报告包含当前包版本、项目 scripts、原始参数与退出码；不要求消费项目维护框架 changeset 或运行仓库命令分发测试。
