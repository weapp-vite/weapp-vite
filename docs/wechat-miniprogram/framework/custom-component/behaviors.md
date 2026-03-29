<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/behaviors.html -->

# behaviors

`behaviors` 是用于组件间代码共享的特性，类似于一些编程语言中的 “mixins” 或 “traits”。

每个 `behavior` 可以包含一组属性、数据、生命周期函数和方法。 **组件引用它时，它的属性、数据和方法会被合并到组件中，生命周期函数也会在对应时机被调用。** 每个组件可以引用多个 `behavior` ， `behavior` 也可以引用其它 `behavior` 。

详细的参数含义和使用请参考 [Behavior 参考文档](https://developers.weixin.qq.com/miniprogram/dev/reference/api/Behavior.html) 。

## 组件中使用

组件引用时，在 `behaviors` 定义段中将它们逐个列出即可。

**代码示例：**

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/Yq4RqCm87thO)

```js
// my-component.js
var myBehavior = require('my-behavior')
Component({
  behaviors: [myBehavior],
  properties: {
    myProperty: {
      type: String
    }
  },
  data: {
    myData: 'my-component-data'
  },
  created: function () {
    console.log('[my-component] created')
  },
  attached: function () {
    console.log('[my-component] attached')
  },
  ready: function () {
    console.log('[my-component] ready')
  },
  methods: {
    myMethod: function () {
      console.log('[my-component] log by myMethod')
    },
  }
})
```

在上例中， `my-component` 组件定义中加入了 `my-behavior` ，

而 `my-behavior` 结构为：

- 属性： `myBehaviorProperty`
- 数据字段： `myBehaviorData`
- 方法： `myBehaviorMethod`
- 生命周期函数： `attached` 、 `created` 、 `ready`

这将使 `my-component` 最终结构为：

- 属性： `myBehaviorProperty` 、 `myProperty`
- 数据字段： `myBehaviorData` 、 `myData`
- 方法： `myBehaviorMethod` 、 `myMethod`
- 生命周期函数： `attached` 、 `created` 、 `ready`

当组件触发生命周期时，上例生命周期函数执行顺序为：

1. `[my-behavior] created`
2. `[my-component] created`
3. `[my-behavior] attached`
4. `[my-component] attached`
5. `[my-behavior] ready`
6. `[my-component] ready`

详细规则参考 **同名字段的覆盖和组合规则** 。

## 同名字段的覆盖和组合规则

组件和它引用的 `behavior` 中可以包含同名的字段，对这些字段的处理方法如下：

- 如果有同名的属性 (properties) 或方法 (methods)：
    1. 若组件本身有这个属性或方法，则组件的属性或方法会覆盖 `behavior` 中的同名属性或方法；
    2. 若组件本身无这个属性或方法，则在组件的 `behaviors` 字段中定义靠后的 `behavior` 的属性或方法会覆盖靠前的同名属性或方法；
    3. 在 2 的基础上，若存在嵌套引用 `behavior` 的情况，则规则为： `引用者 behavior` 覆盖 `被引用的 behavior` 中的同名属性或方法。
- 如果有同名的数据字段 (data)：
    - 若同名的数据字段都是对象类型，会进行对象合并；
    - 其余情况会进行数据覆盖，覆盖规则为： `引用者 behavior` > `被引用的 behavior` 、 `靠后的 behavior` > `靠前的 behavior` 。（优先级高的覆盖优先级低的，最大的为优先级最高）
- 生命周期函数和 observers 不会相互覆盖，而是在对应触发时机被逐个调用：
    - 对于不同的生命周期函数之间，遵循组件生命周期函数的执行顺序；
    - 对于同种生命周期函数和同字段 observers ，遵循如下规则：
          - `behavior` 优先于组件执行；
          - `被引用的 behavior` 优先于 `引用者 behavior` 执行；
          - `靠前的 behavior` 优先于 `靠后的 behavior` 执行；
    - 如果同一个 `behavior` 被一个组件多次引用，它定义的生命周期函数和 observers 不会重复执行。

**代码示例：**

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/CI5omDmT7khB)

## 内置 behaviors

自定义组件可以通过引用内置的 `behavior` 来获得内置组件的一些行为。

```js
Component({
  behaviors: ['wx://form-field']
})
```

在上例中， `wx://form-field` 代表一个内置 `behavior` ，它使得这个自定义组件有类似于表单控件的行为。

内置 `behavior` 往往会为组件添加一些属性。在没有特殊说明时，组件可以覆盖这些属性来改变它的 `type` 或添加 `observer` 。

### wx://form-field

使自定义组件有类似于表单控件的行为。 form 组件可以识别这些自定义组件，并在 submit 事件中返回组件的字段名及其对应字段值。

详细用法以及代码示例可见： [form 组件参考文档](https://developers.weixin.qq.com/miniprogram/dev/component/form)

### wx://form-field-group

从基础库版本 [2.10.2](../compatibility.md) 开始提供支持。

使 form 组件可以识别到这个自定义组件内部的所有表单控件。

详细用法以及代码示例可见： [form 组件参考文档](https://developers.weixin.qq.com/miniprogram/dev/component/form)

### wx://form-field-button

从基础库版本 [2.10.3](../compatibility.md) 开始提供支持。

使 form 组件可以识别到这个自定义组件内部的 button 。如果自定义组件内部有设置了 form-type 的 button ，它将被组件外的 form 接受。

详细用法以及代码示例可见： [form 组件参考文档](https://developers.weixin.qq.com/miniprogram/dev/component/form)

### wx://component-export

从基础库版本 [2.2.3](../compatibility.md) 开始提供支持。

使自定义组件支持 `export` 定义段。这个定义段可以用于指定组件被 `selectComponent` 调用时的返回值。

详细用法以及代码示例可见： [selectComponent 参考文档](./events/README.md)
