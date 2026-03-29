<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/device/voip-plugin/wxpay.html -->

# 校园场景支付刷脸模式

对于部分存量的支付刷脸设备，我们额外支持通过微信支付人脸识别的用户身份来发起通话。

支付刷脸设备的通话存在以下限制：

- 只支持微信支付刷脸设备使用，具体的开通方式请参考微信支付的相关文档；
- 只支持安卓设备，WMPF <= 2.0 版本；
- 只支持设备发起呼叫，不支持手机微信呼叫设备。

## 1. 发起通话

支付刷脸设备也是通过 [initByCaller](./api/initByCaller.md) 接口发起通话，但是在参数上有一些区别。支付刷脸设备请使用下列 businessType：

<table><thead><tr><th>businessType</th> <th>业务类型</th> <th>caller.id</th> <th>listener.id</th> <th>voipToken</th> <th>最低版本</th></tr></thead> <tbody><tr><td>0</td> <td>刷脸模式（时长计费）</td> <td>微信支付刷脸返回的 user_id</td> <td>微信用户 openId</td> <td>微信支付刷脸返回的 voip_token</td> <td></td></tr> <tr><td>3</td> <td>刷脸模式（license 计费）</td> <td>同上</td> <td>同上</td> <td>同上</td> <td>2.3.8</td></tr></tbody></table>

- 使用前，需要在小程序中提前通过 [`wx.authorize`](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/authorize/wx.authorize.html) 让 openId 对应的用户授权 `scope.voip` ，否则会返回 `errCode: 8` ，具体流程请参见第 2 节；
- listener 必须为 caller 联系人。否则会返回 `errCode: 9` 。

## 2. 联系人管理

### 2.1 联系人绑定

校园场景下，开发者需要接入插件「联系人绑定关系」功能，只有在家长完成关系绑定操作后，孩子才可以给家长拨打音视频电话。

联系人绑定是 userId（孩子）和 openId（家长）的映射关系，开发者还能够通过相关接口实现联系人管理功能。

#### 管理员绑定

第一个联系人为管理员，需要 `wx.authorize` 授权 `voip.scope` ，再调用插件接口 `wmpfVoip.bindVoipAdminContact` 完成绑定。

```js
// 绑定成为管理员
try {
  await wx.authorize({
    scope: 'scope.voip',
  })
  const res = await wmpfVoip.bindVoipAdminContact({
    userId: 'xxxxxx', // 传入微信支付刷脸返回的 user_id
  })
  console.log(`bindVoipAdminContact`, res)
} catch (error) {
  console.error('authorize scope voip', error)
  wx.showToast({
    title: '请前往设置页授权通话提醒',
    icon: 'none',
  })
}
```

#### 其他联系人绑定

其他联系人由管理员分享页面进行绑定。即管理员在小程序中点击「分享」按钮, 并通过 `wmpfVoip.getBindContactPath` 获取插件分享页面链接，并在页面的 `onShareAppMessage` 中设置。

绑定完成后，会跳转到 [`setVoipEndPagePath`](./api/setVoipEndPagePath.md) 设置的页面。

```js
// 获取插件联系人绑定关系页面路径，用户会在该页面进行关系绑定操作。
// 分享绑定页面：在学生管理员进入页面时，提前获取分享链接
wmpfVoip
  .getBindContactPath({
    userId: 'xxxx', // 学生 id
    userName: 'xxxx', // 学生名字
    userAvatar: 'xxxx', // 学生头像
  })
  .then(path => {
    // 在 onShareAppMessage 中使用 path
    // 可在 path 后拼上参数, 如'&xxx=yyy', 小程序中通过 getPluginEnterOptions 获取
  })

// Page 中
Page({
  onShareAppMessage() {
    return {
      title: `邀请你成为「${userName}」的联系人`,
      path: 'xxxx', // getBindContactPath 获取的 path
    }
  },
})

// app.js
App({
  onLoad() {
    // 设置联系人绑定关系页面操作完成后要跳转的页面路径。
    wmpfVoip.setVoipEndPagePath({
      key: 'BindContact',
      url: 'xxxxxx',
      options: 'param1=xxx&param2=xxx',
    })
  },
})
```

