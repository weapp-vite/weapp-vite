# 自动引入组件

`weapp-vite` 可以在构建阶段自动扫描并注册组件，让你在 WXML 里直接写组件标签，而不需要手动维护 `usingComponents`。

你只需要告诉它两件事：

- 组件放在哪些目录（`globs`）
- 是否要接入第三方 UI 库（`resolvers`）

更细粒度的字段说明可参考 [配置文档 · 自动导入组件配置](/config/auto-import-components.md#weapp-autoimportcomponents)。

> [!NOTE]
> 自动导入默认开启：主包 `components/**/*.wxml` 与每个 `subPackages.<root>` 下的 `components/**/*.wxml` 都会被自动扫描。仅当你需要：
>
> - 额外扩展扫描目录；
> - 关闭自动导入（例如 `autoImportComponents: false` 或 `autoImportComponents: { globs: [] }`）；或
> - 引入第三方 UI Resolver / 生成自定义输出
>
> 时才需要手动配置 `autoImportComponents`。

## 适用场景

- 在模板里直接写 `<HelloWorld />`，而不是每次都去 JSON 里登记一次。
- 组件数量多、目录复杂，希望构建器帮忙维护 `usingComponents`。
- 同时使用 Vant、TDesign 等 UI 库，希望和本地组件一样开箱即用。

## 快速上手：扫描项目组件

虽然无需额外配置即可生效，但你仍可以通过 [`weapp.autoImportComponents.globs`](/config/auto-import-components.md#weapp-autoimportcomponents) 表达更复杂的目录结构。满足“存在 `.wxml` + `.js/ts` + `.json` 且 `json.component === true`”的文件夹就会被自动注册：

::: code-group

```ts [vite.config.ts]
export default <UserConfig>{
  weapp: {
    autoImportComponents: {
      globs: [
        'components/**/*.wxml',
        'shared/design-system/**/*.wxml',
      ],
    },
  },
}
```

:::

默认规则如下：

- 组件名取决于文件名，且大小写敏感。`HelloWorld.{wxml,ts,json}` 会注册为 `HelloWorld`。
- 如果组件命名为 `index.*`，则使用父级目录名（`HelloWorld/index.wxml → HelloWorld`）。
- 当同一目录下既有 `index.*` 又有同名文件（如 `HelloWorld/index.ts` 与 `HelloWorld/HelloWorld.ts`）时，会优先选用 `index.*` 以保证产物路径稳定。

::: warning
内置组件（`view`、`text`、[`navigation-bar`](https://developers.weixin.qq.com/miniprogram/dev/component/navigation-bar.html) 等）会被自动忽略，避免重复注册。请避免把自定义组件命名成内置组件的名字；忽略列表可在 [`builtin.auto.ts`](https://github.com/weapp-vite/weapp-vite/blob/main/packages/weapp-vite/src/auto-import-components/builtin.auto.ts) 查看。
:::

## 第三方 UI 库自动引入

若项目使用 Vant、TDesign 等 UI 组件库，可以通过 **Resolver** 声明“标签名 → npm 包”之间的映射。`weapp-vite` 默认内置常见解析器，也支持自定义：

::: code-group

```ts [vite.config.ts]
import { TDesignResolver, VantResolver } from 'weapp-vite/auto-import-components/resolvers'

export default <UserConfig>{
  weapp: {
    autoImportComponents: {
      globs: ['components/**/*.wxml'],
      resolvers: [
        VantResolver(),
        TDesignResolver(),
      ],
    },
  },
}
```

:::

配置完成后，就能直接在 `wxml` 中书写 `<van-button>`、`<t-tabs>` 等标签，构建器会自动补全 `usingComponents`。

## 自动生成的辅助文件

除了运行时的自动注册，`weapp-vite` 还会生成一些辅助产物，帮助你在 IDE 内掌控组件列表。

### 组件清单

默认会在配置文件同级目录输出 `auto-import-components.json`，列出所有自动注册的组件：

```json
{
  "HelloWorld": "/components/HelloWorld/index",
  "Navbar": "/components/Navbar/Navbar",
  "van-button": "@vant/weapp/button"
}
```

你可以通过 `autoImportComponents.output` 自定义保存位置，或传入 `false` 关闭输出：

```ts
export default <UserConfig>{
  weapp: {
    autoImportComponents: {
      globs: ['components/**/*.wxml'],
      output: 'dist/auto-import-components.json',
    },
  },
}
```

### 类型声明与 HTML 自定义数据

- `typedComponents`: 生成 `typed-components.d.ts`，提供 `componentProps`、`ComponentProp` 等类型，方便在脚本中推断组件属性。
- `htmlCustomData`: 生成 `mini-program.html-data.json`，供 VS Code、微信开发者工具读取，实现标签/属性智能提示。

```ts
export default <UserConfig>{
  weapp: {
    autoImportComponents: {
      globs: ['components/**/*.wxml'],
      typedComponents: true, // 或 'types/typed-components.d.ts'
      htmlCustomData: 'dist/mini-program.html-data.json',
    },
  },
}
```

构建器会在组件扫描、resolver 匹配的同一流程中自动刷新这些文件，无需手动触发。

## 常见疑问

- **为什么没自动注册？** 先检查组件 `json` 是否包含 `"component": true`，再确认路径是否命中了 `globs`。修改 `globs` 或新增组件后记得重启 `pnpm dev` 以刷新缓存。
- **Resolver 报错怎么办？** 请确认对应 UI 库的 npm 包已安装，并与 resolver 支持的版本匹配。只想扫描本地组件时，可以临时移除 `resolvers`。
- **如何禁用部分组件？** 结合 `include` / `exclude` 或自定义 resolver 即可实现选择性注册，详见 [自动导入组件配置](/config/auto-import-components.md#weapp-autoimportcomponents)。
