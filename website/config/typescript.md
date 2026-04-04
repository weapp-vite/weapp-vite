---
title: TypeScript 支持文件
description: weapp-vite 会生成 .weapp-vite 下的托管 tsconfig 与类型文件，用于稳定承接自动路由、自动导入组件、layout 和编辑器提示。
keywords:
  - 配置
  - config
  - typescript
  - tsconfig
  - .weapp-vite
  - typed-router
  - typed-components
---

# TypeScript 支持文件 {#typescript-support}

`weapp-vite` 会在项目根目录生成一组 `.weapp-vite/*` 托管文件，用来解决两类问题：

- 给自动路由、自动导入组件、layout 等增强能力提供稳定的类型输出位置
- 让旧项目也能逐步接入更规范的 TS 引用结构，而不是一次性强制重构

[[toc]]

## 会生成哪些文件

常见输出包括：

- `.weapp-vite/tsconfig.app.json`
- `.weapp-vite/tsconfig.server.json`
- `.weapp-vite/tsconfig.node.json`
- `.weapp-vite/tsconfig.shared.json`
- `.weapp-vite/typed-router.d.ts`
- `.weapp-vite/typed-components.d.ts`
- `.weapp-vite/components.d.ts`
- `.weapp-vite/wevu-layouts.d.ts`

它们分别服务于：

- 业务源码与页面/组件类型检查
- Node / 配置文件类型检查
- 自动路由类型输出
- 自动导入组件与 Vue 模板补全
- layout 名称和 props 类型增强

## 什么时候生成

这些文件会在以下命令中自动生成或刷新：

- `wv dev`
- `wv build`
- `wv open`
- `wv analyze`
- `wv prepare`

如果你希望在编辑器、CI、AI 工具接入前先预热类型产物，推荐显式执行：

```bash
wv prepare
```

## `weapp.typescript` {#weapp-typescript}

- **类型**：
  ```ts
  {
    shared?: {
      compilerOptions?: CompilerOptions
      include?: string[]
      exclude?: string[]
      files?: string[]
    }
    app?: {
      compilerOptions?: CompilerOptions
      vueCompilerOptions?: Record<string, any>
      include?: string[]
      exclude?: string[]
      files?: string[]
    }
    node?: {
      compilerOptions?: CompilerOptions
      include?: string[]
      exclude?: string[]
      files?: string[]
    }
    server?: {
      compilerOptions?: CompilerOptions
      include?: string[]
      exclude?: string[]
      files?: string[]
    }
  }
  ```

用于定制托管 `tsconfig` 的各分组内容。

```ts
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    typescript: {
      shared: {
        compilerOptions: {
          strict: true,
        },
      },
      app: {
        include: ['src/**/*', '.weapp-vite/**/*.d.ts'],
      },
      node: {
        compilerOptions: {
          types: ['node'],
        },
      },
      server: {
        include: ['server/**/*.ts'],
      },
    },
  },
})
```

### 四个分组分别管什么

- `shared`：多端共享、公共基础配置
- `app`：页面、组件、SFC、布局相关源码
- `node`：`vite.config.*`、脚本、生成器、Node 工具
- `server`：服务端辅助代码或本地 server 代码

### 每个分组都支持什么

- `compilerOptions`
- `include`
- `exclude`
- `files`

其中 `app` 额外支持：

- `vueCompilerOptions`

## 推荐接入方式

### 新项目

优先采用托管 `references` 结构：

```json
{
  "references": [
    { "path": "./.weapp-vite/tsconfig.app.json" },
    { "path": "./.weapp-vite/tsconfig.server.json" },
    { "path": "./.weapp-vite/tsconfig.node.json" },
    { "path": "./.weapp-vite/tsconfig.shared.json" }
  ],
  "files": []
}
```

### 旧项目

建议按这个顺序迁移：

1. 先执行一次 `wv prepare`
2. 确认 `.weapp-vite/*` 已生成
3. 再逐步把根 `tsconfig.json` 收敛到托管 `references`
4. 最后在 `weapp.typescript` 里补团队自己的覆盖项

## 与顶层 `resolve.alias` / `compilerOptions.paths` 的关系

`weapp.typescript` 只负责托管 TS 文件本身的结构和编译器选项。

如果你在处理路径别名：

- TS 层别名：`compilerOptions.paths`
- Vite 解析层：顶层 `resolve.alias` 或 `weapp.tsconfigPaths`

更多 Vite 原生配置说明：

- [Vite 中文官方配置文档 · resolve](https://cn.vite.dev/config/shared-options#resolve-alias)

## 常见问题

### 为什么改了配置后编辑器还没提示

优先检查：

1. 是否已执行 `wv prepare`
2. 根 `tsconfig.json` 是否包含 `.weapp-vite` 产物
3. 是否使用了 `weapp-vite/config` 的 `defineConfig`

### `typed-router.d.ts` / `typed-components.d.ts` 没生成

分别检查：

- 是否启用了 `weapp.autoRoutes`
- 是否启用了 `weapp.autoImportComponents`

### 可以手动改 `.weapp-vite/*.json` 吗

不建议。它们属于托管产物，应通过 `weapp.typescript` 和相关功能配置来改。

---

接下来如果你要处理自动路由、日志桥接、MCP 或运行时注入，请继续看 [共享配置](./shared.md)。
