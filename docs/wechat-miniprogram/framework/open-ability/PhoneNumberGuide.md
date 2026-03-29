<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/PhoneNumberGuide.html -->

# 手机号计费误差问题排查指南

在使用手机号快速验证组件 / 手机号实时验证组件的过程中，如果遇到官方计费次数和小程序上报次数存在误差的问题，可以参考本文进行排查。

### 1. 检查小程序上报统计口径

推荐使用小程序官方提供的 We 分析上报 。若使用其他上报方式，请确认统计时间范围内的上报网络请求正常，以及上报失败时是否有正确的重试逻辑。 此外，请注意从获取到手机号到发起上报期间，小程序中是否可能会出现其他异常导致上报中断，造成统计误差。 使用 We 分析上报对小程序手机号的具体方法如下：

- 进入 [we 分析平台](https://wedata.weixin.qq.com/mp2/login) 。
- 在【数据管理-上报管理】下，按照自身业务需求，创建对应埋点上报的事件。
- 小程序逻辑中，对小程序手机号授权回调事件进行对应的埋点上报。
- 小程序发版后，前往【数据分析-行为分析-事件分析】新建对应的事件分析。
- 打开数据看板查看曲线。

详细操作可见于 [事件分析文档](https://developers.weixin.qq.com/miniprogram/analysis/wedata/DataAnalysis.html) 。 如上报统计口径确认无误，可进入第 2 步。

### 2. 检查小程序手机号button逻辑

检查手机号授权button逻辑中，触发 bindgetphonenumber 回调后，是否立即隐藏了手机号按钮组件，或置为 disabled 状态；如果没有，则用户可能会继续点击button，造成额外的手机号授权和计费。 如果确认无误，可进入第 3 步。

### 3. 检查小程序跳转逻辑

检查小程序代码逻辑，在小程序手机号授权期间是否调用了 [wx.reLaunch](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.reLaunch.html) ， [wx.navigateTo](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateTo.html) ， [wx.redirectTo](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.redirectTo.html) ， [wx.navigateBack](https://developers.weixin.qq.com/miniprogram/dev/api/route/wx.navigateBack.html) 等跳转类接口。在手机号授权弹窗时如果调用了此类接口，可能会导致无法正确收到 bindgetphonenumber 回调。 如果确认无误，可进入第 4 步。

### 4. 仍未解决

如果仍无法确定原因，可以在 [微信开放社区「小程序」板块](https://developers.weixin.qq.com/community/develop/question) 发帖联系我们。 请按以下格式提供昨日完整一天的手机号授权上报数据：

```
timestamp,openid
1702036265,o7esq5LyxOBDdEwP4hY4oVgwSjTE
1702036277,oACo74-LaazkCVfp8c9cihawu91E
...
```

其中timestamp为秒级Unix时间戳，我们将对提供的数据进行比对分析。
