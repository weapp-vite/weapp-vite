<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share/updatable-message.html -->

# 动态消息

从基础库 [2.4.0](../../compatibility.md) 开始，支持转发动态消息。动态消息对比普通消息，有以下特点：

1. 消息发出去之后，开发者可以通过后台接口修改 **部分** 消息内容。
2. 消息有对应的提醒按钮，用户点击提醒按钮可以订阅提醒，开发者可以通过后台修改消息状态并推送一次提醒消息给订阅了提醒的用户

## 消息属性

动态消息有状态、文字内容、文字颜色、系统消息提醒。

### 模板

动态消息目前有两个模板，应用于组队场景，分别以‘开始时’和‘到齐时’为状态变更和提醒节点。

<table><thead><tr><th>变更和提醒节点</th> <th>模板ID</th></tr></thead> <tbody><tr><td>开始时</td> <td>21B034D08C5615B9889CE362BB957B1EE69A584B</td></tr> <tr><td>到齐时</td> <td>666F374D69D16C932E45D7E7D9F10CEF6177F5F5</td></tr></tbody></table>

### 状态

每个模板有三个状态，分别有其对应的文字内容和颜色。其中状态 0 可以转移到状态 0 和 1 和 2，状态 1 可以转移到状态 2，状态 2 不可以转移。

‘开始时’

<table><thead><tr><th>状态</th> <th>文字内容</th> <th>颜色</th> <th>允许转移的状态</th></tr></thead> <tbody><tr><td>0</td> <td>"成员正在加入，当前 {member_count}/{room_limit} 人"</td> <td>#10AEFF</td> <td>0, 1, 2</td></tr> <tr><td>1</td> <td>"已开始"</td> <td>#07C160</td> <td>2</td></tr> <tr><td>2</td> <td>"已结束"</td> <td>#CCCCCC</td> <td>无</td></tr></tbody></table>

‘成员到齐时’

<table><thead><tr><th>状态</th> <th>文字内容</th> <th>颜色</th> <th>允许转移的状态</th></tr></thead> <tbody><tr><td>0</td> <td>"成员正在加入，当前 {member_count}/{room_limit} 人"</td> <td>#10AEFF</td> <td>0, 1, 2</td></tr> <tr><td>1</td> <td>"已到齐"</td> <td>#07C160</td> <td>2</td></tr> <tr><td>2</td> <td>"已结束"</td> <td>#CCCCCC</td> <td>无</td></tr></tbody></table>

保持状态 0 无数据传入或状态 1 24h后自动进入状态 2。

### 状态参数

每个状态转移的时候可以携带参数，具体参数说明如下。

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>member_count</td> <td>string</td> <td>状态 0 时有效，文字内容模板中 <code>member_count</code> 的值</td></tr> <tr><td>room_limit</td> <td>string</td> <td>状态 0 时有效，文字内容模板中 <code>room_limit</code> 的值</td></tr> <tr><td>path</td> <td>string</td> <td>状态 1 时有效，点击「进入」启动小程序时使用的路径。对于小游戏，没有页面的概念，可以用于传递查询字符串（query），如 <code>"?foo=bar"</code></td></tr> <tr><td>version_type</td> <td>string</td> <td>状态 1 时有效，点击「进入」启动小程序时使用的版本。有效参数值为：<code>develop</code>（开发版），<code>trial</code>（体验版），<code>release</code>（正式版）</td></tr></tbody></table>

### 系统消息

用户点击含动态消息的卡片退出小程序后会下发系统消息，状态转移的时候会变更系统消息内容或下发新的系统消息，具体的消息内容如下。

<table><thead><tr><th>模板</th> <th>内容</th></tr></thead> <tbody><tr><td>开始时</td> <td>1.开始时，请提醒我 2.开始时，将收到提醒 3.已开始，进入“小程序”</td></tr> <tr><td>到齐时</td> <td>1.成员到齐时，请提醒我 2.成员到齐时，将收到提醒 3.成员已到齐，进入“小程序”</td></tr></tbody></table>

## 使用方法

### 一、创建 activity\_id

每条动态消息可以理解为一个活动，活动发起前需要通过 [createActivityId](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share/(createActivityId)) 接口创建 `activity_id` 。后续转发动态消息以及更新动态消息都需要传入这个 `activity_id` 。

### 二、在转发之前声明消息类型为动态消息

通过调用 [wx.updateShareMenu](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.updateShareMenu.html) 接口，传入 `isUpdatableMessage: true` ，以及 `templateInfo` 、 `activityId` 参数。其中 `activityId` 从步骤一中获得。

```javascript
wx.updateShareMenu({
  withShareTicket: true,
  isUpdatableMessage: true,
  activityId: '', // 活动 ID
  templateInfo: {
    parameterList: [{
      name: 'member_count',
      value: '1'
    }, {
      name: 'room_limit',
      value: '3'
    }]
    templateId: '21B034D08C5615B9889CE362BB957B1EE69A584B'
  }
})
```

### 三、修改动态消息内容

动态消息发出去之后，可以通过 [setUpdatableMsg](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share/(setUpdatableMsg)) 修改消息内容。

## 低版本兼容

对于不支持动态消息的客户端版本，收到动态消息后会展示成普通消息
