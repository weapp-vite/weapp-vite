<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/ohos.html -->

# HarmonyOS 适配指南

基础库从 3.7.0 起正式支持 HarmonyOS 平台，后续与其它平台一致，通过后台灰度更新 [基础库](../client-lib/README.md) ，开发者工具可在详情 - 本地设置 - 调试基础库切到 3.7.0 版本进行开发调试。

## 架构概览

小程序在 HarmonyOS 平台的 [运行环境](../runtime/env.md) 与安卓类似，即逻辑层的 JavaScript 代码运行在 v8 中，视图层是基于 HarmonyOS 原生的 ArkWeb 引擎来渲染，而 Skyline 渲染引擎在支持中，暂未提供。

此外，小程序的运行机制、更新机制、组件框架等均保持一致，但在一些特性支持度上会有区别。

## 适配方式

目前小程序在 HarmonyOS 平台与其它平台的区别主要是 WHarmonyOSebView 引擎及涉及原生能力的特性上。

前者在 HarmonyOS 上使用的是 ArkWeb 引擎，可能存在一些依赖 WebView 的特性上的差异，如 CSS 样式相关，这类问题需按实际情况兼容；

后者大多是与组件/接口相关，可通过 `wx.canIUse` 接口或者通过 `wx.getDeviceInfo().platform === 'ohos'` 判断，对业务逻辑做必要的兼容。

> 注意：如在微信开发者工具中模拟鸿蒙，则需判断 wx.getDeviceInfo().system=='HarmonyOS' (工具中 platform 为 devtools)

## 调试方式

- 通过开发者工具调试

1. 下载最新的nightly版开发者工具，通过最新开发者工具调试
2. 调试基础库版本选择 3.7.0+
3. 选择「小程序模式」，并选择华为鸿蒙机型
4. 支持使用 wx.canIUse 判断接口是否可使用

- 通过真机调试

在 HarmonyOS 的应用商店下载，安装后即可正常打开小程序进行调试。

## 支持情况

以下罗列出暂未支持的特性，对使用到未支持的特性需做好兼容。其中组件/接口具体的支持情况可跳转至对应文档查看， **部分支持的一般代表少数高阶功能不支持** 。

#### 框架

<table><thead><tr><th>特性</th> <th>支持情况</th></tr></thead> <tbody><tr><td><a href="../runtime/skyline/introduction.html">Skyline 渲染引擎</a></td> <td>支持中</td></tr> <tr><td>初始渲染缓存</td> <td>不支持</td></tr> <tr><td>暗黑模式</td> <td>不支持</td></tr> <tr><td>周期性更新</td> <td>不支持</td></tr> <tr><td>数据预拉取</td> <td>不支持</td></tr> <tr><td>无障碍访问</td> <td>不支持</td></tr> <tr><td>分享朋友圈</td> <td>不支持</td></tr></tbody></table>

#### 组件

<table><thead><tr><th>组件</th> <th>支持情况</th></tr></thead> <tbody><tr><td>无障碍访问</td> <td>不支持</td></tr> <tr><td>keyboard-accessory</td> <td>不支持</td></tr> <tr><td>channel-live</td> <td>不支持</td></tr> <tr><td>channel-video</td> <td>不支持</td></tr> <tr><td>voip-room</td> <td>不支持</td></tr> <tr><td>map</td> <td>部分支持</td></tr> <tr><td>canvas</td> <td>部分支持</td></tr> <tr><td>ad/ad-custom</td> <td>不支持</td></tr> <tr><td>official-account</td> <td>不支持</td></tr> <tr><td>xr-frame</td> <td>不支持</td></tr> <tr><td>web-view</td> <td>部分支持</td></tr></tbody></table>

#### 接口

