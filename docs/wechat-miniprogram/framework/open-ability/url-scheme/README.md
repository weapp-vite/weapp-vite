<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/url-scheme -->

# 获取 URL Scheme

**每个小程序每天 URL Scheme 和 URL Link 总打开次数上限为600万** 。

## 明文 URL Scheme

### 获取方式

开发者无需调用平台接口，在「 [MP平台](https://mp.weixin.qq.com/) - 左下角账号 - 账号设置 - 基本设置 - 隐私与安全 - 明文Scheme拉起此小程序」声明后，可自行根据如下格式拼接appid和path等参数，作为明文 URL Scheme 链接。

```
weixin://dl/business/?appid=*APPID*&path=*PATH*&query=*QUERY*&env_version=*ENV_VERSION*
```

其中，各个参数的定义如下：

1. 【必填】APPID：通过明文 URL Scheme 打开小程序的 appid ；
2. 【必填】PATH：通过明文 URL Scheme 打开小程序的页面 path ，必须是已经发布的小程序存在的页面，不可携带 query；
3. 【选填】QUERY：通过明文 URL Scheme 打开小程序的 query ，最大512个字符，只支持数字，大小写英文以及部分特殊字符：!#$&'()\*+,/:;=?@-.\_~%\`，需要url\_encode；
4. 【选填】ENV\_VERSION：要打开的小程序版本,正式版为 `release` ，体验版为 `trial` ，开发版为 `develop` ，仅在微信外打开时生效。注意：若不填写，则默认打开正式版小程序。

通过明文 URL Scheme 打开小程序的场景值为 1286。

## 加密 URL Scheme

### 获取方式

通过 [服务端接口](https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/url-scheme/urlscheme.generate.html) 可以获取打开小程序任意页面的加密 URL Scheme。适用于从短信、邮件、微信外网页等场景打开小程序。 通过 URL Scheme 打开小程序的场景值为 1065。 生成的 URL Scheme 如下所示：

```
weixin://dl/business/?t= *TICKET*
```

iOS系统支持识别 URL Scheme，可在短信等应用场景中直接通过Scheme跳转小程序。 Android系统不支持直接识别 URL Scheme，用户无法通过 Scheme 正常打开小程序，开发者需要使用 H5 页面中转，再跳转到 Scheme 实现打开小程序，跳转代码示例如下：

```
location.href = 'weixin://dl/business/?t= *TICKET*'
```

该跳转方法可以在用户打开 H5 时立即调用，也可以在用户触发事件后调用。

### 拼接参数

将原有 URL Scheme 平滑升级为加密 URL Scheme，支持开发者自行在链接后面拼接参数 `CUSTOM PARAMETE` ,拼接参数后的 URL Scheme 如下所示：

```
weixin://dl/business/?t= *TICKET*&cq=*CUSTOM PARAMETER*
```

注意：

1. `CUSTOM PARAMETE` 是一种特殊的 `query` ，最大256个字符，只支持数字，大小写英文以及部分特殊字符：!#$&'()\*+,/:;=?@-.\_~%\`，需要url\_encode;
2. 在本次规则调整生效前已经生成的 URL Scheme 可继续正常使用，并可直接进行 `CUSTOM PARAMETE` 参数拼接；
3. 拼接参数后的加密 URL Scheme 打开小程序的场景值不变，仍为 1065。

## 频率限制

生成端：每天生成 加密URL Scheme 和 URL Link 的总数量上限为50万；

**打开端：每天通过 URL Scheme（加密+明文） 和 URL Link 打开小程序的总次数上限为600万。**

## 注意事项

1. 微信内的网页如需打开小程序请使用 [微信开放标签-小程序跳转按钮](https://developers.weixin.qq.com/doc/offiaccount/OA_Web_Apps/Wechat_Open_Tag.html#%E5%BC%80%E6%94%BE%E6%A0%87%E7%AD%BE%E8%AF%B4%E6%98%8E%E6%96%87%E6%A1%A3) ，无公众号也可以直接使用小程序身份开发网页并免鉴权跳转小程序，见 [云开发静态网站跳转小程序](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/staticstorage/jump-miniprogram.html) 。符合开放范围的小程序可以 [下发支持打开小程序的短信](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/staticstorage/msg-miniprogram.html)
2. 该功能基本覆盖当前用户正在使用的微信版本，开发者无需进行低版本兼容
3. 只能生成已发布的小程序的 URL Scheme
4. 通过 URL Scheme 跳转到微信时，可能会触发系统弹框询问，若用户选择不跳转，则无法打开小程序。请开发者妥善处理用户选择不跳转的场景
5. 部分浏览器会限制打开网页直接跳转，可参考示例网页设置跳转按钮
6. 平台有安全策略防止开发者的链接被黑灰产批量打开，导致的达到访问上限无法正常打开小程序的问题

## 开放范围

针对非个人主体小程序开放。

## 示例代码

示例使用了云开发静态网站托管搭建网页，无需公众号，只需准备好小程序和开通云开发。网页会判断所在的环境来决定采用哪种跳转方式，如检测到微信客户端内，则免鉴权使用开放标签跳转，如检测到在外部浏览器或 App，则使用 URL Scheme 跳转小程序。

示例网页地址：https://postpay-2g5hm2oxbbb721a4-1258211818.tcloudbaseapp.com/jump-mp.html

详细代码示例和说明： [云开发静态网站跳转小程序](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/staticstorage/jump-miniprogram.html) 。
