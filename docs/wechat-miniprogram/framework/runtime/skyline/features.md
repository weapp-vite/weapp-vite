<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/features.html -->

# 特性

Skyline 以性能为首要目标，因此 CSS 特性上在满足基本需求的前提下进行了大幅精简，目前 Skyline 只保留更现代的 CSS 集合。另一方面，Skyline 又添加了大量的特性，使开发者能够构建出类原生体验的小程序。在编码上，Skyline 与 WebView 模式保持一致，仍使用 WXML 和 WXSS 编写界面。在不采用 Skyline 新增特性的情况下，适配了 Skyline 的小程序在低版本或未支持 Skyline 的平台上可无缝自动退回到 WebView 渲染。

## 支持与 WebView 混合使用

小程序支持页面使用 WebView 或 Skyline 任一模式进行渲染，Skyline 页面可以和 WebView 页面混跳，故开发者可以页面粒度或分包粒度按需适配。

```json
// page.json
// skyline 渲染
{
    "renderer": "skyline"
}

// webview 渲染
{
    "renderer": "webview"
}
```

```json
// app.json
{
  "subPackages": [
    {
      "root": "packageA",
      "pages": ["pages/cat"],
      "componentFramework": "glass-easel",
      "renderer": "skyline",
    },
  ],
}
```

## 提供更好的性能

Skyline 在渲染流程上较 WebView 更为精简，其对节点的渲染有着更精确的控制，尽量避免不可见区域的布局和绘制，以此来保证更高的渲染性能。WebView 由于其整体设计不同以及兼容性等问题，渲染流水线的实现更加冗长复杂。

在光栅化策略上，Skyline 采用的是同步光栅化的策略，WebView 是异步分块光栅化的策略。两种策略各有千秋，但 WebView 的策略存在一些难以规避的问题，例如：快速滚动会出现白屏问题；滚动过程中的 DOM 更新会出现不同步的问题，进而影响到用户体验。

在此基础上，我们还进一步实现了很多优化点。

### 1. 单线程版本组件框架

Skyline 下默认启用了新版本的组件框架 glass-easel，该版本适应了 Skyline 的单线程模型，使得建树流程的耗时有效降低（优化 30%-40%），同时 setData 调用也不再有通信开销和序列化开销。

### 2. 组件下沉

Skyline 内置组件的行为更接近原生体验，部分内置组件（如 scroll-view、swiper 等）借助于底层实现，有更好的性能和交互体验。同时，我们将部分内置组件（如 view、text、image 等）从 JS 下沉到原生实现，相当于原生 DOM 节点，降低了创建组件的开销（优化了 30% 左右）。

### 3.长列表按需渲染

长列表是一个常用的但又经常遇到性能瓶颈的场景，Skyline 对其做了一些优化，使 scroll-view 组件只渲染在屏节点（用法上有一定的约束），并且增加 lazy mount 机制优化首次渲染长列表的性能，后续我们也计划在组件框架层面进一步支持 scroll-view 的可回收机制，以更大程度降低创建节点的开销。

### 4. WXSS 预编译

同 WebView 传输 WXSS 文本不同，Skyline 在后台构建小程序代码包时会将 WXSS 预编译为二进制文件，在运行时直接读取二进制文件获得样式表结构，避免了运行时解析的开销（预编译较运行时解析快 5 倍以上）。

### 5. 样式计算更快

Skyline 通过精简 WXSS 特性大幅简化了样式计算的流程。在样式更新上，与 WebView 全量计算不同，Skyline 使用局部样式更新，可以避免对 DOM 树的多次遍历。Skyline 与小程序框架结合也更为紧密，例如： Skyline 结合组件系统实现了 WXSS 样式隔离、基于 wx:for 实现了节点样式共享（相比于 WebView 推测式样式共享更为精确、高效）。在节点变更、内联样式和继承样式的更新上，Skyline 也进行了一些优化，从而保证样式计算的性能。

此外，对于 rpx 单位，我们直接在样式计算阶段原生支持，这样避免了在 JS 层面做太多额外的计算。

```html
<!-- 样式共享目前暂未自动识别，可手动声明 list-item 属性开启 -->
<scroll-view type="list" scroll-y>
    <view wx:for="{{list}}" list-item>{{index}}</view>
</scroll-view>
```

### 6. 降低内存占用

在 WebView 渲染模式下，一个小程序页面对应一个 WebView 实例，并且每个页面会重复注入一些公共资源。而 Skyline 只有 AppService 线程，且多个 Skyline 页面会运行在同一个渲染引擎实例下，因此页面占用内存能够降低很多，还能做到更细粒度的页面间资源共享（如全局样式、公共代码、缓存资源等）。

## 根除旧有架构的问题

在基于 Web 体系的架构下，小程序的部分基础体验会受限于 WebView 提供的能力（特别是 iOS WKWebView 限制更大一些），使得一些技术方案无法做得很完美，留下一些潜在的问题。

### 1. 原生组件同层渲染更稳定

