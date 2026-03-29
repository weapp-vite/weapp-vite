<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/chaining-api.html -->

# Chaining API

> 由于目前 glass-easel 组件框架仅可用于 [Skyline 渲染引擎](../../runtime/skyline/introduction.md) ，因此这些特性也同样受此限制。

## Chaining API 接口形式

Chaining API 是一种新的页面和自定义组件定义形式。

对于一个传统的自定义组件定义：

```js
Component({
  properties: {
    myProperty: String,
    myAnotherProperty: String,
  },
  data: {
    myDataField: 'someValue',
  },
})
```

它可以被等价地写成以下 Chaining API 形式：

```js
Component()
  .property('myProperty', String)
  .property('myAnotherProperty', String)
  .data(() => ({
    myDataField: 'someValue',
  }))
  .register()
```

使用 Chaining API 的主要好处是它具有更好的 TypeScript 支持，且对于复杂组件更加友好，还可以配合 [init 函数](./chaining-api-init.md) 来使用。但它也使得对简单组件的定义看起来稍显繁琐。

因而，每个组件都可以分别选用传统的定义方式或者 Chaining API 来进行定义，可以对于每个组件都选用更合适它的定义方式。

## 常用的链式调用项

以下是一些常用链式调用项。

`.property` 用来定义单个属性，等价于传统形式的 `properties` 定义段中的单个项目。例如：

```js
Component()
  .property('myProperty', {
    type: String
  })
  .register()
```

`.data` 用来定义数据字段表，作用上相当于传统形式的 `data` 定义段，但它接受一个函数。这个函数在每次组件创建时执行一次，它的返回值被用作数据字段。例如：

```js
Component()
  .data(() => ({
    myDataField: 'someValue',
  }))
  .register()
```

`.externalClasses` 用来定义外部样式类，等价于传统形式的 `externalClasses` 定义段。例如：

```js
Component()
  .externalClasses(['my-class'])
  .register()
```

`.options` 用来指定组件选项，等价于传统形式的 `options` 定义段。（注意，如果多次调用，仅有最后一次调用有效。）例如：

```js
Component()
  .options({
    multipleSlots: true,
  })
  .register()
```

`.options` 用来指定组件选项，等价于传统形式的 `options` 定义段。（注意，如果多次调用，仅有最后一次调用有效。）例如：

```js
Component()
  .options({
    multipleSlots: true,
  })
  .register()
```

以下链式调用项也是可用的，但通过 [init 函数](./chaining-api-init.md) 来调用通常更加友好。

`.methods` 用来定义一组方法，等价于传统形式的 `methods` 定义段。例如：

```js
Component()
  .methods({
    myMethod() { /* ... */ }
  })
  .register()
```

`.lifetime` 和 `.pageLifetime` 分别用来定义单个生命周期方法和组件所在页面的生命周期方法，等价于传统形式的 `lifetime` 和 `pageLifetime` 定义段中的单个项目。例如：

```js
Component()
  .lifetime('attached', function () { /* ... */ })
  .pageLifetime('show', function () { /* ... */ })
  .register()
```

`.observer` 用来定义单个数据监听器，类似于传统形式的 `observers` 定义段中的单个项目，但在同时监听多个数据字段时，应写成数组形式。例如：

```js
Component()
  .data(() => ({
    a: 1,
    b: 2,
  }))
  .observer(['a', 'b'], function () { /* ... */ })
  .register()
```

`.relation` 用来定义单个组件间关系项，等价于传统形式的 `relations` 定义段中的单个项目。例如：

```js
Component()
  .relation('another-component', {
    type: 'parent',
  })
  .register()
```

## 在链式调用项中使用 behavior

类似地， `Behavior` 也支持 Chaining API 。例如：

```js
const beh = Behavior()
  .property('myProperty', String)
  .register()
```

这样，在组件中，可以使用 `.behavior` 将其引入：

```js
Component()
  .behavior(beh)
  .register()
```

需要注意的是，引入 behavior 导致出现了重复的同名属性或同名数据字段时， TypeScript 将会报出类型错误。

## 重复使用链式调用项

除了 `options` 和 `export` ，其他链式调用项都可以重复调用多次，调用结果会组合起来。

这样可以把复杂的组件拆解成好几个部分来定义，对于很复杂的组件定义会有帮助。

```js
Component()
  // 定义 myDataField 字段和相关的处理逻辑
  .data(() => ({
    myDataField: 'someValue',
  }))
  .lifetime('attached', function () {
    this.setData({ myDataField: updatedValue })
  })
  // 定义 anotherField 字段和相关的处理逻辑
  .data(() => ({
    anotherField: 1,
  }))
  .lifetime('attached', function () {
    this.setData({ anotherField: updatedValue })
  })
  .register()
```

## 非连续链式调用

链式调用项也可以分开写。例如：

```js
const componentDefinition = Component()
componentDefinition.property('myProperty', String)
componentDefinition.data(() => ({
  myDataField: 'someValue',
}))
componentDefinition.register()
```

但这样写会丢失部分 TypeScript 类型信息。这种做法比较适合制作中间件、将 `Component()` 封装成别的形式的调用时。手工编写代码时并不建议这么做。
