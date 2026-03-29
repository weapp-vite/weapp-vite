<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/auth.html -->

# 用户授权设备

设备如果要向用户发起通话，需要用户在 **手机微信端** 先对设备进行授权。

> 微信呼叫设备，若使用 callWMPF 或 callDevice 接口不需要授权。使用 initByCaller 接口仍需要授权。

## 1. 请求授权

用户授权前，需要从开发者的后台通过 [获取设备票据](https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/(getSnTicket)) 接口拿到设备票据 snTicket。

拿到 snTicket 后，需要在小程序内调用 [`wx.requestDeviceVoIP`](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.requestDeviceVoIP.html) 请用户进行授权。

> 需要基础库 >= 2.27.3 支持。设备组 >= 2.30.4 支持。

```js
wx.requestDeviceVoIP({
  sn: 'xxxxxx', // 向用户发起通话的设备 sn（需要与设备注册时一致）
  snTicket: 'xxxxxx', // 获取的 snTicket
  modelId: 'xxxxxx', // 「设备接入」从微信公众平台获取的 model_id
  deviceName: 'xxx', // 设备名称，用于授权时显示给用户
  success(res) {
    console.log(`requestDeviceVoIP success:`, res)
  },
  fail(err) {
    console.error(`requestDeviceVoIP fail:`, err)
  },
})
```

**注意：**

- 如果用户拒绝授权或在设置页中取消授权，再次调用 `requestDeviceVoIP` 不会出现授权弹框。开发者应引导用户在设置页中手动开启。
- 授权框中「设备名字」= 「deviceName」 + 「modelId 对应设备型号」。如「devcieName」为「iot」，modelId 对应设备型号是「校园电话」，最终名字为「iot 校园电话」

![](../../_assets/voip-2-9d0cdd5e-cf1f0d629103.jpg)

## 2. 处理授权失效的情况

用户在授权成功后，下列操作可能导致授权失效：

- 清空授权： **在最近使用中删除小程序，用户的授权记录会被清空** 。
- 取消授权：用户同意授权后，小程序设置页面中会出现「语音、视频通话提醒」模块，点击进入后用户可以管理已授权的设备，并可以取消授权。（需要微信客户端 >= 8.0.30 支持）

为了保证用户能够正常使用音视频通话能力， **开发者需要处理授权失效的情况。** 在发起通话前，建议开发者通过第 4 节所述方式 **检查授权状态** 。并在必要时提醒用户重新授权：

- 清空授权：可以直接调用 `requestDeviceVoIP` 请用户进行重新授权。
- 取消授权/用户拒绝授权：再次调用 `requestDeviceVoIP` 不会出现授权弹框。开发者应引导用户在设置页中手动开启授权开关。

开发者可以通过以下方式判断用户的授权状态：

- 通过发起通话失败的错误码。使用插件发起通话时，若用户未授权设备，会返回 errCode: 9。（若使用设备组，请确认设备组内存在此设备）
- 在用户使用小程序时，查询授权状态。参见第 4 节。

## 3. 批量授权

如果需要批量授权，可以创建 [设备组](../device-group.md) 。在用户授权和设备进行音视频通话时，可以批量授权给一个设备组，而无需对每台设备重复授权。

例如，在校园电话场景下，同一所学校可能有很多台话机。可以将同一所学校的设备加入到一个设备组，并使用 [wx.requestDeviceVoIP](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.requestDeviceVoIP.html) 对整个设备组进行授权。

**注意：对于设备组，deviceName 显示为创建设备组时指定的名称，授权时暂不允许自定义。**

> 需要基础库 >= 2.30.4 支持。

```js
wx.requestDeviceVoIP({
  isGroup: true,
  groupId: '设备组 ID',
  success(res) {
    console.log(res)
  },
  fail(res) {
    console.log(res)
  },
})
```

## 4. 授权状态查询

开发者可以在 **用户使用小程序** 时，通过下列方式查询授权状态。 **根据小程序统一的授权体系设计，不提供后台接口查询授权状态，也不提供用户操作授权的事件回调。**

### 4.1 当前用户授权的设备（组）

查询当前登录的用户同意/拒绝或取消授权了哪些设备（组）。

在 **手机微信端小程序内** 调用 [`wx.getDeviceVoIPList`](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.getDeviceVoIPList.html) ，可用于在手机端发起通话前检查授权状态。

> 需要基础库 >= 2.30.3 支持。设备组 >= 2.30.4 支持。

```js
// 小程序基础库接口
wx.getDeviceVoIPList({
  success(res) {
    console.log('[getDeviceVoIPList]', res.list)
    // [{sn: 'xxx', model_id: 'xxx', status: 0}]
    // status: 0/未授权；1/已授权
  },
})
```

- 设备组只有 groupId 字段，sn 和 model\_id 为 `undefined` 。

### 4.2 当前设备是否被授权

根据用户 openId，查询指定用户是否授权设备（组）。

由插件提供 [getIotBindContactList](../voip-plugin/api/getIotBindContactList.md) 接口， **一般在设备端使用** ，可用于在设备端发起通话前（如联系人页面）检查授权状态。

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

wmpfVoip
  .getIotBindContactList({
    sn: '设备sn',
    model_id: '申请的modelid',
    openid_list: ['openid_1', 'openid_2'], // 传入需要验证的openid列表
  })
  .then(res => {
    console.log(`[getIotBindContactList]:`, res.contact_list)
    // [{sn: 'xxx', model_id: 'xxx', status: 0}]
    // status: 0/未授权；1/已授权
  })
```
