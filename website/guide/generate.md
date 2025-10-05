# 生成脚手架

在 `weapp-vite` 中内置了一个脚手架生成器，用于快速创建页面/组件所需的 `js` / `wxml` / `wxss` / `json` 文件集合。

> 下列的命令，都使用 `pnpm@9` 来进行运行，相比于 `npm` / `yarn` 它有很多优点
>
> 当然最重要的是 `快`!

## 使用方式

最基础的命令为:

`weapp-vite generate [outDir]`

当然你可以简写为 `weapp-vite g [outDir]`

执行 `weapp-vite g components/avatar` 默认情况下会生成目录+组件，如下所示:

```sh
.
└── components
    └── avatar
        ├── avatar.json
        ├── avatar.wxss
        ├── avatar.js
        └── avatar.wxml
```

在执行 `weapp-vite init` 后项目的 `package.json` 会出现下列命令:

```json
{
  "scripts": {
    "g": "weapp-vite generate"
  }
}
```

此时在项目里执行 `pnpm g [outDir]` 也能达到同样效果，例如：`pnpm g components/avatar`

## 更改文件后缀

若需要更改生成文件的后缀或目录结构，可以在 [`weapp.generate`](/config/paths-and-generators.md#weapp-generate) 中统一配置：

```ts
import type { UserConfig } from 'weapp-vite/config'

export default <UserConfig>{
  weapp: {
    // weapp.generate 配置
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

上述配置更改了 `js` 和 `wxss` 生成文件的后缀，现在执行同样的命令，生成的结果是:

```sh
.
└── components
    └── avatar
        ├── avatar.jsonc
        ├── avatar.scss
        ├── avatar.ts
        └── avatar.wxml
```

## 自定义模板

除了文件后缀、目录结构以外，也可以在 `weapp.generate.templates` 中覆盖默认模板内容。模板支持三种来源：

- `content`: 直接内联字符串内容；
- `path`: 指向现有文件的相对/绝对路径（相对路径基于 CLI 当前工作目录）；
- 工厂函数：同步或异步函数，返回字符串（返回 `undefined` 时退回默认模板）。

你还可以通过 `shared` 定义所有类型通用的模板，再按 `component`、`page`、`app` 等类型覆写特定文件类型：

```ts
// weapp.config.ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    generate: {
      // 也可以与 extensions / dirs 等配置组合使用
      templates: {
        shared: {
          wxss: () => '.root { color: red; }',
          json: { content: '{"from":"shared"}' },
        },
        component: {
          js: { content: 'Component({ custom: true })' },
          wxml: { path: './templates/component.wxml' },
        },
        page: {
          js: async ({ fileName }) => `Page({ name: '${fileName}' })`,
          wxml: ({ outDir, fileName, defaultCode }) => `<!-- ${outDir}/${fileName}.wxml -->\n${defaultCode ?? ''}`,
        },
      },
    },
  },
})
```

运行 `weapp-vite generate components/avatar` 时，`js`、`wxml`、`wxss` 将根据上述模板进行覆盖，而 `json` 会使用共享模板内容；当模板函数返回 `undefined` 时，会回落到内置默认模板。

> **提示**：模板上下文包含 `type`、`fileType`、`fileName`、`outDir`、`extension` 以及默认代码 `defaultCode`，方便根据生成目标动态输出内容。

## 更改生成组件的名称

默认情况下，生成文件的名称会根据你的路径，最终的文件夹名称，你也可以自定义

比如之前执行 `pnpm g components/avatar` 的结果为:

```sh
.
└── components
    └── avatar
        ├── avatar.jsonc
        ├── avatar.scss
        ├── avatar.ts
        └── avatar.wxml
```

此时你可以添加 `-n` (`--name` 的缩写)

`pnpm g components/avatar -n=index` 的结果为:

```sh
.
└── components
    └── avatar
        ├── index.jsonc
        ├── index.scss
        ├── index.ts
        └── index.wxml
```

## 生成 page 或者 app 类型模板

默认情况下，生成的都是 `component` 类型的组件

你想生成 `page` 类型的，可以执行 `pnpm g [outDir] --page`(`--page` 可以简写为 `-p`)

你想生成 `app` 类型的，可以执行 `pnpm g [outDir] --app`(`--app` 可以简写为 `-a`)

## 参数列表

| 参数        | 类型     | 描述                                              |
| ----------- | -------- | ------------------------------------------------- |
| `[outDir]`  | `string` | 输出组件的目标路径                                |
| `-a,--app`  | `bool`   | 是否 `app` 入口，此时只会生成 `js`,`wxss`和`json` |
| `-p,--page` | `bool`   | 是否是 `page` 组件                                |
| `-n,--name` | `string` | 用来自定义内部所有文件的名称                      |
