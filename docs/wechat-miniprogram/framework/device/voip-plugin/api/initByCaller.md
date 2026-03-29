<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/initByCaller.html -->

# initByCaller(Object req)

> 本接口为异步接口，返回 `Promise` 对象。

发起通话并获取通话房间号。调用此接口后，会创建 VoIP 房间，并且向接听方推送接听提醒。

**建议先阅读 [接口介绍](./call-intro.md) 。**

## 参数

### Object req

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>roomType</td> <td>string</td> <td></td> <td>是</td> <td>通话类型。voice: 音频通话；video: 视频通话</td> <td></td></tr> <tr><td>caller</td> <td>Object</td> <td></td> <td>是</td> <td>拨打方信息</td> <td></td></tr> <tr><td>caller.id</td> <td>string</td> <td></td> <td>是</td> <td>拨打方 id，参考 businessType 的说明</td> <td></td></tr> <tr><td>caller.name</td> <td>string</td> <td></td> <td>否</td> <td>显示的拨打方名字。设备端发起通话时无效</td> <td></td></tr> <tr><td>caller.cameraStatus</td> <td>number</td> <td>0</td> <td>否</td> <td>是否启用摄像头。0: 开启；1: 关闭</td> <td></td></tr> <tr><td>listener</td> <td>Object</td> <td></td> <td>是</td> <td>接听方信息</td> <td></td></tr> <tr><td>listener.id</td> <td>string</td> <td></td> <td>是</td> <td>接听方 id，参考 businessType 的说明</td> <td></td></tr> <tr><td>listener.name</td> <td>string</td> <td></td> <td>否</td> <td>显示的接听方名字。</td> <td></td></tr> <tr><td>listener.cameraStatus</td> <td>number</td> <td>0</td> <td>否</td> <td>是否启用摄像头。0: 开启；1: 关闭</td> <td></td></tr> <tr><td>businessType</td> <td>number</td> <td>0</td> <td>否</td> <td>业务类型。详见 businessType 的说明</td> <td></td></tr> <tr><td>voipToken</td> <td>string</td> <td></td> <td>否</td> <td>拨打票据，部分情况下必填，参考 businessType 的说明</td> <td></td></tr> <tr><td>miniprogramState</td> <td>string</td> <td>formal</td> <td>否</td> <td>接听方点击通知时打开的小程序类型。<br>取值：formal: 正式版; trial: 体验版; developer: 开发版。<br>2.1.8 起，正式版小程序只能拨打给正式版，设置这一字段无效。</td> <td></td></tr> <tr><td>customQuery</td> <td>string</td> <td></td> <td>否</td> <td>接听方点击通知打开小程序时，会作为 query 拼接到插件页面路径后，格式如 <code>a=1&amp;b=2</code>。可在接听端小程序内通过 <code>getPluginOnloadOptions</code> 或 <code>getPluginEnterOptions</code> 接口获取到</td> <td></td></tr> <tr><td>timeLimit</td> <td>number</td> <td></td> <td>否</td> <td>最大通话时长，需为 &gt; 0 的数字</td> <td>2.3.8</td></tr></tbody></table>

## 返回值

**由于历史原因，本接口调用失败可能会抛出异常（一般是参数错误），也可能会返回 `isSuccess: false` （一般是后台错误）。**

接口成功返回后，仍需要使用 `isSuccess` 字段判断调用是否最终成功。

### Object

接口调用成功时，返回如下

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>isSuccess</td> <td>boolean</td> <td>是否调用成功，此时为 true</td> <td></td></tr> <tr><td>roomId</td> <td>string</td> <td>本次通话的房间号</td> <td>2.4.0</td></tr> <tr><td>groupId</td> <td>string</td> <td>与 roomId 相同</td> <td></td></tr> <tr><td>chargeType</td> <td>string</td> <td>计费方式。取值：duration: 时长计费；license: license 计费</td> <td>2.3.8</td></tr></tbody></table>

调用失败时，接口返回如下：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>isSuccess</td> <td>boolean</td> <td>是否调用成功，此时为 false</td> <td></td></tr> <tr><td><s>error</s></td> <td>object</td> <td>错误对象，已废弃。{ err_code: string, errMsg: string }</td> <td></td></tr> <tr><td>errCode</td> <td>number</td> <td>错误码，取值参考<a href="./errCode.html">错误码文档</a></td> <td></td></tr> <tr><td>errMsg</td> <td>string</td> <td>错误信息</td> <td></td></tr> <tr><td>errObj</td> <td><a href="./errCode.html">VoipError</a></td> <td>错误对象</td> <td>2.4.0</td></tr></tbody></table>

## 关于 businessType

不同 businessType 对应的部分参数含义不同，参数获取的具体方式请参考对应业务的文档。

<table><thead><tr><th>businessType</th> <th>业务类型</th> <th>caller.id</th> <th>listener.id</th> <th>voipToken</th></tr></thead> <tbody><tr><td>1</td> <td>硬件设备呼叫手机微信</td> <td>设备 SN</td> <td>微信用户 openId</td> <td>使用<a href="https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-register-sdk.html" target="_blank" rel="noopener noreferrer">设备认证 SDK<span></span></a>注册的设备传入 deviceToken.<br>使用 <a href="https://developers.weixin.qq.com/miniprogram/dev/framework/device/device-register-wmpf.html" target="_blank" rel="noopener noreferrer">WMPF 注册的设备<span></span></a>不能有这个字段（插件 2.3.0 支持）</td></tr> <tr><td>2</td> <td>手机微信呼叫硬件设备</td> <td>微信用户 openId</td> <td>设备 SN</td> <td>从设备获取的 <a href="https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/push.html" target="_blank" rel="noopener noreferrer">pushToken<span></span></a></td></tr></tbody></table>

- 发起通话前，需要在提前让 openId 对应的用户在微信客户端的小程序内进行授权，具体流程请参见 [授权文档](../../voip/auth.md) ；
- 传入 id 为 设备 SN 时，name 会强制使用用户授权时的「deviceName」+「modelId 对应设备型号」，不使用开发者传入的 name。
- 本接口 `businessType=2` 仅支持安卓 WMPF，呼叫 Linux 设备请使用 [callDevice](./callDevice.md) 。
- 本接口 `businessType=2` 不支持 license 计费，手机微信呼叫安卓 WMPF 建议使用 [callWMPF](./callWMPF.md) 。

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

try {
  const { isSuccess } = await wmpfVoip.initByCaller({
    caller: {
      id: '拨打方 Id',
      name: '拨打方名字',
    },
    listener: {
      id: '接听方 Id',
      name: '接听方名字',
    },
    roomType: 'video',
    businessType: 1,
    voipToken: 'xxxx*****xxxx',
    miniprogramState: 'developer', // 开发阶段建议使用开发版
  })

  if (isSuccess /* && 当前不在插件页面 */) {
    wx.redirectTo({
      url: wmpfVoip.CALL_PAGE_PATH,
    })
  } else {
    wx.showToast({
      title: '呼叫失败',
      icon: 'error',
    })
  }
} catch (e) {
  wx.showToast({
    title: '呼叫失败',
    icon: 'error',
  })
}
```
