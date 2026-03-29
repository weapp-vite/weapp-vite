<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/migration/compatibility.html -->

# 兼容

Skyline 目前各端的支持情况见下表

<table><thead><tr><th>平台</th> <th>支持版本</th> <th>备注</th></tr></thead> <tbody><tr><td>安卓</td> <td>8.0.33+</td> <td>支持</td></tr> <tr><td>iOS</td> <td>8.0.34+</td> <td>支持</td></tr> <tr><td>开发者工具</td> <td>Stable 1.06.2307260+</td> <td>支持</td></tr> <tr><td>Windows</td> <td>未支持</td> <td>规划中</td></tr> <tr><td>Mac</td> <td>未支持</td> <td>规划中</td></tr> <tr><td>企业微信</td> <td>未支持</td> <td>开发中</td></tr></tbody></table>

可以看出，小程序若不是只跑在最新版本的微信移动端，则需要关注兼容 WebView 的情况，这里我们整理了一些兼容方法及常见的兼容问题

## 兼容方法

### 样式兼容

Skyline 与 WebView 的主要差异在于样式支持度，因此大部分兼容工作主要集中在样式适配，这里可以利用开发者工具的 WXML 调试工具，通过定位到有问题的节点，分析对应的样式兼容性。

对于具体样式兼容的策略上，由于 Skyline 中部分样式的默认值与 web 不同，因使用默认值而省略的样式需要显示指定，如 `flex-direction: row` ，但此处更推荐 [开启默认 Block 布局](../wxss.md#%E5%BC%80%E5%90%AF%E9%BB%98%E8%AE%A4Block%E5%B8%83%E5%B1%80) 和 [默认 ContentBox 盒模型](../wxss.md#%E5%BC%80%E5%90%AF%E9%BB%98%E8%AE%A4contentbox%E7%9B%92%E6%A8%A1%E5%9E%8B) ，默认值处理与 web 更接近，其它更多信息，详见 [Skyline WXSS 样式支持与差异](../wxss.md)

### 根据不同 renderer 兼容

有时，单纯用 WXML 和 WXSS 无法做好兼容时，可以通过 JS 判断是否 Skyline 以使用不同的 WXML 或 WXSS 实现。我们在页面或组件实例增加了 `renderer` 成员，取值为 `webview` 或 `skyline` ，参考以下代码

```html
<view class="position {{renderer}}"></view>
```

```css
.position {
    position: fixed;
}
.position.skyline {
    position: absolute;
}
```

```js
Page({
    data: {
        renderer: 'webview'
    },
    onLoad() {
        this.setData({
            renderer: this.renderer,
        })
    },
})
```

## 常见的兼容问题

- **Skyline 一定需要应用到整个小程序吗？**
  不需要，Skyline 支持按页面粒度或分包粒度开启，可渐进式迁移。
- **开启 Skyline 后布局错乱**
  一般是默认 flex 布局及 box-sizing 默认为 border-box 导致， **推荐开发者开启 [默认 Block 布局](../wxss.md#%E5%BC%80%E5%90%AF%E9%BB%98%E8%AE%A4Block%E5%B8%83%E5%B1%80) 、 [默认 ContentBox 盒模型](../wxss.md#%E5%BC%80%E5%90%AF%E9%BB%98%E8%AE%A4contentbox%E7%9B%92%E6%A8%A1%E5%9E%8B)** 。
- **切换 Skyline后，为什么顶部原生导航栏消失？**
  不支持原生导航栏，需自行实现，或使用 [weui 组件库](https://github.com/wechat-miniprogram/weui-miniprogram/tree/feat-skyline/src/components/navigation-bar) 。推荐页面配置加上 "navigationStyle": "custom" 以保持与 WebView 兼容
- **切换 Skyline 后，为什么 position: absolute 相对坐标不准确？**
  在 Skyline 模式下，所有节点默认是 relative，可能导致 absolute 相对坐标不准。建议开发者修改节点 position 或者修改相对坐标。
- **多段文本无法内联**
  因不支持 `inline` 布局导致，需改成 flex 布局实现，或者使用 text 组件包裹多段文本，而不是用 view 组件包裹，也可以使用 span 组件包裹 text 和 image 混合内联。如 `<span><image /></span>` 、 `<span><view style="width: 50px;"/></span>`
- **单行文本的省略样式失效**
  `text-overflow: ellipse` 只在 text 组件上生效，不能应用在 view 组件上，同时需要声明 `white-space: nowrap` 以及 `overflow: hidden` ，建议直接使用 `<text overflow="ellipsis"/>`
- **多行文本的省略样式失效**
  在单行文本省略的基础上，通过 text 组件的 `max-lines` 属性设置最长行数，即 `<text max-lines="2"></text>`
- **z-index 表现异常**
  这是由于 Skyline 不支持 web 标准的层叠上下文所致，只有在同层级的节点之前应用 `z-index` 才有效，可根据实际情况调整取值
- **weui 扩展库无法使用**
  平台正在支持扩展库，预计近期上线。建议开发者使用 npm 安装 [weui 组件库](https://github.com/wechat-miniprogram/weui-miniprogram) 后，将 node\_ modules/weui-miniprogram 下的miniprogram\_ dist 替换为 [链接](https://github.com/wechat-miniprogram/weui-miniprogram/blob/feat-skyline-524/miniprogram_dist.zip) 中的 miniprogram\_dist，然后在微信开发中工具中构建 npm 即可。
- **不支持组件 animate 动画接口**
  暂不支持组件 animate 动画接口。如需实现相关效果，可使用 [worklet 动画机制](../worklet.md) 实现
- **svg 渲染不正确**
  Skyline 上的 SVG 不支持 <style> 选择器匹配，可自行转成内联的方式；不支持 rgba 格式，可使用 fill-opacity 替代；建议用 [SVGO](https://jakearchibald.github.io/svgomg/) 在线工具优化
- **自定义组件的样式表现不正确**
    - 可留意是否存在跨自定义组件的样式匹配，Skyline 下 tag 和 id 选择器不支持跨自定义组件匹配，而 class 则遵循 [组件样式隔离机制](../../../custom-component/wxml-wxss.md#%E7%BB%84%E4%BB%B6%E6%A0%B7%E5%BC%8F%E9%9A%94%E7%A6%BB) ，可 [开启 tag 选择器全局匹配](../wxss.md#%E5%BC%80%E5%90%AFtag%E9%80%89%E6%8B%A9%E5%99%A8%E5%85%A8%E5%B1%80%E5%8C%B9%E9%85%8D) 以保持与旧版行为对齐
- **WebView scroll-view 横向滚动不生效**
  横向滚动需打开 enable-flex 以兼容 WebView，同时 scroll-view 添加样式 `display: flex; flex-direction: row;` ，scroll-view 子节点添加样式 `flex-shrink: 0;`
- **当 scroll-view 包含的内容较多时，为什么 boundingClientRect 无法执行？**
  由于 scroll-view 的直接子节点（第一层节点）是按需渲染，即直接子节点不在屏时不会渲染，无法获取到节点尺寸，因此当 boundingClientRect 通过 query.selectAll 获取时，无法立即获取节点尺寸，只有在所有节点渲染才能获取。建议开发者尝试调整为逐个获取节点的 boundingClientRect。
- **切换 Skyline 后，为什么 map / canvas / video / camera 在微信开发者工具渲染失败？**
  在 Skyline 模式下，微信开发者工具暂未支持调试原生组件，建议开发者使用真机预览完成调试。
- **在 Skyline 模式下，为什么微信开发者工具热重载无响应？**
  目前 Skyline 模式暂不支持热重载，建议先关闭热重载，重新编译来预览渲染结果。后续平台将支持热重载能力。
