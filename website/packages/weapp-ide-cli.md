---
title: weapp-ide-cli
description: weapp-ide-cli 是微信开发者工具 CLI 的增强封装，提供命令透传、automator 子命令、配置管理与多语言输出。
keywords:
  - packages
  - weapp-ide-cli
  - cli
  - automator
  - config
---

# weapp-ide-cli

`weapp-ide-cli` 是对微信开发者工具官方命令行的增强封装：

- 保留官方命令语义（透传）
- 增强路径/参数兼容
- 提供 automator 子命令
- 提供可持久化配置（`~/.weapp-ide-cli/config.json`）
- 默认中文提示，支持切换英文

在 `weapp-vite` 项目里，你通常不必单独记忆两套命令。`weapp-vite` 会将未命中原生命令且在 IDE catalog 中的命令（如 `automator`）透传到 `weapp-ide-cli`。顶层 `wv upload/preview` 默认是六端 SDK 构建入口；稳定的 IDE 入口是 `wv ide upload/preview`，不弃用。兼容例外是带明确旧参数的顶层上传，以下命令仍按原始参数执行，不额外触发 weapp-vite 构建，但每次会警告一次未来弃用：

```bash
wv upload --project ./dist --version 1.2.3 --desc "release"
wv upload -p ./dist -v 1.2.3 -d "release"
```

要保留 IDE 行为，只需增加 `ide`，例如 `wv ide upload -p ./dist -v 1.2.3 -d "release"`。要迁移 SDK，则从源码项目根安装 `miniprogram-ci`，配置 AppID、上传私钥和 IP 白名单，再执行 `wv build --upload -p weapp --uv 1.2.3 --desc "release"`；这不是等价替换，不复用 IDE 登录，也不能把旧 `--project` 产物目录直接当作 SDK `[root]`。

`-p` 仅在存在 `--version/-v`、`--project`、`--appid`、`--ext-appid` 或 `--info-output/-i` 等明确旧标记时表示 IDE 项目目录，否则是原生平台，不按路径猜测。旧标记不能与 SDK 的长参数 `--platform`、`--uv`、`--bump`、`--git-desc`、`--dry-run`（包括其 `--no-*` 形式）混用，否则在 IDE、编译或升版副作用前报错；SDK dry-run 与自动版本不适用于 IDE。`--desc` 共用，`-d` 仅在旧调用中是说明，原生命令中仍为 debug；选项值不是标记，支持分开或 `=` 写法，`--` 后停止分流扫描。

