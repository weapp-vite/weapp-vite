<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/customer-message/typing.html -->

# 客服输入状态

开发者可通过调用 [客服输入状态接口](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/kf-mgnt/kf-message/setTyping.html) ，返回客服当前输入状态给用户。

1. 此接口需要客服消息接口权限。
2. 如果不满足发送客服消息的触发条件，则无法下发输入状态。
3. 下发输入状态，需要客服之前 30 秒内跟用户有过消息交互。
4. 在输入状态中（持续 15 秒），不可重复下发输入态。
5. 在输入状态中，如果向用户下发消息，会同时取消输入状态。
