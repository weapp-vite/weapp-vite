<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/start_optimizeB.html -->

# 代码注入优化

小程序代码注入的优化可以从 **优化代码量** 和 **优化执行耗时** 两个角度着手。

## 1. 使用 [按需注入](../../ability/lazyload.md#%E6%8C%89%E9%9C%80%E6%B3%A8%E5%85%A5)

> **推荐所有小程序使用**

通常情况下，在小程序启动时，启动页面依赖的所有代码包（主包、分包、插件包、扩展库等）的所有 JS 代码会全部合并注入，包括其他未访问的页面以及未用到自定义组件，同时所有页面和自定义组件的 JS 代码会被立刻执行。这造成很多没有使用的代码在小程序运行环境中注入执行，影响注入耗时和内存占用。

自基础库版本 2.11.1 起，可以通过开启「按需注入」特性避免不必要的代码注入和执行，以降低小程序的启动时间和运行时内存。

```json
{
  "lazyCodeLoading": "requiredComponents"
}
```

注意：启用按需注入后，页面 JSON 配置中定义的所有组件和 `app.json` 中 `usingComponents` 配置的全局自定义组件，都会被视为页面的依赖并进行注入和加载。建议开发者 **及时移除 JSON 中未使用自定义组件的声明** ，并尽量 **避免在全局声明使用率低的自定义组件** ，否则可能会影响按需注入的效果。

## 2. 使用 [用时注入](../../ability/lazyload.md#%E7%94%A8%E6%97%B6%E6%B3%A8%E5%85%A5)

在打开上述「按需注入」特性的前提下，可以通过「用时注入」特性使一部分自定义组件不在启动时注入，而是在真正被渲染时才进行注入，进一步降低小程序的启动和首屏时间。

## 3. 启动过程中减少同步 API 的调用

在小程序启动流程中，会注入开发者代码并顺序同步执行 `App.onLaunch` , `App.onShow` , `Page.onLoad` , `Page.onShow` 。

在小程序初始化代码（Page，App 定义之外的内容）和上述启动相关的几个生命周期中，应尽量 **减少或不调用同步 API** 。绝大多数同步 API 会以 `Sync` 结尾，但有部分特例，比如 `getSystemInfo` 。

同步 API 虽然使用起来更简单，但是会阻塞当前 JS 线程，影响代码执行。如非必要，应尽可能的使用异步 API 代替同步，并将启动过程中非必要的同步 API 调用延迟到启动完成后进行。

常见的开发者容易在启动时过于频繁调用的 API 有：

### 3.1 [getSystemInfo](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfo.html) / [getSystemInfoSync](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoSync.html)

由于历史原因，这两个接口都是同步实现。由于 getSystemInfo 接口里承载了过多内容，单次调用可能比较久。

如非必要，建议开发者 **对调用结果进行缓存** ，避免重复调用。 **启动过程中应尽可能最多调用一次** 。

建议优先使用拆分后的 getSystemSetting/getAppAuthorizeSetting/getDeviceInfo/getWindowInfo/getAppBaseInfo 按需获取信息，或使用使用异步版本 [getSystemInfoAsync](https://developers.weixin.qq.com/miniprogram/dev/api/base/system/wx.getSystemInfoAsync.html) 。

### 3.2 [getStorageSync](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.getStorageSync.html) / [setStorageSync](https://developers.weixin.qq.com/miniprogram/dev/api/storage/wx.setStorageSync.html)

getStorageSync/setStorageSync 应只用来进行数据的持久化存储， **不应用于运行时的数据传递或全局状态管理** 。启动过程中过多的读写存储，也会显著影响小程序代码注入的耗时。

对于简单的数据共享，可以使用在 App 上增加全局数据对象完成：

```js
// app.js
App({
  globalData: { // 全局共享的数据
    userName: 'Wechat'
  }
})

// pages/index.js
const app = getApp()
Page({
  onLoad() {
    const { userName } = app.globalData
  }
})
```

## 4. 避免启动过程进行复杂运算

在小程序初始化代码（Page，App 定义之外的内容）和启动相关的几个生命周期中，应 **避免执行复杂的运算逻辑** 。复杂运算也会阻塞当前 JS 线程，影响启动耗时。建议将复杂的运算延迟到启动完成后进行。
