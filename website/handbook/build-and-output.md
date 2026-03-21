---
title: 构建产物到底长什么样
description: 帮你从源码、编译结果和开发者工具视角理解 Weapp-vite 的输出结构，以及为什么很多问题必须回到 dist 里看。
keywords:
  - handbook
  - build output
  - 构建产物
  - Weapp-vite
---

# 构建产物到底长什么样

新用户第一次遇到构建问题时，常见反应是“源码明明是对的”。
但在小程序里，真正运行的不是源码，而是最终产物。

所以这章的核心目标只有一个：让你学会看 `dist`。

## 你平时到底在和哪两套文件打交道

日常开发时，你看到的是源码：

```txt
src/pages/user/index.vue
```

但开发者工具真正运行的，是构建后的产物：

```txt
dist/pages/user/
├─ index.js
├─ index.json
├─ index.wxml
└─ index.wxss
```

理解这件事很重要，因为很多问题只会在“源码 -> 产物”的过程中暴露：

- 路径被改错
- 页面没有被扫描到
- 样式编译后和预期不同
- JSON 合并结果和你想的不一样

## 一个 `.vue` 页面会输出什么

以这个页面为例：

```vue
<script setup lang="ts">
definePageJson(() => ({
  navigationBarTitleText: '用户中心',
}))
</script>

<template>
  <view class="page">
    user
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx;
}
</style>
```

最终你至少应该预期会得到：

```txt
dist/pages/user/
├─ index.js
├─ index.json
├─ index.wxml
└─ index.wxss
```

分别可以这样理解：

- `index.js`
  页面逻辑
- `index.json`
  页面配置
- `index.wxml`
  模板结构
- `index.wxss`
  样式输出

## 调试时最值得先看的 4 个文件

### 1. `index.json`

判断：

- 页面标题有没有生效
- `usingComponents` 有没有写进去
- 页面配置最终合并结果是否正确

### 2. `index.wxml`

判断：

- 模板是不是被正确编译
- 条件渲染、循环、事件绑定是不是按预期输出

### 3. `index.js`

判断：

- 页面逻辑有没有真正输出
- 导入依赖是否缺失

### 4. `app.json`

判断：

- 页面是不是被纳入应用
- 路由顺序和分包配置是否正确

## 最常见的 5 类构建问题

### 1. 页面没生成

通常是：

- 路径不符合扫描规则
- 没被路由系统纳入
- 文件命名不符合约定

### 2. 组件生成了，但页面里用不了

优先看 `usingComponents` 是否正确生成到 `json` 里。

### 3. 图片、字体、静态资源路径不对

这类问题通常只看源码很难判断，必须回到 `dist` 看重写结果。

### 4. 分包里引用路径错了

尤其是：

- 主包组件引用分包资源
- 分包页面引用共享资源
- 静态资源没有跟随正确输出

### 5. dev 正常，build 不正常

这通常意味着：

- 最终产物路径或资源策略有问题
- 依赖兼容性在正式构建阶段才暴露
- 开发者工具看的目录和构建目录不一致

## 一个很实用的排查习惯

每次你怀疑“是不是编译错了”，就按这个顺序看：

1. 源码是否正确
2. `dist` 里对应页面文件是否完整
3. 开发者工具导入的目录是否就是当前 `dist`
4. 构建日志里有没有跳过、警告或兼容性提示

## 最小检查清单

上线前至少做一次这样的确认：

```txt
[ ] app.json 中的页面路径正确
[ ] dist 中每个关键页面都有 js/json/wxml/wxss
[ ] 关键静态资源路径在产物中可访问
[ ] usingComponents 生成符合预期
[ ] 分包页面能在开发者工具中正常打开
```

看完这一章，你下一步最适合继续补的是：

- [环境变量与配置怎么分层](/handbook/env-and-config)
- [页面跳转与路由参数](/handbook/navigation)
- [分包与包体策略](/handbook/subpackages)
