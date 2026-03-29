<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/performance.html -->

# 性能与体验优化

要让用户的接听和拨打体验更加流畅，关键是要缩短接听和拨打时小程序启动和一些网络请求的耗时。

小程序的冷启动需要一定的时间，尤其是在性能较差的设备上，启动耗时可能会偏长。影响用户拨打和接听音视频通话的体验。

## 1. 小程序侧启动性能优化

建议开发者参考 [《启动性能优化文档》](../../performance/tips/start.md) 优化小程序的启动耗时。

## 2. 安卓 WMPF 小程序预热（建议）

在设备端 WMPF，我们额外提供了「 **小程序预热** 」的能力，在用户使用小程序前，就预先 **将小程序在后台以无界面的形式启动并常驻运行** ，以便用户使用时可以直接把小程序切前台，而不需要完整进行冷启动流程。流程如下：

- WMPF 激活后，在用户使用小程序之前，可以调用 [`warmUpApp`](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/warmUpApp.html) 提前预热小程序。
    - 通常情况下，建议指定 path 为插件的拨打/接听页面 `plugin-private://wxf830863afde621eb/pages/call-page-plugin/call-page-plugin?isPreLaunch=1` 。如果开发者需要小程序启动时打开其他页面（例如联系人列表页），也可以指定预热其他页面。
- 设备端发起或接听通话，真正需要使用小程序时，再调用 [`launchMiniProgram`](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/launchMiniProgram.html) 传入正常的带有 query 的 path 等启动参数，即可复用之前预热的环境，把小程序拉到前台。
    - 预热和正式使用时传入的 path 参数的路径部分需保持一致，query 部分可不同。否则会额外触发一次页面的 reLaunch

小程序开发者需要对预热启动的情况进行识别和适配：

- 建议开发者在预热路径中增加一个 `isPreLaunch=1` 参数（也可以使用其他名称），标识预热进入的情况
- 在 App.onShow 事件的 query 中，需要判断有无 isPreLaunch。isPreLaunch 为 1 时，可以认为是预热启动，不应发起通话。
- 无 isPreLaunch 是正常启动，可以使用从插件 [`getPluginEnterOptions()`](../voip-plugin/api/getPluginEnterOptions.md) 拿到的参数调用 [`initByCaller`](../voip-plugin/api/initByCaller.md) 。

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

App({
  onShow() {
    const options = wmpfVoip.getPluginEnterOptions()
    if (options.query.isPreLaunch) {
      // 小程序预热场景，无需处理
    } else {
      // 正常启动场景，执行其他业务逻辑
    }
  }
})
```

**注意**

- 参考第 4 节，如果关闭小程序时未指定 `keepRunning` 参数为 true，则小程序关闭后需要重新进行预热。
- 预热或切后台不保证小程序能够一直运行。可能会因为系统的资源管理策略导致 WMPF 被回收，或在切后台超过一定时间或资源紧张时由 WMPF 主动清理小程序。

## 3. 安卓 WMPF 小程序环境预加载

> 如果做了小程序预热，无需再进行环境预加载

如果因为设备资源紧张等原因，不便通过预热的方式将小程序后台常驻，也可以使用 [preload](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/preload.html) 接口对小程序环境进行预加载。这个接口只会预创建一个基础的小程序运行环境和小程序基础库，不会启动某个具体的小程序。

## 4. 安卓 WMPF 关闭小程序时切后台

默认情况下，调用 WMPF [closeWxaApp](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/closeWxaApp.html) 接口关闭小程序时，会直接销毁小程序的实例，下次使用需要重新冷启动（或预热）。

建议开发者在关闭小程序时，传入 `keepRunning` 为 true，此时小程序会直接切后台，下次使用时可以直接复用，避免重复冷启动或重复预热。

## 5. 票据预获取

调用插件 [`initByCaller`](../voip-plugin/api/initByCaller.md) 发起通话时使用的 `deviceToken` 和 `pushToken` 这类票据都需要从微信后台获取，如果在用户点击后再获取，可能会延长发起通话的耗时。

建议开发者在用户发起通话的前置页面（例如：联系人页面等）提前准备好这些参数，如果用户在票据有效期内发起通话，不需要重新获取。
