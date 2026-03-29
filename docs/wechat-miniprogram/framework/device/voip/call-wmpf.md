<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/call-wmpf.html -->

# 手机微信呼叫设备(安卓)

用户可以向设备发起音视频通话，设备端需要开发者在收到消息后拉起小程序的指定页面让用户接听通话。

> 如果要获取通话过程的各类事件，可以使用插件的 [`onVoipEvent`](../voip-plugin/api/onVoipEvent.md) 接口。

## 1. 手机微信端发起通话

发起通话前，一般需要用户在小程序中选择拨打的设备和通话的类型（音频/视频）。

发起通话时，开发者需要先从后台拿到从设备端获取的 [`pushToken`](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/push.html) ，并在小程序中调用插件的 [`callWMPF`](../voip-plugin/api/callWMPF.md) 接口，然后跳转到插件的发起通话页面。

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

const roomType = 'video'
try {
  const { roomId, isSuccess } = await wmpfVoip.callWMPF({
    roomType: 'video', // 房间类型。voice: 音频房间；video: 视频房间
    sn: '设备 SN',
    modelId: '设备 modelId',
    pushToken: '从设备获取的 pushToken',
    nickName: '设备端显示的微信用户名称',
    deviceName: '我的学习机',
    envVersion: 'release', // 指定接听方使用的小程序版本，开发过程可以使用 develop
  })

  if (/* 当前不在插件页面 */) {
    // 跳转到插件的通话页面
    wx.redirectTo({
      url: wmpfVoip.CALL_PAGE_PATH,
      // 插件 2.3.9 开始支持 CALL_PAGE_PATH, 低版本请传入 'plugin-private://wxf830863afde621eb/pages/call-page-plugin/call-page-plugin',
    })
  }
} catch (e) {
  console.error('callWMPF failed:', e)
  // 参数错误的情况会通过异常抛出
  wx.showToast({
    title: '呼叫失败',
    icon: 'error',
  })
}
```

**注意**

- 建议开发者在服务端维护 sn 与 pushToken 的关联，提前在设备端 [获取 pushToken](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/push.html) 并存到后台，并在 pushToken 过期前进行刷新。
- 发起通话时，需要保证设备 **已激活并联网在线** 。
- 给设备推送的消息会在调用发起通话接口后由微信后台直接下发，不需要开发者额外调用服务端下发消息的接口。
- 插件 2.4.0 以下版本，需使用 [initByCaller](../voip-plugin/api/initByCaller.md) 接口呼叫设备，传入 `businessType: 2` 。使用 initByCaller 接口发起的通话，需要用户额外进行 [授权](./auth.md) 。

## 2. 设备端接听通话（安卓）

在手机微信端发起通话后，设备端会收到一条 [WMPF 的推送消息](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/push.html) 。需要开发者处理通知并拉起小程序展示通话界面：

### 2.1 绑定消息监听

开发者需要在 WMPF 中调用 [registerPushMsgEventListener](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/device/registerPushMsgEventListener.html) 注册消息监听。 **注意，这一步必须在通话发起前进行。**

### 2.2 展示来电通知/提醒（可选）

收到消息后，开发者可以根据产品需要展示来电通知（样式可以自定义），也可直接拉起小程序让用户进行接听。

### 2.3 打开小程序接听

推送消息为 JSON 字符串，解析后格式如下

```json
{
  "path": "plugin-private://wxf830863afde621eb/pages/call-page-plugin/call-page-plugin?roomType=roomType&groupId=groupId&listenerId=设备sn&callerName=拨打方名称&customQuery字符串", // 小程序启动路径
  "appType": 0, // 0: 正式版 1: 开发版 2: 体验版
  "appid": "wx********" // 小程序appid
}
```

开发者需要使用上述参数，调用 WMPF [`launchMiniProgram`](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/launchMiniProgram.html) 接口打开小程序的接听界面。

**注意**

- **如果开发者在收到消息后展示了自定义的来电通知，可以在启动小程序的 path 后添加 `&isClickedHangOnBtn=1`** 。此时用户进入小程序就会直接接听通话，不需要再次点击插件通话页面「接听」按钮。
- 建议在安卓 APP 中使用 [`WMPFLifeCycleManager`](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/lifecycle/addWMPFLifecycleListener.html) 监听 WMPF 退出事件，并重新启动并激活 WMPF，以防止 WMPF 异常退出后消息丢失。
- 为加快接听通话的速度，建议在收到消息监听时调用 [`prefetchDeviceToken`](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogramdevice/prefetchDeviceToken.html) 预拉取设备凭证。
- 设备上，APP 拉起小程序或接听通话较慢时，请参考 [性能与体验优化指南](./performance.md) 。

## 3. 设备端处理通话结束

设备端通话结束后，开发者需自行处理页面跳转或关闭小程序。一般有以下几种方式：

- 结束后跳转其他页面：开发者需要通过插件 [`setVoipEndPagePath`](../voip-plugin/api/setVoipEndPagePath.md) 接口设置通话结束跳转的页面。开发者未设置时则停留在通话记录页面。
- 结束后小程序切后台：开发者可以监听 [插件 endVoip 或 finishVoip 事件](../voip-plugin/api/onVoipEvent.md) ，通过 WMPF 提供的 [通信通道(Invoke Channel)](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/invoke-channel.html) 通知移动应用，使用 [closeWxaApp](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogram/closeWxaApp.html) (keepRunning=true) 将小程序切后台。
- 结束后关闭小程序：开发者可以监听 [插件 endVoip 或 finishVoip 事件](../voip-plugin/api/onVoipEvent.md) ，调用 [wx.exitMiniProgram](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.exitMiniProgram.html) 关闭小程序。
