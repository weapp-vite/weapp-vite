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

> [!TIP]
> 可以额外创建 `weapp-vite.config.ts`（或 `.mts/.cts/.js/.mjs/.cjs`）。weapp-vite 会先读取其中的 `weapp` 配置，再与 `vite.config.*` 内容合并，方便将小程序专属配置与 Vite 通用配置解耦。

## 立刻上手

1. **确认源码目录**：默认模板的 `app.json` 在根目录；若位于 `miniprogram/` 或 `src/`，请访问 [基础目录与资源收集](./paths.md#weapp-srcroot)。
2. **按需选择主题**：使用下方“配置索引”快速跳转到你关心的功能，例如分包、npm、自动导入等。
3. **结合实战示例**：每个主题页面都提供了“适用场景 + 配置示例 + 常见问答”，可直接复制修改。

## 配置索引

| 主题 | 内容概览 |
| --- | --- |
| [基础目录与资源收集](./paths.md) | `srcRoot` / `pluginRoot` / 静态资源拷贝 / 额外模板 |
| [构建输出与兼容](./build-and-output.md) | CommonJS / ESM 切换、`weapp.jsFormat`、`weapp.es5` 降级策略 |
| [JSON 配置](./json.md) | `jsonAlias` / JSONC 别名与引用 |
| [JS 配置](./js.md) | `tsconfigPaths` / 别名扩展 / Vite 配置协同 |
| [分包配置](./subpackages.md) | 独立/普通分包、依赖裁剪、共享样式 |
| [Worker 配置](./worker.md) | Worker 入口、构建产物、调试建议 |
| [生成脚手架配置](./generate.md) | `weapp.generate` 目录结构、后缀与模板定制 |
| [npm 配置](./npm.md) | 自动/手动构建、`weapp.npm` 字段、缓存与优化 |
| [WXML 配置](./wxml.md) | `weapp.wxml` 选项、额外模板收集、调优建议 |
| [WXS 配置](./wxs.md) | `weapp.wxs` 开关、调试方法、常见问题 |
| [自动导入组件配置](./auto-import-components.md) | `weapp.autoImportComponents` 字段、扫描规则与产物输出 |
| [共享配置](./shared.md) | 自动路由、`weapp.debug` 调试钩子 |

> 仍在寻找 Vite 原生配置？可以直接参考 [Vite 官方配置文档](https://cn.vitejs.dev/config/)。

---

接下来按照你的项目需求选择对应页面进行配置。若你不确定该在哪一步调整，建议从 **基础目录与资源收集** 开始阅读。
