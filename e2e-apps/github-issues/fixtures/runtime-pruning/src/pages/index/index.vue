<script setup lang="ts">
import { computed, onLoad, onMounted, ref } from 'wevu'
import CounterValue from '../../components/CounterValue.vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)
const phase = ref('setup')
const trace: string[] = ['setup']
const platform = import.meta.env.PLATFORM

onLoad(() => trace.push('load'))
onMounted(() => {
  trace.push('mounted')
  phase.value = 'mounted'
})

function increment() {
  count.value += 1
}

function readSnapshot() {
  return { count: count.value, phase: phase.value, trace: [...trace] }
}

defineExpose({ readSnapshot })
</script>

<template>
  <view id="pruning-page">
    <text id="pruning-platform">{{ platform }}</text>
    <text id="pruning-phase">{{ phase }}</text>
    <text id="pruning-count">{{ count }}</text>
    <text id="pruning-doubled">{{ doubled }}</text>
    <CounterValue id="pruning-child" :value="count" />
    <button id="pruning-increment" @tap="increment">Increment</button>
  </view>
</template>
