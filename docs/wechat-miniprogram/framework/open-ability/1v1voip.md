<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/1v1voip.html -->

# 双人音视频对话

通过双人音视频通话功能（1v1 VoIP），用户可以直接在小程序内进行一对一视频通话或音频通话，提升小程序服务质量，且功能所需的开发成本极低。

从基础库 [2.20.1](../compatibility.md) 开始支持

## 申请开通

暂只针对国内主体如下类目的小程序开放，需要先通过类目审核，再在小程序管理后台，「开发」-「开发管理」-「接口设置」中自助开通该接口权限。

<table><thead><tr><th>一级类目/主体类型</th> <th>二级类目</th> <th>应用场景</th></tr></thead> <tbody><tr><td>教育</td> <td>在线视频课程</td> <td>一对一辅导、答疑</td></tr> <tr><td>医疗</td> <td>互联网医院、公立医疗机构、私立医疗机构</td> <td>在线问诊</td></tr> <tr><td>金融</td> <td>银行、信托、公募基金、私募基金、证券/期货、证券/期货投资咨询、保险、征信业务、新三板信息服务市场、股票信息服务市场（港股/美股）、消费金融</td> <td>金融产品视频客服理赔等</td></tr> <tr><td>汽车</td> <td>汽车预售服务</td> <td>汽车预售等</td></tr> <tr><td>政府主体账号</td> <td>/</td> <td>政府相关工作在线咨询等</td></tr> <tr><td>IT科技</td> <td>多方通信、音视频设备、基础电信运营商</td> <td>提供语音会议/视频会议等服务；硬件在线销售及服务等；提供在线客服等服务</td></tr> <tr><td>工具</td> <td>视频客服</td> <td>不涉及以上几类内容的一对一客服服务，如企业售后一对一视频/音频通话等</td></tr></tbody></table>

## 前端接口

- 开启双人通话： [wx.setEnable1v1Chat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.setEnable1v1Chat.html)
- 加入（创建）双人通话： [wx.join1v1Chat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.join1v1Chat.html)
- 退出（销毁）双人通话： [wx.exitVoIPChat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.exitVoIPChat.html)
- 更新房间麦克风/耳机静音设置： [wx.updateVoIPChatMuteConfig](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.updateVoIPChatMuteConfig.html)
- 监听房间成员变化： [wx.onVoIPChatMembersChanged](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatMembersChanged.html)
- 监听房间成员通话状态变化： [wx.onVoIPChatSpeakersChanged](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatSpeakersChanged.html)
- 监听通话中断： [wx.onVoIPChatInterrupted](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.onVoIPChatInterrupted.html)
- 监听实时语音通话成员视频状态变化： [wx.onVoIPVideoMembersChanged](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/(wx.onOnVoIPVideoMembersChanged))

## 调用流程

1. 通过 [wx.setEnable1v1Chat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.setEnable1v1Chat.html) 接口将用户的接听状态 `enable` 设置为 `true` ，该设置仅在当次小程序生命周期有效，小程序每次冷启动后均需要重新设置。
2. 通过 [wx.join1v1Chat](https://developers.weixin.qq.com/miniprogram/dev/api/media/voip/wx.join1v1Chat.html) 接口传入呼叫方信息 `caller` 与接听方信息 `listener` 发起呼叫，接听方与呼叫方均需在小程序内。

## 计费

微信为单个小程序提供每个自然月1000分钟的免费通话时长，1分钟语音通话时长扣除1分钟免费通话时长，1分钟视频通话时长扣除15分钟免费时长。超出部分需另行付费。 免费时长领取与套餐包购买需前往 [微信服务市场](https://fuwu.weixin.qq.com/service/detail/00048c0090477065ad6b475ee56415) 进行操作。
