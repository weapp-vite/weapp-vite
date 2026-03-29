<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/introduction.html -->

# glass-easel ：新版微信小程序组件框架

glass-easel 是小程序组件框架的核心实现。它实质上是一个 JavaScript 的组件化界面框架，用来进行组件化、定义式的界面开发。

glass-easel 是对旧版小程序组件框架的重写，保持对旧版小程序组件框架特性的兼容，并添加了一些新特性。它运行时并不依赖于小程序环境，可以独立运行在 web 或其他 JavaScript 环境下。

## 主要特点

glass-easel 可以让同样的组件代码运行在 web 、小程序等不同环境下。

**后端** 是 glass-easel 的一个重要概念，表示组件系统的运行环境。在 web 环境下运行时，后端是浏览器的 DOM 接口；在小程序环境下运行时，后端则是小程序环境接口。这使得（后端无关的）组件代码可以运行在不同环境下。

glass-easel 完整具备小程序自定义组件相关特性，如组件模板、通信与事件、生命周期等等。此外， glass-easel 还实现了一些实用的新特性，也具有更好的 TypeScript 支持。

glass-easel 采用单组件节点树更新算法（大体上沿用了旧版小程序组件框架的更新算法），具有均衡的性能表现，适合高度组件化开发。

glass-easel 组件框架在 [GitHub](https://github.com/wechat-miniprogram/glass-easel) 上开源，代码和更详细的文档、示例等可以在 GitHub 上找到。

## 适配指引

[glass-easel 适配指引](./migration/README.md) 中列举了一些相较于现有组件框架 *exparser* 需要变更的逻辑，可以用于将现有的小程序迁移到新的框架，也可以用于快速了解新旧框架之间的差异。
