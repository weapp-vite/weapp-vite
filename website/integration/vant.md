# Vant Weapp 集成

官方文档：<https://vant-ui.github.io/vant-weapp/#/home>

## 安装

```sh
pnpm i @vant/weapp
```

## 修改 app.json

将 `app.json` 中的 `"style": "v2"` 移除（按官方要求）。

## 修改 tsconfig.json (与官方文档不同)

如果你用 TypeScript 开发，建议在 `tsconfig.json` 里补上 `paths`，让编辑器能正确跳转到 Vant 组件源码（避免路径报红）：

```json
{
  "paths": {
    "@vant/weapp/*": ["./node_modules/@vant/weapp/dist/*"]
  }
}
```

## 使用组件

以按钮组件为例：在页面/组件的 JSON 里引入对应组件，然后在 WXML 里使用。

```json
{
  "usingComponents": {
    "van-button": "@vant/weapp/button/index"
  }
}
```

WXML：

```html
<van-button type="primary">按钮</van-button>
```

## 自动导入组件

如果你不想手写 `usingComponents`，可以开启 weapp-vite 的自动导入组件：之后你在 WXML 里写 `<van-button />`，构建器会自动补齐注册信息。

::: code-group

```ts [vite.config.ts]
import { VantResolver } from 'weapp-vite/auto-import-components/resolvers' // [!code highlight]
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoImportComponents: {
      resolvers: [VantResolver()], // [!code highlight]
    },
  },
})
```

:::

> [!TIP]
> 旧版本 weapp-vite 可能仍支持 `weapp.enhance.autoImportComponents`，但该写法已废弃，建议使用顶层 `weapp.autoImportComponents`。
