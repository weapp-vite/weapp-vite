<script setup lang="ts">
import { getCurrentSetupContext, shallowRef } from 'wevu'
import PropProbe from '../../components/propProbe/index.vue'
import PropVariants from '../../components/propVariants/index.vue'

const parentBack = shallowRef(false)
const label = shallowRef('string-initial')
const total = shallowRef(7)
const payload = shallowRef({ nested: { label: 'object-initial' } })
const items = shallowRef([['array-initial']])
const callbackCalls = shallowRef(0)
const instance = getCurrentSetupContext()!.instance!

function toggleBack() {
  parentBack.value = !parentBack.value
}

function updateVariants() {
  label.value = 'string-updated'
  total.value = 12
  payload.value = { nested: { label: 'object-updated' } }
  items.value = [['array-updated', 'second']]
}

function parentCallback() {
  callbackCalls.value++
  return label.value
}

function commitProjected(replaceWrapper: boolean) {
  // setup 代理优先暴露响应式状态；这里验证原生宿主 data 的显式提交。
  const nativeData = (instance.$el as { data: { payload: { nested: { label: string } }, items: string[][] } }).data
  const currentPayload = nativeData.payload
  const currentItems = nativeData.items
  const suffix = replaceWrapper ? 'new-wrapper' : 'same-reference'
  currentPayload.nested.label = `object-${suffix}`
  currentItems[0]![0] = `array-${suffix}`
  instance.setData({
    payload: replaceWrapper ? { ...currentPayload } : currentPayload,
    items: replaceWrapper ? [...currentItems] : currentItems,
  })
}

function commitSameProjection() {
  commitProjected(false)
}

function commitNewProjection() {
  commitProjected(true)
}
</script>

<template>
  <PropProbe id="default-probe" />
  <PropProbe id="explicit-false-probe" :back="false" />
  <PropProbe id="explicit-true-probe" :back="true" />
  <PropProbe id="updated-probe" :back="parentBack" />
  <button id="toggle-back" @tap="toggleBack">Toggle parent back</button>
  <PropVariants id="variant-probe" :label="label" :total="total" :payload="payload.nested" :items="items[0]" :callback="parentCallback" />
  <button id="update-variants" @tap="updateVariants">Update typed props</button>
  <text id="callback-count">{{ callbackCalls }}</text>
  <button id="commit-same-projection" @tap="commitSameProjection">Commit same reference</button>
  <button id="commit-new-projection" @tap="commitNewProjection">Commit new wrapper</button>
</template>
