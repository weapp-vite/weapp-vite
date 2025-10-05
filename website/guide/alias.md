# 别名 {#alias}

`weapp-vite` 同时支持 **JS/TS 别名** 与 **JSON/JSONC 别名**，让你在不同语言中都能使用一致的路径前缀。配置方式梳理如下；需要更完整的字段说明，请参考 [配置文档 · JSON 别名与路径解析](/config/json-and-alias.md)。

## JS/TS 别名

在项目内部已默认启用了 `vite-tsconfig-paths`，因此只需要在 `tsconfig.json` / `jsconfig.json` 中配置 `baseUrl` 和 `paths`，即可在项目里直接使用别名。

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

之后在执行 `weapp-vite dev` / `weapp-vite build` 时，路径会被自动解析为真实文件位置。

> [!TIP]
> 如果需要控制 `vite-tsconfig-paths` 的行为（例如指定多个 `tsconfig` 或忽略某些目录），可在 `vite.config.ts` 中调整 [`weapp.tsconfigPaths`](/config/json-and-alias.md#weapp-tsconfigpaths)。

## JSON / JSONC 别名

`weapp-vite` 对所有 JSON 配置文件做了增强，既允许使用注释，也支持别名映射，帮助你更好地组织大型项目。

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

这些注释不会触发构建错误，并会在产物阶段被剔除。

要启用 JSON 别名，可在 `vite.config.ts` 中配置 [`weapp.jsonAlias.entries`](/config/json-and-alias.md#weapp-jsonalias)。语法与 Vite 的 `resolve.alias` 完全一致：

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

配置完成后，就可以在任何 JSON/JSONC 中直接书写别名：

```json
{
  "usingComponents": {
    "navigation-bar": "@/navigation-bar/navigation-bar",
    "ice-avatar": "@/avatar/avatar"
  }
}
```

构建时会自动转化成相对路径：

```json
{
  "usingComponents": {
    "navigation-bar": "../../components/navigation-bar/navigation-bar",
    "ice-avatar": "../../components/avatar/avatar"
  }
}
```

最终产物的路径拼装取决于你在 `entries` 中的替换逻辑；如果希望使用绝对路径，也可以直接以 `/` 开头：

```json
{
  "usingComponents": {
    "navigation-bar": "/components/navigation-bar/navigation-bar"
  }
}
```

该写法会被解析为项目根目录下的实际文件。
