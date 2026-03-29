<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/api/onVoipEvent.html -->

# function onVoipEvent(function listener)

## 功能描述

监听 VoIP 通话相关事件。 **事件绑定需要在通话开始前完成** 。

**注意：不要在 onLoad、onShow 等生命周期内绑定事件，可能会因为生命周期多次调用而重复绑定。**

## 参数

### function listener

事件监听函数

#### 回调参数

##### Object event

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th> <th>最低版本</th></tr></thead> <tbody><tr><td>eventName</td> <td>string</td> <td>事件名称。请参考后文描述。</td> <td></td></tr> <tr><td>roomId</td> <td>string</td> <td>通话房间号。除 <code>bindContact</code>、<code>callPageOnShow</code> 事件外提供</td> <td>2.4.0</td></tr> <tr><td>groupId</td> <td>string</td> <td>与 roomId 相同</td> <td></td></tr> <tr><td>data</td> <td>Object</td> <td>某个事件额外的参数。不同事件的字段不同，请参考后文描述</td> <td></td></tr></tbody></table>

## 返回值

function

取消监听函数，调用后取消监听事件。该函数无参数，无返回值。

## 事件描述

### 1. startVoip

通话开始。

### 2. abortVoip

通话异常中断。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>keepTime</td> <td>number</td> <td>通话时长</td></tr> <tr><td>status</td> <td>string</td> <td>异常说明，取值参见后文</td></tr> <tr><td>error</td> <td>Object</td> <td>错误对象</td></tr> <tr><td>error.errMsg</td> <td>Object</td> <td>错误信息</td></tr></tbody></table>

**status 取值**

<table><thead><tr><th>status</th> <th>描述</th></tr></thead> <tbody><tr><td>abortByListener</td> <td>通话因本端异常中断（接听方触发）</td></tr> <tr><td>abortByCaller</td> <td>通话因本端异常中断（拨打方触发）</td></tr> <tr><td>unknown</td> <td>通话因对端异常中断</td></tr></tbody></table>

**常见 errMsg**

- `room status is abort` ：status=unknown，接收到对端通话异常时触发，需要根据 roomId 关联对端触发的 abortVoip 事件判断真正的异常原因。
- `listener waitOtherToJoin timeout` ：status=abortByListener，接听方加入房间后，拨打方一直未成功加入（可能是网络慢等原因）或异常退出，接听方等待 20s 超时后触发。此时建议分析接听方的情况来排查。
- `call interrupted due to close passive float ball` ：用户将小程序切后台后，会展示小程序浮窗，用户通过浮窗关闭小程序时触发。
- `in comming call` ：小程序通话被其他来电打断时触发。
- `call interrupted due to native reason` ：一般是由于通话过程中一段时间未收到数据包（一般是网络原因），被踢出房间中断通话。

### 3. hangOnVoip

通话被接听（仅接听方触发）。

### 4. cancelVoip

通话未接通，拨打方取消通话。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>status</td> <td>string</td> <td>取消原因说明，取值参见后文</td></tr></tbody></table>

**status 取值**

<table><thead><tr><th>status</th> <th>描述</th></tr></thead> <tbody><tr><td>manual</td> <td>用户点击界面挂断按钮取消通话。（仅拨打方）</td></tr> <tr><td>unloadCallPage</td> <td>插件页面被销毁导致取消通话。（仅拨打方）</td></tr> <tr><td>forceFromApp</td> <td>小程序调用 <code>forceHangUpVoip</code> 取消通话。（仅拨打方）</td></tr> <tr><td>other</td> <td>拨打方取消通话。（仅接听方）</td></tr></tbody></table>

### 5. rejectVoip

通话未接通，接听方拒接。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>status</td> <td>string</td> <td>拒接原因说明，取值参见后文</td></tr></tbody></table>

**status 取值**

<table><thead><tr><th>status</th> <th>描述</th></tr></thead> <tbody><tr><td>manual</td> <td>用户点击界面挂断按钮拒接通话（仅接听方）</td></tr> <tr><td>unloadCallPage</td> <td>插件页面被销毁导致拒接通话（仅接听方）</td></tr> <tr><td>forceFromApp</td> <td>小程序调用 <code>forceHangUpVoip</code> 拒接通话（仅接听方）</td></tr> <tr><td>other</td> <td>接听方拒接（仅拨打方）</td></tr></tbody></table>

