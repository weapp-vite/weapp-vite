<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/observer.html -->

# 数据监听器

数据监听器可以用于监听和响应任何属性和数据字段的变化。从小程序基础库版本 [2.6.1](../compatibility.md) 开始支持。

## 使用数据监听器

有时，在一些数据字段被 setData 设置时，需要执行一些操作。

例如， `this.data.sum` 永远是 `this.data.numberA` 与 `this.data.numberB` 的和。此时，可以使用数据监听器进行如下实现。

```js
Component({
  attached: function() {
    this.setData({
      numberA: 1,
      numberB: 2,
    })
  },
  observers: {
    'numberA, numberB': function(numberA, numberB) {
      // 在 numberA 或者 numberB 被设置时，执行这个函数
      this.setData({
        sum: numberA + numberB
      })
    }
  }
})
```

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/FUZF9ams7g6N)

## 监听字段语法

数据监听器支持监听属性或内部数据的变化，可以同时监听多个。一次 setData 最多触发每个监听器一次。

同时，监听器可以监听子数据字段，如下例所示。

```js
Component({
  observers: {
    'some.subfield': function(subfield) {
      // 使用 setData 设置 this.data.some.subfield 时触发
      // （除此以外，使用 setData 设置 this.data.some 也会触发）
      subfield === this.data.some.subfield
    },
    'arr[12]': function(arr12) {
      // 使用 setData 设置 this.data.arr[12] 时触发
      // （除此以外，使用 setData 设置 this.data.arr 也会触发）
      arr12 === this.data.arr[12]
    },
  }
})
```

如果需要监听所有子数据字段的变化，可以使用通配符 `**` 。

```js
Component({
  observers: {
    'some.field.**': function(field) {
      // 使用 setData 设置 this.data.some.field 本身或其下任何子数据字段时触发
      // （除此以外，使用 setData 设置 this.data.some 也会触发）
      field === this.data.some.field
    },
  },
  attached: function() {
    // 这样会触发上面的 observer
    this.setData({
      'some.field': { /* ... */ }
    })
    // 这样也会触发上面的 observer
    this.setData({
      'some.field.xxx': { /* ... */ }
    })
    // 这样还是会触发上面的 observer
    this.setData({
      'some': { /* ... */ }
    })
  }
})
```

特别地，仅使用通配符 `**` 可以监听全部 setData 。

```js
Component({
  observers: {
    '**': function() {
      // 每次 setData 都触发
    },
  },
})
```

## 注意事项

- 数据监听器监听的是 setData 涉及到的数据字段，即使这些数据字段的值没有发生变化，数据监听器依然会被触发。
- 如果在数据监听器函数中使用 setData 设置本身监听的数据字段，可能会导致死循环，需要特别留意。
- 数据监听器和属性的 observer 相比，数据监听器更强大且通常具有更好的性能。
