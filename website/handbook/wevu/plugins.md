---
title: 插件与全局能力
description: 解释在 Wevu 里怎样把日志、错误上报、请求工具这类全局能力统一挂到应用入口，而不是让页面各自重复实现。
keywords:
  - handbook
  - wevu
  - plugins
  - 全局能力
---

# 插件与全局能力

当项目开始进入多人协作阶段，很多能力都会重复出现：

- 日志
- 埋点
- 错误上报
- 统一工具方法

如果每个页面都各写一套，后期会很难维护。
更稳的方式是把它们收口到应用入口或插件层。

## 一个最小示例

```ts
import { createApp } from 'wevu'

const app = createApp({ data: () => ({}) })

app.use((runtime) => {
  runtime.config.globalProperties.$log = (...args: any[]) => {
    console.log(...args)
  }
})
```

## 适合放成全局能力的内容

例如：

- `$log`
- `$track`
- `$reportError`
- 通用格式化工具

但要注意：
“全局可用”不等于“什么都挂全局”。过度堆全局入口会让项目越来越难理解。

## 一个判断标准

如果某个能力：

- 多个页面都会用
- 语义稳定
- 团队希望统一使用方式

那就适合考虑做成全局能力或插件。

## 一句话建议

插件层适合做“全局一致”的能力，不适合塞业务状态和页面私有逻辑。
