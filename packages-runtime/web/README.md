# @weapp-vite/web

实验性的 H5 运行时与工具集，为 `weapp-vite` 工程提供最小化的浏览器适配能力：

- 将 `wxml` 模板编译为渲染函数，并在 Web Components 中渲染
- 支持 `wx:if` / `wx:elif` / `wx:else`、`wx:for`、插值语法等常见语法糖
- 将小程序 `Page` / `Component` 映射为自定义元素，Shadow DOM 隔离样式与事件
- 事件桥接（如 `bindtap` → `click`），保留 `this.setData`、`this.triggerEvent` 等调用体验
- `wx.navigateTo` / `wx.navigateBack` / `getCurrentPages` 等路由 API，以及 `onLoad`、`onShow`、`onHide`、`onUnload` 生命周期
- `App` 级别的 `onLaunch` / `onShow` 回调、`getApp` 全局实例访问
- `wxss` → `css` 的基础转换，默认按 `1rpx = 0.5px`
- 提供 Vite 插件，自动把 `.wxml` / `.wxss` 转换为 Web 侧模块

> ⚠️ 当前阶段为 POC，功能与兼容性都较有限，只适合验证思路。

## 快速开始

```ts
import { defineComponent } from '@weapp-vite/web'
import template from './index.wxml'
import style from './index.wxss'

defineComponent('wv-hello-world', {
  template,
  style,
  component: {
    properties: {
      title: { type: String, value: 'Hello weapp-vite' },
    },
    data: () => ({
      description: '欢迎使用 weapp-vite 模板。',
    }),
    methods: {
      copyLink(event) {
        const url = event.currentTarget.dataset.url
        this.setData({ url })
        this.triggerEvent('copied', { url })
      },
    },
  },
})

document.body.innerHTML = '<wv-hello-world title="文档地址"></wv-hello-world>'
```

## TODO

- 更全面的模板语法（`slot`、`wx:import` 等）
- 丰富组件属性系统、支持 behaviors / observers
- 全局 API 兼容层与更精细的样式适配
- SSR、SEO 友好的页面容器与首屏优化
