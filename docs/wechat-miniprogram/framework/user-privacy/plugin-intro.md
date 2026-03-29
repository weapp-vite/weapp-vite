<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/plugin-intro.html -->

# 插件用户隐私保护说明内容介绍

插件用户隐私保护说明包括下列板块，其中具体的说明仅为示例。

### 插件基本信息

包括插件名称、插件提供方名称。

```
  插件名称：客服助手
  插件提供方名称: 深圳市腾讯计算机系统有限公司
```

### 插件处理的信息

开发者需在此板块声明所处理的用户信息，微信会根据插件版本隐私接口调用情况展示必填项，开发者可自主勾选其他项目。

```
  - 开发者收集你选中的照片或视频信息，用于在客服会话中发送图片或视频类型的聊天内容。
  - 为了发送语音类型的聊天内容，开发者将在获取你的明示同意后，访问你的麦克风。
```

隐私接口与对应的处理的信息关系如下：

<table><thead><tr><th>处理的信息</th> <th>接口或组件</th></tr></thead> <tbody><tr><td>收集你的昵称、头像</td> <td>&lt;button open-type="chooseAvatar"&gt;、&lt;input type="nickname"&gt;、&lt;functional-page-navigator name="loginAndGetUserInfo"&gt;、wx.getUserInfo (已回收)</td></tr> <tr><td>收集你的位置信息</td> <td>wx.authorizeForMiniProgram({scope:'scope.userLocation'})、wx.getLocation、wx.startLocationUpdate、wx.getFuzzyLocation</td></tr> <tr><td>收集你选择的位置信息</td> <td>wx.choosePoi、wx.chooseLocation</td></tr> <tr><td>收集你的地址</td> <td>wx.chooseAddress</td></tr> <tr><td>收集你的发票信息</td> <td>wx.chooseInvoiceTitle、wx.chooseInvoice</td></tr> <tr><td>收集你选中的照片或视频信息</td> <td>wx.chooseImage、wx.chooseMedia、wx.chooseVideo</td></tr> <tr><td>访问你的麦克风</td> <td>wx.authorizeForMiniProgram({scope: 'scope.record'})、wx.startRecord、RecorderManager.start、&lt;live-pusher&gt;、wx.joinVoIPChat</td></tr> <tr><td>访问你的摄像头</td> <td>wx.authorizeForMiniProgram({scope: 'scope.camera'})、wx.createVKSession、&lt;camera&gt;、&lt;live-pusher&gt;、&lt;voip-room&gt;</td></tr> <tr><td>访问你的蓝牙</td> <td>wx.openBluetoothAdapter、wx.createBLEPeripheralServer</td></tr> <tr><td>使用你的相册（仅写入）权限</td> <td>wx.authorizeForMiniProgram({scope: 'scope.writePhotosAlbum'})、wx.saveImageToPhotosAlbum、wx.saveVideoToPhotosAlbum</td></tr> <tr><td>使用你的通讯录（仅写入）权限</td> <td>wx.addPhoneContact</td></tr> <tr><td>调用你的加速传感器</td> <td>wx.startAccelerometer</td></tr> <tr><td>调用你的磁场传感器</td> <td>wx.startCompass</td></tr> <tr><td>调用你的方向传感器</td> <td>wx.startDeviceMotionListening</td></tr> <tr><td>调用你的陀螺仪传感器</td> <td>wx.startGyroscope</td></tr> <tr><td>读取你的剪切板</td> <td>wx.setClipboardData、wx.getClipboardData</td></tr></tbody></table>
