<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/custom-component/unit-test.html -->

# 单元测试

在编写高质量的自定义组件过程中，单元测试是永远避不开的一个话题。完善的测试用例是提高自定义组件可用性的保证，同时测试代码覆盖率也是必不可少的一个环节。小程序从基础库版本 [2.2.1](../compatibility.md) 开始拥抱开源，支持使用 npm 安装自定义组件，那针对自定义组件的单元测试也是必须支持的。

以下就来介绍如何对自定义组件进行单元测试。

## 测试框架

现在市面上流行的测试框架均可使用，只要它能兼顾 nodejs 端和 dom 环境。因为我们需要依赖到 nodejs 的一些库来完善测试环境，同时 dom 环境也是必须的，因为我们需要建成完整的 dom 树结构，才能更好的模拟自定义组件的运行。例如可以选用 mocha + jsdom 的组合，亦可选用 jest，下述例子选用 jest 作为测试框架来说明。

## 自定义组件测试工具集

小程序的运行环境比较特殊，不同于常见的浏览器环境，它采用的是双线程的架构。而在进行单元测试时，我们并不需要用到这样复杂的架构带来的利好，我们进行的是功能测试而无需苛求性能、安全等因素，因此我们提供了一个测试工具集以支持自定义组件在 nodejs 单线程中也能运行起来。

我们先安装一下测试工具集—— [miniprogram-simulate](https://github.com/wechat-miniprogram/miniprogram-simulate) ：

```
npm i --save-dev miniprogram-simulate
```

## 编写测试用例

假设我们有如下自定义组件：

```html
<!-- /components/index.wmxl -->
<view class="index">{{prop}}</view>
```

```js
// /components/index.js
Component({
  properties: {
    prop: {
      type: String,
      value: 'index.properties'
    },
  },
})
```

```css
/* /components/index.wxss */
.index {
  color: green;
}
```

我们想要测试渲染的结果，可以按照如下方式编写测试用例：

```js
// /test/components/index.test.js
const simulate = require('miniprogram-simulate')

test('components/index', () => {
    const id = simulate.load('/components/index') // 此处必须传入绝对路径
    const comp = simulate.render(id) // 渲染成自定义组件树实例

    const parent = document.createElement('parent-wrapper') // 创建父亲节点
    comp.attach(parent) // attach 到父亲节点上，此时会触发自定义组件的 attached 钩子

    const view = comp.querySelector('.index') // 获取子组件 view
    expect(view.dom.innerHTML).toBe('index.properties') // 测试渲染结果
    expect(window.getComputedStyle(view.dom).color).toBe('green') // 测试渲染结果
})
```

> PS：测试工具集中的 wx 对象和内置组件都不会实现真正的功能，如果需要测试一些特殊场景的话，可以自行覆盖掉测试工具集中的 api 接口和内置组件。
>
> PS：目前因为有部分自定义组件功能仍未支持（如抽象节点等），故测试工具暂无法全部覆盖自定义组件的特性，后续会继续完善。

测试工具集中提供了一些方便测试的接口，比如：

- 模拟 touch 事件、自定义事件触发
- 选取子节点
- 更新自定义组件数据
- 触发生命周期
- ...

更多详细的用法可以参阅 [github 仓库](https://github.com/wechat-miniprogram/miniprogram-simulate) 上的文档。
