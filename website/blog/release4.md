---
title: Weapp-vite - 微信小程序工具链的另一种选择
description: "Weapp-vite 是由 笔者 icebreaker 开发的一个基于 vite
  的现代化微信小程序开发工具链。我给它设定的目标初心是: 为小程序开发者带来笑容。"
keywords:
  - Weapp-vite
  - 微信小程序
  - blog
  - release4
  - 发布日志
  - 版本更新
  - "-"
  - 微信小程序工具链的另一种选择
date: 2025-09-08
---

# Weapp-vite - 微信小程序工具链的另一种选择

## 前言

[`weapp-vite`](https://github.com/weapp-vite/weapp-vite) 是由 [笔者 icebreaker](https://github.com/sonofmagic) 开发的一个基于 `vite` 的现代化微信小程序开发工具链。我给它设定的目标初心是: `为小程序开发者带来笑容`。

自从在 `2024` 年的 `8` 月正式发布之后，到现在也过了将近 `9` 个月的时间。`weapp-vite` 在用户不断的反馈，以及我对代码方面不断的重构和优化下，也从 `1.x` 版本逐渐迭代到了 `4.0` 版本。

最近随着我对打包工具，以及编译的理解不断的加深，`4.0` 版本中，我也完全重构了 `weapp-vite` 的编译核心。这个版本是我相对来说，比较 **满意** 的一个版本。

所以我也心血来潮，写了这篇文章。同时这也是我之前，虽然发布了 `2.x`，`3.x` 版本，但是却没有发表任何文章的一个主要原因。

## 之前版本遇到的一些困难

在 `3.x` 之前的版本，存在一些非常大的问题:

### 热更新与耦合问题

每次构建，`weapp-vite` 都会去扫描整个小程序目录，然后分析哪些是打包入口，哪些是 `wxml` 的依赖项。这套机制是纯 `fs` 实现的，并没有用到 `vite`(`rollup`) 的 `chunk`/`asset` 加载的机制。

这导致在插件的 `options` 阶段做的事情过多，热更新效率非常差，多个 `Service` 还有 `Vite` 插件存在严重耦合。

虽然普通的使用 `weapp-vite` 的开发者不会遇到这个情况，但是这却严重阻碍了 `weapp-vite` 的进一步发展。这让我如鲠在喉，夜不能寐。

于是，我详细阅读并调试了 `uni-app` 和 `Taro` 的源代码，并最终走出了一条最适合 `weapp-vite` 路。

值得一提的是，`uni-app` 编译的中间产物比较有趣:

```js
import './manifest-json-js'

if (!Math) {
  import('uniPage://cGFnZXMvaW5kZXgvaW5kZXgudnVl')
  import('uniPage://cGFnZXMvaXNzdWUvdGFpbHdpbmQtY2hpbGRyZW4udnVl')
  import('uniPage://cGFnZXMvaXNzdWUvY2FzZS1keW5hbWljLWNsYXNzLnZ1ZQ')
}
```

这种加载机制，有点类似于那种 `rollup` 虚拟模块的实现。而且这么写可以走 `resolveDynamicImport` 的 `rollup build hook`，然后其余的小程序页面就走:

```js
// uniPage
import MiniProgramPage from 'xxxx'

wx.createPage(MiniProgramPage)
```

虽然 `uni-app` / `Taro` 都改了运行时了。但我对我的 `weapp-vite` 的编译的目标是默认不会注入任何运行时的东西，这样才能保证打出来的包足够的小, 后续用户想要注入什么都通过 `vite` 插件的方式进行注入。

> `Taro` 为了做运行时兼容，注入的运行时代码实在是太大了，需要在一开始的时候就做好分包的规划。`uni-app` 也有注入但是体积还能接受，没有 `Taro` 这么夸张。

### 自定义加载模块方式

然后另外在更改 `weapp-vite` 内核的时候，我曾经一度想要放弃使用 `vite` 改用 `rspack` 完全重写，因为我有高度自定义加载模块方式的需求。(假如真的这样做，那项目就改名叫 `weapp-rspack`)

因为默认情况下 `rollup` 就只支持 `import` ,`import()` 等等这种方式去做模块的分析和引入。`cjs` 那种都是需要依赖 `@rollup/plugin-commonjs` 这种去做转化 `esm`, 然后分析依赖。

但是小程序的模块加载方式是非标的，什么 `require.async(id)`, `require(id,callback)` 这种都不是默认的标准，这时候就需要自定义加载模块方式。

当然扯到这就太技术了，读者没有遇到过这样的场景的话，也是很难理解的了的。毕竟技术都是，越往一个方向深入，同行的人就越少，想找个人做技术探讨和交流都困难。

## 主要特点

接下来我来总结一下 `weapp-vite` 的主要特点：

1. **轻量级原生开发**
   - 保持原生小程序的开发方式，无需学习新框架
   - 直接使用微信官方文档的写法
   - 对原生小程序开发提供更好的支持，包括 `Skyline` 等新特性

2. **现代化开发体验**
   - 开箱即用支持 `TypeScript`、`SCSS`、`Less` 等
   - 基于 `Vite` 构建，享受极速的开发体验
   - 支持 `Vite` 生态的插件系统

3. **增强功能**
   - 自动构建 `npm`：支持两种 `npm` 构建策略
   - 自动引入组件：无需手动在 `json` 中注册
   - 完整的别名支持：可在任意 `js/ts` 或 `json` 文件中使用
   - 独立分包适配：自动处理分包场景

### 适用场景

`weapp-vite` 特别适合以下场景：

1. **专注微信小程序开发**
   - 如果你只需要开发微信小程序，不需要跨端
   - 想要使用微信小程序最新特性（如 `Skyline`）

2. **原生小程序迁移**
   - 现有原生小程序项目想要现代化改造
   - 使用 `gulp` 或 `mina` 方案的项目想要升级

3. **轻量级需求**
   - 不需要完整的跨端框架
   - 希望保持原生开发方式，但需要现代化工具支持

### 不适用的场景

同样，目前 `weapp-vite` 并不适合以下场景：

- 需要完整跨端能力的框架
- 需要使用 `Vue`/`React` 等前端框架的写法，来取代小程序原生写法

毕竟深入小程序原生开发的人，其实要比懂 `Vue`/`React` 的人数少很多。

而且小程序的编写范式和体验，实际上也要比 `Vue`/`React` 差，我自从做小程序方向的开源项目以来，听到了无数次群友这方面吐槽，早已听出老茧了。

对于这种场景，推荐使用 `uni-app` 或 `Taro` 这种成熟的跨端框架。

## 快速开始

1. **创建项目**

```sh
# 使用 pnpm
pnpm create weapp-vite@latest

# 或使用 npm
npm create weapp-vite@latest
```

2. **安装依赖**

```sh
pnpm i  # 或 npm install
```

3. **开发命令**

```sh
pnpm dev  # 启动开发服务器
pnpm dev -o  # 启动开发并打开微信开发者工具
```

当然对应的使用文档都在 [`官方文档`](https://vite.icebreaker.top/) | [`备用官方文档`](https://vite.icebreaker.top/) 中。

## 结尾

最后一定要感谢我的用户们，他们为这个项目提供了许多非常有价值的反馈。

助力这个项目从一个个人实验性质的想法，升级到了一个正式的项目。

当然，也非常欢迎大家提出任何的改进意见，除了在群里交流之外，我其实更加希望大家使用提 [Issue](https://github.com/weapp-vite/weapp-vite/issues) 或 [Pull Request](https://github.com/weapp-vite/weapp-vite/pulls) 的方式。

另外，也希望看到这里的同学们，给 [`weapp-vite`](https://github.com/weapp-vite/weapp-vite) 点个 `Star` 吧! 大家的鼓励就是我继续前进的动力，Thanks!
