<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/callWMPF.html -->

# callWMPF(Object req)

> 本接口为异步接口，返回 `Promise` 对象。
>
> 需插件 2.4.0 版本开始支持

从手机客户端的小程序呼叫运行安卓 WMPF 的设备。调用此接口后，会创建 VoIP 房间，并且向设备推送 WMPF pushMsg 提醒。详情参考 [《手机微信呼叫设备(安卓)》](../../voip/call-wmpf.md) 。

**本接口只能在微信客户端内使用，不可在 WMPF 内使用。建议先阅读 [接口介绍](./call-intro.md) 。**

## 参数

### Object req

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>roomType</td> <td>string</td> <td></td> <td>是</td> <td>通话类型。voice: 音频通话；video: 视频通话</td> <td></td></tr> <tr><td>sn</td> <td>string</td> <td></td> <td>是</td> <td>接听方设备 SN</td> <td></td></tr> <tr><td>modelId</td> <td>string</td> <td></td> <td>是</td> <td>接听方设备 modelId</td> <td></td></tr> <tr><td>pushToken</td> <td>string</td> <td></td> <td>是</td> <td>从设备获取的 <a href="https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/push.html" target="_blank" rel="noopener noreferrer">pushToken<span></span></a></td> <td></td></tr> <tr><td>nickName</td> <td>string</td> <td></td> <td>是</td> <td>设备端显示的微信用户名称</td> <td></td></tr> <tr><td>deviceName</td> <td>string</td> <td></td> <td>否</td> <td>微信端显示的设备名称</td> <td>2.4.1</td></tr> <tr><td>chargeType</td> <td>string</td> <td>'license'</td> <td>否</td> <td>计费方式。duration: 时长计费；license：license 计费</td> <td></td></tr> <tr><td>timeLimit</td> <td>number</td> <td></td> <td>否</td> <td>最大通话时长，需为 &gt; 0 的数字</td> <td></td></tr> <tr><td>enableCallerCamera</td> <td>boolean</td> <td>true</td> <td>否</td> <td>拨打方是否启用摄像头。</td> <td></td></tr> <tr><td>enableListenerCamera</td> <td>boolean</td> <td>true</td> <td>否</td> <td>接听方是否启用摄像头。</td> <td></td></tr> <tr><td>envVersion</td> <td>string</td> <td>'release'</td> <td>否</td> <td>接听方打开的小程序类型。<br>取值：release: 正式版; trial: 体验版; develop: 开发版。<br>正式版小程序只能拨打给正式版，设置这一字段无效。</td> <td></td></tr> <tr><td>customQuery</td> <td>string</td> <td></td> <td>否</td> <td>接听方打开小程序时，会作为 query 拼接到插件页面路径后，格式如 <code>a=1&amp;b=2</code>。可在接听端小程序内通过 <code>getPluginOnloadOptions</code> 或 <code>getPluginEnterOptions</code> 接口获取到</td> <td></td></tr></tbody></table>

## 返回值

**本接口调用失败会抛出 [异常](./errCode.md) 。**

### Object

接口调用成功时，返回如下：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>roomId</td> <td>string</td> <td>本次通话的房间号</td> <td></td></tr></tbody></table>

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

try {
  const { roomId } = await wmpfVoip.callWMPF({
    roomType: 'video',
    sn: '设备 SN',
    modelId: '设备 modelId',
    nickName: '设备端显示的微信用户名称',
    pushToken: 'xxxx*****xxxx',
  })

  if (/* 当前不在插件页面 */) {
    wx.redirectTo({
      url: wmpfVoip.CALL_PAGE_PATH,
    })
  }
} catch (e) {
  console.error('callWMPF failed:', e)
  wx.showToast({
    title: '呼叫失败',
    icon: 'error',
  })
}
```