**注意**

- userName 和 userId（微信支付刷脸返回的 user\_id）应与拨打方（学生）信息录入时保持一致；
- 拨打方应能获取接听方联系人的 openId、名字, 用于显示在联系人列表页面；
- 在完成绑定过程中，会触发相应事件。可通过 [`onVoipEvent`](./api/onVoipEvent.md) 进行监听。具体参考 `bindContact` 的 type。

### 2.2 查询联系人列表

#### 插件接口

```js
wmpfVoip.getVoipBindContactList({ userId: '学生userId' }).then(list => {
  /**
      [{
        user_id: 'xxx',
        is_ad: 0, // 0 普通联系人，1 管理员
        openid_list: [], // 管理员可以获取孩子（user_id）下绑定的所有联系人（openid）列表，包括自己。
      }]
    */
})
```

#### 后台接口

**请求地址**

```
POST https://api.weixin.qq.com/wxa/business/getvoipcontactlist?access_token=ACCESS_TOKEN
```

**请求参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>access_token / cloudbase_access_token</td> <td>string</td> <td>是</td> <td><a href="(auth.getAccessToken)">接口调用凭证</a></td></tr> <tr><td>user_id</td> <td>string</td> <td>是</td> <td>学生 userId</td></tr></tbody></table>

**返回值**

**Object**

**返回的 JSON 数据包**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errcode</td> <td>number</td> <td>错误码</td></tr> <tr><td>errmsg</td> <td>string</td> <td>错误信息</td></tr> <tr><td>contact_list</td> <td>ContactInfo[]</td> <td>联系人列表</td></tr></tbody></table>

**ContactInfo**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>open_id</td> <td>string</td> <td>联系人 openid</td></tr> <tr><td>role</td> <td>number</td> <td>联系人身份，0 为普通联系人，1 为管理员。</td></tr></tbody></table>

**errCode 合法值**

<table><thead><tr><th>errCode</th> <th>说明</th></tr></thead> <tbody><tr><td>0</td> <td>成功</td></tr> <tr><td>1</td> <td>用户无联系人列表</td></tr></tbody></table>

### 2.3 删除联系人

只有管理员才能删除学生（user\_id）的联系人（openid），管理员不能删除自己。

```js
wmpfVoip.deleteVoipBindContact({
  userId: 'xxx',
  openidList: ['openId1', 'openId2'],
})
```

### 2.4 转移管理员

只有管理员才能调用转移接口。

```js
wmpfVoip.transerAdmin({
  userId: 'xxx',
  newAdminOpenid: '新管理员的openid',
})
```

### 2.5 监听事件

在绑定联系人的过程中， `onVoipEvent` 会收到 `bindContact` 事件，获取分享绑定联系人状态：

**data 参数**

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>type</td> <td>string</td> <td>绑定结果，取值参见下文</td></tr> <tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr> <tr><td>userId</td> <td>string</td> <td>学生 user_id</td></tr></tbody></table>

**type 取值**

<table><thead><tr><th>type</th> <th>描述</th></tr></thead> <tbody><tr><td>success</td> <td>联系人绑定成功</td></tr> <tr><td>unbind</td> <td>联系人未绑定该学生</td></tr> <tr><td>binded</td> <td>联系人已绑定过该学生</td></tr> <tr><td>expire</td> <td>分享链接过期</td></tr> <tr><td>overload</td> <td>该学生绑定的联系人已超过限制</td></tr> <tr><td>invalid</td> <td>分享链接非法，原因可能是该链接由非管理员分享</td></tr> <tr><td>auth</td> <td>联系人授权 scope.voip 失败</td></tr> <tr><td>cancel</td> <td>联系人取消绑定</td></tr></tbody></table>
