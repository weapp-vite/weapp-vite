<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/chaining-api-init.html -->

# Chaining API 的 init 函数

> 由于目前 glass-easel 组件框架仅可用于 [Skyline 渲染引擎](../../runtime/skyline/introduction.md) ，因此这些特性也同样受此限制。

## init 链式调用项

在 Chaining API 中支持 `.init(...)` 链式调用项，可以以另一种方式进行组件创建：

```js
Component()
  .data(() => ({
    myDataField: 'someValue',
  }))
  .init(function ({ lifetime }) {
    // 这里可以用 JavaScript 局部量
    const getUpdatedValue = () => {
      return 'updated'
    }

    // 定义一个生命周期方法
    lifetime('attached', () => {
      this.setData({ myDataField: getUpdatedValue() })
    })
  })
  .register()
```

init 中定义的函数会在每次组件创建时被调用一次。

这种方式的主要好处是在其内部可以自由使用 JavaScript 局部变量，减少对组件 `this` 的使用，有时会很方便。

## init 函数中的辅助方法

init 的第一个参数包含多个辅助方法，可以用于组件定义。

`method` 用来定义单个方法，等价于传统形式的 `methods` 定义段中的单个项目。不过，它通常只用来定义事件响应函数，而且在末尾需要返回出来。例如：

```js
Component()
  .init(function ({ method }) {
    const tapHandler = method(() => {
      /* ... */
    })
    return { tapHandler }
  })
  .register()
```

`lifetime` 和 `pageLifetime` 分别用来定义单个生命周期方法和组件所在页面的生命周期方法，等价于传统形式的 `lifetime` 和 `pageLifetime` 定义段中的单个项目。例如：

```js
Component()
  .init(function ({ lifetime, pageLifetime }) {
    lifetime('attached', () => { /* ... */ })
    pageLifetime('show', () => { /* ... */ })
  })
  .register()
```

`observer` 用来定义单个数据监听器，类似于传统形式的 `observers` 定义段中的单个项目，但在同时监听多个数据字段时，应写成数组形式。例如：

```js
Component()
  .data(() => ({
    a: 1,
    b: 2,
  }))
  .init(function ({ observer }) {
    observer(['a', 'b'], () => { /* ... */ })
  })
  .register()
```

`relation` 用来定义单个组件间关系项，等价于传统形式的 `relations` 定义段中的单个项目。例如：

```js
Component()
  .init(function ({ relation }) {
    relation('another-component', {
      type: 'parent',
    })
  })
  .register()
```

需要注意的是，上面这些方法都不能异步或延迟执行，否则会报错：

```js
Component()
  .init(function ({ lifetime }) {
    setTimeout(() => {
      // 不能这么做！
      lifetime('attached', () => { /* ... */ })
    }, 0)
  })
  .register()
```

此外，第一个参数中还包含有 `data` 和 `setData` ，可以用来快速访问和设置数据。例如：

```js
Component()
  .data(() => ({
    myDataField: 'someValue',
  }))
  .init(function ({ lifetime, data, setData }) {
    lifetime('attached', () => {
      setData({
        myDataField: data.myDataField + ' updated',
      })
    })
  })
  .register()
```

但要注意 data 和 setData 只应在各个回调函数中使用，下面这样做会报错：

```js
Component()
  .init(function ({ setData }) {
    setData({ /* ... */ })
  })
  .register()
```
