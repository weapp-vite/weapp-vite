# @weapp-core/shared

## 简介

`@weapp-core/shared` 汇总 weapp-vite 生态内的通用工具函数与依赖封装，供多个包复用。
根入口默认保持小程序运行时安全；Node 专用能力通过独立子入口导出。

## 特性

- 常用字符串与路径处理工具
- 对象合并与判定工具
- 统一导出常用第三方工具（`defu`、`get`、`set`）
- 通过 `@weapp-core/shared/node` 提供 Node 专用哈希与文件系统能力
- 通过独立、浏览器安全的 `@weapp-core/shared/rich-text` 子入口提供富文本安全树规范化，根入口不加载 HTML 解析器

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

### 富文本安全树

```ts
import { normalizeRichTextNodes } from '@weapp-core/shared/rich-text'

const nodes = normalizeRichTextNodes('<p>Hello <strong>world</strong></p>')
```

该子入口接受 HTML 字符串或结构化节点，返回命名的 `SafeRichTextNode` 文本/元素联合类型。默认保留 Web 的安全规范化策略。传入 `{ native: true }` 使用微信原生富文本规则：未知元素及子树被移除，数组文本实体仅解码一次，属性仅保留官方逐标签允许项及安全 class/style，不保留 id、href、事件或 `data-sim-*`。两个策略复用解析和安全检查；输出均为惰性内容树，不执行脚本或模板。

## 配置

暂无额外配置。

## 相关链接

- 仓库：https://github.com/weapp-vite/weapp-vite
