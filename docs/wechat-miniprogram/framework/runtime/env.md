<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/env.html -->

# 小程序的运行环境

微信小程序运行在多种平台上：iOS/iPadOS 微信客户端、Android 微信客户端、Windows PC 微信客户端、Mac 微信客户端、 [小程序硬件框架](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/) 和用于调试的微信开发者工具等。

不同运行环境下，脚本执行环境以及用于组件渲染的环境是不同的，性能表现也存在差异：

- 在 iOS、iPadOS 和 Mac OS 上，小程序逻辑层的 JavaScript 代码运行在 JavaScriptCore 中，视图层是由 WKWebView 来渲染的，环境有 iOS 14、iPad OS 14、Mac OS 11.4 等；
- 在 Android 上，小程序逻辑层的 JavaScript 代码运行在 [V8](https://developers.google.com/v8/) 中，视图层是由基于 Mobile Chromium 内核的微信自研 XWeb 引擎来渲染的；
- 在 Windows 上，小程序逻辑层 JavaScript 和视图层都是用 Chromium 内核；
- 在 开发工具上，小程序逻辑层的 JavaScript 代码是运行在 [NW.js](https://nwjs.io/) 中，视图层是由 Chromium Webview 来渲染的。

> JavaScriptCore 无法开启 JIT 编译 (Just-In-Time Compiler)，同等条件下的运行性能要明显低于其他平台。

### 平台差异

尽管各运行环境是十分相似的，但是还是有些许区别：

- `JavaScript` 语法和 API 支持不一致：语法上开发者可以通过开启 `ES6` 转 `ES5` 的功能来规避（ [详情](https://developers.weixin.qq.com/miniprogram/dev/devtools/codecompile.html#es6-%E8%BD%AC-es5) ）；此外，小程序基础库内置了必要的Polyfill，来弥补API的差异（ [详情](./js-support.md) )。
- `WXSS` 渲染表现不一致：尽管可以通过开启 [样式补全](https://developers.weixin.qq.com/miniprogram/dev/devtools/codecompile.html#%E6%A0%B7%E5%BC%8F%E8%A1%A5%E5%85%A8) 来规避大部分的问题，还是建议开发者需要在各端分别检查小程序的真实表现。

**开发者工具仅供调试使用，最终的表现以客户端为准。**
