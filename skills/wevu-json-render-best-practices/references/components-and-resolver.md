# 组件包、Resolver 与自定义节点

## 两个包的所有权

- `@wevu/json-render`：ESM runtime、catalog/spec、响应式会话、动作和流。
- `@wevu/json-render-components`：`dist/miniprogram` 预编译 renderer/fallback，以及 `RenderNode` / `RendererEvent` 类型定义；主 runtime 包也公开重导出这些类型。

消费应用必须把两者都放进 `dependencies`。小程序 npm 构建按应用显式依赖识别原生组件；只在主包的 transitive dependency 中出现不够。

仓库内构建顺序：

```sh
pnpm --filter @wevu/json-render-components build
pnpm --filter @wevu/json-render build
pnpm --filter <宿主应用> build
```

## 注册 renderer

```ts
import { JsonRendererResolver } from '@wevu/json-render/resolver'
import { defineConfig } from 'weapp-vite/config'

export default defineConfig({
  weapp: {
    autoImportComponents: { resolvers: [JsonRendererResolver()] },
  },
})
```

`/resolver` 是独立构建入口，不属于 AppService runtime。没有 `weapp-vite` 时不要凭空创建 `weapp` 配置；先检查项目现有构建方式。

## 页面模板

```vue
<script setup lang="ts">
definePageJson({
  usingComponents: { 'business-node': '/components/business-node/index' },
})
// tree 来自 renderer，onNodeEvent 由页面转给 renderer.dispatch。
</script>

<template>
  <json-renderer
    v-if="tree"
    :node="tree"
    generic:custom-node="business-node"
    @node-event="onNodeEvent"
  />
</template>
```

- `json-renderer` 递归消费 `RenderNode`，`custom-node` 泛型逐层传递。
- 自定义类型必须在页面/组件 JSON 中静态注册；未注册分支不能靠运行时拼 tag 解决。
- 业务组件默认 `<slot />` 只接收已经投影的子节点，不重新解释 spec。

## 业务节点事件

```vue
<script setup lang="ts">
import type { RendererEvent, RenderNode } from '@wevu/json-render'

const props = defineProps<{ node: RenderNode }>()
const emit = defineEmits<{ (event: 'node-event', payload: RendererEvent): void }>()

function increase() {
  emit('node-event', { id: props.node.id, name: 'increase' })
}
</script>

<template>
  <view v-if="props.node.type === 'Counter'">
    <text>{{ props.node.props.value }}</text>
    <button @tap="increase">增加</button>
  </view>
</template>
```

Wevu 自定义事件会解包 `detail`；原生 input 仍读取 `event.detail.value`。不要在业务组件里再次解析 `detail.detail`。

## 常见错误

- **白屏/组件不存在**：两个依赖是否都在应用 `dependencies`；组件包是否先构建；resolver 是否注册；产物是否包含 renderer/fallback。
- **自定义节点不显示**：catalog 是否声明类型、页面 JSON 是否静态注册、`generic:custom-node` 是否逐层传递。
- **事件丢失**：业务节点是否发出 `node-event`，页面是否交给 `renderer.dispatch`，节点 ID 是否仍可见。
- **状态不更新**：是否统一走 `dispatch` / `setState`，避免业务组件直接改内部状态。
- **递归属性串数据**：检查对象引用是否在组件边界隔离，不在模板里共享可变节点对象。
