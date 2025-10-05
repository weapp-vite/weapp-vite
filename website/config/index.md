# 配置概览 {#config-overview}

`weapp-vite` 在保留 Vite 全部配置能力的同时，通过 `config.weapp` 扩展了面向小程序的特性。为了便于查阅，我们将配置拆分成若干主题页面，每个页面都结合常见场景给出详细示例。

```ts
// vite.config.ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  // … 这里仍然可以写任意 Vite 配置
  weapp: {
    // weapp-vite 专属配置写在这里
  },
})
```

## 立刻上手

1. **确认源码目录**：默认模板的 `app.json` 在根目录；若位于 `miniprogram/` 或 `src/`，请访问 [基础目录与脚手架](./paths-and-generators.md#weapp-srcroot)。
2. **按需选择主题**：使用下方“配置索引”快速跳转到你关心的功能，例如分包、npm、自动导入等。
3. **结合实战示例**：每个主题页面都提供了“适用场景 + 配置示例 + 常见问答”，可直接复制修改。

## 配置索引

| 主题 | 内容概览 |
| --- | --- |
| [基础目录与脚手架](./paths-and-generators.md) | `srcRoot` / `pluginRoot` / 自定义脚手架 / 额外静态资源 |
| [JSON 别名与路径解析](./json-and-alias.md) | `jsonAlias` / `tsconfigPaths` / 在 `jsonc` 中使用别名 |
| [分包与 Worker 策略](./subpackages-and-worker.md) | 普通分包、独立分包、`subPackages` 扩展、Worker 构建 |
| [npm 构建与依赖策略](./npm-and-deps.md) | 自动/手动构建、`weapp.npm` 详细字段、缓存与优化 |
| [增强能力与调试工具](./enhance-and-debug.md) | `enhance` 系列、自动导入组件、`debug` 钩子、调试技巧 |

> 仍在寻找 Vite 原生配置？可以直接参考 [Vite 官方配置文档](https://cn.vitejs.dev/config/)。

---

接下来按照你的项目需求选择对应页面进行配置。若你不确定该在哪一步调整，建议从 **基础目录与脚手架** 开始阅读。
