# 自动引入组件

`weapp-vite` 可以在编译阶段自动扫描并注册组件，使你在 WXML 中直接使用组件标签而无需手动写入 `usingComponents`。下文分为“本地组件扫描”与“第三方 UI 解析器”两部分，更多字段说明可参考 [配置文档 · 增强能力与调试工具](/config/enhance-and-debug.md#weapp-enhance)。

## 项目中的组件自动引入

通过配置 [`weapp.enhance.autoImportComponents.globs`](/config/enhance-and-debug.md#weapp-enhance) 可以让编译器扫描指定目录，在满足“同时存在 `.wxml` + `.js/ts` + `.json` 且 `json.component === true`”的情况下自动注册组件。

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

默认注册规则如下：

- 组件标识取决于文件名，且大小写敏感。例如 `HelloWorld.{wxml,ts,json}` 会注册为 `HelloWorld`。
- 如果组件文件命名为 `index.*`，则使用其父级目录名作为组件名，如 `HelloWorld/index.wxml → HelloWorld`。

:::warning
注意，自动导入组件这个行为，会自动忽略小程序内置组件，比如 `view`, `text`, [`navigation-bar`](https://developers.weixin.qq.com/miniprogram/dev/component/navigation-bar.html) 等等（所有的标签详见 [官方文档](https://developers.weixin.qq.com/miniprogram/dev/component/) ）

所以你组件不能起和这些同名，忽略内建组件的数据详情见 [`builtin.auto.ts` 源代码](https://github.com/weapp-vite/weapp-vite/blob/main/packages/weapp-vite/src/auto-import-components/builtin.auto.ts)
:::

## 第三方UI库的组件自动引入

对于第三方 UI 库，可通过 **Resolver** 提供个性化规则。目前内置支持 TDesign 与 Vant，也可以编写自定义 Resolver 来适配其他生态。

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
