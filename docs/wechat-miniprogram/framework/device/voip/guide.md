<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/guide.html -->

# 通话异常排查指南

在通话过程中，如果碰到「无法发起通话」，「通话发起后异常退出」，「接听方一接听就挂断」，「通话异常退出」等问题，可以参考本文进行排查。

一次通话有 **「拨打方」（或「来电方」、「主叫」）** 和 **「接听方」（或「被叫」）** 两个角色。通常，我们可以将一次硬件和小程序之间的 VoIP 通话分为 **「发起」、「加入」、「等待」和「通话」** 四个阶段。不同阶段可能会有不同类型的问题，在排查时，应首先根据表现确定是哪个阶段出现异常，在按照具体阶段的指引进行进一步分析。

**建议使用插件 2.3.2 及以上版本。**

## 1. 发起阶段

发起阶段是指调用插件 `initByCaller` 接口或 Linux SDK `wx_voip_session_call` 创建 VoIP 房间的阶段。在此阶段中，微信后台会进行一系列通话前置的检查操作，包括但不限于：

- voipToken 的有效性。
- 用户和设备之间是否存在授权关系。
- 小程序流量包是否有余量，或设备是否已绑定有效的 license。

校验通话后，微信后台会向接听方推送通话提醒。

**在发起阶段如果失败，接口会返回 errCode** ，开发者可以根据 [插件文档](../voip-plugin/api/initByCaller.md) 的说明来排查问题原因，比较常见的错误有以下几类。

### (1) 用户未授权设备 (errCode: 9)

设备要和微信用户通话，必须先进行授权，具体过程请参考 [《用户授权设备》文档](./auth.md) 。

出现此错误，常见的有以下情况：

- 未使用 [`wx.requestDeviceVoIP`](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.requestDeviceVoIP.html) 向用户请求过授权，或请求后用户拒接授权；
- 用户曾经授权过，但是后续取消了授权；
- 用户从最近使用中删除了小程序。此时会清空该用户和小程序间的所有授权记录；
- 传入的 openId 不是要拨打给用户的，例如：授权的是家长，这里传入了孩子的 openId。

在使用设备组的情况下，常见还有以下情况：

- 用户授权了设备组 A，但设备未被添加到设备组 A 中或已被 [`removeIotGroupDevice`](https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/(removeIotGroupDevice)) 接口移除;
- 用户授权了设备组 A，但设备被使用 [`addIotGroupDevice`](https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/(addIotGroupDevice)) (force\_add=true) 强制转移到了另一设备组 B，也会导致设备从设备组 A 里移除。

**优化建议**

