<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/miniprogram-intro.html -->

# 小程序用户隐私保护指引内容介绍

本指引依据适用的个人信息保护相关法律法规制定，包括但不限于《中华人民共和国个人信息保护法》等，由开发者根据实际情况填写。

小程序用户隐私保护指引包括下列板块，其中具体的说明仅为示例。

### 引导语

```
  本指引是小程序示例小程序开发者”深圳市腾讯计算机系统有限公司“（以下简称“开发者”）为处理你的个人信息而制定。
```

### 开发者处理的信息

```
  根据法律规定，开发者仅处理实现小程序功能所必要的信息。
  - 开发者收集你选中的照片或视频信息，用于用户上传提交代码审核所需要的截图。
```

开发者需在此板块声明所处理的用户信息，微信会根据小程序版本隐私接口调用情况展示必填项，开发者可自主勾选其他项目。隐私接口与对应的处理的信息关系如下：

<table><thead><tr><th>处理的信息</th> <th>接口或组件</th></tr></thead> <tbody><tr><td>收集你的昵称、头像</td> <td>&lt;button open-type="chooseAvatar"&gt;、&lt;input type="nickname"&gt;、wx.getUserInfo (已回收)、wx.getUserProfile (已回收)、&lt;button open-type="userInfo"&gt;(已回收)</td></tr> <tr><td>收集你的位置信息</td> <td>wx.authorize({scope:'scope.userLocation'})、wx.authorize({scope: 'scope.userLocationBackground'})、wx.authorize({scope: 'scope.userFuzzyLocation'})、wx.getLocation、wx.startLocationUpdate、wx.startLocationUpdateBackground、wx.getFuzzyLocation、MapContext.moveToLocation</td></tr> <tr><td>收集你选择的位置信息</td> <td>wx.choosePoi、wx.chooseLocation</td></tr> <tr><td>收集你的地址</td> <td>wx.chooseAddress</td></tr> <tr><td>收集你的发票信息</td> <td>wx.chooseInvoiceTitle、wx.chooseInvoice</td></tr> <tr><td>收集你的微信运动步数</td> <td>wx.authorize({scope: 'scope.werun'})、wx.getWeRunData</td></tr> <tr><td>收集你的手机号</td> <td>&lt;button open-type="getPhoneNumber"&gt;、&lt;button open-type="getRealtimePhoneNumber"&gt;</td></tr> <tr><td>收集你的车牌号</td> <td>wx.chooseLicensePlate</td></tr> <tr><td>收集你选中的照片或视频信息</td> <td>wx.chooseImage、wx.chooseMedia、wx.chooseVideo</td></tr> <tr><td>收集你选中的文件</td> <td>wx.chooseMessageFile</td></tr> <tr><td>访问你的麦克风</td> <td>wx.authorize({scope: 'scope.record'})、wx.startRecord、RecorderManager.start、&lt;live-pusher&gt;、wx.joinVoIPChat</td></tr> <tr><td>访问你的摄像头</td> <td>wx.authorize({scope: 'scope.camera'})、wx.createVKSession、&lt;camera&gt;、&lt;live-pusher&gt;、&lt;voip-room&gt;</td></tr> <tr><td>访问你的蓝牙</td> <td>wx.authorize({scope: 'scope.bluetooth'})、wx.openBluetoothAdapter、wx.createBLEPeripheralServer</td></tr> <tr><td>使用你的相册（仅写入）权限</td> <td>wx.authorize({scope: 'scope.writePhotosAlbum'})、wx.saveImageToPhotosAlbum、wx.saveVideoToPhotosAlbum</td></tr> <tr><td>使用你的通讯录（仅写入）权限</td> <td>wx.authorize({scope: 'scope.addPhoneContact'})、wx.addPhoneContact</td></tr> <tr><td>使用你的日历（仅写入）权限</td> <td>wx.authorize({scope: 'scope.addPhoneCalendar'})、wx.addPhoneRepeatCalendar、wx.addPhoneCalendar</td></tr> <tr><td>调用你的加速传感器</td> <td>wx.startAccelerometer</td></tr> <tr><td>调用你的磁场传感器</td> <td>wx.startCompass</td></tr> <tr><td>调用你的方向传感器</td> <td>wx.startDeviceMotionListening</td></tr> <tr><td>调用你的陀螺仪传感器</td> <td>wx.startGyroscope</td></tr> <tr><td>读取你的剪切板</td> <td>wx.setClipboardData、wx.getClipboardData</td></tr></tbody></table>

