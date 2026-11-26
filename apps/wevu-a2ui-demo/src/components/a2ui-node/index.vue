<script setup lang="ts">
import type { A2uiInteraction, A2uiNode, A2uiPropValue } from '@wevu/a2ui'
import { computed } from 'wevu'

const props = defineProps<{ node: A2uiNode }>()
const emit = defineEmits<{ (event: 'interaction', payload: A2uiInteraction): void }>()
defineComponentJson({
  usingComponents: {
    'a2ui-node': './index',
    'a2ui-order': '/components/a2ui-order/index',
  },
})

const display = computed(() => {
  const values = props.node?.props ?? {}
  return {
    text: String(values.text ?? ''),
    label: String(values.label ?? ''),
    value: String(values.value ?? ''),
    placeholder: String(values.placeholder ?? ''),
    number: String(values.number ?? ''),
    product: String(values.product ?? ''),
    amount: String(values.amount ?? ''),
  }
})
const isCaption = computed(() => props.node.type === 'Text' && props.node.props.variant === 'caption')
const isLongText = computed(() => props.node.type === 'TextField' && props.node.props.variant === 'longText')
const isInvalid = computed(() => props.node.props.isValid === false)
const validationMessage = computed(() => {
  const errors = props.node.props.validationErrors
  return Array.isArray(errors)
    ? errors.filter((error): error is string => typeof error === 'string').join('；')
    : ''
})
const validationErrorId = computed(() => `${props.node.componentId}-error`)
const fieldClass = computed(() => isInvalid.value ? 'a2ui-field a2ui-field--invalid' : 'a2ui-field')
const buttonClass = computed(() => {
  const variant = props.node.props.variant === 'primary' ? 'a2ui-button a2ui-button--primary' : 'a2ui-button'
  return isInvalid.value ? `${variant} a2ui-button--invalid` : variant
})
const buttonLabel = computed(() => String(props.node.children.find(child => child.type === 'Text')?.props.text ?? ''))

function isNode(value: A2uiPropValue | undefined): value is A2uiNode {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && 'id' in value
    && typeof value.id === 'string'
    && 'componentId' in value
    && typeof value.componentId === 'string'
    && 'type' in value
    && typeof value.type === 'string'
}

const tabs = computed(() => {
  const value = props.node.props.tabs
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((tab, index) => {
    if (!tab || typeof tab !== 'object' || Array.isArray(tab) || isNode(tab) || !isNode(tab.child)) {
      return []
    }
    return [{ id: `${props.node.id}-tab-${index}`, title: String(tab.title ?? ''), child: tab.child }]
  })
})

function input(event: WechatMiniprogram.Input) {
  emit('interaction', { type: 'input', nodeId: props.node.id, bindingName: 'value', value: event.detail.value })
}
function tap() {
  emit('interaction', { type: 'action', nodeId: props.node.id })
}
</script>

<template>
  <view v-if="props.node.type === 'Column' || props.node.type === 'List'" :class="props.node.type === 'List' ? 'a2ui-list' : 'a2ui-column'">
    <a2ui-node
      v-for="child in props.node.children"
      :key="child.id"
      :node="child"
      @interaction="emit('interaction', $event)"
    />
  </view>
  <view v-else-if="props.node.type === 'Card'" class="a2ui-card">
    <a2ui-node
      v-for="child in props.node.children"
      :key="child.id"
      :node="child"
      @interaction="emit('interaction', $event)"
    />
  </view>
  <view v-else-if="props.node.type === 'Tabs'" class="a2ui-tabs">
    <view v-for="tab in tabs" :key="tab.id" class="a2ui-tab">
      <text class="a2ui-tab__title">{{ tab.title }}</text>
      <a2ui-node :node="tab.child" @interaction="emit('interaction', $event)" />
    </view>
  </view>
  <text
    v-else-if="props.node.type === 'Text'"
    :id="props.node.componentId"
    :class="isCaption ? 'a2ui-caption' : 'a2ui-copy'"
  >
    {{ display.text }}
  </text>
  <view v-else-if="props.node.type === 'TextField'" :class="fieldClass">
    <text class="a2ui-label">{{ display.label }}</text>
    <textarea
      v-if="isLongText"
      :id="props.node.componentId"
      class="a2ui-textarea"
      :value="display.value"
      :placeholder="display.placeholder"
      @input="input"
    />
    <input
      v-else
      :id="props.node.componentId"
      class="a2ui-input"
      :value="display.value"
      :placeholder="display.placeholder"
      @input="input"
    >
    <text v-if="isInvalid && validationMessage" :id="validationErrorId" class="a2ui-error">
      {{ validationMessage }}
    </text>
  </view>
  <block v-else-if="props.node.type === 'Button'">
    <button
      :id="props.node.componentId"
      :class="buttonClass"
      @tap="tap"
    >
      {{ buttonLabel }}
    </button>
    <text v-if="isInvalid && validationMessage" :id="validationErrorId" class="a2ui-error">
      {{ validationMessage }}
    </text>
  </block>
  <a2ui-order
    v-else-if="props.node.type === 'OrderSummary'"
    :number="display.number"
    :product="display.product"
    :amount="display.amount"
  />
  <text v-else :id="props.node.componentId" class="a2ui-unknown">未支持组件：{{ props.node.type }}</text>
</template>

<style>
.a2ui-column,
.a2ui-list,
.a2ui-card {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.a2ui-card {
  padding: 32rpx;
  background: #fff;
  border: 1rpx solid #e4e3dc;
  border-radius: 24rpx;
}

.a2ui-tabs {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.a2ui-tab {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 24rpx;
  background: #f4f6f1;
  border-radius: 16rpx;
}

.a2ui-tab__title {
  font-size: 28rpx;
  font-weight: 600;
  color: #234f3c;
}

.a2ui-copy {
  display: block;
  font-size: 28rpx;
  line-height: 1.6;
  color: #253529;
}

.a2ui-caption {
  display: block;
  font-size: 24rpx;
  line-height: 1.5;
  color: #687160;
}

.a2ui-label {
  display: block;
  margin-bottom: 18rpx;
  font-size: 28rpx;
}

.a2ui-input,
.a2ui-textarea {
  width: 100%;
  padding: 0 20rpx;
  font-size: 28rpx;
  border: 1rpx solid #d9dcd3;
  border-radius: 12rpx;
}

.a2ui-input {
  height: 88rpx;
}

.a2ui-textarea {
  height: 152rpx;
  padding: 20rpx;
}

.a2ui-field--invalid .a2ui-input,
.a2ui-field--invalid .a2ui-textarea {
  border-color: #a03528;
}

.a2ui-error {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #a03528;
}

.a2ui-button {
  width: 100%;
  font-size: 28rpx;
  border-radius: 12rpx;
}

.a2ui-button--primary {
  color: #fff;
  background: #234f3c;
}

.a2ui-button--invalid {
  opacity: 0.6;
}

.a2ui-unknown {
  display: block;
  font-size: 24rpx;
  color: #a03528;
}
</style>
