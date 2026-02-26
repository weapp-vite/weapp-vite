---
outline:
  - 2
  - 5
title: 这段时间 Weapp-vite 的功能更新与优化
description: 这段时间 Weapp-vite 的功能更新与优化，聚焦 blog / release1_7 相关场景，覆盖 Weapp-vite 与
  Wevu 的能力、配置和实践要点。
keywords:
  - Weapp-vite
  - 分包
  - blog
  - 发布日志
  - 版本更新
  - 这段时间
  - 的功能更新与优化
  - 聚焦
date: 2026-01-15
---

![bg](/1.7.x-release.png)

# 这段时间 `weapp-vite` 的功能更新与优化

自从上次宣布 `weapp-vite` 的发布，已经过去三个月；`weapp-vite` 也逐渐迭代至 `1.7.6` 版本。

在此期间，我对其进行了多项功能的增强和优化，接下来我将为大家详细介绍近期的阶段性成果。

> 下面列出的功能皆为增强特性，开发者可自由选择启用或关闭，不影响原生小程序的兼容性。

## 核心功能更新

### 1. 自动构建 `npm`

在项目启动时，`weapp-vite` 会自动构建 `npm` 依赖，无需再手动点击微信开发者工具中的 构建 `npm`，提升了一定程度的开发体验。

