# WXS 增强

WXS（WeiXin Script）是微信小程序提供的轻量脚本语言。它语法独立于 JavaScript，功能有限，很难复用已有代码。`weapp-vite` 为此提供了实验性的扩展：让你可以用 `.wxs.js` / `.wxs.ts` 文件和内联 `lang="js/ts"` 的方式编写 WXS，再在构建阶段转换为标准 `.wxs`。本页介绍这些扩展的使用方法与限制。

> [!WARNING]
> 该能力仍处于实验阶段，仅支持部分 ES 语法。请务必编写单元测试或在开发者工具中充分验证输出结果。

## 外部文件：`.wxs.js` / `.wxs.ts`

- 在引用 WXS 时，可以把 `src` 指向 `.wxs.js` 或 `.wxs.ts`：
  ```html
  <wxs module="test" src="index.wxs.ts" />
  ```
- 构建产物中会自动生成 `index.wxs` 文件，并把 `src` 改写为 `.wxs`。
- 文件内部可以使用部分 ES 语法（如解构、`const`），但仍需遵守 WXS 运行时的限制：
  - 只能使用 `require`，不能使用 `import`。
  - 不能访问浏览器/Node API。
  - 某些语法（例如 `for...of`、`Array.prototype.map`）仍不被支持。

推荐组合 TypeScript 或 JSDoc 的类型提示，在编辑器中获得更好的开发体验。

## 内联 WXS：`lang="js"` / `lang="ts"`

在 WXML 中内联 WXS 时，可以给 `<wxs>` 标签添加 `lang` 属性，让 weapp-vite 帮你完成转译：

```html
<view>{{test.foo}}</view>
<view @tap="{{test.trigger}}">{{test.label}}</view>

<wxs module="test" lang="ts">
const { foo, bar } = require('./index.wxs.js')
const extra = require('./extra.wxs')

export const label = 'demo'

export function trigger(value: string) {
  console.log(value, label)
}

export {
  foo,
  bar,
  extra,
}
</wxs>
```

转译后会自动去除类型标注、保留 `require` 调用，并输出合法的 WXS。

## 当前支持的语法

- 变量声明：`const` / `let` / `var`
- 解构赋值、模板字符串、对象展开（大部分场景）
- 函数声明与导出（`export const`、`export function`、`export { ... }`）
- 简单的 TypeScript 类型标注（会在构建时剥离）

> [!TIP]
> 由于 WXS 不支持 Promise、`Array.isArray` 等原生方法，`weapp-vite` 不会自动 polyfill。请按照官方限制仅使用同步、轻量的逻辑。

## 调试与回退方案

- 构建产物位于 `dist/**.wxs`，可直接打开查看 weapp-vite 的转译结果。
- 若遇到构建失败或运行异常，可临时回退到手写 `.wxs` 版本，或提交 Issue 反馈不兼容的语法。
- 对于复杂逻辑，推荐改写为普通 JS/TS 工具函数，在页面脚本中使用，而不是放在 WXS 中。

随着更多反馈，我们会持续完善 WXS 转译器的兼容性和报错提示。
