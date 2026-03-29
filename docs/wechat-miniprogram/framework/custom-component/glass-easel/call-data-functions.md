<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/glass-easel/call-data-functions.html -->

# 在模板中调用 data 里的函数

> 由于目前 glass-easel 组件框架仅可用于 [Skyline 渲染引擎](../../runtime/skyline/introduction.md) ，因此这些特性也同样受此限制。

如果 data 中的某个字段是函数，在模板里可以直接调用它：

```js
Component({
  data: {
    getDataField() {
      return 'someValue'
    },
  },
})
```

```xml
<view>{{ getDataField() }}</view>
```

尽管这样做有时会很方便，在实践中依然不建议滥用。

从代码可维护性的角度看， `data` 中的内容应当与数据内容强相关。如果函数的主要目的是对数据展示方面的预处理，推荐用 [WXS](../../view/wxs/README.md) 的方式，将函数实现内联在模版中。
