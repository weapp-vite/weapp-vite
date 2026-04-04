---
title: 基础目录与资源收集
description: 说明 weapp-vite 如何确定源码根目录、插件目录和资源复制范围，以及这些配置与 Vite root/publicDir 的边界。
keywords:
  - 配置
  - config
  - paths
  - srcRoot
  - pluginRoot
  - copy
---

# 基础目录与资源收集 {#paths-config}

这一页聚焦几类最基础、也最容易把整个工程带偏的配置：

1. 小程序源码从哪里开始扫描
2. 插件源码在哪里
3. 哪些非代码资源会被复制进产物
4. 哪些字段目前仍是预留位

如果这些路径先没对齐，后面的自动路由、自动导入、分包和 TS 支持都会出现连锁误判。

[[toc]]

## `weapp.srcRoot` {#weapp-srcroot}

- **类型**：`string`
- **默认值**：项目根目录

表示小程序应用入口目录，也就是 `app.json` 所在目录。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    srcRoot: 'miniprogram',
  },
})
```

它会影响：

- `app.json`、页面、组件、分包的扫描起点
- 自动路由默认扫描范围
- 静态资源复制范围
- `.weapp-vite` 托管类型里的一部分推导结果

常见场景：

- 老项目把源码放在 `miniprogram/`
- Vue SFC / Wevu 项目把源码放在 `src/`

## `weapp.pluginRoot` {#weapp-pluginroot}

- **类型**：`string`
- **默认值**：`undefined`

表示插件入口目录，也就是 `plugin.json` 所在目录。

```ts
export default defineConfig({
  weapp: {
    srcRoot: 'miniprogram',
    pluginRoot: 'plugin',
  },
})
```

适用场景：

- 同仓库同时维护主应用和小程序插件
- 需要让插件也走同一套 alias、TypeScript、npm 构建链路

> [!NOTE]
> `pluginRoot` 只负责声明插件源码入口。插件最终输出目录仍会结合平台 project config 和构建上下文推导。

## `weapp.copy` {#weapp-copy}

- **类型**：`{ include?: string[]; exclude?: string[]; filter?: (filePath: string, index: number, array: string[]) => boolean }`
- **默认值**：`undefined`

用于把字体、证书、原始数据、模型、额外静态资源等复制到产物目录。

```ts
export default defineConfig({
  weapp: {
    copy: {
      include: ['**/*.ttf', '**/*.wasm', 'assets/raw/**'],
      exclude: ['**/__tests__/**'],
      filter(filePath) {
        return !filePath.endsWith('.map')
      },
    },
  },
})
```

说明：

- `include` / `exclude` 基于 `srcRoot` 或 `pluginRoot` 匹配
- `filter` 会在 glob 命中后再进行一次过滤
- 默认情况下，常见图片、音视频、字体、`wasm` 等资源已经会被收集

### 与 `public/` 的关系

如果资源天然适合走 Vite 的公共资源目录，也可以使用顶层 `publicDir`。

边界可以这样理解：

- 需要按小程序源码树一起管理的资源，用 `weapp.copy`
- 需要按 Vite 公共目录原样复制的资源，用 `publicDir`

更多原生字段说明：

- [Vite 中文官方配置文档 · shared options](https://cn.vite.dev/config/shared-options)

## `weapp.isAdditionalWxml` {#weapp-isadditionalwxml}

- **类型**：`(wxmlFilePath: string) => boolean`
- **默认值**：`() => false`

这是预留字段，当前版本尚未正式接入扫描和产物流程。

如果你的项目有“运行时动态拼接额外 WXML”的历史逻辑，当前更稳的做法仍然是：

- 改成显式引用
- 或在你自己的构建前后置步骤里补充产物

不要把核心流程建立在这个字段已经生效的假设上。

## 顶层 `root` 和 `weapp.srcRoot` 的区别

这两个字段经常被混淆：

- 顶层 `root`：Vite 项目根目录，影响 Vite 自身的配置解析、`index.html`、插件上下文等
- `weapp.srcRoot`：小程序源码根目录，影响 `app.json`、页面、组件、分包扫描

通常业务项目里：

- 不需要改 Vite `root`
- 只需要改 `weapp.srcRoot`

如果你确实在做多工程或自定义工作区结构，再去同时调整两者。

更多原生字段说明：

- [Vite 中文官方配置文档 · shared options](https://cn.vite.dev/config/shared-options)

---

接下来建议继续看 [构建输出与兼容](./build-and-output.md)。路径确定后，下一步通常就是把输出位置、平台和 JS 格式稳定下来。
