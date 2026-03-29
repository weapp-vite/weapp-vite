<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/async.html -->

# 分包异步化

在小程序中，不同的分包对应不同的下载单元；因此，除了非独立分包可以依赖主包外，分包之间不能互相使用自定义组件或进行 `require` 。「分包异步化」特性将允许通过一些配置和新的接口，使部分跨分包的内容可以等待下载后异步使用，从而一定程度上解决这个限制。

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/6AYlPZmm7csW)

## 兼容性

该特性需要基础库版本 [2.11.2](../compatibility.md) 或以上，使用该特性的小程序在 2.11.2 以下的基础库上可能无法工作，如果发布正式版本，可以考虑将最低基础库版本设置为 2.11.2 或以上。

点击展开各平台最低支持版本：

- 安卓微信：7.0.13
- iOS 微信：7.0.12
- 微信开发者工具：1.05.2104272
- PC 微信：3.4.5
- macOS 微信：3.4.1
- 安卓企业微信：3.1.23
- iOS 企业微信：4.0.8

## 跨分包自定义组件引用

一个分包使用其他分包的自定义组件时，由于其他分包还未下载或注入，其他分包的组件处于不可用的状态。通过为其他分包的自定义组件设置 [占位组件](../custom-component/placeholder.md) ，我们可以先渲染占位组件作为替代，在分包下载完成后再进行替换。例如：

```json
// subPackageA/pages/index.json
{
  "usingComponents": {
    "button": "../../commonPackage/components/button",
    "list": "../../subPackageB/components/full-list",
    "simple-list": "../components/simple-list",
    "plugin-comp": "plugin://pluginInSubPackageB/comp"
  },
  "componentPlaceholder": {
    "button": "view",
    "list": "simple-list",
    "plugin-comp": "view"
  }
}
```

在这个配置中， `button` 和 `list` 两个自定义组件是跨分包引用组件，其中 `button` 在渲染时会使用内置组件 `view` 作为替代， `list` 会使用当前分包内的自定义组件 `simple-list` 作为替代进行渲染；在这两个分包下载完成后，占位组件就会被替换为对应的跨分包组件。

在基础库 `2.24.3` 之后，可以使用 [`wx.onLazyLoadError`](https://developers.weixin.qq.com/miniprogram/dev/api/base/app/app-event/wx.onLazyLoadError) 监听加载事件。

## 跨分包 JS 代码引用

一个分包中的代码引用其它分包的代码时，为了不让下载阻塞代码运行，我们需要异步获取引用的结果。如：

```js
// subPackageA/index.js
// 使用回调函数风格的调用
require('../subPackageB/utils.js', utils => {
  console.log(utils.whoami) // Wechat MiniProgram
}, ({mod, errMsg}) => {
  console.error(`path: ${mod}, ${errMsg}`)
})
// 或者使用 Promise 风格的调用
require.async('../commonPackage/index.js').then(pkg => {
  pkg.getPackageName() // 'common'
}).catch(({mod, errMsg}) => {
  console.error(`path: ${mod}, ${errMsg}`)
})
```

在其它分包中的插件也可以通过类似的方法调用：

```js
// 使用回调函数风格的调用
requirePlugin('live-player-plugin', livePlayer => {
  console.log(livePlayer.getPluginVersion())
}, ({mod, errMsg}) => {
  console.error(`path: ${mod}, ${errMsg}`)
})
// 或者使用 Promise 风格的调用
requirePlugin.async('live-player-plugin').then(livePlayer => {
  console.log(livePlayer.getPluginVersion())
}).catch(({mod, errMsg}) => {
  console.error(`path: ${mod}, ${errMsg}`)
})
```

详情可参考 [require 文档](https://developers.weixin.qq.com/miniprogram/dev/reference/api/require)