`wv upload --help` 是 SDK 帮助，`wv help upload` 保留旧 IDE 帮助并提示未来弃用，`wv ide help upload` 保持显式 IDE 帮助、不警告。顶层 `wv preview` 不保留旧 IDE 分流，继续使用 `wv ide preview --project ./dist` 可保留 IDE 预览行为。完整规则见 [CLI 参考](/guide/cli#legacy-upload)。

如果你的目标是把 DevTools 里的小程序日志持续桥接到终端，当前更推荐直接使用 `wv ide logs`。`weapp-ide-cli` 负责底层连接与日志订阅，`weapp-vite` 则补充了 AI 终端自动检测、默认策略与常驻命令封装。

如果你在做 AI 验收，建议把下面这组路由当成默认约定：

- 提到截图、页面快照、runtime screenshot：优先用 `weapp screenshot`
- 提到截图对比、diff、baseline、视觉回归：优先用 `weapp compare`
- 提到 DevTools 日志桥接：优先用 `wv ide logs`

> 使用前请在微信开发者工具开启：`设置 -> 安全设置 -> 服务端口`。

## 安装

```bash
pnpm add -g weapp-ide-cli
# 或 npm install -g weapp-ide-cli
```

`weapp` 与 `weapp-ide-cli` 为等价入口。

## 快速开始

```bash
# 打开当前目录项目
weapp open -p

# 打开指定项目
weapp open --project ./dist/build/mp-weixin

# 运行时截图
weapp screenshot --project ./dist/build/mp-weixin --page pages/index/index --output .tmp/index.png --json

# 运行时截图对比
weapp compare --project ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --current-output .tmp/current.png --diff-output .tmp/index.diff.png --max-diff-pixels 100 --json
```

## 命令大全

### 1) 微信官方 CLI 透传命令

| 命令                    | 说明            |
| ----------------------- | --------------- |
| `weapp open`            | 打开 IDE / 项目 |
| `weapp login`           | 重新登录 IDE    |
| `weapp islogin`         | 检查登录状态    |
| `weapp preview`         | 预览二维码      |
| `weapp auto-preview`    | 自动预览        |
| `weapp upload`          | 上传小程序      |
| `weapp build-npm`       | 构建 npm        |
| `weapp auto`            | 开启自动化      |
| `weapp auto-replay`     | 自动化回放      |
| `weapp reset-fileutils` | 重置文件工具    |
| `weapp close`           | 关闭项目        |
| `weapp quit`            | 退出 IDE        |
| `weapp cache`           | 清理缓存        |
| `weapp engine`          | 引擎相关命令    |
| `weapp open-other`      | 打开其它项目    |
| `weapp build-ipa`       | 生成 iOS 包     |
| `weapp build-apk`       | 生成 Android 包 |
| `weapp cloud`           | 云开发命令      |

官方文档：

- <https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html>

其中 `weapp cloud` 为云开发命令族入口，可继续透传官方子命令，例如：

```bash
weapp cloud env list
weapp cloud functions list
weapp cloud functions info --name hello
weapp cloud functions deploy --name hello
weapp cloud functions inc-deploy --name hello
weapp cloud functions download --name hello
```

缓存清理示例：

```bash
weapp cache --clean compile
weapp cache --clean network
weapp cache --clean all
```

支持的缓存类型：

- `storage`
- `file`
- `compile`
- `auth`
- `network`
- `session`
- `all`

### 2) automator 增强命令

| 命令                             | 说明                      |
| -------------------------------- | ------------------------- |
| `weapp screenshot`               | 截图（base64 / 文件输出） |
| `weapp compare`                  | 截图对比（pixelmatch）    |
| `weapp navigate <url>`           | 保留栈跳转页面            |
| `weapp redirect <url>`           | 重定向页面                |
| `weapp back`                     | 页面返回                  |
| `weapp relaunch <url>`           | 重启到指定页面            |
| `weapp switch-tab <url>`         | 切换到 tabBar 页          |
| `weapp page-stack`               | 查看页面栈                |
| `weapp current-page`             | 查看当前页面              |
| `weapp system-info`              | 查看系统信息              |
| `weapp page-data [path]`         | 查看页面数据              |
| `weapp tap <selector>`           | 点击元素                  |
| `weapp input <selector> <value>` | 元素输入                  |
| `weapp scroll <scrollTop>`       | 页面滚动                  |
| `weapp audit`                    | 体验评分审计              |
| `weapp remote [--disable]`       | 开关远程调试              |

帮助：

```bash
weapp help navigate
weapp navigate --help
weapp compare --help
weapp compare --baseline .screenshots/baseline/home.png --max-diff-pixels 100 --json
```

#### `weapp screenshot` 选项

| 参数                   | 说明                   |
| ---------------------- | ---------------------- |
| `-p, --project <path>` | 项目路径，默认当前目录 |
| `-o, --output <path>`  | 截图输出文件           |
| `--page <path>`        | 截图前先跳转页面       |
| `-t, --timeout <ms>`   | 连接超时，默认 `30000` |
| `--json`               | JSON 输出              |
| `--lang <lang>`        | 语言切换：`zh` / `en`  |

输出规则：

- 不传 `--output` 时，默认把 base64 输出到 stdout
- 传入 `--output` 时，会把截图写到文件，并在 `--json` 结果里返回路径

#### `weapp compare` 选项

| 参数                        | 说明                             |
| --------------------------- | -------------------------------- |
| `-p, --project <path>`      | 项目路径，默认当前目录           |
| `--baseline <path>`         | baseline 图片路径，必填          |
| `--current-output <path>`   | 保存当前截图                     |
| `--diff-output <path>`      | 保存 diff 图                     |
| `--page <path>`             | 对比前先跳转页面                 |
| `--threshold <number>`      | pixelmatch threshold，默认 `0.1` |
| `--max-diff-pixels <count>` | 最大允许差异像素数               |
| `--max-diff-ratio <number>` | 最大允许差异占比，范围 `0-1`     |
| `-t, --timeout <ms>`        | 连接超时，默认 `30000`           |
| `--json`                    | JSON 输出                        |
| `--lang <lang>`             | 语言切换：`zh` / `en`            |

对比规则：

- 必须提供 `--baseline`
- 至少提供 `--max-diff-pixels` 或 `--max-diff-ratio` 之一
- baseline 与当前截图尺寸不一致时直接失败
- 对比失败时命令退出码会变为非 `0`

### 3) config 子命令

| 命令                                         | 说明                              |
| -------------------------------------------- | --------------------------------- |
| `weapp config`                               | 交互式配置 CLI 路径               |
| `weapp config lang <zh\|en>`                 | 切换并保存语言                    |
| `weapp config set-lang <zh\|en>`             | `lang` 别名                       |
| `weapp config show`                          | 显示完整配置 JSON                 |
| `weapp config get <cliPath\|locale>`         | 读取单个配置项                    |
| `weapp config set <cliPath\|locale> <value>` | 写入配置项                        |
| `weapp config unset <cliPath\|locale>`       | 删除配置项                        |
| `weapp config doctor`                        | 配置健康诊断                      |
| `weapp config export [path]`                 | 导出配置（不传 path 输出 stdout） |
| `weapp config import <path>`                 | 从 JSON 文件导入配置              |

配置文件位置：

- macOS / Linux: `~/.weapp-ide-cli/config.json`
- Windows: `C:\Users\<用户名>\.weapp-ide-cli\config.json`

配置示例：

```json
{
  "cliPath": "/Applications/wechatwebdevtools.app/Contents/MacOS/cli",
  "locale": "zh"
}
```

### 4) 支付宝 minidev 转发

| 命令                               | 说明                         |
| ---------------------------------- | ---------------------------- |
| `weapp alipay <args...>`           | 透传到 `minidev`             |
| `weapp ali <args...>`              | `alipay` 别名                |
| `weapp open --platform alipay ...` | 自动转发为 `minidev ide ...` |

首次使用前，请确保已全局安装 `minidev`。如果命令不存在，CLI 会给出安装提示。

### 5) 程序化命令目录导出

可直接复用 `weapp-ide-cli` 提供的命令判断能力：

```ts
import {
  isWeappIdeTopLevelCommand,
  WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES,
} from 'weapp-ide-cli'

if (isWeappIdeTopLevelCommand('preview')) {
  // 这里可以执行透传
}

console.log(WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES)
```

登录诊断可使用 `queryWechatIdeLogin(cliPath, { timeout: 3000 })`，显式指定本轮选择的 CLI。只有原生 JSON 中的 `login` 布尔值才返回 `{ status: 'success', login }`；超时、命令失败、空输出或矛盾响应均返回 `{ status: 'unknown', reason }`。`unknown` 不等于未登录。机器租约冲突返回 `reason: 'runtime-busy'`，应等待持有者结束后再查询。该方法不提示、不重试、不回退安装路径；原生 `islogin` 可能启动 IDE，不属于静态探针。旧的 `isWechatIdeLoggedIn()` 保留 CLI 透传行为，其 Promise 完成不能作为登录事实。

### 安装选择与共享登录

默认选择本机已安装的最新 Stable；官方灰度发布或网络查询失败不会阻塞默认选版。macOS 扫描系统及用户 Applications，Windows 读取安装登记和常见目录，Linux 与自定义位置通过显式 CLI 路径或本地登记接入。渠道和产品版本读取实际应用元数据，按数字段比较版本；符号链接按真实安装去重，同版本存在多份安装时要求 `--cli-path`。

```sh
weapp devtools list --json
weapp devtools add "<path-to-cli>"
weapp devtools remove "<path-to-cli>"
wv ide devtools list
wv open --devtools-channel=nightly
wv dev --open --devtools-channel=rc
wv ide preview --devtools-channel=rc --devtools-version=2.02.2608080
```

安装由用户完成，登记只保存 CLI 路径，每次重新读取元数据。列表显示渠道、版本、安装身份、实际配置目录及失效原因；登录使用各安装自己的配置目录，不复制 ticket、Cookie 或账号数据。

同一微信账号切换安装后，另一安装的登录可能失效。无需准备多个账号，可在需要测试的版本中重新扫码；工具不共享或迁移登录数据。矩阵使用非交互模式，登录失效记录为 `blocked`，附带 `runtimeBlocker.code: "needs-login"`，保留原始错误并继续其他版本；不会等待扫码或自动重试，最终返回非零退出码。重新登录后可单独运行该渠道补测。

选择优先级为：已固定的 `target` / 当前操作安装 → 本次 `cliPath`、`devtoolsChannel`、`devtoolsVersion` → 环境变量 → 旧全局 `cliPath` → 本机最新 Stable。显式渠道/版本覆盖继承的路径固定；同层路径、渠道、版本必须一致。`--devtools-version` 是开发者工具产品版本，上传的 `--version` 仍为小程序版本。包装参数不会传给官方 CLI。RC/nightly 需要明确选择，操作的启动、构建、连接、恢复和清理沿用同一安装。

公共环境变量为 `WEAPP_IDE_CLI_PATH`、`WEAPP_IDE_DEVTOOLS_CHANNEL`、`WEAPP_IDE_DEVTOOLS_VERSION`；E2E 使用对应的 `WEAPP_VITE_E2E_DEVTOOLS_*`，解析后向全部子进程传入具体 CLI。兼容 `WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_VERSION` / `WEAPP_VITE_E2E_ACCEPTED_DEVTOOLS_CHANNEL` 的固定选择。显式 `--require-official-latest`（或公共 `WEAPP_IDE_REQUIRE_OFFICIAL_LATEST=1`、E2E `WEAPP_VITE_E2E_REQUIRE_OFFICIAL_LATEST=1`）才要求匹配所选渠道官方最新版本，查询失败也会阻塞此严格模式。

```ts
import { listWechatDevtoolsInstallations, previewWechatIde, resolveWechatDevtoolsTarget } from 'weapp-ide-cli'

const installations = await listWechatDevtoolsInstallations()
const target = await resolveWechatDevtoolsTarget({ devtoolsChannel: 'rc' })
await previewWechatIde({ projectPath: './dist', target })
```

两套 MCP 的连接工具和相关 REST 输入都支持 `cliPath`、`devtoolsChannel`、`devtoolsVersion`、`requireOfficialLatest`；会话按真实安装身份隔离，同一项目不会串用 Stable 与 nightly 连接。

```sh
pnpm e2e:ide:matrix --targets=stable,rc,nightly --suite=ide-smoke
pnpm e2e:ide:matrix --targets=stable@2.02.2608080,nightly --suite=ide-gate --filter=<task>
```

矩阵默认只测 Stable，复用既有 suite 及其筛选和严格策略，全程持有同机同用户串行租约。普通测试失败或缺失安装记录后继续；所有权异常、清理失败、OOM 或取消停止后续目标。报告保存在 `docs/reports/devtools-matrix`，分别记录请求、实际安装、runtime/基础库版本、官方查询状态和结果。缺失、阻塞、partial 或未执行不能计为完整通过，返回非零退出码；全量正式验收仍遵守主线工作树要求。

HTTP 服务端口和 automator 会话都绑定选定安装。另一安装的配置较新、端口可连或版本号相同，均不代表可以复用。未知旧会话不会直接连接；宿主或监听端口归属不一致时停止操作，保留原有 IDE 和账号状态。`port` 仍表示对应接口原有的端口类型，不将 automator WebSocket 端口当作 HTTP 服务端口。

显式 HTTP 或 automator 端口必须是 `1` 到 `65535` 的整数；CLI、MCP 和 REST 同样拒绝无效端口，不会将 `0`、小数、混合文本或超范围值当作默认端口。打开项目的 HTTP 请求与官方 CLI 回退共用一次安装选择和机器租约，安装冲突不会触发回退。

`openWechatIdeProjectByHttp()` 使用 `/v2/open` 的 `project` 参数并保留原始响应正文；空正文或空 JSON 对象会抛出 `WECHAT_DEVTOOLS_HTTP_OPEN_UNCONFIRMED`，不能把 HTTP 200 当作项目已打开的证据。目标项目及 runtime 是否就绪仍需通过会话或 IDE 界面确认。

本仓库真实 IDE E2E 自动解析并固定本轮安装，核对实际宿主及 runtime 版本；不会自动安装工具。不同 worktree 的 E2E 使用同机同用户的排他租约，冲突报告 `Runtime busy`，应等待持有者结束。普通 CLI 的宿主变更同样参与协调，已建立的多项目连接不长期占用此租约。自动恢复不清共享缓存、不退出账号；只释放本任务登记的资源。

macOS 安装退出核验直接使用系统报告的映像路径，避免无关进程的受保护或已删除文件阻塞清理。当前磁盘路径被替换也不会覆盖原映像的归属判断；PID、启动时间、端口和任务登记仍须通过校验。

### 6) opened-session helper

除了官方 CLI 透传，`weapp-ide-cli` 现在也提供面向已打开 DevTools 会话的 Tool 域 helper，可优先复用当前会话完成以下操作：

- 查询当前 Tool 信息
- 触发重新编译
- 清理 DevTools 缓存
- 获取、设置、刷新 ticket
- 获取测试账号列表

如果你更希望直接在终端里操作这些会话信息，优先使用 `weapp-vite` 的高层入口：

- `wv ide info`
- `wv ide test-accounts`
- `wv ide ticket`
- `wv ide ticket:set --ticket <value>`
- `wv ide ticket:refresh`

`weapp-ide-cli` 更偏底层 helper 与官方能力对齐，`wv ide` 更适合日常开发调试。

### 7) 程序化 automator 与异步断开

`connectOpenedAutomator()` 返回的会话提供公开 `send(method, params?, { timeout }?)` 与 `CDP().enable/sendCommand/listProtocol/onEvent`，用于调用已连接 DevTools 支持的自动化和调试协议。`onEvent` 返回取消订阅函数；可用域和命令以目标宿主 `listProtocol()` 的结果为准。

```ts
import { connectOpenedAutomator } from 'weapp-ide-cli'

const miniProgram = await connectOpenedAutomator({ projectPath: '.' })
try {
  console.log(await miniProgram.send('Tool.getInfo', {}, { timeout: 3_000 }))
  console.log(await miniProgram.CDP().listProtocol({ timeout: 3_000 }))
}
finally {
  await miniProgram.disconnect()
}
```

`disconnect()` 现在返回 `Promise<void>`，调用时立即停止订阅并拒绝未完成请求，等待 WebSocket 关闭后完成。迁移同步清理回调时应返回或 `await` 此 Promise；超时和清理失败继续抛出。它只释放本连接，保留已打开项目窗口；需要关闭本任务受管窗口时使用相应会话的 `close()`，并等待窗口 owner 完成确认。MCP、日志转发及命令结束清理均等待各自持有的连接，不重新启动 IDE。

headless 会话的 `send` 仅适配 `Tool.getInfo`、`App.getCurrentPage/getPageStack/callFunction/callWxMethod`；`CDP()` 和其他原始协议明确报告 `HEADLESS_PROTOCOL_UNSUPPORTED`。触摸接口使用标准 `changedTouches`，旧 `changeTouches` 仍兼容，同时传入以标准字段为准。

## 语言切换

默认中文。可通过以下方式切换英文：

```bash
# 单次命令
weapp help navigate --lang en

# 持久化配置
weapp config lang en

# 环境变量
WEAPP_IDE_CLI_LANG=en weapp open -p
```

## 路径与脚本兼容

- `-p` 会被自动替换为 `--project`
- 相对路径会自动解析为绝对路径
- `--qr-output`、`--result-output`、`--info-output` 在缺省值场景下会默认写到当前工作目录
- 若未显式传路径参数，CLI 会自动注入当前终端目录，方便脚本化调用

## 参数前置校验（增强）

在调用官方 CLI 前，会进行本地校验：

- `upload` 必须提供 `--version/-v` 与 `--desc/-d`（且非空）
- `preview` 的 `--qr-format/-f` 仅支持 `terminal` / `image` / `base64`
- `preview` / `upload` / `auto` / `auto-preview` 需要提供 `--project` 或 `--appid`
- `--ext-appid` 在未提供 `--project` 时必须与 `--appid` 一起使用
- `--port` 必须为正整数
- `--login-retry` 仅支持 `never` / `once` / `always`
- `--login-retry-timeout` 必须为正整数

## CI / 非交互场景

推荐在 CI 或非交互脚本里显式传入：

```bash
weapp build-npm -p ./dist/build/mp-weixin --non-interactive
```

登录重试相关参数：

| 参数                         | 说明                                      |
| ---------------------------- | ----------------------------------------- |
| `--non-interactive`          | 非交互模式；登录失效时直接失败            |
| `--login-retry=<strategy>`   | 登录重试策略：`never` / `once` / `always` |
| `--login-retry-timeout=<ms>` | 交互重试等待超时，默认 `30000`            |

CLI 命令、登录提示与重试共享总预算（API `timeout`，默认 30 秒），提示等待取剩余预算与 `--login-retry-timeout` 的较小值。`always` 仍受总预算及最多三次执行限制；不会因重试重新获得完整预算。路径错误、明确未登录和协议拒绝不会自动重复启动；交互登录重试必须由用户输入确认。错误保留 `cause`，并附带 `operation` 的阶段、耗时、剩余预算、尝试次数与清理结果。嵌套操作的诊断保留在 `inner`。超时只取消本次请求、CLI 子进程和连接，不终止共享 IDE、不删除其他会话或登录配置。

自动启用非交互模式的场景：

- `CI=true`
- `stdin` 不是 TTY

## 平台支持

| 平台            | 支持情况 | 默认查找路径                                               |
| --------------- | -------- | ---------------------------------------------------------- |
| macOS           | ✅       | `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`   |
| Windows         | ✅       | `C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat` |
| Linux（社区版） | ⚠️       | 通过 `PATH` 搜索 `wechat-devtools-cli`                     |

## 参考

- 微信 CLI 文档：<https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html>
- 微信自动化文档：<https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/miniprogram.html>
- `weapp-vite` CLI 命令参考：[/guide/cli](/guide/cli)
- `weapp.forwardConsole` 配置：[/config/shared#weapp-forwardconsole](/config/shared#weapp-forwardconsole)