建议使用 [授权状态查询](./auth.md#_4-%E6%8E%88%E6%9D%83%E7%8A%B6%E6%80%81%E6%9F%A5%E8%AF%A2%E6%8E%A5%E5%8F%A3) 接口，判断用户和设备/设备组直接是否存在授权关系。

- 手机微信内发起通话前，建议提前调用 [`wx.getDeviceVoIPList`](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/device-voip/wx.getDeviceVoIPList.html) 查询用户已授权设备的列表，判断设备已被授权再发起通话，否则应请求用户重新授权；
- 设备发起通话前，建议提前调用插件 `getIotBindContactList` 接口判断设备和用户间是否存在授权关系，存在时再发起通话，否则应提示用户重新授权；

对于设备组，可以使用 [getIotGroupInfo](https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip/(getIotGroupInfo)) 查询设备组中的设备列表。

### (2) 设备呼叫手机微信 voipToken 错误 (errCode: 13)

对于使用 [设备认证 SDK](../device-register-sdk.md) 注册的设备（此时 `voipToken` 传入 SDK 获取到的 `deviceToken` ），常见有以下情况：

- `deviceToken` 过期。 `deviceToken` 是有一定有效期的，需要定时进行更新，如果获取时间过久会失效。
- 未传入 `voipToken` 字段或传入空字符串。此方式仅适用于使用 WMPF registerMiniProgramDevice 接口注册的设备。

对于使用 [WMPF 注册](../device-register-wmpf.md) 的设备，可能有以下情况：

- 设备之前是使用设备认证 SDK 的，未使用 WMPF 的 [registerMiniProgramDevice](https://developers.weixin.qq.com/doc/oplatform/Miniprogram_Frame/api/cli/miniprogramdevice/registerMiniProgramDevice.html) 接口重新注册过。
- WMPF 低于 1.2.0，或插件版本低于 2.3.0。

## 2. 「拨打方」加入阶段

创建 VoIP 房间成功后，「拨打方」会直接加入该房间，界面上会显示「连接中...」。加入的时长一般与当前网络状态有关。

加入成功后，拨打方会触发 `joinedRoomByCaller` 事件。

### (1) 设备之前可以拨打成功，突然开始持续失败，需重启 WMPF 才能恢复

大概率是安卓 WMPF 低版本的 bug，请升级到 >= 2.0 版本解决。如新版本仍发现类似问题，请参考第 8 节反馈。

这种情况下开发者可能会收到 `joinFailCaller` 事件，errMsg 包含 `Already in room or joining` ，此时可以尝试重启 WMPF。

### (2) 一直显示「连接中」（卡在本阶段），无法加入房间，通话被突然结束

可能是网络状况较差导致加入过慢，此时通话可能会因接听方等待超时而结束，触发 `abortVoip` 和 `endVoip` 事件。

### (3) 未加入房间就直接退出通话

常见原因有：

- 小程序 **错误调用** 插件 `forceHangUpVoip` 接口挂断通话，触发 `cancelVoip` 事件和 `endVoip` 事件（Toast 提示 「通话已被小程序结束」）。
    - 之前排查遇到部分小程序会设置定时器来设置通话的最大时长，通话结束后，某些情况下计时器没有清理导致在后续某次通话时随机挂断通话。
    - 我们建议通过监听 `calling` 事件，并判断 keepTime 来限制通话时长， **不建议使用定时器** 。
- 因网络超时或其他异常导致加入房间失败，这种情况下拨打方会收到 `joinFailCaller` 事件，可以通过 data 字段拿到 errMsg 和 message 来分析错误原因。

## 3. 「拨打方」等待阶段

「拨打方」加入房间成功后，若「接听方」尚未进入房间，「拨打方」会进入等待状态。此时界面显示从「连接中...」变为「等待对方接听...」。

正常情况下，在本阶段下列操作会导致通话直接结束：

- 「拨打方」用户点击挂断按钮，会触发 `cancelVoip` 和 `endVoip` 事件；
- 「接听方」超时未接听（目前是 60s），会触发 `timeout` 和 `endVoip` 事件；
- 小程序调用插件 `forceHangUpVoip` 接口挂断通话，触发 `cancelVoip` 事件和 `endVoip` 事件。

### (1) 未接通通话就直接退出

常见原因有：

- 小程序 **错误调用** 插件 `forceHangUpVoip` 接口挂断通话，会触发 `cancelVoip` 事件和 `endVoip` 事件（Toast 提示 「通话已被小程序结束」）。（常见原因同 2(3)）
- 因网络超时或设备端其他异常导致通话中断，会触发 `abortVoip` 和 `endVoip` 事件，可参考第 8 节反馈；

## 4. 「接听方」加入（接听）阶段

接听方接收到来电提醒，并点击接听按钮后，「接听方」会加入通话房间，界面上会显示「连接中...」。加入的时长一般与当前网络状态有关。

- 如果此时接听方设备正在进行其他通话，会被判定为占线，拨打方会收到 `busy` 事件和 `endVoip` 事件；
- 如果此时接听方点击拒绝接听按钮，会收到 `rejectVoip` 事件和 `endVoip` 事件；
- （VoIP 插件 < 2.3.2 版本）用户进行锁屏、退出微信或退出小程序，也会被视为拒接，会收到 `rejectVoip` 事件和 `endVoip` 事件；

### (1) 点接听时没有接通，通话反而直接结束

常见原因有：

- 接听较晚，此时该通话已经在一段时间前结束（可能由于消息延迟引起）。
- 接听时「拨打方」刚好挂断通话或因超时通话结束。
- 因网络超时或其他异常导致加入房间失败，这种情况下接听方会收到 `joinFailListener` 事件，可以通过 data 字段拿到 errMsg 和 message 对象来分析错误原因。
- 接听时「拨打方」因为在加入和等待阶段中出现异常已经退出房间，导致通话结束。
- 接听时用户正在进行系统电话或微信内其他的 VoIP 通话，导致无法再次加入新的通话。

### (2) 用户还没选择接听或挂断，通话就结束了，提示通话被拒绝

（VoIP 插件 < 2.3.2 版本）用户进行锁屏、退出微信或退出小程序，也会被视为拒接，会收到 `rejectVoip` 事件和 `endVoip` 事件；

## 5. 「接听方」等待阶段

「接听方」加入房间成功后，若「拨打方」尚未进入房间，「接听方」会进入等待状态，此时，界面显示从「连接中...」变为「等待对方加入通话...」。

在本阶段，下列操作会导致通话直接结束：

- 「接听方」用户点击挂断按钮，会触发 `rejectVoip` 和 `endVoip` 事件；
- 小程序调用插件 `forceHangUpVoip` 接口挂断通话，触发 `rejectVoip` 事件和 `endVoip` 事件。

### (1) 接听后一直未开始通话，或等待一会后通话自动结束

常见原因有：

- 「拨打方」超时未加入成功，会触发 `abortVoip` 和 `endVoip` 事件；
- 小程序 **错误调用** 插件 `forceHangUpVoip` 接口挂断通话，触发 `rejectVoip` 事件和 `endVoip` 事件（Toast 提示 「通话已被小程序结束」）。

## 6. 通话阶段

当通话双方都加入房间成功后，通话开始，直到其中一方结束通话为止。

正常情况下，通话结束是由「接听方」或「拨打方」用户点击挂断按钮或小程序调用插件 `forceHangUpVoip` 接口触发。此时会说的 `hangUpVoip` 事件和 `endVoip` 事件；

> 通话时长只包括「通话阶段」，扣费也是按「通话阶段」时长扣费，如果未接通则不扣费。

### (1) 用户没点击挂断，通话自己结束

可能是以下原因：

- 小程序调用插件 `forceHangUpVoip` 接口挂断通话，触发 `hangUpVoip` 事件和 `endVoip` 事件（Toast 提示 「通话已被小程序结束」）；
- 「接听方」或「拨打方」意外退出，例如小程序被杀、网络中断等，另一方会触发 `abortVoip` 和 `endVoip` 事件；
- 通话过程中「接听方」或「拨打方」发生其他异常，异常方会触发 `abortVoip` 和 `endVoip` 事件，可参考第 8 节反馈；

## 7. 关于通话提醒

请参考 [《通话提醒异常排查指南》](./notification.md)

如有其他情形，可参考第 8 节反馈。

## 8. 仍未解决

如果仍无法确定原因，可以在 [微信开放社区「硬件服务」板块](https://developers.weixin.qq.com/community/minihome/mixflow/2351405025148862470) 发帖联系我们分析。

**如果帖子发在其他板块，可能会被反馈到其他团队，没办法及时处理，请在「硬件服务」板块重新发帖。**

帖子中请提供以下内容

- （安卓）WMPF 版本号：如 v1.2.0 / v2.0.0
- （Linux）SDK 版本号：如 0xD5000088
- VoIP 插件版本号：如 v2.3.0
- 小程序 appId: 如 wxabcdefhigklmnopq
- 标识一次通话的信息（二选一）
    1. 该次通话插件返回的 roomId 及通话发生的日期。
    2. 至少通话一方的信息（设备 SN 或微信用户 openId/微信号），以及通话开始的具体时间点（越精确越好）。

如果有需要，我们可能还会联系你额外提供设备端或手机微信端日志，方法如下：

**设备端日志**

```sh
adb pull /storage/emulated/0/Android/data/com.tencent.wmpf/files/xlog
```

并把取得的整个日志文件夹 `xlog` 发给我们。

**手机微信端日志**

微信客户端「我」->「设置」->「帮助与反馈」->「右上角扳手 🔧」->「上传日志」-> 选择「异常当天的日志」上传，并提供问题发生的 **时间** 和 **微信号** 。
