<script setup lang="ts">
import type { RendererEvent, RenderNode } from '@wevu/json-render'
import { computed } from 'wevu'

const props = defineProps<{ node: RenderNode }>()
const emit = defineEmits<{ (event: 'node-event', payload: RendererEvent): void }>()
function inspect() {
  emit('node-event', { id: props.node.id, name: 'inspect' })
}
defineComponentJson({ usingComponents: { 'order-summary': '/components/order-summary/index' } })
const order = computed(() => ({
  number: String(props.node?.props.number ?? ''),
  product: String(props.node?.props.product ?? ''),
  amount: String(props.node?.props.amount ?? ''),
}))
</script>

<template>
  <view v-if="props.node.type === 'OrderSummary'">
    <order-summary :number="order.number" :product="order.product" :amount="order.amount" />
    <button id="inspect-order" size="mini" @tap="inspect">查看订单信息</button>
  </view>
</template>
