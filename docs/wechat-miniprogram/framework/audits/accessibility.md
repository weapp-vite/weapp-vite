<!-- 来源: https://developers.weixin.qq.com/miniprogram/dev/framework/audits/accessibility.html -->

# 体验

## 1. 开启惯性滚动

惯性滚动会使滚动比较顺畅，在安卓下默认有惯性滚动，而在 iOS 下需要额外设置 `-webkit-overflow-scrolling: touch` 的样式；

**得分条件：wxss中带有 `overflow: scroll` 的元素，在 iOS 下需要设置 `-webkit-overflow-scrolling: touch` 样式**

## 2. 避免使用 `:active` 伪类来实现点击态

使用 css `:active` 伪类来实现点击态，很容易触发，并且滚动或滑动时点击态不会消失，体验较差。建议使用小程序内置组件的 'hover-class' 属性来实现

**得分条件：不使用 `:active` 伪类，并使用 `hover-class` 替换 `:active`**

## 3. 保持图片大小比例

图片若没有按原图宽高比例显示，可能导致图片歪曲，不美观，甚至导致用户识别困难。可根据情况设置 image 组件的 mode 属性，以保持原图宽高比。

**得分条件：显示的高/宽与原图的高/宽不超过 15%**

## 4. 可点击元素的响应区域

我们应该合理地设置好可点击元素的响应区域大小，如果过小会导致用户很难点中，体验很差。

**得分条件：可点击元素的宽高都不小于 20px**

## 5. iPhone X 兼容

对于 `position: fixed` 的可交互组件，如果渲染在iPhone X的安全区域外，容易误触 Home Indicator，应当把可交互的部分都渲染到安全区域内。

建议使用以下wxss进行兼容

```
padding-bottom: constant(safe-area-inset-bottom);
padding-bottom: env(safe-area-inset-bottom);
```

**得分条件： `position: fixed` 且高度小于 68px 的可交互组件渲染在安全区域内**

## 6. 窗口变化适配

对于支持调整大小的页面，需要对不同窗口尺寸进行UI适配，以达到良好体验。

可以使用 match-media 组件、MatchMediaObserver 或者 @media 媒体查询对页面补充适配逻辑。

**得分条件：支持调整大小的页面有相关适配逻辑**

## 7. 合理的颜色搭配

文字颜色与背景色需要搭配得当，适宜的颜色对比度可以让用户更好地阅读，提升小程序的用户体验。

由于颜色搭配的计算方法较为复杂，目前算法还在不断优化中。因此该指标仅作为评分的提醒项，不计入总分中。

**判断标准：**

**1. 对于较大字体（ `font-size >= 24px` ，或同时满足 `font-size >= 19px` 与 `font-weight >= 700` ），文字颜色和背景颜色的对比度不小于 `3`**

**2. 其他字体，文字颜色和背景颜色的对比度不小于 `4.5`**

> 对比度计算方法参考 [W3C标准](https://www.w3.org/TR/WCAG/#dfn-contrast-ratio)
