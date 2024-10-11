# 生成脚手架

在 `weapp-vite` 中内置了一个生成脚手架，用于快速生成 `js`,`wxml`,`wxss`,`json` 一系列文件

> 下列的命令，都使用 `pnpm@9` 来进行运行，相比于 `npm` / `yarn` 它有很多优点
>
> 当然最重要的是 `快`!

## 使用方式

最基础的命令为:

`weapp-vite generate [outDir]`

当然你可以简写为 `weapp-vite g [outDir]`

执行 `weapp-vite g components/avatar` 默认情况下会生成目录+组件，如下所示:

```bash
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

此时在项目里面，执行 `pnpm g [outDir]` 也能达到同样的效果: `pnpm g components/avatar`

## 更改文件后缀

当然，你一定对生成文件的后缀不满意，这个可以通过 `vite.config.ts` 进行配置:

```ts
import type { UserConfig } from 'weapp-vite/config'

export default <UserConfig>{
  weapp: {
    // weapp.generate 配置
    generate: {
      extensions: {
        js: 'ts',
        wxss: 'scss',
      },
    },
  },
}
```

上述配置更改了 `js` 和 `wxss` 生成文件的后缀，现在执行同样的命令，生成的结果是:

```bash
.
└── components
    └── avatar
        ├── avatar.json
        ├── avatar.scss
        ├── avatar.ts
        └── avatar.wxml
```

## 更改生成组件的名称

默认情况下，生成文件的名称会根据你的路径，最终的文件夹名称，你也可以自定义

比如之前执行 `pnpm g components/avatar` 的结果为:

```bash
.
└── components
    └── avatar
        ├── avatar.json
        ├── avatar.scss
        ├── avatar.ts
        └── avatar.wxml
```

此时你可以添加 `-n` (`--name` 的缩写)

`pnpm g components/avatar -n=index` 的结果为:

```bash
.
└── components
    └── avatar
        ├── index.json
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
