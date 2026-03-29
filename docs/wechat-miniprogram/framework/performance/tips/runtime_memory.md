<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/performance/tips/runtime_memory.html -->

# 内存优化

## 1. 合理使用分包加载

使用 [分包加载](../../subpackages/basic.md) 不仅能优化启动耗时，也能够实现页面、组件和逻辑较粗粒度的按需加载，从而降低内存的占用。详情请参考 [《启动优化-代码包体积优化》](./start_optimizeA.md#_1-%E5%90%88%E7%90%86%E4%BD%BF%E7%94%A8%E5%88%86%E5%8C%85%E5%8A%A0%E8%BD%BD)

## 2. 使用 [按需注入](../../ability/lazyload.md#%E6%8C%89%E9%9C%80%E6%B3%A8%E5%85%A5) 和 [用时注入](../../ability/lazyload.md#%E7%94%A8%E6%97%B6%E6%B3%A8%E5%85%A5)

通过开启「按需注入」和「用时注入」，可以在运行时避免加载未使用到的页面和组件，降低运行时的内存占用。详情请参考 [《启动优化-代码注入优化》](./start_optimizeB.md)

## 3. 内存分析

如果要更精细的分析小程序逻辑层的内存分布情况，可以使用开发者工具调试器的「 [内存调试](../devtools-perf.md#%E5%86%85%E5%AD%98%E8%B0%83%E8%AF%95) 」或「真机调试 2.0」提供的「 [内存调试](../remote_debug_2.md#%E5%86%85%E5%AD%98%E8%B0%83%E8%AF%95) 」能力。

## 4. 处理内存告警

当小程序占用系统资源过高，可能会被系统销毁或被微信客户端主动回收。在 iOS 上，当微信客户端在一定时间间隔内连续收到系统内存告警时，会根据一定的策略，主动销毁小程序，并提示用户「运行内存不足，请重新打开该小程序」。

建议小程序在必要时使用 [wx.onMemoryWarning](https://developers.weixin.qq.com/miniprogram/dev/api/device/memory/wx.onMemoryWarning.html) 监听内存告警事件，进行必要的内存清理。例如：释放一些暂时不用的组件或 JS 对象。

## 5. 小程序常见的内存泄露问题

存在内存泄露问题会导致小程序在运行过程中内存占用持续增长，引起小程序闪退或被被微信强制销毁。

### 5.1 小程序长期持有页面实例，导致页面实例和引用的组件无法正常销毁

页面 unload 之后，基础库会从页面栈中将页面实例清理。正常情况下，JS 垃圾回收机制会将页面进行回收，释放内存。

但如果开发者代码中持有的页面实例（ `this` ）未释放，则会导致页面未被正常回收，引起内存泄露。建议开发者注意，并在 unload 中进行必要的清理。

**案例一：页面实例被未解绑的事件监听引用**

事件监听器中持有了页面的 this，如果页面销毁后监听未解绑，会导致页面无法释放。

```js
Page({
  themeChangeHandler({ theme }) {
    this.setData({ theme })
  },
  onLoad() {
    this._handler = this.themeChangeHandler.bind(this)
    wx.onThemeChange(this._handler)
  },
  // 修复方法：unload 中解绑监听
  // onUnload() {
  //   wx.offThemeChange(this._handler)
  // },
})
```

**案例二：页面实例被页面外变量或全局变量引用**

函数闭包内持有了页面的 this，且函数被挂到全局或页面声明周期外的变量，会导致页面无法释放。

```js
let languageListener = null

Page({
  onLoad() {
    getApp().userInfoChangeListener = ({ userName }) => {
      this.setData({ userName })
    }
    languageListener = ({ lang }) => {
      this.setData({ lang })
    }
  },
  // 修复方法：unload 中进行清理
  // onUnload() {
  //   getApp().userInfoChangeListener = null
  //   languageListener = null
  // },
})
```

**案例三：页面实例被异步回调长时间引用**

如果在长时间未返回的异步回调中访问了页面的 this，如持续时间过长的 `setTimeout` 、 `setInterval` ，耗时较长的 wx API 回调（如长时间的 `wx.request` 等），会导致页面无法释放。

```js
Page({
  onLoad() {
    this._timer = setInterval(() => {
      this.setData({
        timerValue: Date.now()
      })
    }, 1000)
  },
  // 修复方法：unload 中进行清理
  // onUnload() {
  //   clearInterval(this._timer)
  // },
})
```

### 5.2 事件监听未及时解绑

事件监听结束后，应及时解绑监听器

```js
const locationChangeListener = function (res) {
  console.log('location change', res)
}
wx.onLocationChange(locationChangeListener)
wx.startLocationUpdate()
```

```js
// 监听结束后
wx.stopLocationUpdate()
// 修复方法：不使用后及时解绑监听
// wx.offLocationChange(locationChangeListener)
```

### 5.3 未清理的定时器

开发者在开发如「秒杀倒计时」等功能时，可能会使用 `setInterval` 设置定时器，页面或组件销毁前，需要调用 `clearInterval` 方法取消定时器。
