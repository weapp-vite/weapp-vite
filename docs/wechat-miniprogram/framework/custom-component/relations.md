<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/relations.html -->

# 组件间关系

## 定义和使用组件间关系

有时需要实现这样的组件：

```html
<custom-ul>
  <custom-li> item 1 </custom-li>
  <custom-li> item 2 </custom-li>
</custom-ul>
```

这个例子中， `custom-ul` 和 `custom-li` 都是自定义组件，它们有相互间的关系，相互间的通信往往比较复杂。此时在组件定义时加入 `relations` 定义段，可以解决这样的问题。示例：

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/0kfvzKm56NZy)

```js
// path/to/custom-ul.js
Component({
  relations: {
    './custom-li': {
      type: 'child', // 关联的目标节点应为子节点
      linked: function(target) {
        // 每次有custom-li被插入时执行，target是该节点实例对象，触发在该节点attached生命周期之后
      },
      linkChanged: function(target) {
        // 每次有custom-li被移动后执行，target是该节点实例对象，触发在该节点moved生命周期之后
      },
      unlinked: function(target) {
        // 每次有custom-li被移除时执行，target是该节点实例对象，触发在该节点detached生命周期之后
      }
    }
  },
  methods: {
    _getAllLi: function(){
      // 使用getRelationNodes可以获得nodes数组，包含所有已关联的custom-li，且是有序的
      var nodes = this.getRelationNodes('path/to/custom-li')
    }
  },
  ready: function(){
    this._getAllLi()
  }
})
```

```js
// path/to/custom-li.js
Component({
  relations: {
    './custom-ul': {
      type: 'parent', // 关联的目标节点应为父节点
      linked: function(target) {
        // 每次被插入到custom-ul时执行，target是custom-ul节点实例对象，触发在attached生命周期之后
      },
      linkChanged: function(target) {
        // 每次被移动后执行，target是custom-ul节点实例对象，触发在moved生命周期之后
      },
      unlinked: function(target) {
        // 每次被移除时执行，target是custom-ul节点实例对象，触发在detached生命周期之后
      }
    }
  }
})
```

**注意：必须在两个组件定义中都加入relations定义，否则不会生效。**

## 关联一类组件

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/LFEVaqmh6zYU)

有时，需要关联的是一类组件，如：

```html
<custom-form>
  <view>
    input
    <custom-input></custom-input>
  </view>
  <custom-submit> submit </custom-submit>
</custom-form>
```

`custom-form` 组件想要关联 `custom-input` 和 `custom-submit` 两个组件。此时，如果这两个组件都有同一个behavior：

```js
// path/to/custom-form-controls.js
module.exports = Behavior({
  // ...
})
```

```js
// path/to/custom-input.js
var customFormControls = require('./custom-form-controls')
Component({
  behaviors: [customFormControls],
  relations: {
    './custom-form': {
      type: 'ancestor', // 关联的目标节点应为祖先节点
    }
  }
})
```

```js
// path/to/custom-submit.js
var customFormControls = require('./custom-form-controls')
Component({
  behaviors: [customFormControls],
  relations: {
    './custom-form': {
      type: 'ancestor', // 关联的目标节点应为祖先节点
    }
  }
})
```

则在 `relations` 关系定义中，可使用这个behavior来代替组件路径作为关联的目标节点：

```js
// path/to/custom-form.js
var customFormControls = require('./custom-form-controls')
Component({
  relations: {
    'customFormControls': {
      type: 'descendant', // 关联的目标节点应为子孙节点
      target: customFormControls
    }
  }
})
```

## relations 定义段

`relations` 定义段包含目标组件路径及其对应选项，可包含的选项见下表。

<table><thead><tr><th>选项</th> <th>类型</th> <th>是否必填</th> <th>描述</th></tr></thead> <tbody><tr><td>type</td> <td>String</td> <td>是</td> <td>目标组件的相对关系，可选的值为 <code>parent</code> 、 <code>child</code> 、 <code>ancestor</code> 、 <code>descendant</code></td></tr> <tr><td>linked</td> <td>Function</td> <td>否</td> <td>关系生命周期函数，当关系被建立在页面节点树中时触发，触发时机在组件attached生命周期之后</td></tr> <tr><td>linkChanged</td> <td>Function</td> <td>否</td> <td>关系生命周期函数，当关系在页面节点树中发生改变时触发，触发时机在组件moved生命周期之后</td></tr> <tr><td>unlinked</td> <td>Function</td> <td>否</td> <td>关系生命周期函数，当关系脱离页面节点树时触发，触发时机在组件detached生命周期之后</td></tr> <tr><td>target</td> <td>String</td> <td>否</td> <td>如果这一项被设置，则它表示关联的目标节点所应具有的behavior，所有拥有这一behavior的组件节点都会被关联</td></tr></tbody></table>
