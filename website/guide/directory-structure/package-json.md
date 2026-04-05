---
title: package.json
description: 项目脚本与依赖入口，通常承载 dev、build、open 等 weapp-vite 命令。
keywords:
  - package.json
  - 脚本命令
  - wv
  - 目录结构
---

# `package.json`

`package.json` 不负责页面扫描，但它是项目工作流的入口。

## 通常会放什么

- `dev`
- `build`
- `open`
- `analyze`

```json
{
  "scripts": {
    "dev": "wv dev",
    "build": "wv build",
    "open": "wv open"
  }
}
```

## 为什么目录结构页要提它

因为它和 `vite.config.ts` 一起构成了项目根目录的最小工程化入口。
如果别人接手你的项目，通常先看这两个文件。