详细信息请参考：[自动构建 npm 文档](https://vite.icebreaker.top/guide/npm.html)。

### 2. 语法增强

#### 2.1 `JSON` 文件增强

##### 1. 支持注释

`weapp-vite` 支持在项目中的 `JSON` 文件中添加注释。例如：

```jsonc
{
  /* 这是一个组件 */
  "component": true,
  "styleIsolation": "apply-shared",
  "usingComponents": {
    // 导航栏组件
    "navigation-bar": "@/navigation-bar/navigation-bar"
  }
}
```

这些注释会在最终产物内被去除。

> **注意：** `project.config.json` 和 `project.private.config.json` 不支持注释，因为这些文件直接由微信开发者工具读取。

##### 2. 智能提示

我生成了许多小程序的 `$schema` 文件，部署在 `vite.icebreaker.top` 上。

通过指定 `JSON` 的 `$schema` 字段，实现了配置文件的智能提示功能，优化了一点点开发体验。

![vscode-json-intel](/vscode-json-intel.png)

详见：[JSON 配置文件的智能提示](https://vite.icebreaker.top/guide/json-intelli-sense.html)。

##### 3. 别名支持

可以在 ``vite.config.ts`` 中配置 `jsonAlias.entries` 字段, 在 `usingComponents` 中使用别名定义路径，这些在构建时会自动转化为相对路径。

例如:

```ts
import type { UserConfig } from 'weapp-vite/config'
import path from 'node:path'

export default <UserConfig>{
  weapp: {
    jsonAlias: {
      entries: [
        {
          find: '@',
          replacement: path.resolve(import.meta.dirname, 'components'),
        },
      ],
    },
  },
}
```

那么就可以在 `json` 中这样编写:

```json
{
  "usingComponents": {
    "navigation-bar": "@/navigation-bar/navigation-bar",
    "ice-avatar": "@/avatar/avatar"
  }
}
```

构建结果：

```json
{
  "usingComponents": {
    "navigation-bar": "../../components/navigation-bar/navigation-bar",
    "ice-avatar": "../../components/avatar/avatar"
  }
}
```

##### 4. 编程支持

`weapp-vite` 支持使用 `JS/TS` 文件来编写 `JSON`，你需要将 `component.json` 更改为 `component.json.ts`：

> 智能提示定义 `API` 都在 `weapp-vite/json` 中导出

比如普通写法:

```ts
import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
})
```

还支持引入异步数据、编译时变量或其他文件：

```ts
import type { Page } from 'weapp-vite/json'
import fs from 'node:fs/promises'
import path from 'node:path'
import shared0 from '@/assets/share'
import shared1 from './shared.json'

console.log('import.meta.env: ', import.meta.env)
console.log('import.meta.dirname: ', import.meta.dirname)
console.log('PLATFORM: ', import.meta.env.PLATFORM)
console.log(import.meta.env.DEV, import.meta.env.MODE, import.meta.env.PROD)
const key = await fs.readFile(
  path.resolve(import.meta.dirname, 'x.txt'),
  'utf8'
)

export default <Page>{
  usingComponents: {
    't-button': 'tdesign-miniprogram/button/button',
    't-divider': 'tdesign-miniprogram/divider/divider',
    'ice-avatar': '@/avatar/avatar',
  },
  ...shared0,
  ...shared1,
  key,
}
```

#### 2.2 `WXML` 文件增强

##### 事件绑定语法糖

`weapp-vite` 借鉴了 `Vue` 的事件绑定风格，为 `WXML` 增加了事件绑定语法糖：

这里我们以最常用的 `tap` 事件为例:

```html
<!-- 原始代码 -->
<view @tap="onTap"></view>
<!-- 编译后 -->
<view bind:tap="onTap"></view>
```

支持的事件绑定增强规则如下：

| 源代码                                      | 编译结果            |
| ------------------------------------------- | ------------------- |
| `@tap`                                      | `bind:tap`          |
| `@tap.catch`                                | `catch:tap`         |
| `@tap.mut`                                  | `mut-bind:tap`      |
| `@tap.capture`                              | `capture-bind:tap`  |
| `@tap.capture.catch` / `@tap.catch.capture` | `capture-catch:tap` |

详见：[事件绑定增强文档](https://vite.icebreaker.top/guide/wxml.html)。

这部分还能做的更多，欢迎与我进行讨论！

#### 2.3 `WXS` 增强

##### 编程支持（实验性）

`weapp-vite` 为 `WXS` 提供了 `JS/TS` 编程支持，支持通过更改 `wxs` 后缀为 `wxs.js` 或 `wxs.ts` 文件定义逻辑：

比如 `index.wxs.ts`:

```ts
export const foo = '\'hello world\' from hello.wxs.ts'

export const bar = function (d: string) {
  return d
}
```

另外内联 `WXS` 也支持使用 `lang="js"` 或 `lang="ts"` 直接启用编译功能:

```html
<view>{{test.foo}}</view>
<view @tap="{{test.tigger}}">{{test.abc}}</view>

<wxs module="test" lang="ts">
const { bar, foo } = require('./index.wxs.js')
const bbc = require('./bbc.wxs')
export const abc = 'abc'

export function tigger(value:string){
  console.log(abc)
}

export {
  foo,
  bar,
  bbc
}
</wxs>
```

详情请参考：[Wxs 增强](https://vite.icebreaker.top/guide/wxs.html)。

### 3. 生成脚手架

`weapp-vite` 内置了生成脚手架工具，可快速生成一系列文件（如 `js`、`wxml`、`wxss` 和 `json`），用于提升开发效率。

最基础的用法只需要 `weapp-vite g [outDir]`

详情请参考：[生成脚手架文档](https://vite.icebreaker.top/guide/generate.html)。

### 4. 分包支持

针对普通分包和独立分包的加载需求进行了优化，用户几乎无需额外配置即可实现分包加载。

尤其是独立分包的场景，创建了独立的编译上下文。

详情请参考：[分包指南](https://vite.icebreaker.top/guide/subpackage.html)。

## 不忘初心，持续改进

`weapp-vite` 的初衷是实现对原生小程序的增强，现有原生小程序几乎可以零成本地迁移过来，并享受更高效的开发体验。

在此，希望各位开发者试用，欢迎反馈与参与。

如果您对文中的任何功能或增强有疑问、建议，欢迎到  [Github Discussions](https://github.com/weapp-vite/weapp-vite/discussions) 提出讨论！
