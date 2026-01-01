# WXML 增强

`weapp-vite` 对 WXML 做了两类增强：

- **自动收集 WXML 依赖**：把 `import` / `include` 引到的模板文件自动带进产物
- **事件语法糖（可选）**：允许写 `@tap="fn"`，构建时自动转换成原生 `bind:tap`

这页介绍它们的工作方式，以及在你不需要时如何关闭。

## 静态分析与额外文件

默认情况下，框架会扫描页面、组件、分包目录，解析 `import` / `include` 中的 `src`，将对应的 WXML 文件复制到产物目录，并保持路径一致。

> [!IMPORTANT]
> 该分析是静态的，无法推断运行时动态拼接的路径。如果项目存在“通过 JS 变量拼接模板路径”的需求，请使用 [`weapp.isAdditionalWxml`](/config/paths.md#weapp-isadditionalwxml) 显式列出这些额外文件。

常见做法是把“运行时才会用到的模板”统一放在一个目录，然后在配置里标记：

```ts
export default defineConfig({
  weapp: {
    isAdditionalWxml(wxmlPath) {
      return wxmlPath.startsWith('src/templates/')
    },
  },
})
```

## 事件绑定语法糖（可选）

开启 `weapp.wxml` 后，可以使用类似 Vue 的 `@` 语法，weapp-vite 会在构建时转换为原生事件写法：

```html
<!-- 源代码 -->
<view @tap="hello"></view>
<!-- 编译结果 -->
<view bind:tap="hello"></view>
```

对应关系示例：

| 写法                                        | 转换结果            |
| ------------------------------------------- | ------------------- |
| `@tap`                                      | `bind:tap`          |
| `@tap.catch`                                | `catch:tap`         |
| `@tap.mut`                                  | `mut-bind:tap`      |
| `@tap.capture`                              | `capture-bind:tap`  |
| `@tap.capture.catch` / `@tap.catch.capture` | `capture-catch:tap` |

更多事件类型可参考[官方事件分类](https://developers.weixin.qq.com/miniprogram/dev/framework/view/wxml/event.html)。

> [!WARNING]
> 某些第三方 WXML 插件的格式化功能可能无法识别 `@tap` 等语法糖。如果你更偏好官方标准写法，建议关闭该功能。

## 如何关闭或定制

不需要事件语法糖时，可以在 `vite.config.ts` 中关闭：

```ts
export default defineConfig({
  weapp: {
    wxml: {
      transformEvent: false,
    },
  },
})
```

你也可以结合 `include` / `exclude` 让语法糖仅作用于部分目录，细节见 [WXML 配置](/config/wxml.md#weapp-wxml)。
