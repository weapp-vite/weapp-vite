# tdesign-miniprogram 集成

你可以非常容易地，在 `weapp-vite` 中集成 `tdesign-miniprogram`

你只需要按照 [tdesign-miniprogram 快速开始](https://tdesign.tencent.com/miniprogram/getting-started) 进行操作即可顺利成功注册

而且在 `weapp-vite` 里注册更加的简单，大体的操作如下:

## 安装包

```sh
pnpm add tdesign-miniprogram
```

假如你的 `tdesign-miniprogram` 版本 `>=1.9.0`, 你还需要安装 `tslib` 作为依赖

```sh
pnpm add -D tslib
```

## 构建成功后勾选 `将 JS 编译成 ES5`

在微信开发者工具，详情中勾选 `将 JS 编译成 ES5`

## 修改 app.json

将 `app.json` 中的 `"style"`: `"v2"` 移除。

## 修改 tsconfig.json (与官方文档不同)

如果使用 `typescript` 开发，需要修改 `tsconfig.json` 指定 `paths`

```json
{
  "paths": {
    "tdesign-miniprogram/*": ["./node_modules/tdesign-miniprogram/miniprogram_dist/*"]
  }
}
```

## 使用组件

以按钮组件为例，只需要在 JSON 文件中引入按钮对应的自定义组件即可

```json
{
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button"
  }
}
```

然后在你的 `wxml` 里面使用:

```html
<t-button theme="primary">按钮</t-button>
```

就是这么简单

## 自动导入组件

只需要以下的配置，你就可以直接在 `wxml` 里面直接使用任意的组件，`weapp-vite` 会自动帮你进行 **组件的注册**

::: code-group

```ts [vite.config.ts]
import { TDesignResolver } from 'weapp-vite/auto-import-components/resolvers' // [!code highlight]

export default <UserConfig>{
  weapp: {
    enhance: {
      autoImportComponents: {
        resolvers: [
          TDesignResolver(), // [!code highlight]
        ],
      },
    },
  },
}
```

:::
