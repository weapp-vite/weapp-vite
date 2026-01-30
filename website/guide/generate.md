# 生成脚手架

`weapp-vite` 自带一个生成器，用来一键生成页面/组件/App 的基础文件（页面/组件包含 `js/ts`、`wxml`、`wxss`、`json`；App 不生成 `wxml`）。它适合两类情况：

- 你不想每次都手动建目录、复制四件套模板
- 团队希望统一目录和文件后缀，减少“每个人生成出来都不一样”

## 快速上手

命令形式为 `weapp-vite generate [outDir]`，别名 `weapp-vite g [outDir]`。在执行 `weapp-vite init` 后，`package.json` 中会新增脚本 `pnpm g`，方便在项目中调用。

示例：在项目根目录执行：

```sh
pnpm g components/avatar
# 或直接调用二进制
pnpm weapp-vite g components/avatar
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

此时再次执行 `pnpm g components/avatar`，生成的文件会自动变成 `.ts`、`.scss`、`.jsonc`。

> [!TIP]
> 当 `extensions.json` 设为 `js/ts` 时，会生成 `*.json.js` / `*.json.ts`，便于配合脚本化 JSON 配置。

## 自定义模板内容

除了后缀，你还可以自定义“生成出来的默认内容”。`weapp.generate.templates` 支持四种写法：

- 字符串：视为模板文件路径（相对路径基于 CLI 当前工作目录）；
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

生成器会优先查找 `type` 对应的模板（`component`、`page`、`app`），找不到时回退到 `shared`。模板上下文包含 `type`、`fileType`、`fileName`、`outDir`、`extension` 以及默认代码 `defaultCode`，方便你按不同目录/文件类型做差异化输出。

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

想深入了解更多字段（例如 `dirs`、`filenames`、`templates`），请查看 [配置文档 · 生成脚手架配置](/config/generate.md)。
