# @weapp-vite/miniprogram-automator

## 1. 简介

`@weapp-vite/miniprogram-automator` 是面向 `weapp-vite` 生态维护的 `miniprogram-automator` 兼容实现，目标是在保留官方心智模型的前提下，提供更现代的 ESM 导出、类型支持与 headless 调试能力。

它同时服务于：

- `weapp-ide-cli` 的自动化能力
- 仓库内小程序开发者工具相关 e2e 测试
- 需要直接连接小程序开发者工具自动化协议的 Node 工具

## 2. 特性

- 对齐官方常见对象模型：`MiniProgram`、`Page`、`Element`、`Native`
- 提供 `Launcher` 用于启动、连接和复用 DevTools 会话
- 支持按平台选择自动化后端，默认微信，百度智能小程序提供轻量 TypeScript runtime
- 支持截图、输入、滚动、点击、页面跳转等自动化操作
- 默认输出现代 ESM 与完整类型声明
- 内置二维码打印与解码辅助能力，便于配合登录、连接流程调试
- 支持 headless 自动化启动入口

## 3. 安装

```bash
pnpm add -D @weapp-vite/miniprogram-automator
```

> **注意**：运行前仍需要本机安装对应平台的开发者工具，并开启自动化所需服务能力。

## 4. 快速开始

### 4.1 连接现有会话

```ts
import { Launcher } from '@weapp-vite/miniprogram-automator'

const launcher = new Launcher()
const miniProgram = await launcher.connect({
  wsEndpoint: 'ws://127.0.0.1:9420',
})

const page = await miniProgram.currentPage()
console.log(await page.data())
```

### 4.2 启动并打开项目

```ts
import { Launcher } from '@weapp-vite/miniprogram-automator'

const launcher = new Launcher()
const miniProgram = await launcher.launch({
  platform: 'wechat',
  projectPath: './dist/build/mp-weixin',
})

await miniProgram.reLaunch('/pages/index/index')
```

### 4.3 启动百度智能小程序

```ts
import { Launcher } from '@weapp-vite/miniprogram-automator'

const launcher = new Launcher()
const smartProgram = await launcher.launch({
  platform: 'swan',
  cliPath: '/Applications/百度开发者工具.app/Contents/MacOS/cli',
  projectPath: './dist/build/mp-baidu',
})

await smartProgram.reLaunch('/pages/index/index')
```

`platform: 'baidu'` 也会按百度智能小程序处理。

如果需要使用百度智能小程序自动化的 runtime 能力，可以直接访问内置入口：

```ts
import { SmartappAutomator } from '@weapp-vite/miniprogram-automator'

const devices = await SmartappAutomator.devices?.('simulator')
const device = await SmartappAutomator.launch({
  deviceType: 'simulator',
  wsEndpoint: 'ws://127.0.0.1:9420',
})

await device.close()
```

### 4.4 使用页面与元素对象

```ts
import { Launcher } from '@weapp-vite/miniprogram-automator'

const launcher = new Launcher()
const miniProgram = await launcher.launch({
  platform: 'wechat',
  projectPath: './dist/build/mp-weixin',
})

const page = await miniProgram.currentPage()
const button = await page.$('.submit')

await button?.tap()
await page.waitFor(500)
```

## 5. 主要导出

| 导出                      | 说明                                     |
| ------------------------- | ---------------------------------------- |
| `Launcher`                | 启动 DevTools、连接 WebSocket、创建会话  |
| `MiniProgram`             | 小程序级操作入口，如页面跳转、获取当前页 |
| `Page`                    | 页面级查询与操作入口                     |
| `Element`                 | 通用节点对象，支持点击、输入、事件触发   |
| `Native`                  | 原生能力桥接                             |
| `launchHeadlessAutomator` | headless 启动辅助函数                    |

## 6. 本地开发

```bash
pnpm --filter @weapp-vite/miniprogram-automator build
pnpm --filter @weapp-vite/miniprogram-automator test
pnpm --filter @weapp-vite/miniprogram-automator typecheck
```

## 7. 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
- `weapp-ide-cli`：[../weapp-ide-cli/README.md](../weapp-ide-cli/README.md)
