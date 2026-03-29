<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/customer-message/receive.html -->

# 接收消息和事件

在页面中使用 [`<button open-type="contact" />`](https://developers.weixin.qq.com/miniprogram/dev/component/button.html) 可以显示进入客服会话按钮。

当用户在客服会话发送消息、或由某些特定的用户操作引发事件推送时，微信服务器会将消息或事件的数据包发送到开发者填写的 URL / 云开发云函数 / [云托管服务](https://developers.weixin.qq.com/miniprogram/dev/wxcloudrun/src/guide/weixin/push.html) （详情请参考 [消息推送](../../server-ability/message-push.md) ）。开发者收到请求后可以使用 [发送客服消息](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/customer-message/(kf-message/sendCustomMessage)) 接口进行异步回复。

各消息类型的推送JSON、XML数据包结构如下。

## 文本消息

用户在客服会话中发送文本消息时将产生如下数据包：

### XML 格式

```xml
<xml>
   <ToUserName><![CDATA[toUser]]></ToUserName>
   <FromUserName><![CDATA[fromUser]]></FromUserName>
   <CreateTime>1482048670</CreateTime>
   <MsgType><![CDATA[text]]></MsgType>
   <Content><![CDATA[this is a test]]></Content>
   <MsgId>1234567890123456</MsgId>
</xml>
```

### JSON 格式

```json
{
  "ToUserName": "toUser",
  "FromUserName": "fromUser",
  "CreateTime": 1482048670,
  "MsgType": "text",
  "Content": "this is a test",
  "MsgId": 1234567890123456
}
```

### 参数说明

<table><thead><tr><th style="text-align:left">参数</th> <th>说明</th></tr></thead> <tbody><tr><td style="text-align:left">ToUserName</td> <td>小程序的原始ID</td></tr> <tr><td style="text-align:left">FromUserName</td> <td>发送者的openid</td></tr> <tr><td style="text-align:left">CreateTime</td> <td>消息创建时间(整型）</td></tr> <tr><td style="text-align:left">MsgType</td> <td>text</td></tr> <tr><td style="text-align:left">Content</td> <td>文本消息内容</td></tr> <tr><td style="text-align:left">MsgId</td> <td>消息id，64位整型</td></tr></tbody></table>

## 图片消息

用户在客服会话中发送图片消息时将产生如下数据包：

### XML 格式

```xml
<xml>
      <ToUserName><![CDATA[toUser]]></ToUserName>
      <FromUserName><![CDATA[fromUser]]></FromUserName>
      <CreateTime>1482048670</CreateTime>
      <MsgType><![CDATA[image]]></MsgType>
      <PicUrl><![CDATA[this is a url]]></PicUrl>
      <MediaId><![CDATA[media_id]]></MediaId>
      <MsgId>1234567890123456</MsgId>
</xml>
```

### JSON 格式

```json
{
  "ToUserName": "toUser",
  "FromUserName": "fromUser",
  "CreateTime": 1482048670,
  "MsgType": "image",
  "PicUrl": "this is a url",
  "MediaId": "media_id",
  "MsgId": 1234567890123456
}
```

### 参数说明

<table><thead><tr><th style="text-align:left">参数</th> <th>说明</th></tr></thead> <tbody><tr><td style="text-align:left">ToUserName</td> <td>小程序的原始ID</td></tr> <tr><td style="text-align:left">FromUserName</td> <td>发送者的openid</td></tr> <tr><td style="text-align:left">CreateTime</td> <td>消息创建时间(整型）</td></tr> <tr><td style="text-align:left">MsgType</td> <td>image</td></tr> <tr><td style="text-align:left">PicUrl</td> <td>图片链接（由系统生成）</td></tr> <tr><td style="text-align:left">MediaId</td> <td>图片消息媒体id，可以调用[获取临时素材]((getTempMedia)接口拉取数据。</td></tr> <tr><td style="text-align:left">MsgId</td> <td>消息id，64位整型</td></tr></tbody></table>

## 小程序卡片消息

用户在客服会话中发送小程序卡片消息时将产生如下数据包：

### XML 格式

```xml
<xml>
  <ToUserName><![CDATA[toUser]]></ToUserName>
  <FromUserName><![CDATA[fromUser]]></FromUserName>
  <CreateTime>1482048670</CreateTime>
  <MsgType><![CDATA[miniprogrampage]]></MsgType>
  <MsgId>1234567890123456</MsgId>
  <Title><![CDATA[Title]]></Title>
  <AppId><![CDATA[AppId]]></AppId>
  <PagePath><![CDATA[PagePath]]></PagePath>
  <ThumbUrl><![CDATA[ThumbUrl]]></ThumbUrl>
  <ThumbMediaId><![CDATA[ThumbMediaId]]></ThumbMediaId>
</xml>
```

### JSON 格式

```json
{
  "ToUserName": "toUser",
  "FromUserName": "fromUser",
  "CreateTime": 1482048670,
  "MsgType": "miniprogrampage",
  "MsgId": 1234567890123456,
  "Title":"title",
  "AppId":"appid",
  "PagePath":"path",
  "ThumbUrl":"",
  "ThumbMediaId":""
}
```

### 参数说明

<table><thead><tr><th>参数</th> <th>说明</th></tr></thead> <tbody><tr><td>ToUserName</td> <td>小程序的原始ID</td></tr> <tr><td>FromUserName</td> <td>发送者的openid</td></tr> <tr><td>CreateTime</td> <td>消息创建时间(整型）</td></tr> <tr><td>MsgType</td> <td>miniprogrampage</td></tr> <tr><td>MsgId</td> <td>消息id，64位整型</td></tr> <tr><td>Title</td> <td>标题</td></tr> <tr><td>AppId</td> <td>小程序appid</td></tr> <tr><td>PagePath</td> <td>小程序页面路径</td></tr> <tr><td>ThumbUrl</td> <td>封面图片的临时cdn链接</td></tr> <tr><td>ThumbMediaId</td> <td>封面图片的临时素材id</td></tr></tbody></table>

## 进入会话事件

用户在小程序“客服会话按钮”进入客服会话时将产生如下数据包：

### XML 格式

```xml
<xml>
    <ToUserName><![CDATA[toUser]]></ToUserName>
    <FromUserName><![CDATA[fromUser]]></FromUserName>
    <CreateTime>1482048670</CreateTime>
    <MsgType><![CDATA[event]]></MsgType>
    <Event><![CDATA[user_enter_tempsession]]></Event>
    <SessionFrom><![CDATA[sessionFrom]]></SessionFrom>
</xml>
```

### JSON 格式

```json
{
  "ToUserName": "toUser",
  "FromUserName": "fromUser",
  "CreateTime": 1482048670,
  "MsgType": "event",
  "Event": "user_enter_tempsession",
  "SessionFrom": "sessionFrom"
}
```

### 参数说明

<table><thead><tr><th style="text-align:left">参数</th> <th>说明</th></tr></thead> <tbody><tr><td style="text-align:left">ToUserName</td> <td>小程序的原始ID</td></tr> <tr><td style="text-align:left">FromUserName</td> <td>发送者的openid</td></tr> <tr><td style="text-align:left">CreateTime</td> <td>事件创建时间(整型）</td></tr> <tr><td style="text-align:left">MsgType</td> <td>event</td></tr> <tr><td style="text-align:left">Event</td> <td>事件类型，user_enter_tempsession</td></tr> <tr><td style="text-align:left">SessionFrom</td> <td>开发者在<a href="./../../../component/button.html">客服会话按钮</a>设置的 session-from 属性</td></tr></tbody></table>
