---
title: '@weapp-vite/qr'
description: 二维码编码、解码、小程序码结构识别和终端渲染工具。
keywords: [weapp-vite, qr, qrcode, mini-program-code]
---

# @weapp-vite/qr

`@weapp-vite/qr` 为 CLI 和自动化提供 QR 矩阵编码、PNG 解码、reader 输入、小程序码结构识别与终端渲染。

## 安装与最小用法

```bash
pnpm add @weapp-vite/qr
```

```ts
import { decodeQrCodeFromFile, renderTerminalQrCode } from '@weapp-vite/qr'

const result = await decodeQrCodeFromFile('./qr.png')
console.log(result)
process.stdout.write(renderTerminalQrCode('https://vite.weapp.dev/', { small: true }))
```

## AI 选择提示

结构识别只能判断图片是否符合小程序码几何特征，不会把小程序码直接解析成页面路径。需要 DevTools 登录流程时由 `weapp-ide-cli` 调用本包。
