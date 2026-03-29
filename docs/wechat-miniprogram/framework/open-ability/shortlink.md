<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/shortlink.html -->

# 获取 Short Link

通过 [服务端接口 generateShortLink](https://developers.weixin.qq.com/miniprogram/dev/server/API/qrcode-link/short-link/api_generateshortlink.html) 可以获取打开小程序任意页面的 Short Link。适用于微信内拉起小程序的业务场景。通过 Short Link 打开小程序的场景值为 `1179` 。

生成的 ShortLink 如下所示：

```
#小程序://小程序示例/示例页面/9pZvnVw3KMCQpVp
```

## 调用上限

Link 将根据是否为到期有效与失效时间参数，分为 **短期有效 ShortLink** 与 **永久有效 ShortLink** ：

1. 单个小程序每日生成 ShortLink 上限为 `1000万个` （包含短期有效 ShortLink 与长期有效 ShortLink ）
2. 单个小程序总共可生成永久有效 ShortLink 上限为 `10万个` ，请谨慎调用。
3. 短期有效 ShortLink 有效时间为 `30天` ，单个小程序生成短期有效 ShortLink 不设上限。

## 开放范围

目前只开放给电商类目小程序，具体包含以下一级类目：电商平台、商家自营、跨境电商。