<table><thead><tr><th>模块</th> <th>接口</th> <th>支持情况</th></tr></thead> <tbody><tr><td>基础-生命周期</td> <td>wx.onApiCategoryChange / wx.offApiCategoryChange / wx.getApiCategory</td> <td>不支持</td></tr> <tr><td>基础-应用级事件</td> <td>wx.onThemeChange / wx.offThemeChange / wx.onAudioInterruptionEnd / wx.onAudioInterruptionBegin / wx.offAudioInterruptionEnd / wx.offAudioInterruptionBegin</td> <td>不支持</td></tr> <tr><td>基础-性能</td> <td>wx.preloadWebview / wx.preloadSkylineView</td> <td>不支持</td></tr> <tr><td>路由-自定义路由</td> <td>-</td> <td>支持中</td></tr> <tr><td>跳转</td> <td>wx.openEmbeddedMiniProgram / wx.onEmbeddedMiniProgramHeightChange / wx.offEmbeddedMiniProgramHeightChange</td> <td>不支持</td></tr> <tr><td>转发</td> <td>wx.showShareImageMenu / wx.onCopyUrl / wx.offCopyUrl</td> <td>不支持</td></tr> <tr><td>界面-交互</td> <td>wx.enableAlertBeforeUnload / wx.disableAlertBeforeUnload</td> <td>支持中</td></tr> <tr><td>界面-滚动</td> <td>ScrollViewContext</td> <td>不支持</td></tr> <tr><td>界面-置顶</td> <td>wx.setTopBarText</td> <td>不支持</td></tr> <tr><td>界面-窗口</td> <td>-</td> <td>不支持</td></tr> <tr><td>界面-worklet动画</td> <td>-</td> <td>支持中</td></tr> <tr><td>支付</td> <td>wx.requestCommonPayment / wx.requestVirtualPayment / wx.openHKOfflinePayView</td> <td>不支持</td></tr> <tr><td>数据缓存-数据预拉取和周期性更新</td> <td>wx.getBackgroundFetchData / wx.onBackgroundFetchData / wx.setBackgroundFetchToken / wx.getBackgroundFetchToken</td> <td>不支持</td></tr> <tr><td>数据缓存-缓存管理器</td> <td>-</td> <td>不支持</td></tr> <tr><td>画布</td> <td>-</td> <td>部分支持</td></tr> <tr><td>媒体-视频</td> <td>wx.openVideoEditor</td> <td>不支持</td></tr> <tr><td>媒体-音频</td> <td>只支持 WebAudio</td> <td>不支持</td></tr> <tr><td>媒体-音视频合成</td> <td>-</td> <td>不支持</td></tr> <tr><td>媒体-画面录制器</td> <td>-</td> <td>不支持</td></tr> <tr><td>媒体-视频解码器</td> <td>-</td> <td>不支持</td></tr> <tr><td>开放接口-卡券</td> <td>-</td> <td>不支持</td></tr> <tr><td>开放接口-发票</td> <td>-</td> <td>不支持</td></tr> <tr><td>开放接口-生物认证</td> <td>-</td> <td>不支持</td></tr> <tr><td>开放接口-车牌</td> <td>-</td> <td>不支持</td></tr> <tr><td>开放接口-视频号</td> <td>wx.openChannelsEvent</td> <td>不支持</td></tr> <tr><td>开放接口-微信客服</td> <td>-</td> <td>不支持</td></tr> <tr><td>设备-联系人</td> <td>wx.addPhoneContact</td> <td>不支持</td></tr> <tr><td>设备-无障碍</td> <td>-</td> <td>不支持</td></tr> <tr><td>设备-电量</td> <td>wx.onBatteryInfoChange / wx.offBatteryInfoChange</td> <td>不支持</td></tr> <tr><td>设备-网络</td> <td>wx.onNetworkWeakChange / wx.offNetworkWeakChange / wx.offNetworkStatusChange</td> <td>不支持</td></tr> <tr><td>设备-屏幕</td> <td>wx.onScreenRecordingStateChanged / wx.offScreenRecordingStateChanged / wx.getScreenRecordingState</td> <td>不支持</td></tr> <tr><td>设备-内存</td> <td>-</td> <td>不支持</td></tr> <tr><td>AI</td> <td>-</td> <td>不支持</td></tr> <tr><td>Worker</td> <td>-</td> <td>部分支持</td></tr> <tr><td>广告</td> <td>-</td> <td>不支持</td></tr> <tr><td>Skyline</td> <td>-</td> <td>支持中</td></tr> <tr><td>XR-FRAME</td> <td>-</td> <td>不支持</td></tr></tbody></table>
