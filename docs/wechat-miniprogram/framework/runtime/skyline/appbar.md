<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/skyline/appbar.html -->

# 全局工具栏

> 基础库 3.3.1 开始支持，低版本需做 [兼容处理](../../compatibility.md) 。

可跨页面渲染的组件，使用场景如音乐 APP 的底部工具栏等。在连续的 `Skyline` 页面跳转时，组件实例为同一个，因此状态可以同步，渲染层级在页面之上（也在自定义 `tabbar` 之上）。

在 `webview` 渲染和 `Skyline` 渲染之间混跳时，有如下限制：

1. `app-bar` 组件仅支持 `Skyline` 渲染，从 `webview` 页跳 `Skyline` 页才会出现，返回到 `webview` 页则消失。
2. 连续的 `Skyline` 页面间跳转， `app-bar` 组件为同一实例，中间若隔着 `webview` ，则为不同实例，状态不同步。
3. 从 `Skyline` 返回到 `webview` 页面，再次进入 `Skyline` ， `app-bar` 组件实例会重建，状态也不同步。

## 示例代码

开发者工具需升级到 `Nightly` `1.06.2401052` ，基础库选择 `3.3.1`

### 示例-1 混跳场景

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/zBQSTXmv7tNY)

### 示例-2 音乐类播放栏

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/iHQv5ZmT7ZNW)

## 使用流程

### 1. 配置信息

- 在 `app.json` 中添加 `appBar` 选项。

示例：

```json
{
  "appBar": {}
}
```

### 2. 添加 appBar 代码文件

在代码根目录下添加入口文件，注意不要修改文件命名， `app-bar` 组件不可声明为虚拟化节点 `virtualHost: true` 。

```
app-bar/index.js
app-bar/index.json
app-bar/index.wxml
app-bar/index.wxss
```

### 3. 编写 appBar 代码

用自定义组件的方式编写即可，该自定义组件完全接管 appBar 的渲染。另外，自定义组件新增 `getAppBar` 接口，可获取当前页面下的 appBar 组件实例。

#### 1. 响应事件

为防止遮挡页面， `app-bar` 组件根节点默认添加了 `pointer-events: none;` ，组件内的节点需响应点击时，需加上 `pointer-events: auto;` 。

```html
<view class="tool-bar"></view>
```

```css
.tool-bar {
  pointer-events: auto;
  position: absolute;
}
```

#### 2. 获取组件实例

```js
Page({
  getInstance() {
    if (typeof this.getAppBar === 'function' ) {
      const appBarComp = this.getAppBar()
      appBarComp.setData({})
    }
  }
})
```
