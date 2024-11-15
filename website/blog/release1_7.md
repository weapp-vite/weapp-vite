
---
outline: [2, 4]
---

# 这么些天 `weapp-vite` 的功能更新

转眼离上一篇宣布 `weapp-vite` 发布的文章，已经过去了快 `3` 个月了。转眼 `weapp-vite` 已经到了 `1.7.6` 版本了。

是时候发布一下这段时间，`weapp-vite` 的阶段性成果了！

我当初设计的目标是做原生的增强，目标也就是，原先现存的原生小程序，可以很几乎 `0` 成本地的迁移过来

现在也在朝着这个目标不断的努力中，欢迎各位试用并提出宝贵的建议与意见。

另外下列的都是额外做的增强功能，原生小程序不需要特别这样写，可选可以关闭。

## 自动构建 npm

现在在项目启动的时候，会自动构建 `npm` 了，省去了每次都要点击微信开发者工具里面，构建 `npm` 的麻烦

更多详见 [自动构建 npm 文档](https://vite.icebreaker.top/guide/npm.html)

## 语法增强

### json 增强

#### 1. 支持注释

首先 `weapp-vite` 允许你在项目中的各种 `json` 中编写注释

```jsonc
{
  // 你好啊，我是 icebreaker
  "component": true,
  "styleIsolation": "apply-shared",
  "usingComponents": {
    // 这是 导航栏组件
    "navigation-bar": "@/navigation-bar/navigation-bar"
  }
}
```

> `project.config.json` 和 `project.private.config.json` 不行，因为这是微信开发者工具直接读取的

#### 2. 智能提示

通过 `$schema` 的方式，添加了很多关于 `json` 的智能提示, 详见文档 [JSON 配置文件的智能提示](https://vite.icebreaker.top/guide/json-intelli-sense.html)

#### 3. 编程支持

现在还允许使用 `js/ts` 来对 `json` 做一些编译时的处理，比如 `app.json` 可以写成 `app.json.ts`

比如你可以这样写一个 `component.json.ts`:

```ts
import { defineComponentJson } from 'weapp-vite/json'

export default defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
  usingComponents: {},
})
```

甚至在里面引入异步和编译时变量，或者引入其他文件:

```ts
import type { Page } from 'weapp-vite/json'
import fs from 'node:fs/promises'
import path from 'node:path'
import shared0 from '@/assets/share'
import shared1 from './shared.json'

console.log('import.meta.env: ', import.meta.env)
console.log('import.meta.dirname: ', import.meta.dirname)
console.log('MP_PLATFORM: ', import.meta.env.MP_PLATFORM)
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

#### 4. 别名支持

除此之外还支持别名的方式导入组件，比如下方的写法:

```json
{
  "usingComponents": {
    "navigation-bar": "@/navigation-bar/navigation-bar",
    "ice-avatar": "@/avatar/avatar"
  }
}
```

它们会在产物里，被自动转化成相对路径

```json
{
  "usingComponents": {
    "navigation-bar": "../../components/navigation-bar/navigation-bar",
    "ice-avatar": "../../components/avatar/avatar"
  }
}
```

### wxml 增强

目前对 `wxml` 也做了少许的语法增强，假如你有更多的建议，欢迎在 `issue` 中提出

#### 事件绑定增强

在事件绑定上的设计，我认为 `vue` 的写法是非常优秀的，所以进行了一些扩展

```html
<!-- 源代码 -->
<view @tap="hello"></view>
<!-- 编译结果 -->
<view bind:tap="hello"></view>
```

以下表格为 `tap` 事件的一一对应，其他事件同理:

| 源代码                                      | 编译结果            |
| ------------------------------------------- | ------------------- |
| `@tap`                                      | `bind:tap`          |
| `@tap.catch`                                | `catch:tap`         |
| `@tap.mut`                                  | `mut-bind:tap`      |
| `@tap.capture`                              | `capture-bind:tap`  |
| `@tap.capture.catch` / `@tap.catch.capture` | `capture-catch:tap` |

详见 [事件绑定增强文档](https://vite.icebreaker.top/guide/wxml.html)

当然，这些只是语法糖，你使用微信原生的绑定方法，肯定也是可以的。

### wxs 增强

#### 编程支持 (实验性)

我对 `wxs` 做了一些实验性的语言支持，以至于除了使用 `index.wxs` 之外，你还能使用 `index.wxs.js` 和 `index.wxs.ts`

> 里面关于导入的只能使用 `require` 语法

同时也针对内联 `wxs` 做了一些特殊的优化，你只需在内联 `wxs` 代码块上声明 `lang` 是 `js` or `ts`，就会启动内置的转译引擎进行转化

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

## 生成脚手架

在 `weapp-vite` 中内置了一个生成脚手架，用于快速生成 `js`,`wxml`,`wxss`,`json` 一系列文件

使用方式详见[文档](https://vite.icebreaker.top/guide/generate.html)

## 普通分包与独立分包支持

在 `weapp-vite` 中，针对 `普通分包` 和 `独立分包` 做了特殊的优化，当然最终的目的都是用户几乎可以无感知地达到自己的目的。

详见 [分包加载](https://vite.icebreaker.top/guide/subpackage.html)

## 不忘初心

欢迎各位试用并提出宝贵的建议与意见