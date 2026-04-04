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

在 `weapp-vite` 项目里，你通常不必单独记忆两套命令。`weapp-vite` 会在未命中自身命令时自动透传到 `weapp-ide-cli`，所以 `preview`、`upload`、`automator` 等能力也可以直接从 `weapp-vite` 入口调用。

如果你的目标是把 DevTools 里的小程序日志持续桥接到终端，当前更推荐直接使用 `weapp-vite ide logs`。`weapp-ide-cli` 负责底层连接与日志订阅，`weapp-vite` 则补充了 AI 终端自动检测、默认策略与常驻命令封装。

如果你在做 AI 验收，建议把下面这组路由当成默认约定：

- 提到截图、页面快照、runtime screenshot：优先用 `weapp screenshot`
- 提到截图对比、diff、baseline、视觉回归：优先用 `weapp compare`
- 提到 DevTools 日志桥接：优先用 `weapp-vite ide logs`

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
