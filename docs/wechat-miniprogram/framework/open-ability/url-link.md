<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/url-link.html -->

# 获取加密 URL Link

**每个小程序每天 URL Scheme 和 URL Link 总打开次数上限为600万** 。

## 获取方式

通过 [服务端接口](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/qrcode-link/url-link/generateUrlLink.html) 可以获取打开小程序任意页面的 URL Link。适用于从短信、邮件、网页、微信内等场景打开小程序。 通过 URL Link 从微信外打开小程序的场景值为 1194。当用户在微信内访问 URL Link ，会调整为开放标签打开小程序，场景值为1167。 生成的 URL Link 如下所示：

```
https://wxaurl.cn/*TICKET* 或 https://wxmpurl.cn/*TICKET*
```

### 拼接参数

将原有 URL Link 平滑升级为加密 URL Link，支持开发者自行在链接后面拼接参数 `CUSTOM PARAMETE` ,拼接参数后的 URL Link 如下所示：

```
https://wxaurl.cn/*TICKET*?cq=*CUSTOM PARAMETER* 或 https://wxmpurl.cn/*TICKET*?cq=*CUSTOM PARAMETER*
```

注意：

1. `CUSTOM PARAMETE` 是一种特殊的 `query` ，最大256个字符，只支持数字，大小写英文以及部分特殊字符：!#$&'()\*+,/:;=?@-.\_~%\`，需要url\_encode;
2. 在本次规则调整生效前已经生成的 URL Scheme 可继续正常使用，并可直接进行 `CUSTOM PARAMETE` 参数拼接；
3. 拼接参数后的加密 URL Link 打开小程序的场景值不变，微信外仍为1194，微信内仍会调整为开放标签打开小程序，场景值为1167。

## 频率限制

生成端：每天生成 URL Scheme（加密+明文） 和 URL Link 的总数量上限为50万；

**打开端：每天通过 URL Scheme（加密+明文） 和 URL Link 打开小程序的总次数上限为600万。**

## 注意事项

1. 只能生成已发布的小程序的 URL Link。
2. 在微信内或者安卓手机打开 URL Link 时，默认会先跳转官方 H5 中间页，如果需要定制 H5 内容，可以使用云开发静态网站。

## 开放范围

针对非个人主体小程序开放。
