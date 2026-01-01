# 生成脚手架配置 {#generate-config}

`weapp-vite generate` 用来快速生成页面/组件/App 基础文件。这页列出 `weapp.generate` 的字段，帮你把生成出来的目录结构、文件名、后缀和模板内容对齐到团队习惯。

[[toc]]

## `weapp.generate` {#weapp-generate}
- **类型**：
  ```ts
  {
    extensions?: Partial<{ js: string; json: string; wxml: string; wxss: string }>
    dirs?: Partial<{ app: string; page: string; component: string }>
    filenames?: Partial<{ app: string; page: string; component: string }>
    templates?: TemplatesConfig
  }

  type TemplatesConfig = Partial<Record<'shared' | 'component' | 'page' | 'app', GenerateTemplateEntry>>

  type GenerateTemplateEntry = Partial<Record<'js' | 'json' | 'wxml' | 'wxss', TemplateSource>>

  type TemplateSource =
    | string
    | { path: string }
    | { content: string }
    | ((ctx: TemplateContext) => string | undefined | Promise<string | undefined>)

  interface TemplateContext {
    type: 'component' | 'page' | 'app'
    fileType: 'js' | 'json' | 'wxml' | 'wxss'
    fileName: string
    outDir: string
    extension: string
    cwd: string
    defaultCode?: string
  }
  ```
- **默认值**：`undefined`
- **适用场景**：
  - 用命令行创建页面/组件时，希望生成结果符合团队目录结构（而不是每次手动挪文件）。
  - 想在生成时就带上团队常用的模板内容（例如通用样式、占位配置、国际化骨架等）。

### 配置示例

```ts
export default defineConfig({
  weapp: {
    generate: {
      extensions: {
        js: 'ts',
        json: 'jsonc',
        wxss: 'scss',
      },
      dirs: {
        page: 'src/pages',
        component: 'src/components',
      },
      filenames: {
        app: 'app',
        page: 'index',
      },
      templates: {
        shared: {
          wxss: () => '.root { color: red; }',
        },
        component: {
          js: { content: 'Component({ custom: true })' },
        },
      },
    },
  },
})
```

### 字段说明

- `extensions`: 覆写生成文件的默认后缀，例如将 JS 切换为 TS、将 WXSS 改为 SCSS。
- `dirs`: 定义生成文件的默认目录。支持分别指定 `app`、`page`、`component` 的输出路径。
- `filenames`: 定制生成文件的默认文件名，例如页面默认生成 `index.ts`、组件默认生成 `index.json` 等。
- `templates`: 为不同类型生成自定义文件内容。支持字符串、文件路径或工厂函数：
  - `string`: 直接写入内容。
  - `{ path: './template.wxml' }`: 从指定文件读取。
  - `{ content: '...' }`: 直接提供内容对象。
  - 函数：根据 `TemplateContext` 运行时返回字符串或 `undefined`，可结合条件逻辑灵活生成。

### 常见问题

- **CLI 会覆盖已有文件吗？** 不会，生成命令只对全新文件生效，若目标文件已存在会提示冲突。
- **如何生成带注释的 JSON？** 把 `extensions.json` 设为 `jsonc` 即可，然后在模板里写注释/占位内容。
- **模板如何复用？** 用 `templates.shared` 提供全局基础模板，再在 `component`、`page`、`app` 里按需覆写。

---

接下来，可结合 [基础目录与资源收集](./paths.md#paths-config) 调整生成目标目录，或阅读 [共享配置](/config/shared.md) 在生成后自动注册组件与路由。
