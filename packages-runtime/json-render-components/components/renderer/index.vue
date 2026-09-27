<script setup lang="ts">
import type { RendererEvent, RenderNode } from '../../src/types'
import { computed } from 'wevu'

const props = defineProps<{ node: RenderNode }>()
const emit = defineEmits<{ (event: 'node-event', payload: RendererEvent): void }>()
defineComponentJson({
  usingComponents: { 'json-render-node': './index', 'json-render-fallback': '../fallback/index' },
  componentGenerics: { 'custom-node': { default: '../fallback/index' } },
})
function forward(event: RendererEvent) {
  emit('node-event', event)
}
function input(event: WechatMiniprogram.Input) {
  emit('node-event', { id: props.node.id, name: 'input', value: event.detail.value })
}
function press() {
  emit('node-event', { id: props.node.id, name: 'press' })
}
const display = computed(() => {
  const values = props.node?.props ?? {}
  return {
    title: String(values.title ?? ''),
    text: String(values.text ?? ''),
    label: String(values.label ?? ''),
    placeholder: String(values.placeholder ?? ''),
    value: String(values.value ?? ''),
    disabled: values.disabled === true,
  }
})
</script>

<template>
  <view v-if="props.node.type === 'Stack' || props.node.type === 'Card'" :class="props.node.type === 'Card' ? 'card' : 'stack'">
    <text v-if="props.node.type === 'Card'" class="card-title">{{ display.title }}</text>
    <json-render-node v-for="child in props.node.children" :key="child.id" generic:custom-node="custom-node" :node="child" @node-event="forward" />
  </view>
  <text v-else-if="props.node.type === 'Text'" :id="props.node.id" class="copy">{{ display.text }}</text>
  <view v-else-if="props.node.type === 'Input'" class="field">
    <text class="label">{{ display.label }}</text>
    <input :id="props.node.id" :value="display.value" :placeholder="display.placeholder" @input="input">
  </view>
  <button v-else-if="props.node.type === 'Button'" :id="props.node.id" :disabled="display.disabled" class="primary" @tap="press">{{ display.label }}</button>
  <custom-node v-else :node="props.node" @node-event="forward">
    <json-render-node v-for="child in props.node.children" :key="child.id" generic:custom-node="custom-node" :node="child" @node-event="forward" />
  </custom-node>
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
