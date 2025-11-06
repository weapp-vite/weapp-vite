# 生成脚手架

`weapp-vite` 自带的脚手架生成器可以一键产出页面、组件或 `app` 所需的 `js/ts`、`wxml`、`wxss`、`json` 文件组合。对新手来说，这意味着不用再担心手动建文件夹、复制模板；对团队来说，可以统一风格并快速迭代。

## 快速上手

命令形式为 `weapp-vite generate [outDir]`，别名 `weapp-vite g [outDir]`。在执行 `weapp-vite init` 后，`package.json` 中会新增脚本 `pnpm g`，方便在项目中调用。

示例：在项目根目录执行

```sh
pnpm g components/avatar
```

默认会创建如下结构：

```text
.
└── components
    └── avatar
        ├── avatar.json
        ├── avatar.js
        ├── avatar.wxss
        └── avatar.wxml
```

> [!TIP]
> `weapp-vite init` 会自动把脚本添加到 `package.json`。如果你在现有项目中手动安装了 weapp-vite，也可以自行补上 `"g": "weapp-vite generate"`。

## 自定义文件后缀与目录

很多团队会使用 TypeScript + Sass/SCSS 等组合。可以在 [`weapp.generate.extensions`](/config/generate.md#weapp-generate) 中指定默认后缀：

```ts
import type { UserConfig } from 'weapp-vite/config'

export default <UserConfig>{
  weapp: {
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'scss',
        json: 'jsonc',
      },
    },
  },
}
```

此时再次执行 `pnpm g components/avatar`，生成的文件会自动替换为 `.ts`、`.scss`、`.jsonc`。

## 自定义模板内容

除了后缀，你还可以完全掌控模板内容。`weapp.generate.templates` 支持三种写法：

- `content`: 直接写入字符串；
- `path`: 指定已有模板文件（相对路径基于 CLI 当前工作目录）；
- 工厂函数：接收生成上下文，返回字符串（返回 `undefined` 时回退到默认模板）。

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    generate: {
      templates: {
        shared: {
          wxss: () => '.root { color: red; }',
          json: { content: '{ "component": true }' },
        },
        component: {
          js: { content: 'Component({})' },
          wxml: { path: './templates/component.wxml' },
        },
        page: {
          js: async ({ fileName }) => `Page({ pageName: '${fileName}' })`,
          wxml: ({ outDir, fileName, defaultCode }) =>
            `<!-- ${outDir}/${fileName}.wxml -->\n${defaultCode ?? ''}`,
        },
      },
    },
  },
})
```

生成器会优先查找 `type` 对应的模板（如 `component`、`page`、`app`），找不到时回退到 `shared`。模板上下文包含 `type`、`fileType`、`fileName`、`outDir`、`extension` 以及默认代码 `defaultCode`，方便根据输出目标动态定制。

## 调整生成文件名

默认情况下文件名与目录名一致。例如 `pnpm g components/avatar` 会生成 `avatar.ts / avatar.wxml`。若想生成目录和文件名不同的结构，可以使用 `-n` / `--name`：

```sh
pnpm g components/avatar -n index
```

输出：

```text
└── components
    └── avatar
        ├── index.jsonc
        ├── index.scss
        ├── index.ts
        └── index.wxml
```

## 生成不同类型的模板

- 生成 **组件**（默认）：`pnpm g components/avatar`
- 生成 **页面**：`pnpm g pages/home -p`（或 `--page`）
- 生成 **app 入口**：`pnpm g src/app -a`（或 `--app`，仅生成 `js/ts`、`wxss`、`json` 三类文件）

你可以自由组合 `--page` / `--app` 与自定义模板，实现差异化的初始化内容。

## CLI 参数速查

| 参数         | 类型     | 说明                                                  |
| ------------ | -------- | ----------------------------------------------------- |
| `[outDir]`   | `string` | 目标目录，支持多级路径，例如 `pages/profile/settings` |
| `-a, --app`  | `bool`   | 生成 `app` 类型，仅创建脚本、样式、配置文件           |
| `-p, --page` | `bool`   | 生成 `page` 类型模板                                  |
| `-n, --name` | `string` | 指定生成文件名，默认为 `outDir` 最末级目录            |

想深入了解更多字段（例如 `dirs`、`include/exclude`），请查看 [配置文档 · 生成脚手架配置](/config/generate.md)。
