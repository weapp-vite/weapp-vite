<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/share.html -->

# 转发

## 获取更多转发信息

通常开发者希望转发出去的小程序被二次打开的时候能够获取到一些信息，例如群的标识。现在通过调用 [wx.showShareMenu](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.showShareMenu.html) 并且设置 `withShareTicket` 为 `true` ，当用户将小程序转发到任一群聊之后，此转发卡片在群聊中被其他用户打开时，可以在 [App.onLaunch](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onlaunchobject-object) 或 [App.onShow](https://developers.weixin.qq.com/miniprogram/dev/reference/api/App.html#onshowobject-object) 获取到一个 `shareTicket` 。通过调用 [wx.getShareInfo](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.getShareInfo.html) 接口传入此 `shareTicket` 可以获取到转发信息。

## 页面内发起转发

> 基础库 1.2.0 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

通过给 `button` 组件设置属性 `open-type="share"` ，可以在用户点击按钮后触发 [`Page.onShareAppMessage`](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#onshareappmessageobject-object) 事件，相关组件： [button](https://developers.weixin.qq.com/miniprogram/dev/component/button.html) 。

## 使用指引

转发按钮，旨在帮助用户更流畅地与好友分享内容和服务。转发，应是用户自发的行为，且在需要时触手可及。开发者在使用时若遵从以下指引，会得到更佳的用户体验。

1. 含义清晰：明确、一目了然的图形按钮，将为用户减少理解的时间。在我们的资源下载中心，你可以找到这样的按钮素材并直接使用。或者你可以根据自己业务的设计风格，灵活设计含义清晰的按钮的样式。当然，你也可以直接使用带文案的按钮，“转发给好友”，它也足够明确。
2. 方便点击：按钮点击热区不宜过小，亦不宜过大。同时，转发按钮与其他按钮一样，热区也不宜过密，以免用户误操作。
3. 按需出现：并非所有页面都适合放置转发按钮，涉及用户隐私的非公开内容，或可能打断用户完成当前操作体验的场景，该功能并不推荐使用。同时，由于转发过程中，我们将截取用户屏幕图像作为配图，因此，需要注意帮助用户屏蔽个人信息。
4. 尊重意愿：理所当然，并非所有的用户，都喜欢与朋友分享你的小程序。因此，它不应该成为一个诱导或强制行为，如转发后才能解锁某项功能等。请注意，这类做法不仅不被推荐，还可能违反我们的 [《运营规范》](https://mp.weixin.qq.com/debug/wxadoc/product/index.html) ，我们强烈建议你在使用前阅读这部分内容。

以上，我们陈列了最重要的几点，如果你有时间，可以完整浏览 [《设计指南》](https://mp.weixin.qq.com/debug/wxadoc/design/index.html) ，相信会有更多的收获。

## 注意事项

1. 不自定义转发图片的情况下，默认会取当前页面，从顶部开始，高度为 80% 屏幕宽度的图像作为转发图片。
2. 转发的调试支持请查看 [普通转发的调试支持](https://developers.weixin.qq.com/miniprogram/dev/devtools/different.html#%E6%99%AE%E9%80%9A%E7%9A%84%E8%BD%AC%E5%8F%91) 和 [带 shareTicket 的转发](https://developers.weixin.qq.com/miniprogram/dev/devtools/different.html#%E5%B8%A6-shareticket-%E7%9A%84%E8%BD%AC%E5%8F%91)
3. 转发非私密消息时，只有转发到群聊中打开才可以获取到 `shareTicket` 返回值，单聊没有 `shareTicket` 。转发私密消息时，群聊和单聊都可获取到 `shareTicket` 。私密消息详见 [私密消息使用指南](./share/private-message.md)
4. `shareTicket` 仅在当前小程序生命周期内有效
5. 由于策略变动，小程序群相关能力进行调整，开发者可先使用 [wx.getShareInfo](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.getShareInfo.html) 接口中的群 ID 进行功能开发。
6. 微信7.0.12开始，支持群主转发小程序时同时把消息设为该群的群待办消息，群待办消息会以气泡形式出现在聊天窗口底部。默认每次转发一个群待办消息，都会生成一个待办消息气泡。通过 [wx.updateShareMenu](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.updateShareMenu.html) 接口修改 `toDoActivityId` 属性可以把多个待办消息聚合为同一个，即转发相同 `toDoActivityId` 的群待办消息，只会出现一个待办消息气泡。 `toDoActivityId` 需要在转发前通过 [updatableMessage.createActivityId](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/(updatableMessage.createActivityId)) 接口创建。
