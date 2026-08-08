# React 小程序支持

weapp-vite 提供 React 19 小程序运行时，使用 `@weapp-vite/react` 与项目级 `weapp.react` 配置。

```ts
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  weapp: {
    react: {
      renderMode: 'auto',
      compiler: false,
    },
  },
})
```

React 项目中的 `.jsx` 和 `.tsx` 会由 React 编译链统一处理，不能与同一构建中的 Wevu JSX 混用。运行时使用 React 19.2.x 和 `react-reconciler` 0.33.x，不依赖 `react-dom`。

## 原生与 Wevu 组件

先在页面或组件 JSON 中注册小程序自定义组件，再在当前 TSX 文件顶层创建类型安全的 bridge：

```json
{
  "usingComponents": {
    "native-card": "/components/native-card/index",
    "wevu-card": "/components/wevu-card/index"
  }
}
```

```tsx
import type { HostEventHandler } from '@weapp-vite/react'
import { createNativeComponent, Text, View } from '@weapp-vite/react'

interface CardProps {
  label: string
  onValueChange?: HostEventHandler
  value: number
}

const NativeCard = createNativeComponent<CardProps>('native-card')
const WevuCard = createNativeComponent<CardProps>('wevu-card')

export function PageView() {
  return (
    <View>
      <NativeCard label="原生组件" value={1} onValueChange={handleChange}>
        <Text>默认插槽内容</Text>
      </NativeCard>
      <WevuCard label="Wevu 组件" value={2} onValueChange={handleChange} />
    </View>
  )
}
```

事件按小程序语义映射：`onValueChange` 生成 `bind:value-change`，`onValueChangeCapture` 生成 `capture-bind:value-change`。动态 props 通过 static binding 更新，普通 React children 投影到自定义组件默认插槽。

React-backed 小程序组件可以通过 `Slot` 声明自己的默认插槽：

```tsx
import { Slot, View } from '@weapp-vite/react'

export function CardView() {
  return <View><Slot /></View>
}
```

bridge 声明必须位于当前 TSX 顶层，tag 必须是非空字符串字面量，并与所属 JSON 的 `usingComponents` 同名。首版不支持跨文件 bridge 声明、条件或列表中的 bridge、作用域插槽和双向 model；`renderMode: 'auto'` 遇到这些动态结构会直接给出编译错误，不会退回无法渲染自定义组件的 dynamic tree。

React 项目需要编译 `.vue` Wevu SFC 时，应显式安装 `wevu`。构建仍由 React owner 处理 `.jsx/.tsx`，由 Wevu compiler 处理 `.vue`；Wevu 组件使用 `defineComponentJson` 注册其原生依赖，不使用 Web Vue 全局注册或 scoped slot 语义。这样 React、Wevu 和原生组件都可以作为小程序自定义组件相互引用。

`renderMode: 'auto'` 会把可以证明稳定的 JSX 结构生成原生 WXML 和 binding slots，不含 bridge 的动态结构由 reconciler 的 dynamic tree 处理。排查兼容性时可以使用 `dynamic`；`static` 会在遇到无法静态证明的结构时直接报告诊断。

React Compiler 默认关闭。开启方式：

```ts
export default defineConfig({
  weapp: {
    react: {
      compiler: {
        engine: 'swc',
        compilationMode: 'infer',
      },
    },
  },
})
```

Compiler 依赖可选的 `@swc/core`。native transform 不可用时会回退到 Oxc JSX transform，并输出带文件位置的 warning。

首版目标平台为微信小程序；支付宝和抖音平台暂不在 React runtime 兼容范围内。
