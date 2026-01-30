# WXML 增强

`weapp-vite` 对 WXML 做了两类增强：

- **自动收集 WXML 依赖**：把 `import` / `include` 引到的模板文件自动带进产物
- **事件语法糖（可选）**：允许写 `@tap="fn"`，构建时自动转换成原生 `bind:tap`

这页介绍它们的工作方式，以及在你不需要时如何关闭。

## 静态分析与额外文件

默认情况下，框架会扫描页面、组件、分包目录，解析 `import` / `include` 中的 `src`，将对应的 WXML 文件复制到产物目录，并保持路径一致。

> [!IMPORTANT]
> 该分析是静态的，无法推断运行时动态拼接的路径。当前版本的 `weapp.isAdditionalWxml` 仍为预留字段，**不会参与扫描**。如果必须走动态路径，请确保这些模板能通过某个固定的 `import` / `include` 被引用，或在构建流程中自行补充产物。

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
> 某些第三方 WXML 插件的格式化功能可能无法识别 `@tap` 等语法糖。当前版本暂无单独开关，建议直接使用原生 `bind:` 写法规避冲突。

## 当前可配置的范围

目前 `weapp.wxml` 仅影响 **扫描阶段**（`excludeComponent` / `platform`），模板处理阶段的 `transformEvent` / `removeComment` 等选项尚未接入，详见 [WXML 配置](/config/wxml.md#weapp-wxml)。