### 6. hangUpVoip

通话已接通，拨打方/接听方挂断通话。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>keepTime</td> <td>number</td> <td>通话时长</td></tr> <tr><td>status</td> <td>string</td> <td>挂断方说明，取值参见后文</td></tr> <tr><td>origin</td> <td>string</td> <td>挂断原因说明，取值参见后文</td></tr></tbody></table>

**status 取值**

<table><thead><tr><th>status</th> <th>描述</th></tr></thead> <tbody><tr><td>endByListener</td> <td>接听方挂断</td></tr> <tr><td>endByCaller</td> <td>拨打方挂断</td></tr></tbody></table>

**origin 取值**

为了保持向下兼容，hangUpVoip 事件额外使用 origin 字段提供具体的挂断原因信息。

<table><thead><tr><th>origin</th> <th>描述</th></tr></thead> <tbody><tr><td>manual</td> <td>用户点击界面挂断按钮挂断通话（仅挂断方）</td></tr> <tr><td>unloadCallPage</td> <td>插件页面被销毁导致挂断通话（仅挂断方）</td></tr> <tr><td>forceFromApp</td> <td>小程序调用 <code>forceHangUpVoip</code> 导致挂断通话（仅挂断方）</td></tr> <tr><td>other</td> <td>对方挂断通话</td></tr> <tr><td>timeLimit</td> <td>超过最大通话时长</td></tr></tbody></table>

### 7. endVoip

通话结束。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>keepTime</td> <td>number</td> <td>通话时长</td></tr> <tr><td>callerName</td> <td>string</td> <td>拨打方名字</td></tr> <tr><td>listenerName</td> <td>string</td> <td>接听方名字</td></tr> <tr><td>roomType</td> <td>string</td> <td>房间类型</td></tr> <tr><td>isCaller</td> <td>boolean</td> <td>是否是拨打方</td></tr> <tr><td>businessType</td> <td>number</td> <td>业务类型</td></tr></tbody></table>

### 8. busy

通话未接通，接听方占线（仅拨打方触发）。

### 9. calling

通话过程中, 双方都会每秒触发一次。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>keepTime</td> <td>number</td> <td>通话时长</td></tr></tbody></table>

### 10. timeout

通话超时未接听。

### 11. joinedRoomByCaller

拨打方加入房间成功（仅拨打方触发）。

### 12. joinFailCaller

拨打方加入房间失败（仅拨打方触发）。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误消息</td></tr> <tr><td>message</td> <td>string</td> <td>由于向下兼容原因，某些情况下 data 是一个 Error 对象</td></tr></tbody></table>

### 13. joinFailListener

接听方加入房间失败（仅接听方触发）。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误消息</td></tr> <tr><td>message</td> <td>string</td> <td>由于向下兼容原因，某些情况下 data 是一个 Error 对象</td></tr></tbody></table>

### 14. finishVoip

通话完成。返回本次通话结算使用的实际时长。

需从后台获取最终时间后触发，触发时机晚于 endVoip。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>keepTime</td> <td>number</td> <td>结算用通话时长</td></tr></tbody></table>

### 15. callPageOnShow

插件通话页面 onShow。

### 16. showCustomBox

用户点击通话页面自定义按钮，展示自定义组件。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>callerId</td> <td>string</td> <td>拨打方 Id</td></tr> <tr><td>listenerId</td> <td>string</td> <td>接听方 Id</td></tr></tbody></table>

### 17. hideCustomBox

用户隐藏自定义组件。

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>callerId</td> <td>string</td> <td>拨打方 Id</td></tr> <tr><td>listenerId</td> <td>string</td> <td>接听方 Id</td></tr></tbody></table>

## 示例代码

```js
const wmpfVoip = requirePlugin('wmpf-voip').default
const offVoipEvent = wmpfVoip.onVoipEvent(event => {
  console.info(`onVoipEvent`, event)
})

// 需要取消监听时调用
offVoipEvent()
```
