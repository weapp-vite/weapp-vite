---
title: weapp-ide-cli
description: weapp-ide-cli 是微信开发者工具 CLI 的增强封装，提供命令透传、automator 子命令、配置管理与中英文切换。
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

> 使用前请在微信开发者工具开启：`设置 -> 安全设置 -> 服务端口`。

## 安装

```bash
pnpm add -g weapp-ide-cli
# 或 npm install -g weapp-ide-cli
```

`weapp` 与 `weapp-ide-cli` 为等价入口。

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

### 2) automator 增强命令

| 命令                             | 说明                      |
| -------------------------------- | ------------------------- |
| `weapp screenshot`               | 截图（base64 / 文件输出） |
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
```

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

## 参数前置校验（增强）

在调用官方 CLI 前，会进行本地校验：

- `upload` 必须提供 `--version/-v` 与 `--desc/-d`（且非空）
- `preview` 的 `--qr-format/-f` 仅支持 `terminal` / `image` / `base64`
- `preview` / `upload` / `auto` / `auto-preview` 需要提供 `--project` 或 `--appid`
- `--ext-appid` 在未提供 `--project` 时必须与 `--appid` 一起使用
- `--port` 必须为正整数
- `--login-retry` 仅支持 `never` / `once` / `always`
- `--login-retry-timeout` 必须为正整数

## 参考

- 微信 CLI 文档：<https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html>
- 微信自动化文档：<https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/miniprogram.html>
