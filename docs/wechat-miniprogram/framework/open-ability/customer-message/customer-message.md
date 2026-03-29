<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/customer-message/customer-message.html -->

# 客服消息

## 在页面使用客服消息

需要将 [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html) 组件 `open-type` 的值设置为 `contact` ，当用户点击后就会进入客服会话，如果用户在会话中点击了小程序消息，则会返回到小程序，开发者可以通过 `bindcontact` 事件回调获取到用户所点消息的页面路径 `path` 和对应的参数 `query` 。

## 示例代码

```html
<button open-type="contact" bindcontact="handleContact"></button>
```

```javascript
Page({
    handleContact (e) {
        console.log(e.detail.path)
        console.log(e.detail.query)
    }
})
```

## 返回参数说明

<table><thead><tr><th>参数</th> <th>类型</th> <th>说明</th></tr></thead> <tbody><tr><td>path</td> <td>String</td> <td>小程序消息指定的路径</td></tr> <tr><td>query</td> <td>Object</td> <td>小程序消息指定的查询参数</td></tr></tbody></table>

## 后台接入消息服务

用户向小程序客服发送消息、或者进入会话等情况时，开发者填写的服务器配置 URL / 云开发云函数 / [云托管服务](https://developers.weixin.qq.com/miniprogram/dev/wxcloudrun/src/guide/weixin/push.html) 将得到微信服务器推送过来的消息和事件，开发者可以依据自身业务逻辑进行响应。接入和使用方式请参考 [消息推送](../../server-ability/message-push.md) 。
