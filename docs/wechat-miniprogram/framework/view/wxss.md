<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxss.html -->

# WXSS

WXSS (WeiXin Style Sheets)是一套样式语言，用于描述 WXML 的组件样式。

WXSS 用来决定 WXML 的组件应该怎么显示。

为了适应广大的前端开发者，WXSS 具有 CSS 大部分特性。同时为了更适合开发微信小程序，WXSS 对 CSS 进行了扩充以及修改。

与 CSS 相比，WXSS 扩展的特性有：

- 尺寸单位
- 样式导入

## 尺寸单位

- rpx（responsive pixel）: 可以根据屏幕宽度进行自适应。规定屏幕宽为750rpx。如在 iPhone6 上，屏幕宽度为375px，共有750个物理像素，则750rpx = 375px = 750物理像素，1rpx = 0.5px = 1物理像素。

<table><thead><tr><th>设备</th> <th>rpx换算px (屏幕宽度/750)</th> <th>px换算rpx (750/屏幕宽度)</th></tr></thead> <tbody><tr><td>iPhone5</td> <td>1rpx = 0.42px</td> <td>1px = 2.34rpx</td></tr> <tr><td>iPhone6</td> <td>1rpx = 0.5px</td> <td>1px = 2rpx</td></tr> <tr><td>iPhone6 Plus</td> <td>1rpx = 0.552px</td> <td>1px = 1.81rpx</td></tr></tbody></table>

**建议：** 开发微信小程序时设计师可以用 iPhone6 作为视觉稿的标准。

**注意：** 在较小的屏幕上不可避免的会有一些毛刺，请在开发时尽量避免这种情况。

## 样式导入

使用 `@import` 语句可以导入外联样式表， `@import` 后跟需要导入的外联样式表的相对路径，用 `;` 表示语句结束。

**示例代码：**

```less
/** common.wxss **/
.small-p {
  padding:5px;
}
```

```less
/** app.wxss **/
@import "common.wxss";
.middle-p {
  padding:15px;
}
```

## 内联样式

框架组件上支持使用 style、class 属性来控制组件的样式。

- style：静态的样式统一写到 class 中。style 接收动态的样式，在运行时会进行解析，请尽量避免将静态的样式写进 style 中，以免影响渲染速度。

```html
<view style="color:{{color}};" />
```

- class：用于指定样式规则，其属性值是样式规则中类选择器名(样式类名)的集合，样式类名不需要带上 `.` ，样式类名之间用空格分隔。

```html
<view class="normal_view" />
```

## 选择器

目前支持的选择器有：

<table><thead><tr><th>选择器</th> <th>样例</th> <th>样例描述</th></tr></thead> <tbody><tr><td>.class</td> <td><code>.intro</code></td> <td>选择所有拥有 class="intro" 的组件</td></tr> <tr><td>#id</td> <td><code>#firstname</code></td> <td>选择拥有 id="firstname" 的组件</td></tr> <tr><td>element</td> <td><code>view</code></td> <td>选择所有 view 组件</td></tr> <tr><td>element, element</td> <td><code>view, checkbox</code></td> <td>选择所有文档的 view 组件和所有的 checkbox 组件</td></tr> <tr><td>::after</td> <td><code>view::after</code></td> <td>在 view 组件后边插入内容</td></tr> <tr><td>::before</td> <td><code>view::before</code></td> <td>在 view 组件前边插入内容</td></tr></tbody></table>

## 全局样式与局部样式

定义在 app.wxss 中的样式为全局样式，作用于每一个页面。在 page 的 wxss 文件中定义的样式为局部样式，只作用在对应的页面，并会覆盖 app.wxss 中相同的选择器。
