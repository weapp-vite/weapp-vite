# 自动引入组件

`weapp-vite` 支持你直接在 `wxml` 使用组件，无需在 `json` 配置中进行注册

## 项目中的组件自动引入

此方式会自动扫描 `autoImportComponents.globs` 中范围覆盖到组件，自动注册到上下文中

::: code-group

```ts [vite.config.ts]
export default <UserConfig>{
  weapp: {
    enhance: {
      autoImportComponents: {
        globs: ['components/**/*'],
      },
    },
  },
}
```

:::

识别组件的方式为存在 `wxml` 和 `js/ts` 还有 `json` 文件，且 `json` 的 `component` 字段为 `true`

默认是根据文件的名字进行注册的，区分大小写，比如 `HelloWorld.wxml`,`HelloWorld.js`,`HelloWorld.json` 就注册为 `HelloWorld` 组件

假如你使用的是 `index.wxml`,`index.js`,`index.json` 那就取父目录的名字，比如 `HelloWorld/index.json` 中的 `HelloWorld` 进行注册。

:::warning
注意，自动导入组件这个行为，会自动忽略小程序内置组件，比如 `view`, `text`, [`navigation-bar`](https://developers.weixin.qq.com/miniprogram/dev/component/navigation-bar.html) 等等（所有的标签详见 [官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/) ）

所以你组件不能起和这些同名，忽略内建组件的数据详情见 [`builtin.auto.ts` 源代码](https://github.com/weapp-vite/weapp-vite/blob/main/packages/weapp-vite/src/auto-import-components/builtin.auto.ts)
:::

## 第三方UI库的组件自动引入

可通过定义 `Resolver` 来自动导入第三方组件，目前 `weapp-vite` 中内置了 `TDesign` 和 `Vant` 的支持

你可以通过自定义 `Resolver` 来支持任意的小程序框架

::: code-group

```ts [vite.config.ts]
import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers' // [!code highlight]

export default <UserConfig>{
  weapp: {
    enhance: {
      autoImportComponents: {
        resolvers: [
          VantResolver(), // [!code highlight]
          TDesignResolver() // [!code highlight]
        ],
      },
    },
  },
}
```

:::

这样你就可以直接在 `wxml` 中使用对应 `UI` 库的组件了！
