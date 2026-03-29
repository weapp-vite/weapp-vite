<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/search/seo.html -->

# 小程序搜索优化指南

爬虫访问小程序内页面时，会携带特定的 user-agent "mpcrawler" 及场景值：1129

判断请求是否来源于官方搜索爬虫的方法：

签名算法与小程序消息推送接口的签名算法一致。 [详情](../server-ability/message-push.md#%E7%AC%AC%E4%BA%8C%E6%AD%A5%EF%BC%9A%E9%AA%8C%E8%AF%81%E6%B6%88%E6%81%AF%E7%9A%84%E7%A1%AE%E6%9D%A5%E8%87%AA%E5%BE%AE%E4%BF%A1%E6%9C%8D%E5%8A%A1%E5%99%A8)

参数在请求的header里设置，分别是： X-WXApp-Crawler-Timestamp X-WXApp-Crawler-Nonce X-WXApp-Crawler-Signature

签名流程如下： 1.将token、X-WXApp-Crawler-Timestamp、X-WXApp-Crawler-Nonce三个参数进行字典序排序 2.将三个参数字符串拼接成一个字符串进行sha1加密 3.开发者获得加密后的字符串可与X-WXApp-Crawler-Signature对比，标识该请求来源于微信

## 1. 小程序里跳转的页面 (url) 可被直接打开。

小程序页面内的跳转url是我们爬虫发现页面的重要来源，且搜索引擎召回的结果页面 (url) 是必须能直接打开，不依赖上下文状态的。 特别的：建议页面所需的参数都包含在url

## 2. 页面跳转优先采用navigator组件。

小程序提供了两种页面路由方式： a. navigator 组件 b. 路由 API，包括 navigateTo / redirectTo / switchTab / navigateBack / reLaunch 建议使用 navigator 组件，若不得不使用API，可在爬虫访问时屏蔽针对点击设置的时间锁或变量锁。

## 3. 清晰简洁的页面参数。

结构清晰、简洁、参数有含义的 querystring 对抓取以及后续的分析都有很大帮助，但是将 JSON 数据作为参数的方式是比较糟糕的实现。

## 4. 必要的时候才请求用户进行授权、登录、绑定手机号等。

建议在必须的时候才要求用户授权（比如阅读文章可以匿名，而发表评论需要留名）。

## 5. 我们不收录 web-view 中的任何内容。

我们暂时做不到这一点，长期来看，我们可能也做不到。

## 6. 设置一个清晰的标题和页面缩略图。

页面标题和缩略图对于我们理解页面和提高曝光转化有重要的作用。 通过 wx.setNavigationBarTitle 或 自定义转发内容 onShareAppMessage 对页面的标题和缩略图设置，另外也为 video、audio 组件补齐 poster / poster-for-crawler 属性。
