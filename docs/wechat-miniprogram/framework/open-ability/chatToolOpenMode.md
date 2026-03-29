<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/chatToolOpenMode.html -->

# 小程序聊天工具开放模式开发指南

## 一、功能介绍

聊天工具模式是为了帮助小程序更好与微信聊天结合而推出的模式，可用于实现群问卷、群拼单、群接龙等功能。其与小程序普通模式区别在于：

1. 开放更多与聊天紧密结合的能力：

<table><thead><tr><th>能力</th> <th>说明</th> <th>图示</th></tr></thead> <tbody><tr><td>聊天成员相关能力</td> <td>开发者可调用聊天成员选择器并获取成员相关id，通过open-data渲染聊天成员的头像昵称</td> <td><img width="" src="https://res8.wxqcloud.qq.com.cn/wxdoc/00e686eb-b6c5-4731-a707-f25c01003a1e.png"></td></tr> <tr><td>发送内容到聊天能力</td> <td>开发者可发送文本、提醒、图片、表情、视频等内容类型到聊天中</td> <td><img width="" src="https://res8.wxqcloud.qq.com.cn/wxdoc/3d68ee21-ee40-4a9d-bda9-2d846d089f0b.png"></td></tr> <tr><td>动态消息能力</td> <td>小程序卡片上的辅标题可以动态更新，在用户完成/参与了活动后下发系统消息</td> <td><img width="" src="https://res8.wxqcloud.qq.com.cn/wxdoc/3050c9e4-fd01-4cb8-b66e-fde9e4a15d4b.png"></td></tr></tbody></table>

支持有「交易保障」标识的小程序，或「社交」、「金融-证券/期货」、「金融-公募基金」、「金融-银行」类目的小程序申请相关接口权限。开发者需要登录小程序管理后台 ，在「管理-开发管理-其他接口-聊天工具」中申请获得接口权限，审核通过后可使用。

## 二、开发指南

> 从基础库 3.12.0 版本开始支持
>
> 支持平台：iOS 8.0.65 及以上版本；Android 8.0.65 及以上版本

### 1. 进入聊天工具模式

开发者调用 `wx. enterChatToolMode` 后，可选择在 chatToolRooms 传入 opengid 以进入聊天模式，并获得聊天成员相关接口的调用权限；如果未传入 opengid，则将拉起群聊选择器；

开发者可通过 `wx.isChatTool` 判断当前是否处于聊天工具模式；

聊天工具模式下应使用 group\_openid 作为用户唯一标识。

#### 1.1 wx.getGroupEnterInfo

功能描述： **进入聊天工具模式前，获取群聊 id 信息**

入参：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>allowSingleChat</td> <td>boolean</td> <td>为 true 时才会返回单聊下的 open_single_roomid</td></tr> <tr><td>needGroupOpenID</td> <td>boolean</td> <td>为 true 时才会返回 group_openid</td></tr></tbody></table>

