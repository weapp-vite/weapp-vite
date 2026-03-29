<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/release.html -->

# 发布上线

在考虑要上线发布到正式环境时，我们一般会关注 **版本覆盖** 和 **稳定性** 问题，对于这两个问题，我们提供了完备的解决方案。

## 版本覆盖

由于 Skyline 是在微信较高版本支持，那么是否低版本就完全运行不了小程序了？答案是否定的。为了保证线上小程序能可靠运行，可任取以下其中一种策略

1. 提高「基础库最低可用版本」，设置为 Skyline 所支持的版本，该策略意味着放弃低版本用户。
2. 兼容好 WebView，我们会在 **不支持 Skyline 的版本自动降级为 WebView 渲染** 。

由于 Skyline 所支持的 CSS 子集是遵循 Web 标准的，因此在样式方面切到 WebView 渲染也能正确渲染，此外对于 Skyline 新增的特性，与小程序其它新增的接口类似，低版本需做好兼容，但我们在部分特性针对 WebView 做了兼容处理，具体参考以下表格：

<table><thead><tr><th>特性</th> <th>WebView 兼容性</th> <th>低版本兼容性</th></tr></thead> <tbody><tr><td>worklet 动画</td> <td>已兼容</td> <td>需自行做好兼容</td></tr> <tr><td>手势系统</td> <td>相当于空节点</td> <td>需自行做好兼容</td></tr> <tr><td>自定义路由</td> <td>无需兼容（无动效）</td> <td>无需兼容（无动效）</td></tr> <tr><td>共享元素</td> <td>无需兼容（无动效）</td> <td>无需兼容（无动效）</td></tr> <tr><td>scroll-view 按需渲染</td> <td>无需兼容（无优化）</td> <td>无需兼容（无优化）</td></tr> <tr><td>scroll-view 新增属性和事件</td> <td>不兼容</td> <td>需自行做好兼容</td></tr> <tr><td>grid-view</td> <td>已兼容</td> <td>需自行做好兼容</td></tr> <tr><td>sticky-section/header</td> <td>不兼容（可手动加上 <code>position: sticky</code> 兼容）</td> <td>不兼容（可手动加上 <code>position: sticky</code> 兼容）</td></tr></tbody></table>

## 稳定性

一般而言，代码变更后需要上线发布时，为了保证线上的稳定性，我们都会选择灰度发布，对于新增 Skyline 相关代码的情况也不例外，因此我们提供了完备的灰度方案。

1. 通过 We 分析 AB 实验进行灰度。

Skyline **默认是需要经过 We 分析的 AB 实验的** ，也就是小程序新版本发布后，默认还是以 WebView 运行，需要在 We 分析的 AB 实验的「小程序基础库实验」逐步放量。需要特别留意的是， **当 AB 实验的流量分配到 100% 时，并不代表是全量，而是 Skyline 和 WebView 各 50%** ，若要全量的话，需要先结束实验再选择全量某一个实验组。

1. 通过小程序版本管理中的发布灰度。

若小程序已经过充分测试，无需再进行 AB 实验的话，我们也提供了以下配置项，可在 app.json 或 page.json 配置上，使 Skyline 不经 AB 实验而默认打开。一般来说， `sdkVersion` 与 `iosVersion` + `androidVersion` 选其一填写即可。

```javascript
"rendererOptions": {
  "skyline": {
    "disableABTest": true,
    "sdkVersionBegin": "3.0.1", // 基础库最低版本
    "sdkVersionEnd": "15.255.255", // 填最大值，否则之后的新版本会不生效
  }
}
```

```javascript
"rendererOptions": {
  "skyline": {
    "disableABTest": true,
    "iosVersionBegin": "x.y.z", // iOS 微信最低版本
    "iosVersionEnd": "15.255.255", // 填最大值，否则之后的新版本会不生效
    "androidVersionBegin": "x.y.z", // 安卓微信最低版本
    "androidVersionEnd": "15.255.255", // 填最大值，否则之后的新版本会不生效
    "ohosVersionBegin": "1.0.5", //  HarmonyOS 微信最低版本
    "ohosVersionEnd": "15.255.255" // 填最大值，否则之后的新版本会不生效
  }
}
```
