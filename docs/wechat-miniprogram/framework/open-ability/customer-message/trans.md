<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/customer-message/trans.html -->

# 转发客服消息

如果小程序设置了消息推送，普通微信用户向小程序客服发消息时，微信服务器会先将消息 POST 到开发者填写的 URL 上，如果希望将消息转发到网页版客服工具，则需要开发者在响应包中返回 MsgType 为 transfer\_customer\_service 的消息，微信服务器收到响应后会把当次发送的消息转发至客服系统。

用户被客服接入以后，客服关闭会话以前，处于会话过程中时，用户发送的消息均会被直接转发至客服系统。当会话超过 30 分钟客服没有关闭时，微信服务器会自动停止转发至客服，而将消息恢复发送至开发者填写的 URL 上。

用户在等待队列中时，用户发送的消息仍然会被推送至开发者填写的 URL 上。

这里特别要注意，只针对微信用户发来的消息才进行转发，而对于其他事件（比如用户从小程序唤起客服会话）都不应该转发，否则客服在客服系统上就会看到一些无意义的消息了。

### 消息转发到网页版客服工具

开发者只要在响应包中返回 MsgType 为 transfer\_customer\_service 的消息，微信服务器收到响应后就会把当次发送的消息转发至客服系统。

如果是使用自有服务器接收的消息推送，则需返回如下格式的 XML 数据：

```xml
<xml>
    <ToUserName><![CDATA[touser]]></ToUserName>
    <FromUserName><![CDATA[fromuser]]></FromUserName>
    <CreateTime>1399197672</CreateTime>
    <MsgType><![CDATA[transfer_customer_service]]></MsgType>
</xml>
```

参数说明

<table><thead><tr><th>参数</th> <th>是否必须</th> <th>描述</th></tr></thead> <tbody><tr><td>ToUserName</td> <td>是</td> <td>接收方账号（收到的OpenID）</td></tr> <tr><td>FromUserName</td> <td>是</td> <td>小程序原始id</td></tr> <tr><td>CreateTime</td> <td>是</td> <td>消息创建时间 （整型）</td></tr> <tr><td>MsgType</td> <td>是</td> <td>transfer_customer_service</td></tr></tbody></table>

如果是使用 [云函数接收的消息推送](../../server-ability/message-push.md#option-cloud) ，则需在云函数被客服消息触发后返回同样格式的 `JSON` 数据：

```js
// ...
exports.main = async (event, context) => {
  // 判断处理客服消息 ...
  // 最后返回 JSON
  return {
    MsgType: 'transfer_customer_service',
    ToUserName: 'touser',
    FromUserName: 'fromuser',
    CreateTime: parseInt(+new Date / 1000),
  }
}
```
