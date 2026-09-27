<script setup lang="ts">
import type { NodeEvent, RenderNode } from '../../runtime/projection'
import { trackSetData } from '../../runtime/metrics'

const props = defineProps<{ node: RenderNode }>()
const emit = defineEmits<{ (event: 'node-event', payload: NodeEvent): void }>()
trackSetData()
defineComponentJson({
  usingComponents: { 'spec-node': '/components/spec-node/index', 'order-summary': '/components/order-summary/index' },
})
function forward(event: NodeEvent) {
  emit('node-event', event)
}
function input(event: WechatMiniprogram.Input) {
  emit('node-event', { id: props.node.id, name: 'input', value: event.detail.value })
}
function press() {
  emit('node-event', { id: props.node.id, name: 'press' })
}
</script>

<template>
  <view v-if="props.node.type === 'Stack' || props.node.type === 'Card'" :class="props.node.type === 'Card' ? 'card' : 'stack'">
    <text v-if="props.node.type === 'Card'" class="card-title">{{ props.node.props.title }}</text>
    <spec-node v-for="child in props.node.children" :key="child.id" :node="child" @node-event="forward" />
  </view>
  <text v-else-if="props.node.type === 'Text'" :id="props.node.id" class="copy">{{ props.node.props.text }}</text>
  <view v-else-if="props.node.type === 'Input'" class="field">
    <text class="label">{{ props.node.props.label }}</text>
    <input :id="props.node.id" :value="props.node.props.value" :placeholder="props.node.props.placeholder" @input="input">
  </view>
  <button v-else-if="props.node.type === 'Button'" :id="props.node.id" :disabled="props.node.props.disabled" class="primary" @tap="press">{{ props.node.props.label }}</button>
  <order-summary v-else-if="props.node.type === 'OrderSummary'" :number="props.node.props.number" :product="props.node.props.product" :amount="props.node.props.amount" />
</template>

<style scoped>
.stack, .card {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.card {
  padding: 32rpx;
  background: #fff;
  border: 1rpx solid #e4e3dc;
  border-radius: 24rpx;
}

.card-title {
  font-size: 34rpx;
  font-weight: 600;
}

.copy {
  display: block;
  font-size: 26rpx;
  line-height: 1.6;
  color: #62675e;
}

.label {
  display: block;
  margin-bottom: 18rpx;
  font-size: 28rpx;
}

input {
  height: 88rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #d9dcd3;
  border-radius: 12rpx;
}

.primary {
  width: 100%;
  font-size: 28rpx;
  color: #fff;
  background: #234f3c;
  border-radius: 12rpx;
}
</style>
