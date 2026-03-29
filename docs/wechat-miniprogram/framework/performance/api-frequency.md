<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/performance/api-frequency.html -->

# 接口调用频率规范

## 概念介绍

小程序wx接口可分为“普通接口”和“限频接口”。

“限频接口”指的是一个用户在一段时间内不允许频繁调用的wx接口，此类接口一般会调用到微信后台系统资源，为了保护系统，同时防止用户资源被滥用，开发者需要对此类接口做适度的频率限制，不能无节制地调用。

平台会对小程序内“限频接口”的调用情况做监控，如果小程序对此类接口的调用频率超出平台的规范，将会收到站内信提醒。系统会在资源紧张的情况下优先保障合理使用的小程序的服务。

开发者可登录小程序管理后台-开发管理-接口设置中查看“限频接口”调用情况。

目前，“限频接口”包括以下接口：

1. [wx.login](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html)
2. [wx.checkSession](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.checkSession.html)
3. [wx.getSetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/wx.getSetting.html)
4. [wx.getUserInfo](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserInfo.html)
5. [wx.getUserProfile](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/user-info/wx.getUserProfile.html)

## 频率规范

<table><thead><tr><th>API</th> <th>规范</th> <th>其他说明</th></tr></thead> <tbody><tr><td>wx.login</td> <td>一天的调用总次数不多于该小程序pv的两倍,单用户一秒钟不能大于4次</td> <td>-</td></tr> <tr><td>wx.checkSession</td> <td>一天的调用总次数不多于该小程序pv的两倍,单用户一秒钟不能大于4次</td> <td>-</td></tr> <tr><td>wx.getSetting</td> <td>一天的调用总次数不多于该小程序pv的两倍,单用户一秒钟不能大于4次</td> <td>-</td></tr> <tr><td>wx.getUserInfo</td> <td>一天的调用总次数不多于该小程序pv的两倍,单用户一秒钟不能大于4次</td> <td>-</td></tr> <tr><td>wx.getUserProfile</td> <td>一天的调用总次数不多于该小程序pv的两倍,单用户一秒钟不能大于4次</td> <td>-</td></tr></tbody></table>

Tips: 微信后台会延迟一天统计上一天的小程序pv总数和api调用总数，超过规范总数的会提醒尽快调整。

## 优化方法

开发者可以参考以下方法对“限频接口”的调用频率做优化：

- 把上一次调用接口的返回结果缓存下来以供后续逻辑复用，而不是重新调用接口
- 避免在定时循环的逻辑内重复调用“限频接口”
- 避免在页面初始化事件 `onLoad` 、 `onShow` 、 `onReady` 中调用限频接口，应该在小程序初始化事件 `onLaunch` 中调用

以下是错误用法和正确用法示例：

- wx.getSetting 错误用法:

```js
setInterval(() => {
  wx.getSetting()
}, 5000)
```

- wx.getSetting 正确用法:

```js
let setting
wx.getSetting({
  success(res) {
    setting = res
  }
})

// 在需要获取地理位置时
if (setting.authSetting['scope.userLocation']) {
  wx.getLocation({
    success(res) {},
    fail(res) {
      if (res.errMsg.indexOf('auth deny') >= 0) {
        // 如果权限没有开，引导用户打开设置页开启地理位置授权
      }
    }
  })
}
```

- wx.getUserInfo 错误用法:

```js
Page({
  onShow() {
    wx.getUserInfo()
  }
})
```

- wx.getUserInfo 正确用法:

```js
App({
  onLaunch() {
    wx.getUserInfo()
  }
})
```
