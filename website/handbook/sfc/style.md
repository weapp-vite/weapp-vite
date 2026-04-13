---
title: 样式和资源怎么处理
description: SFC 里的样式怎么落到 WXSS、scoped 的真实行为、预处理器怎么选、图片和字体怎么引用。
keywords:
  - handbook
  - sfc
  - style
  - wxss
  - scoped
  - 图片
  - 资源
---

# 样式和资源怎么处理

小程序里写样式，最容易踩的坑不是"不会写 CSS"，而是以为和浏览器里一模一样。

## 样式最终会变成 WXSS

你在 `.vue` 里写的 `<style>`，构建后会变成 `.wxss` 文件。所以有两层约束要同时考虑：

- 你用的预处理器（SCSS / Less）的能力
- 小程序 WXSS 本身的能力

## scoped 是怎么回事

`scoped` 不是浏览器的 Shadow DOM，是编译期的选择器改写：给当前组件的元素加一个唯一属性（`data-v-xxxxx`），选择器也加上这个属性。

效果是同名 class 不会跨组件污染。但如果你想在父组件里改子组件的样式，会被 scoped 挡住。需要穿透的话用 `:deep()`：

```vue
<style scoped>
.parent :deep(.child-inner) {
  color: red;
}
</style>
```

全局样式（比如 `app.vue` 里的基础样式）不需要 scoped：

```vue
<!-- app.vue -->
<style>
page {
  font-size: 28rpx;
  color: #333;
  background: #f5f5f5;
}
</style>
```

## 小程序对 CSS 的限制

### 选择器

这些是安全的：`.class`、`#id`、`.parent .child`、`.parent > .child`、`::after`、`::before`。

这些要小心：`:nth-child()`、`:first-child`（部分基础库不支持）、`*`（通配符）。

### 不一定能用的 CSS

- `position: fixed` 在某些场景表现不同
- `z-index` 在原生组件上可能失效
- `vh` / `vw` 支持有限，用 `rpx` 更稳
- CSS 变量（`var()`）需要较新的基础库
- `backdrop-filter`、复杂 `grid` 布局可能不支持

### rpx 是主力单位

```css
/* 750rpx = 屏幕宽度 */
.container {
  padding: 32rpx;
  font-size: 28rpx;
}
```

## 预处理器

团队统一选一种就好，不要混用。推荐 SCSS：

```vue
<style lang="scss" scoped>
$primary: #1890ff;

.card {
  padding: 24rpx;
  background: #fff;

  &-title {
    font-size: 32rpx;
    color: $primary;
  }
}
</style>
```

## 样式怎么组织

- 全局基础样式放 `app.vue`（不加 scoped）
- 页面样式加 scoped
- 组件样式加 scoped

```vue
<!-- components/goods-card/index.vue -->
<style lang="scss" scoped>
.goods-card {
  display: flex;
  padding: 24rpx;

  &__title {
    font-size: 28rpx;
  }

  &__price {
    color: #ff4d4f;
  }
}
</style>
```

## 图片怎么引用

### 小图片：放在页面或组件旁边

```txt
pages/order-detail/
├─ index.vue
└─ assets/
   └─ status-paid.png
```

```ts
import statusPaid from './assets/status-paid.png'
```

好处是页面下线的时候资源一起删，不会留垃圾。

### 跨页面复用的图片：放 `src/assets/`

```txt
src/assets/images/
├─ logo.png
├─ empty-state.png
└─ default-avatar.png
```

### 大图：走 CDN

小程序包体有大小限制，大图不要打包进去：

```vue
<image
  src="https://cdn.example.com/images/banner.jpg"
  mode="aspectFill"
  lazy-load
/>
```

CDN 域名要在小程序后台配白名单。

### 分包里的图片

分包页面引用主包的图片，构建后路径可能会错。稳妥的做法：

- 分包专属的图片放在分包目录里
- 真正共享的图片走 CDN 或放在明确的共享目录

## 字体

小图标推荐用 iconfont 的 base64 方式，或者直接用小图片代替。

自定义字体可以运行时加载：

```ts
wx.loadFontFace({
  family: 'CustomFont',
  source: 'url("https://cdn.example.com/fonts/custom.woff2")',
})
```

但要注意加载是异步的，字体 URL 也需要域名白名单。

## 样式问题排查

遇到样式不对，先去 `dist` 里看最终的 `.wxss` 文件。很多时候问题出在：

- 选择器被 scoped 改写后不符合预期
- 用了小程序不支持的 CSS 特性
- 开发者工具和真机渲染不一致（尤其是字体和间距）

## 接下来

- [组件怎么拆](/handbook/sfc/components)
- [常用写法速查](/handbook/sfc/cookbook)
