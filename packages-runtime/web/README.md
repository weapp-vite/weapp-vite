# @weapp-vite/web

实验性的 H5 运行时与工具集，为 `weapp-vite` 工程提供最小化的浏览器适配能力：

- 将 `wxml` 模板编译为渲染函数，并在 Web Components 中渲染
- 支持 `wx` / `a` / `tt` / `s` 前缀的条件与循环指令，以及插值语法等常见模板语法糖
- 将小程序 `Page` / `Component` 映射为自定义元素，Shadow DOM 隔离样式与事件
- 事件桥接（如 `bindtap` → `click`），保留 `this.setData`、`this.triggerEvent` 等调用体验
- 提供宿主中立的小程序桥，并兼容 `wx.navigateTo` / `my.navigateTo` / `tt.navigateTo` 等路由调用，以及 `getCurrentPages`、`onLoad`、`onShow`、`onHide`、`onUnload` 生命周期
- `App` 级别的 `onLaunch` / `onShow` 回调、`getApp` 全局实例访问
- 为 `view`、`text`、`image`、`button`、`input`、`scroll-view`、`navigator`、`swiper` / `swiper-item`、picker、slider 及常用表单组件提供保留小程序语义的 Web Components 适配
- 使用 PostCSS 转换 WXSS 选择器，支持 `page`、原生组件类型选择器、组合选择器和伪类
- `rpx` 根据实际设备容器宽度动态计算；默认宽屏下使用 375px 居中设备视口
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

## 设备视口

默认配置模拟小程序页面视口：移动宽度下铺满，浏览器宽度达到 600px 后使用 375px 居中容器。页面、导航栏、`fixed` 元素和 `rpx` 共用这一区域。

```ts
weappWebPlugin({
  runtime: {
    viewport: {
      mode: 'mini-program',
      maxWidth: 375,
      desktopBreakpoint: 600,
    },
  },
})
```

已有项目需要保留浏览器全宽布局时，设置 `runtime.viewport.mode: 'responsive'`。

## 组件兼容

- `image.mode` 会映射到浏览器的 `object-fit` / `object-position`。
- `input` 同步 `name`、`value`、`placeholder`、`disabled`、`password`、`maxlength`、`focus`，并发送小程序形状的 `input` / `focus` / `blur` / `confirm` 事件。
- `scroll-view` 支持横纵滚动、初始滚动位置及带 `scrollLeft`、`scrollTop`、`deltaX`、`deltaY` 的 `scroll` 事件。
- `form` 统一收集带 `name` 的可用控件值，支持 `button form-type="submit|reset"`、`submit` / `reset` 事件及初始状态恢复。
- `label` 支持通过 `for` 关联控件，也支持包裹 `input`、`textarea`、`checkbox`、`radio`、`switch` 触发聚焦或选择。
- `textarea`、`checkbox-group` / `checkbox`、`radio-group` / `radio`、`switch` 支持常用属性、表单值和微信形状的交互事件；脚本同步属性不会误发 `change`。
- `navigator` 复用页面栈路由，支持 `navigate`、`redirect`、`switchTab`、`reLaunch`、`navigateBack`；`target="miniProgram"` 复用 `navigateToMiniProgram` / `exitMiniProgram` 及其回调。
- `swiper` / `swiper-item` 支持 current、item-id、横纵布局、循环、指示点、边距、触摸切换和 autoplay，并发送微信形状的 `change`、`transition`、`animationfinish` 事件；组件断开连接时会停止计时器。
- `picker` 支持 selector、multiSelector、date、time 与 region 模式，selector 可使用 `range-key`，并发送 `change`、`cancel`、`columnchange` 事件；region 在 Web 上仅提供当前层级文本编辑，`code` / `postcode` 不包含行政区数据。
- `picker-view` / `picker-view-column` 支持受控 value、滚动吸附、mask / indicator 样式及 `change`、`pickstart`、`pickend` 事件。
- `slider` 支持 min、max、step、value、颜色、block-size、show-value、disabled 与表单值，并发送 `changing` / `change` 事件。
- 其他已识别但尚未完整适配的原生组件会继续渲染，并输出去重兼容告警。

## 页面栈与生命周期

- `navigateTo` 会保留原页面 DOM、实例和数据，并依次触发原页面 `onHide` 与新页面 `onLoad` / `onShow`。
- `navigateBack` 只卸载出栈页面，恢复目标页面的同一实例、`onShow` 和页面容器滚动位置，不会重新触发 `onLoad`。
- `redirectTo` 只替换并卸载当前页面；`reLaunch` 会从栈顶开始卸载全部旧页面后挂载目标页面。
- `getCurrentPages()` 返回当前所有存活页面；路由 API 支持 `success` / `fail` / `complete` 回调与 Promise 结果。

仓库中的 `pnpm e2e:web:update-baselines` 只用于维护者显式刷新微信 DevTools 视觉基线；普通 `pnpm e2e:web` 只读取已提交基线。

## TODO

- 更全面的模板语法和原生组件语义
- 继续扩展组件属性系统和页面级滚动事件
- 全局 API 兼容层与更精细的样式适配
- SSR、SEO 友好的页面容器与首屏优化
