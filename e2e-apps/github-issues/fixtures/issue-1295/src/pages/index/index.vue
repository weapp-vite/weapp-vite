<script setup lang="ts">
import { computed, ref } from 'wevu'

const props = defineProps({
  source: { type: String, default: 'change' },
})
const modelValue = defineModel<string>({ default: 'modelValue' })
const change = ref(props.source ?? 'change')
const selectA = ref('selectA')
const selectB = ref('selectB')
const localVisible = ref(true)
const localResult = ref('localResult')
const hasNext = computed(() => localVisible.value)

function changeBindings() {
  change.value = 'updated-change'
  selectA.value = 'updated-a'
  selectB.value = 'updated-b'
  localVisible.value = false
  localResult.value = 'updated-result'
}
</script>

<template>
  <view id="issue1295-page">
    <text id="model-value">{{ modelValue ?? 'modelValue' }}</text>
    <text id="change">{{ change }}</text>
    <text id="select-a">{{ selectA }}</text>
    <text id="select-b">{{ selectB }}</text>
    <text id="local-visible">{{ localVisible }}</text>
    <text id="local-result">{{ localResult }}</text>
    <text id="has-next">{{ hasNext }}</text>
    <button id="change-bindings" @tap="changeBindings">Change bindings</button>
  </view>
</template>
