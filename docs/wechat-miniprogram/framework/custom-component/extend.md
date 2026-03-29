<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/extend.html -->

# 自定义组件扩展

为了更好定制自定义组件的功能，可以使用自定义组件扩展机制。从小程序基础库版本 [2.2.3](../compatibility.md) 开始支持。

## 扩展后的效果

为了更好的理解扩展后的效果，先举一个例子：

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/STePQRmH7Q5H)

```js
// behavior.js
module.exports = Behavior({
  definitionFilter(defFields) {
    defFields.data.from = 'behavior'
  },
})

// component.js
Component({
  data: {
    from: 'component'
  },
  behaviors: [require('behavior.js')],
  ready() {
    console.log(this.data.from) // 此处会发现输出 behavior 而不是 component
  }
})
```

通过例子可以发现，自定义组件的扩展其实就是提供了修改自定义组件定义段的能力，上述例子就是修改了自定义组件中的 `data` 定义段里的内容。

## 使用扩展

`Behavior()` 构造器提供了新的定义段 `definitionFilter` ，用于支持自定义组件扩展。 `definitionFilter` 是一个函数，在被调用时会注入两个参数，第一个参数是使用该 behavior 的 component/behavior 的定义对象，第二个参数是该 behavior 所使用的 behavior 的 `definitionFilter` 函数列表。

以下举个例子来说明：

```js
// behavior3.js
module.exports = Behavior({
    definitionFilter(defFields, definitionFilterArr) {},
})

// behavior2.js
module.exports = Behavior({
  behaviors: [require('behavior3.js')],
  definitionFilter(defFields, definitionFilterArr) {
    // definitionFilterArr[0](defFields)
  },
})

// behavior1.js
module.exports = Behavior({
  behaviors: [require('behavior2.js')],
  definitionFilter(defFields, definitionFilterArr) {},
})

// component.js
Component({
  behaviors: [require('behavior1.js')],
})
```

上述代码中声明了1个自定义组件和3个 behavior，每个 behavior 都使用了 `definitionFilter` 定义段。那么按照声明的顺序会有如下事情发生：

1. 当进行 behavior2 的声明时就会调用 behavior3 的 `definitionFilter` 函数，其中 `defFields` 参数是 behavior2 的定义段， `definitionFilterArr` 参数即为空数组，因为 behavior3 没有使用其他的 behavior 。
2. 当进行 behavior1 的声明时就会调用 behavior2 的 `definitionFilter` 函数，其中 `defFields` 参数是 behavior1 的定义段， `definitionFilterArr` 参数是一个长度为1的数组， `definitionFilterArr[0]` 即为 behavior3 的 `definitionFilter` 函数，因为 behavior2 使用了 behavior3。用户在此处可以自行决定在进行 behavior1 的声明时要不要调用 behavior3 的 `definitionFilter` 函数，如果需要调用，在此处补充代码 `definitionFilterArr[0](defFields)` 即可， `definitionFilterArr` 参数会由基础库补充传入。
3. 同理，在进行 component 的声明时就会调用 behavior1 的 `definitionFilter` 函数。

简单概括， `definitionFilter` 函数可以理解为当 A 使用了 B 时，A 声明就会调用 B 的 `definitionFilter` 函数并传入 A 的定义对象让 B 去过滤。此时如果 B 还使用了 C 和 D ，那么 B 可以自行决定要不要调用 C 和 D 的 `definitionFilter` 函数去过滤 A 的定义对象。

**代码示例：**

[在开发者工具中预览效果](https://developers.weixin.qq.com/s/WaqPbxmN7E1j)

## 真实案例

下面利用扩展简单实现自定义组件的计算属性功能:

```js
// behavior.js
module.exports = Behavior({
  lifetimes: {
    created() {
      this._originalSetData = this.setData // 原始 setData
      this.setData = this._setData // 封装后的 setData
    }
  },
  definitionFilter(defFields) {
    const computed = defFields.computed || {}
    const computedKeys = Object.keys(computed)
    const computedCache = {}

    // 计算 computed
    const calcComputed = (scope, insertToData) => {
      const needUpdate = {}
      const data = defFields.data = defFields.data || {}

      for (let key of computedKeys) {
        const value = computed[key].call(scope) // 计算新值
        if (computedCache[key] !== value) needUpdate[key] = computedCache[key] = value
        if (insertToData) data[key] = needUpdate[key] // 直接插入到 data 中，初始化时才需要的操作
      }

      return needUpdate
    }

    // 重写 setData 方法
    defFields.methods = defFields.methods || {}
    defFields.methods._setData = function (data, callback) {
      const originalSetData = this._originalSetData // 原始 setData
      originalSetData.call(this, data, callback) // 做 data 的 setData
      const needUpdate = calcComputed(this) // 计算 computed
      originalSetData.call(this, needUpdate) // 做 computed 的 setData
    }

    // 初始化 computed
    calcComputed(defFields, true) // 计算 computed
  }
})
```

在组件中使用：

```js
const beh = require('./behavior.js')
Component({
  behaviors: [beh],
  data: {
    a: 0,
  },
  computed: {
    b() {
      return this.data.a + 100
    },
  },
  methods: {
    onTap() {
      this.setData({
        a: ++this.data.a,
      })
    }
  }
})
```

```xml
<view>data: {{a}}</view>
<view>computed: {{b}}</view>
<button bindtap="onTap">click</button>
```

实现原理很简单，对已有的 setData 进行二次封装，在每次 setData 的时候计算出 computed 里各字段的值，然后设到 data 中，以达到计算属性的效果。

> 此实现只是作为一个简单案例来展示，请勿直接在生产环境中使用。

## 官方扩展包

- [computed](https://github.com/wechat-miniprogram/computed)
