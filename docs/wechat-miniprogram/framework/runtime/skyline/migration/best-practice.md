<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/best-practice.html -->

# 最佳实践

## 按需注入

Skyline 依赖 [按需注入](../../../ability/lazyload.md) 特性。按需注入特性开启后，小程序的部分表现会发生变化，有可能带来兼容问题（具体见按需注入特性文档）；因此建议在开始适配 Skyline 前，先开启按需注入并妥善测试，以提前排除该特性带来的影响。

## 渐进式迁移

对于已有的项目，建议渐进式迁移，即逐个页面打开，推荐迁移使用该小程序的关键路径上的页面，以便让大多数用户获得更好的体验；对于新增页面，建议默认开启 Skyline；而对于全新项目，建议直接全局打开，除了有更好的体验外，也能使小程序的内存占用更低

## 使用局部滚动

在 WebView 下，页面全局默认是可以滚动的，因此大多数开发者会直接使用全局的滚动，这使得

1. 无需滚动的元素使用 `position: fixed` 固定位置，如自定义导航栏，这是用全局滚动模拟了局部滚动，此时滚动条的显示位置会溢出
2. 针对滚动的自定义功能只能通过配置或 API 的方式提供，如 `Page.onPageScroll` 等，也使得部分特性无法实现

因此，Skyline 不再提供全局滚动，在需要滚动的区域使用 scroll-view 实现，后续我们也能针对 scroll-view 组件提供更多扩展。

一般来说，界面布局大多数都是导航栏 + 滚动区域的形式，这里提供一种常规做法（兼容 WebView）

```html
<navigation-bar></navigation-bar>
<!-- 通过使用 flex 布局，将 scroll-view 设置 flex:1 以占据页面剩余空间 -->
<scroll-view type="list" scroll-y style="display: flex; flex-direction: column; flex: 1; width: 100%; overflow: auto;">
  <view wx:for="{{items}}" list-item></view>
</scroll-view>
```

## 全局样式重置

Skyline 支持的 WXSS 是 WebView 的子集，未来可能会再支持一些必要的或常用的特性，但还是会一直保持 WebView 子集的状态。

因此，为了让 WebView 的兼容表现尽量对齐 Skyline，同时减少重复设置的代码，建议全启开启下述配置项：

```json
rendererOptions: {
  "skyline": {
    "defaultDisplayBlock": true,
    "defaultContentBox": true,
    "tagNameStyleIsolation": "legacy",
    "enableScrollViewAutoSize": true,
  }
}
```

同时考虑全局或页面级应用如下 WXSS Reset：

```css
page,
view,
text,
image,
button,
video,
map,
scroll-view,
swiper,
input,
textarea,
navigator {
  position: relative;
  background-origin: border-box;
  isolation: isolate;
}
page {
  height: 100%;
}
```

## 优化长列表性能

Skyline 下的 scroll-view 组件自带按需渲染的优化，这在很大程度上提升了长列表的渲染性能，这里是以 scroll-view 的直接子节点为粒度来按需渲染的，当其某个子节点接近 scroll-view 的 viewport 时就会被渲染，反之则会回收。

```html
<!-- 以下 scroll-view 的直接子节点有 5 个 view，此时每个 view 都能按需渲染 -->
<scroll-view type="list" scroll-y>
    <view> a </view>
    <view> b </view>
    <view> c </view>
    <view> d </view>
    <view> e </view>
</scroll-view>
<!-- 以下 scroll-view 的直接子节点只有 1 个 view，按需渲染并不能发挥作用 -->
<scroll-view type="list" scroll-y>
    <view>
        <view> a </view>
        <view> b </view>
        <view> c </view>
        <view> d </view>
        <view> e </view>
    </view>
</scroll-view>
```

此外，长列表的每一项的样式基本是一样的，Skyline 也支持了相似节点的样式共享，使得样式只需要计算一次便能共享给其它相似节点，大大提升了样式计算的性能。一般来说，我们会用 WXML 模板语法 `wx:for` 来展开列表，因此只需要在列表项声明 `list-item` 就能启动样式共享（后续版本会识别 `wx:for` 而自动启用）

```html
<scroll-view type="list" scroll-y>
    <view wx:for="" list-item> {{index}} </view>
</scroll-view>
```

## 预加载

小程序有个重要优化是会预加载环境，包括 WebView 环境、AppService 线程、提前注入基础库等，而由于目前小程序大多还是以 WebView 渲染，为了节省资源，微信客户端并不会自动预加载 Skyline 环境（后续根据实际情况不断优化策略），因此我们提供了 [wx.preloadSkylineView](https://developers.weixin.qq.com/miniprogram/dev/api/base/performance/wx.preloadSkylineView.html) 预加载 Skyline 环境的接口，开发者可以在可能跳转到 Skyline 页面的路径上手动调用该接口，建议在 `onShow` 生命周期里延迟一段时间后调用，使得 Skyline 页面被返回时能够重新预载

## 使用增强特性

为了使小程序的体验能够跟接近原生 App，Skyline 新增了若干个特性，包括 [worklet 动画机制](../worklet.md) 、 [手势系统](../gesture.md) 、 [自定义路由](../custom-route.md) 、 [共享元素动画](../share-element.md) 等，这些特性使得 Skyline 能够做出一些 WebView 下无法实现或实现效果不够流畅的交互动效。

考虑在 WebView 下都不支持，推荐以一种体验降级的方式去兼容。比如自定义路由，同样是以 `wx.navigateTo` 接口跳转页面，在 Skyline 下可以以自定义路由动画的方式跳转页面，以获得更好的体验，而 WebView 则 fallback 到朴素的从右到左的页面切换动画，同理，共享元素动画特性亦是如此，也无需额外的兼容代码。
