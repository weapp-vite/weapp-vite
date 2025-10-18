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
- 当同一目录下同时存在 `index.*` 与同名文件（例如 `HelloWorld/index.ts` 与 `HelloWorld/HelloWorld.ts`）时，`index.*` 会被优先采用，保证输出路径稳定。

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

## 自动导出组件清单

编译器会在扫描时同步生成一份 `auto-import-components.json` 清单，包含“本地扫描到的组件”与“resolver 提供的第三方组件”映射，方便在 IDE 中做补全或排查丢失的组件。默认情况下文件会输出到配置文件同级目录，结构类似：

```json
{
  "HelloWorld": "/components/HelloWorld/index",
  "Navbar": "/components/Navbar/Navbar",
  "van-button": "@vant/weapp/button"
}
```

可通过 `autoImportComponents.output` 控制清单行为：

```ts
export default <UserConfig>{
  weapp: {
    enhance: {
      autoImportComponents: {
        globs: ['components/**/*'],
        output: 'dist/auto-import-components.json', // 自定义输出位置
        // output: false  // 若不需要清单，可显式关闭
      },
    },
  },
}
```

- 传入相对路径会基于 `vite.config.ts` 所在目录展开；
- 传入绝对路径则写入指定位置；
- 设置为 `false` 可完全关闭清单输出。

## 生成类型声明与 HTML 自定义数据

为了获得更好的 IDE 体验，可以启用以下两个可选产物：

- `typed-components.d.ts`：导出 `weapp-vite/typed-components` 模块，包含 `componentProps`、`ComponentProp` 等类型，方便在脚本中做属性推断或二次封装。
- `mini-program.html-data.json`：兼容 VS Code 与微信开发者工具的 HTML 自定义数据格式，为 WXML 提供标签/属性提示与描述。

在配置里开启对应选项即可（可以传入布尔值或自定义输出路径）：

```ts
export default <UserConfig>{
  weapp: {
    enhance: {
      autoImportComponents: {
        globs: ['components/**/*'],
        typedComponents: true, // 或 'types/typed-components.d.ts'
        htmlCustomData: 'dist/mini-program.html-data.json',
      },
    },
  },
}
```

启用后，编译器在组件扫描、resolver 匹配过程中会实时刷新上述文件，确保类型与提示始终和组件清单保持一致。
