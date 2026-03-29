<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/voip-chat.html -->

# 多人音视频对话

用于实现小程序内多人音视频对话的功能。

## 申请开通

小程序管理后台，「开发」-「接口设置」中自助开通该组件权限。相关接口 [wx.joinVoIPChat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.joinVoIPChat.html) 和组件 [voip-room](https://developers.weixin.qq.com/miniprogram/dev/component/voip-room.html) 。

## 调用流程

开发者仅需提供房间唯一标识，即可加入到指定的房间。传入相同唯一标识的用户，会进到相同的房间。为了保证前端传入的 `groupId` 可信， [wx.joinVoIPChat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.joinVoIPChat.html) 接口要求传入签名。详见 [签名算法](#%E7%AD%BE%E5%90%8D%E7%AE%97%E6%B3%95) 。当加入视频房间时，可结合 [voip-room](https://developers.weixin.qq.com/miniprogram/dev/component/voip-room.html) 组件显示成员画面。

## 前端接口

- 创建/加入房间： [wx.joinVoIPChat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.joinVoIPChat.html)
- 离开房间： [wx.exitVoIPChat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.exitVoIPChat.html)
- 更新房间麦克风/耳机静音设置： [wx.updateVoIPChatMuteConfig](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.updateVoIPChatMuteConfig.html)
- 监听房间成员变化： [wx.onVoIPChatMembersChanged](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatMembersChanged.html)
- 监听房间成员通话状态变化： [wx.onVoIPChatSpeakersChanged](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatSpeakersChanged.html)
- 监听通话中断： [wx.onVoIPChatInterrupted](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatInterrupted.html)
- 监听实时语音通话成员视频状态变化： [wx.onVoIPVideoMembersChanged](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/(wx.onOnVoIPVideoMembersChanged))
- 订阅视频画面成员： [wx.subscribeVoIPVideoMembers](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.subscribeVoIPVideoMembers.html)

## 签名算法

生成签名需要传入四个参数：

<table><thead><tr><th>参数名</th> <th>说明</th></tr></thead> <tbody><tr><td>appId</td> <td>小程序的 appId</td></tr> <tr><td>groupId</td> <td>游戏房间的唯一标识，由游戏自己保证唯一</td></tr> <tr><td>nonceStr</td> <td>随机字符串，长度应小于 128</td></tr> <tr><td>timeStamp</td> <td>生成这个随机字符串的 UNIX 时间戳（精确到秒）</td></tr></tbody></table>

签名算法为：

```
// hmac_sha256需要开发者自行引入
signature = hmac_sha256([appId, groupId, nonceStr, timeStamp].sort().join(''), sessionKey)
```

具体来说，这个算法分为几个步骤：

1. 对 `appId` `groupId` `nonceStr` `timeStamp` 四个值表示成字符串形式，按照字典序排序；
2. 将排好序的四个字符串拼接在一起；
3. 使用 `session_key` 作为 `key` ，使用 `hmac_sha256` 算法对 2 中的结果字符串做计算，所得结果即为 `signature`

示例：

```
appId = 'wx20afc706a711eefc'
groupId = '1559129713_672975982'
nonceStr = '8AP6DT9ybtniUJfb'
timeStamp = '1559129714'
session_key = 'gDyVgzwa0mFz9uUP7M6GQQ=='

str = [appId, groupId, nonceStr, timeStamp].sort().join('') = '1559129713_67297598215591297148AP6DT9ybtniUJfbwx20afc706a711eefc'
signature = hmac_sha256('1559129713_67297598215591297148AP6DT9ybtniUJfbwx20afc706a711eefc', sessionKey) = 'b002b824688dd8593a6079e11d8c5e8734fbcb39a6d5906eb347bfbcad79c617'
```

## 使用云开发完成签名

在云开发中，无法获取 `session_key` ，但提供了单独的函数 [cloud.getVoIPSign](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/reference-sdk-api/open/Cloud.getVoIPSign.html) 来计算签名。

```javascript
const cloud = require('wx-server-sdk')
cloud.init()

exports.main = async (event, context) => {
  const signature = cloud.getVoIPSign({
    groupId: 'xxx',
    timestamp: 123,
    nonce: 'yyy'
  })
  return signature
}
```

## 人数限制

每个房间最多同时加入 10 个人。

## 频率限制

对于每个小程序，每天最多允许创建 100000 个房间。当所有人退出房间时，房间即被销毁。此时如果传入之前用过的 groupId 重新加入房间，会被计算为新开一个房间。
