<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share/private-message.html -->

# 小程序私密消息

## 功能介绍

小程序私密消息功能是这样一种能力：当分享者分享小程序卡片给其他用户或者微信群后，其他用户点击此小程序卡片时，开发者可以鉴别出点击卡片的用户是否被分享者分享过小程序卡片。

## 使用说明

### 1. 分享

创建业务活动后、分享小程序消息前，需要通过后台接口 [createActivityId](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/updatable-message/updatableMessage.createActivityId.html) 创建 `activityId` ，建立一个 `activityId` 与一个业务活动id唯一关联。

然后通过 [wx.updateShareMenu](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.updateShareMenu.html) 接口声明本次分享的消息为私密消息，私密消息具有不可二次转发性。

声明完成后，可以通过右上角菜单、分享按钮组件、wx.shareAppMessage（仅小游戏）分享私密消息给个人、群聊。

#### 场景一： 个人分享给个人

A --> B

#### 场景二： 个人分享给群

A --> [B, C, D, E]

示例代码

```js
wx.updateShareMenu({
  withShareTicket: true,
  isPrivateMessage: true,
  activityId: 'xxx',
})
```

### 2. 验证

从群聊、单聊消息卡片进入小程序时，通过 [wx.authPrivateMessage](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.authPrivateMessage.html) 接口可以验证当前用户是否是私密消息的接收者，即验证这条消息是否是 **A直接转发给B** 或者 **A转发给B所在的群** 。

该接口使用前，需要通过 [wx.login()](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html) 接口登录小程序。

#### 接口参数

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>shareTicket</td> <td>string</td> <td>shareTicket</td></tr></tbody></table>

#### success回调

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>valid</td> <td>Boolean</td> <td>验证是否通过</td></tr> <tr><td>iv</td> <td>String</td> <td>加密算法的初始向量，详细见<a href="https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html" target="_blank" rel="noopener noreferrer">加密数据解密算法<span></span></a></td></tr> <tr><td>encryptedData</td> <td>String</td> <td>经过加密的activityId，解密后可得到原始的activityId。若解密后得到的activityId可以与开发者后台的活动id对应上则验证通过，否则表明valid字段不可靠（被篡改） 详细见<a href="https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/signature.html" target="_blank" rel="noopener noreferrer">加密数据解密算法<span></span></a></td></tr></tbody></table>

## 注意事项

- 若返回的 `valid` 字段为 `false` ，表示此次验证不通过。
- 若返回的 `valid` 字段为 `true` ，表示验证通过。但是为了安全起见，预防 `valid` 字段被篡改的可能，可以把 `encryptedData` 和 `iv` 传到开发者后台去解密。若解密后得到的 `activityId` 就是当前活动所对应的 `activityId` 则验证通过，否则表示验证不通过。
- 当私密消息分享给群时，是按鉴别时刻用户是否在群里作为判断。
- `activityId` 创建后7天内分享有效，120天内验证有效。

## 示例代码

```js
wx.authPrivateMessage({
  shareTicket: 'xxxxxx',
  success(res) {
    console.log('authPrivateMessage success', res)
    // res
    // {
    //   errMsg: 'authPrivateMessage:ok'
    //   valid: true
    //   iv: 'xxxx',
    //   encryptedData: 'xxxxxx'
    // }
  },
  fail(res) {
    console.log('authPrivateMessage fail', res)
  }
})
```