**平台会对开发者处理信息的目的进行审核，请如实填写。**

### 第三方插件信息

```
  为实现特定功能，开发者可能会接入由第三方提供的插件。第三方插件的个人信息处理规则，请以其公示的官方说明为准。XXX小程序接入的第三方插件信息如下：

  插件名称：客服助手
  插件提供方名称: 深圳市腾讯计算机系统有限公司
  - 开发者收集你选中的照片或视频信息，用于在客服会话中发送图片或视频类型的聊天内容。
  - 为了发送语音类型的聊天内容，开发者将在获取你的明示同意后，访问你的麦克风。
```

针对由引用了插件的小程序，将会在用户隐私保护指引中展示，展示内容包括插件名称、插件提供方名称与开发者处理的信息及目的。

### 第三方服务商信息

```
  小程序助手小程序由深圳市腾讯计算机系统有限公司代为开发，开发者保证深圳市腾讯计算机系统有限公司将在本指引规定范围内处理你的信息。
```

针对由代开发服务商进行开发的小程序，将会在用户隐私保护指引中进行展示。

### 用户权益

```
  1. 关于收集你的位置信息，你可以通过以下路径：小程序主页右上角“…”—“设置”—点击特定信息—点击“不允许”，撤回对开发者的授权。
  2. 关于收集你的手机号、收集你的发票信息，你可以通过以下路径：小程序主页右上角“...” — “设置” — “小程序已获取的信息” — 点击特定信息 — 点击“通知开发者删除”，开发者承诺收到通知后将删除信息。
  3. 关于你的个人信息，你可以通过以下方式与开发者联系，行使查阅、复制、更正、删除等法定权利。
  - 邮箱: miniprogram@tencent.com
```

微信会根据小程序版本隐私接口调用情况生成第1条与第2条描述，开发者需填写联系方式供用户联系开发者用于行使查阅、复制、更正、删除等法定权利。

若开发者在小程序内提供其他的用户可以行使查阅、复制、更正、删除等法定权利的入口，可以通过补充文档进行说明。

### 开发者对信息的存储

开发者需声明对信息的存储期限，如

```
  固定存储期限：180天
```

### 信息的使用规则

```
  1. 开发者将会在本指引所明示的用途内使用收集的信息。
  2. 如开发者使用你的信息超出本指引目的或合理范围，开发者必须在变更使用目的或范围前，再次以弹窗方式告知并征得你的明示同意。
```

### 信息对外提供

```
  1. 开发者承诺，不会主动共享或转让你的信息至任何第三方，如存在确需共享或转让时，开发者应当直接征得或确认第三方征得你的单独同意。
  2. 开发者承诺，不会对外公开披露你的信息，如必须公开披露时，开发者应当向你告知公开披露的目的、披露信息的类型及可能涉及的信息，并征得你的单独同意。
```

### 联系方式

```
  你认为开发者未遵守上述约定，或有其他的投诉建议、或未成年人个人信息保护相关问题，可通过以下方式与开发者联系；或者向微信进行投诉。
  - 邮箱 : miniprogram@**.com
```

### 补充文档

开发者可选择是否上传补充文档，微信会对文档内容进行审核。

当前文档格式只支持txt格式的纯文本文件，大小不超过100KB。

### 日期

```
  更新日期：2021-11-03
  生效日期：2021-11-03
```
