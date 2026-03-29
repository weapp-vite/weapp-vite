<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/HTTPDNS.html -->

# 移动解析HttpDNS

从基础库 [2.19.2](../compatibility.md) 开始支持

开发者调用 [wx.request](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html) 时，可以开启移动解析HttpDNS服务。 该服务基于Http协议向服务商的DNS服务器发送域名解析请求，替代了基于DNS协议向运营商Local DNS发起解析请求的传统方式，可以避免Local DNS造成的域名劫持和跨网访问问题，解决移动互联网服务中域名解析异常带来的困扰。

## 小程序开发者使用移动解析说明

1. 前往 [微信服务市场](https://fuwu.weixin.qq.com/service/detail/00022476b70ac08df25cfcefc57015) 选购 HttpDNS 资源，并在服务详情页-接入文档获取Service ID。
2. 小程序调用 [wx.request](https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html) ，将enableHttpDNS参数设置为true，并在httpDNSServiceId参数中填入选用的服务商Service ID。

### 代码示例

```js
wx.request({
  url: 'example.php', //仅为示例，并非真实的接口地址
  enableHttpDNS: true,
  httpDNSServiceId: 'wxa410372c837a5f26',
  success(res) {
    console.log('request success', res)
  },
  fail(res) {
    console.error('request fail', res)
  }
})
```

### 计费说明

1. 使用服务所产生的费用会按照实际调用服务商接口情况进行计费，定价策略由服务提供方制定，开发者需自行前往微信服务市场进行购买、续费等操作。
2. 微信侧每次代开发者调用服务商接口时，微信侧会进行缓存，缓存策略由服务商返回的ttl决定，因此不一定每次调用request接口都会产生费用。
3. 从基础库 v2.32.1 开始，若开发者的服务可用额度为0，仍在wx.request接口中声明使用服务商提供的移动解析能力时，会使用 localDNS 解析来兜底，并在 success 回调参数 exception.reasons ( reasons 是数组) 中返回 httpdns 欠费的错误信息和错误码，类似 `[{ "errMsg": "getDNSInfo:fail no enough httpdns quota", "errno": 602103 }]` 。

### 注意事项

1. HttpDNS 不兼容网络代理

在基础库 v2.22.1 版本之前，当用户设备使用了网络代理，同时又开启了 enableHttpDNS 时，request 接口会调用失败，fail 回调 errMsg 中会包含 `ERR_PROXY_CONNECTION_FAILED` 字样，如 `{"errno":600001,"errMsg":"request:fail -130:net::ERR_PROXY_CONNECTION_FAILED"}` 或 `{"errno":600001,"errMsg":"request:fail errcode:-130 cronet_error_code:-130 error_msg:net::ERR_PROXY_CONNECTION_FAILED"}` 。

为解决此问题，从基础库 v2.22.1 开始，若用户使用了网络代理，基础库会主动强制关闭 enableHttpDNS。开发者也可以通过 wx.getNetworkType 接口检查用户是否开启了网络代理。用法：

```js
wx.getNetworkType({
  success(res) {
    console.log(res.hasSystemProxy) // 开启网络代理时为 true，否则为 false
  }
})
```

### HttpDNS 相关错误码

<table><thead><tr><th style="text-align:left">错误码</th> <th style="text-align:left">说明</th></tr></thead> <tbody><tr><td style="text-align:left">600000</td> <td style="text-align:left">网络错误</td></tr> <tr><td style="text-align:left">602000</td> <td style="text-align:left">网络请求错误</td></tr> <tr><td style="text-align:left">602001</td> <td style="text-align:left">系统错误</td></tr> <tr><td style="text-align:left">602002</td> <td style="text-align:left">http请求httpdns服务商错误</td></tr> <tr><td style="text-align:left">602101</td> <td style="text-align:left">小程序未在服务市场购买httpdns服务</td></tr> <tr><td style="text-align:left">602102</td> <td style="text-align:left">小程序在httpdns服务市场资源包过期</td></tr> <tr><td style="text-align:left">602103</td> <td style="text-align:left">小程序在httpdns服务市场额度不足</td></tr> <tr><td style="text-align:left">602104</td> <td style="text-align:left">httpdns服务商返回结果为空</td></tr> <tr><td style="text-align:left">602105</td> <td style="text-align:left">调用httpdns服务商结果超时</td></tr> <tr><td style="text-align:left">602106</td> <td style="text-align:left">httpdns服务商返回数据不合法</td></tr> <tr><td style="text-align:left">602107</td> <td style="text-align:left">httpdns域名解析结果为空</td></tr> <tr><td style="text-align:left">602108</td> <td style="text-align:left">不支持的httpdns服务商id</td></tr></tbody></table>

## 移动解析服务提供商接入说明

为了保护微信客户端的安全，小程序使用的移动解析服务需要通过微信侧安全认证，认证后可在微信服务市场上架。

微信侧欢迎更多服务商为小程序提供移动解析服务。申请接入按照以下模板发送邮件，我们会有专人与您联系。

```md
收件人：servicemarket@tencent.com
主题：【上架服务市场】XXX（服务商）申请上架HttpDNS服务
正文：需要写明服务商的基本资料，包括不仅限于服务商名称、业务范围、技术证书、合作意向、联系方式等
```
