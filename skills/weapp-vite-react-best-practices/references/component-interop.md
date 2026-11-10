# React 组件互操作

## 页面 root

- 在原生 `Page`/`Component` 入口中调用 `createReactMiniProgramRoot(this, options)`。
- 将 React 视图保持在相邻 `.tsx` 模块，通过 `root.render(...)` 挂载。
- 把宿主事件交给 `root.dispatchEvent(event)`，并在 `onUnload` / detached 阶段调用 `root.unmount()`。
- root 及其事件转发由当前页面/组件实例持有；不要让同一路由的多个栈实例共享模块级 root，卸载一个实例不能销毁另一个。
- `createReactMiniProgramRoot`、`createNativeComponent`、`Slot`、host components 与 `HostEventHandler` 都从 `@weapp-vite/react` 的公开入口导入，React hooks / `createElement` 从 `react` 导入。
- runtime root 不会自行生成 WXML 或 JSON；先使用项目已有且匹配的模板产物。若要从 TSX 生成这些产物，需显式安装并配置 `weapp-vite`，不能只安装 renderer 就省略编译链。
- 不要把 `weapp.react.renderMode: 'auto' | 'static' | 'dynamic'` 直接传给 root。公开 `ReactMiniProgramRootOptions.renderMode` 使用 `'static-bindings' | 'tree'`，默认是 `'tree'`；手写宿主入口时必须与已有模板/binding 产物匹配，不能只改 root 参数切换编译模式。项目编译模式选择见 `config-and-render-modes.md`。

## 原生与 Wevu bridge

1. 在当前页面或组件 JSON 的 `usingComponents` 注册 tag。
2. 在当前 TSX 顶层用非空字符串字面量调用 `createNativeComponent<Props>(tag)`。
3. 保持 bridge tag 与 JSON key 完全一致。
4. 使用 `HostEventHandler` 描述小程序事件，并从 `event.detail` 读取业务 payload。

例如项目已有 `/components/native-card/index` 原生组件，且它发送 `value-change`、`detail.value` 为数字时：

```json
{
  "usingComponents": {
    "native-card": "/components/native-card/index"
  }
}
```

```tsx
import type { HostEventHandler } from '@weapp-vite/react'
import { createNativeComponent, Text } from '@weapp-vite/react'
import { useState } from 'react'

const NativeCard = createNativeComponent<{
  value: number
  onValueChange?: HostEventHandler
}>('native-card')

export function CardView() {
  const [value, setValue] = useState(0)
  return (
    <NativeCard value={value} onValueChange={event => setValue(Number(event.detail.value))}>
      <Text>{value}</Text>
    </NativeCard>
  )
}
```

该例需要 `weapp-vite` 的静态模板编译；路径指向消费项目真实组件，不是框架仓库 fixture。换成 Wevu SFC 时另需安装 `wevu`，并保持当前 JSON tag、文件路径和实际事件一致。

事件映射：

- `onValueChange` -> `bind:value-change`
- `onValueChangeCapture` -> `capture-bind:value-change`

## 当前限制

- 不在条件、列表或其他动态结构中创建 bridge。
- 不跨文件声明或 re-export bridge。
- 不使用 scoped slot、双向 model 或动态 tag。
- React-backed 小程序组件只通过 `Slot` 声明默认插槽。
- 若 `usingComponents` 缺失、tag 不一致或选择 dynamic mode，让编译直接失败并修正契约，不加运行时兜底。
