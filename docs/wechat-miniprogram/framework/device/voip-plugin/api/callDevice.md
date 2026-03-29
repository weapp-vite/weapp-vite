<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/callDevice.html -->

# callDevice(Object req)

> 本接口为异步接口，返回 `Promise` 对象。
>
> 需插件 2.4.0 版本开始支持

从手机客户端的小程序呼叫 Linux 设备、RTOS 设备。调用此接口后，会创建 VoIP 房间。开发者应自行向设备端推送通话提醒。详情参考 [《手机微信呼叫设备(Linux 直连)》](../../voip/call-device.md) 。

**本接口只能在微信客户端内使用，不可在 WMPF 内使用。建议先阅读 [接口介绍](./call-intro.md) 。**

## 参数

### Object req

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>roomType</td> <td>string</td> <td></td> <td>是</td> <td>通话类型。voice: 音频通话；video: 视频通话</td> <td></td></tr> <tr><td>sn</td> <td>string</td> <td></td> <td>是</td> <td>接听方设备 SN</td> <td></td></tr> <tr><td>modelId</td> <td>string</td> <td></td> <td>是</td> <td>接听方设备 modelId</td> <td></td></tr> <tr><td>chargeType</td> <td>string</td> <td>'license'</td> <td>否</td> <td>计费方式。duration: 时长计费；license：license 计费</td> <td></td></tr> <tr><td>timeLimit</td> <td>number</td> <td></td> <td>否</td> <td>最大通话时长，需为 &gt; 0 的数字</td> <td></td></tr> <tr><td>enableCallerCamera</td> <td>boolean</td> <td>true</td> <td>否</td> <td>拨打方是否启用摄像头</td> <td></td></tr> <tr><td>enableListenerCamera</td> <td>boolean</td> <td>true</td> <td>否</td> <td>接听方是否启用摄像头</td> <td></td></tr> <tr><td>nickName</td> <td>string</td> <td></td> <td>否</td> <td>设备端显示的微信用户名称，仅记录</td> <td></td></tr> <tr><td>deviceName</td> <td>string</td> <td></td> <td>否</td> <td>微信端显示的设备名称</td> <td>2.4.1</td></tr> <tr><td>isCloud</td> <td>boolean</td> <td>false</td> <td>否</td> <td>如果是呼叫 RTOS 设备，设置为 true 以触发消息回调</td> <td></td></tr> <tr><td>payload</td> <td>string</td> <td></td> <td>否</td> <td>呼叫 RTOS 时，可以带 payload 到回调消息中</td> <td></td></tr> <tr><td>encodeVideoFixedLength</td> <td>number</td> <td>0</td> <td>否</td> <td>编码的长边值，可取 320、480、640</td> <td></td></tr> <tr><td>encodeVideoRotation</td> <td>number</td> <td>0</td> <td>否</td> <td>编码的视频旋转方向。1: 发出正向流. 2: 保持发出旋转流</td> <td></td></tr> <tr><td>encodeVideoRatio</td> <td>number</td> <td>0</td> <td>否</td> <td>视频的比例, 宽/高*100</td> <td></td></tr> <tr><td>encodeVideoMaxFPS</td> <td>number</td> <td>0</td> <td>否</td> <td>视频的最大 FPS, 8-15</td> <td></td></tr></tbody></table>

## 返回值

**本接口调用失败会抛出 [异常](./errCode.md) 。**

### Object

接口调用成功时，返回如下：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>roomId</td> <td>string</td> <td>本次通话的房间号</td> <td></td></tr></tbody></table>

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default

try {
  const { roomId } = await wmpfVoip.callDevice({
    roomType: 'video',
    sn: '设备 SN',
    modelId: '设备 modelId',
    nickName: '设备端显示的微信用户名称',
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
