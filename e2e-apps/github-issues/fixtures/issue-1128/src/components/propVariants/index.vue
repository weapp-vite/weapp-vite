<script setup lang="ts">
import type { PropType } from 'wevu'
import { computed, shallowRef } from 'wevu'

const props = defineProps({
  label: { type: String, required: true },
  total: { type: Number, required: true },
  payload: { type: Object as PropType<{ label: string }>, required: true },
  items: { type: Array as PropType<string[]>, required: true },
  // 原生 properties 不接受 Function 构造器，函数引用使用现有的无类型传输契约。
  callback: { type: null as unknown as PropType<() => string>, required: true },
})
const itemLabels = computed(() => props.items.join(','))
const lastMethod = shallowRef('none')
const calls = shallowRef(0)
const callbackResult = shallowRef('not-called')

function label() {
  lastMethod.value = 'label'
  calls.value++
}
function total() {
  lastMethod.value = 'total'
  calls.value++
}
function payload() {
  lastMethod.value = 'payload'
  calls.value++
}
function items() {
  lastMethod.value = 'items'
  calls.value++
}
function callback() {
  lastMethod.value = 'callback'
  calls.value++
}
function callProp() {
  callbackResult.value = props.callback()
}
defineComponentJson({ component: true })
</script>

<template>
  <text id="string-value">{{ props.label }}</text>
  <text id="number-value">{{ props.total }}</text>
  <text id="object-value">{{ props.payload.label }}</text>
  <text id="array-value">{{ itemLabels }}</text>
  <button id="call-label" @tap="label">Invoke label method</button>
  <button id="call-total" @tap="total">Invoke total method</button>
  <button id="call-payload" @tap="payload">Invoke payload method</button>
  <button id="call-items" @tap="items">Invoke items method</button>
  <button id="call-callback" @tap="callback">Invoke callback method</button>
  <text id="last-method">{{ lastMethod }}</text>
  <text id="variant-handler-count">{{ calls }}</text>
  <button id="call-function-prop" @tap="callProp">Invoke callback prop</button>
  <text id="function-result">{{ callbackResult }}</text>
</template>
