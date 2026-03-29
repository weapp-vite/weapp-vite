<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/events -->

# 组件间通信与事件

## 组件间通信

组件间的基本通信方式有以下几种。

- WXML 数据绑定：用于父组件向子组件的指定属性设置数据，仅能设置 JSON 兼容数据（自基础库版本 [2.0.9](../../compatibility.md) 开始，还可以在数据中包含函数）。具体在 [组件模板和样式](../wxml-wxss.md) 章节中介绍。
- 事件：用于子组件向父组件传递数据，可以传递任意数据。
- 如果以上两种方式不足以满足需要，父组件还可以通过 `this.selectComponent` 方法获取子组件实例对象，这样就可以直接访问组件的任意数据和方法。

## 监听事件

事件系统是组件间通信的主要方式之一。自定义组件可以触发任意的事件，引用组件的页面可以监听这些事件。关于事件的基本概念和用法，参见 [事件](../../view/wxml/event.md) 。

监听自定义组件事件的方法与监听基础组件事件的方法完全一致：

**代码示例：**

```html
<!-- 当自定义组件触发“myevent”事件时，调用“onMyEvent”方法 -->
<component-tag-name bindmyevent="onMyEvent" />
<!-- 或者可以写成 -->
<component-tag-name bind:myevent="onMyEvent" />
```

```js
Page({
  onMyEvent: function(e){
    e.detail // 自定义组件触发事件时提供的detail对象
  }
})
```

## 触发事件

自定义组件触发事件时，需要使用 `triggerEvent` 方法，指定事件名、detail对象和事件选项：

**代码示例：**

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/DFfYSKmI6vZD)

```html
<!-- 在自定义组件中 -->
<button bindtap="onTap">点击这个按钮将触发“myevent”事件</button>
```

```js
Component({
  properties: {},
  methods: {
    onTap: function(){
      var myEventDetail = {} // detail对象，提供给事件监听函数
      var myEventOption = {} // 触发事件的选项
      this.triggerEvent('myevent', myEventDetail, myEventOption)
    }
  }
})
```

触发事件的选项包括：

<table><thead><tr><th>选项名</th> <th>类型</th> <th>是否必填</th> <th>默认值</th> <th>描述</th></tr></thead> <tbody><tr><td>bubbles</td> <td>Boolean</td> <td>否</td> <td>false</td> <td>事件是否冒泡</td></tr> <tr><td>composed</td> <td>Boolean</td> <td>否</td> <td>false</td> <td>事件是否可以穿越组件边界，为false时，事件将只能在引用组件的节点树上触发，不进入其他任何组件内部</td></tr> <tr><td>capturePhase</td> <td>Boolean</td> <td>否</td> <td>false</td> <td>事件是否拥有捕获阶段</td></tr></tbody></table>

关于冒泡和捕获阶段的概念，请阅读 [事件](../../view/wxml/event.md) 章节中的相关说明。

**代码示例：**

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/UGfljKm66zZ1)

```html
// 页面 page.wxml
<another-component bindcustomevent="pageEventListener1">
  <my-component bindcustomevent="pageEventListener2"></my-component>
</another-component>
```

```html
// 组件 another-component.wxml
<view bindcustomevent="anotherEventListener">
  <slot />
</view>
```

```html
// 组件 my-component.wxml
<view bindcustomevent="myEventListener">
  <slot />
</view>
```

```js
// 组件 my-component.js
Component({
  methods: {
    onTap: function(){
      this.triggerEvent('customevent', {}) // 只会触发 pageEventListener2
      this.triggerEvent('customevent', {}, { bubbles: true }) // 会依次触发 pageEventListener2 、 pageEventListener1
      this.triggerEvent('customevent', {}, { bubbles: true, composed: true }) // 会依次触发 pageEventListener2 、 anotherEventListener 、 pageEventListener1
    }
  }
})
```

## 获取组件实例

可在父组件里调用 `this.selectComponent` ，获取子组件的实例对象。

调用时需要传入一个匹配选择器 `selector` ，如： `this.selectComponent(".my-component")` 。

`selector` 详细语法可查看 [selector 语法参考文档](https://developers.weixin.qq.com/miniprogram/dev/api/wxml/SelectorQuery.select.html) 。

**代码示例：**

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/oQ64sFmm7rhD)

```javascript
// 父组件
Page({
  data: {},
  getChildComponent: function () {
    const child = this.selectComponent('.my-component');
    console.log(child)
  }
})
```

在上例中，父组件将会获取 `class` 为 `my-component` 的子组件实例对象，即子组件的 `this` 。

**注意** ：默认情况下，小程序与插件之间、不同插件之间的组件将无法通过 `selectComponent` 得到组件实例（将返回 `null` ）。如果想让一个组件在上述条件下依然能被 `selectComponent` 返回，可以自定义其返回结果（见下）。

### 自定义的组件实例获取结果

若需要自定义 `selectComponent` 返回的数据，可使用内置 `behavior` : `wx://component-export`

从基础库版本 [2.2.3](../../compatibility.md) 开始提供支持。

使用该 behavior 时，自定义组件中的 `export` 定义段将用于指定组件被 `selectComponent` 调用时的返回值。

**代码示例：**

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/ZtosuRmK741Y)

```javascript
// 自定义组件 my-component 内部
Component({
  behaviors: ['wx://component-export'],
  export() {
    return { myField: 'myValue' }
  }
})
```

```html
<!-- 使用自定义组件时 -->
<my-component id="the-id" />
```

```javascript
// 父组件调用
const child = this.selectComponent('#the-id') // 等于 { myField: 'myValue' }
```

在上例中，父组件获取 `id` 为 `the-id` 的子组件实例的时候，得到的是对象 `{ myField: 'myValue' }` 。
