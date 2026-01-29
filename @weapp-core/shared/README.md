# @weapp-core/shared

## 简介

`@weapp-core/shared` 汇总 weapp-vite 生态内的通用工具函数与依赖封装，供多个包复用。

## 特性

- 常用字符串与路径处理工具
- 对象合并与判定工具
- 统一导出常用第三方工具（`defu`、`get`、`set`、`object-hash`）

## 安装

```bash
pnpm add @weapp-core/shared
```

## 使用

```ts
import {
  addExtension,
  defu,
  escapeStringRegexp,
  objectHash,
  removeExtension,
} from '@weapp-core/shared'

const name = addExtension('pages/index/index')
const cleaned = removeExtension('app.json')
const hash = objectHash({ foo: 'bar' })
```

## 配置

暂无额外配置。

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
