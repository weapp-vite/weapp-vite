<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/sms.html -->

# 短信打开小程序

开发者可通过以下3种方式实现短信打开小程序：

## 通过URL Scheme实现

通过服务端接口或在小程序管理后台生成 [URL Scheme](./url-scheme/README.md) 后，自行开发中转H5页面。

将带有中转H5链接的短信内容通过开发者自有的短信发送能力或服务商的短信服务进行投放，实现短信打开小程序。

## 通过URL Link实现

通过服务端接口生成 [URL Link](./url-link/README.md) 。

直接将带有URL Link的短信内容通过开发者自有的短信发送能力或服务商的短信服务进行投放，实现短信打开小程序。

## 通过云开发静态网站实现

可以参考「云开发」-「静态网站」-「 [短信跳小程序](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/staticstorage/msg-miniprogram.html) 」。
