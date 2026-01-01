# tdesign-miniprogram 集成

在 `weapp-vite` 项目里接入 `tdesign-miniprogram` 的整体思路很简单：

- 安装依赖
- 按官方文档完成基础配置
- （可选）开启 weapp-vite 的自动导入组件，让你不用手写 `usingComponents`

官方快速开始：<https://tdesign.tencent.com/miniprogram/getting-started>

## 安装包

```sh
pnpm add tdesign-miniprogram
```

如果你的 `tdesign-miniprogram` 版本 `>= 1.9.0`，还需要安装 `tslib`：

```sh
pnpm add -D tslib
```

## 构建成功后勾选 `将 JS 编译成 ES5`

在微信开发者工具的“详情”里勾选 `将 JS 编译成 ES5`（按官方建议配置即可）。

## 修改 app.json

将 `app.json` 中的 `"style": "v2"` 移除（按官方要求）。

## 修改 tsconfig.json (与官方文档不同)

如果你用 TypeScript 开发，建议在 `tsconfig.json` 里补上 `paths`，让编辑器能正确跳转到组件源码（避免路径报红）：

```json
{
  "paths": {
    "tdesign-miniprogram/*": ["./node_modules/tdesign-miniprogram/miniprogram_dist/*"]
  }
}
```

## 使用组件

以按钮组件为例：在页面/组件的 JSON 里引入对应组件，然后在 WXML 里使用。

```json
{
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button"
  }
}
```

WXML：

```html
<t-button theme="primary">按钮</t-button>
```

## 自动导入组件

如果你不想手写 `usingComponents`，可以开启 weapp-vite 的自动导入组件：之后你在 WXML 里写 `<t-button />` 这类标签，构建器会自动补齐注册信息。

::: code-group

```ts [vite.config.ts]
import { TDesignResolver } from 'weapp-vite/auto-import-components/resolvers' // [!code highlight]
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoImportComponents: {
      resolvers: [TDesignResolver()], // [!code highlight]
    },
  },
})
```

:::

> [!TIP]
> 旧版本 weapp-vite 可能仍支持 `weapp.enhance.autoImportComponents`，但该写法已废弃，建议使用上面的顶层 `weapp.autoImportComponents`。
