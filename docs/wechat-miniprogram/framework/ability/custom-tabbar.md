<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/custom-tabbar.html -->

# 自定义 tabBar

> 基础库 2.5.0 开始支持，低版本需做 [兼容处理](../compatibility.md) 。

自定义 tabBar 可以让开发者更加灵活地设置 tabBar 样式，以满足更多个性化的场景。

在自定义 tabBar 模式下

- 为了保证低版本兼容以及区分哪些页面是 tab 页，tabBar 的相关配置项需完整声明，但这些字段不会作用于自定义 tabBar 的渲染。
- 此时需要开发者提供一个自定义组件来渲染 tabBar，所有 tabBar 的样式都由该自定义组件渲染。推荐用 fixed 在底部的 [cover-view](https://developers.weixin.qq.com/miniprogram/dev/component/cover-view.html) + [cover-image](https://developers.weixin.qq.com/miniprogram/dev/component/cover-image.html) 组件渲染样式，以保证 tabBar 层级相对较高。
- 与 tabBar 样式相关的接口，如 [wx.setTabBarItem](https://developers.weixin.qq.com/miniprogram/dev/api/ui/tab-bar/wx.setTabBarItem.html) 等将失效。
- **每个 tab 页下的自定义 tabBar 组件实例是不同的** ，可通过自定义组件下的 `getTabBar` 接口，获取当前页面的自定义 tabBar 组件实例。

**注意：如需实现 tab 选中态，要在当前页面下，通过 `getTabBar` 接口获取组件实例，并调用 setData 更新选中态。可参考底部的代码示例。**

## 使用流程

### 1. 配置信息

- 在 `app.json` 中的 `tabBar` 项指定 `custom` 字段，同时其余 `tabBar` 相关配置也补充完整。
- 所有 tab 页的 json 里需声明 `usingComponents` 项，也可以在 `app.json` 全局开启。

示例：

```json
{
  "tabBar": {
    "custom": true,
    "color": "#000000",
    "selectedColor": "#000000",
    "backgroundColor": "#000000",
    "list": [{
      "pagePath": "page/component/index",
      "text": "组件"
    }, {
      "pagePath": "page/API/index",
      "text": "接口"
    }]
  },
  "usingComponents": {}
}
```

### 2. 添加 tabBar 代码文件

在代码根目录下添加入口文件:

```
custom-tab-bar/index.js
custom-tab-bar/index.json
custom-tab-bar/index.wxml
custom-tab-bar/index.wxss
```

### 3. 编写 tabBar 代码

用自定义组件的方式编写即可，该自定义组件完全接管 tabBar 的渲染。另外，自定义组件新增 `getTabBar` 接口，可获取当前页面下的自定义 tabBar 组件实例。

### 示例代码

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/ouJiKgm67cHk)

## skyline 模式

使用 skyline 渲染模式的时候，需要进行如下适配：

### 1. tabBar 组件样式兼容

- tabBar 根组件需要添加 `pointer-events: auto`
- tabBar 根组件定位需为 `position: absolute`

```html
<view class="tab-bar">
  <!-- tabbar item-->
</view>
```

```css
.tab-bar {
  pointer-events: auto;
  position: absolute;
}
```

### 2. getTabBar 回调函数

skyline 模式下，页面/组件上的 `getTabBar` 接口为异步回调的方式获取 tabBar 实例

```js
Page({
  getInstance() {
    if (typeof this.getTabBar === 'function' ) {
      this.getTabBar((tabBar) => {
        tabBar.setData({
          selected: 0
        })
      })
    }
  }
})
```

### skyline 示例代码

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/rhhPXDm47gKe)