返回参数（数据加密返回，解密请参考： [https://developers.weixin.qq.com/miniprogram/dev/api/open-api/group/wx.getGroupEnterInfo.html](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/group/wx.getGroupEnterInfo.html) ）：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>opengid</td> <td>string</td> <td>群聊唯一标识，绑定的聊天室为群聊时返回</td></tr> <tr><td>open_single_roomid</td> <td>string</td> <td>单聊唯一标识，绑定的聊天室为单聊时返回</td></tr> <tr><td>group_openid</td> <td>string</td> <td>当前微信用户在此聊天室下的唯一标识，同一个用户在不同的聊天室下id不同</td></tr> <tr><td>chat_type</td> <td>number</td> <td>微信聊天类型，1：微信联系人单聊；2：企业微信联系人单聊；3：普通微信群聊；4：企业微信互通群聊</td></tr></tbody></table>

#### 1.2 wx.getChatToolInfo

功能描述： **进入聊天工具模式后，获取群聊 id 信息**

返回参数（数据加密返回，解密请参考： [https://developers.weixin.qq.com/miniprogram/dev/api/open-api/group/wx.getGroupEnterInfo.html](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/group/wx.getGroupEnterInfo.html) ）：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>opengid</td> <td>string</td> <td>群聊唯一标识，绑定的聊天室为群聊时返回</td></tr> <tr><td>open_single_roomid</td> <td>string</td> <td>单聊唯一标识，绑定的聊天室为单聊时返回</td></tr> <tr><td>group_openid</td> <td>string</td> <td>当前微信用户在此聊天室下的唯一标识，同一个用户在不同的聊天室下id不同</td></tr> <tr><td>chat_type</td> <td>number</td> <td>微信聊天类型，1：微信联系人单聊；2：企业微信联系人单聊；3：普通微信群聊；4：企业微信互通群聊</td></tr></tbody></table>

#### 1.3 wx.selectGroupMembers

功能描述：选择聊天室的成员，并返回选择成员的 group-openid。若当前为群聊，则会拉起成员选择器；若当前为单聊，则直接返回对方用户的 group-openid

请求参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>maxSelectCount</td> <td>number</td> <td>否</td> <td>最多可选人数</td></tr></tbody></table>

返回参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>members</td> <td>string[]</td> <td>所选用户在此聊天室下的唯一标识，同一个用户在不同的聊天室下 id 不同</td></tr></tbody></table>

#### 1.4 `<open-data-list>` `<open-data-item>`

功能描述：用于渲染聊天成员的头像昵称

属性：

`<open-data-list>`

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>type</td> <td>string</td> <td>是</td> <td>渲染类型，固定为<code>groupMembers</code></td></tr> <tr><td>members</td> <td>string[]</td> <td>是</td> <td>需要展示的用户此聊天室下的唯一标识列表</td></tr></tbody></table>

`<open-data-item>`

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>type</td> <td>string</td> <td>是</td> <td>开放数据类型，userNickName：用户昵称；userAvatarUrl：用户头像</td></tr></tbody></table>

代码示例：

```html
<open-data-list type="groupMembers" members="[groupOpenID1, groupOpenID2]">
  <view class="userinfo" slot:index>
    <open-data-item class="avatar " type="userAvatar" index="{{index}}" />     <open-data-item class="" type="userNickName" index="{{index}}" />
  </view>
</open-data-list>
```

### 2. 发送到聊天能力

可支持小程序卡片、提醒消息、文本、图片、表情、文件的发送，如果选择了多个群聊，单次仅支持将内容发送到特定的单个群聊中。

#### 2.1 wx.shareAppMessageToGroup

功能描述：将小程序卡片发送到绑定的聊天室

请求参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th> <th>默认值</th></tr></thead> <tbody><tr><td>title</td> <td>string</td> <td>是</td> <td>小程序卡片标题</td> <td></td></tr> <tr><td>opengid</td> <td>string</td> <td>否</td> <td>通过 <code>wx.selectGroups</code> 选择聊天后，opengid 为必填；通过<code>wx.selectGroupMembers</code> 选择单个聊天后，opengid 无需填写</td> <td></td></tr> <tr><td>path</td> <td>string</td> <td>否</td> <td>转发路径</td> <td>聊天工具的 entryPagePath</td></tr> <tr><td>imageUrl</td> <td>string</td> <td>否</td> <td>自定义图片路径，可以是本地文件路径、代码包文件路径或者网络图片路径。支持 PNG 及 JPG。显示图片长宽比是 5:4</td> <td>使用默认截图</td></tr></tbody></table>

返回参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr></tbody></table>

#### 2.2 wx.notifyGroupMembers

功能描述：提醒用户完成任务，发送的内容将由微信拼接为：@的成员列表+“请完成：”/"请参与："+打开小程序的文字链，如「@alex @cindy 请完成：团建报名统计」

请求参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th> <th>默认值</th></tr></thead> <tbody><tr><td>title</td> <td>string</td> <td>是</td> <td>文字链标题</td> <td></td></tr> <tr><td>opengid</td> <td>string</td> <td>否</td> <td>通过 <code>wx.selectGroups</code> 选择聊天后，opengid 为必填；通过<code>wx.selectGroupMembers</code> 选择单个聊天后，opengid 无需填写</td> <td></td></tr> <tr><td>members</td> <td>string[]</td> <td>是</td> <td>需要提醒的用户 group-openid 列表</td> <td></td></tr> <tr><td>entrancePath</td> <td>string</td> <td>是</td> <td>文字链跳转路径</td> <td></td></tr> <tr><td>type</td> <td>string</td> <td>是</td> <td>展示的动词：participate：“请参与”；complete：“请完成”</td> <td></td></tr></tbody></table>

返回参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr></tbody></table>

#### 2.3 form 组件

`<form bind:submitToGroup="onSubmitToGroup"> <button form-type="submitToGroup">`

功能描述：将输入框内的文本内容发送到绑定的聊天室，可携带返回聊天工具模式的小程序的小尾巴

属性：

`<form>`

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>bind:submitToGroup</td> <td>string</td> <td>是</td> <td>用户触发发送文本到聊天后会触发的事件</td></tr></tbody></table>

`<button>`

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th> <th>默认值</th></tr></thead> <tbody><tr><td>form-type</td> <td>string</td> <td>是</td> <td>需填入 <code>submitToGroup</code>，表示将文本发送到聊天</td> <td></td></tr> <tr><td>opengid</td> <td>string</td> <td>否</td> <td>通过 <code>wx.selectGroups</code> 选择聊天后，opengid 为必填；通过<code>wx.selectGroupMembers</code> 选择单个聊天后，opengid 无需填写</td> <td></td></tr> <tr><td>need-show-entrance</td> <td>boolean</td> <td>否</td> <td>是否在文本消息下展示进入小程序的小尾巴</td> <td>true</td></tr> <tr><td>entrance-path</td> <td>string</td> <td>否</td> <td>小尾巴跳转路径</td> <td>聊天工具的 entryPagePath</td></tr></tbody></table>

#### 2.4 wx.shareImageToGroup

功能描述：将图片发送到绑定的聊天室，可携带返回聊天工具模式的小程序的小尾巴

请求参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th> <th>默认值</th></tr></thead> <tbody><tr><td>imagePath</td> <td>string</td> <td>是</td> <td>图片路径，可以是本地文件路径或临时路径</td> <td></td></tr> <tr><td>opengid</td> <td>string</td> <td>否</td> <td>通过 <code>wx.selectGroups</code> 选择聊天后，opengid 为必填；通过<code>wx.selectGroupMembers</code> 选择单个聊天后，opengid 无需填写</td> <td></td></tr> <tr><td>needShowEntrance</td> <td>string</td> <td>否</td> <td>是否在图片消息下展示进入小程序的小尾巴</td> <td>true</td></tr> <tr><td>entrancePath</td> <td>string</td> <td>否</td> <td>小尾巴跳转路径</td> <td>聊天工具的 entryPagePath</td></tr></tbody></table>

返回参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr></tbody></table>

#### 2.5 wx.shareEmojiToGroup

功能描述：将表情发送到绑定的聊天室，可携带返回聊天工具模式的小程序的小尾巴

请求参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th> <th>默认值</th></tr></thead> <tbody><tr><td>imagePath</td> <td>string</td> <td>是</td> <td>表情路径，可以是本地文件路径或临时路径</td> <td></td></tr> <tr><td>opengid</td> <td>string</td> <td>否</td> <td>通过 <code>wx.selectGroups</code> 选择聊天后，opengid 为必填；通过<code>wx.selectGroupMembers</code> 选择单个聊天后，opengid 无需填写</td> <td></td></tr> <tr><td>needShowEntrance</td> <td>string</td> <td>否</td> <td>是否在表情消息下展示进入小程序的小尾巴</td> <td>true</td></tr> <tr><td>entrancePath</td> <td>string</td> <td>否</td> <td>小尾巴跳转路径</td> <td>聊天工具的 entryPagePath</td></tr></tbody></table>

返回参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr></tbody></table>

#### 2.6 wx.shareVideoToGroup

功能描述：将视频发送到绑定的聊天室，可携带返回聊天工具模式的小程序的小尾巴

请求参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th> <th>默认值</th></tr></thead> <tbody><tr><td>videoPath</td> <td>string</td> <td>是</td> <td>视频路径，可以是本地文件路径或临时路径</td> <td></td></tr> <tr><td>opengid</td> <td>string</td> <td>否</td> <td>通过 <code>wx.selectGroups</code> 选择聊天后，opengid 为必填；通过 <code>wx.selectGroupMembers</code> 选择单个聊天后，opengid 无需填写</td> <td></td></tr> <tr><td>thumbPath</td> <td>string</td> <td>否</td> <td>缩略图路径，若留空则使用视频首帧</td> <td></td></tr> <tr><td>needShowEntrance</td> <td>string</td> <td>否</td> <td>是否在视频消息下展示进入小程序的小尾巴</td> <td>true</td></tr> <tr><td>entrancePath</td> <td>string</td> <td>否</td> <td>小尾巴跳转路径</td> <td>聊天工具的 entryPagePath</td></tr></tbody></table>

返回参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr></tbody></table>

#### 2.7 wx.shareFileToGroup

功能描述：将文件发送到绑定的聊天室，可携带返回聊天工具模式的小程序的小尾巴

请求参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th> <th>默认值</th></tr></thead> <tbody><tr><td>filePath</td> <td>string</td> <td>是</td> <td>文件路径，可以是本地文件路径或临时路径</td> <td></td></tr> <tr><td>opengid</td> <td>string</td> <td>否</td> <td>通过 <code>wx.selectGroups</code> 选择聊天后，opengid为必填；通过 <code>wx.selectGroupMembers</code> 选择单个聊天后，opengid 无需填写</td> <td></td></tr> <tr><td>needShowEntrance</td> <td>string</td> <td>否</td> <td>是否在文件消息下展示进入小程序的小尾巴</td> <td>true</td></tr> <tr><td>entrancePath</td> <td>string</td> <td>否</td> <td>小尾巴跳转路径</td> <td>聊天工具的 entryPagePath</td></tr></tbody></table>

返回参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>errMsg</td> <td>string</td> <td>错误信息</td></tr></tbody></table>

### 3. 动态消息能力

从聊天模式中发送的小程序卡片，可以获得动态消息能力，该能力的用户表现包括：

1. 小程序卡片上的辅标题可以动态更新

2. 可以在聊天中下发系统消息，内容为：成员A+“完成了”/"参与了"+成员B+“发布的”+打开小程序的文字链，如「alex 完成了 cindy 发布的 团建报名统计」

该功能的开发步骤包括：

1. 服务端通过 [创建activity\_id](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/mp-message-management/updatable-message/createActivityId.html) 接口创建 activity\_id

2. 前端通过 wx.updateShareMenu 声明要分享的卡片为动态消息，请求参数如下：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>withShareTicket</td> <td>boolean</td> <td>是</td> <td>是否使用带 shareTicket 的转发，固定为 <code>true</code></td></tr> <tr><td>isUpdatableMessage</td> <td>boolean</td> <td>是</td> <td>是否是动态消息，固定为 <code>true</code></td></tr> <tr><td>activityId</td> <td>string</td> <td>是</td> <td>动态消息的 activityId，通过步骤1中的接口获取</td></tr> <tr><td>useForChatTool</td> <td>boolean</td> <td>是</td> <td>聊天工具模式特殊动态消息</td></tr> <tr><td>chooseType</td> <td>number</td> <td>是</td> <td>指定成员的方式</td></tr> <tr><td>participant</td> <td>string[]</td> <td>是</td> <td>需参与用户此聊天室下的唯一标识列表</td></tr> <tr><td>templateInfo</td> <td>Object</td> <td>是</td> <td>动态消息的模板信息，固定为 <code>{templateId: '4A68CBB88A92B0A9311848DBA1E94A199B166463'}</code> 或 <code>{templateId: '2A84254B945674A2F88CE4970782C402795EB607'}</code></td></tr></tbody></table>

useForChatTool 为 true 时，chooseType 和 participant 才会生效

chooseType = 1，表示按指定的 participant 当作参与者

chooseType = 2，表示群内所有成员均为参与者（包括后加入群）

代码示例：

```ts
wx.updateShareMenu({
  withShareTicket: true,
  isUpdatableMessage: true,
  activityId: 'xxx',
  useForChatTool: true,
  chooseType: 1,
  participant: that.data.members,
  templateInfo: {
    templateId:  '4A68CBB88A92B0A9311848DBA1E94A199B166463'
  }
})
```

模版区别（target\_state 与 participator\_state 含义见步骤3）：

<table><thead><tr><th>templateId</th> <th>4A68CBB88A92B0A9311848DBA1E94A199B166463</th> <th>2A84254B945674A2F88CE4970782C402795EB607</th></tr></thead> <tbody><tr><td>动态消息发布者在小程序卡片中看到的辅标题</td> <td>target_state=1或2：X人已完成<br><br>target_state=3：已结束</td> <td>target_state=1或2：X人已参与<br><br>target_state=3：已结束</td></tr> <tr><td>参与者在小程序卡片中看到的辅标题</td> <td>participator_state=0时：<br><br>●&nbsp;target_state=1：未完成<br><br>●&nbsp;target_state=2：即将截止<br><br>●&nbsp;target_state=3：已结束<br><br>participator_state=1时：<br><br>●&nbsp;target_state=1或2：已完成<br><br>●&nbsp;target_state=3：已结束</td> <td>participator_state=0时：<br><br>●&nbsp;target_state=1：未参与<br><br>●&nbsp;target_state=2：即将截止<br><br>●&nbsp;target_state=3：已结束<br><br>participator_state=1时：<br><br>●&nbsp;target_state=1或2：已参与<br><br>●&nbsp;target_state=3：已结束</td></tr> <tr><td>非参与者在小程序卡片中看到的辅标题</td> <td>target_state=1或2：你无需完成<br><br>target_state=3：已结束</td> <td>target_state=1或2：你无需参与<br><br>target_state=3：已结束</td></tr> <tr><td>参与者变为完成态下发的系统消息文案</td> <td>aaa 已完成 bbb 发布的 XXX</td> <td>aaa 已参与 bbb 发布的 XXX</td></tr></tbody></table>

1. 服务端通过 setChatToolMsg 接口更新活动状态或用户完成情况，调用方式：

```
POST https://api.weixin.qq.com/cgi-bin/message/wxopen/chattoolmsg/send?access_token=ACCESS_TOKEN
```

也可通过云开发调用，接口名 chattoolmsg.send

请求参数：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>access_token</td> <td>string</td> <td>是</td> <td>接口调用凭证</td></tr> <tr><td>activity_id</td> <td>string</td> <td>是</td> <td>动态消息的 activityId，通过步骤1中的接口获取</td></tr> <tr><td>target_state</td> <td>number</td> <td>是</td> <td>活动状态，初始值为1（表示开始收集态），此处可设置为2（即将截止态）、3（已结束态）</td></tr> <tr><td>participator_info_list</td> <td>array<object></object></td> <td>否</td> <td>更新后的聊天室成员状态，当target_state=1时必填，target_state=2或3时无需填写</td></tr> <tr><td>version_type</td> <td>number</td> <td>是</td> <td>系统消息文字链打开的小程序版本，0 正式版，1 开发版，2 体验版</td></tr></tbody></table>

participator\_info\_list参数如下：

<table><thead><tr><th>属性</th> <th>类型</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>group_openid</td> <td>string</td> <td>是</td> <td>聊天室成员在此聊天室下的唯一标识</td></tr> <tr><td>state</td> <td>number</td> <td>是</td> <td>用户对卡片事件的完成状态。所有参与者的初始值为0（未完成态），此处仅支持设置为1，表示完成态。</td></tr></tbody></table>

调用示例：

```json
//变更单个成员状态
{
  "activity_id": "xxx",
  "target_state":1,
  "version_type": 0,
  "participator_info_list": [
    {
      "group_openid": "aaa",
      "state": 1
    },
    {
      "group_openid": "bbb",
      "state": 1
    }
  ]
}

//变更动态消息状态
{
  "activity_id": "xxx",
  "target_state":3,
  "version_type": 0,
}
```

### 4. 聊天工具模式内禁用的能力

以下能力暂不支持聊天工具模式下使用，请开发者做好适配

<table><thead><tr><th>能力项</th> <th>禁用说明</th></tr></thead> <tbody><tr><td><code>&lt;button open-type=share&gt;</code></td> <td>聊天工具模式禁用普通转发能力，请使用上文「发送到聊天能力开放」中的接口实现</td></tr> <tr><td>小程序右上角「…-发送给朋友」</td> <td></td></tr> <tr><td>navigateToMiniProgram</td> <td>聊天工具模式希望服务尽可能闭环在小程序中，外跳类接口暂不支持使用</td></tr> <tr><td>openEmbeddedMiniProgram</td> <td></td></tr> <tr><td>openOfficialAccountArticle</td> <td></td></tr> <tr><td>openChannelsUserProfile</td> <td></td></tr> <tr><td>openChannelsLive</td> <td></td></tr> <tr><td>openChannelsEvent</td> <td></td></tr> <tr><td>openChannelsActivity</td> <td></td></tr> <tr><td>ad</td> <td>聊天工具模式暂不支持广告</td></tr> <tr><td>ad-custom</td> <td></td></tr></tbody></table>
