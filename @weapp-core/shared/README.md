# @weapp-core/shared

## 简介

`@weapp-core/shared` 汇总 weapp-vite 生态内的通用工具函数与依赖封装，供多个包复用。
根入口默认保持小程序运行时安全；Node 专用能力通过独立子入口导出。

## 特性

- 常用字符串与路径处理工具
- 对象合并与判定工具
- 统一导出常用第三方工具（`defu`、`get`、`set`）
- 通过 `@weapp-core/shared/node` 提供 Node 专用哈希与文件系统能力

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
  removeExtension,
} from '@weapp-core/shared'
import { fs, objectHash } from '@weapp-core/shared/node'

const name = addExtension('pages/index/index')
const cleaned = removeExtension('app.json')
const hash = objectHash({ foo: 'bar' })
const exists = await fs.pathExists('app.json')
```

## 配置

暂无额外配置。

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
