# 什么是 Weapp-vite ?

## 介绍

`weapp-vite` 是一个 `vite` 的微信小程序版本的封装，你可以利用它开箱即用的进行小程序开发

它支持绝大部分 `vite` 的配置和插件系统，同时对小程序的架构做了一些特殊的优化，比如分包场景等等。

它能够开箱即用的支持 `ts` / `postcss` / `sass` / `less` / `tailwindcss` 等等，还能使用众多 `vite` 插件

## 为什么选 Weapp-vite {#why-weapp-vite}

### 现实问题 {#the-problems}

首先我要狠狠的吐槽一下：

嗯，是的，原生的小程序开发方式，令人不愉快！

然后跨端框架诸如 `uni-app` / `tarojs` 使用的是兼容 `vue` / `react` 等等 `web` 框架的写法，

再编译回小程序或者到多端，我觉得太重了，而且虽然开源，但我没仔细研究源代码，那对我来说就是黑盒。

`mpxjs` 思路很好，但是我就是想用最原生的写法，加上自己定义的一套语法糖，加上一些现代工具链的东西而已，

并不想上什么框架，学习什么类似 `vue` 又不像 `vue` 新语法。

我就想要看着微信官方文档，简简单单的写一个小程序而已！！！

### 诞生背景

另外现在原生小程序也越来越强，各个平台之间的差异，也越来越大了。

微信小程序又是搞 `skyline` 又是搞 `Donut` 的，虽然现在全是 `Bug`，官方群里也不活跃，问问题也没啥人回答，

但是让我感觉未来可期，起码人家是有实实在在的技术投入的好伐！其他大厂都在忙着降本增效嘛？

所有我想就使用一些原生小程序的写法，跟着官方走。

然后利用编译插件，扩展功能，然后由微信的语法，转到其他的小程序平台，其他随缘。

反正整体的思路，便是所见即所得，最轻量级的构建，同时也能够带有 `vite` 的插件系统。

可以利用 `vite` 的生态的同时，方便我后续编写插件对里面的语法进行高度自定义。

比如把微信的语法转换成支付宝的语法，这种类似的操作

于是 `weapp-vite` 诞生了

## 什么情况下选择 Weapp-vite {#when-weapp-vite}

### 跨端需求与更细致的原生体验

假如你有跨小程序多端的需求，推荐选择 `uni-app` 或者 `taro`，它们跨多端支持较好，而且能够支持 `vue` / `react` 等很多 `web` 框架的写法

假如你的需求只是要开发微信小程序，同时利用 [微信自带的小程序多端框架](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/miniapp/intro/) 构建，小程序，Android 以及 IOS 应用，那么 `weapp-vite` 适合你, 它也能为你提供更细致的原生体验。

### 优劣势

`weapp-vite` 的优势在于对原生小程序开发有更好的支持，比如 `skyline` 等等功能，但是功能肯定不如 `uni-app` 或者 `taro` 这些框架功能这么丰富。

### 原生小程序迁移

另外，假如你已经现有原生小程序需要做迁移，或者原先基于 `mina` 方案或者 `gulp` 方案进行构建的，

可将 `weapp-vite` 作为它们的进阶方案进行迁移，这个成本是较低的。
