---
title: weapp-ide-cli
description: weapp-ide-cli 是对微信开发者工具官方命令行的增强封装：保留官方命令语义，同时补齐路径、配置和非交互体验。
keywords:
  - packages
  - weapp
  - ide
  - cli
  - weapp-ide-cli
  - 同时补齐路径
  - 配置和非交互体验。
---

# weapp-ide-cli

`weapp-ide-cli` 是对微信开发者工具官方命令行的增强封装：保留官方命令语义，同时补齐路径、配置和非交互体验。

## 何时使用

- 在本地脚本中执行 `open / preview / upload`
- 在 CI 环境自动上传构建产物
- 需要跨平台（macOS/Windows/Linux 社区版）统一命令入口

## 前置条件

在微信开发者工具中打开：`设置 -> 安全设置 -> 服务端口`。

## 安装

```bash
pnpm add -g weapp-ide-cli
# 或 npm install -g weapp-ide-cli
```

## 常用命令

```bash
# 当前目录作为项目目录
weapp open -p

# 指定项目目录
weapp open --project ./dist/dev/mp-weixin

# 预览二维码
weapp preview --project ./dist/dev/mp-weixin

# 上传
weapp upload --project ./dist/build/mp-weixin --version 1.0.0
```

`weapp` 与 `weapp-ide-cli` 是等价入口。

## 支付宝 minidev 转发

```bash
weapp alipay login
weapp alipay preview --project ./dist/mp-alipay
```

也支持：

```bash
weapp open --platform alipay -p ./dist/dev/mp-alipay
```

## CI 建议

- 显式加 `--non-interactive`，避免登录失效时挂起
- 结合 `--login-retry=never|once|always` 控制失败策略
- 使用 `--qr-output` / `--result-output` 收集产物日志
