<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/call-intro.html -->

# 发起通话接口介绍

插件提供设备端和微信用户直接通话的能力。

## 1. 选择接口

开发者请根据场景选择不同的通话接口。

### 1.1 安卓 WMPF 设备呼叫手机微信

使用 [`initByCaller`](./initByCaller.md) 接口，businessType 传 1。

### 1.2 Linux 设备呼叫手机微信

Linux 设备不运行小程序插件，请使用 [小程序音视频通话 SDK (Linux 设备)](../../voip/voip-sdk.md) 。

### 1.3 手机微信呼叫安卓 WMPF 设备

- **推荐** ：使用 [`callWMPF`](./callWMPF.md) 接口。需插件 2.4.0 开始支持。若使用 license 计费，必须使用本接口。
- 使用 [`initByCaller`](./initByCaller.md) 接口，businessType 传 2。此方式不支持 license 计费。

### 1.4 手机微信呼叫 Linux 设备

使用 [`callDevice`](./callWMPF.md) 接口。需插件 2.4.0 开始支持。

请注意：呼叫 Linux 设备时，微信不进行消息推送，需要开发者自行将设备端加入房间所需参数（如 roomId 等）从微信端推送到设备端。

## 2. 使用前必读

### 2.1 进入通话页面

发起通话的几个接口即可以在小程序页面，也可以在插件页面调用。但是最终通话流程必须在插件页面才能进行。

- 如果发起通话时在小程序页面，接口调用成功后，开发者需要手动跳转到插件页面，插件页面加载完成后进入通话流程。
- 如果 **发起通话时在插件页面** ，接口调用成功后就会直接进入通话流程。此时 **请勿重复进行页面跳转** ，否则当前通话会被中断。
- 不建议页面栈内存在多个插件页面实例。

```js
// 发起通话成功后，仅在当前不是插件页面的情况下需进行跳转。
wx.redirectTo({
  // 此处只需要传入 path 即可，如果开发者有其他参数需要传递给小程序，也可以自行拼接 query，并通过插件 getPluginOnloadOptions 接口获取。
  url: wmpfVoip.CALL_PAGE_PATH,
  // 插件 2.3.9 开始支持 CALL_PAGE_PATH, 低版本请传入 'plugin-private://wxf830863afde621eb/pages/call-page-plugin/call-page-plugin',
})
```

### 2.2 最大通话时长

为了降低开发者的开发成本，插件提供了限制最大通话时长的能力。最大通话时长应为 > 0 的数字。

通话时长从 `startVoip` 事件开始计时，超时后通话自动结束并弹 toast 提示用户，同时触发 `hangUpVoip` 事件，origin 为 `'timeLimit'` 。

### 2.3 groupId 与 roomId

在插件 2.4.0 以下版本中，通话房间 ID 被称为 **`groupId`** ，这个名字比较容易与 [设备组](../../device-group.md) 的 ID 产生混淆，因此从 2.4.0 开始，房间号统一更名为 **`roomId`** ，但为保持向下兼容，groupId 参数仍予以保留。

二者除名字不同外，无其他差异。
