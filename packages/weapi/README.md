# @wevu/api

## 简介

`@wevu/api` 是一个轻量的 API 包，目前主要用于提供基础导出与包结构示例，便于后续扩展。

## 特性

- 体积小、依赖少
- 适合承载通用 API 或类型导出
- 目前提供简单的示例导出

## 安装

```bash
pnpm add @wevu/api
```

## 使用

```ts
import { greet, VERSION } from '@wevu/api'

console.log(greet('wevu'))
console.log(VERSION)
```

## 配置

暂无额外配置。

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
