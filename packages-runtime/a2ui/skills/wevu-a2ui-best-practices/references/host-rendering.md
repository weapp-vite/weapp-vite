# 静态递归宿主

小程序模板没有可靠的动态组件标签。为目录中每个组件类型预编译 `v-if` / `v-else-if` 分支；不要根据 `node.type` 拼接模板或引入 lit。

```vue
<script setup lang="ts">
import type { A2uiInteraction, A2uiNode } from '@wevu/a2ui'

const props = defineProps<{ node: A2uiNode }>()
const emit = defineEmits<{ (event: 'interaction', payload: A2uiInteraction): void }>()
defineComponentJson({
  usingComponents: { 'a2ui-node': './index' },
})
</script>

<template>
  <view v-if="props.node.type === 'Column'">
    <a2ui-node
      v-for="child in props.node.children"
      :key="child.id"
      :node="child"
      @interaction="emit('interaction', $event)"
    />
  </view>
  <text v-else-if="props.node.type === 'Text'">{{ props.node.props.text }}</text>
  <textarea
    v-else-if="props.node.type === 'TextField'"
    :value="props.node.props.value"
    @input="emit('interaction', {
      type: 'input',
      nodeId: props.node.id,
      bindingName: 'value',
      value: $event.detail.value,
    })"
  />
  <button
    v-else-if="props.node.type === 'Button'"
    @tap="emit('interaction', { type: 'action', nodeId: props.node.id })"
  >
    {{ props.node.children[0]?.props.text }}
  </button>
  <text v-else>未支持组件：{{ props.node.type }}</text>
</template>
```

业务组件在同一递归组件的 `usingComponents` 中注册，并继续按 `node.children` 渲染子节点。页面级注册与递归子组件注册缺一不可。

## 分支规则

- `children` 只覆盖直接组件节点；Tabs 等 `tabs[].child` 需在业务组件内按 props 递归。
- `key` 使用 `node.id`，让 generation 替换真正重建引用。
- 输入统一产生 `A2uiInteraction`，由页面调用 `session.interact`。
- 多输入/多动作节点必须传 `bindingName` / `actionName`。
- 校验信息用 `props.isValid` / `props.validationErrors` 展示；不要擅自阻止协议允许的动作。
- 未覆盖类型显示文本兜底，不在宿主动态生成未知组件。

## 生命周期

页面持有 session，卸载时调用 `session.dispose()`；停止监听 transport、取消页面拥有的订阅和请求。不要在 `onSurfaces` 回调内重新创建 session。

递归组件只渲染投影，不访问 Core。不要把它改成另一个数据模型或把 `A2uiNode` 当可变状态修改。

## 常见错误

- **子节点不出现**：检查 catalog 类型、`children` 与 props 深层节点两种位置。
- **input 不更新**：检查顶层可写绑定、事件 `detail.value`、generation 和 surfaceId。
- **按钮无动作**：检查 `node.actions`、动作属性名和多动作选择。
- **替换后旧输入错位**：不要跨 generation 缓存投影前的 Core 节点 ID 或协议 `componentId`；使用当前投影 id 重建。
- **错误提示不消失**：Core 可能把校验结果投影到 props，宿主需消费 `validationErrors`。
