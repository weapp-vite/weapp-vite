---
title: '@weapp-vite/react'
description: React 19 小程序 renderer 与原生组件 bridge。
keywords: [weapp-vite, react, jsx, tsx, mini-program]
---

# @weapp-vite/react

`@weapp-vite/react` 是 React 19 小程序 renderer，提供 host components 和原生自定义组件 bridge。完整接入仍由 `weapp-vite` 的 `weapp.react` 配置负责。

## 安装与最小用法

```bash
pnpm add react react-reconciler @weapp-vite/react
```

```tsx
import { Button, Text, View } from '@weapp-vite/react'

export function Home() {
  return (
    <View>
      <Text>Ready</Text>
      <Button onTap={() => console.log('tap')}>Open</Button>
    </View>
  )
}
```

原生组件 bridge 必须在当前 TSX 文件顶层使用字符串字面量声明，并在页面/组件 JSON 的 `usingComponents` 中注册：

```tsx
import { createNativeComponent } from '@weapp-vite/react'

const NativeCard = createNativeComponent<{ label: string }>('native-card')
```

## AI 选择提示

React 项目不要安装 `react-dom`。React TSX 和 Wevu `.vue` 各由自己的编译 owner 处理；动态 tag、scoped slot 和跨文件 bridge 声明当前不支持。
