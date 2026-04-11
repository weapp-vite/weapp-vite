# @weapp-core/constants

## 简介

`@weapp-core/constants` 提供 `weapp-vite` 生态内部共享的常量定义，重点覆盖可同时被构建期逻辑、小程序运行时代码和测试复用的运行时安全常量。

## 特性

- 仅导出字符串常量与类型安全友好的字面量值
- 可同时被 Node.js 构建流程与小程序运行时代码复用
- 统一维护 app prelude 与 request globals 相关内部标记
- 避免不同包之间重复硬编码内部字段名

## 安装

```bash
pnpm add @weapp-core/constants
```

## 使用

```ts
import {
  APP_PRELUDE_CHUNK_MARKER,
  REQUEST_GLOBAL_ACTUALS_KEY,
  REQUEST_GLOBAL_PRELUDE_MARKER,
} from '@weapp-core/constants'

const preludeMarker = `/* ${APP_PRELUDE_CHUNK_MARKER} */`
const requestPreludeMarker = `/* ${REQUEST_GLOBAL_PRELUDE_MARKER} */`
const actualsKey = REQUEST_GLOBAL_ACTUALS_KEY
```

## 设计约束

- 不引入 `node:*`、文件系统、路径处理或其他 Node.js 专属依赖
- 不包含副作用与动态执行逻辑
- 适合作为运行时代码可直接依赖的叶子包

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
