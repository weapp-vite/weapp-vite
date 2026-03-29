<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/call-device.html -->

# 手机微信呼叫设备(Linux 直连)

> 需插件 2.4.0 版本、Linux SDK 0x00097 开始支持

> 如果要获取通话过程的各类事件，可以使用插件的 [`onVoipEvent`](../voip-plugin/api/onVoipEvent.md) 接口。

## 1. 手机微信端发起通话

发起通话前，一般需要用户在小程序中选择拨打的设备和通话的类型（音频/视频）。

发起通话时，开发者需要并在小程序中调用插件的 [`callDevice`](../voip-plugin/api/callDevice.md) 接口获取 roomId，然后跳转到插件的发起通话页面。

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

try {
  const { roomId } = await wmpfVoip.callDevice({
    roomType: 'video', // 房间类型。voice: 音频房间；video: 视频房间
    sn: '设备 SN',
    modelId: '设备 modelId',
    nickName: '设备端显示的微信用户名称',
    deviceName: '我的学习机',
  })

  if (/* 当前不在插件页面 */) {
    wx.redirectTo({
      url: wmpfVoip.CALL_PAGE_PATH,
    })
  }
} catch (e) {
  console.error('callDevice failed:', e)
  wx.showToast({
    title: '呼叫失败',
    icon: 'error',
  })
}
```

## 2. 推送通话提醒

手机微信内发起通话后，开发者应使用自有消息通道，将 roomId 等设备端加入房间所需参数传递给设备。

## 3. 设备端接听通话

设备端在收到通话提醒后，首先使用 `wx_voip_session_new` 接口创建 Session，然后通过 `wx_voip_listener_join` 接听。其他接口使用与设备呼叫手机类似。Session 创建后，可以调用 `wx_voip_session_hangup` 接口结束通话。详情可参考 [《小程序音视频通话 SDK (Linux)》](./voip-sdk.md) 。

## 4. 设备端拒绝通话

设备端收到通话提醒后，可以调用 `wx_voip_listener_hangup` （只能在 Session 创建前调用）结束通话，实现忙线或拒接。详情可参考 [《小程序音视频通话 SDK (Linux)》](./voip-sdk.md) 。
