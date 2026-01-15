# 别名 {#alias}

`weapp-vite` 同时支持 **JS/TS 别名** 与 **JSON/JSONC 别名**，让你在脚本和配置文件里都能用同一套路径前缀。本页先给出最常见的配置方式，再补充一些使用建议；更细的字段说明请参考 [配置文档 · JSON 配置](/config/json.md) 与 [配置文档 · JS 配置](/config/js.md)。

## 适用场景

- 统一业务组件、工具方法的导入路径，避免深层级的 `../../`。
- 让 JSON 配置和 TypeScript 源码共享同一套别名，减少路径维护成本。
- 按团队约定快速切换不同的路径前缀（如 `@components/*`、`@shared/*`）。

设置完成后，Vite Dev Server 与小程序产物都会自动替你做路径转换，不需要在不同环境下手动调整。

## JS/TS 别名

项目默认启用了 `vite-tsconfig-paths`，所以你只要在 `tsconfig.json` / `jsconfig.json` 里配置 `baseUrl` 和 `paths`，就能在代码中直接使用别名。

例如：

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

然后你就可以在代码里这样写：

```ts
import utils from '@/utils'
```

运行 `weapp-vite dev` / `weapp-vite build` 时，别名会被自动解析成真实文件位置。

> [!TIP]
> 如果需要控制 `vite-tsconfig-paths` 的行为（例如指定多个 `tsconfig` 或忽略某些目录），可在 `vite.config.ts` 中调整 [`weapp.tsconfigPaths`](/config/js.md#weapp-tsconfigpaths)。

## JSON / JSONC 别名

`weapp-vite` 对所有 JSON 配置文件做了增强，既允许使用注释，也支持别名映射，帮助你更好地组织大型项目。

首先，`weapp-vite` 允许你在应用/页面/组件的 `json/jsonc` 文件里写注释，例如：

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

要启用 JSON 别名，可在 `vite.config.ts` 中配置 [`weapp.jsonAlias.entries`](/config/json.md#weapp-jsonalias)。语法与 Vite 的 `resolve.alias` 完全一致：

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
          replacement: path.resolve(import.meta.dirname, 'components'),
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

## 常见问题排查

- **别名未生效？** 请确认 `pnpm dev` 重启过——`tsconfig` 修改后需要重新启动进程，Rolldown 才能读取新的 `paths`。
- **JSON 中提示路径不存在？** 开发者工具的校验不理解别名是正常现象，编译产物仍会替换为真实路径。若想在 IDE 内消除警告，可借助自定义类型定义或在 `usingComponents` 上方写注释标记。
- **同时使用多个 `tsconfig`？** 可以在 `vite.config.ts` 中配置 [`weapp.tsconfigPaths.projects`](../config/js.md#weapp-tsconfigpaths) 指定额外的配置文件，让 monorepo 子包共享同一套别名。
