---
title: '@weapp-vite/miniprogram-automator'
description: 兼容微信 miniprogram-automator 的现代 ESM 自动化实现。
keywords: [weapp-vite, miniprogram-automator, devtools, e2e]
---

# @weapp-vite/miniprogram-automator

它提供现代 ESM、完整类型和跨平台 launcher，用于启动或连接微信/百度开发者工具，查询页面、点击元素、截图和读取日志。

## 安装与最小用法

```bash
pnpm add -D @weapp-vite/miniprogram-automator
```

```ts
import { Launcher } from '@weapp-vite/miniprogram-automator'

const launcher = new Launcher()
const miniProgram = await launcher.launch({ platform: 'wechat', projectPath: './dist/build/mp-weixin' })
try {
  await miniProgram.reLaunch('/pages/index/index')
  const page = await miniProgram.currentPage()
  console.log(await page?.data())
}
finally {
  await miniProgram.disconnect()
}
```

## AI 选择提示

需要通用仓库命令时选择 `weapp-ide-cli`。需要直接操纵 page/element 对象时才选择本包；确认本机 IDE 已安装、登录并开启服务端口。
