# @weapp-vite/react

`@weapp-vite/react` 是 `weapp-vite` 的 React 19 小程序 renderer，提供 `View`、`Text`、`Button`、`Input` 等 host components，以及原生自定义组件互操作能力。

## 自定义组件 bridge

```tsx
import { createNativeComponent, Slot } from '@weapp-vite/react'

interface CardProps {
  label: string
  onValueChange?: (event: { detail: { value: number } }) => void
  value: number
}

const NativeCard = createNativeComponent<CardProps>('native-card')

export function ReactLeaf() {
  return <Slot />
}
```

bridge tag 必须在当前 TSX 顶层通过字符串字面量声明，并在页面或组件 JSON 的 `usingComponents` 中注册。动态 props、默认 slot 和自定义事件均由静态模板编译器处理：`onValueChange` 映射为 `bind:value-change`，`onValueChangeCapture` 映射为 `capture-bind:value-change`。

首版不支持 bridge 组件出现在条件或列表等动态结构中，也不支持跨文件 bridge 声明、scoped slot、model 或动态 tag。`renderMode: 'auto'` 遇到这类结构会直接报告可操作的编译错误。

React 项目需要使用 Wevu SFC 时，应同时安装 `wevu` 并启用 Vue 编译。React TSX 仍由 React owner 处理，`.vue` 由 Wevu compiler 处理；编译后的 Wevu 组件通过同一 bridge API 引用。

完整配置和示例见 [React 小程序接入](https://vite.weapp.dev/integration/react)。