iOS 下原生组件 [同层渲染的原理](https://developers.weixin.qq.com/community/develop/article/doc/000c4e433707c072c1793e56f5c813) 先前有介绍过，本质上是在 WKWebView 黑盒下一种取巧的实现方式，并不能完美融合到 WKWebView 的渲染流程，因此很容易在一些特殊的样式发生变化后，同层渲染会失效。在 Skyline 下可以很好地融合到渲染流程中，因此会更稳定。

### 2. 无需页面恢复机制

iOS 下 WKWebView 会受操作系统统一管理，当内存紧张时，操作系统就会将不在屏的 WKWebView 回收，会使得小程序除前台以外的页面丢失，虽然在页面返回时，我们对页面做了恢复，但页面的状态并不能 100% 还原。在 Skyline 下则不再有该问题。

### 3. 无页面栈层数限制

由于 WebView 的内存占用较大，页面层级最多有 10 层，而 Skyline 在内存方面更有优势，因此在连续 Skyline 页面跳转（复用同一引擎实例）的情况下，不再有该限制。

## 全新的交互动画体系

要达到类原生应用的体验，除渲染性能要好外，做好交互动画也很关键。在 Web 体系下，难以做到像素级可控，交互动画衔接不顺畅，究其原因，在于缺失了一些重要的能力。为此，Skyline 提供一套全新的交互动画能力。

### 1. Worklet 动画

Worklet 机制是 Skyline 交互动画体系的基础，它能够很方便地将 JavaScript 代码跑在渲染线程，那么基于 Worklet 机制的 [动画模块](./worklet.md) ，便能够在渲染线程同步运行动画相关逻辑，使动画不再会有延迟掉帧。

### 2. 手势系统

在原生应用的交互动画里，手势识别与协商是一个很重要的特性，而这块在 Web 体系下是缺失的，因此 Skyline 提供了基于 Worklet 机制的 [手势系统](./gesture.md) 。

- 支持常用手势的识别，如缩放、拖动、双击等，并能够渲染线程同步监听手势、执行手势相关逻辑；
- 支持手势协商处理，能够在遇到手势冲突（常见于滚动容器下）时决定让哪个手势生效，以实现更顺畅的动画衔接。

### 3. 自定义路由

页面间中转进行自定义的转场动画，在原生应用里也是一个很常见的交互动画。在原来的小程序架构下，每个页面都是独立的 WebView 渲染，互相隔离，其跨页能力是基本不具备的。因此，Skyline 提供了基于 Worklet 机制的 [自定义路由模块](./custom-route.md) ，能实现市面上大多数页面转场动画效果。

### 4. 共享元素动画

支持 [跨页面共享元素](./share-element.md) ，能够很方便地将上一个页面的元素“共享”到下一个页面，并伴随着过渡动画，同时支持了一套可定制化接口，能实现自定义的过渡动画。

### 5. 内置组件扩展

对内置组件的扩展也是重要一环，特别是 scroll-view 组件，很多交互动画与滚动息息相关，Skyline 添加了很多在 Web 下很难做到又非常重要的特性。

- 内置下拉刷新的实现，并完善相关事件。原来 WebView 的实现基于 transform，性能不够好且动画衔接不顺畅。
- 提供“下拉二楼”交互的机制。
- 提供 [sticky](https://developers.weixin.qq.com/miniprogram/dev/component/sticky-header.html) 吸顶组件，能很方便地实现吸顶元素交错切换。
- 使 scroll-view 组件在内容未溢出时也能滚动，让用户得到及时的交互反馈。
- 为 scroll-view 组件提供更多控制能力，如最小触发滚动距离（min-drag-distance）、滚动结束事件（scrollend）、滚动原因（isDrag）等。
- 提供原生的 swiper 实现，相比 WebView 基于 transform 的实现，性能更好。

## 更多的高级能力

除了交互动画的系列能力外，借助 Skyline 的优势，我们还提供了很多高级特性。

### 1. 提供 [grid-view](https://developers.weixin.qq.com/miniprogram/dev/component/grid-view.html) 瀑布流组件

瀑布流是一种常用的列表布局方式，得益于 Skyline 在布局过程中的可控性，我们直接在底层实现并提供出来，渲染性能要比 WebView 更优。

### 2. 提供 [snapshot](https://developers.weixin.qq.com/miniprogram/dev/component/snapshot.html) 截图组件

大多数小程序都会基于 canvas 实现自定义分享图的功能，一方面，需要通过 canvas 绘图指令手动实现，较为繁琐；另一方面，在分享图的布局较复杂时，或者在制作长图时会受限于系统对 canvas 尺寸限制，canvas 的方案实现成本都会很大。得益于 Skyline 在渲染过程中的可控性，Skyline 能直接对 WXML 子树进行截图，因此我们直接提供了截图组件，这样能复用更完善的 WXSS 能力，极大降低开发成本。

### 3. [scroll-view](https://developers.weixin.qq.com/miniprogram/dev/component/scroll-view?property=skyline) 组件支持列表反转

在聊天对话的场景下，列表的滚动常常是反向的（往底部往上滚动），若使用正向滚动来模拟会有很多多余的逻辑，而且容易出现跳动，而 scroll-view 提供的 reverse 属性很好的解决这一问题。

还有更多计划提供出来的特性，请详见 [特性状态](./status.md)
