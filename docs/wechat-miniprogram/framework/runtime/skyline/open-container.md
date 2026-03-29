<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/open-container.html -->

# 容器转场动画

通过将一个元素无缝地转换为另一个元素，可以加强两个元素间的关系，如常见的瀑布流中点击卡片跳转到详情页。

为降低开发成本，基础库提供了容器转场动画组件来实现该路由效果。

## 效果演示

## 使用方法

开发者工具需升级到 `Nightly` `1.06.2403222` ，基础库选择 `3.4.0`

将需要进行过度的元素放置在 [`<open-container>`](https://developers.weixin.qq.com/miniprogram/dev/component/open-container.html) 组件内，点击 [`<open-container>`](https://developers.weixin.qq.com/miniprogram/dev/component/open-container.html) ，当使用 `navigateTo` 跳转下一页面时，对其子节点和下一个页面进行过渡。

```html
<open-container
  closed-elevation="{{closedElevation}}"
  closed-border-radius="{{closedBorderRadius}}"
  open-elevation="{{openElevation}}"
  open-border-radius="{{openBorderRadius}}"
  transition-type="{{type}}"
  transition-duration="{{duration}}"
  bind:tap="goDetail"
>
  <card/>
</open-container>
```

```javascript
Page({
   goDetail() {
    wx.navigateTo({
      url: 'nextPageUrl'
    })
  }
})
```

### 组件属性

<table><thead><tr><th>属性</th> <th>类型</th> <th>默认值</th> <th>必填</th> <th>说明</th></tr></thead> <tbody><tr><td>closed-color</td> <td>string</td> <td>white</td> <td>否</td> <td>初始容器背景色</td></tr> <tr><td>closed-elevation</td> <td>number</td> <td>0</td> <td>否</td> <td>初始容器影深大小</td></tr> <tr><td>closed-border-radius</td> <td>number</td> <td>0</td> <td>否</td> <td>初始容器圆角大小</td></tr> <tr><td>middle-color</td> <td>string</td> <td>''</td> <td>否</td> <td><code>fadeThrough</code> 模式下的过渡背景色</td></tr> <tr><td>open-color</td> <td>string</td> <td>white</td> <td>否</td> <td>打开状态下容器背景色</td></tr> <tr><td>open-elevation</td> <td>number</td> <td>0</td> <td>否</td> <td>打开状态下容器影深大小</td></tr> <tr><td>open-border-radius</td> <td>number</td> <td>0</td> <td>否</td> <td>打开状态下容器圆角大小</td></tr> <tr><td>transition-duration</td> <td>number</td> <td>300</td> <td>否</td> <td>动画时长</td></tr> <tr><td>transition-type</td> <td>string</td> <td>fade</td> <td>否</td> <td>动画类型</td></tr></tbody></table>

## 示例代码片段

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/TMOyD8mB7YOB)
