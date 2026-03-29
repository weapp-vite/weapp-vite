<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/view/component.html -->

# 基础组件

框架为开发者提供了一系列基础组件，开发者可以通过组合这些基础组件进行快速开发。详细介绍请参考 [组件文档](https://developers.weixin.qq.com/miniprogram/dev/component/) 。

什么是组件：

- 组件是视图层的基本组成单元。
- 组件自带一些功能与微信风格一致的样式。
- 一个组件通常包括 `开始标签` 和 `结束标签` ， `属性` 用来修饰这个组件， `内容` 在两个标签之内。

```html
<tagname property="value">
Content goes here ...
</tagname>
```

**注意：所有组件与属性都是小写，以连字符 `-` 连接**

## 属性类型

<table><thead><tr><th>类型</th> <th>描述</th> <th>注解</th></tr></thead> <tbody><tr><td>Boolean</td> <td>布尔值</td> <td>组件写上该属性，不管是什么值都被当作 <code>true</code>；只有组件上没有该属性时，属性值才为<code>false</code>。<br>如果属性值为变量，变量的值会被转换为Boolean类型</td></tr> <tr><td>Number</td> <td>数字</td> <td><code>1</code>, <code>2.5</code></td></tr> <tr><td>String</td> <td>字符串</td> <td><code>"string"</code></td></tr> <tr><td>Array</td> <td>数组</td> <td><code>[ 1, "string" ]</code></td></tr> <tr><td>Object</td> <td>对象</td> <td><code>{ key: value }</code></td></tr> <tr><td>EventHandler</td> <td>事件处理函数名</td> <td><code>"handlerName"</code> 是 <a href="./../app-service/page.html">Page</a> 中定义的事件处理函数名</td></tr> <tr><td>Any</td> <td>任意属性</td> <td></td></tr></tbody></table>

## 公共属性

所有组件都有以下属性：

<table><thead><tr><th>属性名</th> <th>类型</th> <th>描述</th> <th>注解</th></tr></thead> <tbody><tr><td>id</td> <td>String</td> <td>组件的唯一标示</td> <td>保持整个页面唯一</td></tr> <tr><td>class</td> <td>String</td> <td>组件的样式类</td> <td>在对应的 WXSS 中定义的样式类</td></tr> <tr><td>style</td> <td>String</td> <td>组件的内联样式</td> <td>可以动态设置的内联样式</td></tr> <tr><td>hidden</td> <td>Boolean</td> <td>组件是否显示</td> <td>所有组件默认显示</td></tr> <tr><td>data-*</td> <td>Any</td> <td>自定义属性</td> <td>组件上触发的事件时，会发送给事件处理函数</td></tr> <tr><td>bind* / catch*</td> <td>EventHandler</td> <td>组件的事件</td> <td>详见<a href="./wxml/event.html">事件</a></td></tr></tbody></table>

## 特殊属性

几乎所有组件都有各自定义的属性，可以对该组件的功能或样式进行修饰，请参考各个 [组件](https://developers.weixin.qq.com/miniprogram/dev/component/) 的定义。
