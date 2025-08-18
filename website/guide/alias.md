# 别名 {#alias}

在 `weapp-vite` 里，集成了 `2` 种别名的支持:

1. `js/ts` 别名
2. `json/jsonc` 别名

## `js/ts` 别名

在项目内部启用了自动别名的功能:

你只需在你的 `tsconfig.json` / `jsconfig.json` 中配置 `baseUrl` 和 `paths`，`js/ts` 引入的别名即可生效

比如:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./*"
      ]
    }
  }
}
```

你就可以在你的代码里面写:

```ts
import utils from '@/utils'
```

在经过 `weapp-vite dev` / `weapp-vite build` 只会会自动帮你做路径的 `resolve`

## `json/jsonc` 别名

`weapp-vite` 对你所有的 `json` 配置文件做了增强，使得你可以做到一些原生小程序做不到的事情

首先，`weapp-vite` 允许你在 应用，页面，组件的 `json/jsonc` 文件里面，使用注释，即:

- `// 这是注释`
- `/* 这也是注释 */`

```json
{
  "pages": [
    // 首页
    "pages/index/index"
  ],
  "usingComponents": {
    // 全局组件
    "navigation-bar": "/components/navigation-bar/navigation-bar"
  },
  "subPackages": [
    // 分包 A
    {
      "root": "packageA",
      "name": "pack1",
      "pages": [
        "pages/cat",
        "pages/dog"
      ]
    },
    // 分包 B 是独立分包
    {
      "root": "packageB",
      "name": "pack2",
      "pages": [
        "pages/apple",
        "pages/banana"
      ],
      // "entry": "index.js",
      // 独立分包应该特殊处理, 单独创建上下文
      "independent": true
    }
  ]
}
```

使用它们不会报错，并在最终产物里面会被剔除

然后配置 `json/jsonc` 别名需要在 `vite.config.ts` 里配置 `weapp.jsonAlias.entries` 配置项

> `weapp.jsonAlias.entries` 配置项传入的参数，同原先 `vite` 的 `resolve.alias` 配置项，[详见地址](https://vite.dev/config/shared-options.html#resolve-alias)

```ts
import type { UserConfig } from 'weapp-vite/config'
import path from 'node:path'

export default <UserConfig>{
  weapp: {
    jsonAlias: {
      entries: [
        {
          find: '@',
          replacement: path.resolve(__dirname, 'components'),
        },
      ],
    },
  },
}
```

这样你可以在 `json/jsonc` 文件里这样编写:

```json
{
  "usingComponents": {
    "navigation-bar": "@/navigation-bar/navigation-bar",
    "ice-avatar": "@/avatar/avatar"
  }
}
```

它们会在产物里，被自动转化成相对路径

```json
{
  "usingComponents": {
    "navigation-bar": "../../components/navigation-bar/navigation-bar",
    "ice-avatar": "../../components/avatar/avatar"
  }
}
```

当然最终产物，这取决于你自己的 `weapp.jsonAlias.entries` 配置

当然你也可以使用 `/` 开头的引入路径:

```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar"
  }
}
```

这种以 `/` 开头的，会被自动转化成项目的根路径
