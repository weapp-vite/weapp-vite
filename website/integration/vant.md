# Vant Weapp 集成

[官方文档](https://vant-ui.github.io/vant-weapp/#/home)

## 安装

```sh
pnpm i @vant/weapp
```

## 修改 app.json

将 `app.json` 中的 `"style"`: `"v2"` 移除。

## 修改 tsconfig.json (与官方文档不同)

如果使用 `typescript` 开发，需要修改 `tsconfig.json` 指定 `paths`

```json
{
  "paths": {
    "@vant/weapp/*": ["path/to/node_modules/@vant/weapp/dist/*"]
  }
}
```

## 使用组件

以按钮组件为例，只需要在 JSON 文件中引入按钮对应的自定义组件即可

```json
{
  "usingComponents": {
    "van-button": "@vant/weapp/button/index"
  }
}
```

然后在你的 `wxml` 里面使用:

```html
<van-button type="primary">按钮</van-button>
```

就是这么简单

## 自动导入组件

只需要以下的配置，你就可以直接在 `wxml` 里面直接使用任意的组件，`weapp-vite` 会自动帮你进行 **组件的注册**

::: code-group

```ts [vite.config.ts]
import { VantResolver } from 'weapp-vite/auto-import-components/resolvers' // [!code highlight]

export default <UserConfig>{
  weapp: {
    enhance: {
      autoImportComponents: {
        resolvers: [
          VantResolver(), // [!code highlight]
        ],
      },
    },
  },
}
```

:::
